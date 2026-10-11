"use client";
import type { KeyboardEvent } from "react";
export const portfolioSteps = [
  [
    "profile",
    "Profile",
    "Introduce the researcher. Import a CV, add a portrait, then check their biography and links.",
  ],
  [
    "sections",
    "Academic sections",
    "Review education and research. Academic order keeps the story organized automatically.",
  ],
  [
    "pages",
    "Pages",
    "Choose where content belongs. Separate pages keep the public website focused and easy to explore.",
  ],
  [
    "design",
    "Design",
    "Choose a complete look, then preview it on desktop and mobile.",
  ],
  [
    "publish",
    "Review & publish",
    "Review the content, choose the public address, and publish the approved version.",
  ],
] as const;

export function EditorWorkflow({
  tab,
  tabs,
  admin,
  onSelect,
}: {
  tab: string;
  tabs: string[][];
  admin: boolean;
  onSelect: (tab: string) => void;
}) {
  const steps = admin
    ? portfolioSteps
    : portfolioSteps.filter(([key]) => ["profile", "sections"].includes(key));
  const tools = tabs.filter(([key]) => !steps.some(([step]) => key === step));
  const current = steps.find(([key]) => key === tab);
  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ),
    ];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[next].focus();
    buttons[next].click();
  }
  return (
    <div className="editor-workflow">
      <div
        className="tabs workflow-tabs"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
        role="tablist"
        aria-label="Portfolio editor"
        onKeyDown={navigateTabs}
      >
        {steps.map(([key, label], index) => (
          <button
            key={key}
            role="tab"
            aria-label={label}
            aria-selected={tab === key}
            tabIndex={tab === key || (!current && index === 0) ? 0 : -1}
            className={tab === key ? "active" : ""}
            onClick={() => onSelect(key)}
          >
            <span className="workflow-number" aria-hidden="true">
              {index + 1}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div
        className="tabs editor-tools"
        role="tablist"
        aria-label="Portfolio tools"
        onKeyDown={navigateTabs}
      >
        <span className="editor-tools-label">Tools</span>
        {tools.map(([key, label], index) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            tabIndex={tab === key || (current && index === 0) ? 0 : -1}
            className={tab === key ? "active" : ""}
            onClick={() => onSelect(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {current && <p className="workflow-guidance">{current[2]}</p>}
    </div>
  );
}
