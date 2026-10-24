import { expect, it } from "vitest";
import {
  emptyDocument,
  emptyEntry,
  type Section,
} from "../src/modules/portfolios/schema";
import {
  profileCompletion,
  completionSummary,
} from "../src/modules/portfolios/profile-completion";

function section(type: Section["type"]): Section {
  return {
    id: crypto.randomUUID(),
    type,
    title: type,
    visible: true,
    intro: "",
    entries: [
      {
        ...emptyEntry(),
        title: "Work",
        subtitle: "University",
        start: "2020",
        end: "2024",
        authors: "Researcher",
        body: "Abstract",
        fullText: "Article paragraphs",
      },
    ],
  };
}
function completeDocument() {
  const doc = emptyDocument("Researcher");
  Object.assign(doc.profile, {
    headline: "Educator",
    bio: "Biography",
    portraitId: "photo",
    email: "researcher@example.com",
  });
  doc.sections = [
    section("education"),
    section("experience"),
    section("publications"),
    section("articles"),
  ];
  return doc;
}
it("returns compact list summaries using exactly the editor score", () => {
  const doc = completeDocument();
  expect(completionSummary(doc)).toEqual({
    percentage: 100,
    completed: 9,
    total: 9,
    missing: [],
  });
  doc.sections[3].entries[0].authors = "";
  const summary = completionSummary(doc);
  expect(summary.percentage).toBe(profileCompletion(doc).percentage);
  expect(summary.missing).toEqual([{ id: "articles", label: "Articles" }]);
  expect(JSON.stringify(summary)).not.toContain("Article paragraphs");
  expect(JSON.stringify(summary)).not.toContain("Abstract");
});
it("requires the whole portfolio instead of just profile basics", () => {
  const doc = completeDocument();
  expect(profileCompletion(doc).percentage).toBe(100);
  doc.sections = [];
  const result = profileCompletion(doc);
  expect(result.percentage).toBe(56);
  expect(result.checks.filter((c) => !c.complete).map((c) => c.label)).toEqual([
    "Education",
    "Experience",
    "Research publications",
    "Articles",
  ]);
  expect(profileCompletion(emptyDocument("Researcher")).percentage).toBe(11);
});
it("explains missing fields and links to the unfinished section, including custom pages", () => {
  const doc = completeDocument();
  const unfinished = section("articles");
  unfinished.entries[0].fullText = "  ";
  unfinished.entries[0].authors = "";
  doc.pages = [
    {
      id: "page",
      slug: "more",
      title: "More",
      description: "",
      sections: [unfinished],
    },
  ];
  const check = profileCompletion(doc).checks.find((c) => c.id === "articles")!;
  expect(check.complete).toBe(false);
  expect(check.detail).toContain("authors, article body");
  expect(check.target).toEqual({
    tab: "articles",
    pageId: "page",
    sectionId: unfinished.id,
  });
  const education = doc.sections.shift()!;
  doc.pages[0].sections.push(education);
  expect(
    profileCompletion(doc).checks.find((c) => c.id === "education")?.target,
  ).toEqual({ tab: "pages", pageId: "page", sectionId: education.id });
});
it("counts enabled optional sections and ignores hidden optional sections", () => {
  const doc = completeDocument();
  const skills = section("skills");
  skills.entries = [emptyEntry()];
  doc.sections.push(skills);
  expect(profileCompletion(doc).percentage).toBe(90);
  skills.visible = false;
  expect(profileCompletion(doc).percentage).toBe(100);
  doc.sections[0].visible = false;
  expect(
    profileCompletion(doc).checks.find((c) => c.id === "education")?.detail,
  ).toContain("hidden");
});
it("rejects empty entries, missing dates, invalid date ranges and invalid contact information", () => {
  const doc = completeDocument();
  doc.sections[0].entries.push(emptyEntry());
  doc.sections[1].entries[0].end = "2019";
  doc.profile.email = "invalid";
  doc.profile.links = [{ label: "Bad", url: "javascript:alert(1)" }];
  const checks = profileCompletion(doc).checks;
  expect(checks.find((c) => c.id === "education")?.detail).toContain(
    "title, institution, start date, end date",
  );
  expect(checks.find((c) => c.id === "experience")?.detail).toContain(
    "valid date range",
  );
  expect(checks.find((c) => c.id === "profile-email")?.complete).toBe(false);
});
it("supports ongoing education, profile-powered about/contact and unfinished custom pages", () => {
  const doc = completeDocument();
  doc.sections[0].entries[0].end = "";
  doc.sections[0].entries[0].current = true;
  for (const type of ["about", "contact"] as const)
    doc.sections.push({ ...section(type), entries: [] });
  expect(profileCompletion(doc).percentage).toBe(100);
  doc.pages.push({
    id: "empty",
    title: "Extra",
    slug: "extra",
    description: "",
    sections: [],
  });
  expect(profileCompletion(doc).checks.at(-1)?.target).toEqual({
    tab: "pages",
    pageId: "empty",
  });
  expect(profileCompletion(doc).percentage).toBeLessThan(100);
});
