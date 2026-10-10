import { AuthForm } from "@/components/auth-form";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
