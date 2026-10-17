import type {
  PortfolioDocument,
  Section,
  Entry,
} from "@/modules/portfolios/schema";
import type { RenderOptions } from "./render";
import { escapeHtml as e, formatDate } from "./render";
import { initialsFavicon } from "./favicon";
import { articleCitation, citationStyles, authorNames } from "./citations";
import {
  renderAboutPage,
  renderContactPage,
  shibaPagesCss,
} from "./shiba-pages";
import {
  homeHero,
  homeHistory,
  homeContact,
  homeIcon,
  shibaHomeCss,
} from "./shiba-home";
import { shibaArticleCss } from "./shiba-article-style";
import { shibaScript } from "./shiba-script";
import { portfolioSeo, portfolioTabTitle } from "@/modules/portfolios/seo";

export function shibaDocument(doc: PortfolioDocument): PortfolioDocument {
  return {
    ...doc,
    theme: {
      ...doc.theme,
      style: "shiba",
      accent: "#1447e6",
      background: "#ffffff",
      text: "#0f172b",
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
const css = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fff;color:#0f172b;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.65}a{color:#1447e6;text-decoration:none}a:hover{text-decoration:underline}button,input,select,textarea{font:inherit}button,a,input,select,textarea{outline-offset:4px}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #1447e6}h1,h2,h3,h4{line-height:1.2;letter-spacing:-.025em;color:#0f172b}h1{font-size:48px;font-weight:700}h2{font-size:30px;font-weight:700;line-height:36px}h3{font-size:21px}p{margin:0 0 18px}.container{max-width:1280px;margin:auto;padding:0 24px}.topbar{border-bottom:1px solid #eef0f3;background:#fff;position:sticky;top:0;z-index:5}.nav{height:64px;display:flex;align-items:center;gap:24px;justify-content:space-between}.brand{display:flex;gap:16px;align-items:center;color:#18181b;font-size:18px;line-height:28px;letter-spacing:-.45px;font-weight:700}.brand img{width:36px;height:36px;object-fit:cover;border-radius:50%}.brand img.brand-logo{object-fit:contain;border-radius:0}.nav-links{display:flex;gap:28px}.nav-links a{color:#18181b;font-size:12px;font-weight:750;text-transform:uppercase}.button{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#155dfb;color:#fff;border:0;border-radius:10px;padding:10px 18px;box-shadow:0 4px 12px #1447e622;font-family:Inter,system-ui,sans-serif;font-weight:650}.button:hover{background:#133bd1;text-decoration:none}.button.outline{background:#f4f5f7;color:#0f172b;box-shadow:none}.nav>.button{font-size:12px;line-height:16px;font-weight:700;padding:8px 16px;white-space:nowrap}.mobile-nav{display:none}.hero{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;padding:80px 32px;align-items:center}.hero h1{font-size:60px;font-weight:900;line-height:66px;letter-spacing:-1.5px;margin:24px 0 28px}.hero p{color:#45556c;font-size:18px;line-height:1.625}.hero-portrait{width:100%;max-height:680px;object-fit:cover;border-radius:14px;box-shadow:0 10px 35px #0f172b0c}.eyebrow{font-size:12px;letter-spacing:.08em;font-weight:750;text-transform:uppercase;color:#1447e6}.pill{display:inline-block;border-radius:20px;background:#e9eefc;color:#1447e6;padding:4px 12px;font-size:12px;font-weight:700}.actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}.section{padding:56px 0;border-top:1px solid #eef0f3}.section-head{margin-bottom:28px}.muted,.meta{color:#62748e;font-size:14px}.section-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.card{border:1px solid #e7e9ee;border-radius:18px;padding:24px;background:#fff;overflow:hidden}.card h3{margin:10px 0 14px}.cover{width:100%;height:180px;object-fit:cover;border-radius:10px}.card p{font-size:14px;color:#62748e}.card .abstract-excerpt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.timeline{border-left:2px solid #dce4fb;margin-left:12px}.timeline article{padding:0 0 32px 28px}.timeline h3{margin:8px 0}.pipeline{width:100%;border-collapse:collapse}.pipeline th,.pipeline td{text-align:left;padding:18px;border-bottom:1px solid #e7e9ee;vertical-align:top}.pipeline th{font-size:12px;letter-spacing:.06em;background:#f7f9fc}.archive{padding-top:48px}.archive h1{font-size:36px;font-weight:900;line-height:40px;letter-spacing:-.9px}.search-row{display:flex;gap:16px;margin:36px 0 46px}.search-row input{flex:1;min-width:0}.search-row input,.search-row select{border:1px solid #d8dce5;border-radius:14px;padding:16px;background:#fff}.columns{display:grid;grid-template-columns:minmax(0,2.125fr) minmax(240px,1fr);gap:48px}.archive-card{display:flex;gap:24px;margin-bottom:30px}.archive-card .cover{width:220px;height:160px;flex-shrink:0}.sidebar h3{font-size:14px;line-height:20px;text-transform:uppercase;letter-spacing:1.4px;color:#111;margin:0 0 25px}.sidebar h3:before{content:'●';color:#1447e6;margin-right:10px}.sidebar section{margin-bottom:40px}.category{display:flex;width:100%;border:0;background:none;justify-content:space-between;text-align:left;padding:12px 0;font-size:14px;font-weight:650;color:#62748e}.category[aria-pressed=true]{color:#1447e6}.category span{background:#1447e6;color:#fff;border-radius:16px;padding:0 9px}.article{padding-top:38px}.back{font-size:12px;letter-spacing:.08em;color:#98a2b3;font-weight:700}.article .columns{margin-top:46px}.article h1{margin:20px 0 30px;font-size:48px;line-height:60px;letter-spacing:normal}.article-byline{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px 0 32px;font-family:Merriweather,Georgia,serif;font-size:16px;line-height:24px}.article-byline p{margin:0}.article-byline .muted{font-size:16px}.article-byline .authors{color:#1447e6;font-weight:700}.article .actions{border-top:1px solid #e7e9ee;border-bottom:1px solid #e7e9ee;padding:16px 0}.article-text{font-family:Merriweather,Georgia,serif;font-size:18px;line-height:1.8;overflow-wrap:anywhere}.abstract{font-size:16px;line-height:26px;border-left:4px solid #1447e6;background:#f8fafc;padding:32px;border-radius:12px;margin:40px 0}.abstract h2{font-family:Inter,sans-serif;font-size:20px;line-height:28px;margin-top:0}.author-card{text-align:center;border:1px solid #e7e9ee;border-radius:18px;padding:32px}.author-card img{width:96px;height:96px;border-radius:50%;object-fit:cover}.author-card h3{margin-top:22px}.author-card h3{font-size:20px;letter-spacing:-.02em;text-transform:none;margin:20px 0;color:#0f172b}.author-card h3:before{content:none}.author-card>.eyebrow{font-family:Inter,sans-serif;font-style:normal;color:#98a2b3;text-align:left}.entry-image{max-width:100%;border-radius:10px}.article-figure{margin:28px 0}.article-figure figcaption{font-family:Merriweather,serif;font-size:14px;line-height:22.75px;color:#62748e}.article-cover{margin:32px 0}.article .pill{font-family:Merriweather,Georgia,serif;line-height:16px;text-transform:uppercase}.abstract p{font-style:italic}.article .sidebar>section:not(.author-card) h3{font-size:18px;line-height:28px;text-transform:none;letter-spacing:normal}.article .sidebar>section:not(.author-card) h3:before{content:none}.author-card>.eyebrow{font-size:12px;line-height:16px;letter-spacing:2.4px;font-weight:900}.author-card h3{text-transform:uppercase}.author-card p.eyebrow:not(:first-child){font-size:12px;line-height:16px;letter-spacing:.6px;color:#1447e6;font-weight:600}.author-card p{font-family:Merriweather,Georgia,serif;font-size:14px;line-height:22.75px;font-style:italic;color:#62748e}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{background:#f0f3f8;padding:4px 9px;font-size:11px;border-radius:4px}.citations{background:#f8faff;border:1px solid #e7e9ee;padding:24px;border-radius:14px;margin:36px 0}.citations h3{font-size:13px;letter-spacing:.1em}.citation-tabs{display:flex;gap:6px;flex-wrap:wrap}.citation-tabs button{border:1px solid #dce2ec;background:white;border-radius:6px;padding:7px 12px;font-size:12px}.citation-tabs button[aria-selected=true]{background:#1447e6;color:#fff}.citations pre{white-space:pre-wrap;font:14px/22.75px "Geist Mono",ui-monospace,monospace;overflow-wrap:anywhere}.copy-status{font-size:12px;margin-left:10px}.footer{line-height:16px;margin-top:56px;border-top:1px solid #eef0f3;padding:28px 0;color:#62748e;font-size:12px}.footer .container{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}.contact-form{display:grid;gap:18px;max-width:680px}.contact-form label{display:grid;gap:8px;font-size:12px;font-weight:650}.contact-form input,.contact-form textarea{border:1px solid #dce2ec;padding:12px;border-radius:8px}.honey{position:absolute;left:-9999px}.skip{position:absolute;left:-9999px}.skip:focus{position:fixed;left:12px;top:12px;background:white;z-index:20;padding:12px}[hidden]{display:none!important}.entry-details{margin:12px 0}.entry-details summary{color:#1447e6;cursor:pointer}.nav{max-width:1200px;padding-left:24px;padding-right:24px}.home-research{padding-left:32px;padding-right:32px}.home-research .columns{grid-template-columns:minmax(0,1fr) 252px;gap:32px}.home-research .section-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.home-research .card{padding:16px;border-radius:15px;box-shadow:0 1px 4px #0f172b10}.home-research .card h3{font-size:14px;line-height:20px;letter-spacing:normal}.archive-card h3{font-size:20px;line-height:25px;letter-spacing:normal}.nav-links a{font-weight:700;line-height:16px;letter-spacing:-.3px}.home-research .card p{font-size:12px;line-height:16px}.home-research .cover{height:128px}.home-research .abstract-excerpt{-webkit-line-clamp:2}.home-research .pill{font-size:10px;border-radius:4px}.home-topics{align-self:start}.home-topics h3{color:#98a2b3;font-size:12px!important;letter-spacing:.1em}.home-topics .category{padding:10px 14px;border-radius:9px;font-weight:500}.home-topics .category[aria-pressed=true]{background:#1447e6;color:#fff}@media(max-width:1050px){.home-research .section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:850px){.nav{padding:0 24px}.home-research{padding-left:0;padding-right:0}.home-research .columns{grid-template-columns:1fr}.hero{grid-template-columns:1fr;padding:45px 0;gap:32px}.hero h1{font-size:42px;line-height:1.1}.hero-portrait{max-height:540px}.section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}.nav-links{display:none}.mobile-nav{display:block}.mobile-nav[open]{position:absolute;top:10px;left:24px;right:24px;background:white;padding:12px;border:1px solid #dce2ec;border-radius:12px}.mobile-nav a{display:block;padding:8px}.article-byline{flex-direction:column;align-items:flex-start}.brand{font-size:15px}.nav>.button{font-size:12px}.article h1{font-size:36px;line-height:1.25}.archive-card .cover{width:140px;height:140px}.pipeline{font-size:12px}.pipeline th,.pipeline td{padding:10px}}@media(max-width:520px){.home-research .section-grid{grid-template-columns:1fr}.section-grid{grid-template-columns:1fr}.archive-card{display:block}.archive-card .cover{width:100%;height:190px}.search-row{flex-direction:column}.hero h1{font-size:36px;line-height:1.1}.brand img{display:none}.hero p{font-size:16px}.container{padding:0 16px}h2{font-size:28px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;

export function renderShibaPortfolio(
  doc: PortfolioDocument,
  options: RenderOptions,
): Record<string, string> {
  const { baseUrl, asset } = options,
    p = doc.profile,
    seo = portfolioSeo(doc);
  const logoId = p.logoId || p.portraitId;
  const aboutSlug = doc.navigation.pageSettings?.about?.slug || "about";
  const contactSlug = doc.navigation.pageSettings?.contact?.slug || "contact";
  const researchSlug =
    doc.navigation.pageSettings?.research?.slug || "research";
  const allSections = [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ];
  const all = allSections.filter((s) => s.visible);
  const contactVisible =
    !allSections.some((s) => s.type === "contact") ||
    all.some((s) => s.type === "contact");
  const articleSections =
    doc.navigation.articlesEnabled === false
      ? []
      : all.filter((s) => s.type === "articles");
  const articles = articleSections.flatMap((s) => s.entries);
  const researchSections = all.filter((s) => s.type === "publications");
  const research = researchSections.flatMap((s) => s.entries);
  const researchIds = new Set(research.map((entry) => entry.id));
  const researchCategories = [
    ...new Set(research.map((a) => a.category || a.subtitle).filter(Boolean)),
  ];
  const categories = [
    ...new Set(articles.map((a) => a.category || a.subtitle).filter(Boolean)),
  ];
  const bioVisible = all.some((s) => s.type === "about");
  const url = (a: Entry) =>
    `${baseUrl}/${researchIds.has(a.id) ? researchSlug : "article"}/${a.id}`;
  const date = (a: Entry) =>
    a.start
      ? formatDate(
          a.start,
          doc.seo.language === "en" ? "en-GB" : doc.seo.language,
        )
      : doc.labels.dateUnknown || "Date not specified";
  const cover = (a: Entry) =>
    a.coverId
      ? `<img class="cover" src="${e(asset(a.coverId))}" alt="${e(a.coverAlt || a.title)}" loading="lazy">`
      : "";
  const links = (address: string) =>
    `<a href="${e(baseUrl)}">${e(doc.navigation.homeLabel || "HOME")}</a>${researchSections.length ? `<a href="${e(baseUrl)}/${researchSlug}">${e(doc.navigation.pageSettings?.research?.title || "RESEARCH")}</a>` : ""}${articleSections.length ? `<a href="${e(baseUrl)}/article">${e(doc.labels.articlesHeading || "Articles")}</a>` : ""}${bioVisible ? `<a href="${e(baseUrl)}/${aboutSlug}">${e(doc.navigation.pageSettings?.about?.title || "ABOUT ME")}</a>` : ""}${contactVisible ? `<a href="${e(baseUrl)}/${contactSlug}">${e(doc.navigation.contactLabel || "CONTACT")}</a>` : ""}${doc.pages
      .filter(
        (page) =>
          !(
            (bioVisible && page.slug === aboutSlug) ||
            (contactVisible && page.slug === contactSlug) ||
            (researchSections.length && page.slug === researchSlug)
          ),
      )
      .map(
        (page) =>
          `<a href="${e(baseUrl)}/${e(page.slug)}">${e(page.title)}</a>`,
      )
      .join("")}`.replace(/<a href="([^"]+)"/g, (tag, href: string) => {
      const current = e(address);
      return current === href ||
        (href !== e(baseUrl) && current.startsWith(href + "/"))
        ? `${tag} aria-current="page"`
        : tag;
    });
  const shell = (
    title: string,
    content: string,
    address: string,
    schema: unknown = { "@type": "Person", name: p.name },
    description = seo.description,
    socialImageId = seo.socialImageId,
  ) =>
    `<!doctype html><html lang="${e(doc.seo.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="${doc.seo.indexable ? "index,follow" : "noindex,nofollow"}"><link rel="canonical" href="${e(address)}"><link rel="icon" href="${e(options.faviconUrl || `${baseUrl}/favicon.svg`)}"><meta property="og:title" content="${e(address === baseUrl ? seo.title : title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(address)}"><meta property="og:type" content="${(schema as { "@type"?: string })["@type"] === "ScholarlyArticle" ? "article" : "website"}"><meta property="og:site_name" content="${e(p.name)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(address === baseUrl ? seo.title : title)}"><meta name="twitter:description" content="${e(description)}">${socialImageId ? `<meta property="og:image" content="${e(asset(socialImageId))}"><meta property="og:image:alt" content="${e(title)}"><meta name="twitter:image" content="${e(asset(socialImageId))}">` : ""}<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("inter.woff2") : `${baseUrl}/fonts/inter.woff2`)}') format('woff2')}@font-face{font-family:Merriweather;font-style:normal;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("merriweather.woff2") : `${baseUrl}/fonts/merriweather.woff2`)}') format('woff2')}@font-face{font-family:Merriweather;font-style:italic;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("merriweather-italic.woff2") : `${baseUrl}/fonts/merriweather-italic.woff2`)}') format('woff2')}@font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:swap;src:url('${e(options.fontUrl ? options.fontUrl("geist-mono.woff2") : `${baseUrl}/fonts/geist-mono.woff2`)}') format('woff2')}${css}${shibaPagesCss}${shibaHomeCss}${shibaArticleCss}</style><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...(schema as object) }).replace(/</g, "\\u003c")}</script></head><body class="shiba"><a class="skip" href="#main">Skip to content</a><header class="topbar"><div class="container nav"><a class="brand" href="${e(baseUrl)}">${logoId ? `<img class="${p.logoId ? "brand-logo" : "brand-portrait"}" src="${e(asset(logoId))}" alt="">` : ""}<span class="brand-name">${e(doc.navigation.siteTitle || p.name)}</span></a><nav class="nav-links" aria-label="Main navigation">${links(address)}</nav><div class="nav-actions">${p.cvId ? `<a class="button header-cv" href="${e(asset(p.cvId))}" download>${homeIcon("download")}<span class="cv-long">${e(doc.navigation.cvLabel || "Download CV")}</span><span class="cv-short">${e(doc.navigation.mobileCvLabel || "CV")}</span></a>` : ""}<button class="mobile-menu-toggle" type="button" aria-label="${e(doc.navigation.menuLabel || "Menu")}" aria-expanded="false" aria-controls="mobile-navigation" data-menu-toggle>${homeIcon("menu")}</button></div><nav id="mobile-navigation" class="mobile-nav" aria-label="Mobile navigation" hidden>${links(address)}</nav></div></header><main id="main" class="container">${content}</main><footer class="footer"><div class="container"><span>${e(doc.navigation.copyright || `© ${p.name}${p.headline ? " | " + p.headline : ""}`)}</span><span>${e(doc.navigation.footer)}<span class="footer-links">${(
      doc.navigation.footerLinks || []
    )
      .filter((l) => l.url)
      .map(
        (l) =>
          `<a href="${e(l.url)}" rel="noopener noreferrer">${e(l.label)}</a>`,
      )
      .join(
        "<span>•</span>",
      )}</span></span></div></footer><script>${shibaScript}</script></body></html>`;
  const card = (a: Entry) =>
    `<article class="card" data-home-article data-category="${e(a.category || a.subtitle)}"><a href="${e(url(a))}">${cover(a)}<h3>${e(a.title)}</h3></a><p class="abstract-excerpt">${e(a.body.slice(0, 500))}</p><p class="meta">${homeIcon("calendar")}${e(date(a))}</p>${a.category || a.subtitle ? `<div class="home-category"><strong>${e(doc.labels.category || "Category")}</strong><span>${e(a.category || a.subtitle)}</span></div>` : ""}</article>`;
  const entry = (a: Entry) =>
    `<article class="entry"><p class="eyebrow">${e(a.start)}${a.current ? " | Present" : a.end ? " | " + e(a.end) : ""}</p><h3>${e(a.title)}</h3><p class="meta">${e(a.subtitle)}</p>${prose(a.body)}${a.mediaId && options.isImage?.(a.mediaId) ? `<img class="entry-image" src="${e(asset(a.mediaId))}" alt="${e(a.coverAlt || a.title)}" loading="lazy">` : ""}${a.url ? `<a href="${e(a.url)}" rel="noopener noreferrer">View resource ↗</a>` : ""}${a.mediaId ? ` <a href="${e(asset(a.mediaId))}">Download file ↓</a>` : ""}</article>`;
  const section = (s: Section) =>
    `<section class="section section-${s.type}" id="${e(s.id)}"><div class="section-head"><h2>${e(s.title)}</h2>${prose(s.intro)}</div>${s.type === "about" ? prose(p.bio) : ""}<div class="timeline">${s.entries.map(entry).join("")}</div>${s.type === "contact" ? `<form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${e(options.siteId)}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>NAME *<input name="name" required maxlength="120" autocomplete="name"></label><label>EMAIL ADDRESS *<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>MESSAGE *<textarea name="message" rows="5" required minlength="10" maxlength="5000"></textarea></label><button class="button">Send inquiry</button></form>${p.email ? `<p><a href="mailto:${e(p.email)}">${e(p.email)}</a></p>` : ""}` : ""}</section>`;
  const pipeline = research.some((a) => a.status && a.status !== "published")
    ? `<section class="home-pipeline"><h2>${e(doc.labels.pipelineHeading || "Publication Pipeline")}</h2><p class="muted">${e(doc.labels.pipelineIntro || "Active journals and conference submissions.")}</p><div class="pipeline-scroll"><table class="pipeline"><thead><tr><th>${e(doc.labels.researchTitle || "Research title")}</th><th>${e(doc.labels.targetVenue || "Target venue")}</th><th>${e(doc.labels.date || "Date")}</th><th>${e(doc.labels.status || "Status")}</th></tr></thead><tbody>${research
        .filter((a) => a.status && a.status !== "published")
        .map(
          (a) =>
            `<tr><td><a href="${e(url(a))}">${e(a.title)}</a><p>${e(a.authors)}</p></td><td>${e(a.journal || a.subtitle || "Not specified")}</td><td>${e(date(a))}</td><td>${e(a.status)}</td></tr>`,
        )
        .join("")}</tbody></table></div></section>`
    : "";
  const homeSections = all.filter(
    (s) =>
      !s.destination || s.destination === "auto" || s.destination === "home",
  );
  const home = `${homeHero(doc, options, bioVisible)}${researchSections.length ? `<section class="section home-research" id="research" data-home-research><h2>${e(doc.labels.recentArticles || "Recent Research Articles")}</h2><p class="muted">${e(doc.labels.researchIntro || "Latest publications and research insights.")}</p><div class="columns"><div><div class="section-grid">${research.slice(0, 10).map(card).join("")}</div><p data-home-empty hidden>No articles in this category yet.</p></div><aside class="card home-topics"><h3>${e(doc.labels.researchTopics || "Research topics")}</h3><button class="category" data-home-category="" aria-pressed="true">${e(doc.labels.allResearch || "All Research")}</button>${researchCategories.map((category) => `<button class="category" data-home-category="${e(category)}" aria-pressed="false">${e(category)}</button>`).join("")}</aside></div><div class="actions"><a class="button outline" href="${e(baseUrl)}/${researchSlug}">${e(doc.labels.viewAllResearch || "View All Research")}</a></div></section>` : ""}${pipeline}${homeHistory(doc, homeSections, options)}${homeSections
    .filter(
      (s) =>
        ["projects", "skills", "custom", "contact"].includes(s.type) &&
        !(s.type === "custom" && /research interests/i.test(s.title)),
    )
    .map((s) =>
      s.type === "contact" ? homeContact(doc, options, s) : section(s),
    )
    .join("")}`;
  const pages: Record<string, string> = {
    "index.html": shell(portfolioTabTitle(doc), home, baseUrl),
  };
  if (bioVisible)
    pages[`${aboutSlug}/index.html`] = shell(
      portfolioTabTitle(
        doc,
        doc.navigation.pageSettings?.about?.title || "About Me",
      ),
      renderAboutPage(doc, options, all, contactVisible),
      `${baseUrl}/${aboutSlug}`,
    );
  if (contactVisible)
    pages[`${contactSlug}/index.html`] = shell(
      portfolioTabTitle(
        doc,
        doc.navigation.pageSettings?.contact?.title || "Contact",
      ),
      renderContactPage(doc, options, all),
      `${baseUrl}/${contactSlug}`,
    );
  if (aboutSlug !== "about" && pages[`${aboutSlug}/index.html`])
    pages["about/index.html"] = pages[`${aboutSlug}/index.html`];
  if (contactSlug !== "contact" && pages[`${contactSlug}/index.html`])
    pages["contact/index.html"] = pages[`${contactSlug}/index.html`];
  for (const page of doc.pages) {
    if (
      (bioVisible && page.slug === aboutSlug) ||
      (contactVisible && page.slug === contactSlug)
    )
      continue;
    pages[`${page.slug}/index.html`] = shell(
      portfolioTabTitle(doc, page.title),
      `<section class="section"><h1>${e(page.title)}</h1>${prose(page.description)}</section>${page.sections
        .filter(
          (s) => s.visible && !["publications", "articles"].includes(s.type),
        )
        .map(section)
        .join("")}`,
      `${baseUrl}/${page.slug}`,
    );
  }
  if (articleSections.length || researchSections.length) {
    const archiveContent = (items: Entry[], title: string, noun: string) => {
      const introduction = (
        noun === "papers" ? researchSections : articleSections
      )
        .map((section) => prose(section.intro))
        .join("");
      const archiveCategories = [
        ...new Set(items.map((a) => a.category || a.subtitle).filter(Boolean)),
      ];
      const archiveCard = (a: Entry) =>
        `<article class="card archive-card" data-article data-citations="${a.citationCount || 0}" data-title="${e(a.title)}" data-date="${e(a.start)}" data-category="${e(a.category || a.subtitle)}" data-tags="${e(
          JSON.stringify(
            a.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        )}" data-search="${e([a.title, a.authors, a.start, a.tags, a.category, a.body.slice(0, 500)].join(" ").toLocaleLowerCase())}">${cover(a)}<div><p class="meta">${e(date(a))} <span>${Math.max(1, Math.ceil((a.fullText || a.body).split(/\s+/).length / 200))} ${e(doc.labels.minutesRead || "min read")}</span></p><h3><a href="${e(url(a))}">${e(a.title)}</a></h3><p class="abstract-excerpt">${e(a.body.slice(0, 500))}</p><div class="tags"><span class="tag">${e(a.category || a.subtitle || "Research")}</span>${a.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 2)
          .map(
            (t) =>
              `<button class="tag" data-topic="${e(t)}" aria-pressed="false">${e(t)}</button>`,
          )
          .join(
            "",
          )}<a href="${e(url(a))}">${e(doc.labels.viewAbstract || "View Abstract")} →</a></div></div></article>`;
      const side = `<aside class="sidebar"><section><h3>${e(doc.labels.categories || "Categories")}</h3><button class="category" data-category="" aria-pressed="true">${e(noun === "papers" ? doc.labels.allResearch || "All Research" : doc.labels.allArticles || "All Articles")} <span>${items.length}</span></button>${archiveCategories.map((c) => `<button class="category" data-category="${e(c)}" aria-pressed="false">${e(c)} <span>${items.filter((a) => (a.category || a.subtitle) === c).length}</span></button>`).join("")}</section><section><h3>${e(doc.labels.mostCited || "Most Cited")}</h3>${[
        ...items,
      ]
        .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
        .slice(0, 3)
        .map(
          (a) =>
            `<p><a href="${e(url(a))}">${e(a.title)}</a>${a.citationCount ? `<span class="meta"> · ${a.citationCount} citations</span>` : ""}</p>`,
        )
        .join(
          "",
        )}</section><section><h3>${e(doc.labels.trendingTopics || "Trending Topics")}</h3><div class="tags">${(doc.navigation.trendingTopics?.filter(
        Boolean,
      ).length
        ? doc.navigation.trendingTopics.filter(Boolean)
        : [
            ...new Set(
              items.flatMap((a) =>
                a.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              ),
            ),
          ]
      )
        .slice(0, 50)
        .map(
          (t) =>
            `<button class="tag" data-topic="${e(t)}" aria-pressed="false">#${e(t)}</button>`,
        )
        .join("")}</div></section></aside>`;
      return `<section class="archive" data-archive data-noun="${e(noun)}" data-page-size="${doc.navigation.archivePageSize || 3}" data-sort="${doc.navigation.archiveSort || "oldest"}"><h1>${e(title)}</h1>${introduction ? `<div class="archive-intro">${introduction}</div>` : ""}<div class="search-row"><input type="search" aria-label="${e(doc.labels.searchArticles || "Search articles")}" placeholder="${e(doc.labels.searchPlaceholder || "Search by title, keyword, or year...")}"><select aria-label="${e(doc.labels.sortArticles || "Sort articles")}"><option value="newest">${e(doc.labels.newestFirst || "Newest First")}</option><option value="oldest">${e(doc.labels.oldestFirst || "Oldest First")}</option><option value="cited">${e(doc.labels.mostCited || "Most Cited")}</option><option value="title">${e(doc.labels.titleSort || "Title A–Z")}</option></select></div><p class="meta" data-result-count aria-live="polite">${items.length} ${e(noun)}</p><div class="columns"><div><div data-article-list>${items
        .slice(0, doc.navigation.archivePageSize || 3)
        .map(archiveCard)
        .join("")}</div><template data-archive-rest>${items
        .slice(doc.navigation.archivePageSize || 3)
        .map(archiveCard)
        .join(
          "",
        )}</template><p data-empty hidden>${e(doc.labels.noResults || "No results found matching your criteria.")}</p><nav class="archive-pagination" data-pagination aria-label="Pagination" data-previous="${e(doc.labels.previousPage || "Previous page")}" data-next="${e(doc.labels.nextPage || "Next page")}"></nav></div>${side}</div></section>`;
    };
    if (articleSections.length)
      pages["article/index.html"] = shell(
        portfolioTabTitle(doc, doc.labels.articlesHeading || "Articles"),
        archiveContent(
          articles,
          doc.labels.articlesHeading || "Articles",
          "articles",
        ),
        `${baseUrl}/article`,
      );
    if (researchSections.length) {
      const extra = (
        doc.pages.find((page) => page.slug === researchSlug)?.sections || []
      )
        .filter(
          (s) => s.visible && !["articles", "publications"].includes(s.type),
        )
        .map(section)
        .join("");
      pages[`${researchSlug}/index.html`] = shell(
        portfolioTabTitle(
          doc,
          doc.navigation.pageSettings?.research?.title || "Research Archive",
        ),
        archiveContent(
          research,
          doc.navigation.pageSettings?.research?.title || "Research Archive",
          "papers",
        ) + extra,
        `${baseUrl}/${researchSlug}`,
      );
      pages["publications/index.html"] = pages[`${researchSlug}/index.html`];
      // Old research archives used /article before Articles became a separate collection.
      if (!allSections.some((section) => section.type === "articles"))
        pages["article/index.html"] = pages[`${researchSlug}/index.html`];
      if (researchSlug !== "research")
        pages["research/index.html"] = pages[`${researchSlug}/index.html`];
    }
    // Keep previous publication URLs working after the archive moves to /article.
    if (!researchSections.length)
      pages["publications/index.html"] = pages["article/index.html"];
    for (const a of [...articles, ...research]) {
      const collection = researchIds.has(a.id) ? research : articles;
      const archivePath = researchIds.has(a.id) ? researchSlug : "article";
      const detailAuthor = {
        name: a.authorDetails?.name || p.name,
        affiliation:
          a.authorDetails?.affiliation ||
          (p.showAffiliation === true ? p.affiliation : ""),
        bio: a.authorDetails?.bio || p.bio,
      };
      const citations = `<section class="citations" data-citations><h3>${e(doc.labels.citationHeading || "CITE THIS ARTICLE")}</h3><div class="citation-tabs" role="tablist" aria-label="Citation style">${citationStyles.map((style, i) => `<button id="tab-${a.id}-${i}" role="tab" data-citation-tab aria-controls="cite-${a.id}-${i}" aria-selected="${i === 0}">${style}</button>`).join("")}</div>${citationStyles.map((style, i) => `<div id="cite-${a.id}-${i}" role="tabpanel" aria-labelledby="tab-${a.id}-${i}"${i ? " hidden" : ""}><pre>${e(articleCitation(a, url(a), style))}</pre></div>`).join("")}<button class="button outline" data-copy="citation" data-copied="${e(doc.labels.copied || "Copied")}" data-fallback="${e(doc.labels.copyFallback || "Select and copy")}">${homeIcon("copy")}<span data-button-label>${e(doc.labels.copyCitation || "Copy Citation")}</span></button></section>`;
      const relatedItems = collection
        .filter((x) => x.id !== a.id)
        .sort(
          (x, y) =>
            Number(y.category === a.category) -
            Number(x.category === a.category),
        );
      const related = relatedItems
        .slice(0, 3)
        .map(
          (x) =>
            `<a class="related-item" href="${e(url(x))}">${cover(x)}<div><strong>${e(x.title)}</strong><p class="meta">${e(date(x))}${x.category ? " • " + e(x.category) : ""}</p></div></a>`,
        )
        .join("");
      const author = `<aside class="sidebar">${a.display?.author !== false ? `<section class="author-card"><p class="eyebrow">${e(doc.labels.aboutAuthor || "About the author")}</p>${p.portraitId && !a.authorDetails?.name ? `<img src="${e(asset(p.portraitId))}" alt="${e(detailAuthor.name)}">` : ""}<h3>${e(detailAuthor.name)}</h3>${detailAuthor.affiliation ? `<p class="eyebrow">${e(detailAuthor.affiliation)}</p>` : ""}${bioVisible || a.authorDetails?.bio ? prose(detailAuthor.bio) : ""}</section>` : ""}${a.display?.related !== false && related ? `<section><h3>${e(researchIds.has(a.id) ? doc.labels.relatedResearch || "Related Research" : doc.labels.relatedArticles || "Related Articles")}</h3>${related}</section>` : ""}${
        a.tags
          ? `<section><h3>${e(doc.labels.tagsHeading || "Tags")}</h3><div class="tags">${a.tags
              .split(",")
              .filter(Boolean)
              .map(
                (t) =>
                  `<a class="tag" href="${e(baseUrl)}/${archivePath}?topic=${e(encodeURIComponent(t.trim()))}">${e(t.trim())}</a>`,
              )
              .join("")}</div></section>`
          : ""
      }</aside>`;
      const content = `<article class="article"><a class="back" href="${e(baseUrl)}/${archivePath}">← ${e(researchIds.has(a.id) ? doc.labels.backResearch || "Back to Research Archive" : doc.labels.backArticles || "Back to Articles")}</a><div class="columns"><div><span class="pill">${e(a.category || a.subtitle || "Research")}</span><h1>${e(a.title)}</h1><div class="article-byline"><p class="authors">${e(a.authors)}</p><p class="muted">${e(doc.labels.published || "Published")} ${e(date(a))}</p></div><div class="actions">${a.mediaId ? `<a class="button" href="${e(asset(a.mediaId))}" download>${homeIcon("download")}${e(doc.labels.downloadPdf || "Download as PDF")}</a>` : ""}${a.url ? `<a class="button outline" href="${e(a.url)}" rel="noopener noreferrer">${e(doc.labels.readPublication)} ↗</a>` : ""}<button class="button outline" data-copy-url="${e(url(a))}" data-copied="${e(doc.labels.copied || "Copied")}" data-fallback="${e(doc.labels.copyFallback || "Select and copy")}">${homeIcon("link")}<span data-button-label>${e(doc.labels.copyUrl || "Copy article URL")}</span></button></div>${a.display?.abstract !== false && a.body.trim() ? `<section class="abstract article-text"><h2>${e(doc.labels.abstract)}</h2>${prose(a.body)}${a.abstractSource === "generated" ? `<p class="meta">${e(doc.labels.summaryNote)}</p>` : ""}</section>` : ""}${a.display?.images !== false && a.coverId && !(a.images || []).some((image) => image.mediaId === a.coverId) ? `<img class="entry-image article-cover" src="${e(asset(a.coverId))}" alt="${e(a.coverAlt || a.title)}">` : ""}${a.display?.fullText !== false && a.fullText ? `<section class="article-text">${prose(a.fullText)}</section>` : ""}${(a.display?.images === false ? [] : a.images || []).map((image) => `<figure class="article-figure"><img class="entry-image" src="${e(asset(image.mediaId))}" alt="${e(image.alt)}" loading="lazy">${image.caption ? `<figcaption>${e(image.caption)}</figcaption>` : ""}</figure>`).join("")}${a.display?.citations !== false ? citations : ""}</div>${author}</div></article>${
        a.display?.related !== false && relatedItems.length
          ? `<section class="section continue-reading"><h2>${e(doc.labels.continueReading || "Continue reading")}</h2><a href="${e(baseUrl)}/${archivePath}">${e(researchIds.has(a.id) ? doc.labels.viewAllResearch || "View All Research" : doc.labels.viewAllArticles || "View All Articles")}</a><div class="section-grid">${collection
              .filter((other) => other.id !== a.id)
              .slice(0, 3)
              .map(card)
              .join("")}</div></section>`
          : ""
      }`;
      const rendered = shell(
        portfolioTabTitle(doc, a.title),
        content,
        url(a),
        {
          "@type": "ScholarlyArticle",
          headline: a.title,
          abstract: a.body,
          author: authorNames(a.authors, a.authorFormat).map((name) => ({
            "@type": "Person",
            name,
          })),
          ...(a.start ? { datePublished: a.start } : {}),
          ...(a.doi ? { identifier: a.doi } : {}),
        },
        a.body.slice(0, 300) || seo.description,
        a.coverId || seo.socialImageId,
      );
      pages[`${archivePath}/${a.id}/index.html`] = rendered;
      // Historical links continue working, without mixing the two archives.
      if (researchIds.has(a.id))
        pages[`research/${a.id}/index.html`] = rendered;
      pages[`article/${a.id}/index.html`] = rendered;
      pages[`publications/${a.id}/index.html`] = rendered;
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
  pages["favicon.svg"] = initialsFavicon(p.name, "#1447e6");
  return pages;
}
