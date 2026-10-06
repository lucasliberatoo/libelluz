"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Settings } from "lucide-react";
import { addDays, dayOf } from "@/lib/day";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notification-actions";
import { NotificationItem, type NotificationRow } from "./notification-item";

function groupLabel(day: string, today: string) {
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
}

/** Página /notificacoes: todas, agrupadas por dia. */
export function NotificationList({ initial, now }: { initial: NotificationRow[]; now: number }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.read).length;
  const today = dayOf(new Date(now));

  const groups: { day: string; list: NotificationRow[] }[] = [];
  for (const n of items) {
    const d = dayOf(new Date(n.createdAt));
    if (groups.at(-1)?.day !== d) groups.push({ day: d, list: [] });
    groups.at(-1)!.list.push(n);
  }

  function open(n: NotificationRow) {
    if (!n.read) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void markNotificationRead(n.id);
    }
    if (n.url) router.push(n.url as never);
  }

  function readAll() {
    setItems((l) => l.map((x) => ({ ...x, read: true })));
    void markAllNotificationsRead().then(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card-soft flex items-center gap-3 p-5">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Notificações</h1>
          <p className="text-sm text-muted-foreground">{unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo em dia por aqui."}</p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={readAll} className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-border hover:bg-accent">
            Marcar todas como lidas
          </button>
        )}
        <Link href="/config#notificacoes" aria-label="Preferências de notificação" className="grid size-9 place-items-center rounded-full hover:bg-accent">
          <Settings className="size-5" />
        </Link>
      </section>

      {groups.length ? (
        groups.map((g) => (
          <section key={g.day} className="card-soft p-2">
            <h2 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground first-letter:uppercase">{groupLabel(g.day, today)}</h2>
            {g.list.map((n) => (
              <NotificationItem key={n.id} n={n} now={now} onOpen={open} />
            ))}
          </section>
        ))
      ) : (
        <section className="card-soft p-10 text-center text-sm text-muted-foreground">
          Nenhuma notificação ainda. O foguinho avisa quando a sequência estiver em risco, quando tiver revisão atrasada e quando os amigos estudarem.
        </section>
      )}
    </div>
  );
}
