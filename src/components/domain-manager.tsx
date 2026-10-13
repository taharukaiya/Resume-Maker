"use client";
import { useEffect, useState } from "react";
import { api, Badge, Button, Field, Feedback, useFeedback } from "./ui";
type Domain = {
  id: string;
  hostname: string;
  verification_token: string;
  verified_at: string | null;
  activated_at: string | null;
  cdn_hostname: string | null;
  distribution_id: string | null;
};
export function DomainManager({
  siteId,
  slug,
  publishedUrl,
}: {
  siteId: string;
  slug: string;
  publishedUrl?: string | null;
}) {
  const feedback = useFeedback();
  const [hostname, setHostname] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [origin, setOrigin] = useState("");
  async function load() {
    setDomains(
      (await api<{ domains: Domain[] }>(`sites/${siteId}/domains`)).domains,
    );
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    void feedback.run(load);
  }, [siteId]);
  return (
    <section className="panel domain-manager">
      <p className="eyebrow">Website address</p>
      <h2>A personal domain, when you’re ready.</h2>
      <p className="panel-description">
        A shared portfolio address is included. A personal .com, .net, or other
        domain must be registered separately and connected before it becomes
        your website’s address.
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
      <details className="domain-setup" open={domains.length > 0 || undefined}>
        <summary>Connect a personal domain</summary>
        <ol className="domain-steps">
          <li>
            <strong>Register the domain</strong>
            <span>
              For example: research-portfolio-by-{slug}.com. This is a naming
              suggestion, not an availability check or a purchase.
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
              Your hosting administrator provisions the certificate and
              delivery, adds the DNS target, and activates the domain. Republish
              to use the personal address throughout the website.
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
            hint="Enter a domain you own, without https:// or a page path."
          >
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
              autoCapitalize="none"
              spellCheck={false}
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
                  domain.activated_at
                    ? "connected"
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
                  {domain.activated_at
                    ? "Connected for publishing. Republish after activation so navigation and search-engine URLs use this domain."
                    : "Ownership is verified. Your website address is waiting to be connected."}
                </p>
                {domain.cdn_hostname && (
                  <div className="code-box">
                    DNS target: {domain.cdn_hostname}
                  </div>
                )}
                <p className="panel-description">
                  Your website manager can connect this address. Keep your
                  current website live until the new address is ready.
                </p>
              </>
            )}
          </div>
        ))}
      </details>
    </section>
  );
}
