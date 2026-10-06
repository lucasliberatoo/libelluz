"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { BookOpen, Check, ChevronRight, Lightbulb, Play, Sparkles, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLAG_LABEL,
  FLAGS,
  MAPA_XP,
  daysBetween,
  pct,
  phaseProgress,
  topicShare,
  units,
  type Alert,
  type Flag,
  type MapSkill,
  type MapTopic,
  type Suggestion,
} from "@/lib/mapa";
import { PHASE_INFO, PHASES, relevanceRank, type Phase } from "@/lib/template-tree";
import type { MapaData } from "@/server/mapa-queries";
import { markTopic, setNodeFlag, type MarkResult } from "@/server/mapa-actions";

export const AREA_DOT: Record<string, string> = {
  Matemática: "bg-blue-500",
  Natureza: "bg-emerald-500",
  Linguagens: "bg-amber-500",
  Humanas: "bg-rose-500",
  Redação: "bg-violet-500",
};

const FLAG_STYLE: Record<Flag, { on: string; letter: string }> = {
  theory: { on: "border-sky-500 bg-sky-500 text-white", letter: "T" },
  practice: { on: "border-amber-500 bg-amber-500 text-white", letter: "P" },
  mastery: { on: "border-emerald-500 bg-emerald-500 text-white", letter: "D" },
};

type OptAction = { kind: "node"; id: string; flag: Flag; value: boolean } | { kind: "topic"; id: string; flag: Flag };

function applyOpt(topics: MapTopic[], a: OptAction): MapTopic[] {
  return topics.map((t) => {
    if (a.kind === "topic") {
      if (t.id !== a.id) return t;
      const set = a.flag === "mastery" ? { theory: true, practice: true, mastery: true } : { [a.flag]: true };
      return { ...t, ...set, skills: t.skills.map((s) => ({ ...s, ...set })) };
    }
    if (t.id === a.id) return { ...t, [a.flag]: a.value };
    if (!t.skills.some((s) => s.id === a.id)) return t;
    return { ...t, skills: t.skills.map((s) => (s.id === a.id ? { ...s, [a.flag]: a.value } : s)) };
  });
}

const fmtH = (min: number) => `${(min / 60).toFixed(1).replace(".", ",")}h`;

