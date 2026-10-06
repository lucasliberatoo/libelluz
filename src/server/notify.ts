import "server-only";
import { getDb, schema } from "@/db";

export type NotifyInput = {
  /** tipo, para as preferências: "poke" | "reaction" | "comment" | "streak" | "review" | "friend" | "water" | "enem" | "firewood" | "achievement" | "mission" … */
  kind: string;
  title: string;
  body: string;
  url?: string;
  /** evita repetir a mesma notificação (ex.: "streak:2026-10-06") */
  dedupe?: string;
};

/**
 * Registra uma notificação na caixa (sino) da pessoa e dispara a entrega por push.
 * A entrega por push (Web Push / APK) é feita em deliverPush, que respeita preferências e horário de silêncio.
 */
export async function notify(userId: string, n: NotifyInput) {
  const [row] = await getDb()
    .insert(schema.notifications)
    .values({ userId, kind: n.kind, title: n.title, body: n.body, url: n.url, dedupe: n.dedupe })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });
  if (row) await deliverPush(userId, row.id).catch(() => {});
  return row?.id ?? null;
}

/** Entrega por push. Implementado pela parte de notificações; por enquanto não faz nada. */
export async function deliverPush(_userId: string, _notificationId: string) {}
