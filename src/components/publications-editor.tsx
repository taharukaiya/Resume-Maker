"use client";
import type { PortfolioDocument, Section } from "@/modules/portfolios/schema";
import type { Media } from "@/modules/media/service";
import { SectionsEditor } from "./section-editor";
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
}: {
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
      sections={sections.filter((section) => section.type === "publications")}
      types={["publications"]}
      onChange={(next) => onUpdate(replacePublications(sections, next))}
      media={media}
      admin={admin}
      allowed={customPage && !admin ? [] : allowed}
    />
  );
  return (
    <div className="stack">
      <section className="panel spread wrap">
        <div>
          <p className="eyebrow">Research, made discoverable</p>
          <h2>Publications & articles</h2>
          <p className="panel-description">
            Add titles, authors, dates and abstracts. Each paper receives its
            own public page. Papers are optional; only include work the
            researcher has actually authored.
          </p>
        </div>
        <Button variant="secondary" onClick={onFiles}>
          Upload a paper / generate summary
        </Button>
      </section>
      {editor(document.sections, (sections) =>
        onChange({ ...document, sections }),
      )}
      {document.pages
        .filter((page) =>
          page.sections.some((section) => section.type === "publications"),
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
