import "server-only";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { XP } from "@/lib/game";

/** Registra XP. Com `dedupe`, o mesmo bônus nunca é dado duas vezes. Retorna o XP efetivamente dado. */
export async function award(userId: string, day: string, amount: number, reason: string, dedupe?: string) {
  if (amount <= 0) return 0;
  const res = await getDb()
    .insert(schema.xpEvents)
    .values({ userId, day, amount, reason, dedupe })
    .onConflictDoNothing()
    .returning({ id: schema.xpEvents.id });
  return res.length ? amount : 0;
}

/** +XP de login, uma vez por dia. */
export async function ensureDailyLogin(userId: string) {
  const day = dayOf();
  await award(userId, day, XP.login, "Entrou no app", `login:${day}`);
}
