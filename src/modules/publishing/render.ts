import { readableInk } from "@/lib/colors";
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
export const publicCss = `
body,.brand,h1,h2,h3{color:var(--ink)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--paper);color:#202b2b;font:16px/1.75 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--accent);text-underline-offset:4px}a:hover{opacity:.8}button,input,textarea{font:inherit}button,a{touch-action:manipulation}img{max-width:100%;height:auto}h1,h2,h3{font-family:var(--heading);font-weight:500;line-height:1.16;color:#172724}h1{font-size:clamp(2.8rem,7vw,5.5rem);letter-spacing:-.055em;margin:14px 0 24px}h2{font-size:clamp(2rem,4vw,3rem);letter-spacing:-.035em;margin:0 0 24px}h3{font-size:1.5rem;margin:0 0 10px}p{margin:0 0 18px}.container{max-width:var(--width);margin:auto;padding:0 30px}.topbar{border-bottom:1px solid #203d301f;padding:22px 0}.nav{display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-family:var(--heading);font-size:20px;text-decoration:none;font-weight:600;color:#172724}.nav-links{display:flex;gap:22px;flex-wrap:wrap;font-size:13px}.nav-links a{text-decoration:none}.hero{padding:90px 0 75px;display:grid;grid-template-columns:1fr 240px;gap:70px;align-items:center}.hero.solo{grid-template-columns:1fr;max-width:850px}.eyebrow{color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.lead{font-size:20px;color:#596662;max-width:700px}.portrait{width:240px;height:300px;object-fit:cover;border-radius:var(--radius);filter:saturate(.85)}.meta{font-size:13px;color:#68746f}.actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:var(--accent);color:white;padding:11px 20px;border-radius:var(--radius);border:1px solid var(--accent);font-size:13px;font-weight:600}.button.outline{background:transparent;color:var(--accent)}.section{padding:58px 0;border-top:1px solid #203d301f}.section-head{display:grid;grid-template-columns:64px 1fr;gap:15px}.number{font-size:11px;letter-spacing:.1em;color:#87928b;padding-top:11px}.section-content{margin-left:79px}.entry{padding:25px 0;border-bottom:1px solid #203d3012}.entry:last-child{border:0}.entry-header{display:flex;justify-content:space-between;gap:20px}.entry-date{font-size:12px;white-space:nowrap;color:#6a756d}.entry-body{max-width:800px;color:#59645e}.tags{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.tag{font-size:11px;border:1px solid #203d3020;padding:3px 10px;border-radius:30px;color:var(--accent)}.label{font-size:11px;text-transform:uppercase;letter-spacing:.1em}.footer{padding:35px 0;border-top:1px solid #203d301f;color:#66736c;font-size:12px}.footer-inner{display:flex;justify-content:space-between;gap:25px}.skip{position:absolute;left:-10000px}.skip:focus{left:15px;top:15px;background:white;padding:10px;z-index:50}.contact-form{display:grid;gap:14px;max-width:620px;margin-top:24px}.contact-form label{display:grid;gap:5px;font-size:13px}.contact-form input,.contact-form textarea{width:100%;background:#fff8;border:1px solid #203d3030;border-radius:var(--radius);padding:10px 12px;color:#202b2b}.contact-form button{cursor:pointer;justify-self:start}.honey{position:absolute;left:-9999px}.article{max-width:800px;margin:70px auto}.article h1{font-size:clamp(2.5rem,5vw,4rem)}.modern h1,.modern h2,.modern h3{font-family:system-ui,sans-serif;font-weight:650}.classic .hero{text-align:center;display:block;max-width:850px;margin:auto}.classic .portrait{width:150px;height:150px;border-radius:50%;margin-bottom:24px}.classic .actions{justify-content:center}.classic .section-head{display:block}.classic .number{display:none}.classic .section-content{margin:0}.entry-image{max-height:350px;object-fit:contain;margin:15px 0} :focus-visible{outline:3px solid var(--accent);outline-offset:4px}@media(max-width:650px){.container{padding:0 22px}.hero{padding:50px 0;grid-template-columns:1fr;gap:24px}.portrait{width:160px;height:190px}.hero .portrait-wrap{grid-row:1}.nav{align-items:flex-start}.nav-links{gap:12px;justify-content:flex-end}.section{padding:40px 0}.section-head{grid-template-columns:30px 1fr;gap:5px}.section-content{margin-left:35px}.entry-header{display:block}.entry-date{display:block;margin-bottom:12px}.footer-inner{display:flex;flex-direction:column;gap:8px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{.nav-links,.contact-form,.actions,.skip{display:none}body{background:white}.hero{padding:30px 0}.section{break-inside:avoid;padding:25px 0}}`;
export type RenderOptions = {
  baseUrl: string;
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
    `<!doctype html><html lang="${doc.seo.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="${doc.seo.indexable ? "index,follow" : "noindex,nofollow"}"><link rel="canonical" href="${e(url)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(url)}"><meta property="og:type" content="website">${doc.seo.socialImageId ? `<meta property="og:image" content="${e(asset(doc.seo.socialImageId))}">` : ""}<meta name="twitter:card" content="summary_large_image"><style>:root{--accent:${doc.theme.accent};--ink:${readableInk(doc.theme.background)};--button-ink:${readableInk(doc.theme.accent)};--paper:${doc.theme.background};--heading:${doc.theme.font === "serif" ? "Georgia,serif" : "system-ui,sans-serif"};--width:${doc.theme.width === "wide" ? "1280px" : "1080px"};--radius:${doc.theme.roundness === "soft" ? "8px" : "0px"}}</style><style>${publicCss}body,.brand,h1,h2,h3{color:var(--ink)}.lead,.meta,.entry-body,.entry-date,.footer,.number{color:var(--ink);opacity:.8}.button{color:var(--button-ink)}.button.outline{color:var(--accent)}.contact-form input,.contact-form textarea{background:var(--paper);color:var(--ink)}.topbar,.section,.entry,.footer,.tag{border-color:color-mix(in srgb,var(--ink) 18%,transparent)}</style><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script></head><body class="${doc.theme.style}"><a class="skip" href="#main">${e(doc.labels.skip)}</a><header class="topbar"><div class="container nav"><a class="brand" href="${e(baseUrl)}">${e(doc.navigation.siteTitle || doc.profile.name)}</a><nav aria-label="Main navigation" class="nav-links">${nav}</nav></div></header><main id="main" class="container">${content}</main><footer class="footer"><div class="container footer-inner"><span>${e(doc.navigation.footer || doc.profile.name)}</span>${doc.theme.showAgencyCredit ? `<span>${e(doc.labels.creditPrefix)} ${e(agencyName)}</span>` : ""}</div></footer></body></html>`;
  const dateRange = (entry: Entry) =>
    [
      formatDate(entry.start, doc.seo.language),
      entry.current
        ? doc.labels.ongoing
        : formatDate(entry.end, doc.seo.language),
    ]
      .filter(Boolean)
      .join(" — ");
  const entryHtml = (entry: Entry, type: string) =>
    `<article class="entry"><div class="entry-header"><div>${entry.status ? `<p class="eyebrow">${e(entry.status.replace("-", " "))}</p>` : ""}<h3>${type === "publications" ? `<a href="${e(baseUrl)}/publications/${entry.id}">${e(entry.title)}</a>` : e(entry.title)}</h3>${entry.subtitle ? `<p class="meta">${e(entry.subtitle)}</p>` : ""}</div>${dateRange(entry) ? `<span class="entry-date">${e(dateRange(entry))}</span>` : ""}</div>${entry.authors ? `<p class="meta">${e(entry.authors)}</p>` : ""}<div class="entry-body">${paragraphs(entry.body)}</div>${entry.mediaId && (options.isImage?.(entry.mediaId) ?? /\.(webp|png|jpe?g)(\?|$)/i.test(asset(entry.mediaId))) ? `<img class="entry-image" src="${e(asset(entry.mediaId))}" alt="${e(entry.title)}" loading="lazy">` : ""}${
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
          `<section class="section" id="${section.id}"><div class="section-head"><span class="number">${String(i + 1).padStart(2, "0")}</span><h2>${e(section.title)}</h2></div><div class="section-content">${paragraphs(section.intro)}${section.type === "about" ? paragraphs(doc.profile.bio) : ""}${section.entries.map((entry) => entryHtml(entry, section.type)).join("")}${section.type === "contact" ? `${doc.profile.email ? `<a href="mailto:${e(doc.profile.email)}">${e(doc.profile.email)}</a>` : ""}<form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${options.siteId}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>${e(doc.labels.name)}<input name="name" required maxlength="120" autocomplete="name"></label><label>${e(doc.labels.email)}<input type="email" name="email" required maxlength="254" autocomplete="email"></label><label>${e(doc.labels.message)}<textarea name="message" required minlength="10" maxlength="5000" rows="5"></textarea></label><button class="button" type="submit">${e(doc.labels.send)}</button></form>` : ""}</div></section>`,
      )
      .join("");
  const profile = doc.profile;
  const hero = `<section class="hero ${profile.portraitId ? "" : "solo"}"><div><p class="eyebrow">${e(profile.affiliation)}</p><h1>${e(profile.name)}</h1>${profile.headline ? `<p class="lead">${e(profile.headline)}</p>` : ""}${profile.location ? `<p class="meta">${e(profile.location)}</p>` : ""}<div class="actions">${profile.cvId ? `<a class="button" href="${e(asset(profile.cvId))}">${e(doc.navigation.cvLabel)}</a>` : ""}${profile.email ? `<a class="button outline" href="mailto:${e(profile.email)}">${e(doc.navigation.contactLabel)}</a>` : ""}</div>${
    profile.links.length
      ? `<div class="actions">${profile.links
          .filter((l) => l.url)
          .map(
            (l) =>
              `<a href="${e(l.url)}" rel="noopener noreferrer">${e(l.label)} ↗</a>`,
          )
          .join("")}</div>`
      : ""
  }</div>${profile.portraitId ? `<div class="portrait-wrap"><img class="portrait" src="${e(asset(profile.portraitId))}" width="240" height="300" alt="${e(profile.name)}" fetchpriority="high"></div>` : ""}</section>`;
  pages["index.html"] = shell(
    doc.seo.title || `${profile.name} — Research portfolio`,
    doc.seo.description || profile.headline,
    hero + sectionHtml(doc.sections),
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
