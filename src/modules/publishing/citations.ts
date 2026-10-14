import type { Entry } from "@/modules/portfolios/schema";
export const citationStyles = [
  "APA",
  "IEEE",
  "Harvard",
  "MLA",
  "Chicago",
  "Vancouver",
  "BibTeX",
  "RIS",
] as const;
export type CitationStyle = (typeof citationStyles)[number];
export function authorNames(authors: string) {
  return authors
    .split(authors.includes(";") ? ";" : ",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function nameParts(name: string) {
  if (name.includes(",")) {
    const [family, ...given] = name.split(",");
    return { family: family.trim(), given: given.join(" ").trim() };
  }
  const words = name.trim().split(/\s+/);
  return { family: words.pop() || "", given: words.join(" ") };
}
export function articleCitation(
  entry: Entry,
  url: string,
  style: CitationStyle,
) {
  const names = authorNames(entry.authors),
    year = entry.start.slice(0, 4) || "n.d.";
  const initials = names.map((name) => {
    const p = nameParts(name);
    return `${p.family}${
      p.given
        ? `, ${p.given
            .split(/\s+/)
            .map((x) => x[0] + ".")
            .join(" ")}`
        : ""
    }`;
  });
  const ieee = names.map((name) => {
    const p = nameParts(name);
    return `${p.given
      .split(/\s+/)
      .filter(Boolean)
      .map((x) => x[0] + ".")
      .join(" ")} ${p.family}`.trim();
  });
  const source = entry.journal || entry.subtitle;
  const locator = entry.doi
    ? `https://doi.org/${entry.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`
    : url;
  const venue = [
    source,
    entry.volume
      ? `${entry.volume}${entry.issue ? `(${entry.issue})` : ""}`
      : entry.issue
        ? `Issue ${entry.issue}`
        : "",
    entry.pages,
  ]
    .filter(Boolean)
    .join(", ");
  const join = (values: string[], conjunction: string) =>
    values.length < 2
      ? values[0] || ""
      : values.slice(0, -1).join(", ") + conjunction + values.at(-1);
  const safe = (value: string) =>
    value.replace(/[{}\\]/g, "").replace(/[\r\n]/g, " ");
  if (style === "BibTeX")
    return `@${source ? "article" : "misc"}{article_${entry.id.replace(/-/g, "")},\n${Object.entries(
      {
        title: entry.title,
        author: names.join(" and "),
        year: entry.start.slice(0, 4),
        journal: source,
        volume: entry.volume,
        number: entry.issue,
        pages: entry.pages,
        doi: entry.doi,
        url,
      },
    )
      .filter(([, v]) => v)
      .map(([k, v]) => `  ${k} = {${safe(v!)}},`)
      .join("\n")}\n}`;
  if (style === "RIS")
    return [
      "TY  - " + (source ? "JOUR" : "GEN"),
      ...names.map((x) => "AU  - " + safe(x)),
      "TI  - " + safe(entry.title),
      entry.start ? "PY  - " + entry.start : "",
      source ? "JO  - " + safe(source) : "",
      entry.doi ? "DO  - " + safe(entry.doi) : "",
      "UR  - " + url,
      "ER  -",
    ]
      .filter(Boolean)
      .join("\n");
  if (style === "APA")
    return `${initials.length ? join(initials, ", & ").replace(/\.$/, "") + ". " : ""}(${year}). ${entry.title}.${venue ? " " + venue + "." : ""} ${locator}`;
  if (style === "IEEE")
    return `${ieee.length ? join(ieee, ", and ") + ", " : ""}“${entry.title},” ${venue ? venue + ", " : ""}${year}. [Online]. Available: ${locator}`;
  if (style === "Harvard")
    return `${initials.length ? join(initials, " and ") + " " : ""}(${year}) ‘${entry.title}’.${venue ? " " + venue + "." : ""} Available at: ${locator}`;
  if (style === "MLA")
    return `${names.length ? nameParts(names[0]).family + (nameParts(names[0]).given ? ", " + nameParts(names[0]).given : "") + (names.length > 2 ? ", et al." : names.length === 2 ? ", and " + names[1] : "") + ". " : ""}“${entry.title}.” ${venue ? venue + ", " : ""}${year}, ${locator}.`;
  if (style === "Chicago")
    return `${names.length ? join(names, ", and ") + ". " : ""}“${entry.title}.” ${venue ? venue + " " : ""}(${year}). ${locator}.`;
  return `${initials.length ? initials.join(", ").replace(/, ([A-Z])\./g, " $1") + ". " : ""}${entry.title}. ${source ? source + ". " : ""}${year}${entry.volume ? ";" + entry.volume : ""}${entry.issue ? "(" + entry.issue + ")" : ""}${entry.pages ? ":" + entry.pages : ""}. ${locator}`;
}
