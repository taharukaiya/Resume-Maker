import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
