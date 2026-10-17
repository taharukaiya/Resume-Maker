"use client";
import type { Media } from "@/modules/media/service";
import {
  type PortfolioDocument,
  editableOptions,
  emptyEntry,
  defaultLabels,
  documentSchema,
  profileLinkUrlSchema,
} from "@/modules/portfolios/schema";
import type { Site } from "@/modules/portfolios/service";
import {
  ArrowLeft,
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
import { portfolioSeo, portfolioTabTitle } from "@/modules/portfolios/seo";
import { publicationIssues, sectionTypes } from "@/modules/portfolios/schema";
import { replaceSectionGroup } from "@/modules/portfolios/structure";
import { PublicationsEditor } from "./publications-editor";
import { DeletePortfolio } from "./delete-portfolio";
import { CvImporter } from "./cv-importer";
import { socialPlatforms } from "@/modules/portfolios/social-profiles";
import { PortraitEditor } from "./portrait-editor";
import { AiProgress, useDocumentAi } from "./use-document-ai";
import { SectionsEditor } from "./section-editor";
import { PagePlanner } from "./page-planner";
import { EditorWorkflow, portfolioSteps } from "./editor-workflow";
import { DomainManager } from "./domain-manager";
import { suggestedPortfolioDomain } from "@/modules/portfolios/domain-suggestion";
import { orderSections } from "@/modules/portfolios/structure";
import { useUser } from "./studio-shell";
import { NavigationLink } from "./navigation-link";
import { PageLoading } from "./page-loading";
import { useConfirmation } from "./confirmation";
import { useRouter } from "next/navigation";
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
  media_id?: string;
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
  publishedUrl?: string | null;
};
type Revision = {
  id: string;
  revision: number;
  created_at: string;
  author: string;
};
export function PortfolioEditor({ id }: { id: string }) {
  const confirm = useConfirmation();
  const router = useRouter();
  const ai = useDocumentAi();
  const [browserAi, setBrowserAi] = useState(false);
  const [aiProvider, setAiProvider] = useState("openai");
  const [demo, setDemo] = useState(false);
  const [autoSummary, setAutoSummary] = useState(false);
  const [invalidLink, setInvalidLink] = useState<number | null>(null);
  const [addressDirty, setAddressDirty] = useState(false);
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
    [deleting, setDeleting] = useState(false),
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
        api<{ ai: boolean; aiProvider?: string; demo?: boolean }>(
          "integrations",
        ).then((integrations) => {
          setAiEnabled(integrations.ai);
          setBrowserAi(integrations.aiProvider === "huggingface-browser");
          setAiProvider(integrations.aiProvider || "openai");
          setDemo(!!integrations.demo);
        }),
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
    async function navigate(event: MouseEvent) {
      if (
        !dirty ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const next = new URL(link.href);
      if (
        next.origin !== window.location.origin ||
        !next.pathname.startsWith("/studio") ||
        next.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      if (
        await confirm({
          title: "Leave unsaved changes?",
          description:
            "Your latest edits have not been saved. Stay here to save them, or leave and discard these edits.",
          confirmLabel: "Leave without saving",
          destructive: true,
        })
      )
        router.push(next.pathname + next.search + next.hash);
    }
    window.document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.document.removeEventListener("click", navigate, true);
    };
  }, [dirty, confirm, router]);
  function change(next: PortfolioDocument) {
    setDocument(next);
    setDirty(true);
    feedback.setMessage("");
  }
  useEffect(() => {
    if (tab === "profile" && invalidLink !== null) {
      window.document
        .querySelector<HTMLInputElement>(`[data-profile-link="${invalidLink}"]`)
        ?.focus();
    }
  }, [tab, invalidLink]);
  async function save() {
    if (!document || !data) return;
    const navigationResult = documentSchema.shape.navigation.safeParse(
      document.navigation,
    );
    if (!navigationResult.success) {
      setTab("pages");
      throw new Error(
        "Check Website structure in the Pages tab: every page needs a title and an address using lowercase letters, numbers, and hyphens.",
      );
    }
    for (const [index, page] of document.pages.entries()) {
      if (!page.title.trim()) {
        setTab("pages");
        throw new Error(
          `Page ${index + 1}: enter a page title in the Pages tab, or remove this unfinished page.`,
        );
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) {
        setTab("pages");
        throw new Error(
          `Page ${index + 1} (${page.title}): enter a page address using lowercase letters, numbers, and hyphens, such as research.`,
        );
      }
    }
    const links = document.profile.links.map((link, index) => {
      const result = profileLinkUrlSchema.safeParse(link.url);
      if (!result.success) {
        setInvalidLink(index);
        setTab("profile");
        throw new Error(
          `Profile link ${index + 1}${link.label ? ` (${link.label})` : ""}: enter a valid website address, or clear the URL to leave it blank.${canEdit("profile.links") ? "" : " Ask your administrator to correct this locked field."}`,
        );
      }
      return { ...link, url: result.data };
    });
    const savedDocument = {
      ...document,
      profile: { ...document.profile, links },
    };
    const result = await api<{ revision: number }>(`sites/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        document: savedDocument,
        revision: data.site.revision,
      }),
    });
    setDocument(savedDocument);
    setInvalidLink(null);
    setData({
      ...data,
      site: {
        ...data.site,
        revision: result.revision,
        draft: savedDocument,
        status: admin ? "draft" : "review",
      },
    });
    setDirty(false);
    setPreviewKey((k) => k + 1);
    return result.revision;
  }
  const canEdit = (field: string) =>
    admin || !!data?.site.editable_fields.includes(field);
  useEffect(() => {
    if (!document) return;
    const label = (
      {
        profile: "Profile",
        sections: "Academic sections",
        publications: "Research",
        articles: "Articles",
        pages: "Pages",
        seo: "Search & sharing",
        media: "File library",
        permissions: "Permissions",
        publish: "Review & publish",
        address: "Website address",
        history: "History",
      } as Record<string, string>
    )[tab];
    window.document.title = `${document.profile.name} | ${label} | Brilliancy Research`;
  }, [document?.profile.name, tab]);
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
    ["publications", "Research"],
    ["articles", "Articles"],
    ...(admin
      ? [
          ["pages", "Pages"],
          ["publish", "Review & publish"],
          ["address", "Website address"],
          ["seo", "Search & sharing"],
        ]
      : []),
    ["media", "File library"],
    ...(admin ? [["permissions", "Permissions"]] : []),
    ["history", "History"],
  ];
  const assets = data.media;
  function extracting(file: Media) {
    return data?.jobs.some(
      (job) =>
        job.kind === "abstract" &&
        job.media_id === file.id &&
        ["queued", "running"].includes(job.status),
    );
  }
  function addArticle(file: Media) {
    if (!document || extracting(file)) return;
    const sections = structuredClone(document.sections);
    let section = sections.find((s) => s.type === "articles");
    if (!section) {
      section = {
        id: crypto.randomUUID(),
        type: "articles",
        title: "Articles",
        visible: true,
        intro: "",
        entries: [],
      };
      sections.push(section);
    }
    const meta = file.article_metadata;
    section.entries.push({
      ...emptyEntry(),
      title: meta?.title || file.filename.replace(/\.pdf$/i, ""),
      authors: meta?.authors || "",
      start: meta?.date || "",
      body: meta?.abstract || file.summary?.abstract || "",
      abstractSource: meta?.abstractSource || (file.summary ? "generated" : ""),
      tags: (meta?.keywords || file.summary?.keywords || [])
        .join(", ")
        .slice(0, 500),
      doi: meta?.doi || "",
      category: meta?.category || "",
      journal: meta?.journal || "",
      volume: meta?.volume || "",
      issue: meta?.issue || "",
      pages: meta?.pages || "",
      fullText: file.extracted_text || "",
      mediaId: file.id,
      coverId: file.article_assets?.imageIds[0] || "",
      images: (file.article_assets?.imageIds || []).map((mediaId) => ({
        mediaId,
        alt: "",
        caption: "",
      })),
    });
    change({ ...document, sections });
    setTab("articles");
    feedback.setMessage(
      "Added to the draft. Review and edit all article details before publishing.",
    );
  }
  const seoPreview = portfolioSeo(document);
  const readiness = publicationIssues(document);
  const currentStep = portfolioSteps.findIndex(([key]) => key === tab);
  function selectTab(key: string) {
    if (tab === "address" && key !== "address" && addressDirty) {
      void confirm({
        title: "Leave the unsaved address selection?",
        description:
          "The public address selection has not been saved. Your portfolio content edits will be kept.",
        confirmLabel: "Discard address selection",
      }).then((approved) => {
        if (approved) {
          setAddressDirty(false);
          openTab(key);
        }
      });
      return;
    }
    openTab(key);
  }
  function openTab(key: string) {
    setTab(key);
    if (key === "history")
      void feedback.run(async () => {
        const result = await api<{ revisions: Revision[] }>(
          `sites/${id}/history`,
        );
        setHistory(result.revisions);
      });
  }
  const assetSelect = (
    label: string,
    key: "portraitId" | "cvId" | "logoId",
    mime: string,
  ) => (
    <Field label={label}>
      <select
        value={document.profile[key] || ""}
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
          <NavigationLink className="back" href="/studio/portfolios">
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
          {admin && (
            <Button
              variant="danger"
              disabled={feedback.busy}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={14} /> Delete portfolio
            </Button>
          )}
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
      {admin && deleting && (
        <DeletePortfolio
          id={id}
          name={data.site.name}
          slug={data.site.slug}
          revision={data.site.revision}
          published={!!data.site.published_release_id}
          busy={!!hasJobs || feedback.busy}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDirty(false);
            router.replace("/studio/portfolios");
          }}
        />
      )}
      <Feedback {...feedback} />
      {!admin && (
        <Notice
          tone="info"
          message="Your administrator controls which fields you can edit. Your changes go live only after administrator review and publishing."
        />
      )}
      <EditorWorkflow
        tab={tab}
        tabs={tabs}
        admin={admin}
        onSelect={selectTab}
      />
      <div className="mobile-editor-tabs">
        <Field label="Editing">
          <select value={tab} onChange={(e) => selectTab(e.target.value)}>
            {tabs.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div hidden={tab !== "profile"}>
        <div className="editor-grid">
          <div>
            {admin && (
              <CvImporter
                siteId={id}
                media={assets}
                document={document}
                enabled={aiEnabled}
                browserAi={browserAi}
                aiProvider={aiProvider}
                jobs={data.jobs}
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
                          name: "Full name *",
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
                        required={key === "name"}
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
                  {admin && (
                    <Field
                      label="Blue headline phrase"
                      hint="Enter the exact words from the headline to highlight in blue."
                    >
                      <input
                        value={document.profile.headlineHighlight || ""}
                        maxLength={200}
                        onChange={(event) =>
                          profile("headlineHighlight", event.target.value)
                        }
                      />
                    </Field>
                  )}
                  <Field
                    label="Biography"
                    hint="Used as the introduction unless you enter separate homepage or About Me text below."
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
                <PortraitEditor
                  siteId={id}
                  media={assets}
                  value={document.profile.portraitId}
                  editable={canEdit("profile.portraitId")}
                  uploadAllowed={admin || !demo}
                  demo={demo}
                  onSelect={(value) => profile("portraitId", value)}
                  onUploaded={async (portraitId) => {
                    await load();
                    // Keep edits made while the image was uploading.
                    setDocument((current) =>
                      current
                        ? {
                            ...current,
                            profile: { ...current.profile, portraitId },
                          }
                        : current,
                    );
                    setDirty(true);
                    feedback.setMessage("");
                  }}
                />
                {assetSelect("Curriculum vitae", "cvId", "application/pdf")}
                {admin && assetSelect("Website logo", "logoId", "image/")}
                {admin &&
                  (
                    [
                      [
                        "heroBadge",
                        "Homepage badge (profession or research topics)",
                        200,
                      ],
                      ["heroHeadline", "Homepage heading", 200],
                      ["heroIntro", "Homepage introduction", 10000],
                      ["aboutHeadline", "About Me heading", 200],
                      ["aboutBio", "About Me biography", 10000],
                      ["collaborationNote", "Collaboration note", 1000],
                      ["contactHeading", "Contact heading", 200],
                      ["contactIntro", "Contact introduction", 1000],
                      ["officeHours", "Office hours", 2000],
                      ["mailingAddress", "Mailing address", 2000],
                      ["contactQuote", "Contact closing quote", 2000],
                    ] as const
                  ).map(([key, label, limit]) => (
                    <div className="full-span" key={key}>
                      <Field label={label}>
                        <textarea
                          rows={key === "aboutBio" ? 7 : 2}
                          maxLength={limit}
                          value={document.profile[key] || ""}
                          onChange={(event) => profile(key, event.target.value)}
                        />
                      </Field>
                    </div>
                  ))}
                {admin && (
                  <label className="check-row full-span">
                    <input
                      type="checkbox"
                      checked={document.profile.showAffiliation === true}
                      onChange={(event) =>
                        profile("showAffiliation", event.target.checked)
                      }
                    />
                    Show university or organization affiliation on public
                    profile panels
                  </label>
                )}
                {admin &&
                  (["portraitPositionX", "portraitPositionY"] as const).map(
                    (key) => (
                      <Field
                        key={key}
                        label={
                          key === "portraitPositionX"
                            ? "Portrait crop: horizontal position"
                            : "Portrait crop: vertical position"
                        }
                      >
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={document.profile[key] ?? 50}
                          onChange={(event) =>
                            profile(key, Number(event.target.value))
                          }
                        />
                      </Field>
                    ),
                  )}
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
                        { label: "Website", url: "" },
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
                <div
                  className="profile-link-row customizable-profile-link"
                  key={index}
                >
                  <Field label="Button label">
                    <input
                      list="social-platform-labels"
                      value={link.label}
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
                  <Field label="Icon">
                    <select
                      value={link.icon || "auto"}
                      disabled={!canEdit("profile.links")}
                      onChange={(event) =>
                        profile(
                          "links",
                          document.profile.links.map((l, i) =>
                            i === index
                              ? {
                                  ...l,
                                  icon: event.target.value as typeof link.icon,
                                }
                              : l,
                          ),
                        )
                      }
                    >
                      {[
                        "auto",
                        "scholar",
                        "website",
                        "orcid",
                        "twitter",
                        "github",
                        "linkedin",
                        "mail",
                        "link",
                        "none",
                      ].map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label>
                    <input
                      type="checkbox"
                      checked={link.showInHero !== false}
                      disabled={!canEdit("profile.links")}
                      onChange={(event) =>
                        profile(
                          "links",
                          document.profile.links.map((l, i) =>
                            i === index
                              ? { ...l, showInHero: event.target.checked }
                              : l,
                          ),
                        )
                      }
                    />{" "}
                    Show in homepage hero
                  </label>
                  {canEdit("profile.links") && index > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const links = [...document.profile.links];
                        [links[index - 1], links[index]] = [
                          links[index],
                          links[index - 1],
                        ];
                        profile("links", links);
                      }}
                    >
                      Move up
                    </Button>
                  )}
                  <div className="profile-link-url">
                    <Field
                      label="URL"
                      hint={
                        invalidLink === index &&
                        !profileLinkUrlSchema.safeParse(link.url).success
                          ? "Enter a valid website address, or leave this URL blank."
                          : "You can paste a full URL or an address such as linkedin.com/in/name."
                      }
                    >
                      <input
                        type="text"
                        inputMode="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="https://example.com/profile"
                        data-profile-link={index}
                        aria-invalid={
                          invalidLink === index &&
                          !profileLinkUrlSchema.safeParse(link.url).success
                        }
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
              <datalist id="social-platform-labels">
                {socialPlatforms.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
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
              <p style={{ overflowWrap: "anywhere" }}>
                {data.publishedUrl || `/portfolio/${data.site.slug}`}
              </p>
              {data.site.published_release_id ? (
                <a
                  className="inline-link"
                  href={data.publishedUrl || `/portfolio/${data.site.slug}`}
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
      </div>
      {tab === "sections" && (
        <SectionsEditor
          sections={orderSections(
            document.sections.filter(
              (s) => !["publications", "articles"].includes(s.type),
            ),
            document.navigation.sectionOrder,
          )}
          types={sectionTypes.filter(
            (type) => !["publications", "articles"].includes(type),
          )}
          order={document.navigation.sectionOrder || "academic"}
          placement={document.navigation.layout !== "single"}
          onChange={(sections, sectionOrder) =>
            change({
              ...document,
              sections: admin
                ? replaceSectionGroup(
                    document.sections,
                    sections,
                    (s) => !["publications", "articles"].includes(s.type),
                  )
                : document.sections.map(
                    (section) =>
                      sections.find((next) => next.id === section.id) ||
                      section,
                  ),
              navigation: {
                ...document.navigation,
                ...(sectionOrder ? { sectionOrder } : {}),
              },
            })
          }
          media={assets}
          admin={admin}
          allowed={data.site.editable_fields}
        />
      )}
      {(tab === "publications" || tab === "articles") && (
        <PublicationsEditor
          type={tab === "articles" ? "articles" : "publications"}
          document={document}
          onChange={change}
          media={assets}
          admin={admin}
          allowed={data.site.editable_fields}
          onFiles={() => selectTab("media")}
        />
      )}
      {tab === "pages" && admin && (
        <>
          <PagePlanner document={document} onChange={change} />
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
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Remove page?",
                        description: `“${page.title || "Untitled page"}” and its sections will be removed from this draft. Published pages remain unchanged until you publish again.`,
                        confirmLabel: "Remove page",
                        destructive: true,
                      })
                    )
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
      {tab === "seo" && admin && (
        <>
          <section className="panel">
            <h2>Help the right people find this work.</h2>
            <p className="panel-description">
              Search titles, descriptions, sharing images, page addresses and
              sitemaps are prepared automatically. You can leave these settings
              as they are.
            </p>
            <div className="search-preview">
              <span>Search result preview</span>
              <h3>{portfolioTabTitle(document)}</h3>
              <p>{seoPreview.description}</p>
            </div>
            <details className="seo-overrides">
              <summary>Customize search & sharing (optional)</summary>
              <div className="form-grid">
                <div className="full-span">
                  <Field
                    label="Social sharing title"
                    hint="Optional link preview title. Browser tabs always follow the current researcher and page."
                  >
                    <input
                      maxLength={160}
                      placeholder={seoPreview.title}
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
                      placeholder={seoPreview.description}
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
                    <option value="">Automatic — profile portrait</option>
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
                  Allow search engines to find the published website
                </label>
              </div>
            </details>
          </section>
          <section className="panel">
            <details className="seo-overrides">
              <summary>Customize navigation & footer (optional)</summary>
              <p className="panel-description">
                Personalize the visible header, buttons, and footer.
              </p>
              <div className="form-grid">
                {(
                  [
                    "siteTitle",
                    "contactLabel",
                    "cvLabel",
                    "mobileCvLabel",
                    "footer",
                    "copyright",
                  ] as const
                ).map((key) => (
                  <Field
                    key={key}
                    label={
                      {
                        siteTitle: "Header title",
                        contactLabel: "Contact button",
                        cvLabel: "CV button",
                        mobileCvLabel: "Mobile CV button",
                        footer: "Footer text",
                        copyright:
                          "Copyright line (leave blank for automatic year and name)",
                      }[key]
                    }
                  >
                    <input
                      value={document.navigation[key] ?? ""}
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
              <h3>Footer links</h3>
              {(document.navigation.footerLinks || []).map((link, index) => (
                <div className="form-grid" key={index}>
                  {(["label", "url"] as const).map((key) => (
                    <Field
                      key={key}
                      label={key === "label" ? "Link text" : "Link URL"}
                    >
                      <input
                        value={link[key]}
                        onChange={(event) =>
                          change({
                            ...document,
                            navigation: {
                              ...document.navigation,
                              footerLinks: (
                                document.navigation.footerLinks || []
                              ).map((item, i) =>
                                i === index
                                  ? { ...item, [key]: event.target.value }
                                  : item,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      change({
                        ...document,
                        navigation: {
                          ...document.navigation,
                          footerLinks: document.navigation.footerLinks?.filter(
                            (_, i) => i !== index,
                          ),
                        },
                      })
                    }
                  >
                    Remove footer link
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                disabled={(document.navigation.footerLinks?.length || 0) >= 8}
                onClick={() =>
                  change({
                    ...document,
                    navigation: {
                      ...document.navigation,
                      footerLinks: [
                        ...(document.navigation.footerLinks || []),
                        { label: "", url: "" },
                      ],
                    },
                  })
                }
              >
                Add footer link
              </Button>
            </details>
          </section>
        </>
      )}
      {tab === "seo" && admin && (
        <section className="panel">
          <details className="seo-overrides">
            <summary>Customize website wording (optional)</summary>
            <p className="panel-description">
              Edit public buttons, form labels, and messages. These labels also
              support translating the portfolio.
            </p>
            <div className="form-grid">
              {(
                Object.keys(
                  defaultLabels,
                ) as (keyof PortfolioDocument["labels"])[]
              ).map((key) => (
                <Field
                  key={key}
                  label={key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase())}
                >
                  <input
                    value={document.labels[key] ?? defaultLabels[key]}
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
          </details>
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
              <small>
                DOC, DOCX, PDF, JPG, PNG, or WebP · up to {demo ? 5 : 20} MB per
                file. Word articles become downloadable PDFs.
              </small>
              <div
                style={{
                  maxWidth: 340,
                  margin: "15px auto",
                  textAlign: "left",
                }}
              >
                <Field
                  label="Document purpose"
                  hint="Server AI summarizes article uploads automatically. Browser AI requires the checkbox below. Images never trigger AI."
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
                accept={
                  admin
                    ? ".doc,.docx,.pdf,.jpg,.jpeg,.png,.webp"
                    : ".pdf,.jpg,.jpeg,.png,.webp"
                }
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
                      const { message } = await ai.run(
                        result.id,
                        "abstract",
                        true,
                      );
                      await load();
                      feedback.setMessage(message);
                      return;
                    }
                    feedback.setMessage(
                      result.summaryQueued
                        ? "Article uploaded. AI is extracting editable details and an abstract."
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
          {admin && aiProvider === "gemini" && (
            <Notice
              tone="info"
              message="AI sends documents to Google Gemini. Use sample or redacted documents on the free tier; its terms allow content to be used to improve Google's products. Free quotas and model availability depend on your Google project."
            />
          )}
          {admin && !aiEnabled && (
            <Notice
              tone="info"
              message="Enable free browser AI or configure a server AI provider to generate research summaries. You can add original abstracts manually now."
            />
          )}
          <div className="file-list">
            {assets.map((file) => (
              <div key={file.id}>
                {admin && file.article_assets && (
                  <p className="panel-description">
                    {file.article_assets.imageIds.length} extracted images.{" "}
                    {file.article_assets.warnings.join(" ")}
                  </p>
                )}
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
                      disabled={extracting(file) || feedback.busy}
                      onClick={() => addArticle(file)}
                    >
                      Add article draft
                    </Button>
                  )}
                  {admin && file.mime === "application/pdf" && (
                    <Button
                      variant="secondary small"
                      disabled={!aiEnabled || feedback.busy}
                      onClick={() =>
                        void feedback.run(async () => {
                          const { message } = await ai.run(
                            file.id,
                            "abstract",
                            browserAi,
                          );
                          await load();
                          feedback.setMessage(message);
                        })
                      }
                    >
                      <Sparkles size={13} /> Extract details & abstract
                    </Button>
                  )}
                  {admin && (
                    <button
                      className="icon-button"
                      aria-label={`Delete ${file.filename}`}
                      disabled={feedback.busy}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Delete this file?",
                            description: `“${file.filename}” will be permanently removed from the media library. Copies in published releases remain available.`,
                            confirmLabel: "Delete file",
                            destructive: true,
                          })
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
                {extracting(file) && (
                  <Notice
                    tone="info"
                    message="Extracting article details. Wait for completion before adding the draft."
                  />
                )}
                {file.article_metadata?.warnings.map((warning, index) => (
                  <Notice key={index} tone="info" message={warning} />
                ))}
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
                        disabled={extracting(file) || feedback.busy}
                        onClick={() => addArticle(file)}
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
                {readiness.length > 0 ? (
                  <div className="publish-checklist" role="status">
                    <strong>
                      Complete these required details before publishing
                    </strong>
                    <ul>
                      {readiness.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                    <Button
                      variant="secondary small"
                      onClick={() => selectTab("sections")}
                    >
                      Review academic details
                    </Button>
                  </div>
                ) : (
                  <Notice
                    tone="success"
                    message="Required details are complete. Review your preview before publishing."
                  />
                )}
                <p className="panel-description">
                  Preview the website and review the changes below. Publishing
                  makes this version available to visitors.
                </p>
              </div>
              <Button
                busy={feedback.busy}
                disabled={
                  readiness.length > 0 ||
                  data.jobs.some(
                    (j) =>
                      j.kind === "publish" &&
                      ["queued", "running"].includes(j.status),
                  )
                }
                onClick={() =>
                  void feedback.run(async () => {
                    const revision = dirty ? await save() : data.site.revision;
                    await api(`sites/${id}/publish`, {
                      method: "POST",
                      body: JSON.stringify({ revision }),
                    });
                    await load();
                  }, "Publishing has started. The current website remains available until the new release is ready.")
                }
              >
                <Globe size={15} />{" "}
                {dirty ? "Save and publish draft" : "Publish approved draft"}
              </Button>
            </div>
            {dirty && (
              <Notice
                tone="info"
                message="Publishing will first save your current edits, then publish the approved draft."
              />
            )}
            {data.site.published_release_id && (
              <a
                className="guide-link"
                href={data.publishedUrl || `/portfolio/${data.site.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View published portfolio <ExternalLink size={13} />
              </a>
            )}
          </section>
          <section className="panel">
            <h2>Website address</h2>
            <p className="panel-description">
              Connect a personal domain and choose the public address for this
              portfolio.
            </p>
            <p className="domain-suggestion">
              Suggested domain:{" "}
              <strong>
                {suggestedPortfolioDomain(
                  document.profile.name,
                  data.site.slug,
                )}
              </strong>
              . Register the domain separately, then connect it under Website
              address. This is a naming suggestion; availability has not been
              checked.
            </p>
            <Button variant="secondary" onClick={() => selectTab("address")}>
              Manage website address
            </Button>
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
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Restore this release?",
                          description: `Revision ${release.revision} will become the live website. Your current editing draft will be kept.`,
                          confirmLabel: "Restore release",
                        })
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
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Take this portfolio offline?",
                        description:
                          "Visitors will no longer be able to open this portfolio once cached pages expire. Your content and release history stay in the workspace.",
                        confirmLabel: "Unpublish portfolio",
                        destructive: true,
                      })
                    )
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
      {tab === "address" && admin && (
        <DomainManager
          siteId={id}
          slug={data.site.slug}
          publishedUrl={data.publishedUrl}
          onReview={() => selectTab("publish")}
          suggestedDomain={suggestedPortfolioDomain(
            document.profile.name,
            data.site.slug,
          )}
          onPendingChange={setAddressDirty}
        />
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
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Restore this draft?",
                            description: `Revision ${revision.revision} will be copied into a new draft revision. The live website will stay as it is.`,
                            confirmLabel: "Restore draft",
                          })
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
      {admin && currentStep >= 0 && currentStep < portfolioSteps.length - 1 && (
        <div className="workflow-continue">
          <div>
            <strong>Next: {portfolioSteps[currentStep + 1][1]}</strong>
            <p>Your content stays together as you move through the steps.</p>
          </div>
          <Button
            aria-label={`${dirty ? "Save & continue" : "Continue"} to ${portfolioSteps[currentStep + 1][1]}`}
            busy={feedback.busy}
            onClick={() =>
              void feedback.run(async () => {
                if (dirty) await save();
                selectTab(portfolioSteps[currentStep + 1][0]);
                window.scrollTo({ top: 0, behavior: "instant" });
              })
            }
          >
            {dirty ? "Save & continue" : "Continue"}{" "}
            <span aria-hidden="true">→</span>
          </Button>
        </div>
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
        Administrators always control publishing, pages, and permissions.
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
