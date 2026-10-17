import sharp from "sharp";
import type { PortfolioDocument } from "../portfolios/schema";
import { escapeHtml } from "./render";

/** JPEG is served from the public portfolio origin for social crawlers. */
export async function socialCard(
  doc: PortfolioDocument,
  image?: Buffer,
  custom = false,
) {
  if (image && custom)
    return sharp(image)
      .rotate()
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
  const wrap = (value: string, width: number, max: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      if (line && (line + " " + word).length > width) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines.slice(0, max);
  };
  const name = wrap(doc.profile.name, 25, 3),
    role = wrap(doc.profile.headline || "Research portfolio", 38, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f5f8ff"/><rect width="16" height="630" fill="#1447e6"/><circle cx="1150" cy="60" r="290" fill="#e5ecff"/><g font-family="Liberation Sans,Arial,sans-serif"><text x="70" y="100" font-size="22" fill="#1447e6" letter-spacing="4">PERSONAL PORTFOLIO</text>${name.map((v, i) => `<text x="70" y="${200 + i * 65}" font-size="54" font-weight="700" fill="#0f172b">${escapeHtml(v)}</text>`).join("")}${role.map((v, i) => `<text x="70" y="${240 + name.length * 65 + i * 36}" font-size="28" fill="#45556c">${escapeHtml(v)}</text>`).join("")}</g></svg>`;
  const base = sharp(Buffer.from(svg));
  if (image)
    base.composite([
      {
        input: await sharp(image)
          .rotate()
          .resize(360, 450, { fit: "cover", position: "attention" })
          .png()
          .toBuffer(),
        left: 790,
        top: 90,
      },
    ]);
  return base.jpeg({ quality: 88 }).toBuffer();
}
