"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { RankingTabData } from "@/server/dashboard-tabs";

type Row = RankingTabData["rows"][number];
type Key = "hours" | "xp" | "questions";

const SORTS: { key: Key; label: string; icon: string; fmt: (r: Row) => string }[] = [
  { key: "hours", label: "Horas", icon: "emoji/cronometro.webp", fmt: (r) => (r.hours == null ? "—" : `${String(r.hours).replace(".", ",")} h`) },
  { key: "xp", label: "XP", icon: "moeda-xp.png", fmt: (r) => r.xp.toLocaleString("pt-BR") },
  { key: "questions", label: "Questões", icon: "emoji/alvo.webp", fmt: (r) => r.questions.toLocaleString("pt-BR") },
];

const MEDALS = ["🥇", "🥈", "🥉"];

/** Ranking semanal do grupo, ordenável por horas, XP ou questões. */
export function RankingBoard({ rows, weekLabel }: { rows: Row[]; weekLabel: string }) {
  const [key, setKey] = useState<Key>("hours");
  const sort = SORTS.find((s) => s.key === key)!;
  const sorted = [...rows].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || a.name.localeCompare(b.name, "pt-BR"));
  const top = sorted.reduce((m, r) => Math.max(m, r[key] ?? 0), 0);

  return (
    <section className="card-inner self-start p-4 md:col-span-7">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <Icon3D name="emoji/grupo.webp" size={20} /> Ranking da semana
          <span className="font-normal text-muted-foreground">· desde {weekLabel}</span>
        </h3>
        <div className="flex gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-border">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setKey(s.key)}
              aria-pressed={s.key === key}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                s.key === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ol className="space-y-1.5">
        {sorted.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "relative flex items-center gap-2.5 overflow-hidden rounded-xl p-2",
              r.me ? "bg-primary/10 ring-1 ring-primary/30" : "bg-card",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-primary/10"
              style={{ width: `${top > 0 ? Math.round(((r[key] ?? 0) / top) * 100) : 0}%` }}
            />
            <span className="relative w-6 shrink-0 text-center text-sm font-bold tabular-nums">{MEDALS[i] ?? i + 1}</span>
            <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-sm font-bold uppercase">
              {r.image ? (
                <Image src={r.image} alt="" width={72} height={72} className="size-full object-cover" />
              ) : (
                (r.name[0] ?? "?")
              )}
            </span>
            <span className="relative min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
            <span className="relative shrink-0 text-sm font-extrabold tabular-nums">{sort.fmt(r)}</span>
          </li>
        ))}
        {!sorted.length && <li className="py-6 text-center text-sm text-muted-foreground">Ninguém no grupo ainda.</li>}
      </ol>
      {sorted.some((r) => r.hours == null) && (
        <p className="mt-2 text-[11px] text-muted-foreground">Quem escolheu esconder as horas aparece com “—”.</p>
      )}
    </section>
  );
}
