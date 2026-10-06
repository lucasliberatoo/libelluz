"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Leaf,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon3D } from "@/components/brand";
import { addDays, WEEKDAYS, weekdayOf } from "@/lib/day";
import { capacityOf, leisureFor } from "@/lib/schedule";
import type { BlockView, SchedulePageData } from "@/server/schedule";
import {
  addBlock,
  moveBlock,
  removeBlock,
  reschedulePending,
  resizeBlock,
  saveScheduleConfig,
  suggestMyWeek,
} from "@/server/schedule-actions";

const AREA: Record<string, { bar: string; dot: string }> = {
  Natureza: { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  Matemática: { bar: "bg-blue-500", dot: "bg-blue-500" },
  Linguagens: { bar: "bg-amber-500", dot: "bg-amber-500" },
  Humanas: { bar: "bg-rose-500", dot: "bg-rose-500" },
  Redação: { bar: "bg-violet-500", dot: "bg-violet-500" },
};
const DURATIONS = [30, 45, 60, 90];

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`;
};
const dd = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const monthShort = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
const focusHref = (b: { topic: string; kind: "study" | "review"; plannedMin: number; doneMin: number }) =>
  `/foco?topic=${encodeURIComponent(b.topic)}${b.kind === "review" ? `&kind=${encodeURIComponent("Revisão")}` : ""}&min=${Math.max(10, Math.round(b.plannedMin - b.doneMin))}`;

export function ScheduleBoard({ data }: { data: SchedulePageData }) {
  const { today, weekStart: ws, config, blocks, pending, reviews } = data;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const [selected, setSelected] = useState(days.includes(today) ? today : days[1]);
  const [adding, setAdding] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingT, start] = useTransition();

  const planned = blocks.reduce((s, b) => s + b.plannedMin, 0);
  const done = blocks.reduce((s, b) => s + Math.min(b.doneMin, b.plannedMin), 0);
  const end = addDays(ws, 6);
  const label = `${Number(ws.slice(8))} ${monthShort(ws)} – ${Number(end.slice(8))} ${monthShort(end)}`;
  const isPast = end < today;
  const enemLeft = config.enemDate
    ? Math.round((Date.parse(`${config.enemDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5)
    : null;

  const suggest = () =>
    start(async () => {
      const n = await suggestMyWeek(ws);
      setMsg(n ? `${n} blocos sugeridos. Ajuste à vontade.` : "Nada para sugerir: sem minutos livres nesta semana.");
    });

  const dayProps = (d: string) => ({
    day: d,
    today,
    days,
    blocks: blocks.filter((b) => b.day === d),
    capacity: capacityOf(d, config.weekMinutes, config.restDay),
    rest: config.restDay === weekdayOf(d),
    leisure: leisureFor(ws),
    onAdd: () => setAdding(d),
  });

  return (
    <div className="space-y-4">
      <section className="card-soft p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Icon3D name="emoji/cronometro.webp" size={36} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Cronograma</h1>
            <p className="text-xs text-muted-foreground">
              Sem horários: blocos por dia. O Foco preenche sozinho.
            </p>
          </div>
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-full border-2 border-primary/60 px-3 py-1 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            <Settings2 className="size-4" /> Minha semana
          </button>
          <button
            onClick={suggest}
            disabled={pendingT || isPast}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            <Sparkles className="size-4" /> {pendingT ? "Montando…" : "Sugerir minha semana"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-muted p-0.5">
            <Link href={`/cronograma?w=${addDays(ws, -7)}`} aria-label="Semana anterior" className="grid size-8 place-items-center rounded-full hover:bg-card">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-32 px-1 text-center text-sm font-semibold">{label}</span>
            <Link href={`/cronograma?w=${addDays(ws, 7)}`} aria-label="Próxima semana" className="grid size-8 place-items-center rounded-full hover:bg-card">
              <ChevronRight className="size-4" />
            </Link>
          </div>
          {!days.includes(today) && (
            <Link href="/cronograma" className="rounded-full px-3 py-1 text-sm font-semibold text-primary hover:bg-primary/5">
              Esta semana
            </Link>
          )}
          <div className="ml-auto flex min-w-48 flex-1 items-center gap-2 sm:max-w-72">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {fmtMin(done)} / {fmtMin(planned)}
            </span>
          </div>
        </div>
        {msg && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
            <Sparkles className="size-4 shrink-0" /> <span className="flex-1">{msg}</span>
            <button aria-label="Fechar" onClick={() => setMsg(null)}>
              <X className="size-4" />
            </button>
          </p>
        )}
        {reviews.length > 0 && !isPast && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-violet-400/70 px-3 py-2 text-sm">
            <RotateCcw className="size-4 shrink-0 text-violet-500" />
            <span className="flex-1">
              {reviews.length === 1 ? "1 revisão vence" : `${reviews.length} revisões vencem`} até domingo e ainda {reviews.length === 1 ? "não está" : "não estão"} no cronograma
              {": "}
              <span className="text-muted-foreground">{reviews.slice(0, 3).map((r) => r.topic).join(", ")}{reviews.length > 3 ? "…" : ""}</span>
            </span>
          </p>
        )}
      </section>

      {pending.length > 0 && <PendingStrip pending={pending} />}

      {/* Celular: um dia por vez */}
      <div className="md:hidden">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {days.map((d) => {
            const n = blocks.filter((b) => b.day === d).length;
            const rest = config.restDay === weekdayOf(d);
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={cn(
                  "flex min-w-12 flex-1 flex-col items-center rounded-2xl py-1.5 text-xs font-semibold transition",
                  d === selected ? "bg-primary text-primary-foreground shadow" : "bg-card ring-1 ring-border",
                  d === today && d !== selected && "ring-2 ring-primary",
                )}
              >
                <span className="opacity-80">{WEEKDAYS[weekdayOf(d)]}</span>
                <span className="text-base font-bold">{Number(d.slice(8))}</span>
                <span className="flex h-2 items-center gap-0.5">
                  {rest ? <Leaf className="size-2.5" /> : Array.from({ length: Math.min(n, 4) }, (_, i) => <span key={i} className="size-1 rounded-full bg-current opacity-70" />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <DayColumn {...dayProps(selected)} wide />
        </div>
      </div>

      {/* Desktop: a semana em colunas */}
      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {days.map((d) => (
          <DayColumn key={d} {...dayProps(d)} />
        ))}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Dica: Natureza e Matemática pesam mais no ENEM, por isso aparecem mais. Revisar fazendo questões ou flashcards (no Anki, por exemplo) fixa melhor do que reler.
        {enemLeft !== null && enemLeft > 0 && (
          <>
            {" "}
            Faltam <b>{enemLeft} dias</b> para a data-alvo ({dd(config.enemDate!)}).{" "}
          </>
        )}
        {!config.enemDate && " "}
        <Link href="/config" className="font-semibold text-primary hover:underline">
          {config.enemDate ? "Mudar data-alvo" : "Definir data-alvo"}
        </Link>
      </p>

      {adding && <AddDialog data={data} day={adding} days={days} onClose={() => setAdding(null)} />}
      {configOpen && <ConfigDialog data={data} onClose={() => setConfigOpen(false)} />}
    </div>
  );
}

/* ---------- Dia ---------- */

function DayColumn({
  day,
  today,
  days,
  blocks,
  capacity,
  rest,
  leisure,
  onAdd,
  wide,
}: {
  day: string;
  today: string;
  days: string[];
  blocks: BlockView[];
  capacity: number;
  rest: boolean;
  leisure: string;
  onAdd: () => void;
  wide?: boolean;
}) {
  const planned = blocks.reduce((s, b) => s + b.plannedMin, 0);
  const isToday = day === today;
  return (
    <section className={cn("card-inner flex min-h-40 flex-col p-2", isToday && "ring-2 ring-primary", wide && "p-3")}>
      <header className="mb-2 flex items-baseline gap-1 px-1">
        <span className={cn("text-sm font-bold", isToday && "text-primary")}>{WEEKDAYS[weekdayOf(day)]}</span>
        <span className="text-xs text-muted-foreground">{dd(day)}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {rest ? "descanso" : capacity ? `${fmtMin(planned)}/${fmtMin(capacity)}` : planned ? fmtMin(planned) : "livre"}
        </span>
      </header>
      {rest && !blocks.length && (
        <div className="mb-2 rounded-xl bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-200">
          <p className="flex items-center gap-1 font-semibold">
            <Leaf className="size-3.5" /> Dia de descanso
          </p>
          <p className="mt-1 opacity-90">Não quebra a sequência. Sugestão: {leisure.toLowerCase()}.</p>
        </div>
      )}
      <ul className="space-y-1.5">
        {blocks.map((b) => (
          <BlockCard key={b.id} b={b} days={days} />
        ))}
      </ul>
      <button
        onClick={onAdd}
        className="mt-auto flex items-center justify-center gap-1 rounded-xl py-1.5 pt-2 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        <Plus className="size-3.5" /> bloco
      </button>
    </section>
  );
}

function BlockCard({ b, days }: { b: BlockView; days: string[] }) {
  const [menu, setMenu] = useState(false);
  const [busy, start] = useTransition();
  const review = b.kind === "review";
  const pct = Math.min(100, (b.doneMin / b.plannedMin) * 100);
  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl bg-card shadow-sm transition",
        review && "border border-dashed border-violet-400/80 bg-violet-50/60 dark:bg-violet-500/10",
        busy && "opacity-50",
      )}
    >
      {!review && <span className={cn("absolute inset-y-0 left-0 w-1", AREA[b.area]?.bar ?? "bg-muted-foreground/40")} />}
      <Link href={focusHref(b)} className="block py-2 pl-3 pr-7">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {review ? (
            <>
              <RotateCcw className="size-3 text-violet-500" /> Revisão
            </>
          ) : (
            b.subject
          )}
        </p>
        <p className={cn("line-clamp-2 text-[13px] font-semibold leading-snug", b.done && "text-muted-foreground")}>{b.topic}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", b.done ? "bg-success" : review ? "bg-violet-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {b.done ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {b.doneMin > 0 ? `${Math.round(b.doneMin)}/` : ""}
              {b.plannedMin}′
            </span>
          )}
        </div>
      </Link>
      <button
        aria-label="Opções do bloco"
        onClick={() => setMenu((m) => !m)}
        className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu && (
        <div className="border-t bg-card p-2 text-xs">
          <p className="mb-1 font-semibold text-muted-foreground">Mover para</p>
          <div className="mb-2 grid grid-cols-7 gap-0.5">
            {days.map((d) => (
              <button
                key={d}
                disabled={d === b.day}
                onClick={() => start(() => moveBlock(b.id, d))}
                className="rounded-md py-1 font-semibold hover:bg-primary/10 disabled:bg-primary disabled:text-primary-foreground"
              >
                {WEEKDAYS[weekdayOf(d)][0]}
              </button>
            ))}
          </div>
          <p className="mb-1 font-semibold text-muted-foreground">Duração</p>
          <div className="mb-2 flex gap-1">
            {DURATIONS.map((m) => (
              <button
                key={m}
                onClick={() => start(() => resizeBlock(b.id, m))}
                className={cn("flex-1 rounded-md py-1 font-semibold hover:bg-primary/10", b.plannedMin === m && "bg-primary text-primary-foreground")}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => start(() => removeBlock(b.id))}
            className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-muted-foreground hover:bg-muted"
          >
            <Trash2 className="size-3.5" /> Remover
          </button>
        </div>
      )}
    </li>
  );
}

/* ---------- Pendentes (sem culpa) ---------- */

function PendingStrip({ pending }: { pending: BlockView[] }) {
  const [busy, start] = useTransition();
  return (
    <section className="card-inner p-3">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h2 className="flex-1 text-sm font-semibold">Pendentes</h2>
        <span className="text-xs text-muted-foreground">sem pressa: encaixe quando der</span>
      </div>
      <ul className={cn("no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1", busy && "opacity-60")}>
        {pending.map((b) => (
          <li key={b.id} className="w-56 shrink-0 rounded-xl bg-card p-2.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {b.kind === "review" ? "Revisão" : b.subject} · {WEEKDAYS[weekdayOf(b.day)]} {dd(b.day)}
            </p>
            <p className="truncate text-[13px] font-semibold">{b.topic}</p>
            <p className="text-[11px] text-muted-foreground">
              {b.doneMin > 0 ? `${Math.round(b.doneMin)} de ` : ""}
              {b.plannedMin} min
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => start(() => reschedulePending(b.id, "today").then(() => {}))}
                className="flex-1 rounded-full bg-primary/10 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
              >
                Para hoje
              </button>
              <button
                onClick={() => start(() => reschedulePending(b.id, "next").then(() => {}))}
                className="flex-1 rounded-full bg-muted py-1 text-xs font-semibold hover:bg-muted/70"
              >
                Próximo dia livre
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Diálogos ---------- */

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        className="card-soft max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none p-5 sm:max-w-md sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h3 className="flex-1 text-lg font-bold">{title}</h3>
          <button aria-label="Fechar" onClick={onClose} className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

function AddDialog({ data, day, days, onClose }: { data: SchedulePageData; day: string; days: string[]; onClose: () => void }) {
  const topics = data.topics;
  const areas = [...new Set(topics.map((t) => t.area))];
  const [d, setD] = useState(day);
  const [area, setArea] = useState(areas[0] ?? "");
  const subjects = [...new Set(topics.filter((t) => t.area === area).map((t) => t.subject))];
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const list = topics.filter((t) => t.area === area && t.subject === subject);
  const [nodeId, setNodeId] = useState(list.find((t) => !t.mastery)?.nodeId ?? list[0]?.nodeId ?? "");
  const [minutes, setMinutes] = useState(60);
  const [kind, setKind] = useState<"study" | "review">("study");
  const [busy, start] = useTransition();

  const pickArea = (a: string) => {
    setArea(a);
    const s = topics.find((t) => t.area === a)?.subject ?? "";
    setSubject(s);
    setNodeId(topics.find((t) => t.area === a && t.subject === s && !t.mastery)?.nodeId ?? "");
  };
  const pickSubject = (s: string) => {
    setSubject(s);
    const l = topics.filter((t) => t.area === area && t.subject === s);
    setNodeId(l.find((t) => !t.mastery)?.nodeId ?? l[0]?.nodeId ?? "");
  };
  const save = () =>
    start(async () => {
      if (!nodeId) return;
      await addBlock({ nodeId, day: d, minutes, kind });
      onClose();
    });

  return (
    <Dialog title="Novo bloco" onClose={onClose}>
      <div className="grid grid-cols-7 gap-1">
        {days.map((x) => (
          <button
            key={x}
            onClick={() => setD(x)}
            className={cn("rounded-lg py-1.5 text-xs font-semibold", x === d ? "bg-primary text-primary-foreground" : "bg-muted")}
          >
            {WEEKDAYS[weekdayOf(x)]}
            <span className="block text-[10px] font-normal opacity-80">{Number(x.slice(8))}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {(["study", "review"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 py-1.5 text-sm font-semibold",
              kind === k ? (k === "review" ? "border-violet-500 bg-violet-500 text-white" : "border-primary bg-primary text-primary-foreground") : "border-border",
            )}
          >
            {k === "review" ? <RotateCcw className="size-4" /> : <Play className="size-3.5" />} {k === "review" ? "Revisão" : "Estudo"}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Área
        <select value={area} onChange={(e) => pickArea(e.target.value)} className={cn(field, "mt-1")}>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Disciplina
        <select value={subject} onChange={(e) => pickSubject(e.target.value)} className={cn(field, "mt-1")}>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Tópico
        <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={cn(field, "mt-1")}>
          {list.map((t) => (
            <option key={t.nodeId} value={t.nodeId}>
              {t.topic}
              {t.mastery ? " ✓" : ""}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="mb-1 text-sm">Duração: <b>{fmtMin(minutes)}</b></p>
        <div className="flex gap-1.5">
          {DURATIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={cn("flex-1 rounded-full py-1.5 text-sm font-semibold", minutes === m ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={busy || !nodeId} className="w-full rounded-full bg-primary py-2.5 font-bold text-white disabled:opacity-60">
        {busy ? "Salvando…" : "Adicionar bloco"}
      </button>
    </Dialog>
  );
}

function ConfigDialog({ data, onClose }: { data: SchedulePageData; onClose: () => void }) {
  const [mins, setMins] = useState<number[]>(data.config.weekMinutes);
  const [restDay, setRestDay] = useState<number | null>(data.config.restDay);
  const [busy, start] = useTransition();
  const total = mins.reduce((s, m, i) => s + (i === restDay ? 0 : m), 0);
  const bump = (i: number, delta: number) => setMins((l) => l.map((m, j) => (j === i ? Math.min(960, Math.max(0, m + delta)) : m)));
  const save = () =>
    start(async () => {
      await saveScheduleConfig({ weekMinutes: mins, restDay });
      onClose();
    });
  return (
    <Dialog title="Minha semana" onClose={onClose}>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Quanto tempo de estudo cabe em cada dia?</p>
        <ul className="space-y-1.5">
          {WEEKDAYS.map((w, i) => {
            const rest = i === restDay;
            return (
              <li key={w} className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
                <span className="w-10 text-sm font-semibold">{w}</span>
                {rest ? (
                  <span className="flex flex-1 items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                    <Leaf className="size-4" /> descanso
                  </span>
                ) : (
                  <>
                    <button aria-label={`Menos tempo ${w}`} onClick={() => bump(i, -30)} className="grid size-7 place-items-center rounded-full bg-card font-bold shadow-sm">
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-semibold tabular-nums">{mins[i] ? fmtMin(mins[i]) : "sem estudo"}</span>
                    <button aria-label={`Mais tempo ${w}`} onClick={() => bump(i, 30)} className="grid size-7 place-items-center rounded-full bg-card font-bold shadow-sm">
                      +
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-right text-xs text-muted-foreground">Total: {fmtMin(total)} por semana</p>
      </div>
      <label className="block text-sm">
        Dia de descanso
        <select
          value={restDay ?? ""}
          onChange={(e) => setRestDay(e.target.value === "" ? null : Number(e.target.value))}
          className={cn(field, "mt-1")}
        >
          <option value="">Nenhum</option>
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">
          Descanso planejado não quebra a sequência nem gasta lenha. Sugestão de lazer: {leisureFor(data.weekStart).toLowerCase()}.
        </span>
      </label>
      <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
        <span className="flex-1">
          Data-alvo: <b>{data.config.enemDate ? dd(data.config.enemDate) + "/" + data.config.enemDate.slice(0, 4) : "não definida"}</b>
        </span>
        <Link href="/config" className="font-semibold text-primary hover:underline">
          Editar
        </Link>
      </div>
      <button onClick={save} disabled={busy} className="w-full rounded-full bg-primary py-2.5 font-bold text-white disabled:opacity-60">
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </Dialog>
  );
}
