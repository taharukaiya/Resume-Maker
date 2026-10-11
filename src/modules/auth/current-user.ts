import { cookies } from "next/headers";
import { cache } from "react";
import { config } from "@/lib/config";
import { getSession } from "./service";

// React cache deduplicates only within this server render, never across users.
export const currentUser = cache(async () =>
  getSession(
    (await cookies()).get(
      config().production ? "__Host-brilliancy_session" : "brilliancy_session",
    )?.value,
  ),
);
