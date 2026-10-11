"use client";
import { useState } from "react";
import type { Media } from "@/modules/media/service";
import {
  applyCvImport,
  cvEntryKey,
  cvProfileFields,
  type CvSelection,
} from "@/modules/portfolios/cv-import";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import { api, Button, Field, Feedback, Notice, useFeedback } from "./ui";
import { AiProgress, useDocumentAi } from "./use-document-ai";

export function CvImporter({
  siteId,
  media,
  document,
  enabled,
  browserAi = false,
  aiProvider = "openai",
  pending,
  error,
  onChange,
  onRefresh,
}: {
  siteId: string;
  media: Media[];
  document: PortfolioDocument;
  enabled: boolean;
  browserAi?: boolean;
  aiProvider?: string;
  pending: boolean;
  error?: string;
  onChange: (doc: PortfolioDocument) => void;
  onRefresh: () => Promise<void>;
}) {
  const [mediaId, setMediaId] = useState("");
  const [selection, setSelection] = useState<CvSelection>({
    profile: [],
    entries: [],
    links: false,
    replace: false,
  });
  const [review, setReview] = useState(false);
  const feedback = useFeedback();
  const ai = useDocumentAi();
  const selected = media.find((m) => m.id === mediaId);
  const result = selected?.cv_import;
  const toggle = (kind: "profile" | "entries", key: string) =>
    setSelection((s) => ({
      ...s,
      [kind]: s[kind].includes(key)
        ? s[kind].filter((k) => k !== key)
        : [...s[kind], key],
    }));
  return (
    <section className="panel cv-importer">
      <p className="eyebrow">A faster starting point</p>
      <h2>Fill from CV</h2>
      <p className="panel-description">
        Upload a PDF resume or choose an existing file. AI proposes the profile
        and academic records for your review. Applying a proposal changes this
        draft; save and publish when you are ready.
      </p>
      <Feedback {...feedback} />
      <AiProgress {...ai} />
      {error && (
        <Notice
          message={`CV extraction failed: ${error} You can retry extraction. Any previous successful proposal is still available.`}
        />
      )}
      {!enabled && (
        <Notice
          tone="info"
          message="Enable free browser AI or configure a server AI provider to extract details. Manual editing is always available."
        />
      )}
      <div className="form-grid">
        <Field label="CV or resume PDF">
          <select
            value={mediaId}
            onChange={(e) => {
              setMediaId(e.target.value);
              setReview(false);
            }}
          >
            <option value="">Choose an uploaded PDF</option>
            {media
              .filter((m) => m.mime === "application/pdf")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename}
                </option>
              ))}
          </select>
        </Field>
        <Field
          label="Upload a CV"
          hint="PDF only. Export a Word resume as PDF first."
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={feedback.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void feedback.run(async () => {
                const form = new FormData();
                form.append("file", file);
                form.append("purpose", "cv");
                const uploaded = await api<{ id: string }>(
                  `sites/${siteId}/media`,
                  { method: "POST", body: form },
                );
                await onRefresh();
                setMediaId(uploaded.id);
                setReview(false);
              }, "CV uploaded. Choose Extract details when ready.");
            }}
          />
        </Field>
      </div>
      <p className="panel-description">
        {browserAi
          ? "Free AI downloads roughly 1 GB of model files from Hugging Face on first use and runs on your computer. Use desktop Chrome or Edge with WebGPU and enough available GPU memory (allow about 3 GB). Keep this tab open. The uploaded PDF stays on this app's server; its extracted text is processed in your browser."
          : aiProvider === "gemini"
            ? "Extract details sends this CV to Google Gemini. Use sample or redacted documents on the free tier; its terms allow content to be used to improve Google's products."
            : "Extract details sends this CV to OpenAI for processing. Use a CV you have permission to process."}{" "}
        Check names, dates and every academic claim before publishing.
      </p>
      <div className="actions">
        <Button
          disabled={!enabled || !mediaId || pending}
          busy={feedback.busy}
          onClick={() =>
            void feedback.run(async () => {
              const message = await ai.run(mediaId, "cv-import", browserAi);
              setReview(false);
              await onRefresh();
              feedback.setMessage(message);
            })
          }
        >
          {pending ? "Extracting CV…" : "Extract details"}
        </Button>
        {result && !pending && (
          <Button
            variant="secondary"
            onClick={() => {
              setSelection({
                profile: cvProfileFields.filter(
                  (key) => !!result.profile[key] && !document.profile[key],
                ),
                entries: result.sections.flatMap((s, si) =>
                  s.entries.map((_, ei) => cvEntryKey(si, ei)),
                ),
                links: true,
                replace: false,
              });
              setReview(true);
            }}
          >
            Review extracted details
          </Button>
        )}
      </div>
      {review && result && (
        <div className="cv-review">
          <h3>Choose what to apply</h3>
          {result.warnings.map((warning, index) => (
            <Notice key={index} tone="info" message={warning} />
          ))}
          <label className="check-row">
            <input
              type="checkbox"
              checked={selection.replace}
              onChange={(e) =>
                setSelection({ ...selection, replace: e.target.checked })
              }
            />
            Allow selected profile fields to replace existing values
          </label>
          {cvProfileFields
            .filter((key) => result.profile[key])
            .map((key) => (
              <label key={key} className="cv-review-item">
                <input
                  type="checkbox"
                  checked={selection.profile.includes(key)}
                  disabled={!selection.replace && !!document.profile[key]}
                  onChange={() => toggle("profile", key)}
                />
                <span>
                  <strong>{key}</strong>
                  <span className="cv-value">{result.profile[key]}</span>
                  {document.profile[key] && (
                    <small>Current: {document.profile[key]}</small>
                  )}
                </span>
              </label>
            ))}
          {!!result.profile.links.length && (
            <label className="cv-review-item">
              <input
                type="checkbox"
                checked={selection.links}
                onChange={(e) =>
                  setSelection({ ...selection, links: e.target.checked })
                }
              />
              <span>
                <strong>Add profile links</strong>
                {result.profile.links.map((link, i) => (
                  <span className="cv-value" key={i}>
                    {link.label}: {link.url}
                  </span>
                ))}
              </span>
            </label>
          )}
          {result.sections.map((s, si) => (
            <div key={si}>
              <h3>{s.title}</h3>
              {s.entries.map((entry, ei) => (
                <label className="cv-review-item" key={ei}>
                  <input
                    type="checkbox"
                    checked={selection.entries.includes(cvEntryKey(si, ei))}
                    onChange={() => toggle("entries", cvEntryKey(si, ei))}
                  />
                  <span>
                    <strong>{entry.title}</strong>
                    <span className="cv-value">
                      {[
                        entry.subtitle,
                        entry.start,
                        entry.current ? "Present" : entry.end,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="cv-value">{entry.body}</span>
                    {[
                      entry.authors,
                      entry.doi,
                      entry.status,
                      entry.tags,
                      entry.url,
                    ]
                      .filter(Boolean)
                      .map((value, i) => (
                        <small key={i} className="cv-value">
                          {value}
                        </small>
                      ))}
                  </span>
                </label>
              ))}
            </div>
          ))}
          <p className="panel-description">
            Academic records are added to matching sections. Existing records
            are retained; identical title, institution and start date
            combinations are skipped. The source CV is not automatically made
            public.
          </p>
          <div className="actions">
            <Button
              busy={feedback.busy}
              onClick={() =>
                void feedback.run(async () => {
                  onChange(applyCvImport(document, result, selection));
                  setReview(false);
                }, "Selected details applied to your unsaved draft. Review, then save.")
              }
            >
              Apply selected details
            </Button>
            <Button variant="secondary" onClick={() => setReview(false)}>
              Cancel review
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
