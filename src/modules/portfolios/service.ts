import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { audit, siteAccess, type User } from "@/modules/auth/service";
import { randomUUID } from "node:crypto";
import {
  canEditDocument,
  collectAssetIds,
  documentSchema,
  type PortfolioDocument,
} from "./schema";
export type Site = {
  id: string;
  slug: string;
  name: string;
  client_id: string | null;
  editable_fields: string[];
  draft: PortfolioDocument;
  revision: number;
  status: "draft" | "review" | "published";
  published_release_id: string | null;
  updated_at: string;
  created_at: string;
  client_name?: string;
  publishedUrl?: string | null;
};
export async function getSite(user: User, id: string) {
  await siteAccess(user, id);
  const [site] = await (
    await db()
  ).query<Site>("SELECT * FROM sites WHERE id=$1", [id]);
  return site;
}
export async function saveDocument(
  user: User,
  id: string,
  input: unknown,
  revision: number,
) {
  const document = documentSchema.parse(input);
  const database = await db();
  return database.transaction(async (tx) => {
    const [site] = await tx.query<Site>(
      "SELECT * FROM sites WHERE id=$1 FOR UPDATE",
      [id],
    );
    invariant(
      site && (user.role === "admin" || site.client_id === user.id),
      404,
      "Portfolio not found.",
    );
    invariant(
      site.revision === revision,
      409,
      "This portfolio changed in another session. Reload it before saving.",
    );
    invariant(
      user.role === "admin" ||
        canEditDocument(site.draft, document, site.editable_fields),
      403,
      "Your changes include fields that your administrator has locked.",
    );
    const assetIds = collectAssetIds(document);
    if (assetIds.length) {
      const media = await tx.query<{ id: string; mime: string }>(
        "SELECT id,mime FROM media WHERE site_id=$1",
        [id],
      );
      invariant(
        assetIds.every((asset) => media.some((m) => m.id === asset)),
        400,
        "A selected file does not belong to this portfolio.",
      );
      for (const asset of [
        document.profile.portraitId,
        document.seo.socialImageId,
      ]) {
        invariant(
          !asset ||
            media.find((m) => m.id === asset)?.mime.startsWith("image/"),
          400,
          "Profile and social sharing images must be image files.",
        );
      }
      invariant(
        !document.profile.cvId ||
          media.find((m) => m.id === document.profile.cvId)?.mime ===
            "application/pdf",
        400,
        "The CV must be a PDF file.",
      );
    }
    const next = revision + 1;
    await tx.query(
      "UPDATE sites SET draft=$1,revision=$2,status=$3,updated_by=$4,updated_at=now(),name=$6 WHERE id=$5",
      [
        JSON.stringify(document),
        next,
        user.role === "client" ? "review" : "draft",
        user.id,
        id,
        document.profile.name,
      ],
    );
    await tx.query(
      "INSERT INTO revisions(id,site_id,revision,document,author_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), id, next, JSON.stringify(document), user.id],
    );
    await audit(
      user.id,
      id,
      user.role === "client" ? "portfolio.submitted" : "portfolio.saved",
      { revision: next },
      tx,
    );
    return { revision: next };
  });
}
