import type { PortfolioDocument } from "@/modules/portfolios/schema";
import { profileCompletion } from "@/modules/portfolios/profile-completion";

export function ProfileCompletion({
  profile,
  onEdit,
}: {
  profile: PortfolioDocument["profile"];
  onEdit: () => void;
}) {
  const { checks, completed, percentage } = profileCompletion(profile);
  return (
    <section className="profile-completion" aria-label="Profile completion">
      <div className="spread wrap">
        <strong>Profile {percentage}% complete</strong>
        <span className="muted">
          {completed} of {checks.length} basics added
        </span>
      </div>
      <progress aria-label="Profile completion" max={100} value={percentage} />
      <details>
        <summary>
          {percentage === 100
            ? "All profile basics added"
            : "See what’s left to add"}
        </summary>
        <ul>
          {checks.map((check) => (
            <li key={check.label}>
              <span aria-hidden="true">{check.complete ? "✓" : "○"}</span>{" "}
              {check.label} — {check.complete ? "Added" : "Not added yet"}
            </li>
          ))}
        </ul>
        <p>
          This measures the five profile basics only. CVs, affiliations and
          articles are optional for this score. Review and publishing are
          separate steps.
        </p>
        {percentage < 100 && (
          <button type="button" className="button secondary" onClick={onEdit}>
            Edit profile details
          </button>
        )}
      </details>
    </section>
  );
}
