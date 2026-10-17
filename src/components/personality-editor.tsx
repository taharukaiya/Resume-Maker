"use client";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import { Button, Field } from "./ui";
type Profile = PortfolioDocument["profile"];
export function PersonalityEditor({
  profile,
  change,
  canEdit,
}: {
  profile: Profile;
  change: (profile: Profile) => void;
  canEdit: (field: string) => boolean;
}) {
  const cards = profile.featureCards || [];
  const editable = canEdit("profile.featureCards");
  const update = (index: number, value: Partial<(typeof cards)[number]>) =>
    change({
      ...profile,
      featureCards: cards.map((card, i) =>
        i === index ? { ...card, ...value } : card,
      ),
    });
  return (
    <section className="panel full-span">
      <h2>Personal quote, cards and effects</h2>
      <p className="panel-description">
        These appear on Home, About Me and Contact. Leave a quote or card empty
        to hide it. Administrators can allow clients to edit these fields under
        Permissions.
      </p>
      <Field label="Personal quote">
        <textarea
          rows={3}
          maxLength={2000}
          value={profile.contactQuote || ""}
          disabled={!canEdit("profile.contactQuote")}
          onChange={(event) =>
            change({ ...profile, contactQuote: event.target.value })
          }
        />
      </Field>
      <Field label="Quote attribution">
        <input
          maxLength={200}
          value={profile.quoteAttribution || ""}
          disabled={!canEdit("profile.quoteAttribution")}
          onChange={(event) =>
            change({ ...profile, quoteAttribution: event.target.value })
          }
        />
      </Field>
      <Field label="Cards heading">
        <input
          maxLength={200}
          value={profile.cardsHeading || ""}
          disabled={!canEdit("profile.cardsHeading")}
          onChange={(event) =>
            change({ ...profile, cardsHeading: event.target.value })
          }
        />
      </Field>
      {cards.map((card, index) => (
        <fieldset key={index} className="panel">
          <legend>Card {index + 1}</legend>
          <Field label={`Card ${index + 1} title`}>
            <input
              maxLength={200}
              value={card.title}
              disabled={!editable}
              onChange={(event) => update(index, { title: event.target.value })}
            />
          </Field>
          <Field label={`Card ${index + 1} text`}>
            <textarea
              rows={3}
              maxLength={2000}
              value={card.body}
              disabled={!editable}
              onChange={(event) => update(index, { body: event.target.value })}
            />
          </Field>
          <Field label={`Card ${index + 1} icon`}>
            <select
              value={card.icon}
              disabled={!editable}
              onChange={(event) =>
                update(index, { icon: event.target.value as typeof card.icon })
              }
            >
              {["research", "education", "collaboration", "idea"].map(
                (icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label={`Card ${index + 1} link`}>
            <input
              type="url"
              value={card.url}
              disabled={!editable}
              onChange={(event) => update(index, { url: event.target.value })}
            />
          </Field>
          <Field label={`Card ${index + 1} link label`}>
            <input
              maxLength={200}
              value={card.linkLabel}
              disabled={!editable}
              onChange={(event) =>
                update(index, { linkLabel: event.target.value })
              }
            />
          </Field>
          <Button
            variant="secondary small"
            disabled={!editable || index === 0}
            onClick={() => {
              const next = [...cards];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              change({ ...profile, featureCards: next });
            }}
          >
            Move card {index + 1} up
          </Button>{" "}
          <Button
            variant="secondary small"
            disabled={!editable}
            onClick={() =>
              change({
                ...profile,
                featureCards: cards.filter((_, i) => i !== index),
              })
            }
          >
            Remove card {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        disabled={!editable || cards.length >= 12}
        onClick={() =>
          change({
            ...profile,
            featureCards: [
              ...cards,
              { title: "", body: "", icon: "research", url: "", linkLabel: "" },
            ],
          })
        }
      >
        Add card
      </Button>
      <Field label="Motion effects">
        <select
          value={profile.visualEffects || "subtle"}
          disabled={!canEdit("profile.visualEffects")}
          onChange={(event) =>
            change({
              ...profile,
              visualEffects: event.target.value as "none" | "subtle",
            })
          }
        >
          <option value="subtle">Subtle</option>
          <option value="none">Off</option>
        </select>
      </Field>
      <label className="check-row">
        <input
          type="checkbox"
          checked={profile.animatedBackground !== false}
          disabled={!canEdit("profile.animatedBackground")}
          onChange={(event) =>
            change({ ...profile, animatedBackground: event.target.checked })
          }
        />
        Soft animated background
      </label>
    </section>
  );
}
