"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="auth-form" style={{ margin: "15vh auto", padding: 25 }}>
      <h1>Something interrupted this page.</h1>
      <p>
        Your saved work is still in the workspace. Try loading this page again.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
