"use client";
import { contrastRatio, readableInk } from "@/lib/colors";
import {
  fonts,
  fontIds,
  fontPairs,
  palettes,
  styles,
  fontFaceCss,
} from "@/modules/portfolios/design";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import { Field, Notice } from "./ui";
type Theme = PortfolioDocument["theme"];
export function DesignEditor({
  document,
  onChange,
}: {
  document: PortfolioDocument;
  onChange: (document: PortfolioDocument) => void;
}) {
  const theme = document.theme;
  const update = (patch: Partial<Theme>) =>
    onChange({ ...document, theme: { ...theme, ...patch } });
  const ink = theme.text || readableInk(theme.background);
  const contrast = Math.min(
    contrastRatio(theme.accent, theme.background),
    contrastRatio(ink, theme.background),
  );
  return (
    <div className="design-workbench">
      <div className="stack">
        <section className="panel">
          <p className="eyebrow">A signature for their work</p>
          <h2>Choose a composition</h2>
          <p className="panel-description">
            Each layout has its own rhythm. Your content and chosen typography
            stay yours.
          </p>
          <div className="composition-grid">
            {styles.map((style) => (
              <button
                type="button"
                key={style.id}
                className={`composition-card ${theme.style === style.id ? "active" : ""}`}
                aria-pressed={theme.style === style.id}
                onClick={() => update({ style: style.id })}
              >
                <span
                  className={`composition-sketch sketch-${style.id}`}
                  aria-hidden="true"
                >
                  <i />
                  <span>
                    <b />
                    <b />
                    <b />
                  </span>
                </span>
                <strong>{style.name}</strong>
                <small>{style.description}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Color stories</h2>
          <p className="panel-description">
            Apply a coordinated palette, then refine each color below. Secondary
            colors are decorative; text contrast is checked before saving.
          </p>
          <div className="palette-grid">
            {palettes.map((p) => (
              <button
                type="button"
                key={p.name}
                className="palette-card"
                aria-pressed={
                  theme.accent === p.accent && theme.background === p.background
                }
                onClick={() =>
                  update({
                    accent: p.accent,
                    background: p.background,
                    text: p.text,
                    secondary: p.secondary,
                  })
                }
              >
                <span className="palette-swatches" aria-hidden="true">
                  {[p.background, p.text, p.accent, p.secondary].map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 24 }}>
            {(
              [
                ["accent", "Accent color", theme.accent],
                ["background", "Page background", theme.background],
                ["text", "Body text color", ink],
                [
                  "secondary",
                  "Secondary color",
                  theme.secondary || theme.accent,
                ],
              ] as const
            ).map(([key, label, value]) => (
              <Field key={key} label={label} hint={value.toUpperCase()}>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => update({ [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <Notice
            tone={contrast >= 4.5 ? "success" : "error"}
            message={
              contrast >= 4.5
                ? `Text and links meet the minimum contrast requirement (${contrast.toFixed(1)}:1 or higher).`
                : "Increase text or accent contrast against the background before saving (minimum 4.5:1)."
            }
          />
        </section>
        <section className="panel">
          <h2>Typography with character</h2>
          <p className="panel-description">
            Choose a curated pairing or set the heading and body fonts
            independently. Selected web fonts are hosted with the portfolio;
            other scripts use system fallbacks.
          </p>
          <div className="font-pairs">
            {fontPairs.map((pair) => (
              <button
                type="button"
                key={pair.name}
                className="button secondary"
                onClick={() =>
                  update({ font: pair.font, bodyFont: pair.bodyFont })
                }
              >
                {pair.name}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field label="Heading typography">
              <select
                value={theme.font}
                onChange={(e) =>
                  update({ font: e.target.value as Theme["font"] })
                }
              >
                {fontIds.map((id) => (
                  <option key={id} value={id}>
                    {fonts[id].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Body typography">
              <select
                value={theme.bodyFont || "sans"}
                onChange={(e) =>
                  update({ bodyFont: e.target.value as Theme["font"] })
                }
              >
                {fontIds.map((id) => (
                  <option key={id} value={id}>
                    {fonts[id].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Heading scale">
              <select
                value={theme.scale || "balanced"}
                onChange={(e) =>
                  update({ scale: e.target.value as Theme["scale"] })
                }
              >
                <option value="balanced">Balanced</option>
                <option value="expressive">
                  Expressive — oversized introduction
                </option>
              </select>
            </Field>
            <Field label="Section spacing">
              <select
                value={theme.spacing || "generous"}
                onChange={(e) =>
                  update({ spacing: e.target.value as Theme["spacing"] })
                }
              >
                <option value="generous">Generous</option>
                <option value="compact">Compact</option>
              </select>
            </Field>
          </div>
        </section>
        <section className="panel">
          <h2>Finishing touches</h2>
          <div className="form-grid">
            <Field label="Portrait shape">
              <select
                value={theme.portrait || "rectangle"}
                onChange={(e) =>
                  update({ portrait: e.target.value as Theme["portrait"] })
                }
              >
                <option value="rectangle">Framed rectangle</option>
                <option value="arch">Architectural arch</option>
                <option value="circle">Circle</option>
              </select>
            </Field>
            <Field label="Decorative treatment">
              <select
                value={theme.decoration || "none"}
                onChange={(e) =>
                  update({ decoration: e.target.value as Theme["decoration"] })
                }
              >
                <option value="none">Quiet — no decoration</option>
                <option value="glow">Soft color glow</option>
                <option value="lines">Fine graphic lines</option>
              </select>
            </Field>
            <Field label="Content width">
              <select
                value={theme.width}
                onChange={(e) =>
                  update({ width: e.target.value as Theme["width"] })
                }
              >
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
              </select>
            </Field>
            <Field label="Corners">
              <select
                value={theme.roundness}
                onChange={(e) =>
                  update({ roundness: e.target.value as Theme["roundness"] })
                }
              >
                <option value="sharp">Sharp</option>
                <option value="soft">Soft</option>
              </select>
            </Field>
            <label className="check-row full-span">
              <input
                type="checkbox"
                checked={theme.showAgencyCredit}
                onChange={(e) => update({ showAgencyCredit: e.target.checked })}
              />
              Show agency credit
            </label>
          </div>
        </section>
      </div>
      <aside className="design-preview-panel">
        <div
          className="design-live-sample"
          style={{
            background: theme.background,
            color: ink,
            fontFamily: fonts[theme.bodyFont || "sans"].family,
            borderRadius: theme.roundness === "soft" ? 18 : 0,
          }}
        >
          <style>{fontFaceCss(theme, (file) => `/fonts/${file}`)}</style>
          <span className="eyebrow" style={{ color: theme.accent }}>
            LIVE TYPOGRAPHY & COLOR SAMPLE
          </span>
          <div
            className="design-sample-orbit"
            style={{
              background: `linear-gradient(130deg, ${theme.accent}, ${theme.secondary || theme.accent})`,
            }}
          />
          <h2
            style={{
              fontFamily: fonts[theme.font].family,
              color: ink,
              fontSize: theme.scale === "expressive" ? 44 : 34,
            }}
          >
            {document.profile.name}
          </h2>
          <p>
            {document.profile.headline ||
              "Your academic headline appears here."}
          </p>
          <p className="design-sample-body">
            {document.profile.bio
              ? document.profile.bio.slice(0, 240)
              : "Add a biography in Profile to see your own writing in this typeface."}
          </p>
          <span
            className="design-sample-button"
            style={{
              background: theme.accent,
              color: readableInk(theme.accent),
            }}
          >
            {document.navigation.cvLabel}
          </span>
        </div>
        <p className="panel-description">
          This sample updates immediately. Use Preview above to inspect the full
          saved portfolio on desktop and mobile. Publishing applies the design
          to the live site.
        </p>
      </aside>
    </div>
  );
}
