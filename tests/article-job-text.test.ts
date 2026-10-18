import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";

const { query, generate } = vi.hoisted(() => ({
  query: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: async () => ({
    query,
    transaction: async (run: (tx: { query: typeof query }) => unknown) =>
      run({ query }),
  }),
}));
vi.mock("@/lib/storage", () => ({
  getObject: () => readFile("tests/fixtures/article-paragraphs-docx.pdf"),
}));
vi.mock("@/modules/ai/config", () => ({
  aiConfig: () => ({ server: true, provider: "gemini" }),
}));
vi.mock("@/modules/ai/gemini", () => ({ generateWithGemini: generate }));
import { generateArticle } from "../src/modules/jobs/article";
import { articleContent } from "../src/modules/media/article-content";

it("retains source paragraph gaps when the metadata job updates an uploaded article", async () => {
  query.mockImplementation(async (sql: string) =>
    sql.startsWith("SELECT storage_key")
      ? [
          {
            storage_key: "synthetic",
            mime: "application/pdf",
            filename: "test.pdf",
          },
        ]
      : [{ id: "test-job" }],
  );
  generate.mockResolvedValue({
    title: "Test",
    authors: "",
    date: "",
    abstract: "A proposed summary",
    abstractSource: "generated",
    keywords: [],
    warnings: [],
  });
  await generateArticle({
    id: "test-job",
    site_id: "test-site",
    lease_id: "lease",
    payload: { mediaId: "test-media" },
  });
  const update = query.mock.calls.find(([sql]) =>
    sql.startsWith("UPDATE media"),
  );
  expect(update).toBeDefined();
  const source = update![1][0] as string;
  expect(articleContent(source).body).toContain(
    "publication date.\n\nThis is the second body paragraph.",
  );
  const metadata = JSON.parse(update![1][1]);
  expect(metadata.abstractSource).toBe("original");
  expect(metadata.authors).toBe("Alex Example; Jamie Example");
  expect(metadata.date).toBe("2025-02-09");
  expect(
    query.mock.calls.some(([sql]) =>
      /UPDATE (?:sites|drafts|releases)/.test(sql),
    ),
  ).toBe(false);
});
