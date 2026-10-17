import type {
  PortfolioDocument,
  Section,
  Entry,
} from "@/modules/portfolios/schema";
import { escapeHtml as e, formatDate, type RenderOptions } from "./render";

const prose = (text: string) =>
  text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
const paths: Record<string, string> = {
  network:
    '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
  education:
    '<path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6M22 9v7"/>',
  experience:
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M8 7v14M16 7v14"/>',
  interests:
    '<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M8 15h8"/>',
  conferences:
    '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  awards: '<circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/>',
  link: '<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
};
const icon = (name: string) =>
  `<svg class="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.interests}</svg>`;
const entryDate = (entry: Entry, language: string) =>
  [
    entry.start && formatDate(entry.start, language),
    entry.current ? "Present" : entry.end && formatDate(entry.end, language),
  ]
    .filter(Boolean)
    .join(" | ");

export const shibaPagesCss = `.about-page,.contact-page{overflow-wrap:anywhere}.about-page{max-width:1152px;margin:auto;padding:48px 24px}.about-page>section{margin:0 0 96px}.about-hero{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:48px;align-items:center}.about-photo{grid-column:span 5;position:relative;isolation:isolate}.about-photo:before{content:'';position:absolute;inset:-8px;background:#e8edfc;border-radius:16px;transform:rotate(3deg);z-index:-1}.about-photo img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border:4px solid #fff;border-radius:12px;box-shadow:0 10px 20px #0f172b16}.about-biography{grid-column:span 7}.about-biography.no-photo{grid-column:1/-1}.about-biography>.eyebrow{font-weight:700;display:inline-block;background:#e8edfc;border-radius:3px;padding:2px 12px;font-size:12px;line-height:16px;margin-bottom:24px;letter-spacing:normal}.about-biography h1{font-size:36px;font-weight:700;line-height:45px;letter-spacing:normal;margin:0 0 24px}.about-biography p{font-size:18px;line-height:29.25px;color:#45556c;margin:0 0 24px}.about-biography .collaboration-note{font-size:14px;font-weight:500;line-height:20px;font-style:italic;border-left:2px solid #e2e8f0;padding-left:16px;margin-top:32px}.about-history{display:grid;grid-template-columns:1fr 1fr;gap:64px}.page-icon{width:24px;height:24px;flex-shrink:0;color:#1447e6}.about-history h2{display:flex;align-items:center;gap:12px;font-size:24px;line-height:32px;letter-spacing:normal;margin:0 0 32px}.about-history .about-timeline{border-left:2px solid #e2e8f0;margin-left:12px;padding-left:26px}.about-timeline article{position:relative;margin-bottom:32px}.about-timeline article:before{content:'';position:absolute;left:-37px;top:5px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:#cbd5e1}.about-timeline.experience article:before{background:#1447e6}.about-timeline .eyebrow{font-weight:700;font-size:12px;line-height:16px;color:#62748e;letter-spacing:1.2px;margin:0 0 4px}.about-timeline.experience .eyebrow{color:#1447e6}.about-timeline h3{font-size:18px;line-height:28px;letter-spacing:normal;margin:0}.about-timeline p{font-size:16px;line-height:24px;margin:0;color:#45556c}.about-timeline .entry-description p{font-size:14px;line-height:20px;margin-top:4px;color:#62748e}.about-heading{border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:32px}.about-heading h2{font-size:30px;font-weight:700;line-height:36px;letter-spacing:-.75px;margin:0 0 4px}.about-heading p{font-size:14px;line-height:20px;color:#62748e;margin:0}.about-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.about-card{border:1px solid #e2e8f0;border-radius:16px;padding:32px;background:#fff;box-shadow:0 1px 3px #0f172b08}.about-card .page-icon{margin-bottom:20px}.about-card h3{font-size:20px;line-height:28px;letter-spacing:normal;margin:0 0 12px}.about-card p{font-size:14px;line-height:22.75px;color:#62748e;margin:0}.about-publications{overflow:auto;border:1px solid #e2e8f0;border-radius:16px}.about-publications table{width:100%;border-collapse:collapse}.about-publications th{background:#f8fafc;padding:16px 24px;font-size:12px;line-height:16px;letter-spacing:1.2px;text-align:left;color:#62748e}.about-publications td{padding:24px;border-top:1px solid #f1f5f9;vertical-align:top}.about-publications h3{font-size:16px;line-height:24px;letter-spacing:normal;margin:0 0 4px}.about-publications h3 a{color:#0f172b}.about-publications p{font-size:12px;line-height:16px;font-style:italic;color:#90a1b9;margin:0}.paper-status{display:inline-block;font-size:10px;line-height:15px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:#f4f4f5;white-space:nowrap}.about-publications td:last-child{font-size:14px;white-space:nowrap;color:#62748e}.about-awards{grid-template-columns:repeat(2,minmax(0,1fr))}.about-awards .about-card{display:flex;gap:20px;align-items:center;padding:24px}.about-awards .page-icon{margin:0;width:40px;height:40px}.about-awards h3{font-size:18px;line-height:28px;margin-bottom:4px}.about-awards .eyebrow{margin-top:8px}.about-conference{display:flex;gap:20px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:16px}.about-conference h3{font-size:18px;line-height:28px;margin:0 0 4px}.about-conference p{font-size:14px;line-height:20px;color:#62748e;margin:0}.about-cta{text-align:center;border-radius:24px;background-color:#1447e6;background-image:radial-gradient(circle at 2px 2px,#ffffff15 1px,transparent 0);background-size:40px 40px;padding:64px 32px;color:#fff}.about-cta h2{font-size:36px;line-height:40px;letter-spacing:normal;margin:0 0 32px;color:#fff}.about-cta p{color:#ffffffcc;font-size:18px;line-height:28px;max-width:640px;margin:0 auto 32px}.about-cta .actions{justify-content:center}.about-cta .button{background:#fff;color:#1447e6;font-weight:700}.about-cta .button.outline{background:transparent;color:#fff;border:1px solid #ffffff66}.contact-page{max-width:1200px;margin:auto;padding:48px 24px}.contact-heading{text-align:center;margin-bottom:48px}.contact-heading h1{font-size:48px;line-height:48px;font-weight:900;margin:0 0 8px;letter-spacing:-1.2px}.contact-heading p{font-size:20px;line-height:28px;font-weight:500;color:#45556c;margin:0}.contact-heading:after{content:'';display:block;width:80px;height:4px;border-radius:3px;background:#d6def8;margin:24px auto 0}.collaboration-paths{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-bottom:12px}.collaboration-path{display:flex;flex-direction:column;align-items:flex-start;gap:16px;text-align:left;border:1px solid #dce2eb;border-radius:14px;background:#fff;padding:24px;color:#0f172b}.collaboration-path:hover,.collaboration-path[aria-pressed=true]{border-color:#1447e6;box-shadow:0 2px 10px #1447e615}.collaboration-path .page-icon{box-sizing:content-box;padding:12px;background:#e8edfc;border-radius:10px}.collaboration-path h2{font-size:20px;line-height:25px;letter-spacing:normal;margin:0}.collaboration-path p{font-size:14px;line-height:21px;color:#62748e;margin:0}.contact-layout{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}.contact-panel{border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px #0f172b10;margin-bottom:16px;background:#fff}.contact-panel h2{display:flex;align-items:center;gap:12px;font-size:16px;line-height:24px;letter-spacing:normal;margin:0 0 16px}.contact-profile{text-align:center}.contact-profile img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:4px solid #fff;outline:2px solid #d6def8;margin-bottom:18px}.contact-profile h2{display:block;font-size:18px;line-height:28px;margin:0 0 8px}.contact-panel.contact-profile p{color:#1447e6;font-size:14px;line-height:20px;font-weight:500;margin:0}.contact-profile .eyebrow{font-size:12px;line-height:16px;font-weight:400;color:#62748e;letter-spacing:1.2px;margin-top:4px}.contact-panel p{font-size:14px;line-height:20px;color:#62748e}.contact-links{display:flex;gap:8px;flex-wrap:wrap}.contact-links a{font-size:11px;font-weight:700;background:#f1f5f9;padding:7px 10px;border-radius:5px}.quick-message{grid-column:span 2;padding:32px}.quick-message h2{font-size:20px;line-height:28px;margin:0 0 32px}.quick-message .contact-form{max-width:none;grid-template-columns:1fr 1fr;gap:24px 16px}.quick-message .contact-form label{gap:6px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:normal}.quick-message .contact-form input,.quick-message .contact-form textarea{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:14px;line-height:20px}.quick-message .contact-form input:focus,.quick-message .contact-form textarea:focus{border-color:#1447e6;outline:2px solid #d6def8}.quick-message .wide{grid-column:1/-1}.quick-message .button .page-icon{color:inherit}.quick-message .button{width:100%;padding:12px;font-size:16px;font-weight:700;background:#1447e6}.contact-quote{text-align:center;font-size:18px;line-height:28px;font-style:italic;color:#62748e;margin:48px auto;max-width:720px}.page-section-extra{margin-top:48px}.contact-panel.contact-profile p.eyebrow{color:#62748e}.about-awards-group{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;padding:40px}.about-awards-group .about-heading{border:0;padding:0;margin:0}.about-awards-group .about-heading h2{font-size:24px;line-height:32px;letter-spacing:normal;margin-bottom:16px}.about-awards-group .about-heading p{font-size:16px;line-height:24px}.award-list{grid-column:span 2;display:grid;gap:16px}.award-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;background:#fff;border-radius:12px;box-shadow:0 2px 3px #0f172b12}.award-row h3{font-size:16px;line-height:24px;margin:0;letter-spacing:normal}.award-row p{font-size:14px;line-height:20px;color:#62748e;margin:0}.award-year{font-size:16px;line-height:24px;color:#1447e6;font-weight:700;flex-shrink:0}@media(max-width:1023px){.about-hero{grid-template-columns:1fr;gap:32px}.about-photo,.about-biography{grid-column:auto}.about-photo{max-width:432px;margin:auto;width:100%}.contact-layout{grid-template-columns:1fr 2fr}.quick-message{grid-column:auto}.contact-information{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:16px}.about-history{gap:32px}.about-cards,.collaboration-paths{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:639px){.about-page,.contact-page{padding:32px 0}.about-page>section{margin-bottom:64px}.about-photo{width:calc(100% - 32px)}.about-biography h1{font-size:30px;line-height:37.5px}.about-biography p{font-size:16px;line-height:26px}.about-history,.about-cards,.about-awards,.collaboration-paths,.contact-layout,.contact-information{grid-template-columns:1fr}.about-heading h2{font-size:24px;line-height:32px}.about-card{padding:24px}.about-cta{padding:40px 24px}.about-cta h2{font-size:28px;line-height:36px}.about-awards-group{grid-template-columns:1fr;padding:24px}.award-list{grid-column:auto}.contact-heading h1{font-size:36px;line-height:40px}.contact-heading p{font-size:18px;line-height:28px}.contact-heading{margin-bottom:32px}.contact-information{grid-column:auto;display:block}.quick-message{padding:24px}.quick-message .contact-form{grid-template-columns:1fr}.quick-message .wide{grid-column:auto}.about-publications th,.about-publications td{padding:12px}.about-publications table{min-width:480px}}`;

