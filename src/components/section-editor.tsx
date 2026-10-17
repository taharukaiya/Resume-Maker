"use client";
import { useEffect, useState, type ReactNode } from "react";
import { citationStyles } from "@/modules/publishing/citations";
import { articleContent } from "@/modules/media/article-content";
import type { Media } from "@/modules/media/service";
import {
  type Entry,
  type Section,
  emptyEntry,
  sectionTypes,
} from "@/modules/portfolios/schema";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, Field } from "./ui";
import { useConfirmation } from "./confirmation";
import {
  orderSections,
  sectionDestination,
} from "@/modules/portfolios/structure";
export function SectionsEditor({
  sections,
  onChange,
  media,
  admin,
  allowed,
  order = "manual",
  placement = false,
  types = sectionTypes,
}: {
  sections: Section[];
  onChange: (sections: Section[], order?: "manual" | "academic") => void;
  media: Media[];
  admin: boolean;
  allowed: string[];
  order?: "academic" | "manual";
  placement?: boolean;
  types?: readonly Section["type"][];
}) {
  const confirm = useConfirmation();
  function update(index: number, next: Section) {
    onChange(sections.map((s, i) => (i === index ? next : s)));
  }
  function move(index: number, direction: number) {
    const next = [...sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, "manual");
  }
  return (
    <>
      <div className="section-title">
        <div>
          <h2>
            {types.length === 1 && types[0] === "articles"
              ? "Your articles"
              : types.length === 1 && types[0] === "publications"
                ? "Your research publications"
                : "Build the story."}
          </h2>
          <p className="panel-description" style={{ marginBottom: 0 }}>
            {types.length === 1 &&
            ["articles", "publications"].includes(types[0])
              ? "Search your collection below. Open optional publication settings only when needed."
              : order === "academic"
                ? "Education is required before publishing. Academic order keeps it ahead of interests; use the arrows to change the sequence."
                : "Use the arrows to arrange sections in your preferred sequence."}
          </p>
        </div>
        {admin && (
          <select
            aria-label="Add section"
            style={{ maxWidth: 200 }}
            value=""
            onChange={(e) => {
              const type = e.target.value as Section["type"];
              if (!type) return;
              onChange(
                orderSections(
                  [
                    ...sections,
                    {
                      id: crypto.randomUUID(),
                      type,
                      title: type[0].toUpperCase() + type.slice(1),
                      visible: true,
                      intro: "",
                      entries: [],
                    },
                  ],
                  order,
                ),
              );
            }}
          >
            <option value="">＋ Add a section</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type[0].toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>
      {admin && types.length !== 1 && (
        <div className="section-order-toolbar">
          <span>
            {sections.length} sections ·{" "}
            {order === "academic" ? "Academic order" : "Custom order"}
          </span>
          <Button
            variant="secondary small"
            onClick={() => onChange(orderSections(sections), "academic")}
          >
            Use academic order
          </Button>
        </div>
      )}
      {!sections.length && (
        <div className="empty-state">
          <h3>A story waiting to be told.</h3>
          <p>
            {admin
              ? "Add a section to start shaping this portfolio."
              : "Your administrator will add the sections for your portfolio."}
          </p>
        </div>
      )}
      {sections.map((section, index) => {
        const editable = admin || allowed.includes(`sections.${section.type}`);
        function change<K extends keyof Section>(key: K, value: Section[K]) {
          update(index, { ...section, [key]: value });
        }
        return (
          <details
            className="section-editor"
            key={section.id}
            open={sections.length === 1 ? true : undefined}
          >
            <summary>
              <span className="section-position">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{section.title || "Untitled section"}</strong>
              <span className="section-type">
                {editable ? section.type : "Admin controlled"}
              </span>
              {admin && (
                <span
                  className="section-controls"
                  onClick={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${section.title} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${section.title} down`}
                    disabled={index === sections.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${section.title}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Remove section?",
                          description: `“${section.title}” and its entries will be removed from this draft. Save the draft to apply this change.`,
                          confirmLabel: "Remove section",
                          destructive: true,
                        })
                      )
                        onChange(sections.filter((s) => s.id !== section.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </summary>
            <div className="section-editor-body">
              <div className="form-grid">
                {admin && placement && (
                  <Field
                    label="Display on page"
                    hint={`Automatic placement: ${sectionDestination({ ...section, destination: "auto" })}.`}
                  >
                    <select
                      value={section.destination || "auto"}
                      onChange={(e) =>
                        change(
                          "destination",
                          e.target.value as Section["destination"],
                        )
                      }
                    >
                      <option value="auto">
                        Automatic — based on section type
                      </option>
                      <option value="home">Home</option>
                      <option value="about">About</option>
                      <option value="research">Research</option>
                      <option value="contact">Contact</option>
                    </select>
                  </Field>
                )}
                <Field label="Section heading">
                  <input
                    value={section.title}
                    maxLength={200}
                    disabled={!editable}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </Field>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={section.visible}
                    disabled={!editable}
                    onChange={(e) => change("visible", e.target.checked)}
                  />{" "}
                  Show on the website
                </label>
                <div className="full-span">
                  <Field label="Introduction">
                    <textarea
                      rows={3}
                      value={section.intro}
                      maxLength={10000}
                      disabled={!editable}
                      onChange={(e) => change("intro", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              {section.type === "about" && (
                <p className="panel-description" style={{ marginTop: 15 }}>
                  The biography from Profile is displayed in this section.
                </p>
              )}
              {section.type === "contact" && (
                <p className="panel-description" style={{ marginTop: 15 }}>
                  Includes the public email address and a contact form that
                  delivers messages to your inbox.
                </p>
              )}
              <EntryCollection
                entries={section.entries}
                type={section.type}
                renderEntry={(entry, entryIndex) => (
                  <EntryEditor
                    key={entry.id}
                    entry={entry}
                    index={entryIndex}
                    type={section.type}
                    media={media}
                    editable={editable}
                    onChange={(next) =>
                      change(
                        "entries",
                        section.entries.map((item, i) =>
                          i === entryIndex ? next : item,
                        ),
                      )
                    }
                    onDelete={() =>
                      change(
                        "entries",
                        section.entries.filter((item) => item.id !== entry.id),
                      )
                    }
                    onMove={(direction) => {
                      const next = [...section.entries],
                        target = entryIndex + direction;
                      if (target < 0 || target >= next.length) return;
                      [next[entryIndex], next[target]] = [
                        next[target],
                        next[entryIndex],
                      ];
                      change("entries", next);
                    }}
                  />
                )}
              />
              {editable && !["about", "contact"].includes(section.type) && (
                <Button
                  variant="secondary small"
                  onClick={() =>
                    change(
                      "entries",
                      ["articles", "publications"].includes(section.type)
                        ? [emptyEntry(), ...section.entries]
                        : [...section.entries, emptyEntry()],
                    )
                  }
                >
                  <Plus size={13} /> Add{" "}
                  {["publications", "articles"].includes(section.type)
                    ? "publication"
                    : "entry"}
                </Button>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
}
function EntryCollection({
  entries,
  type,
  renderEntry,
}: {
  entries: Entry[];
  type: string;
  renderEntry: (entry: Entry, index: number) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    setQuery("");
    setPage(0);
    setMatchedIds(null);
  }, [entries.length]);
  if (!["articles", "publications"].includes(type))
    return <>{entries.map(renderEntry)}</>;
  const matches = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !matchedIds || matchedIds.has(entry.id));
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const current = Math.min(page, pages - 1);
  return (
    <div className="stack">
      <Field label="Find an article">
        <input
          type="search"
          value={query}
          placeholder="Search title, author, date or topic"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
            const text = event.target.value.toLocaleLowerCase().trim();
            // Keep matching editors mounted while their titles are being edited.
            setMatchedIds(
              text
                ? new Set(
                    entries
                      .filter((entry) =>
                        [
                          entry.title,
                          entry.authors,
                          entry.start,
                          entry.tags,
                          entry.category,
                        ]
                          .join(" ")
                          .toLocaleLowerCase()
                          .includes(text),
                      )
                      .map((entry) => entry.id),
                  )
                : null,
            );
          }}
        />
      </Field>
      <div className="row wrap">
        <span aria-live="polite">
          {matches.length} articles | Page {current + 1} of {pages}
        </span>
        <Button
          variant="secondary small"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous articles
        </Button>
        <Button
          variant="secondary small"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next articles
        </Button>
      </div>
      {matches
        .slice(current * 10, (current + 1) * 10)
        .map(({ entry, index }) => renderEntry(entry, index))}
      {!matches.length && <p>No matching articles.</p>}
    </div>
  );
}
function EntryEditor({
  entry,
  index,
  type,
  media,
  editable,
  onChange,
  onDelete,
  onMove,
}: {
  entry: Entry;
  index: number;
  type: string;
  media: Media[];
  editable: boolean;
  onChange: (entry: Entry) => void;
  onDelete: () => void;
  onMove: (direction: number) => void;
}) {
  const confirm = useConfirmation();
  const [bodyBeforeCleanup, setBodyBeforeCleanup] = useState<string | null>(
    null,
  );
  const [bodyCleanupPreview, setBodyCleanupPreview] = useState<string | null>(
    null,
  );
  function change<K extends keyof Entry>(key: K, value: Entry[K]) {
    onChange({ ...entry, [key]: value });
  }
  return (
    <details
      className="entry-editor"
      open={
        !["articles", "publications"].includes(type) ||
        index === 0 ||
        !entry.title
      }
    >
      <summary className="spread" style={{ marginBottom: 15 }}>
        <h4>{entry.title || `Entry ${index + 1}`}</h4>
        {editable && (
          <div className="row" onClick={(event) => event.preventDefault()}>
            <button
              className="icon-button"
              aria-label="Move entry up"
              onClick={() => onMove(-1)}
            >
              <ChevronUp size={14} />
            </button>
            <button
              className="icon-button"
              aria-label="Move entry down"
              onClick={() => onMove(1)}
            >
              <ChevronDown size={14} />
            </button>
            <button
              className="icon-button"
              aria-label="Remove entry"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Remove entry?",
                    description: `Remove “${entry.title || "Untitled entry"}” from this draft? Save the draft to apply this change.`,
                    confirmLabel: "Remove entry",
                    destructive: true,
                  })
                )
                  onDelete();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </summary>
      <div className="form-grid">
        <div className="full-span">
          <Field
            label={
              ["publications", "articles"].includes(type)
                ? "Publication title *"
                : type === "education"
                  ? "Degree or qualification *"
                  : "Title *"
            }
          >
            <input
              required
              value={entry.title}
              maxLength={200}
              disabled={!editable}
              onChange={(e) => change("title", e.target.value)}
            />
          </Field>
        </div>
        <div className="full-span">
          <Field
            label={
              ["publications", "articles"].includes(type)
                ? "Journal or conference"
                : type === "education"
                  ? "Institution *"
                  : "Institution, organization, or subtitle"
            }
          >
            <input
              required={type === "education"}
              value={entry.subtitle}
              maxLength={200}
              disabled={!editable}
              onChange={(e) => change("subtitle", e.target.value)}
            />
          </Field>
        </div>
        <Field
          label={
            ["publications", "articles"].includes(type)
              ? "Publication date"
              : type === "education"
                ? "Start date *"
                : "Start date"
          }
          hint="YYYY, YYYY-MM, or YYYY-MM-DD"
        >
          <input
            required={type === "education"}
            value={entry.start}
            maxLength={10}
            disabled={!editable}
            onChange={(e) => change("start", e.target.value)}
          />
        </Field>
        {["publications", "articles"].includes(type) && (
          <Field
            label="Reading time (minutes)"
            hint="Leave blank to calculate automatically from the article text."
          >
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              placeholder="Automatic"
              value={entry.readingMinutes ?? ""}
              disabled={!editable}
              onChange={(event) =>
                change(
                  "readingMinutes",
                  event.target.value === ""
                    ? undefined
                    : event.target.valueAsNumber,
                )
              }
            />
          </Field>
        )}
        {!["publications", "articles"].includes(type) && (
          <>
            <Field
              label={type === "education" ? "End date *" : "End date"}
              hint={
                type === "education"
                  ? "Required unless this qualification is ongoing."
                  : "Leave blank for a single date."
              }
            >
              <input
                required={type === "education" && !entry.current}
                value={entry.end}
                maxLength={10}
                disabled={!editable || entry.current}
                onChange={(e) => change("end", e.target.value)}
              />
            </Field>
          </>
        )}
        {!["publications", "articles"].includes(type) && (
          <label className="check-row full-span">
            <input
              type="checkbox"
              checked={entry.current}
              disabled={!editable}
              onChange={(e) => change("current", e.target.checked)}
            />{" "}
            Currently ongoing
          </label>
        )}
        <div className="full-span">
          <Field
            label={
              ["publications", "articles"].includes(type)
                ? "Abstract or research summary"
                : "Description"
            }
            hint={
              ["publications", "articles"].includes(type) && !entry.body.trim()
                ? "No abstract yet. Upload and extract the original article, or enter its abstract here before publishing."
                : "Separate paragraphs with a blank line."
            }
          >
            <textarea
              rows={5}
              value={entry.body}
              maxLength={16000}
              disabled={!editable}
              onChange={(e) => change("body", e.target.value)}
            />
          </Field>
        </div>
        {["publications", "articles"].includes(type) && (
          <>
            <div className="full-span">
              <Field
                label="Authors"
                hint="Separate people with semicolons. Use Family, Given for precise citation names."
              >
                <input
                  value={entry.authors}
                  maxLength={1000}
                  disabled={!editable}
                  onChange={(e) => change("authors", e.target.value)}
                />
              </Field>
            </div>
            <details className="editor-options full-span">
              <summary>Publication details and citation information</summary>
              <p className="panel-description">
                Optional details such as journal, DOI and category. These
                improve citation accuracy.
              </p>
              <div className="form-grid">
                {" "}
                <Field
                  label="Author name format"
                  hint="Use semicolons between people. Select Family, Given when a name contains a comma."
                >
                  <select
                    disabled={!editable}
                    value={entry.authorFormat || "names"}
                    onChange={(event) =>
                      change(
                        "authorFormat",
                        event.target.value as "names" | "family-given",
                      )
                    }
                  >
                    <option value="names">Given Family</option>
                    <option value="family-given">Family, Given</option>
                  </select>
                </Field>
                <Field label="Publication status">
                  <select
                    value={entry.status}
                    disabled={!editable}
                    onChange={(e) =>
                      change("status", e.target.value as Entry["status"])
                    }
                  >
                    <option value="">No status label</option>
                    <option value="published">Published</option>
                    <option value="accepted">Accepted</option>
                    <option value="preprint">Preprint</option>
                    <option value="submitted">Submitted</option>
                    <option value="in-progress">In progress</option>
                  </select>
                </Field>
                <Field label="Abstract source">
                  <select
                    value={entry.abstractSource}
                    disabled={!editable}
                    onChange={(e) =>
                      change(
                        "abstractSource",
                        e.target.value as Entry["abstractSource"],
                      )
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="original">Author-written abstract</option>
                    <option value="generated">
                      AI-assisted research summary
                    </option>
                  </select>
                </Field>
                <div className="full-span">
                  <Field label="DOI">
                    <input
                      value={entry.doi}
                      maxLength={250}
                      disabled={!editable}
                      onChange={(e) => change("doi", e.target.value)}
                    />
                  </Field>
                </div>
                {(
                  [
                    ["category", "Category"],
                    ["journal", "Journal / publication venue"],
                    ["volume", "Volume"],
                    ["issue", "Issue"],
                    ["pages", "Page range"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={entry[key] || ""}
                      maxLength={
                        key === "category" || key === "journal" ? 200 : 80
                      }
                      disabled={!editable}
                      onChange={(event) => change(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </details>{" "}
            <details
              className="editor-options full-span article-body-editor"
              open
            >
              <summary>Read and edit the full article</summary>
              <p className="panel-description">
                Write the article body here. The abstract, authors and
                publication date have their own fields above.
              </p>
              <Field
                label="Full article text"
                hint="Article body only. Keep the title, authors, date and abstract in their separate fields. Review paragraphs before publishing."
              >
                <textarea
                  rows={12}
                  value={entry.fullText || ""}
                  maxLength={240000}
                  disabled={!editable}
                  onChange={(event) => change("fullText", event.target.value)}
                />
              </Field>
              {editable && (
                <div className="row">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setBodyCleanupPreview(
                        articleContent(entry.fullText || "", {
                          title: entry.title,
                          authors: entry.authors,
                          category: entry.category,
                          abstract: entry.body,
                        }).body,
                      )
                    }
                  >
                    Keep body only
                  </Button>
                  {bodyBeforeCleanup !== null && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        change("fullText", bodyBeforeCleanup);
                        setBodyBeforeCleanup(null);
                      }}
                    >
                      Undo body cleanup
                    </Button>
                  )}
                </div>
              )}
              {bodyCleanupPreview !== null && (
                <div className="panel">
                  <Field
                    label="Review body cleanup"
                    hint="Check the proposed body below. Your other fields stay as you entered them."
                  >
                    <textarea rows={12} value={bodyCleanupPreview} readOnly />
                  </Field>
                  <div className="row">
                    <Button
                      disabled={!editable}
                      onClick={() => {
                        setBodyBeforeCleanup(entry.fullText || "");
                        change("fullText", bodyCleanupPreview);
                        setBodyCleanupPreview(null);
                      }}
                    >
                      Use this body
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setBodyCleanupPreview(null)}
                    >
                      Cancel cleanup
                    </Button>
                  </div>
                </div>
              )}
            </details>
            <details className="full-span panel">
              <summary>Article display and citation controls</summary>
              <p className="panel-description">
                The downloadable PDF is generated from the saved article text
                and images. Review your edits before publishing the updated
                contents.
              </p>
              <div className="form-grid">
                {(
                  [
                    "abstract",
                    "fullText",
                    "images",
                    "author",
                    "citations",
                    "related",
                  ] as const
                ).map((key) => (
                  <label className="check-row" key={key}>
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={entry.display?.[key] !== false}
                      onChange={(event) =>
                        change("display", {
                          ...entry.display,
                          [key]: event.target.checked,
                        })
                      }
                    />
                    Show {key === "fullText" ? "full article text" : key}
                  </label>
                ))}
                <Field label="Cover image description">
                  <input
                    disabled={!editable}
                    value={entry.coverAlt || ""}
                    maxLength={500}
                    onChange={(event) => change("coverAlt", event.target.value)}
                  />
                </Field>
                {(["name", "affiliation", "bio"] as const).map((key) => (
                  <Field
                    key={key}
                    label={`Article author ${key}`}
                    hint="Leave blank to use the portfolio profile."
                  >
                    <textarea
                      disabled={!editable}
                      rows={key === "bio" ? 4 : 2}
                      maxLength={key === "bio" ? 16000 : 200}
                      value={entry.authorDetails?.[key] || ""}
                      onChange={(event) =>
                        change("authorDetails", {
                          name: "",
                          affiliation: "",
                          bio: "",
                          ...entry.authorDetails,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="panel-description">
                Citations use your saved authors, publication date, DOI and
                venue. Review each style. For special author names or publisher
                requirements, supply an exact citation below. Clear an override
                to restore automatic formatting.
              </p>
              {citationStyles.map((style) => (
                <Field key={style} label={`${style} citation override`}>
                  <textarea
                    rows={3}
                    maxLength={10000}
                    disabled={!editable}
                    value={entry.citationOverrides?.[style] || ""}
                    onChange={(event) =>
                      change("citationOverrides", {
                        ...entry.citationOverrides,
                        [style]: event.target.value,
                      })
                    }
                  />
                </Field>
              ))}
            </details>
            <Field label="Citation count">
              <input
                type="number"
                min="0"
                max="1000000000"
                value={entry.citationCount || 0}
                disabled={!editable}
                onChange={(event) =>
                  change("citationCount", Number(event.target.value))
                }
              />
            </Field>
            <Field label="Article cover">
              {entry.coverId && (
                <div className="stack">
                  <img
                    src={`/api/media/${entry.coverId}`}
                    alt={entry.coverAlt || "Article cover preview"}
                    style={{
                      maxWidth: 240,
                      maxHeight: 160,
                      objectFit: "cover",
                    }}
                  />
                  {editable && (
                    <Button
                      variant="secondary small"
                      onClick={() => change("coverId", "")}
                    >
                      Remove cover image
                    </Button>
                  )}
                </div>
              )}
              <select
                aria-label="Article cover"
                value={entry.coverId || ""}
                disabled={!editable}
                onChange={(event) => change("coverId", event.target.value)}
              >
                <option value="">No cover image</option>
                {media
                  .filter((file) => file.mime.startsWith("image/"))
                  .map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.filename}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="full-span stack">
              <h4>Article images</h4>
              <p className="panel-description">
                Review extracted figures. Replace images, edit descriptions and
                captions, or change their order. Upload additional images
                through the file library.
              </p>
              {(entry.images || []).map((image, imageIndex) => (
                <div className="panel" key={imageIndex}>
                  <img
                    src={`/api/media/${image.mediaId}`}
                    alt={image.alt || "Article figure preview"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: 160,
                      objectFit: "contain",
                    }}
                  />
                  <Field label={`Image ${imageIndex + 1}`}>
                    <select
                      disabled={!editable}
                      value={image.mediaId}
                      onChange={(event) =>
                        change(
                          "images",
                          (entry.images || []).map((item, i) =>
                            i === imageIndex
                              ? { ...item, mediaId: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      {media
                        .filter((file) => file.mime.startsWith("image/"))
                        .map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.filename}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Image description">
                    <input
                      maxLength={500}
                      disabled={!editable}
                      value={image.alt}
                      onChange={(event) =>
                        change(
                          "images",
                          (entry.images || []).map((item, i) =>
                            i === imageIndex
                              ? { ...item, alt: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Caption">
                    <textarea
                      maxLength={2000}
                      disabled={!editable}
                      value={image.caption}
                      onChange={(event) =>
                        change(
                          "images",
                          (entry.images || []).map((item, i) =>
                            i === imageIndex
                              ? { ...item, caption: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  {editable && (
                    <div className="row">
                      <Button
                        variant="secondary small"
                        disabled={!imageIndex}
                        onClick={() => {
                          const images = [...entry.images!];
                          [images[imageIndex - 1], images[imageIndex]] = [
                            images[imageIndex],
                            images[imageIndex - 1],
                          ];
                          change("images", images);
                        }}
                      >
                        Move image up
                      </Button>
                      <Button
                        variant="secondary small"
                        onClick={() =>
                          change(
                            "images",
                            entry.images!.filter((_, i) => i !== imageIndex),
                          )
                        }
                      >
                        Remove image from article
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {editable && (entry.images || []).length < 24 && (
                <Field label="Add an image">
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value)
                        change("images", [
                          ...(entry.images || []),
                          { mediaId: event.target.value, alt: "", caption: "" },
                        ]);
                    }}
                  >
                    <option value="">Choose an image</option>
                    {media
                      .filter((file) => file.mime.startsWith("image/"))
                      .map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.filename}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </div>
          </>
        )}
        <Field label="External link">
          <input
            type="url"
            value={entry.url}
            maxLength={2000}
            disabled={!editable}
            onChange={(e) => change("url", e.target.value)}
          />
        </Field>
        <Field label="Attached file">
          <select
            value={entry.mediaId}
            disabled={!editable}
            onChange={(e) => change("mediaId", e.target.value)}
          >
            <option value="">No file</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.filename}
              </option>
            ))}
          </select>
        </Field>
        <div className="full-span">
          <Field label="Keywords" hint="Separate keywords with commas.">
            <input
              value={entry.tags}
              maxLength={500}
              disabled={!editable}
              onChange={(e) => change("tags", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </details>
  );
}
