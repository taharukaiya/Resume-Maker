import { PortfolioEditor } from "@/components/portfolio-editor";
import { currentUser } from "@/modules/auth/current-user";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import { z } from "zod";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await currentUser();
  if (!user || !z.uuid().safeParse(id).success)
    return { title: "Portfolio editor" };
  const [site] = await (
    await db()
  ).query<{ name: string }>(
    "SELECT name FROM sites WHERE id=$1 AND ($2='admin' OR client_id=$3)",
    [id, user.role, user.id],
  );
  return {
    title: site ? `${site.name} · Portfolio editor` : "Portfolio editor",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ complete?: string | string[] }>;
}) {
  const { id } = await params;
  const { complete } = await searchParams;
  return (
    <PortfolioEditor
      key={id}
      id={id}
      completionKey={typeof complete === "string" ? complete : undefined}
    />
  );
}
