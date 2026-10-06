"use client";

// Gráficos Recharts da página de Estatísticas. Carregados com next/dynamic (ssr: false).
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, type Bucket } from "./lib";

type Point = { k: string; label: string; totalH: number; avgH: number; days: number; xp: number };

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" };
const cursor = { fill: "var(--muted)", opacity: 0.6 };

/** Espaçamento dos rótulos do eixo X para não encavalar no celular. */
const interval = (n: number) => (n <= 8 ? 0 : n <= 16 ? 1 : "preserveStartEnd");

const LABEL: Record<Bucket, string> = { day: "Dia", week: "Semana de", month: "Mês" };

export function FocusTimeline({ data, goalH, bucket }: { data: Point[]; goalH: number; bucket: Bucket }) {
  const perDay = bucket === "day";
  const key = perDay ? "totalH" : "avgH";
  const max = Math.max(goalH, ...data.map((d) => d[key]));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap={data.length > 20 ? 1 : "18%"}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval={interval(data.length)} minTickGap={8} />
        <YAxis axisLine={false} tickLine={false} tick={tick} width={44} domain={[0, Math.ceil(max)]} allowDecimals={false} tickFormatter={(v) => `${v}h`} />
        <Tooltip
          cursor={cursor}
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `${LABEL[bucket]} ${l}`}
          formatter={(_v, _n, item) => {
            const p = item.payload as Point;
            return perDay
              ? [`${fmtNum(p.totalH, 1)} h`, "Foco"]
              : [`${fmtNum(p.totalH, 1)} h no total · ${fmtNum(p.avgH, 1)} h/dia`, "Foco"];
          }}
        />
        <Bar dataKey={key} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        <ReferenceLine
          y={goalH}
          stroke="var(--success)"
          strokeWidth={2}
          ifOverflow="extendDomain"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function XpTimeline({ data, bucket }: { data: Point[]; bucket: Bucket }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }} barCategoryGap={data.length > 20 ? 1 : "18%"}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval={interval(data.length)} minTickGap={8} />
        <YAxis axisLine={false} tickLine={false} tick={tick} width={44} allowDecimals={false} />
        <Tooltip
          cursor={cursor}
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `${LABEL[bucket]} ${l}`}
          formatter={(v) => [`${fmtNum(Number(v))} XP`, "Ganho"]}
        />
        <Bar dataKey="xp" fill="var(--xp)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
