import { StudioShell } from "@/components/studio-shell";
import { config } from "@/lib/config";
import { getSession, publicUser } from "@/modules/auth/service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession(
    (await cookies()).get(
      config().production ? "__Host-brilliancy_session" : "brilliancy_session",
    )?.value,
  );
  if (!user) redirect("/login");
  return <StudioShell user={publicUser(user)}>{children}</StudioShell>;
}
