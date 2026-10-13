import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/modules/auth/current-user";

export const metadata = { title: "Workspace guide" };
export default async function Guide() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <main
      className="container"
      style={{ maxWidth: 850, margin: "65px auto", padding: "0 25px" }}
    >
      <Link href="/studio/settings" className="inline-link">
        ← Workspace settings
      </Link>
      <p className="eyebrow" style={{ marginTop: 35 }}>
        BRILLIANCY RESEARCH · WORKSPACE GUIDE
      </p>
      <h1>A thoughtful home for every researcher.</h1>
      <p className="lead">
        Prepare accurate content, review the complete website, and publish with
        confidence.
      </p>
      {[
        [
          "Secure your account",
          "Enable two-factor authentication in Settings & security. Keep passwords and recovery links private.",
        ],
        [
          "Start with the researcher",
          "Create a portfolio with their name. Add a photograph, biography, contact links and education. You can upload a CV to extract details when AI processing is configured. Check every extracted fact before saving.",
        ],
        [
          "Organize their work",
          "Use Academic sections for education and experience, Publications for papers and articles, and Pages to organize navigation. Uploaded articles can have AI-generated summaries; review these against the source paper.",
        ],
        [
          "Choose a design",
          "Select one of the six curated designs, then preview the website on desktop and mobile. Search metadata is generated from the content; optional overrides are available in Search & sharing.",
        ],
        [
          "Control client access",
          "Administrators choose the fields each client can edit in Permissions. Client changes need administrator review before they go live.",
        ],
        [
          "Review and publish",
          "Save the draft, review changes, and publish the approved version. Connect a personal domain through your hosting administrator when needed. Each domain is registered separately.",
        ],
        [
          "Maintain the website",
          "Check the inbox and keep details current. Unpublish to take a website offline while preserving its content. Delete portfolio permanently removes its content after confirmation. Available release history depends on the installation’s retention policy.",
        ],
      ].map(([title, description]) => (
        <section className="panel" key={title}>
          <h2>{title}</h2>
          <p>{description}</p>
        </section>
      ))}
    </main>
  );
}
