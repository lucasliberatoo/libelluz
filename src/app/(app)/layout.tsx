import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasDatabase } from "@/db";
import { nowMs } from "@/lib/day";
import { FocusProvider } from "@/components/focus/focus-provider";
import { AppShell } from "@/components/shell/app-shell";
import { SetupNeeded } from "@/components/setup-needed";
import { getActiveFocus, getShellData } from "@/server/queries";
import { ensureDailyLogin } from "@/server/xp";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!hasDatabase()) return <SetupNeeded />;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/entrar");
  // o XP do login entra antes de somar as moedas do topo; a sessão de foco vem em paralelo
  const [shell, active] = await Promise.all([ensureDailyLogin(userId).then(() => getShellData(userId)), getActiveFocus(userId)]);
  const serverNow = active?.pausedAt ?? nowMs();
  return (
    <FocusProvider initial={active} serverNow={serverNow}>
      <AppShell user={shell}>{children}</AppShell>
    </FocusProvider>
  );
}
