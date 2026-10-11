import { StudioShell } from "@/components/studio-shell";
import { ConfirmationProvider } from "@/components/confirmation";
import { publicUser } from "@/modules/auth/service";
import { currentUser } from "@/modules/auth/current-user";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <ConfirmationProvider>
      <StudioShell user={publicUser(user)}>{children}</StudioShell>
    </ConfirmationProvider>
  );
}
