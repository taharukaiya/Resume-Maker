import type {
  PortfolioDocument,
  Section,
  Entry,
} from "@/modules/portfolios/schema";
import type { RenderOptions } from "./render";
import { escapeHtml as e, formatDate } from "./render";
import { initialsFavicon } from "./favicon";
import { articleCitation, citationStyles, authorNames } from "./citations";
import { shibaScript } from "./shiba-script";
import { portfolioSeo, portfolioTabTitle } from "@/modules/portfolios/seo";

export function shibaDocument(doc: PortfolioDocument): PortfolioDocument {
  return {
    ...doc,
    theme: {
      ...doc.theme,
      style: "shiba",
      accent: "#1745ee",
      background: "#ffffff",
      text: "#101828",
      font: "inter",
      bodyFont: "merriweather",
      portrait: "rectangle",
      width: "wide",
      roundness: "soft",
    },
  };
}
const prose = (text: string) =>
  text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
const css = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fff;color:#101828;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.65}a{color:#1745ee;text-decoration:none}a:hover{text-decoration:underline}button,input,select,textarea{font:inherit}button,a,input,select,textarea{outline-offset:4px}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #1745ee}h1,h2,h3,h4{line-height:1.2;letter-spacing:-.025em;color:#101828}h1{font-size:48px;font-weight:750}h2{font-size:36px}h3{font-size:21px}p{margin:0 0 18px}.container{max-width:1280px;margin:auto;padding:0 24px}.topbar{border-bottom:1px solid #eef0f3;background:#fff;position:sticky;top:0;z-index:5}.nav{height:64px;display:flex;align-items:center;gap:24px;justify-content:space-between}.brand{display:flex;gap:16px;align-items:center;color:#111;font-size:18px;font-weight:700}.brand img{width:36px;height:36px;object-fit:cover;border-radius:50%}.nav-links{display:flex;gap:28px}.nav-links a{color:#111;font-size:12px;font-weight:750;text-transform:uppercase}.button{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#1745ee;color:#fff;border:0;border-radius:10px;padding:10px 18px;box-shadow:0 4px 12px #1745ee22;font-family:Inter,system-ui,sans-serif;font-weight:650}.button:hover{background:#133bd1;text-decoration:none}.button.outline{background:#f4f5f7;color:#101828;box-shadow:none}.mobile-nav{display:none}.hero{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;padding:80px 32px;align-items:center}.hero h1{font-size:60px;line-height:1.09;letter-spacing:-.04em;margin:24px 0 28px}.hero p{color:#586474;font-size:18px;line-height:1.65}.hero-portrait{width:100%;max-height:680px;object-fit:cover;border-radius:14px;box-shadow:0 10px 35px #1018280c}.eyebrow{font-size:12px;letter-spacing:.08em;font-weight:750;text-transform:uppercase;color:#1745ee}.pill{display:inline-block;border-radius:20px;background:#e9eefc;color:#1745ee;padding:4px 12px;font-size:12px;font-weight:700}.actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}.section{padding:56px 0;border-top:1px solid #eef0f3}.section-head{margin-bottom:28px}.muted,.meta{color:#667085;font-size:14px}.section-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.card{border:1px solid #e7e9ee;border-radius:18px;padding:24px;background:#fff;overflow:hidden}.card h3{margin:10px 0 14px}.cover{width:100%;height:180px;object-fit:cover;border-radius:10px}.card p{font-size:14px;color:#667085}.card .abstract-excerpt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.timeline{border-left:2px solid #dce4fb;margin-left:12px}.timeline article{padding:0 0 32px 28px}.timeline h3{margin:8px 0}.pipeline{width:100%;border-collapse:collapse}.pipeline th,.pipeline td{text-align:left;padding:18px;border-bottom:1px solid #e7e9ee;vertical-align:top}.pipeline th{font-size:12px;letter-spacing:.06em;background:#f7f9fc}.archive{padding-top:48px}.archive h1{font-size:36px}.search-row{display:flex;gap:16px;margin:36px 0 46px}.search-row input{flex:1;min-width:0}.search-row input,.search-row select{border:1px solid #d8dce5;border-radius:14px;padding:16px;background:#fff}.columns{display:grid;grid-template-columns:minmax(0,2.25fr) minmax(240px,1fr);gap:40px}.archive-card{display:flex;gap:24px;margin-bottom:30px}.archive-card .cover{width:220px;height:160px;flex-shrink:0}.sidebar h3{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#111;margin:0 0 25px}.sidebar h3:before{content:'●';color:#1745ee;margin-right:10px}.sidebar section{margin-bottom:40px}.category{display:flex;width:100%;border:0;background:none;justify-content:space-between;text-align:left;padding:12px 0;font-size:14px;font-weight:650;color:#667085}.category[aria-pressed=true]{color:#1745ee}.category span{background:#1745ee;color:#fff;border-radius:16px;padding:0 9px}.article{padding-top:38px}.back{font-size:12px;letter-spacing:.08em;color:#98a2b3;font-weight:700}.article .columns{margin-top:46px}.article h1{margin:20px 0 30px;font-size:48px;line-height:1.22}.article-text{font-family:Merriweather,Georgia,serif;font-size:15px;line-height:1.9;overflow-wrap:anywhere}.abstract{border-left:4px solid #1745ee;background:#f8faff;padding:24px;border-radius:12px;margin:32px 0}.abstract h2{font-family:Inter,sans-serif;font-size:24px;margin-top:0}.author-card{text-align:center;border:1px solid #e7e9ee;border-radius:18px;padding:32px}.author-card img{width:96px;height:96px;border-radius:50%;object-fit:cover}.author-card h3{margin-top:22px}.author-card h3{font-size:20px;letter-spacing:-.02em;text-transform:none;margin:20px 0;color:#101828}.author-card h3:before{content:none}.author-card>.eyebrow{font-family:Inter,sans-serif;font-style:normal;color:#98a2b3;text-align:left}.entry-image{max-width:100%;border-radius:10px}.author-card p{font-family:Merriweather,Georgia,serif;font-size:13px;font-style:italic;color:#667085}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{background:#f0f3f8;padding:4px 9px;font-size:11px;border-radius:4px}.citations{background:#f8faff;border:1px solid #e7e9ee;padding:24px;border-radius:14px;margin:36px 0}.citations h3{font-size:13px;letter-spacing:.1em}.citation-tabs{display:flex;gap:6px;flex-wrap:wrap}.citation-tabs button{border:1px solid #dce2ec;background:white;border-radius:6px;padding:7px 12px;font-size:12px}.citation-tabs button[aria-selected=true]{background:#1745ee;color:#fff}.citations pre{white-space:pre-wrap;font:14px/1.7 Merriweather,Georgia,serif;overflow-wrap:anywhere}.copy-status{font-size:12px;margin-left:10px}.footer{margin-top:56px;border-top:1px solid #eef0f3;padding:28px 0;color:#667085;font-size:12px}.footer .container{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}.contact-form{display:grid;gap:18px;max-width:680px}.contact-form label{display:grid;gap:8px;font-size:12px;font-weight:650}.contact-form input,.contact-form textarea{border:1px solid #dce2ec;padding:12px;border-radius:8px}.honey{position:absolute;left:-9999px}.skip{position:absolute;left:-9999px}.skip:focus{position:fixed;left:12px;top:12px;background:white;z-index:20;padding:12px}[hidden]{display:none!important}.entry-details{margin:12px 0}.entry-details summary{color:#1745ee;cursor:pointer}@media(max-width:850px){.hero{grid-template-columns:1fr;padding:45px 0;gap:32px}.hero h1{font-size:42px}.hero-portrait{max-height:540px}.section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}.nav-links{display:none}.mobile-nav{display:block}.mobile-nav[open]{position:absolute;top:10px;left:24px;right:24px;background:white;padding:12px;border:1px solid #dce2ec;border-radius:12px}.mobile-nav a{display:block;padding:8px}.brand{font-size:15px}.nav>.button{font-size:12px}.article h1{font-size:36px}.archive-card .cover{width:140px;height:140px}.pipeline{font-size:12px}.pipeline th,.pipeline td{padding:10px}}@media(max-width:520px){.section-grid{grid-template-columns:1fr}.archive-card{display:block}.archive-card .cover{width:100%;height:190px}.search-row{flex-direction:column}.hero h1{font-size:36px}.brand img{display:none}.hero p{font-size:16px}.container{padding:0 20px}h2{font-size:28px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;

