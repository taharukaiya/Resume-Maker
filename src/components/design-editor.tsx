"use client";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
export function DesignEditor({
  document: _document,
  onChange: _onChange,
}: {
  document: PortfolioDocument;
  onChange: (doc: PortfolioDocument) => void;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Portfolio design</p>
      <h2>The Shiba design</h2>
      <p>
        Every portfolio uses the same white and blue layout, Inter headings,
        Merriweather article text, portrait introduction, research archive, and
        article pages. Content, article visibility, and profile details remain
        editable. Save and preview to see the design with this researcher's
        content.
      </p>
    </section>
  );
}
