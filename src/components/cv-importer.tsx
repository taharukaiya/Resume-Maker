"use client";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/modules/media/service";
import {
  applyCvImport,
  autofillCv,
  cvExtractionSchema,
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
  jobs,
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
  jobs: { id: string; status: string; error: string | null }[];
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
  const [replace, setReplace] = useState(false);
  const [waiting, setWaiting] = useState<{
    jobId: string;
    mediaId: string;
    baseline: PortfolioDocument;
    replace: boolean;
  } | null>(null);
  const latestDocument = useRef(document);
  latestDocument.current = document;
  const feedback = useFeedback();
  const ai = useDocumentAi();
  const selected = media.find((m) => m.id === mediaId);
  const result = selected?.cv_import;
  useEffect(() => {
    if (!waiting) return;
    const job = jobs.find((item) => item.id === waiting.jobId);
    if (job?.status === "failed") {
      setWaiting(null);
      feedback.setMessage("");
      feedback.setError(
        job.error || "CV extraction failed. Your draft is unchanged.",
      );
      return;
    }
    const extracted = media.find(
      (item) => item.id === waiting.mediaId,
    )?.cv_import;
    if (job?.status !== "done" || !extracted) return;
    setWaiting(null);
    void feedback.run(async () => {
      onChange(
        autofillCv(
          latestDocument.current,
          extracted,
          waiting.baseline,
          waiting.replace,
        ),
      );
      setSelection({ profile: [], entries: [], links: false, replace: false });
      setReview(false);
    }, "CV details filled into your draft. Existing records and edits made during extraction were kept. Review the fields, then save.");
  }, [waiting, jobs, media]);
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
        Upload a PDF resume or choose an existing file. Extract details fills
        empty profile fields, academic records and social links into your draft.
        You can edit everything afterward; nothing is published automatically.
      </p>
      <Feedback {...feedback} />
      <AiProgress {...ai} />
      {error && !feedback.error && (
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
            disabled={feedback.busy || !!waiting}
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
            disabled={feedback.busy || !!waiting}
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
      <label className="check-row">
        <input
          type="checkbox"
          checked={replace}
          disabled={feedback.busy || !!waiting}
          onChange={(event) => setReplace(event.target.checked)}
        />
        Also replace existing profile text with details from this CV
      </label>
      {result &&
        !review &&
        result.warnings.map((warning, index) => (
          <Notice key={index} tone="info" message={warning} />
        ))}
      <div className="actions">
        <Button
          disabled={!enabled || !mediaId || pending || !!waiting}
          busy={feedback.busy}
          onClick={() =>
            void feedback.run(async () => {
              const baseline = structuredClone(latestDocument.current);
              const outcome = await ai.run(mediaId, "cv-import", browserAi);
              setReview(false);
              if (outcome.result) {
                onChange(
                  autofillCv(
                    latestDocument.current,
                    cvExtractionSchema.parse(outcome.result),
                    baseline,
                    replace,
                  ),
                );
                feedback.setMessage(
                  "CV details filled into your draft. Review the fields, then save. You can change any extracted detail.",
                );
              } else if (outcome.jobId) {
                setWaiting({
                  jobId: outcome.jobId,
                  mediaId,
                  baseline,
                  replace,
                });
                feedback.setMessage(
                  "Extracting CV. Keep this editor open; details will fill automatically when ready.",
                );
              }
              await onRefresh();
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
