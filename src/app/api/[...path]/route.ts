import { handle } from "@/modules/api/router";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, (await context.params).path);
}
export {
  route as DELETE,
  route as GET,
  route as PATCH,
  route as POST,
  route as PUT,
};
