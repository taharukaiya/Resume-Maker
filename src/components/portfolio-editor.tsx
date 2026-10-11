"use client";
import type { Media } from "@/modules/media/service";
import {
  type PortfolioDocument,
  editableOptions,
  emptyEntry,
} from "@/modules/portfolios/schema";
import type { Site } from "@/modules/portfolios/service";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  Lock,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DesignEditor } from "./design-editor";
import { DeleteDraft } from "./delete-draft";
import { CvImporter } from "./cv-importer";
import { AiProgress, useDocumentAi } from "./use-document-ai";
import { SectionsEditor } from "./section-editor";
import { useUser } from "./studio-shell";
import { NavigationLink } from "./navigation-link";
import { PageLoading } from "./page-loading";
import {
  api,
  Badge,
  Button,
  dateTime,
  Empty,
  Feedback,
  Field,
  Notice,
  useFeedback,
} from "./ui";
type Job = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
};
type Release = { id: string; revision: number; created_at: string };
type EditorData = {
  site: Site;
  media: Media[];
  jobs: Job[];
  releases: Release[];
  publishedDocument?: PortfolioDocument | null;
};
type Revision = {
  id: string;
  revision: number;
  created_at: string;
  author: string;
};
export function PortfolioEditor({ id }: { id: string }) {
  const ai = useDocumentAi();
  const [browserAi, setBrowserAi] = useState(false);
  const [autoSummary, setAutoSummary] = useState(false);
  const user = useUser(),
    admin = user.role === "admin",
    feedback = useFeedback();
  const [uploadPurpose, setUploadPurpose] = useState<"article" | "cv">(
    "article",
  );
  const [data, setData] = useState<EditorData | null>(null),
    [document, setDocument] = useState<PortfolioDocument | null>(null),
    [tab, setTab] = useState("profile"),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [mobile, setMobile] = useState(false),
    [previewKey, setPreviewKey] = useState(0),
    [history, setHistory] = useState<Revision[]>([]),
    [aiEnabled, setAiEnabled] = useState(false);
  const load = useCallback(
    async (replace = false) => {
      const result = await api<EditorData>(`sites/${id}`);
      // A job refresh must not advance the revision of the local editing draft.
      setData((previous) =>
        replace || !previous
          ? result
          : {
              ...result,
              site: {
                ...result.site,
                revision: previous.site.revision,
                draft: previous.site.draft,
              },
            },
      );
      if (replace) {
        setDocument(result.site.draft);
        setDirty(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void feedback.run(async () => {
      await Promise.all([
        load(true),
        api<{ ai: boolean; aiProvider?: string }>("integrations").then(
          (integrations) => {
            setAiEnabled(integrations.ai);
            setBrowserAi(integrations.aiProvider === "huggingface-browser");
          },
        ),
      ]);
    });
  }, [load]);
  const hasJobs = data?.jobs.some((j) =>
    ["queued", "running"].includes(j.status),
  );
  useEffect(() => {
    if (!hasJobs) return;
    const interval = setInterval(() => {
      void load().catch((e) => feedback.setError(e.message));
    }, 3000);
    return () => clearInterval(interval);
  }, [hasJobs, load]);
  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function change(next: PortfolioDocument) {
    setDocument(next);
    setDirty(true);
    feedback.setMessage("");
  }
  async function save() {
    if (!document || !data) return;
    const result = await api<{ revision: number }>(`sites/${id}`, {
      method: "PUT",
      body: JSON.stringify({ document, revision: data.site.revision }),
    });
    setData({
      ...data,
      site: {
        ...data.site,
        revision: result.revision,
        draft: document,
        status: admin ? "draft" : "review",
      },
    });
    setDirty(false);
    setPreviewKey((k) => k + 1);
    return result.revision;
  }
  const canEdit = (field: string) =>
    admin || !!data?.site.editable_fields.includes(field);
  if (!document || !data)
    return (
      <>
        <Feedback {...feedback} />
        {!feedback.error && <PageLoading label="Opening the portfolio…" />}
      </>
    );
  function profile<K extends keyof PortfolioDocument["profile"]>(
    key: K,
    value: PortfolioDocument["profile"][K],
  ) {
    change({ ...document!, profile: { ...document!.profile, [key]: value } });
  }
  const tabs = [
    ["profile", "Profile"],
    ["sections", "Academic sections"],
    ...(admin
      ? [
          ["pages", "Pages"],
          ["design", "Design"],
          ["seo", "SEO & labels"],
        ]
      : []),
    ["media", "Files & articles"],
    ...(admin
      ? [
          ["permissions", "Permissions"],
          ["publish", "Review & publish"],
        ]
      : []),
    ["history", "History"],
  ];
  const assets = data.media;
  const assetSelect = (
    label: string,
    key: "portraitId" | "cvId",
    mime: string,
  ) => (
    <Field label={label}>
      <select
        value={document.profile[key]}
        disabled={!canEdit(`profile.${key}`)}
        onChange={(e) => profile(key, e.target.value)}
      >
        <option value="">No file selected</option>
        {assets
          .filter((m) => m.mime.startsWith(mime))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.filename}
            </option>
          ))}
      </select>
    </Field>
  );
  return (
    <>
      <div className="page-heading editor-heading">
        <div>
          <NavigationLink
            className="back"
            href="/studio/portfolios"
            onClick={(e) => {
              if (
                dirty &&
                !window.confirm("Leave without saving your changes?")
              )
                e.preventDefault();
            }}
          >
            <ArrowLeft size={12} /> All portfolios
          </NavigationLink>
          <h1>{document.profile.name}</h1>
          <div className="row">
            <Badge value={data.site.status} />
            <span className="muted" style={{ fontSize: 10 }}>
              Revision {data.site.revision}
            </span>
            {dirty && <span className="toast-save">Unsaved changes</span>}
          </div>
        </div>
        <div className="row">
          <Button
            variant="secondary"
            busy={feedback.busy}
            onClick={() =>
              void feedback.run(async () => {
                if (dirty) await save();
                setPreview(true);
              })
            }
          >
            <Eye size={14} /> Preview
          </Button>
          <Button
            busy={feedback.busy}
            onClick={() =>
              void feedback.run(
                async () => {
                  await save();
                },
                admin
                  ? "Draft saved."
                  : "Changes submitted for administrator review.",
              )
            }
          >
            <Save size={14} />
            {admin ? "Save draft" : "Submit changes"}
          </Button>
        </div>
      </div>
      <Feedback {...feedback} />
      {!admin && (
        <Notice
          tone="info"
          message="Your administrator controls which fields you can edit. Your changes go live only after administrator review and publishing."
        />
      )}
      <div className="tabs" role="tablist" aria-label="Portfolio editor">
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              if (key === "history")
                void feedback.run(async () => {
                  const result = await api<{ revisions: Revision[] }>(
                    `sites/${id}/history`,
                  );
                  setHistory(result.revisions);
                });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "profile" && (
        <div className="editor-grid">
          <div>
            {admin && (
              <CvImporter
                siteId={id}
                media={assets}
                document={document}
                enabled={aiEnabled}
                browserAi={browserAi}
                pending={
                  !!data.jobs.some(
                    (j) =>
                      j.kind === "cv-import" &&
                      ["queued", "running"].includes(j.status),
                  )
                }
                error={
                  data.jobs.find((j) => j.kind === "cv-import")?.status ===
                  "failed"
                    ? data.jobs.find((j) => j.kind === "cv-import")?.error ||
                      "Processing failed."
                    : undefined
                }
                onChange={change}
                onRefresh={() => load()}
              />
            )}
            <section className="panel">
              <h2>The person behind the research.</h2>
              <p className="panel-description">
                A clear introduction to their work, interests, and academic
                direction.
              </p>
              <div className="form-grid">
                {(
                  [
                    "name",
                    "headline",
                    "affiliation",
                    "location",
                    "email",
                  ] as const
                ).map((key) => (
                  <div
                    key={key}
                    className={
                      ["headline", "affiliation"].includes(key)
                        ? "full-span"
                        : ""
                    }
                  >
                    <Field
                      label={
                        {
                          name: "Full name",
                          headline: "Academic headline",
                          affiliation: "Current affiliation",
                          location: "Location",
                          email: "Public contact email",
                        }[key]
                      }
                      hint={
                        !canEdit(`profile.${key}`)
                          ? "Managed by your administrator"
                          : undefined
                      }
                    >
                      <input
                        type={key === "email" ? "email" : "text"}
                        value={document.profile[key]}
                        disabled={!canEdit(`profile.${key}`)}
                        maxLength={key === "email" ? 254 : 200}
                        onChange={(e) => profile(key, e.target.value)}
                      />
                    </Field>
                  </div>
                ))}
                <div className="full-span">
                  <Field
                    label="Biography"
                    hint="Add an About section to display this biography on the website."
                  >
                    <textarea
                      rows={7}
                      maxLength={10000}
                      value={document.profile.bio}
                      disabled={!canEdit("profile.bio")}
                      onChange={(e) => profile("bio", e.target.value)}
                    />
                  </Field>
                </div>
                {assetSelect("Profile photo", "portraitId", "image/")}
                {assetSelect("Curriculum vitae", "cvId", "application/pdf")}
              </div>
            </section>
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>Academic & social profiles</h2>
                  <p className="panel-description" style={{ marginBottom: 0 }}>
                    ORCID, Google Scholar, LinkedIn, GitHub, or other relevant
                    profiles.
                  </p>
                </div>
                {canEdit("profile.links") && (
                  <Button
                    variant="secondary small"
                    onClick={() =>
                      profile("links", [
                        ...document.profile.links,
                        { label: "", url: "" },
                      ])
                    }
                  >
                    <Plus size={13} /> Add link
                  </Button>
                )}
              </div>
              {!document.profile.links.length && (
                <p className="muted" style={{ fontSize: 12 }}>
                  No profile links added yet.
                </p>
              )}
              {document.profile.links.map((link, index) => (
                <div className="row" key={index} style={{ marginBottom: 12 }}>
                  <Field label="Label">
                    <input
                      value={link.label}
                      maxLength={200}
                      disabled={!canEdit("profile.links")}
                      onChange={(e) =>
                        profile(
                          "links",
                          document.profile.links.map((l, i) =>
                            i === index ? { ...l, label: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </Field>
                  <div style={{ flex: 1 }}>
                    <Field label="URL">
                      <input
                        type="url"
                        value={link.url}
                        disabled={!canEdit("profile.links")}
                        onChange={(e) =>
                          profile(
                            "links",
                            document.profile.links.map((l, i) =>
                              i === index ? { ...l, url: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  {canEdit("profile.links") && (
                    <button
                      className="icon-button"
                      aria-label="Remove link"
                      onClick={() =>
                        profile(
                          "links",
                          document.profile.links.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          </div>
          <aside className="editor-aside">
            <section className="panel">
              <span className="eyebrow">A THOUGHTFUL INTRODUCTION</span>
              <h3 style={{ marginTop: 14 }}>
                Make the first impression count.
              </h3>
              <p>
                A specific headline and a concise biography help potential
                supervisors understand the researcher’s direction.
              </p>
              <p>
                Focus on research interests, methods, and the contribution they
                hope to make.
              </p>
            </section>
            <section className="panel">
              <h3>Portfolio address</h3>
              <p>/p/{data.site.slug}</p>
              {data.site.published_release_id ? (
                <a
                  className="inline-link"
                  href={`/p/${data.site.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit published portfolio ↗
                </a>
              ) : (
                <p>This portfolio hasn’t been published yet.</p>
              )}
            </section>
          </aside>
        </div>
      )}
      {tab === "sections" && (
        <SectionsEditor
          sections={document.sections}
          onChange={(sections) => change({ ...document, sections })}
          media={assets}
          admin={admin}
          allowed={data.site.editable_fields}
        />
      )}
      {tab === "pages" && admin && (
        <>
          <div className="section-title">
            <div>
              <h2>Give important work its own space.</h2>
              <p className="panel-description">
                Create additional pages using the same academic sections.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                change({
                  ...document,
                  pages: [
                    ...document.pages,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      slug: "",
                      description: "",
                      sections: [],
                    },
                  ],
                })
              }
            >
              <Plus size={14} /> Add page
            </Button>
          </div>
          {document.pages.map((page, index) => (
            <section className="panel" key={page.id}>
              <div className="spread" style={{ marginBottom: 20 }}>
                <h2>{page.title || "New page"}</h2>
                <Button
                  variant="danger small"
                  onClick={() => {
                    if (window.confirm("Remove this page from the draft?"))
                      change({
                        ...document,
                        pages: document.pages.filter((p) => p.id !== page.id),
                      });
                  }}
                >
                  <Trash2 size={13} /> Remove page
                </Button>
              </div>
              <div className="form-grid" style={{ marginBottom: 25 }}>
                <Field label="Page title">
                  <input
                    value={page.title}
                    maxLength={200}
                    onChange={(e) =>
                      change({
                        ...document,
                        pages: document.pages.map((p, i) =>
                          i === index ? { ...p, title: e.target.value } : p,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Page address"
                  hint="Lowercase letters, numbers, and hyphens."
                >
                  <input
                    value={page.slug}
                    maxLength={80}
                    onChange={(e) =>
                      change({
                        ...document,
                        pages: document.pages.map((p, i) =>
                          i === index ? { ...p, slug: e.target.value } : p,
                        ),
                      })
                    }
                  />
                </Field>
                <div className="full-span">
                  <Field label="Description">
                    <textarea
                      rows={2}
                      value={page.description}
                      maxLength={320}
                      onChange={(e) =>
                        change({
                          ...document,
                          pages: document.pages.map((p, i) =>
                            i === index
                              ? { ...p, description: e.target.value }
                              : p,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
              <SectionsEditor
                sections={page.sections}
                onChange={(sections) =>
                  change({
                    ...document,
                    pages: document.pages.map((p, i) =>
                      i === index ? { ...p, sections } : p,
                    ),
                  })
                }
                media={assets}
                admin
                allowed={[]}
              />
            </section>
          ))}
          {!document.pages.length && (
            <Empty
              icon={<FileText />}
              title="A little more room for your work."
              description="Add pages for a research project, teaching philosophy, or other academic work."
            />
          )}
        </>
      )}
      {tab === "design" && admin && (
        <DesignEditor document={document} onChange={change} />
      )}
      {tab === "seo" && admin && (
        <>
          <section className="panel">
            <h2>Help the right people find this work.</h2>
            <p className="panel-description">
              Metadata is included in the generated HTML of every published
              page.
            </p>
            <div className="form-grid">
              <div className="full-span">
                <Field
                  label="Search title"
                  hint="Leave blank to use the researcher’s name."
                >
                  <input
                    maxLength={160}
                    value={document.seo.title}
                    onChange={(e) =>
                      change({
                        ...document,
                        seo: { ...document.seo, title: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="full-span">
                <Field label="Search description">
                  <textarea
                    rows={3}
                    maxLength={320}
                    value={document.seo.description}
                    onChange={(e) =>
                      change({
                        ...document,
                        seo: { ...document.seo, description: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Social sharing image">
                <select
                  value={document.seo.socialImageId}
                  onChange={(e) =>
                    change({
                      ...document,
                      seo: { ...document.seo, socialImageId: e.target.value },
                    })
                  }
                >
                  <option value="">No image</option>
                  {assets
                    .filter((m) => m.mime.startsWith("image/"))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.filename}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Content language">
                <select
                  value={document.seo.language}
                  onChange={(e) =>
                    change({
                      ...document,
                      seo: {
                        ...document.seo,
                        language: e.target.value as "en" | "bn",
                      },
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="bn">Bengali</option>
                </select>
              </Field>
              <label className="check-row full-span">
                <input
                  type="checkbox"
                  checked={document.seo.indexable}
                  onChange={(e) =>
                    change({
                      ...document,
                      seo: { ...document.seo, indexable: e.target.checked },
                    })
                  }
                />{" "}
                Allow search engines to index the published website
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>Navigation & labels</h2>
            <p className="panel-description">
              Personalize the visible header, buttons, and footer.
            </p>
            <div className="form-grid">
              {(
                ["siteTitle", "contactLabel", "cvLabel", "footer"] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      siteTitle: "Header title",
                      contactLabel: "Contact button",
                      cvLabel: "CV button",
                      footer: "Footer text",
                    }[key]
                  }
                >
                  <input
                    value={document.navigation[key]}
                    maxLength={key === "footer" ? 1000 : 200}
                    onChange={(e) =>
                      change({
                        ...document,
                        navigation: {
                          ...document.navigation,
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "seo" && admin && (
        <section className="panel">
          <h2>Website wording</h2>
          <p className="panel-description">
            Edit public buttons, form labels, and messages. These labels also
            support translating the portfolio.
          </p>
          <div className="form-grid">
            {(
              Object.keys(
                document.labels,
              ) as (keyof PortfolioDocument["labels"])[]
            ).map((key) => (
              <Field
                key={key}
                label={key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())}
              >
                <input
                  value={document.labels[key]}
                  maxLength={300}
                  onChange={(e) =>
                    change({
                      ...document,
                      labels: { ...document.labels, [key]: e.target.value },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </section>
      )}
      {tab === "media" && (
        <>
          <div className="section-title">
            <div>
              <h2>The work, in one place.</h2>
              <p className="panel-description">
                {(
                  assets.reduce((sum, m) => sum + m.bytes, 0) /
                  1024 /
                  1024
                ).toFixed(1)}{" "}
                MB of 100 MB used. Files remain private until included in a
                published release.
              </p>
            </div>
          </div>
          {(admin ||
            data.site.editable_fields.some(
              (f) => f.includes("Id") || f.startsWith("sections."),
            )) && (
            <div className="upload-zone">
              <Upload size={24} />
              <strong>Upload a portrait, CV, or research paper</strong>
              <small>PDF, JPG, PNG, or WebP · up to 20 MB per file</small>
              <div
                style={{
                  maxWidth: 340,
                  margin: "15px auto",
                  textAlign: "left",
                }}
              >
                <Field
                  label="PDF purpose"
                  hint="Research articles uploaded by an administrator are summarized automatically when AI is connected."
                >
                  <select
                    value={uploadPurpose}
                    onChange={(e) =>
                      setUploadPurpose(e.target.value as "article" | "cv")
                    }
                  >
                    <option value="article">Research article</option>
                    <option value="cv">Curriculum vitae</option>
                  </select>
                </Field>
              </div>
              <input
                aria-label="Upload a file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                disabled={feedback.busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void feedback.run(async () => {
                    const form = new FormData();
                    form.append("file", file);
                    form.append("purpose", uploadPurpose);
                    const result = await api<{
                      id: string;
                      summaryQueued: boolean;
                    }>(`sites/${id}/media`, {
                      method: "POST",
                      body: form,
                    });
                    await load();
                    if (
                      admin &&
                      browserAi &&
                      autoSummary &&
                      uploadPurpose === "article" &&
                      file.type === "application/pdf"
                    ) {
                      const message = await ai.run(result.id, "abstract", true);
                      await load();
                      feedback.setMessage(message);
                      return;
                    }
                    feedback.setMessage(
                      result.summaryQueued
                        ? "Article uploaded. Research summary generation started automatically."
                        : "File uploaded. Select it in the relevant content field to include it in the portfolio.",
                    );
                  });
                  e.target.value = "";
                }}
              />
            </div>
          )}
          {admin && browserAi && (
            <div className="panel">
              <h3>Free AI on your computer</h3>
              <p className="panel-description">
                The first use downloads roughly 1 GB from Hugging Face. Use
                desktop Chrome or Edge with WebGPU, allow about 3 GB of GPU
                memory, and keep this tab open. Uploaded documents stay on this
                app's server; inference runs in your browser. Text-based PDFs
                only; review every claim.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={autoSummary}
                  onChange={(event) => setAutoSummary(event.target.checked)}
                />{" "}
                Generate a free summary after each article upload
              </label>
            </div>
          )}
          <AiProgress {...ai} />
          {admin && !aiEnabled && (
            <Notice
              tone="info"
              message="Enable free browser AI or configure a server AI provider to generate research summaries. You can add original abstracts manually now."
            />
          )}
          <div className="file-list">
            {assets.map((file) => (
              <div key={file.id}>
                <div className="file-row">
                  <div className="file-icon">
                    {file.mime.startsWith("image/") ? (
                      <ImageIcon size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </div>
                  <div className="file-info">
                    <strong>{file.filename}</strong>
                    <small>
                      {(file.bytes / 1024).toFixed(0)} KB ·{" "}
                      {dateTime(file.created_at)}
                    </small>
                  </div>
                  <a
                    href={`/api/media/${file.id}`}
                    className="icon-button"
                    aria-label={`Download ${file.filename}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download size={16} />
                  </a>
                  {admin && file.mime === "application/pdf" && (
                    <Button
                      variant="secondary small"
                      disabled={!aiEnabled || feedback.busy}
                      onClick={() =>
                        void feedback.run(async () => {
                          const message = await ai.run(
                            file.id,
                            "abstract",
                            browserAi,
                          );
                          await load();
                          feedback.setMessage(message);
                        })
                      }
                    >
                      <Sparkles size={13} /> Generate summary
                    </Button>
                  )}
                  {admin && (
                    <button
                      className="icon-button"
                      aria-label={`Delete ${file.filename}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this file from the media library? Published release copies remain available.",
                          )
                        )
                          void feedback.run(async () => {
                            await api(`media/${file.id}`, { method: "DELETE" });
                            await load();
                          }, "File deleted.");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {file.summary && (
                  <section className="panel" style={{ marginTop: 8 }}>
                    <div className="spread">
                      <h3>Generated research summary</h3>
                      <Badge value="review required" />
                    </div>
                    <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                      {file.summary.abstract}
                    </p>
                    {file.summary.limitations && (
                      <Notice tone="info" message={file.summary.limitations} />
                    )}
                    <p className="muted" style={{ fontSize: 10 }}>
                      {file.summary.keywords.join(" · ")} · {file.summary.model}{" "}
                      · {dateTime(file.summary.generatedAt)}
                    </p>
                    {admin && (
                      <Button
                        variant="secondary small"
                        onClick={() => {
                          const sections = structuredClone(document.sections);
                          let section = sections.find(
                            (s) => s.type === "publications",
                          );
                          if (!section) {
                            section = {
                              id: crypto.randomUUID(),
                              type: "publications",
                              title: "Publications",
                              visible: true,
                              intro: "",
                              entries: [],
                            };
                            sections.push(section);
                          }
                          section.entries.push({
                            ...emptyEntry(),
                            title: file.filename.replace(/\.pdf$/i, ""),
                            body: file.summary!.abstract,
                            tags: file.summary!.keywords.join(", "),
                            mediaId: file.id,
                            abstractSource: "generated",
                          });
                          change({ ...document, sections });
                          setTab("sections");
                          feedback.setMessage(
                            "Added to the draft. Review the title, authors, dates, and summary before publishing.",
                          );
                        }}
                      >
                        Add to publication draft
                      </Button>
                    )}
                  </section>
                )}
              </div>
            ))}
          </div>
          {!assets.length && (
            <Empty
              icon={<FileText />}
              title="A place for the original work."
              description="Upload a profile photo, a CV, and research papers to use in this portfolio."
            />
          )}
          <JobList jobs={data.jobs.filter((j) => j.kind === "abstract")} />
        </>
      )}
      {tab === "permissions" && admin && (
        <Permissions site={data.site} onSaved={() => load()} />
      )}
      {tab === "publish" && admin && (
        <>
          <section className="panel">
            <div className="spread wrap">
              <div>
                <h2>Ready for the world?</h2>
                <p className="panel-description">
                  Publishing uses the saved draft. Unsaved changes must be saved
                  first.
                </p>
              </div>
              <Button
                busy={feedback.busy}
                disabled={
                  dirty ||
                  data.jobs.some(
                    (j) =>
                      j.kind === "publish" &&
                      ["queued", "running"].includes(j.status),
                  )
                }
                onClick={() =>
                  void feedback.run(async () => {
                    await api(`sites/${id}/publish`, {
                      method: "POST",
                      body: JSON.stringify({ revision: data.site.revision }),
                    });
                    await load();
                  }, "Publishing has started. The current website remains available until the new release is ready.")
                }
              >
                <Globe size={15} /> Publish approved draft
              </Button>
            </div>
            {dirty && (
              <Notice
                tone="info"
                message="Save the current changes before publishing."
              />
            )}
            {data.site.published_release_id && (
              <a
                className="guide-link"
                href={`/p/${data.site.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View published portfolio <ExternalLink size={13} />
              </a>
            )}
          </section>
          <section className="panel">
            <h2>Changes since the published version</h2>
            <p className="panel-description">
              Review the changes below before approving this version.
            </p>
            <DocumentDiff
              before={data.publishedDocument || null}
              after={document}
            />
          </section>
          <JobList jobs={data.jobs.filter((j) => j.kind === "publish")} />
          <section className="panel">
            <h2>Published releases</h2>
            <p className="panel-description">
              Restore a previous public release without replacing the current
              editing draft.
            </p>
            {data.releases.map((release) => (
              <div className="integration-row" key={release.id}>
                <div>
                  <strong>Revision {release.revision}</strong>
                  <p>{dateTime(release.created_at)}</p>
                </div>
                {release.id === data.site.published_release_id ? (
                  <Badge value="published" />
                ) : (
                  <Button
                    variant="secondary small"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Make revision ${release.revision} the live website?`,
                        )
                      )
                        void feedback.run(async () => {
                          await api(`sites/${id}/rollback`, {
                            method: "POST",
                            body: JSON.stringify({ releaseId: release.id }),
                          });
                          await load();
                        }, "Previous release restored.");
                    }}
                  >
                    Restore release
                  </Button>
                )}
              </div>
            ))}
            {!data.releases.length && <p className="muted">No releases yet.</p>}
          </section>
          <DomainManager siteId={id} />
          {!data.site.published_release_id && !data.releases.length && (
            <DeleteDraft
              id={id}
              name={data.site.name}
              slug={data.site.slug}
              revision={data.site.revision}
              busy={!!hasJobs || feedback.busy}
            />
          )}
          {data.site.published_release_id && (
            <section className="panel danger-zone">
              <div className="spread wrap">
                <div>
                  <h3>Take this portfolio offline</h3>
                  <p className="panel-description" style={{ marginBottom: 0 }}>
                    The content and release history remain in your workspace.
                    Cached pages may take several minutes to expire.
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("Take this portfolio offline?"))
                      void feedback.run(async () => {
                        await api(`sites/${id}/unpublish`, { method: "POST" });
                        await load();
                      }, "Portfolio unpublished.");
                  }}
                >
                  Unpublish
                </Button>
              </div>
            </section>
          )}
        </>
      )}
      {tab === "history" && (
        <>
          <section className="panel">
            <div className="spread wrap">
              <div>
                <h2>A record of the journey.</h2>
                <p className="panel-description">
                  Saved revisions preserve the document as it was at that time.
                </p>
              </div>
              <a className="button secondary" href={`/api/sites/${id}/export`}>
                <Download size={14} /> Export content JSON
              </a>
            </div>
            {history.map((revision) => (
              <div className="integration-row" key={revision.id}>
                <div>
                  <strong>Revision {revision.revision}</strong>
                  <p>
                    {revision.author} · {dateTime(revision.created_at)}
                  </p>
                </div>
                {revision.revision === data.site.revision ? (
                  <Badge value="current" />
                ) : (
                  admin && (
                    <Button
                      variant="secondary small"
                      disabled={dirty}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Restore revision ${revision.revision} as a new draft?`,
                          )
                        )
                          void feedback.run(async () => {
                            await api(`sites/${id}/restore`, {
                              method: "POST",
                              body: JSON.stringify({
                                revision: revision.revision,
                                currentRevision: data.site.revision,
                              }),
                            });
                            await load(true);
                            const result = await api<{ revisions: Revision[] }>(
                              `sites/${id}/history`,
                            );
                            setHistory(result.revisions);
                          }, "Revision restored as a new draft.");
                      }}
                    >
                      <History size={13} /> Restore draft
                    </Button>
                  )
                )}
              </div>
            ))}
          </section>
        </>
      )}
      {preview && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Portfolio preview"
            className="modal preview-modal"
          >
            <header>
              <h2>Portfolio preview</h2>
              <div className="row">
                <button
                  className={`icon-button ${!mobile ? "active" : ""}`}
                  aria-label="Desktop preview"
                  onClick={() => setMobile(false)}
                >
                  <Monitor size={19} />
                </button>
                <button
                  className={`icon-button ${mobile ? "active" : ""}`}
                  aria-label="Mobile preview"
                  onClick={() => setMobile(true)}
                >
                  <Smartphone size={19} />
                </button>
                <Button
                  variant="secondary small"
                  onClick={() => setPreview(false)}
                >
                  Close preview
                </Button>
              </div>
            </header>
            <div className="preview-frame-wrap">
              <iframe
                title="Draft portfolio preview"
                className={mobile ? "mobile-preview" : ""}
                src={`/api/sites/${id}/preview?v=${previewKey}`}
                sandbox="allow-same-origin"
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function JobList({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return null;
  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <h3>Processing activity</h3>
      {jobs.slice(0, 8).map((job) => (
        <div key={job.id} className="integration-row">
          <div>
            <strong>
              {job.kind === "publish"
                ? "Portfolio publishing"
                : "Research summary"}
            </strong>
            <p>{dateTime(job.created_at)}</p>
            {job.error && (
              <p style={{ color: "#a15c43", maxWidth: 650 }}>{job.error}</p>
            )}
          </div>
          <Badge value={job.status} />
        </div>
      ))}
    </section>
  );
}
function Permissions({
  site,
  onSaved,
}: {
  site: Site;
  onSaved: () => Promise<void>;
}) {
  const feedback = useFeedback(),
    [clientId, setClientId] = useState(site.client_id || ""),
    [fields, setFields] = useState<string[]>(site.editable_fields),
    [clients, setClients] = useState<
      {
        id: string;
        name: string;
        email: string;
        role: string;
        disabled: boolean;
      }[]
    >([]);
  useEffect(() => {
    void feedback.run(async () => {
      const result = await api<{ users: typeof clients }>("users");
      setClients(
        result.users.filter((u) => u.role === "client" && !u.disabled),
      );
    });
  }, []);
  return (
    <section className="panel">
      <h2>The right amount of control.</h2>
      <p className="panel-description">
        Clients can edit only the checked fields on this portfolio.
        Administrators always control publishing, design, pages, and
        permissions.
      </p>
      <Feedback {...feedback} />
      <Field label="Assigned client">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Agency-managed only</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} · {client.email}
            </option>
          ))}
        </select>
      </Field>
      <div className="permission-grid">
        {editableOptions.map(([key, label]) => (
          <label key={key} className="check-row">
            <input
              type="checkbox"
              checked={fields.includes(key)}
              onChange={(e) =>
                setFields(
                  e.target.checked
                    ? [...fields, key]
                    : fields.filter((f) => f !== key),
                )
              }
            />
            {label}
          </label>
        ))}
      </div>
      <Notice
        tone="info"
        message="Section access permits editing existing sections of that type. Clients cannot add, remove, or reorder sections, and cannot edit additional pages."
      />
      <div className="form-actions">
        <Button
          busy={feedback.busy}
          onClick={() =>
            void feedback.run(async () => {
              await api(`sites/${site.id}/permissions`, {
                method: "PUT",
                body: JSON.stringify({ clientId, editableFields: fields }),
              });
              await onSaved();
            }, "Client permissions updated.")
          }
        >
          <Lock size={14} /> Save permissions
        </Button>
      </div>
    </section>
  );
}
function DocumentDiff({
  before,
  after,
}: {
  before: PortfolioDocument | null;
  after: PortfolioDocument;
}) {
  if (!before)
    return (
      <Notice
        tone="info"
        message="This is the first publication. Review all content in Preview before publishing."
      />
    );
  const changes: { path: string; before: unknown; after: unknown }[] = [];
  function compare(a: unknown, b: unknown, path: string) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        compare(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        );
    } else changes.push({ path, before: a, after: b });
  }
  compare(before, after, "");
  return changes.length ? (
    <div className="stack">
      {changes.map((change) => (
        <div key={change.path}>
          <strong style={{ fontSize: 11 }}>{change.path}</strong>
          <div className="form-grid">
            <div className="code-box" style={{ whiteSpace: "pre-wrap" }}>
              <span className="muted">Previously</span>
              <br />
              {typeof change.before === "string"
                ? change.before
                : (JSON.stringify(change.before) ?? "Not set")}
            </div>
            <div className="code-box" style={{ whiteSpace: "pre-wrap" }}>
              <span className="muted">Proposed</span>
              <br />
              {typeof change.after === "string"
                ? change.after
                : (JSON.stringify(change.after) ?? "Not set")}
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Notice
      tone="success"
      message="The content matches the currently published version."
    />
  );
}
function DomainManager({ siteId }: { siteId: string }) {
  const feedback = useFeedback(),
    [hostname, setHostname] = useState(""),
    [domains, setDomains] = useState<
      {
        id: string;
        hostname: string;
        verification_token: string;
        verified_at: string | null;
      }[]
    >([]);
  async function load() {
    const result = await api<{ domains: typeof domains }>(
      `sites/${siteId}/domains`,
    );
    setDomains(result.domains);
  }
  useEffect(() => {
    void feedback.run(load);
  }, []);
  return (
    <section className="panel">
      <h2>Custom domains</h2>
      <p className="panel-description">
        Verify ownership first. HTTPS and delivery must then be provisioned in
        your hosting account using the deployment guide.
      </p>
      <Feedback {...feedback} />
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void feedback.run(async () => {
            await api(`sites/${siteId}/domains`, {
              method: "POST",
              body: JSON.stringify({ hostname }),
            });
            setHostname("");
            await load();
          });
        }}
      >
        <div style={{ flex: 1 }}>
          <Field label="Domain name">
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          busy={feedback.busy}
          style={{ marginTop: 24 }}
        >
          Add domain
        </Button>
      </form>
      {domains.map((domain) => (
        <div key={domain.id} style={{ marginTop: 25 }}>
          <div className="spread">
            <strong>{domain.hostname}</strong>
            <Badge
              value={domain.verified_at ? "ownership verified" : "unverified"}
            />
          </div>
          <p className="panel-description">
            Create a TXT record named <code>_brilliancy.{domain.hostname}</code>{" "}
            with this value:
          </p>
          <div className="code-box">{domain.verification_token}</div>
          <Button
            variant="secondary small"
            busy={feedback.busy}
            onClick={() =>
              void feedback.run(async () => {
                await api(`sites/${siteId}/verify-domain`, {
                  method: "POST",
                  body: JSON.stringify({ domainId: domain.id }),
                });
                await load();
              }, "Domain ownership verified. Configure HTTPS delivery next.")
            }
          >
            <CheckCircle2 size={13} /> Verify DNS record
          </Button>
        </div>
      ))}
    </section>
  );
}
