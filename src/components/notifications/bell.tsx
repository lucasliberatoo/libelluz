"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/server/notification-actions";
import { NotificationItem, type NotificationRow } from "./notification-item";
import { enablePush, listenNativeTaps, pushState, syncNativeReminders } from "./push-client";

const NUDGE_KEY = "libelluz:push-nudge-off";
const subscribeNoop = () => () => {};

/** Onde a caixa aparece: colada no sino no desktop, de ponta a ponta no celular. */
function anchor(btn: HTMLElement | null) {
  if (typeof window === "undefined") return null;
  const r = btn?.getBoundingClientRect();
  const top = (r ? r.bottom : 56) + 8;
  if (window.innerWidth >= 640) return { top, right: Math.max(8, window.innerWidth - (r?.right ?? window.innerWidth)), width: 380 };
  return { top, left: 12, right: 12 };
}

/**
 * Sino do topo: badge com as não lidas e as últimas 20 ao abrir (carregadas só nessa hora).
 * `runtime` liga, uma vez só na página, os lembretes locais do APK.
 */
export function NotificationBell({ unread, className, onHeader, runtime }: { unread: number; className?: string; onHeader?: boolean; runtime?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [prop, setProp] = useState(unread);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [now, setNow] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // a caixa vai num portal: dentro do header ela ficaria atrás do conteúdo (mesmo z-index)
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [pos, setPos] = useState<{ top: number; left?: number; right: number; width?: number } | null>(null);

  // o layout mandou outra contagem (navegação com refresh)
  if (prop !== unread) {
    setProp(unread);
    setCount(unread);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      const t = e.target as Node;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const place = () => setPos(anchor(box.current));
    place();
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // APK: agenda os lembretes locais do dia e trata o toque neles
  useEffect(() => {
    if (!runtime) return;
    void syncNativeReminders();
    let off = () => {};
    void listenNativeTaps((url) => router.push(url as never)).then((f) => (off = f));
    const onVisible = () => document.visibilityState === "visible" && void syncNativeReminders();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runtime, router]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setNow(Date.now());
    start(async () => {
      const r = await fetchNotifications();
      setItems(r.items);
      setCount(r.unread);
    });
    pushState()
      .then((s) => {
        let off = false;
        try {
          off = localStorage.getItem(NUDGE_KEY) === "1";
        } catch {}
        setNudge(s === "off" && !off);
      })
      .catch(() => {});
  }

  function openItem(n: NotificationRow) {
    if (!n.read) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setCount((c) => Math.max(0, c - 1));
      void markNotificationRead(n.id);
    }
    setOpen(false);
    router.push((n.url || "/notificacoes") as never);
  }

  function readAll() {
    setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? null);
    setCount(0);
    void markAllNotificationsRead();
  }

  function hideNudge() {
    setNudge(false);
    try {
      localStorage.setItem(NUDGE_KEY, "1");
    } catch {}
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={count ? `Notificações (${count} não lidas)` : "Notificações"}
        aria-expanded={open}
        onClick={toggle}
        className={cn("relative grid size-9 place-items-center rounded-full", onHeader ? "hover:bg-white/15" : "hover:bg-accent", className)}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white tabular-nums",
              onHeader ? "ring-2 ring-header" : "ring-2 ring-card",
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificações"
          style={{ top: pos.top, left: pos.left, right: pos.right, width: pos.width }}
          className="card-soft fixed z-[60] flex max-h-[min(70dvh,560px)] flex-col overflow-hidden p-0 text-foreground shadow-xl"
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="flex-1 font-bold">Notificações</h2>
            {count > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-semibold text-primary hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>

          {nudge && (
            <div className="mx-3 mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-xs">
              <BellRing className="size-4 shrink-0 text-primary" />
              <span className="flex-1">Receba os avisos do foguinho mesmo com o app fechado.</span>
              <button
                type="button"
                className="rounded-full bg-primary px-2.5 py-1 font-semibold text-white"
                onClick={() => enablePush().then((s) => s === "on" && setNudge(false)).catch(() => {})}
              >
                Ativar
              </button>
              <button type="button" aria-label="Agora não" onClick={hideNudge} className="text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {items === null || (pending && !items.length) ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : items.length ? (
              items.map((n) => <NotificationItem key={n.id} n={n} now={now} onOpen={openItem} />)
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nada por aqui ainda. O foguinho avisa quando tiver novidade 🔥
              </p>
            )}
          </div>

          <Link href="/notificacoes" onClick={() => setOpen(false)} className="border-t px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-accent">
            Ver todas
          </Link>
        </div>,
        document.body,
      )}
    </div>
  );
}
