import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Set up your workspace" };
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="setup" />
    </Suspense>
  );
}
