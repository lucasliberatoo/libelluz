"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Droplet,
  Dumbbell,
  Flame,
  Gauge,
  Pencil,
  Play,
  RotateCcw,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Foguinho } from "@/components/brand";
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
} from "@/lib/mock";

const TABS = ["Hoje", "Semana", "Jornada", "Ranking & Conquistas"] as const;

export function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Hoje");
  return (
    <div className="space-y-4 md:space-y-5">
      <ProgressHeader />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              t === tab
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/40 bg-card text-primary hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Hoje" ? (
        <TodayTab />
      ) : (
        <div className="card-soft grid place-items-center p-12 text-center text-muted-foreground">
          <p>
            A aba <b className="text-foreground">{tab}</b> vem nas próximas etapas.
          </p>
        </div>
      )}
    </div>
  );
}

function ProgressHeader() {
  const lv = levelFromXp(user.totalXp);
  const pct = lv.levelSpan ? (lv.intoLevel / lv.levelSpan) * 100 : 100;
  const modeColor =
    user.studyMode === "Avançado" ? "bg-success" : user.studyMode === "Regular" ? "bg-primary" : "bg-warning";
  return (
    <section className="card-soft flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-primary text-xl font-bold text-white">
          L
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">
            <span className="hidden md:inline">Olá, {user.fullName}!</span>
            <span className="md:hidden">Seu progresso</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Nível {lv.level} · <span className="font-medium text-foreground">{lv.title}</span>
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 md:gap-3">
        <Stat icon={<Zap className="size-4" />} tone="bg-xp/15 text-xp" label="XP do nível">
          <div className="w-full">
            <p className="text-sm font-bold tabular-nums">
              {lv.intoLevel}
              <span className="font-normal text-muted-foreground">/{lv.levelSpan}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-xp" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Stat>
        <Stat icon={<CalendarDays className="size-4" />} tone="bg-primary/15 text-primary" label="dias estudados">
          <p className="text-xl font-bold tabular-nums">{user.studiedDays}</p>
        </Stat>
        <Stat icon={<Gauge className="size-4" />} tone="bg-success/15 text-success" label="Modo de estudo">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase">
            <span className={cn("size-2 rounded-full", modeColor)} />
            {user.studyMode}
          </p>
        </Stat>
      </div>
      <Link
        href="/foco"
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 px-5 py-3 font-bold text-white shadow-md shadow-red-500/30 transition hover:brightness-105 active:scale-[0.98]"
      >
        <Play className="size-5 fill-current" />
        Modo Foco
      </Link>
    </section>
  );
}

