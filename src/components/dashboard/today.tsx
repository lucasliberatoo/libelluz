"use client";

import Link from "next/link";
import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DASH_TABS, tabHref, type DashTab } from "./tabs";
import { TabSkeleton } from "./tab-skeleton";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Camera, Check, Pencil, Play, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Foguinho, Icon3D } from "@/components/brand";
import { StreakCard } from "@/components/pet/streak-card";
import type { PetSummary } from "@/server/pet";
import type { DashboardData } from "@/server/queries";
import { addTask, deleteTask, setHabit, toggleTask } from "@/server/actions";

const DashCtx = createContext<(DashboardData & { pet?: PetSummary | null }) | null>(null);
const useDash = () => useContext(DashCtx)!;

const areaColor: Record<string, string> = {
  Natureza: "bg-emerald-500",
  Matemática: "bg-blue-500",
  Linguagens: "bg-amber-500",
  Humanas: "bg-rose-500",
  Redação: "bg-violet-500",
};
const areaBar: Record<string, string> = {
  Matemática: "var(--chart-1)",
  Natureza: "var(--chart-2)",
  Linguagens: "var(--chart-3)",
  Humanas: "var(--chart-4)",
  Redação: "var(--chart-5)",
};
const fmtH = (n: number) => String(n).replace(".", ",");

