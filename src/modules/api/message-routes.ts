import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { requireAdmin, siteAccess, type User } from "@/modules/auth/service";
import { NextRequest } from "next/server";
import { idSchema, json } from "./shared";

export async function messageRoutes(
  request: NextRequest,
  path: string[],
  database: Awaited<ReturnType<typeof db>>,
  user: User,
): Promise<Response | null> {
  const route = path.join("/"),
    method = request.method;
  if (route === "inquiries" && method === "GET")
    return json({
      inquiries: await database.query(
        `SELECT i.*,s.name AS site_name FROM inquiries i JOIN sites s ON s.id=i.site_id ${user.role === "client" ? "WHERE s.client_id=$1" : ""} ORDER BY i.created_at DESC LIMIT 200`,
        user.role === "client" ? [user.id] : [],
      ),
    });
  if (path[0] === "inquiries" && path.length === 2 && method === "PATCH") {
    const id = idSchema.parse(path[1]);
    const [inquiry] = await database.query<{ site_id: string }>(
      "SELECT site_id FROM inquiries WHERE id=$1",
      [id],
    );
    invariant(inquiry, 404, "Message not found.");
    await siteAccess(user, inquiry.site_id);
    await database.query("UPDATE inquiries SET read_at=now() WHERE id=$1", [
      id,
    ]);
    return json({ ok: true });
  }
  if (route === "audit" && method === "GET") {
    requireAdmin(user);
    return json({
      events: await database.query(
        "SELECT a.*,u.name AS actor,s.name AS site_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN sites s ON s.id=a.site_id ORDER BY a.created_at DESC LIMIT 200",
      ),
    });
  }

  return null;
}
