import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isQuiet, kindEnabled, localClock } from "@/lib/notification-rules";
import { sendWebPush } from "./push";

export type NotifyInput = {
  /** tipo, para as preferências: "poke" | "reaction" | "comment" | "streak" | "review" | "friend" | "water" | "enem" | "firewood" | "cold" | "achievement" | "mission" … */
  kind: string;
  title: string;
  body: string;
  url?: string;
  /** evita repetir a mesma notificação (ex.: "streak:2026-10-06") */
  dedupe?: string;
};

/** Grava no sino. Devolve o id, ou null se o dedupe já existia. */
export async function createNotification(userId: string, n: NotifyInput) {
  const [row] = await getDb()
    .insert(schema.notifications)
    .values({ userId, kind: n.kind, title: n.title, body: n.body, url: n.url, dedupe: n.dedupe })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });
  return row?.id ?? null;
}

/**
 * Registra uma notificação na caixa (sino) da pessoa e dispara a entrega por push.
 * O push roda depois da resposta (after), para não atrasar quem chamou.
 */
export async function notify(userId: string, n: NotifyInput) {
  const id = await createNotification(userId, n);
  if (id) {
    const run = () => deliverPush(userId, id).catch(() => {});
    try {
      after(run);
    } catch {
      // fora de uma requisição (scripts): entrega na hora
      await run();
    }
  }
  return id;
}

/**
 * Entrega por push (Web Push). Respeita as preferências (tipos desligados) e o horário de silêncio.
 * No APK o WebView não recebe Web Push: lá os lembretes são locais (/api/push/agenda).
 */
export async function deliverPush(userId: string, notificationId: string) {
  const db = getDb();
  const [n, u] = await Promise.all([
    db.query.notifications.findFirst({ where: eq(schema.notifications.id, notificationId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { notifPrefs: true } }),
  ]);
  if (!n || n.userId !== userId || n.readAt || n.pushedAt) return { sent: 0 };
  const prefs = u?.notifPrefs ?? {};
  if (!kindEnabled(n.kind, prefs) || isQuiet(localClock(new Date()).hour, prefs)) return { sent: 0 };
  const r = await sendWebPush(userId, { title: n.title, body: n.body, url: n.url, tag: n.kind, id: n.id });
  if (r.sent) await db.update(schema.notifications).set({ pushedAt: new Date() }).where(eq(schema.notifications.id, n.id));
  return r;
}
