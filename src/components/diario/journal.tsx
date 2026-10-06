"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon3D } from "@/components/brand";
import { MOODS } from "@/components/dashboard/today";
import { addDays } from "@/lib/day";
import { cn } from "@/lib/utils";
import type { JournalEntry } from "@/server/queries";

const RANGES = [
  { label: "Semana", days: 7 },
  { label: "Mês", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "Ano", days: 365 },
] as const;

// 0 = Ótimo … 4 = Exausto → nota 5 … 1
const score = (m: number) => 5 - m;
const fmtDay = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
  return t[0].toUpperCase() + t.slice(1);
};

export function Journal({ entries, today }: { entries: JournalEntry[]; today: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const from = addDays(today, -(range.days - 1));
  const inRange = entries.filter((e) => e.day >= from && e.mood !== null);
  const avg = inRange.length ? inRange.reduce((a, e) => a + score(e.mood!), 0) / inRange.length : null;
  const counts = MOODS.map((_, i) => inRange.filter((e) => e.mood === i).length);
  const chart = Array.from({ length: range.days }, (_, i) => {
    const d = addDays(from, i);
    const e = entries.find((x) => x.day === d);
    return { d: d.slice(5).split("-").reverse().join("/"), v: e?.mood != null ? score(e.mood) : null };
  });
  const avgMood = avg === null ? null : Math.min(4, Math.max(0, Math.round(5 - avg)));
  const written = entries.filter((e) => e.journal || e.photo);

  return (
    <div className="space-y-4">
      <section className="card-soft p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="flex-1 text-xl font-bold">Como tenho estado</h1>
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              className={cn("rounded-full border-2 px-3 py-0.5 text-sm font-semibold", range === r ? "border-primary bg-primary text-white" : "border-primary/60 text-primary")}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-12">
          <div className="card-inner flex flex-col items-center justify-center p-4 text-center md:col-span-3">
            {avgMood === null ? (
              <p className="text-sm text-muted-foreground">Registre seu humor no dashboard para ver aqui.</p>
            ) : (
              <>
                <Icon3D name={MOODS[avgMood].icon} size={64} />
                <p className="mt-2 text-lg font-bold">{MOODS[avgMood].label}</p>
                <p className="text-xs text-muted-foreground">
                  média de {inRange.length} {inRange.length === 1 ? "dia" : "dias"} · {avg!.toFixed(1).replace(".", ",")}/5
                </p>
              </>
            )}
          </div>
          <div className="card-inner p-4 md:col-span-6">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis domain={[1, 5]} ticks={[1, 3, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    formatter={(v) => [MOODS[5 - Number(v)]?.label ?? "", "Humor"]}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Line dataKey="v" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card-inner space-y-1.5 p-4 md:col-span-3">
            {MOODS.map((m, i) => (
              <div key={m.label} className="flex items-center gap-2 text-xs">
                <Icon3D name={m.icon} size={18} />
                <span className="w-14">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${inRange.length ? (counts[i] / inRange.length) * 100 : 0}%` }} />
                </div>
                <span className="w-4 text-right tabular-nums text-muted-foreground">{counts[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card-soft p-4 md:p-6">
        <h2 className="mb-3 text-lg font-bold">Minhas anotações</h2>
        {!written.length && <p className="text-sm text-muted-foreground">Nenhum relato ainda. Escreva o primeiro no card de humor do dashboard.</p>}
        <ul className="space-y-3">
          {written.map((e) => (
            <li key={e.day} className="card-inner flex flex-col gap-3 p-4 sm:flex-row">
              {e.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.photo} alt="" className="h-40 w-full shrink-0 rounded-xl object-cover sm:w-52" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {e.mood !== null && <Icon3D name={MOODS[e.mood].icon} size={20} />}
                  {fmtDay(e.day)}
                  {e.day === today && <span className="rounded-full bg-primary px-2 text-[10px] font-bold uppercase text-white">hoje</span>}
                </p>
                {e.journal && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{e.journal}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