export function MapaView({ data }: { data: MapaData }) {
  const [topics, addOpt] = useOptimistic(data.topics, applyOpt);
  const [, start] = useTransition();
  const [area, setArea] = useState<string | null>(data.subjects[0]?.area ?? null);
  const [subject, setSubject] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [toast, setToast] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  const phases = useMemo(() => phaseProgress(topics), [topics]);
  const areas = useMemo(() => [...new Set(data.subjects.map((s) => s.area))], [data.subjects]);

  const run = (opt: OptAction, call: () => Promise<MarkResult>) =>
    start(async () => {
      addOpt(opt);
      try {
        const r = await call();
        if (r.messages.length) {
          setToast(r.messages);
          setTimeout(() => setToast(null), 3500);
        }
      } catch {
        setToast(["Não deu para salvar. Tente de novo."]);
        setTimeout(() => setToast(null), 3500);
      }
    });
  const toggle = (id: string, flag: Flag, value: boolean) => run({ kind: "node", id, flag, value }, () => setNodeFlag(id, flag, value));
  const applySuggestion = (s: Suggestion) => {
    setHidden((h) => [...h, `${s.topicId}:${s.flag}`]);
    run({ kind: "topic", id: s.topicId, flag: s.flag }, () => markTopic(s.topicId, s.flag));
  };

  const pickCell = (subjectId: string, p: Phase) => {
    setArea(null);
    setSubject(subjectId);
    setPhase(p);
    document.getElementById("mapa-lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const suggestions = data.suggestions.filter((s) => !hidden.includes(`${s.topicId}:${s.flag}`));

  return (
    <div className="space-y-4 md:space-y-5">
      <PhaseStrip phases={phases} active={phase} onPick={(p) => setPhase(phase === p ? null : p)} />

      <div className="grid gap-4 md:grid-cols-2">
        <AlertsCard alerts={data.alerts} />
        <SuggestionsCard suggestions={suggestions} onApply={applySuggestion} onDismiss={(s) => setHidden((h) => [...h, `${s.topicId}:${s.flag}`])} />
      </div>

      <MatrixCard subjects={data.subjects} topics={topics} onPick={pickCell} active={{ subject, phase }} />

      <section id="mapa-lista" className="card-soft scroll-mt-24 p-3 md:p-5">
        <Filters
          areas={areas}
          subjects={data.subjects}
          area={area}
          subject={subject}
          phase={phase}
          setArea={(a) => {
            setArea(a);
            setSubject(null);
          }}
          setSubject={setSubject}
          setPhase={setPhase}
        />
        <TopicList
          subjects={data.subjects.filter((s) => (!area || s.area === area) && (!subject || s.id === subject))}
          topics={topics}
          phase={phase}
          today={data.today}
          onToggle={toggle}
        />
      </section>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status">
          <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg">
            <Sparkles className="size-4 text-amber-400" />
            {toast.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Fases ---------- */

function PhaseStrip({ phases, active, onPick }: { phases: ReturnType<typeof phaseProgress>; active: Phase | null; onPick: (p: Phase) => void }) {
  return (
    <section className="card-soft p-3 md:p-5">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold">Mapa</h1>
          <span className="text-right text-xs text-muted-foreground">Fase concluída: +{MAPA_XP.phaseDone} XP</span>
        </div>
        <p className="text-sm text-muted-foreground">Teoria, Prática e Domínio em cada fase, da base ao ataque.</p>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:grid md:grid-cols-5 md:px-0">
        {phases.map((p, i) => {
          const done = p.total > 0 && p.mastered === p.total;
          const d = pct(p.mastered, p.total);
          return (
            <button
              key={p.phase}
              onClick={() => onPick(p.phase)}
              aria-pressed={active === p.phase}
              className={cn(
                "card-inner relative min-w-[9.5rem] shrink-0 p-3 text-left ring-2 ring-transparent transition md:min-w-0",
                active === p.phase && "ring-primary",
                done && "bg-emerald-50 dark:bg-emerald-950/40",
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[10px] text-primary">{i + 1}</span>
                {PHASE_INFO[p.phase].level}
              </div>
              <div className="mt-1 font-bold">{p.phase}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">{d}%</span>
                <span className="text-xs text-muted-foreground">domínio</span>
              </div>
              <div className="mt-2 space-y-1">
                <Bar value={pct(p.theory, p.total)} className="bg-sky-500" label="Teoria" />
                <Bar value={pct(p.practice, p.total)} className="bg-amber-500" label="Prática" />
                <Bar value={d} className="bg-emerald-500" label="Domínio" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1 text-xs text-muted-foreground tabular-nums">
                {p.mastered}/{p.total} habilidades
                {done && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <Trophy className="size-3" /> +{MAPA_XP.phaseDone}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Bar({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <div title={`${label}: ${value}%`} className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ---------- Alertas e sugestões ---------- */

const TONE: Record<Alert["tone"], string> = { red: "bg-red-500", yellow: "bg-amber-400", green: "bg-emerald-500" };

function AlertsCard({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="card-soft p-4 md:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Lightbulb className="size-4 text-amber-500" /> Alertas
      </h2>
      {alerts.length ? (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className="card-inner flex items-center gap-2.5 px-3 py-2 text-sm">
              <span className={cn("size-2.5 shrink-0 rounded-full", TONE[a.tone])} aria-hidden />
              {a.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nada por aqui ainda. Os alertas aparecem conforme você estuda no Foco e registra questões: tópico parado há muito
          tempo, acerto baixo e matérias evoluindo.
        </p>
      )}
    </section>
  );
}

function SuggestionsCard({
  suggestions,
  onApply,
  onDismiss,
}: {
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}) {
  return (
    <section className="card-soft p-4 md:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Sparkles className="size-4 text-primary" /> Sugestões
      </h2>
      {suggestions.length ? (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={`${s.topicId}:${s.flag}`} className="card-inner flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 basis-48">{s.text}</span>
              <button
                onClick={() => onApply(s)}
                className={cn("rounded-full px-3 py-1 text-xs font-bold", FLAG_STYLE[s.flag].on)}
              >
                Marcar {FLAG_LABEL[s.flag]}
              </button>
              <button aria-label="Dispensar" onClick={() => onDismiss(s)} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Quando você fizer sessões de Teoria ou de Questões num tópico, o app sugere o que marcar. Domínio é sugerido após 3
          sessões de questões com 80% ou mais.
        </p>
      )}
    </section>
  );
}

/* ---------- Disciplinas × Fases ---------- */

function MatrixCard({
  subjects,
  topics,
  onPick,
  active,
}: {
  subjects: MapaData["subjects"];
  topics: MapTopic[];
  onPick: (subjectId: string, p: Phase) => void;
  active: { subject: string | null; phase: Phase | null };
}) {
  const cells = useMemo(() => {
    const m = new Map<string, { total: number; mastered: number }>();
    for (const t of topics)
      for (const u of units(t)) {
        if (!u.phase) continue;
        const k = `${t.subjectId}|${u.phase}`;
        const c = m.get(k) ?? m.set(k, { total: 0, mastered: 0 }).get(k)!;
        c.total++;
        if (u.mastery) c.mastered++;
      }
    return m;
  }, [topics]);

  return (
    <section className="card-soft p-3 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="font-bold">Disciplinas × Fases</h2>
        <span className="text-xs text-muted-foreground">% de domínio · toque numa célula para filtrar</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-[34%] text-left font-semibold text-muted-foreground md:w-56">Disciplina</th>
              {PHASES.map((p) => (
                <th key={p} className="font-semibold text-muted-foreground">
                  <span className="md:hidden">{PHASE_INFO[p].short}</span>
                  <span className="hidden md:inline">{p}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="truncate pr-1 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-2 shrink-0 rounded-full", AREA_DOT[s.area] ?? "bg-primary")} />
                    <span className="truncate">{s.name}</span>
                  </span>
                </td>
                {PHASES.map((p) => {
                  const c = cells.get(`${s.id}|${p}`);
                  if (!c) return <td key={p} className="rounded-md text-center text-muted-foreground/50">·</td>;
                  const v = pct(c.mastered, c.total);
                  const on = active.subject === s.id && active.phase === p;
                  return (
                    <td key={p} className="p-0">
                      <button
                        onClick={() => onPick(s.id, p)}
                        title={`${s.name} · ${p}: ${c.mastered}/${c.total} com Domínio`}
                        className={cn(
                          "h-8 w-full rounded-md text-center font-semibold tabular-nums ring-2 ring-transparent transition",
                          on && "ring-primary",
                          v >= 60 ? "text-white" : "text-foreground",
                        )}
                        style={{ background: `color-mix(in oklch, var(--chart-2) ${Math.max(8, v)}%, var(--muted))` }}
                      >
                        {v}%
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Filtros e lista ---------- */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-sm font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-card text-primary hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Filters(p: {
  areas: string[];
  subjects: MapaData["subjects"];
  area: string | null;
  subject: string | null;
  phase: Phase | null;
  setArea: (a: string | null) => void;
  setSubject: (s: string | null) => void;
  setPhase: (p: Phase | null) => void;
}) {
  const subjectOptions = p.subjects.filter((s) => !p.area || s.area === p.area);
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">Tópicos</h2>
        <select
          aria-label="Disciplina"
          value={p.subject ?? ""}
          onChange={(e) => p.setSubject(e.target.value || null)}
          className="h-8 max-w-[60vw] rounded-full border bg-card px-3 text-sm"
        >
          <option value="">Todas as disciplinas</option>
          {subjectOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={!p.area && !p.subject} onClick={() => p.setArea(null)}>
          Todas as áreas
        </Chip>
        {p.areas.map((a) => (
          <Chip key={a} active={p.area === a} onClick={() => p.setArea(a)}>
            {a}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={!p.phase} onClick={() => p.setPhase(null)}>
          Todas as fases
        </Chip>
        {PHASES.map((ph) => (
          <Chip key={ph} active={p.phase === ph} onClick={() => p.setPhase(ph)}>
            {ph}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function TopicList({
  subjects,
  topics,
  phase,
  today,
  onToggle,
}: {
  subjects: MapaData["subjects"];
  topics: MapTopic[];
  phase: Phase | null;
  today: string;
  onToggle: (id: string, f: Flag, v: boolean) => void;
}) {
  const groups = subjects
    .map((s) => ({ s, list: topics.filter((t) => t.subjectId === s.id && (!phase || units(t).some((u) => u.phase === phase))) }))
    .filter((g) => g.list.length);
  if (!groups.length)
    return <p className="card-inner p-6 text-center text-sm text-muted-foreground">Nenhum tópico com esse filtro.</p>;
  return (
    <div className="space-y-4">
      {groups.map(({ s, list }) => {
        const u = list.flatMap(units).filter((x) => !phase || x.phase === phase);
        return (
          <div key={s.id}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className={cn("size-2.5 rounded-full", AREA_DOT[s.area] ?? "bg-primary")} />
              <h3 className="flex-1 font-semibold">{s.name}</h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {pct(u.filter((x) => x.mastery).length, u.length)}% domínio
              </span>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-border">
              {list.map((t) => (
                <TopicRow key={t.id} t={t} phase={phase} today={today} onToggle={onToggle} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function RelBadge({ r }: { r: string | null }) {
  if (!r) return null;
  const rank = relevanceRank(r);
  return (
    <span
      title={r}
      className={cn(
        "whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold",
        rank === 0 && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        rank === 1 && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
        rank === 2 && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        rank >= 3 && "bg-muted text-muted-foreground",
      )}
    >
      {r}
    </span>
  );
}

export function PhaseBadge({ p }: { p: string | null }) {
  if (!p) return null;
  return <span className="whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">{p}</span>;
}

function FlagButton({ flag, on, onClick, small }: { flag: Flag; on: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={FLAG_LABEL[flag]}
      title={FLAG_LABEL[flag]}
      className={cn(
        "grid place-items-center rounded-full border-2 font-bold transition",
        small ? "size-7 text-[11px]" : "size-8 text-xs",
        on ? FLAG_STYLE[flag].on : "border-border text-muted-foreground hover:border-foreground/40",
      )}
    >
      {on ? <Check className="size-3.5" strokeWidth={3} /> : FLAG_STYLE[flag].letter}
    </button>
  );
}

function Ring({ flag, value }: { flag: Flag; value: number }) {
  const color = { theory: "oklch(0.685 0.169 237)", practice: "oklch(0.769 0.188 70)", mastery: "oklch(0.696 0.17 162)" }[flag];
  return (
    <span
      title={`${FLAG_LABEL[flag]}: ${Math.round(value * 100)}%`}
      className="grid size-8 place-items-center rounded-full text-[11px] font-bold"
      style={{ background: `conic-gradient(${color} ${value * 360}deg, color-mix(in oklch, var(--foreground) 10%, transparent) 0)` }}
    >
      <span className="grid size-6 place-items-center rounded-full bg-card">{FLAG_STYLE[flag].letter}</span>
    </span>
  );
}

function TopicRow({ t, phase, today, onToggle }: { t: MapTopic; phase: Phase | null; today: string; onToggle: (id: string, f: Flag, v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const skills = t.skills.filter((s) => !phase || (s.phase ?? t.phase) === phase);
  const days = t.lastDay ? daysBetween(t.lastDay, today) : null;
  const acc = t.questions ? Math.round((t.correct / t.questions) * 100) : null;
  const ph = phase ?? undefined;
  return (
    <li className="bg-card">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          aria-label={open ? "Fechar" : "Abrir"}
          onClick={() => setOpen(!open)}
          className={cn("grid size-6 shrink-0 place-items-center rounded text-muted-foreground", !t.skills.length && "invisible")}
        >
          <ChevronRight className={cn("size-4 transition", open && "rotate-90")} />
        </button>
        <button onClick={() => t.skills.length && setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5 text-sm font-medium">{t.name}</span>
            <PhaseBadge p={t.phase} />
            <RelBadge r={t.relevance} />
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs tabular-nums text-muted-foreground">
            <span>{t.minutes ? fmtH(t.minutes) : "0h"}</span>
            <span className={cn(acc !== null && acc < 60 && "font-semibold text-red-600 dark:text-red-400")}>
              {acc === null ? "sem questões" : `${acc}% de ${t.questions}`}
            </span>
            <span className={cn(days !== null && days >= 14 && "font-semibold text-red-600 dark:text-red-400")}>
              {days === null ? "nunca estudado" : days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}
            </span>
            {t.skills.length > 0 && <span>{t.skills.length} habilidades</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {t.skills.length
            ? FLAGS.map((f) => <Ring key={f} flag={f} value={topicShare(t, f, ph)} />)
            : FLAGS.map((f) => <FlagButton key={f} flag={f} on={t[f]} onClick={() => onToggle(t.id, f, !t[f])} />)}
          <Link
            aria-label={`Estudar ${t.name}`}
            href={`/foco?topic=${encodeURIComponent(t.name)}`}
            className="ml-0.5 hidden size-8 place-items-center rounded-full bg-primary text-white sm:grid"
          >
            <Play className="size-3.5 fill-current" />
          </Link>
        </div>
      </div>
      {open && (
        <ul className="border-t bg-muted/40">
          {skills.map((s) => (
            <SkillRow key={s.id} s={s} topicPhase={t.phase} showPhase={!phase} onToggle={onToggle} />
          ))}
          {!skills.length && <li className="px-4 py-2 text-xs text-muted-foreground">Nenhuma habilidade nesta fase.</li>}
          <li className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" />
            <Link href="/aulas" className="underline-offset-2 hover:underline">
              Editar habilidades em Aulas
            </Link>
          </li>
        </ul>
      )}
    </li>
  );
}

function SkillRow({ s, topicPhase, showPhase, onToggle }: { s: MapSkill; topicPhase: string | null; showPhase: boolean; onToggle: (id: string, f: Flag, v: boolean) => void }) {
  return (
    <li className="flex items-center gap-2 py-1.5 pl-10 pr-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug">{s.name}</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {showPhase && s.phase && s.phase !== topicPhase && <PhaseBadge p={s.phase} />}
          <RelBadge r={s.relevance} />
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {FLAGS.map((f) => (
          <FlagButton key={f} small flag={f} on={s[f]} onClick={() => onToggle(s.id, f, !s[f])} />
        ))}
      </div>
    </li>
  );
}
