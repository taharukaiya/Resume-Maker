import Link from "next/link";
export const metadata = { title: "Setup guide" };
export default function Guide() {
  return (
    <main
      className="container"
      style={{ maxWidth: 850, margin: "65px auto", padding: "0 25px" }}
    >
      <Link href="/studio/settings" className="inline-link">
        ← Workspace settings
      </Link>
      <p className="eyebrow" style={{ marginTop: 35 }}>
        BRILLIANCY RESEARCH · GETTING STARTED
      </p>
      <h1>
        From your first account
        <br />
        to the first live portfolio.
      </h1>
      <p className="lead" style={{ marginBottom: 35, color: "var(--muted)" }}>
        Start locally. Connect production services when the agency is ready to
        launch.
      </p>
      <section className="panel">
        <p className="eyebrow">Free CEO demonstration</p>
        <h2>Start with the free demo guide</h2>
        <p>
          The repository includes <strong>docs/FREE_DEMO.md</strong> with the
          Render signup, deployment and presentation steps. This option runs a
          Hugging Face model in the administrator’s browser, keeps demo files in
          PostgreSQL, and uses invitation links without email delivery. The free
          database expires after 30 days. Use sample documents only.
        </p>
        <p>
          Production costs and the remaining launch requirements are in{" "}
          <strong>docs/COSTS_AND_LAUNCH.md</strong>.
        </p>
      </section>
      {[
        [
          "1",
          "Create your local administrator",
          "Run npm run setup in the project folder, then npm run dev. Open the private setup link printed in your terminal. Create your administrator account with your real name and email.",
        ],
        [
          "2",
          "Create the AWS account",
          "Use an email address owned by Brilliancy Research. Add the agency’s billing details, enable MFA on the root account, and create an IAM Identity Center user for everyday development. Keep the root login with the agency.",
        ],
        [
          "3",
          "Choose the agency domain",
          "Use a domain the agency owns. Choose a studio subdomain for the dashboard. Create or use its Route 53 hosted zone, then enter the domain and hosted-zone details as described in docs/DEPLOYMENT.md. Each researcher can later use a separate domain.",
        ],
        [
          "4",
          "Deploy the infrastructure",
          "Install Docker Desktop and AWS CLI v2. Sign in with AWS SSO. Follow docs/DEPLOYMENT.md to bootstrap CDK and run infra/deploy.ps1. The script provisions infrastructure, runs migrations, and starts the application and worker. Review the AWS resource changes before approving deployment.",
        ],
        [
          "5",
          "Connect email delivery",
          "The deployment creates an SES domain identity and DNS records. In Amazon SES, verify the identity and request production access. Until AWS approves production access, SES can send only to permitted recipients. The app also gives administrators a working invitation link to share privately.",
        ],
        [
          "6",
          "Connect AI summaries",
          "Create an OpenAI API account and a project for Brilliancy Research. Configure API billing and create a server-side API key. Save the key and a PDF-capable model ID in AWS Secrets Manager using the apiKey and model fields. Set AI_SECRET_ARN and deploy the updated service. Never paste the key into a portfolio or commit it to Git.",
        ],
        [
          "7",
          "Create and publish the first portfolio",
          "Invite the client, create their portfolio, and select their editable fields in Permissions. Add the real profile and academic work. Upload a paper, generate a research summary, review it, save the draft, and publish the approved version.",
        ],
        [
          "8",
          "Connect a researcher’s domain",
          "Add the domain in Review & publish. Create the displayed TXT record and verify it. Request an ACM certificate in us-east-1. Run the domain operator task described in docs/DEPLOYMENT.md to configure CloudFront. Point DNS to the returned hostname, activate it, and republish.",
        ],
        [
          "9",
          "Complete the launch checks",
          "Test a real invitation and password recovery email, a real article summary, a client account’s permissions, mobile pages, contact delivery, and rollback. Restore a database backup into a separate environment. Set uptime alerts and review the security checklist in docs/OPERATIONS.md.",
        ],
      ].map(([number, title, description]) => (
        <section className="panel" key={number}>
          <div className="eyebrow">STEP {number}</div>
          <h2 style={{ marginTop: 10 }}>{title}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            {description}
          </p>
        </section>
      ))}
      <p className="muted" style={{ fontSize: 12 }}>
        The source repository includes the complete command reference,
        environment reference, operations guide, and deployment scripts. Local
        setup does not require a paid service.
      </p>
    </main>
  );
}
