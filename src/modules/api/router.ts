import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { NextRequest } from "next/server";
import { z } from "zod";
import { accountRoutes } from "./account-routes";
import { mediaRoutes } from "./media-routes";
import { messageRoutes } from "./message-routes";
import { portfolioRoutes } from "./portfolio-routes";
import { publicRoutes } from "./public-routes";
import { checkOrigin, json, requireUser } from "./shared";
export async function handle(request: NextRequest, segments: string[]) {
  try {
    return await dispatch(request, segments);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if ((error as { code?: string }).code === "23505")
      return json(
        { error: "This email, address, or operation already exists." },
        409,
      );
    console.error(
      "API request failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return json(
      { error: "The request could not be completed. Please try again." },
      500,
    );
  }
}

async function dispatch(
  request: NextRequest,
  path: string[],
): Promise<Response> {
  if (request.method !== "GET" && path.join("/") !== "public/inquiry")
    checkOrigin(request);
  const database = await db();
  const publicResponse = await publicRoutes(request, path, database);
  if (publicResponse) return publicResponse;
  const user = await requireUser(request);
  for (const route of [
    accountRoutes,
    portfolioRoutes,
    mediaRoutes,
    messageRoutes,
  ]) {
    const response = await route(request, path, database, user);
    if (response) return response;
  }
  throw new AppError(404, "This endpoint does not exist.");
}
