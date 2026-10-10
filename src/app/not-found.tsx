import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-form" style={{ margin: "15vh auto", padding: 25 }}>
      <p className="eyebrow">BRILLIANCY RESEARCH</p>
      <h1>This page isn’t here.</h1>
      <p>
        The address may be incorrect, or the page may no longer be available.
      </p>
      <Link className="button" href="/studio">
        Return to the workspace
      </Link>
    </main>
  );
}