function Stat({
  icon,
  tone,
  label,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-2.5 md:flex-row md:items-center md:gap-3 md:p-3">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        {children}
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TodayTab() {
  return (
    <div className="grid gap-4 md:grid-cols-12 md:gap-5">
      <div className="space-y-4 md:col-span-8 md:space-y-5">
        <ContinueCard />
        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <TasksCard />
          <div className="space-y-4 md:space-y-5">
            <ReviewsCard />
            <GoalsCard />
          </div>
        </div>
      </div>
      <div className="space-y-4 md:col-span-4 md:space-y-5">
        <StreakCard />
      </div>
      <div className="md:col-span-12">
        <HabitsStrip />
      </div>
      <div className="md:col-span-12">
        <StatsSection />
      </div>
    </div>
  );
}

function CardTitle({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="flex-1 text-sm font-semibold">{children}</h3>
      {action}
    </div>
  );
}

function ContinueCard() {
  const t = tasksToday[0];
  return (
    <Link
      href="/foco"
      className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-violet-500 p-4 text-white shadow-md md:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/20 transition group-hover:scale-105">
        <Play className="size-6 fill-current" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Continuar de onde parei</p>
        <p className="truncate text-lg font-bold">{t.topic}</p>
        <p className="text-sm opacity-85">
          {t.subject} · {t.doneMin} de {t.hours * 60} min
        </p>
      </div>
    </Link>
  );
}

function TasksCard() {
  return (
    <section className="card-soft p-4">
      <CardTitle icon={<BookOpenCheck className="size-4" />} action={<span className="text-xs text-muted-foreground">do cronograma</span>}>
        Tarefas do dia
      </CardTitle>
      <ul className="space-y-2">
        {tasksToday.map((t) => {
          const pct = Math.min(1, t.doneMin / (t.hours * 60));
          const done = pct >= 1;
          return (
            <li key={t.id}>
              <Link href="/foco" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white", areaColor[t.area])}>
                  {done ? <Check className="size-5" /> : <span className="text-xs font-bold">{t.subject[0]}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{t.subject}</p>
                  <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>{t.topic}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", areaColor[t.area])} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{String(t.hours).replace(".", ",")}h</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewsCard() {
  return (
    <section className="card-soft p-4">
      <CardTitle icon={<RotateCcw className="size-4" />}>Revisões de hoje</CardTitle>
      <ul className="space-y-2">
        {reviewsToday.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className={cn("size-2.5 rounded-full", areaColor[r.area])} />
            <span className="flex-1 text-sm font-medium">{r.topic}</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoalsCard() {
  return (
    <section className="card-soft p-4">
      <CardTitle icon={<Target className="size-4" />}>Metas de hoje</CardTitle>
      <ul className="space-y-3">
        {goalsToday.map((g) => (
          <li key={g.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{g.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {g.value.toLocaleString("pt-BR")}
                {g.unit}/{g.target.toLocaleString("pt-BR")}
                {g.unit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (g.value / g.target) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function StreakCard() {
  return (
    <section className="card-soft relative overflow-hidden p-5 text-center">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-fuchsia-500/15 to-transparent" />
      <div className="relative flex items-center justify-between text-left">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {user.petName}
          <Pencil className="size-3.5 text-muted-foreground" />
        </span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          🪵 {user.firewood} lenha
        </span>
      </div>
      <Foguinho stage={2} glasses className="relative mx-auto my-2 size-32" />
      <p className="text-2xl font-extrabold">
        <Flame className="mb-1 inline size-6 fill-current text-streak" /> {user.streak} dias seguidos
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Mantenha o foco, alcance suas metas e ganhe XP.</p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Calor 🌡️ · Labareda</span>
          <span>62%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-600" />
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-1.5">
        {week.map((w, i) => (
          <span
            key={i}
            className={cn(
              "grid size-8 place-items-center rounded-full text-xs font-bold",
              w === true && "bg-primary text-primary-foreground",
              w === false && i === todayIndex && "bg-card text-primary ring-2 ring-primary",
              w === false && i !== todayIndex && "bg-destructive/15 text-destructive",
              w === null && "bg-muted text-muted-foreground",
            )}
          >
            {DAYS[i]}
          </span>
        ))}
      </div>
    </section>
  );
}

const MOODS = ["😄", "🙂", "😐", "😕", "😫"];

function HabitsStrip() {
  const [cups, setCups] = useState(3);
  const [mood, setMood] = useState<number | null>(1);
  const goalCups = 8;
  return (
    <section>
      <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Hábitos · aquecem o foguinho</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-soft p-4">
          <CardTitle icon={<Droplet className="size-4 text-sky-500" />} action={<span className="text-xs tabular-nums text-muted-foreground">{cups}/{goalCups}</span>}>
            Água do dia
          </CardTitle>
          <div className="flex gap-1">
            {Array.from({ length: goalCups }).map((_, i) => (
              <button
                key={i}
                aria-label={`Copo ${i + 1}`}
                onClick={() => setCups(i + 1 === cups ? i : i + 1)}
                className={cn(
                  "h-9 flex-1 rounded-md border-2 transition",
                  i < cups ? "border-sky-500 bg-sky-400/70" : "border-sky-300/60 bg-transparent dark:border-sky-700",
                )}
              />
            ))}
          </div>
        </div>
        <div className="card-soft p-4">
          <CardTitle icon={<span>💭</span>} action={<button className="text-xs font-medium text-primary">Diário</button>}>
            Humor do dia
          </CardTitle>
          <div className="flex justify-between">
            {MOODS.map((m, i) => (
              <button
                key={m}
                onClick={() => setMood(i)}
                className={cn(
                  "grid size-10 place-items-center rounded-full text-2xl transition",
                  mood === i ? "scale-110 bg-accent ring-2 ring-primary" : "opacity-60 hover:opacity-100",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="card-soft p-4">
          <CardTitle icon={<span>📖</span>} action={<span className="text-xs text-muted-foreground">meta 30 min</span>}>
            Leitura
          </CardTitle>
          <p className="text-xl font-bold">20 min</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-amber-500" />
          </div>
        </div>
        <div className="card-soft p-4">
          <CardTitle icon={<Dumbbell className="size-4 text-emerald-500" />}>Exercício físico</CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Dia de treino</p>
            <button className="rounded-full bg-success px-3 py-1 text-sm font-semibold text-white">Feito ✓</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const maxH = Math.max(...hoursBySubject.map((s) => s.h));
  return (
    <section>
      <h2 className="mb-3 px-1 text-lg font-bold">Estatísticas</h2>
      <div className="grid gap-4 md:grid-cols-12 md:gap-5">
        <div className="card-soft p-4 md:col-span-6">
          <CardTitle icon={<BarIcon />} action={<span className="text-xs font-medium text-success">+{stats.weekVsLast}% vs semana passada</span>}>
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
        <div className="card-soft p-4 md:col-span-6">
          <CardTitle icon={<BookOpenCheck className="size-4" />}>Horas por área (semana)</CardTitle>
          <ul className="space-y-3">
            {hoursBySubject.map((s) => (
              <li key={s.name} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{String(s.h).replace(".", ",")} h</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(s.h / maxH) * 100}%`, background: s.color }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">⚡ Natureza e Matemática rendem +20% de XP.</p>
        </div>
        <BigStat className="md:col-span-4" icon={<Target className="size-4" />} title="Taxa de acerto" value={`${stats.accuracy}%`} tone="text-success">
          +{stats.accuracyDelta} p.p. nas últimas 2 semanas
        </BigStat>
        <BigStat className="md:col-span-4" icon={<Users className="size-4" />} title="Comparativo" value={`${stats.groupRank}º`} tone="text-primary">
          no grupo esta semana (de {stats.groupSize})
        </BigStat>
        <BigStat className="md:col-span-4" icon={<Trophy className="size-4" />} title="Recorde" value={String(stats.recordHits)} tone="text-amber-500">
          acertos num simulado · rumo aos 160+
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
  icon: React.ReactNode;
  title: string;
  value: string;
  tone: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card-soft p-4 text-center", className)}>
      <CardTitle icon={icon}>{title}</CardTitle>
      <p className={cn("text-5xl font-extrabold tabular-nums", tone)}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function BarIcon() {
  return <TrendingUp className="size-4" />;
}
