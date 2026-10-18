import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { GET as portfolio } from "@/app/portfolio/[slug]/[[...path]]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only explicitly verified, activated domains can resolve to a portfolio.
// Caddy rewrites researcher-domain requests here without exposing the studio.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ hostname: string; path?: string[] }> },
) {
  const params = await context.params;
  if (!config().vps) return new Response("Not found.", { status: 404 });
  const [site] = await (
    await db()
  ).query<{ slug: string; redirect_to: string | null }>(
    "SELECT s.slug,d.redirect_to FROM domains d JOIN sites s ON s.id=d.site_id WHERE d.hostname=$1 AND d.verified_at IS NOT NULL AND d.activated_at IS NOT NULL",
    [params.hostname.toLowerCase()],
  );
  if (!site)
    return new Response("Not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  if (site.redirect_to) {
    const target = new URL(`https://${site.redirect_to}`);
    target.pathname =
      "/" + (params.path || []).map(encodeURIComponent).join("/");
    target.search = request.nextUrl.search;
    return new Response(null, {
      status: 308,
      headers: { Location: target.href, "Cache-Control": "no-store" },
    });
  }
  if (params.path?.length === 1 && params.path[0] === "login") {
    // One authentication origin keeps cookies, MFA and permissions consistent.
    // Do not forward arbitrary query parameters or credentials from a domain URL.
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/login", config().appUrl).href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  return portfolio(request, {
    params: Promise.resolve({ slug: site.slug, path: params.path }),
  });
}
