"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/lib/day";
import type { StatsData } from "@/server/stats-queries";
import { fmtHours, fmtNum, PERIODS, pct, type PeriodKey } from "./lib";
import { areaColor, Card, Columns, Delta, Empty, HBars, Meter, Tile, YearHeatmap } from "./parts";

// Recharts só no navegador, num pedaço separado do bundle.
const ChartSkeleton = () => <div className="size-full animate-pulse rounded-xl bg-muted" />;
const FocusTimeline = dynamic(() => import("./charts").then((m) => m.FocusTimeline), { ssr: false, loading: ChartSkeleton });
const XpTimeline = dynamic(() => import("./charts").then((m) => m.XpTimeline), { ssr: false, loading: ChartSkeleton });

const MOODS = [
  { icon: "emoji/h1.webp", label: "Ótimo" },
  { icon: "emoji/h2.webp", label: "Bem" },
  { icon: "emoji/h3.webp", label: "Ok" },
  { icon: "emoji/h4.webp", label: "Mal" },
  { icon: "emoji/h5.webp", label: "Exausto" },
];

const fmtShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export function StatsScreen({ data }: { data: StatsData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [want, setWant] = useState<PeriodKey>(data.period);
  const choose = (k: PeriodKey) => {
    setWant(k);
    start(() => router.replace(k === "30d" ? "/estatisticas" : `/estatisticas?p=${k}`, { scroll: false }));
  };
  const active = pending ? want : data.period;
  const hasPrev = data.range.prevFrom !== null;
  const prevLabel = hasPrev ? `${fmtShort(data.range.prevFrom!)} – ${fmtShort(data.range.prevTo!)}` : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="card-soft flex flex-col gap-3 p-4 md:flex-row md:items-center md:px-6">
        <div className="flex items-center gap-3">
          <Icon3D name="emoji/grafico.webp" size={40} />
          <div>
            <h1 className="text-xl font-bold leading-tight">Estatísticas</h1>
            <p className="text-sm text-muted-foreground">
              {fmtShort(data.range.from)} – {fmtShort(data.range.to)}
              {prevLabel && <span className="hidden sm:inline"> · comparado com {prevLabel}</span>}
            </p>
          </div>
          {pending && <Loader2 className="size-5 animate-spin text-primary md:hidden" aria-label="Carregando" />}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:ml-auto md:px-0" role="tablist" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={active === p.key}
              onClick={() => choose(p.key)}
              className={cn(
                "whitespace-nowrap rounded-full border-2 px-3.5 py-1 text-sm font-semibold transition-colors",
                active === p.key ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-card text-primary hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
          {pending && <Loader2 className="hidden size-5 shrink-0 animate-spin self-center text-primary md:block" aria-label="Carregando" />}
        </div>
      </header>

      <div className={cn("space-y-4 transition-opacity md:space-y-6", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
        <Summary data={data} />
        <Timeline data={data} />
        <Card title="Calendário do ano" icon="emoji/calor.webp">
          <YearHeatmap {...data.heat} />
        </Card>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Areas data={data} />
          <Subjects data={data} />
        </div>
        <Accuracy data={data} />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Kinds data={data} />
          <Hours data={data} />
        </div>
        <Xp data={data} />
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          <Exams data={data} />
          <Habits data={data} />
          <Plan data={data} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Resumo ---------- */

function Summary({ data }: { data: StatsData }) {
  const s = data.summary;
  const p = (x: { prev: number | null }) => (data.range.prevFrom ? x.prev : undefined);
  const perDay = s.daysStudied.cur ? s.focusMin.cur / s.daysStudied.cur : 0;
  const prevPerDay = s.daysStudied.prev ? s.focusMin.prev! / s.daysStudied.prev : s.daysStudied.prev === 0 ? 0 : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <Tile icon="emoji/cronometro.webp" label="Horas de foco" value={fmtHours(s.focusMin.cur)} delta={<Delta cur={s.focusMin.cur} prev={p(s.focusMin)} />} />
      <Tile icon="emoji/foguete.webp" label="Sessões" value={fmtNum(s.sessions.cur)} delta={<Delta cur={s.sessions.cur} prev={p(s.sessions)} />} />
      <Tile
        icon="emoji/check.webp"
        label="Dias estudados"
        value={`${s.daysStudied.cur}`}
        sub={<span>de {data.range.days}</span>}
        delta={<Delta cur={s.daysStudied.cur} prev={p(s.daysStudied)} unit="abs" />}
      />
      <Tile
        icon="emoji/livro.webp"
        label="Média por dia estudado"
        value={s.daysStudied.cur ? fmtHours(perDay) : "–"}
        delta={<Delta cur={s.daysStudied.cur ? perDay : null} prev={data.range.prevFrom ? prevPerDay : undefined} />}
      />
      <Tile
        icon="fogo.png"
        label="Sequência atual"
        value={`${s.streak} ${s.streak === 1 ? "dia" : "dias"}`}
        sub={
          <span className="inline-flex items-center gap-1">
            <Icon3D name="emoji/trofeu.webp" size={14} /> recorde {s.streakRecord}
          </span>
        }
      />
      <Tile icon="moeda-xp.png" label="XP ganho" value={fmtNum(s.xp.cur)} delta={<Delta cur={s.xp.cur} prev={p(s.xp)} />} />
      <Tile icon="emoji/tarefas.webp" label="Questões" value={fmtNum(s.questions.cur)} delta={<Delta cur={s.questions.cur} prev={p(s.questions)} />} />
      <Tile
        icon="emoji/alvo.webp"
        label="Acerto"
        value={s.accuracy.cur === null ? "–" : `${s.accuracy.cur}%`}
        delta={data.range.prevFrom ? <Delta cur={s.accuracy.cur} prev={s.accuracy.prev} unit="pp" /> : undefined}
      />
    </div>
  );
}

/* ---------- Linha do tempo ---------- */

function Timeline({ data }: { data: StatsData }) {
  const perDay = data.bucket === "day";
  const any = data.timeline.some((t) => t.totalH > 0);
  return (
    <Card
      title={perDay ? "Horas de foco por dia" : data.bucket === "week" ? "Horas por semana (média por dia)" : "Horas por mês (média por dia)"}
      icon="emoji/grafico.webp"
      action={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-0.5 w-4 rounded bg-success" /> meta diária {fmtNum(data.goalH, 1)} h
        </span>
      }
    >
      {any ? (
        <div className="h-56 md:h-64">
          <FocusTimeline data={data.timeline} goalH={data.goalH} bucket={data.bucket} />
        </div>
      ) : (
        <Empty>Nenhuma sessão de foco neste período.</Empty>
      )}
    </Card>
  );
}

/* ---------- Áreas e matérias ---------- */

function Areas({ data }: { data: StatsData }) {
  const total = data.areas.reduce((a, r) => a + r.min, 0);
  const rows = data.areas.filter((a) => a.min > 0);
  return (
    <Card title="Horas por área" icon="emoji/livro.webp">
      {rows.length ? (
        <>
          <div className="mb-4 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {rows.map((a) => (
              <div key={a.area} style={{ width: `${(a.min / total) * 100}%`, background: areaColor(a.area) }} title={`${a.area}: ${fmtHours(a.min)}`} />
            ))}
          </div>
          <HBars
            rows={rows.map((a) => ({
              key: a.area,
              label: (
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: areaColor(a.area) }} />
                  {a.area}
                </span>
              ),
              value: a.min,
              display: fmtHours(a.min),
              note: `${pct(a.min, total)}%`,
              color: areaColor(a.area),
            }))}
          />
        </>
      ) : (
        <Empty>Sem horas de foco neste período.</Empty>
      )}
    </Card>
  );
}