export function renderAboutPage(
  doc: PortfolioDocument,
  options: RenderOptions,
  sections: Section[],
  contactVisible = true,
) {
  const p = doc.profile,
    about = sections.filter((s) => s.type === "about"),
    asset = options.asset;
  const heading = (s: Section) =>
    `<div class="about-heading"><h2>${e(s.title)}</h2>${prose(s.intro)}</div>`;
  const history = (type: "education" | "experience") =>
    sections
      .filter((s) => s.type === type)
      .map(
        (s) =>
          `<div><h2>${icon(type)}${e(s.title)}</h2>${prose(s.intro)}<div class="about-timeline ${type}">${s.entries.map((entry) => `<article><p class="eyebrow">${e(entryDate(entry, doc.seo.language))}</p><h3>${e(entry.title)}</h3><p>${e(entry.subtitle)}</p><div class="entry-description">${prose(entry.body)}</div>${entry.url ? `<a href="${e(entry.url)}" rel="noopener noreferrer">${e(doc.labels.viewResource)} ↗</a>` : ""}${entry.mediaId ? `<a href="${e(asset(entry.mediaId))}">${e(doc.labels.downloadFile)} ↓</a>` : ""}</article>`).join("")}</div></div>`,
      )
      .join("");
  const interests = sections.filter(
    (s) =>
      s.type === "interests" ||
      (s.type === "custom" && /research interests/i.test(s.title)),
  );
  const papers = sections.filter((s) => s.type === "publications");
  const conferences = sections.filter((s) => s.type === "conferences");
  const awards = sections.filter((s) => s.type === "awards");
  const extras = sections.filter(
    (s) =>
      ![
        "about",
        "education",
        "experience",
        "publications",
        "articles",
        "awards",
        "contact",
        "conferences",
        "interests",
      ].includes(s.type) && !interests.includes(s),
  );
  const resource = (entry: Entry) =>
    entry.mediaId
      ? `<a href="${e(asset(entry.mediaId))}">${e(doc.labels.downloadFile)} ↓</a>`
      : "";
  return `<div class="about-page"><section class="about-hero">${p.portraitId ? `<div class="about-photo"><img src="${e(asset(p.portraitId))}" alt="${e(p.name)}"></div>` : ""}<div class="about-biography${p.portraitId ? "" : " no-photo"}"><span class="eyebrow">${e(doc.navigation.pageSettings?.about?.title || "ABOUT ME")}</span><h1>${e(p.aboutHeadline || p.headline || p.name)}</h1>${prose(p.aboutBio || p.bio)}${prose(doc.pages.find((page) => page.slug === (doc.navigation.pageSettings?.about?.slug || "about"))?.description || "")}${about.map((s) => prose(s.intro)).join("")}${p.collaborationNote ? `<p class="collaboration-note">${e(p.collaborationNote)}</p>` : ""}</div></section>${about.flatMap((s) => s.entries).length ? `<section>${about.map((s) => s.entries.map((entry) => `<article class="about-card"><h2>${e(entry.title)}</h2>${prose(entry.body)}${resource(entry)}</article>`).join("")).join("")}</section>` : ""}${history("education") || history("experience") ? `<section class="about-history">${history("education")}${history("experience")}</section>` : ""}${interests.map((s) => `<section>${heading(s)}<div class="about-cards">${s.entries.map((entry) => `<article class="about-card">${icon("interests")}<h3>${e(entry.title)}</h3>${prose(entry.body)}${resource(entry)}</article>`).join("")}</div></section>`).join("")}${papers.map((s) => `<section>${heading(s)}<div class="about-publications"><table><thead><tr><th scope="col">${e(doc.labels.status || "Status")}</th><th scope="col">${e(doc.labels.titleJournal || "Title & Journal")}</th><th scope="col">${e(doc.labels.year || "Year")}</th></tr></thead><tbody>${s.entries.map((entry) => `<tr><td><span class="paper-status">${e(entry.status || "Not specified")}</span></td><td><h3><a href="${e(options.baseUrl)}/${e(doc.navigation.pageSettings?.research?.slug || "research")}/${e(entry.id)}">${e(entry.title)}</a></h3>${prose(entry.journal || entry.subtitle)}${prose(entry.body)}</td><td>${e(entry.start.slice(0, 4) || "N/A")}</td></tr>`).join("")}</tbody></table></div></section>`).join("")}${conferences.map((s) => `<section>${heading(s)}${s.entries.map((entry) => `<article class="about-conference">${icon("conferences")}<div><p class="eyebrow">${e(entryDate(entry, doc.seo.language))}</p><h3>${e(entry.title)}</h3><p>${e(entry.subtitle)}</p>${prose(entry.body)}${resource(entry)}${entry.url ? `<a href="${e(entry.url)}" rel="noopener noreferrer">${e(doc.labels.viewConference || "View conference")} ↗</a>` : ""}</div></article>`).join("")}${!s.entries.length ? `<p class="muted">${e(doc.labels.noConferences || "No conferences available.")}</p>` : ""}</section>`).join("")}${awards.map((s) => `<section class="about-awards-group">${heading(s)}<div class="award-list">${s.entries.map((entry) => `<article class="award-row"><div><h3>${e(entry.title)}</h3><p>${e(entry.subtitle)}</p>${prose(entry.body)}${resource(entry)}</div><span class="award-year">${e(entry.start.slice(0, 4) || entry.end.slice(0, 4))}</span></article>`).join("")}</div></section>`).join("")}${extras.map((s) => `<section>${heading(s)}<div class="about-cards">${s.entries.map((entry) => `<article class="about-card"><h3>${e(entry.title)}</h3><p>${e(entry.subtitle)}</p>${prose(entry.body)}${resource(entry)}${entry.url ? `<a href="${e(entry.url)}" rel="noopener noreferrer">${e(doc.labels.viewResource)} ↗</a>` : ""}</article>`).join("")}</div></section>`).join("")}${p.cvId || contactVisible ? `<section class="about-cta"><h2>${e(doc.labels.cvHeading || "Interested in my full background?")}</h2><p>${e(doc.labels.cvDescription || "Download my full academic CV including complete publication history, teaching portfolio, and detailed project descriptions.")}</p><div class="actions">${p.cvId ? `<a class="button" href="${e(asset(p.cvId))}" download>↓ ${e(doc.labels.fullCv || "Download Full CV (PDF)")}</a>` : ""}${contactVisible ? `<a class="button outline" href="${e(options.baseUrl)}/${e(doc.navigation.pageSettings?.contact?.slug || "contact")}">${e(doc.navigation.contactLabel || "Get In Touch")}</a>` : ""}</div></section>` : ""}</div>`;
}

