import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Accept invitation" };
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="accept" />
    </Suspense>
  );
}
