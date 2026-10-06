import "server-only";
import { cache } from "react";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { notifications } = schema;

/** Contagem de não lidas para o sino do topo (uma consulta barata no layout). */
export const unreadCount = cache(async (userId: string) => {
  const [r] = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
});

export type NotificationItem = { id: string; kind: string; title: string; body: string; url: string | null; createdAt: number; read: boolean };

export async function listNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
  const rows = await getDb()
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime(), read: !!r.readAt }));
}
