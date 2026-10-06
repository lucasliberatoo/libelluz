"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Check, Pencil, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Foguinho, Icon3D } from "@/components/brand";
import { levelFromXp } from "@/lib/levels";
import {
  areaColor,
  goalsToday,
  hoursBySubject,
  reviewsToday,
  stats,
  tasksToday,
  todayIndex,
  user,
  week,
  weekHours,
  xpGoals,
  xpToday,
  xpWeek,
} from "@/lib/mock";

const TABS = ["Hoje", "Semana", "Jornada", "Ranking & Conquistas"] as const;

export function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Hoje");
  return (
    <div className="space-y-4 md:space-y-6">
      <ProgressHeader />
      <section className="card-soft relative p-3 md:p-5">
        <Foguinho stage={2} className="pointer-events-none absolute -top-9 right-3 hidden size-20 -rotate-6 drop-shadow-md md:block" />
        <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 md:mx-0 md:px-0 md:pr-24">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "whitespace-nowrap rounded-full border-2 px-4 py-1 text-sm font-semibold transition-colors",
                t === tab
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/70 bg-card text-primary hover:bg-accent",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "Hoje" ? (
          <TodayTab />
        ) : (
          <div className="card-inner grid place-items-center p-12 text-center text-muted-foreground">
            <p>
              A aba <b className="text-foreground">{tab}</b> vem nas próximas etapas.
            </p>
          </div>
        )}
      </section>
      <StatsSection />
    </div>
  );
}

function ProgressHeader() {
  const lv = levelFromXp(user.totalXp);
  const pct = lv.levelSpan ? (lv.intoLevel / lv.levelSpan) * 100 : 100;
  return (
    <section className="card-soft flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-5 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-violet-200 text-xl font-bold text-violet-700 dark:bg-violet-500/30 dark:text-violet-200">
          L
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">
            <span className="hidden md:inline">Olá, {user.fullName}!</span>
            <span className="md:hidden">Seu progresso</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Nível {lv.level} · {lv.title}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 md:gap-3">
        <Pill icon="moeda-xp.png" label="XP do nível">
          <div className="w-full">
            <p className="text-xs font-bold tabular-nums">
              {lv.intoLevel}
              <span className="font-normal text-muted-foreground">/{lv.levelSpan} XP</span>
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-xp" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Pill>
        <Pill icon="calendario.png" label="dias estudando">
          <p className="text-xl font-extrabold tabular-nums text-primary">{user.studiedDays}</p>
        </Pill>
        <Pill icon="gauge.png" label="Modo de estudo">
          <p className="text-sm font-extrabold uppercase">{user.studyMode}</p>
        </Pill>
      </div>
      <Link
        href="/foco"
        className="group flex items-center justify-center gap-2 rounded-2xl px-2 py-1 transition active:scale-95 md:flex-col md:gap-0.5"
      >
        <Icon3D name="botao-foco.png" size={52} className="transition group-hover:-translate-y-0.5" />
        <span className="text-xs font-extrabold uppercase tracking-wide">Modo Foco</span>
      </Link>
    </section>
  );
}

