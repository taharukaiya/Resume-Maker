import type { PortfolioDocument } from "../portfolios/schema";
import { escapeHtml as e } from "./render";
const paths: Record<string, string> = {
  research:
    '<path d="M9 3h6m-5 0v7l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M8 15h8"/>',
  education: '<path d="M3 5h7l2 2 2-2h7v15h-7l-2 1-2-1H3zM12 7v14"/>',
  collaboration:
    '<circle cx="12" cy="4" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M12 6v6H4v5m8-5h8v5"/>',
  idea: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 118 0l-1 2H9z"/>',
};
export function personalityCards(doc: PortfolioDocument) {
  const cards = (doc.profile.featureCards || []).filter(
    (card) => card.title.trim() || card.body.trim(),
  );
  return cards.length
    ? `<section class="personality-cards" aria-label="${e(doc.profile.cardsHeading || "Interests and collaboration")}">${doc.profile.cardsHeading ? `<h2>${e(doc.profile.cardsHeading)}</h2>` : ""}${cards.map((card) => `<article class="personality-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[card.icon] || paths.research}</svg><h3>${e(card.title)}</h3><p>${e(card.body).replace(/\n/g, "<br>")}</p>${card.url ? `<a href="${e(card.url)}" rel="noopener noreferrer">${e(card.linkLabel || "Learn more")} <span aria-hidden="true">↗</span></a>` : ""}</article>`).join("")}</section>`
    : "";
}
export function personalityQuote(doc: PortfolioDocument) {
  return doc.profile.contactQuote?.trim()
    ? `<figure class="personality-quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h6v9c0 4-2 6-6 7v-4c2-1 2-2 2-3H4zm10 0h6v9c0 4-2 6-6 7v-4c2-1 2-2 2-3h-2z"/></svg><blockquote>${e(doc.profile.contactQuote)}</blockquote>${doc.profile.quoteAttribution ? `<figcaption>${e(doc.profile.quoteAttribution)}</figcaption>` : ""}</figure>`
    : "";
}
export const personalityCss = `
.shiba{isolation:isolate}.shiba[data-background=true]:before{content:'';position:fixed;inset:-8%;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 8% 20%,#e8eeff99,transparent 38%),radial-gradient(ellipse at 95% 75%,#e7f5fb99,transparent 40%);animation:ambient-drift 24s ease-in-out infinite alternate}
@keyframes ambient-drift{to{transform:translate3d(2%,3%,0) scale(1.04)}}
.personality-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:48px 0}.personality-cards>h2{grid-column:1/-1;margin:0}.personality-card{padding:24px;border:1px solid #d5def2;border-radius:14px;background:#fff;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;min-width:0;overflow-wrap:anywhere}.personality-card svg{width:48px;height:48px;padding:10px;box-sizing:border-box;background:#e8edff;border-radius:10px;color:#1447e6}.personality-card h3{font:700 20px/28px Inter,sans-serif;margin:16px 0 8px}.personality-card p{font:400 14px/22px Inter,sans-serif;color:#4c669a;margin:0}.personality-card a{display:inline-block;margin-top:16px}.personality-quote{margin:24px 0;padding:28px;border-radius:16px;background:#1447e6;color:white;box-shadow:0 6px 14px #1447e620}.personality-quote svg{width:32px;height:32px;color:#9bb1ff;margin-bottom:12px}.personality-quote blockquote{margin:0;font:500 italic 17px/28px Inter,sans-serif}.personality-quote figcaption{margin-top:16px;font-size:13px;color:#dce5ff}
.section-interests .entry h3,.section-hobbies .entry h3,.about-interests .about-card h3,.home-interest-panel h4{font-size:16px;line-height:1.75;font-weight:400}.section-hobbies .entry{border:0;padding:0}.section-hobbies .eyebrow:empty{display:none}
.category{display:flex;align-items:center;gap:16px;width:100%;text-align:left;border-bottom:1px solid #e1e7f2!important;border-radius:0!important;padding:13px 0!important;color:#0f172b;font-weight:400!important}.category>span{flex:0 0 auto;align-self:center;min-width:28px;height:20px;padding:0 7px!important;box-sizing:border-box;border-radius:12px;background:#e8edf5!important;color:#4c669a!important;font:700 12px/20px Inter,sans-serif!important}.category[aria-pressed=true]{color:#1447e6;font-weight:600!important}.category[aria-pressed=true]>span{background:#1447e6!important;color:#fff!important}
.article-download{display:flex;align-items:center;gap:16px;padding:20px;border:1px solid #dce4f5;border-radius:14px;background:#f6f8ff;margin-bottom:24px}.article-download>svg{width:32px;height:32px;color:#1447e6;flex-shrink:0}.article-download p{margin:0;font:400 13px/20px Inter,sans-serif;color:#62748e}.article-download .button{margin-left:auto;white-space:nowrap}.article-download strong{font:600 16px/24px Inter,sans-serif}
@media(hover:hover){.personality-card:hover{transform:translateY(-4px);box-shadow:0 12px 24px #1447e612;border-color:#9db0ee}}
@media(max-width:767px){.personality-cards{grid-template-columns:1fr;gap:16px}.article-download{flex-wrap:wrap}.article-download .button{margin-left:0;width:100%}.personality-quote{padding:24px}}
.shiba[data-effects=none] *,.shiba[data-effects=none]:before{animation:none!important;transition:none!important;scroll-behavior:auto!important}.shiba[data-effects=none] .personality-card:hover{transform:none}
@media(prefers-reduced-motion:reduce){.shiba:before,.shiba *{animation:none!important;transition:none!important;scroll-behavior:auto!important}.personality-card:hover{transform:none}}
`;
