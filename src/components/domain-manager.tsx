"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Globe, LockKeyhole } from "lucide-react";
import { api, Badge, Button, Field, Feedback, useFeedback } from "./ui";
import { useConfirmation } from "./confirmation";
type Domain = {
  id: string;
  hostname: string;
  verification_token: string;
  verified_at: string | null;
  activated_at: string | null;
  cdn_hostname: string | null;
  distribution_id: string | null;
  is_primary: boolean;
  verification_hostname?: string | null;
  connection?: { status: string; message: string };
  preparation?: { status: string; message: string };
};
export function DomainManager({
  siteId,
  slug,
  publishedUrl,
  onReview,
  suggestedDomain,
  onPendingChange,
}: {
  siteId: string;
  slug: string;
  publishedUrl?: string | null;
  onReview?: () => void;
  suggestedDomain: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const feedback = useFeedback();
  const confirm = useConfirmation();
  const [hostname, setHostname] = useState(suggestedDomain);
  const [dnsTarget, setDnsTarget] = useState<string | null>(null);
  const [studioUrl, setStudioUrl] = useState("");
  const [copied, setCopied] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [origin, setOrigin] = useState("");
  const [hostingMode, setHostingMode] = useState("local");
  const [selection, setSelection] = useState("");
  const [loading, setLoading] = useState(true);
  const [automation, setAutomation] = useState({
    configured: false,
    available: false,
    goLiveEnabled: false,
    allowedDomains: [] as string[],
  });
  async function load() {
    const result = await api<{
      domains: Domain[];
      hostingMode: string;
      dnsTarget?: string | null;
      studioUrl?: string;
      automation?: typeof automation;
    }>(`sites/${siteId}/domains`);
    setDomains(result.domains);
    if (result.automation) setAutomation(result.automation);
    setHostingMode(result.hostingMode);
    setDnsTarget(result.dnsTarget || null);
    setStudioUrl(result.studioUrl || window.location.origin);
    setSelection(result.domains.find((domain) => domain.is_primary)?.id || "");
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    setLoading(true);
    void feedback.run(load).finally(() => setLoading(false));
  }, [siteId]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(""), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  const connecting = domains.some(
    (domain) =>
      ["queued", "dns_pending", "connecting", "publishing"].includes(
        domain.connection?.status || "",
      ) ||
      ["preparing", "awaiting_dns"].includes(domain.preparation?.status || ""),
  );
  useEffect(() => {
    if (!connecting) return;
    const timer = setInterval(() => {
      void api<{ domains: Domain[]; automation?: typeof automation }>(
        `sites/${siteId}/domains`,
      )
        .then((result) => {
          setSelection((current) =>
            current === (domains.find((domain) => domain.is_primary)?.id || "")
              ? result.domains.find((domain) => domain.is_primary)?.id || ""
              : current,
          );
          setDomains(result.domains);
          if (result.automation) setAutomation(result.automation);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [connecting, siteId, domains]);
  const copy = (value: string) => (
    <button
      type="button"
      className="dns-copy"
      aria-label={`Copy ${value}`}
      onClick={() =>
        void feedback.run(async () => {
          await navigator.clipboard.writeText(value);
          setCopied(value);
        })
      }
    >
      {copied === value ? <Check size={15} /> : <Copy size={15} />}
      {copied === value ? "Copied" : "Copy"}
    </button>
  );
  const primary = domains.find((domain) => domain.is_primary);
  const addressChanged = selection !== (primary?.id || "");
  useEffect(() => {
    onPendingChange?.(!loading && addressChanged);
    return () => onPendingChange?.(false);
  }, [loading, addressChanged, onPendingChange]);
  const sharedUrl = `${origin}/portfolio/${slug}`;
  const nextUrl = primary ? `https://${primary.hostname}` : sharedUrl;
  const ready = (domain: Domain) =>
    !!domain.verified_at &&
    !!domain.activated_at &&
    (hostingMode === "vps" || !!domain.distribution_id);
  return (
    <section className="panel domain-manager">
      <p className="eyebrow">Website address</p>
      <h2>A personal address for this portfolio.</h2>
      <p className="panel-description">
        Choose a domain you own, prepare it safely, then go live after reviewing
        your portfolio.
      </p>
      <div className="address-current">
        <span>
          {publishedUrl
            ? "Current published address"
            : "Included address after publishing"}
        </span>
        {publishedUrl ? (
          <a href={publishedUrl} target="_blank" rel="noreferrer">
            {publishedUrl} ↗
          </a>
        ) : (
          <strong>
            {origin}/portfolio/{slug}
          </strong>
        )}
      </div>
      <Feedback {...feedback} />
      {!loading && (
        <form
          className="domain-address-form"
          onSubmit={(event) => {
            event.preventDefault();
            void feedback.run(async () => {
              await api(`sites/${siteId}/domains`, {
                method: "PUT",
                body: JSON.stringify({ domainId: selection || null }),
              });
              await load();
            }, "Address saved. Review and publish the portfolio to apply it.");
          }}
        >
          <Field
            label="Public website address"
            hint="Only verified domains with hosting and HTTPS connected can be selected."
          >
            <select
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
            >
              <option value="">Shared address — /portfolio/{slug}</option>
              {domains.map((domain) => (
                <option
                  key={domain.id}
                  value={domain.id}
                  disabled={!ready(domain)}
                >
                  https://{domain.hostname}
                  {!ready(domain) ? " — setup needed" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="row wrap">
            <Button
              variant="secondary"
              busy={feedback.busy}
              disabled={!addressChanged}
            >
              Save website address
            </Button>
            {onReview && (
              <Button
                type="button"
                variant="secondary"
                onClick={onReview}
                disabled={addressChanged || feedback.busy}
              >
                Review & publish
              </Button>
            )}
          </div>
          {addressChanged && (
            <p>
              Save the selected website address before reviewing and publishing.
            </p>
          )}
          <p className="panel-description">
            Address for the next publication:{" "}
            <strong className="domain-next-url">{nextUrl}</strong>
          </p>
          {!!publishedUrl &&
            nextUrl.replace(/\/$/, "") !== publishedUrl.replace(/\/$/, "") && (
              <p>
                The live address above stays in use until you publish the
                selected address.
              </p>
            )}
        </form>
      )}
      <div className="domain-login-note">
        <LockKeyhole size={18} aria-hidden="true" />
        <p>
          One secure dashboard for every portfolio:{" "}
          <strong>{studioUrl}/login</strong>. Visitors to a connected
          portfolio’s <strong>/login</strong> address are sent here. Clients
          sign in to their own assigned portfolios.
        </p>
      </div>
      <details className="domain-setup" open>
        <summary>Connect a personal domain</summary>
        {!!suggestedDomain && (
          <div className="domain-suggestion">
            <strong>Suggested domain: {suggestedDomain}</strong>
            <p>
              This name is suggested automatically from the portfolio name.
              Availability has not been checked. Register it with your domain
              provider before connecting it here.
            </p>
            <Button
              type="button"
              variant="secondary small"
              onClick={() => setHostname(suggestedDomain)}
            >
              Use suggested name
            </Button>
          </div>
        )}
        <ol className="domain-steps">
          <li>
            <strong>Choose your name</strong>
            <span>
              Use a domain you already own, or register one with your domain
              provider. Adding a name here does not purchase it.
            </span>
          </li>
          <li>
            <strong>Prepare domain</strong>
            <span>
              Let Hostinger add the ownership record automatically, or use the
              manual instructions. Preparation keeps your current website live.
            </span>
          </li>
          <li>
            <strong>Go live after review</strong>
            <span>
              Publish and review your portfolio at its shared address first.
              Going live is a separate, approved step.
            </span>
          </li>
        </ol>
        <form
          className="domain-form"
          onSubmit={(e) => {
            e.preventDefault();
            void feedback.run(async () => {
              await api(`sites/${siteId}/domains`, {
                method: "POST",
                body: JSON.stringify({
                  hostname: hostname.trim().toLowerCase(),
                  ...(hostingMode === "vps" ? { wwwPrimary: true } : {}),
                }),
              });
              setHostname(suggestedDomain);
              await load();
            }, "Domain added. Prepare it below; your existing website is unchanged.");
          }}
        >
          <Field
            label="Domain name"
            hint="Enter a domain you own, such as researchbyrukaiya.com. A full https:// address without a page path also works."
          >
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
              autoCapitalize="none"
              spellCheck={false}
              placeholder="researchbyrukaiya.com"
            />
          </Field>
          <Button variant="secondary" busy={feedback.busy}>
            Add domain
          </Button>
        </form>
        {hostingMode === "vps" && (
          <p className="panel-description">
            <Globe size={16} aria-hidden="true" /> Your main address will use
            www. The address without www will redirect automatically, with HTTPS
            on both.
          </p>
        )}
        {domains.map((domain) => (
          <div key={domain.id} className="domain-record">
            <div className="spread wrap">
              <strong>{domain.hostname}</strong>
              <Badge
                value={
                  domain.preparation?.status === "purchase_required"
                    ? "purchase required"
                    : domain.preparation?.status === "dns_setup_required"
                      ? "add to Hostinger"
                      : domain.connection?.status === "ready"
                        ? "live"
                        : domain.preparation?.status === "prepared" &&
                            !ready(domain)
                          ? "prepared — not live"
                          : domain.is_primary && ready(domain)
                            ? "selected for publishing"
                            : ready(domain)
                              ? "ready to select"
                              : domain.verified_at
                                ? "HTTPS setup needed"
                                : "awaiting verification"
                }
              />
            </div>
            <details className="domain-setup">
              <summary>Manual DNS instructions</summary>
              <p>
                In Hostinger:{" "}
                <strong>
                  Domains → Domain portfolio → Manage → DNS / Nameservers
                </strong>
                . If your DNS is managed elsewhere, add the records there. Use
                the default TTL.
              </p>
              <div className="dns-records-scroll">
                <table className="dns-records">
                  <caption>
                    DNS records for{" "}
                    {domain.verification_hostname || domain.hostname}
                  </caption>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name / Host</th>
                      <th>Value / Points to</th>
                      <th>Copy value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>A</td>
                      <td>
                        {domain.verification_hostname ? "@" : domain.hostname}
                      </td>
                      <td>
                        <code>
                          {dnsTarget ||
                            "VPS public IP — ask your hosting administrator"}
                        </code>
                      </td>
                      <td>{dnsTarget && copy(dnsTarget)}</td>
                    </tr>
                    {domain.verification_hostname && (
                      <tr>
                        <td>CNAME</td>
                        <td>www</td>
                        <td>
                          <code>{domain.verification_hostname}</code>
                        </td>
                        <td>{copy(domain.verification_hostname)}</td>
                      </tr>
                    )}
                    <tr>
                      <td>TXT</td>
                      <td>
                        <code>
                          {domain.verification_hostname
                            ? "_brilliancy"
                            : `_brilliancy.${domain.hostname}`}
                        </code>
                      </td>
                      <td>
                        <code>{domain.verification_token}</code>
                      </td>
                      <td>{copy(domain.verification_token)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="panel-description">
                Full verification record:{" "}
                <code>
                  _brilliancy.{domain.verification_hostname || domain.hostname}
                </code>
                . Keep this TXT record after connecting. DNS changes may take up
                to 48 hours. Update conflicting website A/AAAA/CNAME records
                only; keep your email MX and TXT records.
              </p>
              {domain.verification_hostname && (
                <p className="domain-redirect-note">
                  https://{domain.verification_hostname} →{" "}
                  <strong>https://{domain.hostname}</strong> · HTTPS and
                  redirect are configured together.
                </p>
              )}
            </details>
            {hostingMode === "vps" && !ready(domain) && (
              <div className="stack">
                <p className="panel-description">
                  Prepare checks registration and adds the ownership TXT record
                  to an accessible Hostinger DNS zone. It does not purchase a
                  domain, change nameservers, or switch your website.
                </p>
                {!automation.configured && (
                  <p>
                    Hostinger is not connected yet. Your hosting administrator
                    can securely connect it once for all portfolios. Manual
                    instructions are available above.
                  </p>
                )}
                {domain.preparation && (
                  <p role="status">{domain.preparation.message}</p>
                )}
                {domain.preparation?.status === "purchase_required" && (
                  <div className="domain-action-needed">
                    <strong>Purchase this domain first</strong>
                    <p>
                      Register {domain.verification_hostname || domain.hostname}{" "}
                      with a domain registrar. Then return here and check again.
                      The purchase is separate from portfolio setup.
                    </p>
                    <a
                      href="https://hpanel.hostinger.com/domains/domain-checker"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Hostinger domain search ↗
                    </a>
                  </div>
                )}
                {domain.preparation?.status === "dns_setup_required" && (
                  <div className="domain-action-needed">
                    <strong>
                      Add the domain to Hostinger DNS Manager once
                    </strong>
                    <p>
                      This domain needs a one-time setup in Hostinger. Add the
                      domain you own there, then retry here to create and verify
                      the TXT record automatically. If your DNS is hosted
                      elsewhere, use the manual TXT instructions. Changing
                      nameservers can affect your existing website and email;
                      preparation does not change them.
                    </p>
                    <a
                      href="https://hpanel.hostinger.com/domains/dns"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Hostinger DNS Manager ↗
                    </a>
                  </div>
                )}
                {domain.connection && (
                  <p role="status">{domain.connection.message}</p>
                )}
                <div className="row wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    busy={feedback.busy}
                    disabled={
                      !automation.configured ||
                      ["preparing", "awaiting_dns"].includes(
                        domain.preparation?.status || "",
                      ) ||
                      [
                        "queued",
                        "dns_pending",
                        "connecting",
                        "publishing",
                      ].includes(domain.connection?.status || "")
                    }
                    onClick={() =>
                      void feedback.run(async () => {
                        await api(`sites/${siteId}/prepare-domain`, {
                          method: "POST",
                          body: JSON.stringify({ domainId: domain.id }),
                        });
                        await load();
                      }, "Preparation requested. Your existing website stays unchanged.")
                    }
                  >
                    {domain.preparation?.status === "purchase_required"
                      ? "Check again after purchase"
                      : "Prepare domain"}
                  </Button>
                  <Button
                    type="button"
                    busy={feedback.busy}
                    disabled={
                      !automation.goLiveEnabled ||
                      !automation.allowedDomains.includes(
                        domain.verification_hostname || domain.hostname,
                      ) ||
                      domain.preparation?.status !== "prepared" ||
                      !domain.verified_at ||
                      [
                        "queued",
                        "dns_pending",
                        "connecting",
                        "publishing",
                      ].includes(domain.connection?.status || "")
                    }
                    onClick={() =>
                      void (async () => {
                        if (
                          !(await confirm({
                            title: `Go live at ${domain.hostname}?`,
                            description: `Connect website DNS and HTTPS for ${domain.hostname} and publish the already reviewed portfolio there. Email records stay unchanged. Existing websites with conflicting hosting or DNS require a separate reviewed migration.`,
                            confirmLabel: "Go live",
                          }))
                        )
                          return;
                        await feedback.run(async () => {
                          await api(`sites/${siteId}/go-live-domain`, {
                            method: "POST",
                            body: JSON.stringify({
                              domainId: domain.id,
                              confirmHostname: domain.hostname,
                            }),
                          });
                          await load();
                        }, "Go live requested. DNS and HTTPS progress will appear here.");
                      })()
                    }
                  >
                    Go live
                  </Button>
                  <Button
                    type="button"
                    variant="secondary small"
                    busy={feedback.busy}
                    onClick={() => void feedback.run(load)}
                  >
                    Refresh status
                  </Button>
                </div>
                {(!automation.goLiveEnabled ||
                  !automation.allowedDomains.includes(
                    domain.verification_hostname || domain.hostname,
                  )) && (
                  <p className="panel-description">
                    Go live is paused until this portfolio has been reviewed and
                    its domain approved for launch. Preparing it will not switch
                    an existing website.
                  </p>
                )}
                {!domain.verified_at && (
                  <Button
                    type="button"
                    variant="secondary small"
                    busy={feedback.busy}
                    onClick={() =>
                      void feedback.run(async () => {
                        await api(`sites/${siteId}/verify-domain`, {
                          method: "POST",
                          body: JSON.stringify({ domainId: domain.id }),
                        });
                        await load();
                      }, "Ownership verified. No website was switched.")
                    }
                  >
                    Verify manual TXT record
                  </Button>
                )}
              </div>
            )}
            {ready(domain) && (
              <p role="status">
                {domain.connection?.message ||
                  "HTTPS is connected. Select this address above and review your publication."}
              </p>
            )}
            {!domain.activated_at &&
              !domain.distribution_id &&
              !domain.cdn_hostname &&
              !domain.is_primary && (
                <Button
                  type="button"
                  variant="secondary small"
                  busy={feedback.busy}
                  onClick={() => {
                    void (async () => {
                      if (
                        !(await confirm({
                          title: "Remove this domain?",
                          description: `Remove ${domain.hostname} from this portfolio’s setup. Its DNS records and registration will stay unchanged.`,
                          confirmLabel: "Remove domain",
                        }))
                      )
                        return;
                      await feedback.run(async () => {
                        await api(`sites/${siteId}/domains`, {
                          method: "DELETE",
                          body: JSON.stringify({ domainId: domain.id }),
                        });
                        await load();
                      }, "Domain removed from setup.");
                    })();
                  }}
                >
                  Remove domain
                </Button>
              )}
          </div>
        ))}
      </details>
    </section>
  );
}
