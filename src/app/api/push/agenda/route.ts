import { auth } from "@/auth";
import { planLocalReminders } from "@/lib/notification-rules";
import { loadRuleInputs } from "@/server/push-cron";

/** Lembretes locais de hoje para o APK (o WebView do Android não recebe Web Push). */
export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const [input] = await loadRuleInputs(now, userId);
  const reminders = input ? planLocalReminders(input, now.getTime()) : [];
  return Response.json({ day: input?.now.day ?? null, reminders }, { headers: { "cache-control": "no-store" } });
}