export function Dashboard({
  data,
  pet,
  tab = "Hoje",
  panel,
}: {
  data: DashboardData;
  pet?: PetSummary | null;
  tab?: DashTab;
  panel?: React.ReactNode;
}) {
  // abas pela URL (?aba=): a aba aparece marcada na hora e o conteúdo chega do servidor
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(tab);
  const go = (t: DashTab) =>
    start(() => {
      setShown(t);
      router.replace(tabHref(t), { scroll: false });
    });
  return (
    <DashCtx.Provider value={{ ...data, pet }}>
    <div className="space-y-4 md:space-y-6">
      <ProgressHeader />
      <section className="card-soft relative p-3 md:p-5">
        <PetPeek />
        <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pr-16 md:mx-0 md:px-0 md:pr-24">
          {DASH_TABS.map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              aria-pressed={t === shown}
              className={cn(
                "whitespace-nowrap rounded-full border-2 px-4 py-1 text-sm font-semibold transition-colors",
                t === shown
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/70 bg-card text-primary hover:bg-accent",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {shown === "Hoje" ? <TodayTab /> : pending || shown !== tab ? <TabSkeleton /> : panel}
      </section>
      <StatsSection />
    </div>
    </DashCtx.Provider>
  );
}

function PetPeek() {
  const { streak, pet } = useDash();
  return (
    <Link
      href="/foguinho"
      aria-label="Abrir seu foguinho"
      className="absolute -top-8 right-2 z-10 transition hover:-translate-y-1 hover:rotate-3 md:-top-10 md:right-3"
    >
      <Foguinho
        stage={pet?.stage ?? 0}
        mood={pet?.mood ?? (streak.studiedToday ? "happy" : "sleepy")}
        accessory={pet?.accessory ?? null}
        className="size-14 -rotate-6 drop-shadow-md md:size-20"
      />
    </Link>
  );
}

function ProgressHeader() {
  const { level: lv, user, studiedDays, studyMode } = useDash();
  const pct = lv.levelSpan ? (lv.intoLevel / lv.levelSpan) * 100 : 100;
  return (
    <section className="card-soft flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-5 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-200 text-xl font-bold text-violet-700 dark:bg-violet-500/30 dark:text-violet-200">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            (user.name[0] ?? "?").toUpperCase()
          )}
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">
            <span className="hidden md:inline">Olá, {user.name}!</span>
            <span className="md:hidden">Seu progresso</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Nível {lv.level} · {lv.title}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 md:gap-3">
        <Pill icon="moeda-xp.png" tile="bg-amber-100 dark:bg-amber-500/25" label="XP do nível">
          <div className="w-full">
            <p className="text-xs font-bold tabular-nums">
              {lv.intoLevel}
              <span className="font-normal text-muted-foreground">{lv.isMax ? " XP" : `/${lv.levelSpan} XP`}</span>
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-xp" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Pill>
        <Pill icon="calendario.png" tile="bg-primary" label="dias estudando">
          <p className="text-xl font-extrabold tabular-nums text-primary">{studiedDays}</p>
        </Pill>
        <Pill icon="gauge.png" tile="bg-green-500" label="Modo de estudo">
          <p className="text-sm font-extrabold uppercase">{studyMode}</p>
        </Pill>
      </div>
      <Link
        href="/foco"
        className="group flex items-center justify-center gap-2 rounded-2xl px-2 py-1 transition active:scale-95 md:flex-col md:gap-0.5"
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-sky-200 shadow-inner dark:bg-sky-400/30">
          <Icon3D name="botao-foco.png" size={46} className="transition group-hover:-translate-y-0.5" />
        </span>
        <span className="text-xs font-extrabold uppercase tracking-wide">Modo Foco</span>
      </Link>
    </section>
  );
}

function Pill({ icon, tile, label, children }: { icon: string; tile: string; label: string; children: React.ReactNode }) {
  return (
    <div className="card-inner flex flex-col gap-1.5 p-2.5 md:flex-row md:items-center md:gap-3 md:p-3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tile)}>
        <Icon3D name={icon} size={30} />
      </span>
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
      <div className="md:col-span-4 lg:col-span-3">
        <XpCard />
      </div>
      <div className="space-y-3 md:col-span-8 md:space-y-4 lg:col-span-6">
        <ContinueCard />
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          <TasksCard />
          <div className="space-y-3 md:space-y-4">
            <GoalsCard />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          <WaterCard />
          <MoodCard />
        </div>
      </div>
      <div className="grid gap-3 md:col-span-12 md:grid-cols-3 md:gap-4 lg:col-span-3 lg:grid-cols-1 lg:content-start">
        <DashStreakCard />
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
  const [range, setRange] = useState<"Dia" | "Semana">("Dia");
  const { level: lv, xp, todayIndex } = useDash();
  const todayXp = xp.week[todayIndex].xp;
  const weekXp = xp.week.reduce((s, d) => s + d.xp, 0);
  const daysSoFar = todayIndex + 1;
  const value = range === "Dia" ? todayXp : weekXp;
  const goal = range === "Dia" ? xp.goals.day : xp.goals.week;
  const pct = Math.min(1, value / goal);
  const r = 62;
  const c = 2 * Math.PI * r;
  const data = xp.week.map((x) => ({ k: x.d, xp: x.xp }));
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
        XP {range === "Dia" ? "de hoje" : "da semana"}
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
                <Cell key={d.k} fill={i === todayIndex ? "var(--success)" : "var(--chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-0.5 text-center text-sm">
        <p className="font-bold">{todayXp === 0 ? "Hora de começar!" : "Bora manter o ritmo!"}</p>
        {!lv.isMax && (
          <p className="text-muted-foreground">
            Faltam <b className="text-xp">{lv.levelSpan - lv.intoLevel} XP</b> para o nível {lv.level + 1}
          </p>
        )}
        <p className="text-muted-foreground">
          Média diária <b className="text-success">{Math.round(weekXp / daysSoFar)} XP</b>
        </p>
      </div>
    </section>
  );
}

/* ---------- Hoje ---------- */

function ContinueCard() {
  const { lastFocus } = useDash();
  return (
    <Link
      href={lastFocus ? `/foco?topic=${encodeURIComponent(lastFocus.topic)}` : "/foco"}
      className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-blue-400 p-4 text-white shadow-md"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/25 transition group-hover:scale-105">
        <Play className="size-6 fill-current" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide opacity-85">{lastFocus ? "Continuar de onde parei" : "Primeira sessão"}</p>
        <p className="truncate text-lg font-bold">{lastFocus?.topic ?? "Começar a estudar"}</p>
        <p className="text-sm opacity-90">{lastFocus ? `${lastFocus.subject} · ${lastFocus.kind}` : "Escolha uma matéria e dê o play"}</p>
      </div>
    </Link>
  );
}

const focusHref = (topic: string, kind?: "study" | "review", min?: number) =>
  `/foco?topic=${encodeURIComponent(topic)}${kind === "review" ? `&kind=${encodeURIComponent("Revisão")}` : ""}${min ? `&min=${Math.round(min)}` : ""}`;

/** Blocos do cronograma de hoje e revisões do dia (acima das tarefas avulsas). */
function PlanToday() {
  const { blocks, reviews } = useDash();
  if (!blocks.length && !reviews.length) return null;
  return (
    <div className="mb-3 space-y-1.5">
      {blocks.map((b) => {
        const pct = Math.min(100, (b.doneMin / b.plannedMin) * 100);
        const review = b.kind === "review";
        return (
          <Link
            key={b.id}
            href={focusHref(b.topic, b.kind, b.done ? undefined : Math.max(10, b.plannedMin - b.doneMin))}
            className={cn("flex items-center gap-2.5 rounded-xl bg-card p-2 shadow-sm", review && "border border-dashed border-violet-400/70")}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg text-white",
                b.done ? "bg-success" : review ? "bg-violet-500" : (areaColor[b.area] ?? "bg-muted-foreground/40"),
              )}
            >
              {b.done ? <Check className="size-4" /> : review ? <RotateCcw className="size-4" /> : <Play className="size-3.5 fill-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-semibold leading-tight", b.done && "text-muted-foreground")}>{b.topic}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", review ? "bg-violet-500" : "bg-primary", b.done && "bg-success")} style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(b.doneMin)}/{b.plannedMin} min
                </span>
              </div>
            </div>
          </Link>
        );
      })}
      {reviews.length > 0 && (
        <>
          <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Revisões do dia</p>
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={focusHref(r.topic, "review", 30)}
              className="flex items-center gap-2.5 rounded-xl bg-card p-2 shadow-sm border border-dashed border-violet-400/70"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-500 text-white">
                <RotateCcw className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight">{r.topic}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.subject} · {r.late ? `desde ${r.dueDay.slice(8)}/${r.dueDay.slice(5, 7)}` : "hoje"}
                </p>
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

function TasksCard() {
  const { tasks } = useDash();
  const [opt, toggleOpt] = useOptimistic(tasks, (l, id: string) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const [, start] = useTransition();
  const [title, setTitle] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    start(() => addTask(t));
  };
  return (
    <section className="card-inner p-3">
      <CardTitle
        icon="emoji/tarefas.webp"
        action={
          <Link href="/cronograma" className="text-xs font-semibold text-primary hover:underline">
            Cronograma
          </Link>
        }
      >
        Tarefas do dia
      </CardTitle>
      <PlanToday />
      <ul className="space-y-1.5">
        {opt.map((t) => (
          <li key={t.id} className="group flex items-center gap-2.5 rounded-xl bg-card p-2 shadow-sm">
            <button
              aria-label={t.done ? "Desmarcar" : "Concluir"}
              onClick={() => start(async () => { toggleOpt(t.id); await toggleTask(t.id); })}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg text-white",
                t.done ? "bg-success" : t.area ? areaColor[t.area] : "bg-muted-foreground/40",
              )}
            >
              {t.done ? <Check className="size-4" /> : <span className="text-xs font-bold">{t.title[0]?.toUpperCase()}</span>}
            </button>
            <Link href={`/foco?topic=${encodeURIComponent(t.title)}`} className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-semibold leading-tight", t.done && "text-muted-foreground line-through")}>{t.title}</p>
              {t.plannedMin ? <p className="text-[10px] text-muted-foreground">{t.plannedMin} min</p> : null}
            </Link>
            <button aria-label="Apagar" onClick={() => start(() => deleteTask(t.id))} className="text-muted-foreground opacity-0 transition group-hover:opacity-100">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {!opt.length && <p className="px-1 text-xs text-muted-foreground">Tarefas avulsas: digite e dê enter.</p>}
      <form onSubmit={submit} className="mt-2 flex items-center gap-1 rounded-xl bg-card px-2 ring-1 ring-border">
        <Plus className="size-4 text-muted-foreground" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa…" className="h-9 flex-1 bg-transparent text-sm outline-none" />
      </form>
    </section>
  );
}

function GoalsCard() {
  const { goals: goalsToday } = useDash();
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

function WaterCard() {
  const { habit, user } = useDash();
  const [cups, setCupsState] = useState(habit.water);
  const goal = Math.min(user.waterGoal, 12);
  const setCups = (n: number) => {
    setCupsState(n);
    void setHabit({ waterCups: n });
  };
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

export const MOODS = [
  { icon: "emoji/h1.webp", label: "Ótimo" },
  { icon: "emoji/h2.webp", label: "Bem" },
  { icon: "emoji/h3.webp", label: "Ok" },
  { icon: "emoji/h4.webp", label: "Mal" },
  { icon: "emoji/h5.webp", label: "Exausto" },
];

function MoodCard() {
  const { habit } = useDash();
  const [mood, setMoodState] = useState<number | null>(habit.mood);
  const [open, setOpen] = useState(false);
  const setMood = (i: number) => {
    setMoodState(i);
    void setHabit({ mood: i });
  };
  return (
    <section className="card-inner p-3">
      <CardTitle
        icon="emoji/humor.webp"
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="size-3" />
            {habit.journal || habit.photo ? "Relato ✓" : "Relato"}
          </button>
        }
      >
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
      <Link href="/diario" className="mt-2 block text-center text-[11px] font-medium text-muted-foreground hover:text-primary">
        Ver meu diário e como tenho estado →
      </Link>
      {open && <JournalDialog mood={mood} onMood={setMood} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Reduz a foto no navegador para caber no banco (JPEG ~1024px). */
async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}

function JournalDialog({ mood, onMood, onClose }: { mood: number | null; onMood: (i: number) => void; onClose: () => void }) {
  const { habit } = useDash();
  const [text, setText] = useState(habit.journal);
  const [photo, setPhoto] = useState<string | null>(habit.photo);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      await setHabit({ journal: text, photo });
      onClose();
    });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card-soft w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h3 className="flex-1 text-lg font-bold">Como foi seu dia?</h3>
          <button aria-label="Fechar" onClick={onClose} className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex justify-between">
          {MOODS.map((m, i) => (
            <button key={m.label} onClick={() => onMood(i)} className={cn("rounded-xl p-1.5 transition", mood === i ? "scale-110 bg-accent" : "opacity-55")}>
              <Icon3D name={m.icon} size={32} alt={m.label} />
            </button>
          ))}
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="Um pequeno relato do dia…"
          className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Foto do dia" className="max-h-56 w-full rounded-xl object-cover" />
            <button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white" aria-label="Remover foto">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <Camera className="size-4" /> Anexar uma foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(await compressPhoto(f));
              }}
            />
          </label>
        )}
        <button onClick={save} disabled={pending} className="w-full rounded-full bg-primary py-2.5 font-bold text-white disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar relato"}
        </button>
      </div>
    </div>
  );
}

