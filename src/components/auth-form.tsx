"use client";
import { ArrowRight, BookOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Button, Feedback, Field, Notice, useFeedback } from "./ui";
export function AuthForm({
  mode,
}: {
  mode: "login" | "setup" | "accept" | "forgot";
}) {
  const router = useRouter(),
    params = useSearchParams(),
    feedback = useFeedback();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [initialized, setInitialized] = useState<boolean | null>(null),
    [statusError, setStatusError] = useState(""),
    [complete, setComplete] = useState(false),
    [agencyName, setAgencyName] = useState("Brilliancy Research");
  useEffect(() => {
    api<{ initialized: boolean }>("status")
      .then((s) => setInitialized(s.initialized))
      .catch(() =>
        setStatusError(
          "Cannot reach the workspace database. Check the server terminal or run npm run doctor.",
        ),
      );
  }, []);
  const titles = {
    login: "Welcome back.",
    setup: "Your studio starts here.",
    accept: "Make yourself at home.",
    forgot: "Reset your password.",
  };
  const descriptions = {
    login: "Sign in to your Brilliancy Research workspace.",
    setup: "Create the first administrator account for Brilliancy Research.",
    accept: "Choose a secure password to activate or recover your account.",
    forgot: "We’ll email a secure link to your account address.",
  };
  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="brand-lockup">
          <span className="brand-symbol">
            <BookOpen size={24} />
          </span>
          <span>
            Brilliancy<span className="brand-sub">RESEARCH STUDIO</span>
          </span>
        </Link>
        <div className="auth-quote">
          <span className="eyebrow">FOR THE NEXT CHAPTER</span>
          <h1>
            Remarkable research.
            <br />
            Ready for the world.
          </h1>
          <p>
            A home for the ideas, achievements, and ambitions that shape an
            academic journey.
          </p>
        </div>
        <span className="auth-foot">Thoughtfully built for researchers.</span>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form">
          <p className="eyebrow">
            {mode === "setup" ? "FIRST-TIME SETUP" : "YOUR ACADEMIC WORKSPACE"}
          </p>
          <h1>{titles[mode]}</h1>
          <p>{descriptions[mode]}</p>
          <Feedback {...feedback} />
          {statusError && <Notice message={statusError} />}
          {mode === "setup" && !complete && initialized === true && (
            <Notice
              tone="info"
              message="Setup is already complete. Use Back to sign in below."
            />
          )}
          {mode === "setup" && !complete && !params.get("token") && (
            <Notice
              tone="info"
              message="Open the private link printed by npm run setup. This page needs the installation token in that link."
            />
          )}
          {complete ? (
            <>
              <Notice
                tone="success"
                message={
                  mode === "forgot"
                    ? "If the account exists, a recovery email is on its way."
                    : "Your account is ready. You can now sign in."
                }
              />
              <Link className="button full" href="/login">
                Continue to sign in <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void feedback.run(async () => {
                  if (mode === "login") {
                    await api("auth/login", {
                      method: "POST",
                      body: JSON.stringify({ email, password, code }),
                    });
                    router.push("/studio");
                    router.refresh();
                  } else if (mode === "setup") {
                    await api("setup", {
                      method: "POST",
                      body: JSON.stringify({
                        name,
                        email,
                        password,
                        agencyName,
                        token: params.get("token") || "",
                      }),
                    });
                    setComplete(true);
                  } else if (mode === "accept") {
                    await api("auth/accept", {
                      method: "POST",
                      body: JSON.stringify({
                        password,
                        token: params.get("token") || "",
                      }),
                    });
                    setComplete(true);
                  } else {
                    await api("auth/forgot", {
                      method: "POST",
                      body: JSON.stringify({ email }),
                    });
                    setComplete(true);
                  }
                });
              }}
            >
              {mode === "setup" && (
                <>
                  <Field label="Agency name">
                    <input
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Your full name">
                    <input
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </Field>
                </>
              )}
              {mode !== "accept" && (
                <Field label="Email address">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
              {mode !== "forgot" && (
                <Field
                  label="Password"
                  hint={
                    mode === "login"
                      ? undefined
                      : "Use at least 12 characters. A unique passphrase works well."
                  }
                >
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
              {mode === "login" && (
                <Field
                  label="Authenticator code"
                  hint="Required only if two-factor authentication is enabled."
                >
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </Field>
              )}
              <Button
                type="submit"
                busy={feedback.busy}
                variant="full"
                disabled={
                  mode === "setup" &&
                  (initialized !== false || !params.get("token"))
                }
              >
                {mode === "login"
                  ? "Sign in to workspace"
                  : mode === "setup"
                    ? "Create your workspace"
                    : mode === "accept"
                      ? "Set password"
                      : "Send recovery link"}
                <ArrowRight size={15} />
              </Button>
            </form>
          )}
          {mode === "login" && (
            <>
              <div className="auth-links">
                <Link href="/forgot">Forgot your password?</Link>
              </div>
              {initialized === false && (
                <Notice
                  tone="info"
                  message="This workspace needs its first administrator. Run npm run setup in the project folder and open the private setup link."
                />
              )}
            </>
          )}
          {mode !== "login" && (
            <div className="auth-links">
              <Link href="/login">Back to sign in</Link>
            </div>
          )}
          <p className="auth-links">
            <ShieldCheck size={12} /> Secure access · Brilliancy Research
          </p>
        </div>
      </section>
    </div>
  );
}