export function renderContactPage(
  doc: PortfolioDocument,
  options: RenderOptions,
  sections: Section[],
) {
  const p = doc.profile,
    contacts = sections.filter((s) => s.type === "contact"),
    entries = contacts.length
      ? contacts.flatMap((s) => s.entries)
      : sections
          .filter(
            (s) =>
              s.type === "interests" ||
              (s.type === "custom" && /research interests/i.test(s.title)),
          )
          .flatMap((s) => s.entries)
          .slice(0, 3);
  return `<div class="contact-page"><div class="contact-heading"><h1>${e(p.contactHeading || "Let's Collaborate")}</h1><p>${e(p.contactIntro || "Choose a Path for Collaboration")}</p>${contacts.map((s) => prose(s.intro)).join("")}${prose(doc.pages.find((page) => page.slug === (doc.navigation.pageSettings?.contact?.slug || "contact"))?.description || "")}</div>${entries.length ? `<div class="collaboration-paths">${entries.map((entry, index) => `<button class="collaboration-path" type="button" data-contact-subject="${e(entry.title)}" aria-pressed="false">${icon(["interests", "conferences", "network"][index % 3])}<h2>${e(entry.title)}</h2>${prose(entry.body)}</button>`).join("")}</div>` : ""}<div class="contact-layout"><aside><section class="contact-panel contact-profile">${p.portraitId ? `<img src="${e(options.asset(p.portraitId))}" alt="${e(p.name)}">` : ""}<h2>${e(p.name)}</h2><p>${e(p.headline)}</p>${p.affiliation ? `<p class="eyebrow">${e(p.affiliation)}</p>` : ""}${p.email ? `<p><a href="mailto:${e(p.email)}">${e(p.email)}</a></p>` : ""}</section>${
    p.links.filter((l) => l.url).length
      ? `<section class="contact-panel"><h2>${icon("link")}${e(doc.labels.academicLinks || "Academic Links")}</h2><div class="contact-links">${p.links
          .filter((l) => l.url)
          .map(
            (link) =>
              `<a href="${e(link.url)}" rel="noopener noreferrer">${e(link.label)}</a>`,
          )
          .join("")}</div></section>`
      : ""
  }</aside><section class="contact-panel quick-message" id="contact-form"><h2>${icon("send")}${e(doc.labels.quickMessage || "Quick Message")}</h2><form class="contact-form" method="post" action="${e(options.appUrl)}/api/public/inquiry"><input type="hidden" name="siteId" value="${e(options.siteId)}"><label class="honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>${e(doc.labels.name)} *<input name="name" required maxlength="120" autocomplete="name" placeholder="${e(doc.labels.namePlaceholder || "Your name")}"></label><label>${e(doc.labels.email)} *<input name="email" required type="email" maxlength="254" autocomplete="email" placeholder="${e(doc.labels.emailPlaceholder || "you@university.edu")}"></label><label class="wide">${e(doc.labels.subject || "Subject")} *<input name="subject" required maxlength="200" placeholder="${e(doc.labels.subjectPlaceholder || "Research Collaboration")}"></label><label class="wide">${e(doc.labels.message)} *<textarea name="message" required rows="6" minlength="10" maxlength="5000" placeholder="${e(doc.labels.messagePlaceholder || "How can I help you?")}"></textarea></label><button class="button wide">${icon("send")}${e(doc.labels.send)}</button></form></section><aside class="contact-information"><section class="contact-panel"><h2>${icon("calendar")}${e(doc.labels.officeHoursHeading || "Office Hours")}</h2>${prose(p.officeHours || "Send an inquiry to arrange a time.")}</section><section class="contact-panel"><h2>${icon("pin")}${e(doc.labels.mailingAddressHeading || "Mailing Address")}</h2>${prose(p.mailingAddress || p.location || "Please contact me for mailing details.")}</section></aside></div>${p.contactQuote ? `<blockquote class="contact-quote">${e(p.contactQuote)}</blockquote>` : ""}</div>`;
}