function DashStreakCard() {
  const { streak, weekDots, pet } = useDash();
  return <StreakCard streak={streak} weekDots={weekDots} pet={pet} />;
}

function ReadingCard() {
  const { habit, user } = useDash();
  const [min, setMin] = useState(habit.readingMin);
  const goal = user.readingGoalMin || 30;
  const add = (n: number) => {
    const v = Math.max(0, min + n);
    setMin(v);
    void setHabit({ readingMin: v });
  };
  return (
    <section className="card-inner flex items-center gap-3 p-3">
      <Icon3D name="livros.png" size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">Leitura</p>
        <p className="font-bold">
          {min} / {goal} minutos
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-card">
          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, (min / goal) * 100)}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={() => add(10)} className="rounded-full bg-card px-2 text-xs font-semibold ring-1 ring-border">+10</button>
        <button onClick={() => add(-10)} className="rounded-full bg-card px-2 text-xs text-muted-foreground ring-1 ring-border">−10</button>
      </div>
    </section>
  );
}

function ExerciseCard() {
  const { habit } = useDash();
  const [done, setDoneState] = useState(habit.exercise);
  const setDone = (v: boolean) => {
    setDoneState(v);
    void setHabit({ exercise: v });
  };
  return (
    <section className="card-inner flex items-center gap-3 p-3">
      <Icon3D name="emoji/exercicio.webp" size={36} />
      <div className="flex-1">
        <p className="text-[11px] text-muted-foreground">Exercício físico</p>
        <p className="text-sm font-semibold">{done ? "Treino feito!" : "Treinou hoje?"}</p>
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
  const { stats } = useDash();
  const maxH = Math.max(0.1, ...stats.hoursByArea.map((s) => s.h));
  return (
    <section className="card-soft p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Estatísticas Gerais</h2>
        <Link href="/estatisticas" className="text-sm font-semibold text-primary hover:underline">
          Ver todas →
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-12 md:gap-4">
        <div className="card-inner p-4 md:col-span-6">
          <CardTitle
            icon="emoji/grafico.webp"
            action={
              stats.weekVsLast !== null && (
                <span className={cn("text-xs font-semibold", stats.weekVsLast >= 0 ? "text-success" : "text-destructive")}>
                  {stats.weekVsLast >= 0 ? "+" : ""}
                  {stats.weekVsLast}% vs semana passada
                </span>
              )
            }
          >
            Horas da semana
          </CardTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekHours} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(v) => [`${fmtH(Number(v))} h`, "Foco"]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="h" fill="var(--chart-1)" radius={[6, 6, 6, 6]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-inner p-4 md:col-span-6">
          <CardTitle icon="emoji/livro.webp">Horas por área (semana)</CardTitle>
          {stats.hoursByArea.length ? (
            <ul className="space-y-3">
              {stats.hoursByArea.map((s) => (
                <li key={s.name} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtH(s.h)} h</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card">
                    <div className="h-full rounded-full" style={{ width: `${(s.h / maxH) * 100}%`, background: areaBar[s.name] ?? "var(--chart-1)" }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem sessões de foco nesta semana ainda.</p>
          )}
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Icon3D name="emoji/raio.webp" size={14} /> Natureza e Matemática rendem +20% de XP.
          </p>
        </div>
        <BigStat className="md:col-span-4" icon="emoji/trofeu.webp" title="Recorde" value={`${fmtH(stats.recordDayHours)}h`} tone="text-amber-500">
          seu recorde de foco num dia
        </BigStat>
        <BigStat className="md:col-span-4" icon="emoji/grupo.webp" title="Comparativo" value={stats.groupRank ? `${stats.groupRank}º` : "–"} tone="text-success">
          {stats.groupRank ? `no grupo esta semana (de ${stats.groupSize})` : "estude esta semana para entrar no ranking"}
        </BigStat>
        <BigStat className="md:col-span-4" icon="emoji/alvo.webp" title="Taxa de acerto" value={stats.accuracy !== null ? `${stats.accuracy}%` : "–"} tone="text-primary">
          {stats.accuracy !== null ? `${stats.questions14} questões nos últimos 14 dias` : "registre questões no fim do Foco"}
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
