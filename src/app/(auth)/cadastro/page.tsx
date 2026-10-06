import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/auth";
import { hasDatabase } from "@/db";
import { SignupForm } from "@/components/auth/forms";
import { SetupNeeded } from "@/components/setup-needed";

export default async function CadastroPage({ searchParams }: PageProps<"/cadastro">) {
  if (!hasDatabase()) return <SetupNeeded />;
  if ((await auth())?.user) redirect("/");
  const { erro } = await searchParams;
  return <SignupForm google={googleEnabled()} inviteError={erro === "convite"} />;
}
