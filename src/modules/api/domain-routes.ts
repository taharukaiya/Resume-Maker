import { config } from "@/lib/config";
import { token } from "@/lib/crypto";
import type { Database, Sql } from "@/lib/db";
import { AppError, invariant } from "@/lib/errors";
import { audit, requireAdmin, type User } from "@/modules/auth/service";
import { randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { body, idSchema, json } from "./shared";

type Domain = {
  id: string;
  site_id: string;
  hostname: string;
  verification_token: string;
  verified_at: string | null;
  activated_at: string | null;
  distribution_id: string | null;
  cdn_hostname: string | null;
  is_primary: boolean;
};

function normalizeHostname(input: string) {
  const value = input.trim().replace(/^https:\/\//i, "");
  // Inspect the original authority before URL normalization removes :443,
  // dot-segments or credential syntax. Only an optional root slash is allowed.
  invariant(
    /^[^\s\\\/?#:@%]+\/?$/.test(value),
    400,
    "Enter a domain or its HTTPS root address, without a path, port, query or login details.",
  );
  let hostname: string;
  try {
    hostname = new URL(`https://${value}`).hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    throw new AppError(400, "Enter a valid domain name.");
  }
  invariant(
    !isIP(hostname) &&
      /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        hostname,
      ),
    400,
    "Enter a domain name, not an IP address.",
  );
  const reserved = [config().appUrl, config().assetUrl].filter(Boolean);
  invariant(
    !reserved.some(
      (origin) =>
        new URL(origin!).hostname.toLowerCase().replace(/\.$/, "") === hostname,
    ),
    400,
    "The studio and media hostnames are reserved. Use a separate portfolio domain.",
  );
  return hostname;
}

async function lockSite(tx: Sql, siteId: string) {
  const [site] = await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [
    siteId,
  ]);
  invariant(site, 404, "Portfolio not found.");
}

async function requireIdlePublisher(tx: Sql, siteId: string) {
  const jobs = await tx.query(
    "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND status IN ('queued','running') LIMIT 1",
    [siteId],
  );
  invariant(
    !jobs.length,
    409,
    "Wait for publishing to finish before changing the website address.",
  );
}

// The caller performs siteAccess first. A host-side reconciler handles proxy
// setup; the web process has no Docker socket or proxy configuration access.
export async function domainRoutes(
  request: NextRequest,
  action: string,
  siteId: string,
  database: Database,
  user: User,
): Promise<Response | null> {
  if (!["domains", "verify-domain", "connect-domain"].includes(action))
    return null;
  requireAdmin(user);
  const method = request.method;
  if (action === "domains" && method === "GET") {
    return json({
      domains: await database.query<Domain>(
        "SELECT d.*, (SELECT value FROM settings WHERE key='vps.domain.request.' || d.id::text) AS connection FROM domains d WHERE site_id=$1 ORDER BY created_at DESC,id DESC",
        [siteId],
      ),
      hostingMode: config().vps
        ? "vps"
        : config().publishBucket
          ? "cloud"
          : "local",
    });
  }
  if (action === "connect-domain" && method === "POST") {
    invariant(
      config().vps,
      400,
      "Automatic connection is available on VPS hosting.",
    );
    const { domainId } = z
      .object({ domainId: idSchema })
      .strict()
      .parse(await body(request));
    const [domain] = await database.query<Domain>(
      "SELECT * FROM domains WHERE id=$1 AND site_id=$2",
      [domainId, siteId],
    );
    invariant(
      domain?.verified_at,
      400,
      "Verify this domain's DNS ownership first.",
    );
    invariant(!domain.activated_at, 409, "This domain is already connected.");
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      await tx.query(
        "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [
          `vps.domain.request.${domainId}`,
          JSON.stringify({
            status: "queued",
            message:
              "Checking DNS and HTTPS. Refresh status in about a minute.",
            requestedAt: new Date().toISOString(),
          }),
        ],
      );
      await audit(
        user.id,
        siteId,
        "domain.connection_requested",
        { domainId, hostname: domain.hostname },
        tx,
      );
    });
    return json({ ok: true });
  }
  if (action === "domains" && method === "POST") {
    const input = z
      .object({ hostname: z.string().min(1).max(2048) })
      .strict()
      .parse(await body(request));
    const hostname = normalizeHostname(input.hostname);
    const domainId = randomUUID();
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      const created = await tx.query(
        "INSERT INTO domains(id,site_id,hostname,verification_token) VALUES($1,$2,$3,$4) ON CONFLICT(hostname) DO NOTHING RETURNING id",
        [domainId, siteId, hostname, token()],
      );
      invariant(
        created.length,
        409,
        "This domain has already been added. Use its existing entry or choose another domain.",
      );
      await audit(user.id, siteId, "domain.added", { domainId, hostname }, tx);
    });
    return json({ id: domainId }, 201);
  }
  if (action === "domains" && method === "PUT") {
    const { domainId } = z
      .object({ domainId: idSchema.nullable() })
      .strict()
      .parse(await body(request));
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      await requireIdlePublisher(tx, siteId);
      let selected: Domain | undefined;
      if (domainId) {
        [selected] = await tx.query<Domain>(
          "SELECT * FROM domains WHERE id=$1 AND site_id=$2 FOR UPDATE",
          [domainId, siteId],
        );
        invariant(selected, 404, "Domain not found for this portfolio.");
        invariant(
          selected.verified_at &&
            selected.activated_at &&
            (config().vps || selected.distribution_id),
          409,
          "Verify ownership and complete hosting and HTTPS setup before using this address.",
        );
      }
      await tx.query(
        "UPDATE domains SET is_primary=false WHERE site_id=$1 AND is_primary",
        [siteId],
      );
      if (selected)
        await tx.query(
          "UPDATE domains SET is_primary=true WHERE id=$1 AND site_id=$2",
          [selected.id, siteId],
        );
      await audit(
        user.id,
        siteId,
        "domain.primary_selected",
        { domainId, hostname: selected?.hostname || null },
        tx,
      );
    });
    return json({ ok: true });
  }
  if (action === "domains" && method === "DELETE") {
    const { domainId } = z
      .object({ domainId: idSchema })
      .strict()
      .parse(await body(request));
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      await requireIdlePublisher(tx, siteId);
      const [domain] = await tx.query<Domain>(
        "SELECT * FROM domains WHERE id=$1 AND site_id=$2 FOR UPDATE",
        [domainId, siteId],
      );
      invariant(domain, 404, "Domain not found for this portfolio.");
      invariant(
        !domain.is_primary &&
          !domain.activated_at &&
          !domain.distribution_id &&
          !domain.cdn_hostname,
        409,
        "A connected or selected domain must be retired by the hosting administrator before removal.",
      );
      const used = await tx.query(
        "SELECT id FROM releases WHERE site_id=$1 AND manifest->>'baseUrl' IN ($2,$3) LIMIT 1",
        [siteId, `https://${domain.hostname}`, `https://${domain.hostname}/`],
      );
      const jobs = await tx.query(
        "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND payload->>'canonicalUrl' IN ($2,$3) LIMIT 1",
        [siteId, `https://${domain.hostname}`, `https://${domain.hostname}/`],
      );
      const history = await tx.query(
        "SELECT id FROM audit_events WHERE site_id=$1 AND action='portfolio.publish_requested' AND details->>'domainId'=$2 LIMIT 1",
        [siteId, domainId],
      );
      invariant(
        !used.length && !jobs.length && !history.length,
        409,
        "This domain has been used for publishing. Keep its history and ask the hosting administrator to retire it.",
      );
      await tx.query("DELETE FROM domains WHERE id=$1 AND site_id=$2", [
        domainId,
        siteId,
      ]);
      await audit(
        user.id,
        siteId,
        "domain.removed",
        { domainId, hostname: domain.hostname },
        tx,
      );
    });
    return json({ ok: true });
  }
  if (action === "verify-domain" && method === "POST") {
    const { domainId } = z
      .object({ domainId: idSchema })
      .strict()
      .parse(await body(request));
    const [domain] = await database.query<Domain>(
      "SELECT * FROM domains WHERE id=$1 AND site_id=$2",
      [domainId, siteId],
    );
    invariant(domain, 404, "Domain not found for this portfolio.");
    let values: string[][];
    try {
      values = await resolveTxt(`_brilliancy.${domain.hostname}`);
    } catch {
      throw new AppError(
        400,
        "The verification TXT record was not found. DNS changes can take time to appear.",
      );
    }
    invariant(
      values.some((value) => value.join("") === domain.verification_token),
      400,
      "The DNS verification token does not match.",
    );
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      const verified = await tx.query(
        "UPDATE domains SET verified_at=now() WHERE id=$1 AND site_id=$2 AND verification_token=$3 RETURNING id",
        [domainId, siteId, domain.verification_token],
      );
      invariant(verified.length, 404, "Domain not found for this portfolio.");
      await audit(
        user.id,
        siteId,
        "domain.verified",
        { domainId, hostname: domain.hostname },
        tx,
      );
    });
    return json({ ok: true });
  }
  return null;
}
