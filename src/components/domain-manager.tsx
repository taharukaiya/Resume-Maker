"use client";
import { useEffect, useState } from "react";
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
  const [hostname, setHostname] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [origin, setOrigin] = useState("");
  const [hostingMode, setHostingMode] = useState("local");
  const [selection, setSelection] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    const result = await api<{ domains: Domain[]; hostingMode: string }>(
      `sites/${siteId}/domains`,
    );
    setDomains(result.domains);
    setHostingMode(result.hostingMode);
    setSelection(result.domains.find((domain) => domain.is_primary)?.id || "");
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    setLoading(true);
    void feedback.run(load).finally(() => setLoading(false));
  }, [siteId]);
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
      <h2>Choose this portfolio’s address.</h2>
      <p className="panel-description">
        Use a domain you own, such as researchbyrukaiya.com, as this portfolio’s
        public website. Administrators can change the selected address after
        connecting the new domain.
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
      <details className="domain-setup" open={domains.length > 0 || undefined}>
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
            <strong>Register the domain</strong>
            <span>
              Use a domain you already own, or register one with your domain
              provider. Adding a name here does not purchase it.
            </span>
          </li>
          <li>
            <strong>Confirm ownership</strong>
            <span>
              Add the domain below, create its TXT record at your DNS provider,
              then verify it.
            </span>
          </li>
          <li>
            <strong>Connect hosting & HTTPS</strong>
            <span>
              Point the domain to your hosting and have its HTTPS connection
              activated. Then select it as the public website address above and
              republish.
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
                }),
              });
              setHostname("");
              await load();
            }, "Domain added. Create the TXT record below to verify ownership.");
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
            {!domain.verified_at ? (
              <>
                <p>
                  Create this TXT record at your DNS provider. Some providers
                  ask for just <code>_brilliancy</code> within the domain’s DNS
                  zone.
                </p>
                <dl className="dns-values">
                  <dt>Type</dt>
                  <dd>TXT</dd>
                  <dt>Name</dt>
                  <dd>_brilliancy.{domain.hostname}</dd>
                  <dt>Value</dt>
                  <dd>{domain.verification_token}</dd>
                </dl>
                <Button
                  variant="secondary small"
                  busy={feedback.busy}
                  onClick={() =>
                    void feedback.run(async () => {
                      await api(`sites/${siteId}/verify-domain`, {
                        method: "POST",
                        body: JSON.stringify({ domainId: domain.id }),
                      });
                      await load();
                    }, "Ownership verified. Connect hosting and HTTPS next.")
                  }
                >
                  Verify DNS record
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
                    : "Your hosting administrator must connect this domain and enable HTTPS before it can be selected. Your current website stays available during setup."}
                </p>
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
