import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { deleteObject, putObject } from "@/lib/storage";
import {
  audit,
  rateLimit,
  requireAdmin,
  type User,
} from "@/modules/auth/service";
import { upload, type Media } from "@/modules/media/service";
import {
  allowedFieldsSchema,
  emptyDocument,
  publicationIssues,
} from "@/modules/portfolios/schema";
import { getSite, saveDocument, type Site } from "@/modules/portfolios/service";
import { syncCustomDomains } from "@/modules/publishing/cdn";
import { renderPortfolio } from "@/modules/publishing/render";
import { type ReleaseManifest } from "@/modules/publishing/service";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { body, idSchema, json, readLimited } from "./shared";
import { domainRoutes } from "./domain-routes";

function publishedAddress(value?: string | null) {
  return (
    value?.replace(`${config().appUrl}/p/`, `${config().appUrl}/portfolio/`) ||
    null
  );
}

export async function portfolioRoutes(
  request: NextRequest,
  path: string[],
  database: Awaited<ReturnType<typeof db>>,
  user: User,
): Promise<Response | null> {
  const route = path.join("/"),
    method = request.method;
  if (route === "sites" && method === "GET") {
    const sites = await database.query<Site>(
      `SELECT s.id,s.name,s.slug,s.revision,s.status,s.published_release_id,s.updated_at,s.created_at,u.name AS client_name,r.manifest->>'baseUrl' AS "publishedUrl" FROM sites s LEFT JOIN users u ON s.client_id=u.id LEFT JOIN releases r ON r.id=s.published_release_id AND r.site_id=s.id ${user.role === "client" ? "WHERE s.client_id=$1" : ""} ORDER BY s.updated_at DESC`,
      user.role === "client" ? [user.id] : [],
    );
    return json({
      sites: sites.map((site) => ({
        ...site,
        publishedUrl: publishedAddress(site.publishedUrl),
      })),
    });
  }
  if (route === "sites" && method === "POST") {
    requireAdmin(user);
    const input = z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(60),
        clientId: z.union([z.literal(""), idSchema]).default(""),
      })
      .strict()
      .parse(await body(request));
    if (input.clientId) {
      const users = await database.query(
        "SELECT id FROM users WHERE id=$1 AND role='client' AND disabled=false",
        [input.clientId],
      );
      invariant(users.length, 400, "Select an active client account.");
    }
    const id = randomUUID(),
      document = emptyDocument(input.name);
    await database.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO sites(id,name,slug,client_id,draft,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          input.name,
          input.slug,
          input.clientId || null,
          JSON.stringify(document),
          user.id,
        ],
      );
      await tx.query(
        "INSERT INTO revisions(id,site_id,revision,document,author_id) VALUES($1,$2,1,$3,$4)",
        [randomUUID(), id, JSON.stringify(document), user.id],
      );
      await audit(user.id, id, "portfolio.created", {}, tx);
    });
    return json({ id }, 201);
  }
  if (path[0] === "sites" && path[1]) {
    const id = idSchema.parse(path[1]),
      action = path[2] || "",
      site = await getSite(user, id);
    if (path.length === 3 && ["domains", "verify-domain"].includes(action)) {
      return domainRoutes(request, action, id, database, user);
    }
    if (!action && path.length === 2 && method === "DELETE") {
      requireAdmin(user);
      const input = z
        .object({
          slug: z.string(),
          revision: z.number().int().positive(),
          deletePublished: z.boolean().default(false),
        })
        .strict()
        .parse(await body(request));
      await database.transaction(async (tx) => {
        const [current] = await tx.query<Site>(
          "SELECT * FROM sites WHERE id=$1 FOR UPDATE",
          [id],
        );
        invariant(current, 404, "Portfolio not found.");
        invariant(
          input.slug === current.slug && input.revision === current.revision,
          409,
          "Confirmation does not match the current draft. Reload and try again.",
        );
        invariant(
          (!current.published_release_id && current.status !== "published") ||
            input.deletePublished,
          409,
          "This portfolio is now live. Reload and confirm deletion of the published website, or unpublish it first.",
        );
        const jobs = await tx.query(
          "SELECT id FROM jobs WHERE site_id=$1 AND status IN ('queued','running') LIMIT 1",
          [id],
        );
        invariant(
          !jobs.length,
          409,
          "Wait for all background jobs to finish before deleting this portfolio.",
        );
        const domains = await tx.query(
          "SELECT id FROM domains WHERE site_id=$1 AND distribution_id IS NOT NULL LIMIT 1",
          [id],
        );
        invariant(
          !domains.length,
          409,
          "A provisioned custom domain must be retired before this portfolio can be deleted.",
        );
        // Remove the public entry point before deleting releases. The site lock
        // prevents publishing or restoring a release during this transaction.
        await deleteObject(`sites/${current.slug}/live.json`, tx);
        await tx.query("INSERT INTO storage_cleanup(prefix) VALUES($1),($2)", [
          `private/${id}/`,
          `releases/${id}/`,
        ]);
        await audit(
          user.id,
          id,
          "portfolio.deleted",
          {
            name: current.name,
            slug: current.slug,
            revision: current.revision,
            wasPublished: !!current.published_release_id,
          },
          tx,
        );
        await tx.query("DELETE FROM sites WHERE id=$1", [id]);
      });
      return json({ ok: true });
    }
    if (!action && method === "GET") {
      // Access was checked above. These independent reads can share the pool
      // instead of adding one database round trip after another.
      const [published, media, jobs, releases] = await Promise.all([
        site.published_release_id
          ? database.query<{
              document: unknown;
              manifest: { baseUrl?: string };
            }>(
              "SELECT document,manifest FROM releases WHERE id=$1 AND site_id=$2",
              [site.published_release_id, id],
            )
          : Promise.resolve([]),
        database.query<Media>(
          `SELECT id,site_id,filename,mime,bytes,summary,created_at${user.role === "admin" ? ",cv_import" : ""} FROM media WHERE site_id=$1 ORDER BY created_at DESC`,
          [id],
        ),
        database.query(
          "SELECT id,kind,status,error,created_at,finished_at FROM jobs WHERE site_id=$1 ORDER BY created_at DESC LIMIT 30",
          [id],
        ),
        database.query(
          "SELECT id,revision,created_at FROM releases WHERE site_id=$1 ORDER BY created_at DESC LIMIT 30",
          [id],
        ),
      ]);
      return json({
        site,
        publishedDocument: published[0]?.document || null,
        publishedUrl: publishedAddress(published[0]?.manifest?.baseUrl),
        media,
        jobs,
        releases,
      });
    }
    if (!action && method === "PUT") {
      const input = z
        .object({
          document: z.unknown(),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(await body(request));
      return json(await saveDocument(user, id, input.document, input.revision));
    }
    if (action === "permissions" && method === "PUT") {
      requireAdmin(user);
      const input = z
        .object({
          clientId: z.union([z.literal(""), idSchema]),
          editableFields: allowedFieldsSchema,
        })
        .strict()
        .parse(await body(request));
      if (input.clientId) {
        const [target] = await database.query(
          "SELECT id FROM users WHERE id=$1 AND role='client' AND disabled=false",
          [input.clientId],
        );
        invariant(target, 400, "Select an active client.");
      }
      await database.transaction(async (tx) => {
        await tx.query(
          "UPDATE sites SET client_id=$1,editable_fields=$2 WHERE id=$3",
          [input.clientId || null, JSON.stringify(input.editableFields), id],
        );
        await audit(
          user.id,
          id,
          "portfolio.permissions_updated",
          { clientId: input.clientId, editableFields: input.editableFields },
          tx,
        );
      });
      return json({ ok: true });
    }
    if (action === "media" && method === "POST") {
      await rateLimit(`upload:${user.id}`, 60, 3600);
      const bytes = await readLimited(request, 21 * 1024 * 1024);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") || "" },
        body: bytes,
      }).formData();
      const file = form.get("file");
      invariant(file instanceof File, 400, "Select a file to upload.");
      const purpose = z
        .enum(["article", "cv", "image"])
        .parse(form.get("purpose") || "article");
      return json(await upload(user, id, file, purpose), 201);
    }
    if (action === "publish" && method === "POST") {
      requireAdmin(user);
      const input = z
        .object({ revision: z.number().int().positive() })
        .parse(await body(request));
      const jobId = randomUUID();
      await database.transaction(async (tx) => {
        const [latest] = await tx.query<Site>(
          "SELECT * FROM sites WHERE id=$1 FOR UPDATE",
          [id],
        );
        invariant(
          latest.revision === input.revision,
          409,
          "The draft changed. Review the latest version before publishing.",
        );
        const issues = publicationIssues(latest.draft);
        invariant(!issues.length, 400, issues.join(" "));
        const [agency] = await tx.query<{ value: { name: string } }>(
          "SELECT value FROM settings WHERE key='agency'",
        );
        const [primaryDomain] = await tx.query<{
          id: string;
          hostname: string;
        }>(
          "SELECT id,hostname FROM domains WHERE site_id=$1 AND is_primary AND verified_at IS NOT NULL AND activated_at IS NOT NULL AND (distribution_id IS NOT NULL OR $2) LIMIT 1",
          [id, config().vps],
        );
        await tx.query(
          "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'publish',$3)",
          [
            jobId,
            id,
            JSON.stringify({
              document: latest.draft,
              revision: latest.revision,
              slug: latest.slug,
              agencyName: agency?.value.name || "Brilliancy Research",
              canonicalUrl: primaryDomain
                ? `https://${primaryDomain.hostname}`
                : `${config().appUrl}/portfolio/${latest.slug}`,
            }),
          ],
        );
        await audit(
          user.id,
          id,
          "portfolio.publish_requested",
          {
            revision: latest.revision,
            domainId: primaryDomain?.id || null,
            hostname: primaryDomain?.hostname || null,
          },
          tx,
        );
      });
      return json({ jobId }, 202);
    }
    if (action === "unpublish" && method === "POST") {
      requireAdmin(user);
      await database.transaction(async (tx) => {
        await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [id]);
        const running = await tx.query(
          "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND status IN ('queued','running')",
          [id],
        );
        invariant(
          !running.length,
          409,
          "Wait for the publishing job to finish before unpublishing.",
        );
        await syncCustomDomains(tx, id, null);
        await deleteObject(`sites/${site.slug}/live.json`, tx);
        await tx.query(
          "UPDATE sites SET published_release_id=NULL,status='draft' WHERE id=$1",
          [id],
        );
        await audit(user.id, id, "portfolio.unpublished", {}, tx);
      });
      return json({ ok: true });
    }
    if (action === "rollback" && method === "POST") {
      requireAdmin(user);
      const { releaseId } = z
        .object({ releaseId: idSchema })
        .parse(await body(request));
      await database.transaction(async (tx) => {
        await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [id]);
        const running = await tx.query(
          "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND status IN ('queued','running')",
          [id],
        );
        invariant(
          !running.length,
          409,
          "Wait for publishing to finish before restoring a release.",
        );
        const [release] = await tx.query<{ manifest: ReleaseManifest }>(
          "SELECT manifest FROM releases WHERE id=$1 AND site_id=$2",
          [releaseId, id],
        );
        invariant(release, 404, "Release not found.");
        await syncCustomDomains(tx, id, release.manifest);
        await putObject(
          `sites/${site.slug}/live.json`,
          JSON.stringify(release.manifest),
          "application/json",
          tx,
        );
        await tx.query(
          "UPDATE sites SET published_release_id=$1,status='draft' WHERE id=$2",
          [releaseId, id],
        );
        await audit(
          user.id,
          id,
          "portfolio.release_restored",
          { releaseId },
          tx,
        );
      });
      return json({ ok: true });
    }
    if (action === "history" && method === "GET")
      return json({
        revisions: await database.query(
          "SELECT r.id,r.revision,r.created_at,u.name AS author FROM revisions r JOIN users u ON u.id=r.author_id WHERE r.site_id=$1 ORDER BY r.revision DESC LIMIT 100",
          [id],
        ),
      });
    if (action === "restore" && method === "POST") {
      requireAdmin(user);
      const input = z
        .object({
          revision: z.number().int(),
          currentRevision: z.number().int(),
        })
        .parse(await body(request));
      const [previous] = await database.query<{ document: unknown }>(
        "SELECT document FROM revisions WHERE site_id=$1 AND revision=$2",
        [id, input.revision],
      );
      invariant(previous, 404, "Revision not found.");
      return json(
        await saveDocument(user, id, previous.document, input.currentRevision),
      );
    }
    if (action === "preview" && method === "GET") {
      const media = await database.query<{ id: string; mime: string }>(
        "SELECT id,mime FROM media WHERE site_id=$1",
        [id],
      );
      const [agency] = await database.query<{ value: { name: string } }>(
        "SELECT value FROM settings WHERE key='agency'",
      );
      const rendered = renderPortfolio(site.draft, {
        baseUrl: `${config().appUrl}/api/sites/${id}/preview`,
        fontUrl: (file) => `${config().appUrl}/fonts/${file}`,
        agencyName: agency?.value.name || "Brilliancy Research",
        asset: (assetId) => `${config().appUrl}/api/media/${assetId}`,
        isImage: (assetId) =>
          !!media.find((m) => m.id === assetId)?.mime.startsWith("image/"),
        siteId: id,
        appUrl: config().appUrl,
      });
      const route = path.slice(3).join("/");
      const html =
        rendered[
          route === "favicon.svg"
            ? route
            : route
              ? `${route}/index.html`
              : "index.html"
        ];
      invariant(html, 404, "Draft page not found.");
      return new Response(html, {
        headers: {
          "Content-Type":
            route === "favicon.svg"
              ? "image/svg+xml"
              : "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "Content-Security-Policy":
            "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
        },
      });
    }
    if (action === "export" && method === "GET")
      return new Response(
        JSON.stringify(
          {
            format: "brilliancy-portfolio-v1",
            exportedAt: new Date().toISOString(),
            site: { name: site.name, slug: site.slug, document: site.draft },
            media: await database.query(
              "SELECT id,filename,mime,bytes FROM media WHERE site_id=$1",
              [id],
            ),
          },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${site.slug}.json"`,
            "Cache-Control": "no-store",
          },
        },
      );
  }

  return null;
}
