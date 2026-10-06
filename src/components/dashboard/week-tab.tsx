import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { getWeekTab, type WeekTabData } from "@/server/dashboard-tabs";

const fmtH = (min: number) => {
  const h = Math.round((min / 60) * 10) / 10;
  return `${String(h).replace(".", ",")} h`;
};
const fmtN = (n: number) => Math.round(n).toLocaleString("pt-BR");
const acc = (t: { done: number; correct: number }) => (t.done ? Math.round((Math.min(t.correct, t.done) / t.done) * 100) : null);

export async function WeekTab({ userId }: { userId: string }) {
  const d = await getWeekTab(userId);
  return (
    <div className="grid gap-3 md:grid-cols-12 md:gap-4">
      <HoursChart d={d} />
      <div className="grid grid-cols-2 gap-3 md:col-span-5 md:gap-4 lg:col-span-4">
        <Tile icon="moeda-xp.png" label="XP da semana" value={fmtN(d.cur.xp)} sub={`meta ${fmtN(d.weeklyXpGoal)}`}>
          <Bar pct={(d.cur.xp / Math.max(1, d.weeklyXpGoal)) * 100} className="bg-xp" />
        </Tile>
        <Tile
          icon="emoji/alvo.webp"
          label="Questões"
          value={fmtN(d.cur.done)}
          sub={acc(d.cur) == null ? "sem questões ainda" : `${acc(d.cur)}% de acerto`}
        />
        <Tile
          icon="calendario.png"
          label="Blocos cumpridos"
          value={`${d.cur.blocksDone}/${d.cur.blocksTotal}`}
          sub={d.cur.blocksTotal ? "do cronograma" : "monte seu cronograma"}
        >
          {d.cur.blocksTotal > 0 && <Bar pct={(d.cur.blocksDone / d.cur.blocksTotal) * 100} className="bg-success" />}
        </Tile>
        <Tile
          icon="emoji/trofeu.webp"
          label="Melhor dia"
          value={d.best ? d.best.label : "—"}
          sub={d.best ? `${fmtH(d.best.min)} de foco` : "estude para marcar"}
        />
      </div>
      <Compare d={d} />
    </div>
  );
}

function HoursChart({ d }: { d: WeekTabData }) {
  const max = Math.max(60, ...d.days.map((x) => Math.max(x.min, x.goalMin)));
  const pct = d.goalMin ? Math.min(100, (d.cur.min / d.goalMin) * 100) : 0;
  return (
    <section className="card-inner p-4 md:col-span-7 lg:col-span-8">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon3D name="emoji/cronometro.webp" size={20} />
          <h3 className="text-sm font-semibold">Horas por dia vs meta</h3>
        </div>
        <p className="text-sm">
          <b className="text-lg tabular-nums">{fmtH(d.cur.min)}</b>
          <span className="text-muted-foreground"> de {fmtH(d.goalMin)}</span>
        </p>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex h-48 items-end gap-2 md:gap-3" role="img" aria-label="Horas de foco por dia da semana">
        {d.days.map((x) => {
          const hit = x.goalMin > 0 && x.min >= x.goalMin;
          return (
            <div key={x.day} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{x.min ? fmtH(x.min).replace(" h", "h") : ""}</span>
              <div className="relative w-full max-w-10 flex-1">
                {x.goalMin > 0 && (
                  <div
                    title={`Meta: ${fmtH(x.goalMin)}`}
                    className="absolute inset-x-0 rounded-lg border-2 border-dashed border-primary/30"
                    style={{ bottom: 0, height: `${(x.goalMin / max) * 100}%` }}
                  />
                )}
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 rounded-lg transition-all",
                    hit ? "bg-success" : x.today ? "bg-primary" : "bg-primary/70",
                  )}
                  style={{ height: `${Math.max(x.min ? 4 : 0, (x.min / max) * 100)}%` }}
                />
                {hit && <span className="absolute inset-x-0 -top-1 text-center text-xs">✓</span>}
              </div>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-[11px] font-bold",
                  x.today ? "bg-primary text-primary-foreground" : x.rest ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
                title={x.rest ? "Descanso" : undefined}
              >
                {x.label.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border-2 border-dashed border-primary/40" /> meta do dia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-success" /> meta batida ({d.goalDays} {d.goalDays === 1 ? "dia" : "dias"})
        </span>
      </p>
    </section>
  );
}

function Tile({ icon, label, value, sub, children }: { icon: string; label: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <section className="card-inner flex flex-col p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon3D name={icon} size={16} /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      {children && <div className="mt-auto pt-2">{children}</div>}
    </section>
  );
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-card">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return <span className="text-xs text-muted-foreground">—</span>;
  if (!prev) return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">novo</span>;
  const p = Math.round(((cur - prev) / prev) * 100);
  const Icon = p > 0 ? ArrowUpRight : p < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        p > 0 ? "bg-success/15 text-success" : p < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {p > 0 ? "+" : ""}
      {p}%
    </span>
  );
}

function Compare({ d }: { d: WeekTabData }) {
  const rows = [
    { label: "Horas de foco", cur: d.cur.min, prev: d.prev.min, fmt: fmtH },
    { label: "XP", cur: d.cur.xp, prev: d.prev.xp, fmt: fmtN },
    { label: "Questões", cur: d.cur.done, prev: d.prev.done, fmt: fmtN },
    { label: "Blocos cumpridos", cur: d.cur.blocksDone, prev: d.prev.blocksDone, fmt: fmtN },
  ];
  const a = acc(d.cur);
  const b = acc(d.prev);
  return (
    <section className="card-inner p-4 md:col-span-12">
      <div className="mb-3 flex items-center gap-2">
        <Icon3D name="emoji/grafico.webp" size={20} />
        <h3 className="flex-1 text-sm font-semibold">Comparação com a semana passada</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{r.label}</p>
            <p className="font-bold tabular-nums">{r.fmt(r.cur)}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
              <span className="truncate text-[11px] text-muted-foreground">antes: {r.fmt(r.prev)}</span>
              <Delta cur={r.cur} prev={r.prev} />
            </div>
          </div>
        ))}
        <div className="rounded-xl bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Taxa de acerto</p>
          <p className="font-bold tabular-nums">{a == null ? "—" : `${a}%`}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
            <span className="truncate text-[11px] text-muted-foreground">antes: {b == null ? "—" : `${b}%`}</span>
            {a != null && b != null && (
              <span className={cn("text-xs font-semibold tabular-nums", a >= b ? "text-success" : "text-destructive")}>
                {a >= b ? "+" : ""}
                {a - b} p.p.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
