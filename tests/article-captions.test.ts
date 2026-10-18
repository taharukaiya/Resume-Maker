import { expect, it } from "vitest";
import {
  emptyDocument,
  emptyEntry,
  entrySchema,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";
import { shibaDocument } from "../src/modules/publishing/shiba";

it("renders an editable cover caption safely without duplicating gallery images", () => {
  const entry = entrySchema.parse({
    ...emptyEntry(),
    title: "Caption test",
    body: "An abstract.",
    coverId: crypto.randomUUID(),
    coverCaption: "Photo by <Alex> & Jamie",
  });
  const doc = emptyDocument("Test author");
  doc.sections = [
    {
      id: crypto.randomUUID(),
      type: "articles",
      title: "Articles",
      intro: "",
      visible: true,
      entries: [entry],
    },
  ];
  const render = () =>
    renderPortfolio(shibaDocument(doc), {
      baseUrl: "https://test.example",
      siteId: crypto.randomUUID(),
      agencyName: "Test",
      appUrl: "https://studio.example",
      asset: (id) => `/assets/${id}.webp`,
    })[`article/${entry.id}/index.html`];
  expect(render()).toContain(
    "<figcaption>Photo by &lt;Alex&gt; &amp; Jamie</figcaption>",
  );
  entry.images = [
    {
      mediaId: entry.coverId!,
      alt: "A reviewed image",
      caption: "Reviewed gallery caption",
    },
  ];
  expect(render()).not.toContain("<figcaption>Photo by");
  expect(
    render().match(/<figcaption>Reviewed gallery caption<\/figcaption>/g),
  ).toHaveLength(1);
  entry.display = { images: false };
  expect(render()).not.toContain("<figcaption>");
  expect(entrySchema.parse(emptyEntry()).coverCaption).toBeUndefined();
});
