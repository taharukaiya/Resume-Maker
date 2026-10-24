import type { PortfolioDocument } from "@/modules/portfolios/schema";
import {
  profileCompletion,
  type CompletionTarget,
} from "@/modules/portfolios/profile-completion";

export function ProfileCompletion({
  document,
  onEdit,
  admin,
}: {
  document: PortfolioDocument;
  onEdit: (target: CompletionTarget) => void;
  admin: boolean;
}) {
  const { checks, completed, percentage } = profileCompletion(document);
  return (
    <section className="profile-completion" aria-label="Portfolio completion">
      <div className="spread wrap">
        <strong>Portfolio {percentage}% complete</strong>
        <span className="muted">
          {completed} of {checks.length} areas complete
        </span>
      </div>
      <progress
        aria-label="Portfolio completion"
        max={100}
        value={percentage}
      />
      <details>
        <summary>
          {percentage === 100
            ? "View completed areas"
            : `See what’s missing (${checks.length - completed})`}
        </summary>
        <ul className="completion-checklist">
          {[...checks]
            .sort((a, b) => Number(a.complete) - Number(b.complete))
            .map((check) => (
              <li key={check.id}>
                <div>
                  <strong>
                    <span aria-hidden="true">{check.complete ? "✓" : "○"}</span>{" "}
                    {check.label} —{" "}
                    {check.complete ? "Added" : "Needs attention"}
                  </strong>
                  {!check.complete && <p>{check.detail}</p>}
                </div>
                {check.target.tab !== "pages" || admin ? (
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => onEdit(check.target)}
                    aria-label={`Open ${check.label}`}
                  >
                    {check.complete ? "View" : "Complete"} →
                  </button>
                ) : (
                  <span className="muted">Administrator access needed</span>
                )}
              </li>
            ))}
        </ul>
        <p>
          Each area counts equally: profile details, education, experience,
          research, articles and additional visible sections, including custom
          pages. Finish the entries in each area to complete it. Optional hidden
          sections, design settings and domain setup do not affect this score.
          Review and publishing remain separate.
        </p>
      </details>
    </section>
  );
}
