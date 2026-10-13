import { getObject } from "@/lib/storage";
import { config } from "@/lib/config";
import { migratePublicUrls } from "@/modules/publishing/public-urls";
import { liveManifest } from "@/modules/publishing/service";
import {
  addLegacyFavicon,
  legacyFaviconResponse,
} from "@/modules/publishing/legacy-favicon";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const params = await context.params,
    manifest = await liveManifest(params.slug);
  if (!manifest)
    return new Response("This portfolio is not published.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  const route = (params.path || []).join("/");
  const routeKey = [route || "index.html", `${route}/index.html`].find((key) =>
    Object.hasOwn(manifest.routes, key),
  );
  const item = routeKey ? manifest.routes[routeKey] : undefined;
  if (!item && ["favicon.png", "favicon.svg"].includes(route)) {
    const icon = await legacyFaviconResponse(manifest, route);
    if (icon) return icon;
  }
  if (!item)
    return new Response("Page not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  const bytes = await getObject(item.key);
  if (!bytes) return new Response("Temporarily unavailable.", { status: 503 });
  let body =
    item.type.startsWith("text/") || item.type.startsWith("application/xml")
      ? migratePublicUrls(bytes.toString("utf8"), params.slug, [
          config().appUrl,
          new URL(manifest.baseUrl).origin,
        ])
      : new Uint8Array(bytes);
  if (item.type.startsWith("text/html") && typeof body === "string") {
    body = await addLegacyFavicon(
      body,
      manifest,
      `/portfolio/${encodeURIComponent(params.slug)}`,
    );
  }
  return new Response(body, {
    headers: {
      "Content-Type": item.type,
      "Cache-Control": route.startsWith("assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      ETag: `"portfolio-v3-${manifest.releaseId}-${route}"`,
      "Content-Security-Policy": `default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; font-src 'self'; script-src 'none'; form-action 'self' ${new URL(config().appUrl).origin}; base-uri 'none'; frame-ancestors 'self'`,
      ...(item.type === "application/pdf"
        ? { "Content-Disposition": "attachment" }
        : {}),
    },
  });
}
