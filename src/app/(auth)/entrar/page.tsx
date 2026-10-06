import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/auth";
import { hasDatabase } from "@/db";
import { LoginForm } from "@/components/auth/forms";
import { SetupNeeded } from "@/components/setup-needed";

export default async function EntrarPage() {
  if (!hasDatabase()) return <SetupNeeded />;
  if ((await auth())?.user) redirect("/");
  return <LoginForm google={googleEnabled()} />;
}