function Pill({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="card-inner flex flex-col gap-1.5 p-2.5 md:flex-row md:items-center md:gap-3 md:p-3">
      <Icon3D name={icon} size={34} />
      <div className="min-w-0 flex-1">
        {children}
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TodayTab() {
  return (
    <div className="grid gap-3 md:grid-cols-12 md:gap-4">
      <div className="md:col-span-4">
        <XpCard />
      </div>
      <div className="space-y-3 md:col-span-5 md:space-y-4">
        <ContinueCard />
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          <TasksCard />
          <div className="space-y-3 md:space-y-4">
            <GoalsCard />
            <ReviewsCard />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          <WaterCard />
          <MoodCard />
        </div>
      </div>
      <div className="space-y-3 md:col-span-3 md:space-y-4">
        <StreakCard />
        <ReadingCard />
        <ExerciseCard />
      </div>
    </div>
  );
}

function CardTitle({ icon, children, action }: { icon?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <Icon3D name={icon} size={20} />}
      <h3 className="flex-1 text-sm font-semibold">{children}</h3>
      {action}
    </div>
  );
}

/* ---------- XP do dia / semana ---------- */

function XpCard() {
  const [range, setRange] = useState<"Dia" | "Semana">("Semana");
  const lv = levelFromXp(user.totalXp);
  const todayXp = xpWeek[todayIndex].xp;
  const weekXp = xpWeek.reduce((s, d) => s + d.xp, 0);
  const daysSoFar = todayIndex + 1;
  const value = range === "Dia" ? todayXp : weekXp;
  const goal = range === "Dia" ? xpGoals.day : xpGoals.week;
  const pct = Math.min(1, value / goal);
  const r = 62;
  const c = 2 * Math.PI * r;
  const data = range === "Dia" ? xpToday.map((x) => ({ k: x.h, xp: x.xp })) : xpWeek.map((x) => ({ k: x.d, xp: x.xp }));
  return (
    <section className="card-inner flex h-full flex-col p-4">
      <CardTitle
        icon="moeda-xp.png"
        action={
          <div className="flex rounded-full bg-card p-0.5 text-xs font-semibold ring-1 ring-border">
            {(["Dia", "Semana"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn("rounded-full px-2.5 py-0.5", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        XP {range === "Dia" ? "do dia" : "da semana"}
      </CardTitle>

      <div className="relative mx-auto my-1 size-40">
        <svg viewBox="0 0 150 150" className="-rotate-90">
          <circle cx="75" cy="75" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke="var(--success)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="mx-auto mb-1 rounded-full bg-success px-2 text-[11px] font-bold text-white">{Math.round(pct * 100)}%</span>
          <span className="text-3xl font-extrabold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">de {goal} XP</span>
        </div>
      </div>

      <div className="mt-2 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="k" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              formatter={(v) => [`${v} XP`, "Ganho"]}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="xp" radius={[6, 6, 6, 6]} maxBarSize={22}>
              {data.map((d, i) => (
                <Cell key={d.k} fill={range === "Semana" && i === todayIndex ? "var(--success)" : "var(--chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-0.5 text-center text-sm">
        <p className="font-bold">{todayXp === 0 ? "Hora de começar!" : "Bora manter o ritmo!"}</p>
        <p className="text-muted-foreground">
          Faltam <b className="text-xp">{lv.levelSpan - lv.intoLevel} XP</b> para o nível {lv.level + 1}
        </p>
        <p className="text-muted-foreground">
          Média diária <b className="text-success">{Math.round(weekXp / daysSoFar)} XP</b>
        </p>
      </div>
    </section>
  );
}

/* ---------- Hoje ---------- */

function ContinueCard() {
  const t = tasksToday[0];
  return (
    <Link
      href="/foco"
      className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-blue-400 p-4 text-white shadow-md"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/25 transition group-hover:scale-105">
        <Play className="size-6 fill-current" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-85">Continuar de onde parei</p>
        <p className="truncate text-lg font-bold">{t.topic}</p>
        <p className="text-sm opacity-90">
          {t.subject} · {t.doneMin} de {t.hours * 60} min
        </p>
      </div>
    </Link>
  );
}

function TasksCard() {
  return (
    <section className="card-inner p-3">
      <CardTitle icon="emoji/tarefas.webp">To do list</CardTitle>
      <ul className="space-y-1.5">
        {tasksToday.map((t) => {
          const pct = Math.min(1, t.doneMin / (t.hours * 60));
          const done = pct >= 1;
          return (
            <li key={t.id}>
              <Link href="/foco" className="flex items-center gap-2.5 rounded-xl bg-card p-2 shadow-sm transition hover:ring-1 hover:ring-primary/40">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-white", areaColor[t.area])}>
                  {done ? <Check className="size-4" /> : <span className="text-xs font-bold">{t.subject[0]}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">{t.subject}</p>
                  <p className={cn("truncate text-[13px] font-semibold leading-tight", done && "text-muted-foreground line-through")}>{t.topic}</p>
                  <p className="text-[10px] text-muted-foreground">{String(t.hours).replace(".", ",")} hora{t.hours > 1 ? "s" : ""}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GoalsCard() {
  return (
    <section className="card-inner p-3">
      <CardTitle icon="emoji/alvo.webp">Metas</CardTitle>
      <ul className="space-y-2.5">
        {goalsToday.map((g) => (
          <li key={g.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{g.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {g.value.toLocaleString("pt-BR")}/{g.target.toLocaleString("pt-BR")}
                {g.unit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (g.value / g.target) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewsCard() {
  return (
    <section className="card-inner p-3">
      <CardTitle icon="emoji/revisao.webp">Revisões</CardTitle>
      <ul className="space-y-1.5">
        {reviewsToday.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-xs">
            <span className={cn("size-2.5 rounded-full", areaColor[r.area])} />
            <span className="flex-1 font-medium">{r.topic}</span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WaterCard() {
  const [cups, setCups] = useState(3);
  const goal = 6;
  return (
    <section className="card-inner p-3">
      <CardTitle icon="emoji/agua.webp" action={<span className="text-xs tabular-nums text-muted-foreground">{cups}/{goal}</span>}>
        Água do dia
      </CardTitle>
      <div className="flex justify-between gap-1">
        {Array.from({ length: goal }).map((_, i) => (
          <button
            key={i}
            aria-label={`Copo ${i + 1}`}
            onClick={() => setCups(i + 1 === cups ? i : i + 1)}
            className="relative h-10 flex-1 overflow-hidden rounded-b-lg rounded-t-sm border-2 border-sky-400/70 bg-card"
          >
            <span className={cn("absolute inset-x-0 bottom-0 bg-sky-400 transition-all", i < cups ? "h-4/5" : "h-0")} />
          </button>
        ))}
      </div>
    </section>
  );
}

const MOODS = [
  { icon: "emoji/h1.webp", label: "Ótimo" },
  { icon: "emoji/h2.webp", label: "Bem" },
  { icon: "emoji/h3.webp", label: "Ok" },
  { icon: "emoji/h4.webp", label: "Mal" },
  { icon: "emoji/h5.webp", label: "Exausto" },
];

function MoodCard() {
  const [mood, setMood] = useState<number | null>(1);
  return (
    <section className="card-inner p-3">
      <CardTitle icon="emoji/humor.webp" action={<button className="flex items-center gap-1 text-xs font-medium text-primary"><Pencil className="size-3" />Diário</button>}>
        Humor do dia
      </CardTitle>
      <div className="flex justify-between">
        {MOODS.map((m, i) => (
          <button
            key={m.label}
            onClick={() => setMood(i)}
            className={cn("flex flex-col items-center gap-0.5 rounded-xl p-1 transition", mood === i ? "scale-110 bg-card shadow-sm" : "opacity-55 hover:opacity-100")}
          >
            <Icon3D name={m.icon} size={26} alt={m.label} />
            <span className="text-[9px] text-muted-foreground">{m.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function StreakCard() {
  return (
    <section className="card-inner p-4 text-center">
      <div className="flex items-center justify-between text-left">
        <span className="text-xs font-semibold text-muted-foreground">Sequência</span>
        <span className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-medium">
          <Icon3D name="emoji/lenha.webp" size={14} /> {user.firewood} lenha
        </span>
      </div>
      <Icon3D name="fogo.png" size={80} className="mx-auto my-2" />
      <p className="text-xl font-extrabold">{user.streak} dias seguidos</p>
      <p className="mt-1 text-xs text-muted-foreground">Mantenha o foco, alcance suas metas e ganhe XP.</p>
      <Link href="/foco" className="mx-auto mt-3 block h-6 w-3/4 rounded-full bg-primary/80 text-xs font-semibold leading-6 text-white hover:bg-primary">
        Estudar agora
      </Link>
      <div className="mt-3 flex justify-center gap-1">
        {week.map((w, i) => (
          <span
            key={i}
            className={cn(
              "grid size-7 place-items-center rounded-full text-[11px] font-bold",
              w === true && "bg-primary text-primary-foreground",
              w === false && i === todayIndex && "bg-success text-white",
              w === false && i !== todayIndex && "bg-destructive/15 text-destructive",
              w === null && "bg-card text-muted-foreground",
            )}
          >
            {DAYS[i]}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-card p-2 text-left">
        <Foguinho stage={2} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs font-semibold">
            {user.petName} <Pencil className="size-3 text-muted-foreground" />
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-600" />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Calor 62% · Labareda</p>
        </div>
      </div>
    </section>
  );
}

function ReadingCard() {
  return (
    <section className="card-inner flex items-center gap-3 p-3">
      <Icon3D name="livros.png" size={40} />
      <div className="flex-1">
        <p className="text-[11px] text-muted-foreground">Leitura</p>
        <p className="font-bold">20 / 30 minutos</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-card">
          <div className="h-full w-2/3 rounded-full bg-violet-500" />
        </div>
      </div>
    </section>
  );
}

function ExerciseCard() {
  const [done, setDone] = useState(false);
  return (
    <section className="card-inner flex items-center gap-3 p-3">
      <Icon3D name="emoji/exercicio.webp" size={36} />
      <div className="flex-1">
        <p className="text-[11px] text-muted-foreground">Exercício físico</p>
        <p className="text-sm font-semibold">Dia de treino</p>
      </div>
      <button
        onClick={() => setDone(!done)}
        className={cn("rounded-full px-3 py-1 text-xs font-semibold", done ? "bg-success text-white" : "bg-card text-muted-foreground ring-1 ring-border")}
      >
        {done ? "Feito ✓" : "Marcar"}
      </button>
    </section>
  );
}

/* ---------- Estatísticas ---------- */

function StatsSection() {
  const maxH = Math.max(...hoursBySubject.map((s) => s.h));
  return (
    <section className="card-soft p-4 md:p-6">
      <h2 className="mb-4 text-xl font-bold">Estatísticas Gerais</h2>
      <div className="grid gap-3 md:grid-cols-12 md:gap-4">
        <div className="card-inner p-4 md:col-span-6">
          <CardTitle icon="emoji/grafico.webp" action={<span className="text-xs font-semibold text-success">+{stats.weekVsLast}% vs semana passada</span>}>
            Horas da semana
          </CardTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekHours} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(v) => [`${String(v).replace(".", ",")} h`, "Foco"]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="h" fill="var(--chart-1)" radius={[6, 6, 6, 6]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-inner p-4 md:col-span-6">
          <CardTitle icon="emoji/livro.webp">Horas por área (semana)</CardTitle>
          <ul className="space-y-3">
            {hoursBySubject.map((s) => (
              <li key={s.name} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{String(s.h).replace(".", ",")} h</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-card">
                  <div className="h-full rounded-full" style={{ width: `${(s.h / maxH) * 100}%`, background: s.color }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Icon3D name="emoji/raio.webp" size={14} /> Natureza e Matemática rendem +20% de XP.
          </p>
        </div>
        <BigStat className="md:col-span-4" icon="emoji/trofeu.webp" title="Recorde" value={String(stats.recordHits)} tone="text-amber-500">
          Seu recorde histórico de acertos num simulado
        </BigStat>
        <BigStat className="md:col-span-4" icon="emoji/grupo.webp" title="Comparativo" value={`${stats.groupRank}º`} tone="text-success">
          no grupo esta semana (de {stats.groupSize})
        </BigStat>
        <BigStat className="md:col-span-4" icon="emoji/alvo.webp" title="Taxa de acerto" value={`${stats.accuracy}%`} tone="text-primary">
          +{stats.accuracyDelta} p.p. nas últimas 2 semanas
        </BigStat>
      </div>
    </section>
  );
}

function BigStat({
  icon,
  title,
  value,
  tone,
  children,
  className,
}: {
  icon: string;
  title: string;
  value: string;
  tone: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card-inner p-4 text-center", className)}>
      <CardTitle icon={icon}>{title}</CardTitle>
      <p className={cn("text-5xl font-extrabold tabular-nums", tone)}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
