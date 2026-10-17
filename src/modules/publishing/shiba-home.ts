import type {
  PortfolioDocument,
  Section,
  Entry,
} from "@/modules/portfolios/schema";
import type { RenderOptions } from "./render";
import { escapeHtml as e } from "./render";

const paths: Record<string, string> = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/>',
  website:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  scholar:
    '<path d="M12 7v14M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
  github:
    '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-2-1-2 4 0 7-2 7-6 0-2-.5-3-2-4 0-1 0-3-1-4-2 0-3 1-4 2a13 13 0 0 0-4 0C9 3 7 2 5 2 4 3 4 5 4 6c-1 1-2 2-2 4 0 4 3 6 7 6-.7.5-1 1-1 2v4"/>',
  linkedin:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M7 7v.01M11 17v-7m0 3c0-4 6-4 6 0v4"/>',
  orcid:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6 19v-2a6 6 0 0 1 12 0v2"/>',
  twitter:
    '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  link: '<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/>',
};
export const homeIcon = (name: string) =>
  `<svg class="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.link}</svg>`;
export const socialIcon = (
  link: PortfolioDocument["profile"]["links"][number],
) => {
  let host = "";
  try {
    host = new URL(link.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    /* An unfinished editor URL uses the generic website icon. */
  }
  const kind =
    link.icon && link.icon !== "auto"
      ? link.icon
      : /personal website|portfolio|homepage/i.test(link.label) ||
          host.endsWith(".github.io")
        ? "website"
        : host === "orcid.org"
          ? "orcid"
          : host === "twitter.com" || host === "x.com"
            ? "twitter"
            : host === "github.com"
              ? "github"
              : host === "scholar.google.com" || host === "researchgate.net"
                ? "scholar"
                : host === "linkedin.com"
                  ? "linkedin"
                  : link.url.startsWith("mailto:")
                    ? "mail"
                    : "website";
  return kind === "none" ? "" : homeIcon(kind);
};
const prose = (text: string) =>
  text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export function homeHero(
  doc: PortfolioDocument,
  options: RenderOptions,
  bioVisible: boolean,
) {
  const p = doc.profile,
    headline = p.heroHeadline || p.headline || p.name;
  const highlight = p.headlineHighlight?.trim(),
    at = highlight ? headline.indexOf(highlight) : -1;
  const title =
    highlight && at >= 0
      ? `${e(headline.slice(0, at))}<span>${e(highlight)}</span>${e(headline.slice(at + highlight.length))}`
      : e(headline);
  const badge = p.heroBadge ?? p.headline;
  return `<section class="hero"><div class="hero-copy">${badge ? `<div class="hero-badge">${homeIcon("sparkles")}<span>${e(badge)}</span></div>` : ""}<h1>${title}</h1>${bioVisible ? `<div class="hero-intro">${prose(p.heroIntro ?? p.bio)}</div>` : ""}<div class="actions hero-actions">${p.links
    .filter((l) => l.url && l.showInHero !== false)
    .map(
      (l, i) =>
        `<a class="button${i ? " outline" : ""}" href="${e(l.url)}" rel="noopener noreferrer">${socialIcon(l)}${e(l.label)}</a>`,
    )
    .join(
      "",
    )}</div></div>${p.portraitId ? `<div class="hero-photo"><img class="hero-portrait" src="${e(options.asset(p.portraitId))}" alt="${e(p.name)}" fetchpriority="high" width="500" height="625" style="object-position:${p.portraitPositionX ?? 50}% ${p.portraitPositionY ?? 50}%"></div>` : ""}</section>`;
}

export function homeHistory(
  doc: PortfolioDocument,
  sections: Section[],
  options: RenderOptions,
) {
  const history = sections.filter((s) =>
    ["education", "experience", "awards"].includes(s.type),
  );
  const interests = sections.filter(
    (s) =>
      s.type === "interests" ||
      (s.type === "custom" && /research interests/i.test(s.title)),
  );
  if (!history.length && !interests.length) return "";
  const date = (a: Entry) =>
    [a.start, a.current ? doc.labels.ongoing : a.end]
      .filter(Boolean)
      .join(" | ");
  const resource = (a: Entry) =>
    `${a.mediaId && options.isImage?.(a.mediaId) ? `<img class="entry-image" src="${e(options.asset(a.mediaId))}" alt="${e(a.title)}" loading="lazy">` : ""}${a.mediaId ? `<a href="${e(options.asset(a.mediaId))}">${e(doc.labels.downloadFile)}</a>` : ""}`;
  return `<section class="home-history"><div><h2>${e(doc.labels.timelineHeading || "Education & Experience")}</h2>${history.map((s) => prose(s.intro)).join("")}<div class="home-history-list">${history
    .flatMap((s) => s.entries)
    .map(
      (a) =>
        `<article><span class="history-date">${e(date(a))}</span><div><h3>${e(a.title)}</h3><p class="history-place">${e(a.subtitle)}</p><div class="history-description">${prose(a.body)}</div>${resource(a)}${a.url ? `<a href="${e(a.url)}" rel="noopener noreferrer">${e(doc.labels.viewResource)}</a>` : ""}</div></article>`,
    )
    .join("")}</div></div>${
    interests.length
      ? `<aside class="home-interest-panel">${interests
          .map(
            (s) =>
              `<h3>${e(s.title)}</h3>${prose(s.intro)}${s.entries.map((a) => `<h4>${e(a.title)}</h4>${prose(a.body)}`).join("")}<div class="interest-tags">${[
                ...new Set(
                  s.entries.flatMap((a) =>
                    a.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                ),
              ]
                .map((t) => `<span>${e(t)}</span>`)
                .join("")}</div>`,
          )
          .join("")}</aside>`
      : ""
  }</section>`;
}

export function homeContact(
  doc: PortfolioDocument,
  options: RenderOptions,
  section: Section,
) {
  const p = doc.profile,
    l = doc.labels;
  return `<section class="home-contact" id="${e(section.id)}"><div class="home-contact-inner"><h2>${e(section.title)}</h2>${prose(section.intro)}<form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${e(options.siteId)}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><div class="home-contact-pair"><label>${e(l.name)} *<input name="name" required maxlength="120" autocomplete="name"></label><label>${e(l.email)} *<input name="email" type="email" required maxlength="254" autocomplete="email"></label></div><label>${e(l.subject || "Subject")}<input name="subject" maxlength="200"></label><label>${e(l.message)} *<textarea name="message" rows="4" required minlength="10" maxlength="5000"></textarea></label><button class="button">${e(l.send)}</button></form><div class="home-contact-links">${p.email ? `<a href="mailto:${e(p.email)}"><span>${homeIcon("mail")}</span>${e(l.email)}</a>` : ""}${p.links
    .filter((a) => a.url)
    .map(
      (a) =>
        `<a href="${e(a.url)}" rel="noopener noreferrer"><span>${socialIcon(a)}</span>${e(a.label)}</a>`,
    )
    .join("")}</div></div></section>`;
}

// Measurements from the reference's 375px mobile and 1440px desktop layouts.
export const shibaHomeCss = `
.home-icon{width:20px;height:20px;flex-shrink:0;vertical-align:middle}.container{max-width:1200px}.topbar{background:#ffffffcc;backdrop-filter:blur(12px);border-color:#e2e8f0}.nav{gap:24px;position:relative}.brand{gap:12px;min-width:0}.brand img{display:block;width:40px;height:40px;flex-shrink:0;border-radius:10px}.brand-name{min-width:0;overflow-wrap:anywhere}.nav-actions{display:flex;align-items:center;gap:12px;flex-shrink:0}.header-cv{font-size:12px;font-weight:700;line-height:16px;padding:8px 16px;gap:8px;background:#1447e6;white-space:nowrap}.header-cv .home-icon{width:16px;height:16px}.cv-short{display:none}.mobile-menu-toggle{display:none;border:0;background:transparent;padding:8px;border-radius:10px;color:#18181b}.mobile-nav{display:none;position:absolute;top:64px;left:0;right:0;padding:16px 24px;background:#fff;border-bottom:1px solid #e2e8f0;box-shadow:0 8px 12px #0f172b0d}.mobile-nav a{display:block;padding:12px;color:#18181b;font-size:14px;font-weight:700;text-transform:uppercase}.mobile-nav a:hover{background:#f1f5f9}.hero{display:flex;flex-direction:row;gap:48px;padding:80px 0;border-bottom:1px solid #e2e8f0}.hero-copy{flex:1;min-width:0}.hero-badge{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:4px 12px;border-radius:999px;background:#e7ecfc;color:#1447e6;font-size:12px;font-weight:700;line-height:16px;letter-spacing:.6px;text-transform:uppercase;margin:0 0 24px}.hero-badge .home-icon{width:14px;height:14px}.hero h1{font-size:60px;font-weight:900;line-height:1.1;letter-spacing:-1.5px;margin:0 0 24px;overflow-wrap:anywhere}.hero h1 span{color:#1447e6}.hero-intro p{font-size:18px;line-height:29.25px;color:#45556c;margin:0 0 24px;max-width:672px}.hero-actions{gap:16px;margin:0;padding-top:16px}.hero-actions .button{font-size:16px;line-height:24px;font-weight:700;padding:12px 24px;gap:8px;background:#0f172b;box-shadow:none;border-radius:10px}.hero-actions .button.outline{background:#e2e8f0;color:#0f172b}.hero-actions .button:hover{transform:scale(1.03)}.hero-photo{flex:1;width:100%;max-width:500px;min-width:0}.hero-portrait{display:block;width:100%;height:auto;max-height:none;aspect-ratio:4/5;object-fit:cover;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 25px 50px -12px #0004}.home-research{padding:80px 0;border-top:0;border-bottom:1px solid #e2e8f0}.home-research>h2{margin:0}.home-research>.muted{font-size:16px;line-height:24px;margin:8px 0 40px}.home-research .columns{grid-template-columns:minmax(0,1fr) 256px;gap:32px}.home-research .section-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}.home-research .card{display:flex;flex-direction:column;border-color:#e2e8f0;border-radius:14px;padding:16px}.home-research .card h3{font-size:14px;font-weight:700;line-height:20px;margin:0 0 8px}.home-research .cover{display:block;height:128px;border-radius:10px;margin:0 0 16px}.home-research .card p.abstract-excerpt{font-size:12px;line-height:16px;color:#45556c;margin:0 0 4px}.home-research .card p.meta{display:flex;gap:4px;align-items:center;font-size:10px;font-weight:600;line-height:15px;margin:0 0 16px;color:#90a1b9}.home-research .meta .home-icon{width:12px;height:12px}.home-category{background:#f3f6fe;border-left:2px solid #1447e6;padding:8px;border-radius:0 10px 10px 0;margin-top:auto}.home-category strong{display:block;text-transform:uppercase;color:#1447e6;font-size:8px;font-weight:900;line-height:12px}.home-category span{display:block;font-size:10px;line-height:15px;font-weight:500}.home-topics{padding:24px!important;background:#f8fafc!important}.home-topics h3{font-size:12px;line-height:16px;letter-spacing:1.2px;margin:0 0 16px!important;color:#90a1b9}.home-topics .category{font-size:14px;line-height:20px;padding:8px 16px!important;border-radius:12px!important;border-bottom:0!important;margin:4px 0;white-space:normal}.home-pipeline{padding:80px 32px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:22px}.home-pipeline>h2,.home-pipeline>.muted{text-align:center}.home-pipeline>h2{margin:0 0 8px}.home-pipeline>.muted{font-size:16px;margin-bottom:40px}.pipeline-scroll{overflow-x:auto}.pipeline th{background:#f1f5f9;font-size:12px;line-height:16px;letter-spacing:.6px}.pipeline td{font-size:14px;line-height:20px}.pipeline td:first-child>a{font-weight:700;color:#0f172b}.pipeline td p{font-size:12px;color:#62748e;margin:4px 0 0}.home-history{padding:80px 0;display:grid;grid-template-columns:1fr 1fr;gap:64px;border-top:1px solid #e2e8f0}.home-history h2{margin:0 0 32px}.home-history-list{display:grid;gap:40px}.home-history-list article{display:flex;gap:16px;min-width:0}.history-date{width:48px;min-height:48px;align-self:flex-start;flex-shrink:0;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;color:#1447e6;font-size:12px;line-height:16px;font-weight:700;padding:6px;overflow-wrap:anywhere}.home-history-list h3{font-size:16px;line-height:24px;letter-spacing:normal;margin:0}.history-place{font-size:14px;line-height:20px;color:#62748e;margin:0}.history-description p{font-size:14px;line-height:20px;color:#45556c;margin:8px 0 0}.home-interest-panel{padding:40px;background:#1447e6;color:white;border-radius:22px;display:flex;flex-direction:column;justify-content:center;overflow-wrap:anywhere}.home-interest-panel h3{font-size:24px;line-height:32px;letter-spacing:normal;color:white;margin:0 0 24px}.home-interest-panel h4{font-size:16px;color:white;margin:24px 0 8px}.home-interest-panel p{font-size:16px;line-height:26px;color:#eff6ffe6;margin:0 0 24px}.interest-tags{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}.interest-tags span{background:#ffffff20;border:1px solid #ffffff30;border-radius:6px;padding:6px 12px;font-size:12px}.home-contact{padding:80px 0;text-align:center}.home-contact-inner{max-width:672px;margin:auto}.home-contact h2{margin:0 0 16px}.home-contact-inner>p{font-size:16px;line-height:24px;color:#62748e;margin:0 0 40px}.home-contact .contact-form{padding:32px;gap:16px;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 20px 25px -5px #0000001a;margin-bottom:48px;text-align:left;max-width:none}.home-contact-pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.home-contact label{font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:#90a1b9;gap:8px}.home-contact input,.home-contact textarea{width:100%;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:10px;font-size:14px;line-height:20px;color:#0f172b}.home-contact .button{background:#1447e6;font-size:16px;line-height:24px;font-weight:700;padding:12px}.home-contact-links{display:flex;justify-content:center;gap:40px;flex-wrap:wrap}.home-contact-links a{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#90a1b9}.home-contact-links a>span{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:#f1f5f9}.footer{padding:32px 0;margin-top:0}.footer-links{display:flex;gap:12px;align-items:center}.footer-links a{color:#62748e}
@media(max-width:1279px){.hero h1{font-size:48px;letter-spacing:-1.2px}.home-research .section-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1023px){.hero{flex-direction:column;gap:48px;align-items:center}.hero-copy{width:100%}.hero h1{font-size:36px;letter-spacing:-.9px}.home-research .columns{grid-template-columns:1fr}.home-research .section-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-history{grid-template-columns:1fr}.home-topics{width:100%}}
@media(max-width:767px){.nav-links{display:none}.mobile-menu-toggle{display:inline-flex}.mobile-nav:not([hidden]){display:block}.nav{gap:12px}.home-contact-pair{grid-template-columns:1fr}}
@media(min-width:768px){.nav-links{display:flex}.mobile-nav{display:none!important}}
@media(max-width:639px){.container,.nav{padding-left:16px;padding-right:16px}.nav{height:64px}.brand{font-size:16px;line-height:24px;letter-spacing:-.4px;gap:12px}.brand img{display:block;width:32px;height:32px}.header-cv{padding:8px 12px}.cv-long{display:none}.cv-short{display:inline}.hero{padding:48px 0;gap:32px}.hero h1{font-size:30px;line-height:33px;letter-spacing:-.75px;margin:0 0 16px}.hero-badge{margin-bottom:16px}.hero-intro p{font-size:16px;line-height:26px;margin:0 0 16px}.hero-actions .button{font-size:14px;line-height:20px;padding:8px 16px}.hero-actions .home-icon{width:18px;height:18px}.hero-portrait{max-height:none}.home-research{padding:48px 0}.home-research h2,.home-history h2,.home-contact h2,.home-pipeline>h2{font-size:24px;line-height:32px;letter-spacing:-.6px}.home-research>.muted{font-size:14px;line-height:20px;margin-bottom:32px}.home-research .section-grid{grid-template-columns:1fr;gap:16px}.home-research .cover{height:128px}.home-pipeline{padding:48px 16px}.home-pipeline>.muted{font-size:14px;margin-bottom:32px}.home-history{padding:48px 0;gap:48px}.home-history h2{margin-bottom:24px}.home-history-list{gap:32px}.history-date{width:40px;min-height:40px;font-size:11px}.home-history-list h3{font-size:14px;line-height:20px}.history-place,.history-description p{font-size:12px;line-height:16px}.home-interest-panel{padding:24px}.home-interest-panel h3{font-size:20px;line-height:28px;margin-bottom:16px}.home-interest-panel p{font-size:14px;line-height:22.75px}.interest-tags{gap:8px}.home-contact{padding:48px 0}.home-contact-inner>p{font-size:14px;line-height:20px;margin-bottom:32px}.home-contact .contact-form{padding:24px;margin-bottom:32px}.home-contact .button{font-size:14px;line-height:20px}.home-contact-links{gap:24px}.home-contact-links a{font-size:10px}.home-contact-links a>span{width:40px;height:40px}.footer .container{justify-content:center;text-align:center}}
@media(prefers-reduced-motion:reduce){.hero-actions .button:hover{transform:none}}
/* Keep long dates and multiline category labels from distorting badges. */
.home-history-list article{flex-direction:column;gap:10px}.history-date{width:auto;min-height:0;max-width:100%;border-radius:8px;padding:6px 12px;white-space:nowrap;overflow-wrap:normal;font-size:12px;line-height:20px}.home-history-list article>div{min-width:0}
.category{align-items:flex-start;gap:12px}.category span{flex:0 0 auto;align-self:flex-start;min-width:24px;height:24px;padding:0 7px;line-height:24px;text-align:center;white-space:nowrap;border-radius:999px}
.nav-links a[aria-current="page"],.mobile-nav a[aria-current="page"]{color:#1447e6}.nav-links a[aria-current="page"]{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:7px}.mobile-nav a[aria-current="page"]{background:#e7ecfc;border-radius:8px}
.button,.contact-links a,.home-contact-links a,.card,.archive-card,.related-item,.about-card,.collaboration-path,.category,.citation-tabs button{transition:transform 180ms ease,box-shadow 180ms ease,background-color 180ms ease,color 180ms ease,border-color 180ms ease}
a:focus-visible,button:focus-visible{outline:2px solid #1447e6;outline-offset:4px}
@media(hover:hover) and (prefers-reduced-motion:no-preference){.button:hover,.contact-links a:hover,.home-contact-links a:hover{transform:translateY(-3px);box-shadow:0 6px 16px #1447e618}.card:hover,.archive-card:hover,.related-item:hover,.about-card:hover,.collaboration-path:hover{transform:translateY(-3px);box-shadow:0 8px 22px #0f172b12}.category:hover,.citation-tabs button:hover{background:#e8edfc}.contact-links a .home-icon,.home-contact-links .home-icon{transition:transform 180ms ease}.contact-links a:hover .home-icon,.home-contact-links a:hover .home-icon{transform:scale(1.1)}}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}.mobile-nav:not([hidden]){animation:menu-appear 160ms ease-out}@keyframes menu-appear{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}}
@media(prefers-reduced-motion:reduce){.button,.contact-links a,.home-contact-links a,.card,.archive-card,.related-item,.about-card,.collaboration-path,.category,.citation-tabs button{transition:none}}
@media(prefers-reduced-motion:no-preference){.button:active,.contact-links a:active,.category:active,.citation-tabs button:active,.mobile-menu-toggle:active{transform:scale(.98)}.mobile-menu-toggle{transition:transform 150ms ease}}
`;
