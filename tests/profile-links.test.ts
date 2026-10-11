import { describe, expect, it } from "vitest";
import {
  documentSchema,
  emptyDocument,
  profileLinkUrlSchema,
} from "../src/modules/portfolios/schema";

describe("profile link draft validation", () => {
  it.each([
    [" linkedin.com/in/researcher ", "https://linkedin.com/in/researcher"],
    ["www.example.org", "https://www.example.org"],
    [
      "scholar.google.com/citations?user=abc&hl=en",
      "https://scholar.google.com/citations?user=abc&hl=en",
    ],
    [
      "https://orcid.org/0000-0001-2345-6789",
      "https://orcid.org/0000-0001-2345-6789",
    ],
    ["HTTP://example.org/profile", "HTTP://example.org/profile"],
    ["   ", ""],
  ])(
    "saves and normalizes %s without losing other draft edits",
    (input, expected) => {
      const draft = emptyDocument("Researcher");
      draft.profile.links = [{ label: "Research profile", url: input }];
      draft.theme.style = "noir";
      const saved = documentSchema.parse(draft);
      expect(saved.profile.links[0].url).toBe(expected);
      expect(saved.theme.style).toBe("noir");
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "mailto:person@example.org",
    "ftp://example.org",
    "not a link",
    "https://",
    "https:/example.org",
    "https://example.org/a b",
    "https://user:password@example.org",
    "//example.org",
    `https://example.org/${"x".repeat(2000)}`,
  ])("rejects %s with a single useful error", (value) => {
    const result = profileLinkUrlSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].message).toContain(
        "Enter a website address",
      );
    }
  });
});
