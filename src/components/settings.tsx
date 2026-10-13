"use client";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "./studio-shell";
import { api, Badge, Button, Feedback, Field, Notice, useFeedback } from "./ui";
import { PageLoading } from "./page-loading";
type Integrations = {
  ai: boolean;
  aiProvider?: string;
  demo?: boolean;
  email: boolean;
  storage: string;
  scanner: boolean;
  database: string;
  production: boolean;
};
export function Settings() {
  const user = useUser(),
    router = useRouter(),
    feedback = useFeedback();
  const [name, setName] = useState("Brilliancy Research"),
    [loading, setLoading] = useState(true),
    [integrations, setIntegrations] = useState<Integrations | null>(null),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState(""),
    [code, setCode] = useState("");
  useEffect(() => {
    void feedback
      .run(async () => {
        const [settings, services] = await Promise.all([
          api<{ name: string }>("settings"),
          api<Integrations>("integrations"),
        ]);
        setName(settings.name);
        setIntegrations(services);
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <PageLoading label="Loading settings and security…" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE FOUNDATIONS</div>
          <h1>Settings & security.</h1>
          <p>Keep your workspace personal, connected, and protected.</p>
        </div>
      </div>
      <Feedback {...feedback} />
      <div className="editor-grid">
        <div>
          {user.role === "admin" && (
            <section className="panel">
              <h2>Agency identity</h2>
              <p className="panel-description">
                Used in the credit on newly published portfolios.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void feedback.run(async () => {
                    await api("settings", {
                      method: "PUT",
                      body: JSON.stringify({ name }),
                    });
                  }, "Agency identity saved. Republish portfolios to update their credit.");
                }}
              >
                <Field label="Agency name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </Field>
                <div className="form-actions">
                  <Button busy={feedback.busy} type="submit">
                    Save identity
                  </Button>
                </div>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>Two-factor authentication</h2>
            <p className="panel-description">
              Use an authenticator app to add a second layer of protection.
              Required for administrators in production.
            </p>
            {user.mfaEnabled ? (
              <Notice
                tone="success"
                message="Two-factor authentication is enabled on your account."
              />
            ) : qr ? (
              <>
                <img
                  className="qr"
                  src={qr}
                  alt="Authenticator setup QR code"
                />
                <Field
                  label="Manual setup key"
                  hint="Store this key in a secure password manager for account recovery."
                >
                  <code className="code-box">{secret}</code>
                </Field>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void feedback.run(async () => {
                      await api("auth/mfa/confirm", {
                        method: "POST",
                        body: JSON.stringify({ code }),
                      });
                      router.refresh();
                      setQr("");
                    }, "Two-factor authentication enabled.");
                  }}
                >
                  <Field label="Six-digit authenticator code">
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </Field>
                  <Button busy={feedback.busy}>Confirm authenticator</Button>
                </form>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={() =>
                  void feedback.run(async () => {
                    const result = await api<{ qr: string; secret: string }>(
                      "auth/mfa/start",
                      { method: "POST" },
                    );
                    setQr(result.qr);
                    setSecret(result.secret);
                  })
                }
              >
                <ShieldCheck size={16} /> Set up authenticator
              </Button>
            )}
          </section>
          <section className="panel">
            <h2>Change password</h2>
            <p className="panel-description">
              Other active sessions will be signed out after this change.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void feedback.run(async () => {
                  await api("auth/password", {
                    method: "POST",
                    body: JSON.stringify({ current, password }),
                  });
                  setCurrent("");
                  setPassword("");
                }, "Password updated.");
              }}
            >
              <Field label="Current password">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </Field>
              <Field label="New password" hint="At least 12 characters.">
                <input
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <div className="form-actions">
                <Button busy={feedback.busy}>
                  <KeyRound size={14} /> Update password
                </Button>
              </div>
            </form>
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Connected services</h2>
            <p className="panel-description">
              Configuration detected for this installation. Configured services
              still need a successful live test before launch.
            </p>
            {integrations &&
              [
                {
                  name: "AI summaries",
                  ready: integrations.ai,
                  detail: integrations.ai
                    ? integrations.aiProvider === "huggingface-browser"
                      ? "Free Hugging Face model in your browser · WebGPU required"
                      : integrations.aiProvider === "gemini"
                        ? "Google Gemini on the server · project quotas apply"
                        : "OpenAI on the server · usage-based billing"
                    : "AI provider not configured",
                },
                {
                  name: "Email delivery",
                  ready: integrations.email,
                  detail: integrations.email
                    ? "Amazon SES configured"
                    : "Amazon SES sender required",
                },
                {
                  name: "Object storage",
                  ready: ["s3", "vps"].includes(integrations.storage),
                  detail:
                    integrations.storage === "s3"
                      ? "Amazon S3"
                      : integrations.storage === "vps"
                        ? "Persistent VPS storage · off-server backups required"
                        : integrations.storage === "database-demo"
                          ? "Demo PostgreSQL file storage · 200 MB total"
                          : "Local development storage",
                },
                {
                  name: "Database",
                  ready: integrations.database === "postgresql",
                  detail:
                    integrations.database === "postgresql"
                      ? "PostgreSQL"
                      : "Embedded PostgreSQL · local only",
                },
                {
                  name: "Upload scanning",
                  ready: integrations.scanner,
                  detail: integrations.scanner
                    ? "ClamAV configured"
                    : "Required before production",
                },
              ].map((item) => (
                <div className="integration-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <Badge value={item.ready ? "configured" : "setup needed"} />
                </div>
              ))}
          </section>
          <section className="panel">
            <h3>Production setup</h3>
            <p className="panel-description">
              Follow the account and deployment guide included in this project
              before connecting a live domain.
            </p>
            <a
              className="guide-link"
              href="/guide"
              target="_blank"
              rel="noreferrer"
            >
              Read the setup guide <ExternalLink size={13} />
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}
