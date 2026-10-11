import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Reset your password" };
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="forgot" />
    </Suspense>
  );
}
