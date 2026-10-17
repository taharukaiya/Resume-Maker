"use client";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "./studio-shell";
import { api, Button, Feedback, Field, Notice, useFeedback } from "./ui";
import { PageLoading } from "./page-loading";
export function Settings() {
  const user = useUser(),
    router = useRouter(),
    feedback = useFeedback();
  const [name, setName] = useState("Brilliancy Research"),
    [loading, setLoading] = useState(true),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState(""),
    [code, setCode] = useState("");
  useEffect(() => {
    void feedback
      .run(async () => {
        const settings = await api<{ name: string }>("settings");
        setName(settings.name);
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
          <p>Manage your agency identity and protect your account.</p>
        </div>
      </div>
      <Feedback {...feedback} />
      <div className="settings-content">
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
              Enrollment is optional. Once enabled, a code is required when you
              sign in.
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
      </div>
    </>
  );
}
