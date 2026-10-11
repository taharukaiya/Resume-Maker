import { fonts, fontFaceCss } from "@/modules/portfolios/design";
import { publicCss } from "./styles";
export { publicCss } from "./styles";
import { readableInk } from "@/lib/colors";
import { defaultLabels } from "@/modules/portfolios/schema";
import type {
  Entry,
  PortfolioDocument,
  Section,
} from "@/modules/portfolios/schema";
export const escapeHtml = (text: unknown) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const e = escapeHtml;
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
export function formatDate(value: string, locale = "en") {
  if (!value) return "";
  if (value.length === 4) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    ...(day ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day || 1)));
}
export type RenderOptions = {
  baseUrl: string;
  fontUrl?: (file: string) => string;
  agencyName: string;
  asset: (id: string) => string;
  isImage?: (id: string) => boolean;
  siteId: string;
  appUrl: string;
};
export function renderPortfolio(
  doc: PortfolioDocument,
  options: RenderOptions,
): Record<string, string> {
  const { baseUrl, asset, agencyName } = options;
  const pages: Record<string, string> = {};
  const labels = { ...defaultLabels, ...doc.labels };
  const visibleSections = doc.sections.filter((section) => section.visible);
  const nav =
    doc.sections
      .filter((s) => s.visible)
      .slice(0, 5)
      .map((s) => `<a href="${e(baseUrl)}#${s.id}">${e(s.title)}</a>`)
      .join("") +
    doc.pages
      .map((p) => `<a href="${e(baseUrl)}/${e(p.slug)}">${e(p.title)}</a>`)
      .join("");
  const shell = (
    title: string,
    description: string,
    content: string,
    url: string,
    schema: unknown,
  ) =>
    `<!doctype html><html lang="${doc.seo.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="${doc.seo.indexable ? "index,follow" : "noindex,nofollow"}"><link rel="canonical" href="${e(url)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(url)}"><meta property="og:type" content="website">${doc.seo.socialImageId ? `<meta property="og:image" content="${e(asset(doc.seo.socialImageId))}">` : ""}<meta name="twitter:card" content="summary_large_image"><style>${fontFaceCss(doc.theme, (file) => e(options.fontUrl ? options.fontUrl(file) : `${baseUrl}/fonts/${file}`))}:root{--accent:${doc.theme.accent};--secondary:${doc.theme.secondary || doc.theme.accent};--ink:${doc.theme.text || readableInk(doc.theme.background)};--muted:var(--ink);--surface:color-mix(in srgb,var(--accent) 4%,var(--paper));--line:color-mix(in srgb,var(--ink) 16%,transparent);--button-ink:${readableInk(doc.theme.accent)};--paper:${doc.theme.background};--heading:${fonts[doc.theme.font].family};--body:${fonts[doc.theme.bodyFont || "sans"].family};--width:${doc.theme.width === "wide" ? "1320px" : "1160px"};--radius:${doc.theme.roundness === "soft" ? "12px" : "0px"};--portrait-radius:${doc.theme.portrait === "circle" ? "50%" : doc.theme.portrait === "arch" ? "180px 180px 12px 12px" : doc.theme.roundness === "soft" ? "12px" : "0px"};--hero-size:${doc.theme.scale === "expressive" ? "clamp(3.5rem,8vw,7rem)" : "clamp(3rem,6vw,5.5rem)"};--section-space:${doc.theme.spacing === "compact" ? "40px" : "68px"}}${publicCss}</style><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script></head><body id="top" data-motion="${doc.theme.motion || "none"}" data-sticky="${doc.theme.stickyNavigation !== false}" class="${doc.theme.style}" data-decoration="${doc.theme.decoration || "none"}" data-portrait="${doc.theme.portrait || "rectangle"}" data-spacing="${doc.theme.spacing || "generous"}"><div class="reading-progress" aria-hidden="true"></div><a class="skip" href="#main">${e(doc.labels.skip)}</a><header class="topbar"><div class="container nav"><a class="brand" href="${e(baseUrl)}">${e(doc.navigation.siteTitle || doc.profile.name)}</a><nav aria-label="Main navigation" class="nav-links">${nav}</nav></div></header><main id="main" class="container">${content}</main><footer class="footer"><div class="container footer-inner"><span>${e(doc.navigation.footer || doc.profile.name)}</span><a class="back-to-top" href="#top">${e(labels.backToTop)} <span aria-hidden="true">&#8593;</span></a>${doc.theme.showAgencyCredit ? `<span>${e(doc.labels.creditPrefix)} ${e(agencyName)}</span>` : ""}</div></footer></body></html>`;
  const dateRange = (entry: Entry) =>
    [
      formatDate(entry.start, doc.seo.language),
      entry.current
        ? doc.labels.ongoing
        : formatDate(entry.end, doc.seo.language),
    ]
      .filter(Boolean)
      .join(" — ");
  const entryBody = (body: string) => {
    if (doc.theme.expandableEntries === false || body.length <= 320)
      return paragraphs(body);
    const excerpt = body.slice(0, 240).replace(/\s+\S*$/, "");
    return `<p class="entry-excerpt">${e(excerpt)}&hellip;</p><details class="entry-details"><summary><span class="when-closed">${e(labels.readMore)}</span><span class="when-open">${e(labels.showLess)}</span><span class="details-icon" aria-hidden="true">+</span></summary><div class="expanded-copy">${paragraphs(body)}</div></details>`;
  };
  const entryHtml = (entry: Entry, type: string) =>
    `<article class="entry"><div class="entry-header"><div>${entry.status ? `<p class="eyebrow">${e(entry.status.replace("-", " "))}</p>` : ""}<h3>${type === "publications" ? `<a href="${e(baseUrl)}/publications/${entry.id}">${e(entry.title)}</a>` : e(entry.title)}</h3>${entry.subtitle ? `<p class="meta">${e(entry.subtitle)}</p>` : ""}</div>${dateRange(entry) ? `<span class="entry-date">${e(dateRange(entry))}</span>` : ""}</div>${entry.authors ? `<p class="meta">${e(entry.authors)}</p>` : ""}<div class="entry-body">${entryBody(entry.body)}</div>${entry.mediaId && (options.isImage?.(entry.mediaId) ?? /\.(webp|png|jpe?g)(\?|$)/i.test(asset(entry.mediaId))) ? `<img class="entry-image" src="${e(asset(entry.mediaId))}" alt="${e(entry.title)}" loading="lazy">` : ""}${
      entry.tags
        ? `<div class="tags">${entry.tags
            .split(",")
            .filter(Boolean)
            .map((t) => `<span class="tag">${e(t.trim())}</span>`)
            .join("")}</div>`
        : ""
    }${entry.url ? `<a href="${e(entry.url)}" rel="noopener noreferrer">${e(doc.labels.viewResource)} ↗</a> ` : ""}${entry.mediaId ? `<a href="${e(asset(entry.mediaId))}">${e(doc.labels.downloadFile)} ↓</a>` : ""}${entry.doi ? `<p class="meta">DOI: ${e(entry.doi)}</p>` : ""}</article>`;
  const sectionHtml = (sections: Section[]) =>
    sections
      .filter((s) => s.visible)
      .map(
        (section, i) =>
          `<section class="section section-${section.type}" id="${section.id}"><div class="section-head"><span class="number">${String(i + 1).padStart(2, "0")}</span><h2>${e(section.title)}</h2></div><div class="section-content">${paragraphs(section.intro)}${section.type === "about" ? paragraphs(doc.profile.bio) : ""}${section.entries.length ? `<div class="entries">${section.entries.map((entry) => entryHtml(entry, section.type)).join("")}</div>` : ""}${section.type === "contact" ? `${doc.profile.email ? `<a href="mailto:${e(doc.profile.email)}">${e(doc.profile.email)}</a>` : ""}<form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${options.siteId}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>${e(doc.labels.name)}<input name="name" required maxlength="120" autocomplete="name"></label><label>${e(doc.labels.email)}<input type="email" name="email" required maxlength="254" autocomplete="email"></label><label>${e(doc.labels.message)}<textarea name="message" required minlength="10" maxlength="5000" rows="5"></textarea></label><button class="button" type="submit">${e(doc.labels.send)}</button></form>` : ""}</div></section>`,
      )
      .join("");
  const profile = doc.profile;
  const signature = ["atlas", "noir", "horizon"].includes(doc.theme.style);
  const initials = profile.name
    .replace(/^(dr|prof|professor)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  const index =
    doc.theme.researchIndex && visibleSections.length
      ? `<nav class="research-index" aria-label="${e(labels.researchIndex)}"><p class="eyebrow">${e(labels.researchIndex)}</p><div>${visibleSections.map((section, i) => `<a href="#${section.id}"><span class="index-number">${String(i + 1).padStart(2, "0")}</span><span>${e(section.title)}</span><span aria-hidden="true">&#8599;</span></a>`).join("")}</div></nav>`
      : "";
  const hero = `<section class="hero ${profile.portraitId || signature ? "" : "solo"}"><div class="hero-copy"><p class="eyebrow">${e(profile.affiliation)}</p><h1>${e(profile.name)}</h1>${profile.headline ? `<p class="lead">${e(profile.headline)}</p>` : ""}${profile.location ? `<p class="meta">${e(profile.location)}</p>` : ""}<div class="actions">${visibleSections.length ? `<a class="button explore-link" href="#${visibleSections[0].id}">${e(labels.explore)} <span aria-hidden="true">&#8599;</span></a>` : ""}${profile.cvId ? `<a class="button" href="${e(asset(profile.cvId))}">${e(doc.navigation.cvLabel)}</a>` : ""}${profile.email ? `<a class="button outline" href="mailto:${e(profile.email)}">${e(doc.navigation.contactLabel)}</a>` : ""}</div>${
    profile.links.length
      ? `<div class="actions">${profile.links
          .filter((l) => l.url)
          .map(
            (l) =>
              `<a href="${e(l.url)}" rel="noopener noreferrer">${e(l.label)} ↗</a>`,
          )
          .join("")}</div>`
      : ""
  }</div>${profile.portraitId ? `<div class="portrait-wrap"><img class="portrait" src="${e(asset(profile.portraitId))}" width="240" height="300" alt="${e(profile.name)}" fetchpriority="high"></div>` : signature ? `<div class="hero-monogram" aria-hidden="true"><span class="monogram-orbit"></span><span class="monogram-letters">${e(initials)}</span><span class="monogram-corner">&#8599;</span></div>` : ""}</section>`;
  pages["index.html"] = shell(
    doc.seo.title || `${profile.name} — Research portfolio`,
    doc.seo.description || profile.headline,
    hero + index + sectionHtml(doc.sections),
    baseUrl,
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Person",
        name: profile.name,
        description: profile.bio,
        url: baseUrl,
        sameAs: profile.links.map((l) => l.url).filter(Boolean),
      },
    },
  );
  for (const page of doc.pages)
    pages[`${page.slug}/index.html`] = shell(
      `${page.title} — ${profile.name}`,
      page.description,
      `<section class="hero solo"><div><h1>${e(page.title)}</h1>${paragraphs(page.description)}</div></section>${sectionHtml(page.sections)}`,
      `${baseUrl}/${page.slug}`,
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: page.title,
      },
    );
  for (const section of [
    ...doc.sections,
    ...doc.pages.flatMap((p) => p.sections),
  ].filter((s) => s.visible && s.type === "publications"))
    for (const entry of section.entries) {
      const content = `<article class="article"><a href="${e(baseUrl)}">← ${e(profile.name)}</a><p class="eyebrow" style="margin-top:35px">${e(entry.status)}</p><h1>${e(entry.title)}</h1><p class="meta">${e(entry.authors)}${entry.subtitle ? ` · ${e(entry.subtitle)}` : ""}</p>${entry.start ? `<p class="meta">${e(formatDate(entry.start, doc.seo.language))}</p>` : ""}<h2>${entry.abstractSource === "generated" ? e(doc.labels.summary) : e(doc.labels.abstract)}</h2>${paragraphs(entry.body)}${entry.abstractSource === "generated" ? `<p class="meta">${e(doc.labels.summaryNote)}</p>` : ""}<div class="actions">${entry.url ? `<a class="button" href="${e(entry.url)}">${e(doc.labels.readPublication)} ↗</a>` : ""}${entry.mediaId ? `<a class="button outline" href="${e(asset(entry.mediaId))}">${e(doc.labels.downloadPaper)}</a>` : ""}</div></article>`;
      pages[`publications/${entry.id}/index.html`] = shell(
        `${entry.title} — ${profile.name}`,
        entry.body.slice(0, 300),
        content,
        `${baseUrl}/publications/${entry.id}`,
        {
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          headline: entry.title,
          abstract: entry.body,
          author: entry.authors
            .split(",")
            .filter(Boolean)
            .map((name) => ({ "@type": "Person", name: name.trim() })),
          ...(entry.start ? { datePublished: entry.start } : {}),
          ...(entry.doi ? { identifier: entry.doi } : {}),
        },
      );
    }
  pages["sitemap.xml"] =
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
      pages,
    )
      .map(
        (key) =>
          `<url><loc>${e(key === "index.html" ? baseUrl : `${baseUrl}/${key.replace("/index.html", "")}`)}</loc></url>`,
      )
      .join("")}</urlset>`;
  pages["robots.txt"] =
    `User-agent: *\n${doc.seo.indexable ? "Allow: /" : "Disallow: /"}\nSitemap: ${baseUrl}/sitemap.xml\n`;
  return pages;
}
