"use client";

import { cn } from "@/lib/utils";

export type NotificationRow = { id: string; kind: string; title: string; body: string; url: string | null; createdAt: number; read: boolean };

export function timeAgo(ms: number, now: number) {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Separa o emoji do começo do título (vira o ícone da linha). */
function splitEmoji(title: string) {
  const m = title.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  return m ? { emoji: m[1], text: m[2] } : { emoji: "🔔", text: title };
}

export function NotificationItem({ n, now, onOpen }: { n: NotificationRow; now: number; onOpen: (n: NotificationRow) => void }) {
  const { emoji, text } = splitEmoji(n.title);
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn("flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-accent", !n.read && "bg-primary/5")}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xl" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{text}</span>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.createdAt, now)}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{n.body}</span>
      </span>
      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="não lida" />}
    </button>
  );
}
