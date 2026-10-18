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
  async function load() {
    const result = await api<{
      domains: Domain[];
      hostingMode: string;
      dnsTarget?: string | null;
      studioUrl?: string;
    }>(`sites/${siteId}/domains`);
    setDomains(result.domains);
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
  const connecting = domains.some((domain) =>
    ["queued", "connecting"].includes(domain.connection?.status || ""),
  );
  useEffect(() => {
    if (!connecting) return;
    const timer = setInterval(() => {
      void api<{ domains: Domain[] }>(`sites/${siteId}/domains`)
        .then((result) => setDomains(result.domains))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [connecting, siteId]);
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
        Choose a name, add the DNS records, then connect. You can use the
        suggested name or enter any domain you own.
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
            <strong>Add DNS records</strong>
            <span>
              Copy the records shown below into Hostinger or your domain
              provider’s DNS settings.
            </span>
          </li>
          <li>
            <strong>Connect & publish</strong>
            <span>
              Verify ownership, connect HTTPS, then select the ready address
              above and review your portfolio before publishing.
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
            }, "Domain added. Follow the DNS instructions below.");
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
                  domain.is_primary && ready(domain)
                    ? "selected for publishing"
                    : ready(domain)
                      ? "ready to select"
                      : domain.verified_at
                        ? "HTTPS setup needed"
                        : "awaiting verification"
                }
              />
            </div>
            <p>
              In Hostinger:{" "}
              <strong>
                Domains → Domain portfolio → Manage → DNS / Nameservers
              </strong>
              . If your DNS is managed elsewhere, add the records there. Use the
              default TTL.
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
              to 48 hours. Update conflicting website A/AAAA/CNAME records only;
              keep your email MX and TXT records.
            </p>
            {domain.verification_hostname && (
              <p className="domain-redirect-note">
                https://{domain.verification_hostname} →{" "}
                <strong>https://{domain.hostname}</strong> · HTTPS and redirect
                are configured together.
              </p>
            )}
            {!domain.verified_at ? (
              <>
                <Button
                  variant="secondary small"
                  busy={feedback.busy}
                  onClick={() =>
                    void feedback.run(
                      async () => {
                        await api(`sites/${siteId}/verify-domain`, {
                          method: "POST",
                          body: JSON.stringify({ domainId: domain.id }),
                        });
                        if (hostingMode === "vps")
                          await api(`sites/${siteId}/connect-domain`, {
                            method: "POST",
                            body: JSON.stringify({ domainId: domain.id }),
                          });
                        await load();
                      },
                      hostingMode === "vps"
                        ? "Ownership verified. Connecting HTTPS automatically; status updates here."
                        : "Ownership verified.",
                    )
                  }
                >
                  {hostingMode === "vps"
                    ? "Check DNS & connect"
                    : "Verify DNS record"}
                </Button>
              </>
            ) : (
              <>
                <p>
                  {ready(domain)
                    ? "Hosting is connected. Select this domain above and republish to update navigation and search-engine URLs."
                    : "Ownership is verified. Your website address is waiting to be connected."}
                </p>
                {domain.cdn_hostname && (
                  <div className="code-box">
                    DNS target: {domain.cdn_hostname}
                  </div>
                )}
                <p className="panel-description">
                  {ready(domain)
                    ? "Connecting a different domain does not change the selected address automatically."
                    : "Point the domain's A record to your VPS. Existing websites are never replaced by automatic setup. Your current website stays available."}
                </p>
                {hostingMode === "vps" && !ready(domain) && (
                  <div className="stack">
                    {domain.connection && (
                      <p role="status">{domain.connection.message}</p>
                    )}
                    <div className="row wrap">
                      <Button
                        type="button"
                        variant="secondary small"
                        busy={feedback.busy}
                        onClick={() =>
                          void feedback.run(async () => {
                            await api(`sites/${siteId}/connect-domain`, {
                              method: "POST",
                              body: JSON.stringify({ domainId: domain.id }),
                            });
                            await load();
                          }, "Connection requested.")
                        }
                      >
                        Connect hosting & HTTPS
                      </Button>
                      <Button
                        type="button"
                        variant="secondary small"
                        onClick={() => void feedback.run(load)}
                      >
                        Refresh connection status
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
