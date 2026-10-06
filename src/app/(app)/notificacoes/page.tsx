import type { Metadata } from "next";
import { auth } from "@/auth";
import { nowMs } from "@/lib/day";
import { NotificationList } from "@/components/notifications/notification-list";
import { listNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: "Notificações · Libelluz" };

export default async function NotificacoesPage() {
  const userId = (await auth())!.user!.id!;
  const items = await listNotifications(userId, 200);
  return <NotificationList initial={items} now={nowMs()} />;
}
