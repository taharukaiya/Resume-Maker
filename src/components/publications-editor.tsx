"use client";
import type { ArticleImageUpload } from "./article-image-upload";
import type { PortfolioDocument, Section } from "@/modules/portfolios/schema";
import type { Media } from "@/modules/media/service";
import { SectionsEditor } from "./section-editor";
import { replaceSectionGroup } from "@/modules/portfolios/structure";
import { Button } from "./ui";

/** Replace only publication sections; keep all other content and identities. */
export function replacePublications(
  sections: Section[],
  publications: Section[],
) {
  const remaining = [...publications];
  const merged = sections.flatMap((section) => {
    if (section.type !== "publications") return [section];
    const next = remaining.shift();
    return next ? [next] : [];
  });
  return [...merged, ...remaining];
}

export function PublicationsEditor({
  document,
  onChange,
  media,
  admin,
  allowed,
  onFiles,
  onUploadImage,
  type = "publications",
}: {
  onUploadImage?: ArticleImageUpload;
  type?: "publications" | "articles";
  document: PortfolioDocument;
  onChange: (doc: PortfolioDocument) => void;
  media: Media[];
  admin: boolean;
  allowed: string[];
  onFiles: () => void;
}) {
  const editor = (
    sections: Section[],
    onUpdate: (sections: Section[]) => void,
    customPage = false,
  ) => (
    <SectionsEditor
      sections={sections.filter((section) => section.type === type)}
      types={[type]}
      onChange={(next) =>
        onUpdate(
          replaceSectionGroup(
            sections,
            next,
            (section) => section.type === type,
          ),
        )
      }
      media={media}
      onUploadImage={onUploadImage}
      admin={admin}
      allowed={customPage && !admin ? [] : allowed}
    />
  );
  return (
    <div className="stack">
      <section className="panel spread wrap">
        <div>
          <p className="eyebrow">
            {type === "articles"
              ? "Article library"
              : "Research, made discoverable"}
          </p>
          <h2>{type === "articles" ? "Articles" : "Research publications"}</h2>
          <p className="panel-description">
            Upload a document to fill in its details, or add an entry manually
            below. Review the title, authors, date, abstract and images, then
            save your draft. Nothing goes live until you publish.
          </p>
        </div>
        <Button variant="secondary" onClick={onFiles}>
          Upload a document / extract details
        </Button>
      </section>

      {admin && (
        <details className="panel">
          <summary>Archive display</summary>
          <div className="form-grid">
            <label className="full-span">
              Trending topics (one per line)
              <textarea
                rows={4}
                value={document.navigation.trendingTopics?.join("\n") || ""}
                onChange={(event) =>
                  onChange({
                    ...document,
                    navigation: {
                      ...document.navigation,
                      trendingTopics: event.target.value.split("\n"),
                    },
                  })
                }
              />
            </label>
            <p className="panel-description full-span">
              Choose up to 50 topics. Match the tags saved on articles; clicking
              a topic filters the archive. Leave blank to use article tags
              automatically.
            </p>
            <label>
              Articles per page
              <input
                type="number"
                min={1}
                max={50}
                value={document.navigation.archivePageSize || 3}
                onChange={(event) =>
                  onChange({
                    ...document,
                    navigation: {
                      ...document.navigation,
                      archivePageSize: Math.max(
                        1,
                        Math.min(50, Number(event.target.value) || 3),
                      ),
                    },
                  })
                }
              />
            </label>
            <label>
              Default order
              <select
                value={document.navigation.archiveSort || "oldest"}
                onChange={(event) =>
                  onChange({
                    ...document,
                    navigation: {
                      ...document.navigation,
                      archiveSort: event.target.value as
                        "oldest" | "newest" | "cited" | "title",
                    },
                  })
                }
              >
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
                <option value="cited">Most cited</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
          <p className="panel-description">
            Shared by the Research and Article archives. Edit public headings
            and button text in Website wording.
          </p>
        </details>
      )}
      {admin && type === "articles" && (
        <section className="panel">
          <label className="check-row">
            <input
              type="checkbox"
              checked={document.navigation.articlesEnabled !== false}
              onChange={(event) =>
                onChange({
                  ...document,
                  navigation: {
                    ...document.navigation,
                    articlesEnabled: event.target.checked,
                  },
                })
              }
            />{" "}
            Show the Article page
          </label>
          <p className="panel-description">
            Turning this off hides articles and their navigation links on the
            next published release. Your drafts stay available here.
          </p>
        </section>
      )}
      {admin &&
        [
          ...document.sections,
          ...document.pages.flatMap((page) => page.sections),
        ].some((section) => section.type === type) && (
          <details className="panel editor-options">
            <summary>Move content between Research and Articles</summary>
            <p className="panel-description">
              Research and articles are separate. Moving a section preserves its
              entries, files and editable details.
            </p>
            <select
              aria-label="Move section to another collection"
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (!id) return;
                const target =
                  type === "articles" ? "publications" : "articles";
                const move = (sections: Section[]) =>
                  sections.map((section) =>
                    section.id === id
                      ? { ...section, type: target as Section["type"] }
                      : section,
                  );
                onChange({
                  ...document,
                  sections: move(document.sections),
                  pages: document.pages.map((page) => ({
                    ...page,
                    sections: move(page.sections),
                  })),
                });
              }}
            >
              <option value="">
                Move to {type === "articles" ? "Research" : "Articles"}…
              </option>
              {[
                ...document.sections,
                ...document.pages.flatMap((page) => page.sections),
              ]
                .filter((section) => section.type === type)
                .map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || "Untitled section"}
                  </option>
                ))}
            </select>
          </details>
        )}
      {editor(document.sections, (sections) =>
        onChange({ ...document, sections }),
      )}
      {document.pages
        .filter((page) =>
          page.sections.some((section) => section.type === type),
        )
        .map((page) => (
          <section key={page.id} className="panel">
            <h2>{page.title}</h2>
            {editor(
              page.sections,
              (sections) =>
                onChange({
                  ...document,
                  pages: document.pages.map((item) =>
                    item.id === page.id ? { ...item, sections } : item,
                  ),
                }),
              true,
            )}
          </section>
        ))}
    </div>
  );
}
