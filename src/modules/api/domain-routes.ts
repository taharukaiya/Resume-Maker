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
  verification_hostname: string | null;
  redirect_to: string | null;
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
  if (
    ![
      "domains",
      "verify-domain",
      "connect-domain",
      "prepare-domain",
      "go-live-domain",
    ].includes(action)
  )
    return null;
  requireAdmin(user);
  const method = request.method;
  if (action === "domains" && method === "GET") {
    const [automation] = await database.query<{
      value: {
        configured?: boolean;
        checkedAt?: string;
        goLiveDomains?: string[];
      };
    }>("SELECT value FROM settings WHERE key='vps.domain.automation'");
    const available =
      !!automation?.value.checkedAt &&
      Date.now() - Date.parse(automation.value.checkedAt) < 180000;
    return json({
      domains: await database.query<Domain>(
        "SELECT d.*, (SELECT value FROM settings WHERE key='vps.domain.request.' || d.id::text) AS connection, (SELECT value FROM settings WHERE key='vps.domain.prepare.' || d.id::text) AS preparation FROM domains d WHERE site_id=$1 AND redirect_to IS NULL ORDER BY created_at DESC,id DESC",
        [siteId],
      ),
      hostingMode: config().vps
        ? "vps"
        : config().publishBucket
          ? "cloud"
          : "local",
      dnsTarget: process.env.VPS_PUBLIC_IP || null,
      studioUrl: config().appUrl,
      automation: {
        available,
        configured: available && automation?.value.configured === true,
        goLiveEnabled: process.env.DOMAIN_GO_LIVE_ENABLED === "true",
        allowedDomains: available ? automation?.value.goLiveDomains || [] : [],
      },
    });
  }
  if (action === "prepare-domain" && method === "POST") {
    invariant(config().vps, 400, "Automatic preparation requires VPS hosting.");
    const { domainId } = z
      .object({ domainId: idSchema })
      .strict()
      .parse(await body(request));
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      const [domain] = await tx.query<Domain>(
        "SELECT * FROM domains WHERE id=$1 AND site_id=$2 FOR UPDATE",
        [domainId, siteId],
      );
      invariant(
        domain && !domain.redirect_to,
        404,
        "Domain not found for this portfolio.",
      );
      invariant(!domain.activated_at, 409, "This domain is already connected.");
      invariant(
        domain.verification_hostname &&
          domain.hostname === `www.${domain.verification_hostname}`,
        400,
        "Use manual DNS setup for this address.",
      );
      const [active] = await tx.query<{ value: { status: string } }>(
        "SELECT value FROM settings WHERE key=$1",
        [`vps.domain.request.${domainId}`],
      );
      invariant(
        !["queued", "dns_pending", "connecting", "publishing"].includes(
          active?.value.status,
        ),
        409,
        "A connection is already in progress.",
      );
      await tx.query(
        "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [
          `vps.domain.prepare.${domainId}`,
          JSON.stringify({
            status: "preparing",
            message:
              "Preparing ownership verification. Website and email routing stay unchanged.",
            requestedAt: new Date().toISOString(),
          }),
        ],
      );
      await audit(
        user.id,
        siteId,
        "domain.preparation_requested",
        { domainId, hostname: domain.hostname },
        tx,
      );
    });
    return json({ ok: true }, 202);
  }
  if (
    ["connect-domain", "go-live-domain"].includes(action) &&
    method === "POST"
  ) {
    invariant(
      config().vps,
      400,
      "Automatic connection is available on VPS hosting.",
    );
    invariant(
      process.env.DOMAIN_GO_LIVE_ENABLED === "true",
      409,
      "Go live is paused while existing websites are being reviewed. Prepare domain is still available.",
    );
    const { domainId, confirmHostname } = z
      .object({ domainId: idSchema, confirmHostname: z.string() })
      .strict()
      .parse(await body(request));
    const [domain] = await database.query<Domain>(
      "SELECT * FROM domains WHERE id=$1 AND site_id=$2",
      [domainId, siteId],
    );
    invariant(
      domain?.verified_at && !domain.redirect_to,
      400,
      "Verify this domain's DNS ownership first.",
    );
    invariant(!domain.activated_at, 409, "This domain is already connected.");
    invariant(
      confirmHostname === domain.hostname,
      400,
      "Confirm the exact website address before going live.",
    );
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      await requireIdlePublisher(tx, siteId);
      const [currentDomain] = await tx.query<Domain>(
        "SELECT * FROM domains WHERE id=$1 AND site_id=$2 FOR UPDATE",
        [domainId, siteId],
      );
      invariant(
        currentDomain?.verified_at &&
          !currentDomain.activated_at &&
          !currentDomain.redirect_to,
        409,
        "Domain setup changed. Refresh and try again.",
      );
      const [pending] = await tx.query<{ value: { status: string } }>(
        "SELECT value FROM settings WHERE key=$1",
        [`vps.domain.request.${domainId}`],
      );
      invariant(
        !["queued", "dns_pending", "connecting", "publishing"].includes(
          pending?.value.status,
        ),
        409,
        "A domain launch is already in progress.",
      );
      const [preparation] = await tx.query<{ value: { status: string } }>(
        "SELECT value FROM settings WHERE key=$1",
        [`vps.domain.prepare.${domainId}`],
      );
      invariant(
        preparation?.value.status === "prepared",
        409,
        "Prepare this domain and wait for ownership verification first.",
      );
      const [automation] = await tx.query<{
        value: { checkedAt: string; goLiveDomains: string[] };
      }>("SELECT value FROM settings WHERE key='vps.domain.automation'");
      invariant(
        automation?.value.goLiveDomains?.includes(
          domain.verification_hostname || domain.hostname,
        ) && Date.now() - Date.parse(automation.value.checkedAt) < 180000,
        409,
        "This domain has not been approved for launch by the hosting administrator.",
      );
      const [review] = await tx.query<{
        revision: number;
        published_release_id: string;
      }>(
        "SELECT s.revision,s.published_release_id FROM sites s JOIN releases r ON r.id=s.published_release_id AND r.site_id=s.id AND r.revision=s.revision WHERE s.id=$1",
        [siteId],
      );
      invariant(
        review,
        409,
        "Review and publish the latest draft at its shared address before going live.",
      );
      await tx.query(
        "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [
          `vps.domain.request.${domainId}`,
          JSON.stringify({
            status: "queued",
            message:
              "Checking DNS and HTTPS. Refresh status in about a minute.",
            requestedAt: new Date().toISOString(),
            reviewedReleaseId: review.published_release_id,
            revision: review.revision,
            actorId: user.id,
          }),
        ],
      );
      await audit(
        user.id,
        siteId,
        "domain.go_live_requested",
        { domainId, hostname: domain.hostname },
        tx,
      );
    });
    return json({ ok: true });
  }
  if (action === "domains" && method === "POST") {
    const input = z
      .object({
        hostname: z.string().min(1).max(2048),
        wwwPrimary: z.boolean().optional(),
      })
      .strict()
      .parse(await body(request));
    const entered = normalizeHostname(input.hostname);
    invariant(
      !input.wwwPrimary || config().vps,
      400,
      "Paired www setup requires VPS hosting.",
    );
    const root = input.wwwPrimary ? entered.replace(/^www\./, "") : entered;
    const hostname = input.wwwPrimary
      ? normalizeHostname(`www.${root}`)
      : entered;
    if (input.wwwPrimary) normalizeHostname(root);
    const domainId = randomUUID();
    const verificationToken = token();
    await database.transaction(async (tx) => {
      await lockSite(tx, siteId);
      const created = await tx.query(
        "INSERT INTO domains(id,site_id,hostname,verification_token,verification_hostname) VALUES($1,$2,$3,$4,$5) ON CONFLICT(hostname) DO NOTHING RETURNING id",
        [
          domainId,
          siteId,
          hostname,
          verificationToken,
          input.wwwPrimary ? root : null,
        ],
      );
      invariant(
        created.length,
        409,
        "This domain has already been added. Use its existing entry or choose another domain.",
      );
      if (input.wwwPrimary) {
        const alias = await tx.query(
          "INSERT INTO domains(id,site_id,hostname,verification_token,verification_hostname,redirect_to) VALUES($1,$2,$3,$4,$3,$5) ON CONFLICT(hostname) DO NOTHING RETURNING id",
          [randomUUID(), siteId, root, verificationToken, hostname],
        );
        invariant(
          alias.length,
          409,
          "The address without www is already connected or reserved. Remove its unused setup first, or ask the hosting administrator to migrate the existing address.",
        );
      }
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
          !selected.redirect_to &&
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
      const inProgress = await tx.query(
        "SELECT key FROM settings WHERE key IN ($1,$2) AND value->>'status' IN ('preparing','awaiting_dns','queued','dns_pending','connecting','publishing')",
        [`vps.domain.prepare.${domainId}`, `vps.domain.request.${domainId}`],
      );
      invariant(
        !inProgress.length,
        409,
        "Wait for domain preparation or connection to finish before removing it.",
      );
      invariant(
        !domain.redirect_to,
        409,
        "Manage this redirect through its www domain.",
      );
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
      await tx.query(
        "DELETE FROM domains WHERE redirect_to=$1 AND site_id=$2",
        [domain.hostname, siteId],
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
    invariant(
      !domain.redirect_to,
      409,
      "Manage this redirect through its www domain.",
    );
    let values: string[][];
    try {
      values = await resolveTxt(
        `_brilliancy.${domain.verification_hostname || domain.hostname}`,
      );
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
      await tx.query(
        "UPDATE domains SET verified_at=now() WHERE redirect_to=$1 AND site_id=$2 AND verification_token=$3",
        [domain.hostname, siteId, domain.verification_token],
      );
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