function Subjects({ data }: { data: StatsData }) {
  const rows = data.subjects.filter((s) => s.min > 0).sort((a, b) => b.min - a.min).slice(0, 8);
  return (
    <Card title="Matérias com mais horas" icon="emoji/estrela.webp">
      {rows.length ? (
        <HBars
          rows={rows.map((s) => ({
            key: `${s.area}|${s.subject}`,
            label: (
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: areaColor(s.area) }} />
                <span className="truncate">{s.subject}</span>
              </span>
            ),
            value: s.min,
            display: fmtHours(s.min),
            color: areaColor(s.area),
          }))}
        />
      ) : (
        <Empty>Sem matérias estudadas neste período.</Empty>
      )}
    </Card>
  );
}

function Accuracy({ data }: { data: StatsData }) {
  const [by, setBy] = useState<"area" | "subject">("area");
  const src = (by === "area" ? data.areas.map((a) => ({ ...a, subject: "" })) : data.subjects)
    .map((r) => ({ ...r, total: r.done + r.bankDone, right: r.correct + r.bankCorrect }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  return (
    <Card
      title="Acerto por área e matéria"
      icon="emoji/alvo.webp"
      action={
        <div className="flex rounded-full bg-muted p-0.5 text-xs font-semibold">
          {(["area", "subject"] as const).map((k) => (
            <button key={k} onClick={() => setBy(k)} className={cn("rounded-full px-3 py-1", by === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {k === "area" ? "Áreas" : "Matérias"}
            </button>
          ))}
        </div>
      }
    >
      {src.length ? (
        <>
          <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {src.map((r) => {
              const p = pct(r.right, r.total)!;
              return (
                <li key={`${r.area}|${r.subject}`} className="text-sm">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="size-2.5 shrink-0 self-center rounded-full" style={{ background: areaColor(r.area) }} />
                    <span className="min-w-0 flex-1 truncate">{by === "area" ? r.area : r.subject}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.right}/{r.total}
                    </span>
                    <span className="w-10 shrink-0 text-right font-bold tabular-nums">{p}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.done > 0 && `Foco ${pct(r.correct, r.done)}% (${r.done})`}
                    {r.done > 0 && r.bankDone > 0 && " · "}
                    {r.bankDone > 0 && `Banco ${pct(r.bankCorrect, r.bankDone)}% (${r.bankDone})`}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <Empty>Registre questões no fim do Foco ou responda o banco de questões para ver seu acerto.</Empty>
      )}
    </Card>
  );
}

/* ---------- Tipos de estudo e horários ---------- */

function Kinds({ data }: { data: StatsData }) {
  const totalK = data.kinds.reduce((a, r) => a + r.min, 0);
  const totalM = data.methods.reduce((a, r) => a + r.min, 0);
  const toRows = (l: StatsData["kinds"], total: number) =>
    l.map((r) => ({ key: r.name, label: r.name, value: r.min, display: fmtHours(r.min), note: `${r.n} ${r.n === 1 ? "sessão" : "sessões"} · ${pct(r.min, total)}%` }));
  return (
    <Card title="Tipos de estudo" icon="emoji/tarefas.webp">
      {totalK ? (
        <div className="space-y-5">
          <HBars rows={toRows(data.kinds, totalK)} />
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Por método</h3>
            <HBars rows={toRows(data.methods, totalM)} />
          </div>
        </div>
      ) : (
        <Empty>Sem sessões neste período.</Empty>
      )}
    </Card>
  );
}

function Hours({ data }: { data: StatsData }) {
  const any = data.hours.some((h) => h > 0);
  const peakH = data.hours.indexOf(Math.max(...data.hours));
  const wd = data.weekdays.map((w) => w.min);
  const peakD = wd.indexOf(Math.max(...wd));
  return (
    <Card title="Quando você estuda" icon="emoji/sol.webp">
      {any ? (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hora do dia (início da sessão)</h3>
              <span className="text-xs">
                pico <b>{peakH}h–{peakH + 1}h</b>
              </span>
            </div>
            <Columns
              values={data.hours}
              labels={data.hours.map((_, h) => `${h}h`)}
              tickEvery={3}
              title={(h) => `${h}h–${h + 1}h: ${fmtHours(data.hours[h])}`}
            />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dia da semana</h3>
              <span className="text-xs">
                mais forte: <b>{WEEKDAYS[peakD]}</b>
              </span>
            </div>
            <Columns
              values={wd}
              labels={WEEKDAYS}
              height="h-24"
              title={(d) => `${WEEKDAYS[d]}: ${fmtHours(wd[d])} em ${data.weekdays[d].days} ${data.weekdays[d].days === 1 ? "dia" : "dias"}`}
            />
          </div>
        </div>
      ) : (
        <Empty>Sem sessões neste período.</Empty>
      )}
    </Card>
  );
}

/* ---------- XP ---------- */

function Xp({ data }: { data: StatsData }) {
  const total = data.xpSources.reduce((a, r) => a + r.xp, 0);
  return (
    <Card title="XP" icon="emoji/raio.webp" action={<span className="text-sm font-bold tabular-nums text-xp">{fmtNum(total)} XP</span>}>
      {total ? (
        <div className="grid gap-5 md:grid-cols-5">
          <div className="md:col-span-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {data.bucket === "day" ? "Por dia" : data.bucket === "week" ? "Por semana" : "Por mês"}
            </h3>
            <div className="h-48">
              <XpTimeline data={data.timeline} bucket={data.bucket} />
            </div>
          </div>
          <div className="md:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">De onde veio</h3>
            <HBars rows={data.xpSources.map((r) => ({ key: r.cat, label: r.cat, value: r.xp, display: fmtNum(r.xp), note: `${pct(r.xp, total)}%`, color: "var(--xp)" }))} />
          </div>
        </div>
      ) : (
        <Empty>Nenhum XP neste período.</Empty>
      )}
    </Card>
  );
}

/* ---------- Simulados, hábitos, cronograma ---------- */

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card-inner min-w-0 p-3">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function GoLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
      {children}
      <ChevronRight className="size-4" />
    </Link>
  );
}

function Exams({ data }: { data: StatsData }) {
  const { exams: e, essays: r } = data;
  return (
    <Card title="Simulados e redação" icon="emoji/trofeu.webp">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Último simulado" value={e.last ? `${e.last.total}/180` : "–"} sub={e.last ? e.last.name : "nenhum ainda"} />
        <MiniStat label="Recorde" value={e.record ? `${e.record.total}/180` : "–"} sub={e.record ? fmtShort(e.record.day) : undefined} />
        <MiniStat
          label="Redação no período"
          value={r.periodAvg !== null ? fmtNum(r.periodAvg) : "–"}
          sub={r.periodCount ? `média de ${r.periodCount}` : "nenhuma no período"}
        />
        <MiniStat label="Redação geral" value={r.avg !== null ? fmtNum(r.avg) : "–"} sub={r.best !== null ? `recorde ${r.best} · ${r.count} no total` : "nenhuma corrigida"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <GoLink href="/simulados">Simulados</GoLink>
        <GoLink href="/redacoes">Redações</GoLink>
      </div>
    </Card>
  );
}

function Habits({ data }: { data: StatsData }) {
  const h = data.habits.cur;
  const mood = h?.mood != null ? MOODS[Math.min(4, Math.max(0, Math.round(h.mood)))] : null;
  const prev = data.habits.prev;
  return (
    <Card title="Hábitos" icon="emoji/agua.webp">
      {h ? (
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Água" value={h.waterDays ? `${fmtNum(h.water, 1)} copos` : "–"} sub={h.waterDays ? `média em ${h.waterDays} dias` : "sem registro"} />
          <MiniStat label="Leitura" value={h.readingDays ? `${Math.round(h.reading)} min` : "–"} sub={h.readingDays ? `média em ${h.readingDays} dias` : "sem registro"} />
          <MiniStat
            label="Exercício"
            value={`${h.exercise} ${h.exercise === 1 ? "dia" : "dias"}`}
            sub={prev ? `antes: ${prev.exercise}` : `de ${data.range.days}`}
          />
          <div className="card-inner min-w-0 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Humor médio</p>
            {mood ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-base font-extrabold">
                <Icon3D name={mood.icon} size={26} /> {mood.label}
              </p>
            ) : (
              <p className="text-xl font-extrabold">–</p>
            )}
          </div>
        </div>
      ) : (
        <Empty>Registre água, leitura e humor no Diário para ver seus hábitos aqui.</Empty>
      )}
      <div className="mt-3">
        <GoLink href="/diario">Diário</GoLink>
      </div>
    </Card>
  );
}

function Plan({ data }: { data: StatsData }) {
  const b = data.plan.blocks;
  const r = data.plan.reviews;
  const bp = b ? pct(b.done, b.total) : null;
  const rp = r ? pct(r.onTime, r.total) : null;
  const pb = data.plan.prevBlocks;
  const pr = data.plan.prevReviews;
  return (
    <Card title="Cronograma e revisões" icon="emoji/revisao.webp">
      <div className="space-y-2">
        <Meter
          label="Blocos cumpridos"
          value={bp}
          detail={
            b ? (
              <span className="flex flex-wrap items-center gap-x-2">
                {b.done} de {b.total} · {fmtHours(b.doneMin)} de {fmtHours(b.planned)}
                {pb && <Delta cur={bp} prev={pct(pb.done, pb.total)} unit="pp" />}
              </span>
            ) : (
              "nenhum bloco planejado no período"
            )
          }
        />
        <Meter
          label="Revisões em dia"
          value={rp}
          color="var(--chart-5)"
          detail={
            r ? (
              <span className="flex flex-wrap items-center gap-x-2">
                {r.onTime} de {r.total} no prazo{r.late > 0 && ` · ${r.late} atrasadas`}
                {r.total - r.onTime - r.late > 0 && ` · ${r.total - r.onTime - r.late} pendentes`}
                {pr && <Delta cur={rp} prev={pct(pr.onTime, pr.total)} unit="pp" />}
              </span>
            ) : (
              "nenhuma revisão vencendo no período"
            )
          }
        />
      </div>
      <div className="mt-3">
        <GoLink href="/cronograma">Cronograma</GoLink>
      </div>
    </Card>
  );
}
