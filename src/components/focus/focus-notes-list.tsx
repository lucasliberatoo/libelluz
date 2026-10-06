"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { allFocusNotes } from "@/server/focus-tools";

type Groups = Awaited<ReturnType<typeof allFocusNotes>>;

const FILTERS = [
  { k: "all", label: "Tudo" },
  { k: "insight", label: "📌 Insights" },
  { k: "note", label: "📝 Notas" },
  { k: "audio", label: "🎙️ Áudios" },
  { k: "check", label: "☑️ Checklists" },
] as const;

const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }) : "");

export function FocusNotesList({ groups }: { groups: Groups }) {
  const [f, setF] = useState<(typeof FILTERS)[number]["k"]>("all");
  const shown = useMemo(
    () => groups.map((g) => ({ ...g, notes: g.notes.filter((n) => f === "all" || n.kind === f) })).filter((g) => g.notes.length),
    [groups, f],
  );
  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((x) => (
          <button
            key={x.k}
            onClick={() => setF(x.k)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium", f === x.k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {x.label}
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="card-soft p-6 text-center text-sm text-muted-foreground">
          Nada por aqui ainda. Durante o foco, use Nota, Áudio, Checklist ou Insight na barra de atalhos.
        </p>
      )}
      {shown.map((g) => (
        <section key={g.session.id} className="card-soft p-4">
          <p className="text-xs text-muted-foreground">
            {fmtDay(g.session.day)} · {g.session.subject} · {g.session.kind}
          </p>
          <h2 className="font-bold">{g.session.topic}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {g.notes.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-2 rounded-xl p-2", n.kind === "insight" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-muted/60")}>
                <span>{n.kind === "insight" ? "📌" : n.kind === "audio" ? "🎙️" : n.kind === "check" ? (n.done ? "✅" : "⬜") : "📝"}</span>
                {n.kind === "audio" ? (
                  <audio controls preload="none" src={n.audio ?? undefined} className="h-8 flex-1" />
                ) : (
                  <p className={cn("flex-1 whitespace-pre-wrap", n.kind === "check" && n.done && "text-muted-foreground line-through")}>{n.text}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
