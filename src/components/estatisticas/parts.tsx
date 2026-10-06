"use client";

// Peças visuais da página de Estatísticas (sem Recharts: barras e calendário em HTML/CSS).
import { useEffect, useRef } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/day";
import { fmtHours, fmtNum } from "./lib";

export const AREA_COLOR: Record<string, string> = {
  Matemática: "var(--chart-1)",
  Natureza: "var(--chart-2)",
  Linguagens: "var(--chart-3)",
  Humanas: "var(--chart-4)",
  Redação: "var(--chart-5)",
};
export const areaColor = (a: string) => AREA_COLOR[a] ?? "var(--muted-foreground)";

export function Card({ title, icon, action, className, children }: { title: string; icon?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("card-soft min-w-0 p-4 md:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {icon && <Icon3D name={icon} size={22} />}
        <h2 className="flex-1 text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card-inner px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/* ---------- Comparação com o período anterior ---------- */

export function Delta({ cur, prev, unit = "%" }: { cur: number | null; prev: number | null | undefined; unit?: "%" | "pp" | "abs" }) {
  if (prev === undefined) return null;
  if (prev === null || cur === null) return <span className="text-xs text-muted-foreground">sem comparação</span>;
  let diff: number;
  let text: string;
  if (unit === "%") {
    if (prev === 0) return cur > 0 ? <span className="text-xs font-semibold text-success">novo no período</span> : <span className="text-xs text-muted-foreground">igual</span>;
    diff = Math.round(((cur - prev) / prev) * 100);
    text = `${diff > 0 ? "+" : ""}${diff}%`;
  } else {
    diff = Math.round(cur - prev);
    text = `${diff > 0 ? "+" : ""}${fmtNum(diff)}${unit === "pp" ? " p.p." : ""}`;
  }
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden />
      {text}
      <span className="sr-only"> em relação ao período anterior</span>
    </span>
  );
}

export function Tile({ icon, label, value, sub, delta, className }: { icon: string; label: string; value: string; sub?: React.ReactNode; delta?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-soft flex min-w-0 flex-col gap-1 p-3 md:p-4", className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon3D name={icon} size={18} />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-extrabold leading-tight tabular-nums md:text-3xl">{value}</p>
      <div className="flex min-h-4 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {delta}
        {sub}
      </div>
    </div>
  );
}

/* ---------- Barras horizontais ---------- */

export type HRow = { key: string; label: React.ReactNode; value: number; display: string; note?: string; color?: string };

export function HBars({ rows, max }: { rows: HRow[]; max?: number }) {
  const top = max ?? Math.max(1e-9, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            {r.note && <span className="shrink-0 text-xs text-muted-foreground">{r.note}</span>}
            <span className="shrink-0 font-semibold tabular-nums">{r.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, background: r.color ?? "var(--chart-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Colunas (horas do dia, dias da semana) ---------- */

export function Columns({ values, labels, title, tickEvery = 1, height = "h-28" }: { values: number[]; labels: string[]; title: (i: number) => string; tickEvery?: number; height?: string }) {
  const max = Math.max(1e-9, ...values);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div>
      <div className={cn("flex items-end gap-[2px]", height)} role="list">
        {values.map((v, i) => (
          <div key={i} role="listitem" className="group relative flex h-full flex-1 items-end" title={title(i)} aria-label={title(i)}>
            <div
              className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{
                height: v > 0 ? `${Math.max(4, (v / max) * 100)}%` : "2px",
                background: v > 0 ? "var(--chart-1)" : "var(--border)",
                opacity: v > 0 && i !== peak ? 0.45 : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted-foreground">
        {labels.map((l, i) => (
          <span key={i} className={cn("flex-1 text-center", i === peak && values[i] > 0 && "font-bold text-foreground")}>
            {i % tickEvery === 0 ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Calendário do ano (estilo GitHub) ---------- */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LEVELS = ["var(--muted)", "color-mix(in oklch, var(--chart-1) 30%, var(--card))", "color-mix(in oklch, var(--chart-1) 55%, var(--card))", "color-mix(in oklch, var(--chart-1) 80%, var(--card))", "var(--chart-1)"];

function level(min: number, goal: number) {
  if (min <= 0) return 0;
  const r = min / Math.max(1, goal);
  return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4;
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function YearHeatmap({ from, to, days, goalMin }: { from: string; to: string; days: [string, number][]; goalMin: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth; // no celular, começa pelas semanas mais recentes
  }, []);
  const map = new Map(days);
  const weeks: string[][] = [];
  for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  const studied = days.length;
  const total = days.reduce((a, [, m]) => a + m, 0);

  return (
    <div>
      <div className="flex gap-1">
        <div className="grid shrink-0 grid-rows-[14px_repeat(7,minmax(0,1fr))] gap-[3px] text-[9px] leading-none text-muted-foreground">
          <span />
          {["", "Seg", "", "Qua", "", "Sex", ""].map((l, i) => (
            <span key={i} className="flex items-center">
              {l}
            </span>
          ))}
        </div>
        <div ref={scroller} className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-[640px] gap-[3px]">
            {weeks.map((w, wi) => {
              const m1 = w.find((d) => d.endsWith("-01") && d <= to);
              const label = m1 && wi < weeks.length - 1 ? MONTHS[Number(m1.slice(5, 7)) - 1] : "";
              return (
                <div key={w[0]} className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[14px_repeat(7,auto)] gap-[3px]">
                  <span className="relative h-[14px]"><span className="absolute left-0 top-0 whitespace-nowrap text-[9px] leading-[14px] text-muted-foreground">{label}</span></span>
                  {w.map((d) => {
                    if (d > to) return <span key={d} className="aspect-square" />;
                    const m = map.get(d) ?? 0;
                    const tip = `${fmtDate(d)}: ${m ? fmtHours(m) : "sem foco"}`;
                    return <span key={d} title={tip} aria-label={tip} className="aspect-square w-full rounded-[3px]" style={{ background: LEVELS[level(m, goalMin)] }} />;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <b className="text-foreground">{studied}</b> dias com foco · <b className="text-foreground">{fmtHours(total)}</b> no ano
        </span>
        <span className="ml-auto flex items-center gap-1">
          Menos
          {LEVELS.map((c, i) => (
            <span key={i} className="size-[11px] rounded-[3px]" style={{ background: c }} />
          ))}
          Meta batida
        </span>
      </div>
    </div>
  );
}

/* ---------- Progresso simples ---------- */

export function Meter({ value, label, detail, color = "var(--chart-1)" }: { value: number | null; label: string; detail: React.ReactNode; color?: string }) {
  return (
    <div className="card-inner p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-2xl font-extrabold tabular-nums">{value === null ? "–" : `${value}%`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
