"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { NOTIF_KINDS } from "@/lib/notification-rules";
import { listNotifications, unreadCount } from "./notifications";

const { notifications, users } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

/** Últimas notificações (o sino carrega ao abrir). */
export async function fetchNotifications() {
  const userId = await requireUser();
  const [items, unread] = await Promise.all([listNotifications(userId, 20), unreadCount(userId)]);
  return { items, unread };
}

export async function markNotificationRead(id: string) {
  const userId = await requireUser();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, z.string().max(64).parse(id)), eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markAllNotificationsRead() {
  const userId = await requireUser();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

const kinds = NOTIF_KINDS.map((k) => k.kind) as [string, ...string[]];
const prefsSchema = z.object({
  off: z.array(z.enum(kinds)).max(kinds.length),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
});

export async function saveNotifPrefs(input: z.input<typeof prefsSchema>) {
  const userId = await requireUser();
  const p = prefsSchema.parse(input);
  await getDb()
    .update(users)
    .set({ notifPrefs: { off: [...new Set(p.off)], quietStart: p.quietStart, quietEnd: p.quietEnd } })
    .where(eq(users.id, userId));
  return { ok: true };
}
