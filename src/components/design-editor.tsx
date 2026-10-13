"use client";
import type { CSSProperties } from "react";
import {
  signatureLooks,
  styles,
  fonts,
  fontFaceCss,
} from "@/modules/portfolios/design";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import { readableInk } from "@/lib/colors";
import { Check } from "lucide-react";
export function DesignEditor({
  document,
  onChange,
}: {
  document: PortfolioDocument;
  onChange: (document: PortfolioDocument) => void;
}) {
  return (
    <section className="panel curated-designs">
      <p className="eyebrow">Considered design. Effortless choice.</p>
      <h2>Six ways to tell your story.</h2>
      <p className="panel-description">
        Each design includes its own typography, accessible colors and gentle
        motion. Choose one, save, then open Preview to explore your complete
        website. Your content stays intact.
      </p>
      <div className="curated-grid">
        {signatureLooks.map((look, index) => {
          const selected =
            document.theme.style === look.theme.style &&
            document.theme.accent === look.theme.accent &&
            document.theme.font === look.theme.font;
          return (
            <button
              type="button"
              key={look.name}
              className={`curated-card ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              onClick={() =>
                onChange({
                  ...document,
                  theme: {
                    ...document.theme,
                    ...look.theme,
                    researchIndex: false,
                    width: "standard",
                    spacing: "generous",
                  },
                })
              }
            >
              <style>
                {fontFaceCss(look.theme, (file) => `/fonts/${file}`)}
              </style>
              <span
                className={`template-preview preview-${look.theme.style}`}
                style={
                  {
                    background: look.theme.background,
                    color: look.theme.text,
                    fontFamily: fonts[look.theme.bodyFont].family,
                    "--preview-accent": look.theme.accent,
                    "--preview-secondary": look.theme.secondary,
                    "--preview-button-ink": readableInk(look.theme.accent),
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                <span className="preview-top">
                  <b>{document.profile.name || "Research portfolio"}</b>
                  <span>About · Research · Contact</span>
                </span>
                <span className="preview-hero">
                  <span>
                    <small>RESEARCH & DISCOVERY</small>
                    <strong
                      style={{ fontFamily: fonts[look.theme.font].family }}
                    >
                      {document.profile.name || "Your story, beautifully told."}
                    </strong>
                    <em>
                      {document.profile.headline ||
                        "Ideas that move knowledge forward."}
                    </em>
                    <i>Explore my work ↗</i>
                  </span>
                  <span className="preview-art">
                    <span>
                      {document.profile.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </span>
                </span>
                <span className="preview-research">
                  <b>Selected research</b>
                  <span />
                  <span />
                </span>
              </span>
              <span className="curated-caption">
                <span>
                  <small>0{index + 1}</small>
                  <strong>{look.name}</strong>
                </span>
                {selected && <Check size={20} aria-label="Selected" />}
              </span>
              <span className="curated-description">
                {
                  styles.find((style) => style.id === look.theme.style)
                    ?.description
                }
              </span>
            </button>
          );
        })}
      </div>
      <p className="panel-description">
        All designs include mobile navigation, a full footer, publication pages
        and reduced-motion support. No font or color setup needed.
      </p>
    </section>
  );
}
