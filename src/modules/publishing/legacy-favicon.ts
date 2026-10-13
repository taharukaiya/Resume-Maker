import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import type { ReleaseManifest } from "./service";
import { initialsFavicon } from "./favicon";
import sharp from "sharp";

/** Older immutable releases have no icon. Use their published snapshot, never the draft. */
export async function legacyFavicon(manifest: ReleaseManifest) {
  const [release] = await (
    await db()
  ).query<{ document: PortfolioDocument }>(
    "SELECT document FROM releases WHERE id=$1 AND site_id=$2",
    [manifest.releaseId, manifest.siteId],
  );
  if (!release) return null;
  const { profile, theme } = release.document;
  const portrait = manifest.routes[`assets/${profile.portraitId}.webp`];
  return {
    portraitKey: portrait?.type.startsWith("image/") ? portrait.key : undefined,
    initials: initialsFavicon(profile.name, theme.accent),
  };
}

export async function legacyFaviconResponse(
  manifest: ReleaseManifest,
  route: string,
) {
  const icon = await legacyFavicon(manifest);
  if (!icon) return null;
  let bytes: Buffer;
  let type: string;
  if (route === "favicon.png" && icon.portraitKey) {
    const portrait = await getObject(icon.portraitKey);
    if (!portrait) return null;
    bytes = await sharp(portrait)
      .rotate()
      .resize(64, 64, { fit: "cover", position: "attention" })
      .png()
      .toBuffer();
    type = "image/png";
  } else if (route === "favicon.svg") {
    bytes = Buffer.from(icon.initials);
    type = "image/svg+xml";
  } else return null;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=0, s-maxage=60",
      ETag: `"favicon-${manifest.releaseId}-${route}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

export async function addLegacyFavicon(
  html: string,
  manifest: ReleaseManifest,
  basePath: string,
) {
  if (/<link\b[^>]*\brel=["'][^"']*\bicon\b/i.test(html)) return html;
  const icon = await legacyFavicon(manifest);
  if (!icon) return html;
  const file = icon.portraitKey ? "favicon.png" : "favicon.svg";
  const type = icon.portraitKey ? "image/png" : "image/svg+xml";
  return html.replace(
    /<\/head>/i,
    `<link rel="icon" type="${type}" href="${basePath}/${file}?v=legacy-1-${encodeURIComponent(manifest.releaseId)}"></head>`,
  );
}