export function renderShibaPortfolio(
  doc: PortfolioDocument,
  options: RenderOptions,
): Record<string, string> {
  const { baseUrl, asset } = options,
    p = doc.profile,
    seo = portfolioSeo(doc);
  const all = [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ].filter((s) => s.visible);
  const articleSections =
    doc.navigation.articlesEnabled === false
      ? []
      : all.filter((s) => s.type === "publications");
  const articles = articleSections.flatMap((s) => s.entries);
  const categories = [
    ...new Set(articles.map((a) => a.category || a.subtitle).filter(Boolean)),
  ];
  const bioVisible = all.some((s) => s.type === "about");
  const url = (a: Entry) => `${baseUrl}/article/${a.id}`;
  const date = (a: Entry) =>
    a.start
      ? formatDate(
          a.start,
          doc.seo.language === "en" ? "en-GB" : doc.seo.language,
        )
      : "Date not specified";
  const cover = (a: Entry) =>
    a.coverId
      ? `<img class="cover" src="${e(asset(a.coverId))}" alt="${e(a.title)}" loading="lazy">`
      : "";
  const links = () =>
    `<a href="${e(baseUrl)}">HOME</a>${articleSections.length ? `<a href="${e(baseUrl)}/article">RESEARCH</a>` : ""}${bioVisible ? `<a href="${e(baseUrl)}/about">ABOUT ME</a>` : ""}${all.some((s) => s.type === "contact") ? `<a href="${e(baseUrl)}/contact">CONTACT</a>` : ""}${doc.pages.map((page) => `<a href="${e(baseUrl)}/${e(page.slug)}">${e(page.title)}</a>`).join("")}`;
  const shell = (
    title: string,
    content: string,
    address: string,
    schema: unknown = { "@type": "Person", name: p.name },
    description = seo.description,
  ) =>
    `<!doctype html><html lang="${e(doc.seo.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="${doc.seo.indexable ? "index,follow" : "noindex,nofollow"}"><link rel="canonical" href="${e(address)}"><link rel="icon" href="${e(options.faviconUrl || `${baseUrl}/favicon.svg`)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(address)}"><meta property="og:type" content="website">${seo.socialImageId ? `<meta property="og:image" content="${e(asset(seo.socialImageId))}">` : ""}<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("inter.woff2") : `${baseUrl}/fonts/inter.woff2`)}') format('woff2')}@font-face{font-family:Merriweather;font-style:normal;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("merriweather.woff2") : `${baseUrl}/fonts/merriweather.woff2`)}') format('woff2')}${css}</style><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...(schema as object) }).replace(/</g, "\\u003c")}</script></head><body class="shiba"><a class="skip" href="#main">Skip to content</a><header class="topbar"><div class="container nav"><a class="brand" href="${e(baseUrl)}">${p.portraitId ? `<img src="${e(asset(p.portraitId))}" alt="">` : ""}${e(doc.navigation.siteTitle || p.name)}</a><nav class="nav-links" aria-label="Main navigation">${links()}</nav><details class="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile navigation">${links()}</nav></details>${p.cvId ? `<a class="button" href="${e(asset(p.cvId))}" download>↓ ${e(doc.navigation.cvLabel || "Download CV")}</a>` : ""}</div></header><main id="main" class="container">${content}</main><footer class="footer"><div class="container"><span>${e(doc.navigation.copyright || `© ${p.name}${p.headline ? " | " + p.headline : ""}`)}</span><span>${e(doc.navigation.footer)}${doc.theme.showAgencyCredit ? ` · Portfolio by ${e(options.agencyName)}` : ""}</span></div></footer><script>${shibaScript}</script></body></html>`;
  const card = (a: Entry) =>
    `<article class="card"><a href="${e(url(a))}">${cover(a)}<h3>${e(a.title)}</h3></a><p class="abstract-excerpt">${e(a.body)}</p><p class="meta">${e(date(a))}</p>${a.category || a.subtitle ? `<span class="pill">${e(a.category || a.subtitle)}</span>` : ""}</article>`;
  const entry = (a: Entry) =>
    `<article class="entry"><p class="eyebrow">${e(a.start)}${a.current ? " — Present" : a.end ? " — " + e(a.end) : ""}</p><h3>${e(a.title)}</h3><p class="meta">${e(a.subtitle)}</p>${prose(a.body)}${a.mediaId && options.isImage?.(a.mediaId) ? `<img class="entry-image" src="${e(asset(a.mediaId))}" alt="${e(a.title)}" loading="lazy">` : ""}${a.url ? `<a href="${e(a.url)}" rel="noopener noreferrer">View resource ↗</a>` : ""}${a.mediaId ? ` <a href="${e(asset(a.mediaId))}">Download file ↓</a>` : ""}</article>`;
  const section = (s: Section) =>
    `<section class="section section-${s.type}" id="${e(s.id)}"><div class="section-head"><h2>${e(s.title)}</h2>${prose(s.intro)}</div>${s.type === "about" ? prose(p.bio) : ""}<div class="timeline">${s.entries.map(entry).join("")}</div>${s.type === "contact" ? `<form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${e(options.siteId)}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>NAME *<input name="name" required maxlength="120" autocomplete="name"></label><label>EMAIL ADDRESS *<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>MESSAGE *<textarea name="message" rows="5" required minlength="10" maxlength="5000"></textarea></label><button class="button">Send inquiry</button></form>${p.email ? `<p><a href="mailto:${e(p.email)}">${e(p.email)}</a></p>` : ""}` : ""}</section>`;
  const pipeline = articleSections.length
    ? `<section class="section"><h2>Publication Pipeline</h2><p class="muted">Active journals and conference submissions.</p><table class="pipeline"><thead><tr><th>RESEARCH TITLE</th><th>TARGET VENUE</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>${articles
        .filter((a) => a.status && a.status !== "published")
        .map(
          (a) =>
            `<tr><td><a href="${e(url(a))}">${e(a.title)}</a><p>${e(a.authors)}</p></td><td>${e(a.journal || a.subtitle || "Not specified")}</td><td>${e(date(a))}</td><td>${e(a.status)}</td></tr>`,
        )
        .join("")}</tbody></table></section>`
    : "";
  const headline = p.headline || p.name;
  const highlight = p.headlineHighlight?.trim();
  const highlightAt = highlight ? headline.indexOf(highlight) : -1;
  const heroHeadline =
    highlight && highlightAt >= 0
      ? `${e(headline.slice(0, highlightAt))}<span style="color:#1745ee">${e(highlight)}</span>${e(headline.slice(highlightAt + highlight.length))}`
      : e(headline);
  const home = `<section class="hero"><div>${p.affiliation ? `<span class="pill">${e(p.affiliation)}</span>` : ""}<h1>${heroHeadline}</h1>${bioVisible ? prose(p.bio) : ""}<div class="actions">${p.links
    .filter((l) => l.url)
    .map(
      (l, i) =>
        `<a class="button${i ? " outline" : ""}" href="${e(l.url)}" rel="noopener noreferrer">${e(l.label)}</a>`,
    )
    .join(
      "",
    )}</div></div>${p.portraitId ? `<img class="hero-portrait" src="${e(asset(p.portraitId))}" alt="${e(p.name)}">` : ""}</section>${articleSections.length ? `<section class="section" id="research"><h2>Recent Research Articles</h2><p class="muted">Latest publications and research insights.</p><div class="section-grid">${articles.slice(0, 6).map(card).join("")}</div><div class="actions"><a class="button outline" href="${e(baseUrl)}/article">Read More Articles</a></div></section>` : ""}${pipeline}${all
    .filter((s) =>
      [
        "education",
        "experience",
        "awards",
        "projects",
        "skills",
        "custom",
        "contact",
      ].includes(s.type),
    )
    .map(section)
    .join("")}`;
  const pages: Record<string, string> = {
    "index.html": shell(portfolioTabTitle(doc), home, baseUrl),
  };
  if (bioVisible)
    pages["about/index.html"] = shell(
      portfolioTabTitle(doc, "About me"),
      all
        .filter((s) => s.type === "about")
        .map(section)
        .join(""),
      `${baseUrl}/about`,
    );
  if (all.some((s) => s.type === "contact"))
    pages["contact/index.html"] = shell(
      portfolioTabTitle(doc, "Contact"),
      all
        .filter((s) => s.type === "contact")
        .map(section)
        .join(""),
      `${baseUrl}/contact`,
    );
  for (const page of doc.pages)
    pages[`${page.slug}/index.html`] = shell(
      portfolioTabTitle(doc, page.title),
      `<section class="section"><h1>${e(page.title)}</h1>${prose(page.description)}</section>${page.sections
        .filter((s) => s.visible && s.type !== "publications")
        .map(section)
        .join("")}`,
      `${baseUrl}/${page.slug}`,
    );
  if (articleSections.length) {
    const archiveCard = (a: Entry) =>
      `<article class="card archive-card" data-article data-title="${e(a.title)}" data-date="${e(a.start)}" data-category="${e(a.category || a.subtitle)}" data-search="${e([a.title, a.authors, a.start, a.tags, a.category, a.body].join(" ").toLocaleLowerCase())}">${cover(a)}<div><p class="meta">${e(date(a))} · ${Math.max(1, Math.ceil((a.fullText || a.body).split(/\s+/).length / 200))} min read</p><h3><a href="${e(url(a))}">${e(a.title)}</a></h3><p class="abstract-excerpt">${e(a.body)}</p><div class="tags"><span class="tag">${e(a.category || a.subtitle || "Research")}</span><a href="${e(url(a))}">View Abstract →</a></div></div></article>`;
    const side = `<aside class="sidebar"><section><h3>Categories</h3><button class="category" data-category="" aria-pressed="true">All Research <span>${articles.length}</span></button>${categories.map((c) => `<button class="category" data-category="${e(c)}" aria-pressed="false">${e(c)} <span>${articles.filter((a) => (a.category || a.subtitle) === c).length}</span></button>`).join("")}</section><section><h3>Research topics</h3><div class="tags">${[
      ...new Set(
        articles.flatMap((a) =>
          a.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ),
    ]
      .slice(0, 20)
      .map((t) => `<span class="tag">${e(t)}</span>`)
      .join("")}</div></section></aside>`;
    pages["article/index.html"] = shell(
      portfolioTabTitle(doc, "Research Archive"),
      `<section class="archive" data-archive><h1>Research Archive</h1><div class="search-row"><input type="search" aria-label="Search research" placeholder="Search by title, keyword, or year..."><select aria-label="Sort articles"><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="title">Title A–Z</option></select></div><p class="meta" data-result-count aria-live="polite">${articles.length} articles</p><div class="columns"><div><div data-article-list>${articles.map(archiveCard).join("")}</div><p data-empty hidden>No articles found matching your criteria.</p></div>${side}</div></section>`,
      `${baseUrl}/article`,
    );
    // Keep previous publication URLs working after the archive moves to /article.
    pages["publications/index.html"] = pages["article/index.html"];
    for (const a of articles) {
      const citations = `<section class="citations" data-citations><h3>CITE THIS ARTICLE</h3><div class="citation-tabs" role="tablist" aria-label="Citation style">${citationStyles.map((style, i) => `<button id="tab-${a.id}-${i}" role="tab" data-citation-tab aria-controls="cite-${a.id}-${i}" aria-selected="${i === 0}">${style}</button>`).join("")}</div>${citationStyles.map((style, i) => `<div id="cite-${a.id}-${i}" role="tabpanel" aria-labelledby="tab-${a.id}-${i}"${i ? " hidden" : ""}><pre>${e(articleCitation(a, url(a), style))}</pre></div>`).join("")}<button class="button outline" data-copy="citation">Copy Citation</button></section>`;
      const author = `<aside class="sidebar"><section class="author-card"><p class="eyebrow">ABOUT THE AUTHOR</p>${p.portraitId ? `<img src="${e(asset(p.portraitId))}" alt="${e(p.name)}">` : ""}<h3>${e(a.authors || p.name)}</h3>${p.affiliation ? `<p class="eyebrow">${e(p.affiliation)}</p>` : ""}${bioVisible ? prose(p.bio) : ""}</section><section><h3>Related Research</h3>${articles
        .filter((x) => x.id !== a.id)
        .slice(0, 3)
        .map((x) => `<p><a href="${e(url(x))}">${e(x.title)}</a></p>`)
        .join("")}</section><section><h3>Tags</h3><div class="tags">${a.tags
        .split(",")
        .filter(Boolean)
        .map((t) => `<span class="tag">${e(t.trim())}</span>`)
        .join("")}</div></section></aside>`;
      const content = `<article class="article"><a class="back" href="${e(baseUrl)}/article">← Back to Research Archive</a><div class="columns"><div><span class="pill">${e(a.category || a.subtitle || "Research")}</span><h1>${e(a.title)}</h1><p class="eyebrow">${e(a.authors)}</p><p class="article-text">Published ${e(date(a))}</p><div class="actions">${a.mediaId ? `<a class="button" href="${e(asset(a.mediaId))}" download>↓ Download as PDF</a>` : ""}${a.url ? `<a class="button outline" href="${e(a.url)}" rel="noopener noreferrer">Read publication ↗</a>` : ""}</div><section class="abstract article-text"><h2>Abstract</h2>${prose(a.body)}${a.abstractSource === "generated" ? `<p class="meta">AI-assisted abstract, reviewed by the administrator.</p>` : ""}</section>${a.fullText ? `<section class="article-text">${prose(a.fullText)}</section>` : ""}${citations}</div>${author}</div></article>`;
      pages[`article/${a.id}/index.html`] = shell(
        portfolioTabTitle(doc, a.title),
        content,
        url(a),
        {
          "@type": "ScholarlyArticle",
          headline: a.title,
          abstract: a.body,
          author: authorNames(a.authors).map((name) => ({
            "@type": "Person",
            name,
          })),
          ...(a.start ? { datePublished: a.start } : {}),
          ...(a.doi ? { identifier: a.doi } : {}),
        },
        a.body.slice(0, 300),
      );
      pages[`publications/${a.id}/index.html`] =
        pages[`article/${a.id}/index.html`];
    }
  }
  pages["sitemap.xml"] =
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
      pages,
    )
      .filter((key) => !key.startsWith("publications/"))
      .map(
        (key) =>
          `<url><loc>${e(key === "index.html" ? baseUrl : `${baseUrl}/${key.replace("/index.html", "")}`)}</loc></url>`,
      )
      .join("")}</urlset>`;
  pages["robots.txt"] =
    `User-agent: *\n${doc.seo.indexable ? "Allow: /" : "Disallow: /"}\nSitemap: ${baseUrl}/sitemap.xml\n`;
  pages["favicon.svg"] = initialsFavicon(p.name, "#1745ee");
  return pages;
}
