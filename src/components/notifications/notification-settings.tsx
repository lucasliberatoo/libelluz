"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { NOTIF_KINDS, quietRange, type NotifPrefs } from "@/lib/notification-rules";
import { saveNotifPrefs } from "@/server/notification-actions";
import { PushToggle } from "./push-toggle";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const select = "rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

/** Seção de notificações em /config: ativar push, tipos e horário de silêncio. */
export function NotificationSettings({ initial }: { initial: NotifPrefs }) {
  const q = quietRange(initial);
  const [off, setOff] = useState<string[]>(initial.off ?? []);
  const [start, setStart] = useState(q.start);
  const [end, setEnd] = useState(q.end);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  function save(next: { off?: string[]; start?: number; end?: number }) {
    const p = { off: next.off ?? off, quietStart: next.start ?? start, quietEnd: next.end ?? end };
    setMsg(null);
    startT(async () => {
      try {
        await saveNotifPrefs(p);
        setMsg("Salvo!");
      } catch {
        setMsg("Não deu para salvar. Tente de novo.");
      }
    });
  }

  function toggle(kind: string) {
    const next = off.includes(kind) ? off.filter((k) => k !== kind) : [...off, kind];
    setOff(next);
    save({ off: next });
  }

  return (
    <section id="notificacoes" className="card-soft mt-4 space-y-4 p-5">
      <div>
        <h2 className="font-bold">Notificações</h2>
        <p className="text-sm text-muted-foreground">O foguinho avisa quando a sequência está em risco, quando tem revisão atrasada e mais.</p>
      </div>

      <PushToggle />

      <ul className="divide-y">
        {NOTIF_KINDS.map((k) => {
          const on = !off.includes(k.kind);
          return (
            <li key={k.kind} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{k.label}</p>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={k.label}
                onClick={() => toggle(k.kind)}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Silêncio das</span>
        <select
          aria-label="Início do silêncio"
          className={select}
          value={start}
          onChange={(e) => {
            setStart(+e.target.value);
            save({ start: +e.target.value });
          }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>
        <span>às</span>
        <select
          aria-label="Fim do silêncio"
          className={select}
          value={end}
          onChange={(e) => {
            setEnd(+e.target.value);
            save({ end: +e.target.value });
          }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>
        <span className="w-full text-xs text-muted-foreground">
          {start === end ? "Sem horário de silêncio." : "Nesse horário o foguinho não manda nada no celular."}
        </span>
      </div>

      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {pending ? "Salvando…" : msg}
      </p>
    </section>
  );
}
