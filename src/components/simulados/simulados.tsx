"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { ENEM_KIND_LABEL, ENEM_LIST, type EnemEntry } from "@/lib/enem-list";
import {
  EXAM_XP,
  fmtMinutes,
  GOAL_TOTAL,
  isComplete,
  MAX_TOTAL,
  objectiveTotal,
  PARTS,
  type ExamRow,
  type PartKey,
  type PartRow,
} from "@/lib/exams";
import { addEnem, createSimulado, deleteExam, deleteExamPart, saveExamParts, updateExam } from "@/server/exam-actions";
import type { ExamsPageData } from "@/server/exam-queries";
import { axisTick, CompetencyPicker, Field, fmtShortDay, GhostButton, inputCls, Modal, PrimaryButton, SectionTabs, tooltipStyle, useXpToast } from "./kit";

type Dialog =
  | { t: "new" }
  | { t: "edit"; exam: ExamRow }
  | { t: "enem" }
  | { t: "part"; exam: ExamRow; part: PartKey }
  | { t: "full"; exam: ExamRow }
  | null;

const FILTERS = ["Todos", "Simulados", "ENEMs"] as const;

export function SimuladosScreen({ data, today }: { data: ExamsPageData; today: string }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");
  const toast = useXpToast();
  const close = () => setDialog(null);
  const shown = data.exams.filter((e) => filter === "Todos" || (filter === "ENEMs" ? e.kind === "enem" : e.kind === "simulado"));

  return (
    <div className="space-y-4 md:space-y-6">
      <SectionTabs active="simulados" />
      <Rumo160 data={data} />

      <section className="card-soft p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto flex items-center gap-2 text-xl font-bold">
            <Icon3D name="emoji/alvo.webp" size={24} /> Minhas provas
          </h2>
          <PrimaryButton onClick={() => setDialog({ t: "new" })} className="flex items-center gap-1">
            <Plus className="size-4" /> Simulado
          </PrimaryButton>
          <GhostButton onClick={() => setDialog({ t: "enem" })} className="flex items-center gap-1">
            <Plus className="size-4" /> ENEM antigo
          </GhostButton>
        </div>
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-semibold", f === filter ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="card-inner grid place-items-center gap-2 p-8 text-center">
            <Icon3D name="emoji/alvo.webp" size={48} />
            <p className="font-semibold">Nenhuma prova por aqui ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cadastre um simulado ou escolha um ENEM antigo. Cada parte vale +{EXAM_XP.part} XP; a prova completa, +{EXAM_XP.fullSimulado} (ENEM antigo, +{EXAM_XP.fullEnem}).
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((e) => (
              <ExamCard key={e.id} exam={e} onOpen={(d) => setDialog(d)} />
            ))}
          </ul>
        )}
      </section>

      {dialog?.t === "new" && <SimuladoDialog onClose={close} />}
      {dialog?.t === "edit" && <SimuladoDialog exam={dialog.exam} onClose={close} />}
      {dialog?.t === "enem" && <EnemPicker exams={data.exams} onClose={close} onPicked={(e) => setDialog({ t: "full", exam: e })} />}
      {dialog?.t === "part" && <PartDialog exam={dialog.exam} part={dialog.part} today={today} onClose={close} onXp={toast.show} />}
      {dialog?.t === "full" && <FullDialog exam={dialog.exam} today={today} onClose={close} onXp={toast.show} />}
      {toast.node}
    </div>
  );
}

/* ---------- Rumo aos 160+ ---------- */

const VIEWS = ["Total", "Por área", "Redação"] as const;

function Rumo160({ data }: { data: ExamsPageData }) {
  const { summary } = data;
  const [view, setView] = useState<(typeof VIEWS)[number]>("Total");
  const chart = summary.timeline.map((p) => ({ ...p, d: fmtShortDay(p.day) }));
  const essays = summary.essays.map((p) => ({ ...p, d: fmtShortDay(p.day) }));
  const rec = summary.record;
  const toGo = rec ? GOAL_TOTAL - rec.total : null;

  return (
    <section className="card-soft overflow-hidden p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Icon3D name="emoji/foguete.webp" size={36} />
        <div className="mr-auto">
          <h1 className="text-xl font-bold md:text-2xl">Rumo aos 160+</h1>
          <p className="text-sm text-muted-foreground">Seus acertos nas 4 provas objetivas, de {MAX_TOTAL}.</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon="emoji/trofeu.webp" label="Recorde" tone="text-amber-500" value={rec ? `${rec.total}` : "–"} suffix={rec ? `/${MAX_TOTAL}` : ""}>
          {rec ? rec.name : "complete uma prova"}
        </Stat>
        <Stat icon="emoji/grafico.webp" label="Último" tone="text-primary" value={summary.last ? `${summary.last.total}` : "–"} suffix={summary.last ? `/${MAX_TOTAL}` : ""}>
          {summary.delta == null ? (
            summary.last ? "primeira prova completa" : "sem provas completas"
          ) : (
            <span className={cn("font-semibold", summary.delta >= 0 ? "text-success" : "text-destructive")}>
              {summary.delta > 0 ? "+" : ""}
              {summary.delta} vs anterior
            </span>
          )}
        </Stat>
        <Stat icon="emoji/alvo.webp" label="Meta" tone="text-success" value={`${GOAL_TOTAL}`} suffix="+">
          {toGo == null ? "acertos no total" : toGo <= 0 ? "meta batida! 🎉" : `faltam ${toGo} acertos`}
        </Stat>
        <Stat icon="emoji/check.webp" label="Completas" tone="text-violet-500" value={`${summary.completeCount}`}>
          {summary.completeCount === 1 ? "prova com as 5 partes" : "provas com as 5 partes"}
        </Stat>
      </div>

      {rec && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Recorde {rec.total}</span>
            <span>Meta {GOAL_TOTAL}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${Math.min(100, (rec.total / MAX_TOTAL) * 100)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-success" style={{ left: `${(GOAL_TOTAL / MAX_TOTAL) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="card-inner p-3 md:p-4">
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-sm font-semibold", v === view ? "border-primary bg-primary text-white" : "border-primary/60 text-primary")}
            >
              {v}
            </button>
          ))}
        </div>
        {(view === "Redação" ? essays.length : chart.length) === 0 ? (
          <p className="grid h-56 place-items-center px-6 text-center text-sm text-muted-foreground">
            {view === "Redação"
              ? "Registre a redação de um simulado para ver a evolução da nota."
              : "Registre as 4 provas objetivas de um simulado ou ENEM para ver sua linha do tempo."}
          </p>
        ) : (
          <div className="h-60 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {view === "Total" ? (
                <LineChart data={chart} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={axisTick} minTickGap={16} />
                  <YAxis domain={[0, MAX_TOTAL]} ticks={[0, 45, 90, 135, 180]} axisLine={false} tickLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} formatter={(v) => [`${v}/${MAX_TOTAL}`, "Total"]} />
                  <ReferenceLine y={GOAL_TOTAL} stroke="var(--success)" strokeDasharray="6 4" label={{ value: "Meta 160", position: "insideTopLeft", fontSize: 11, fill: "var(--success)" }} />
                  <Line dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} type="monotone" />
                </LineChart>
              ) : view === "Por área" ? (
                <LineChart data={chart} margin={{ top: 16, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={axisTick} minTickGap={16} />
                  <YAxis domain={[0, 45]} ticks={[0, 15, 30, 40, 45]} axisLine={false} tickLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={GOAL_TOTAL / 4} stroke="var(--success)" strokeDasharray="6 4" />
                  {PARTS.filter((p) => p.key !== "redacao").map((p) => (
                    <Line key={p.key} dataKey={p.key} name={p.label} stroke={p.color} strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={essays} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={axisTick} minTickGap={16} />
                  <YAxis domain={[0, 1000]} ticks={[0, 200, 400, 600, 800, 1000]} axisLine={false} tickLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} formatter={(v) => [v, "Redação"]} />
                  <Line dataKey="score" stroke="var(--chart-5)" strokeWidth={3} dot={{ r: 4 }} type="monotone" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
        {view === "Por área" && chart.length > 0 && <p className="mt-1 text-center text-[11px] text-muted-foreground">Linha tracejada: 40 por área = 160 no total.</p>}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, suffix, tone, children }: { icon: string; label: string; value: string; suffix?: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="card-inner p-3 md:p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon3D name={icon} size={18} /> {label}
      </p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", tone)}>
        {value}
        {suffix && <span className="text-base font-semibold text-muted-foreground">{suffix}</span>}
      </p>
      <p className="truncate text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/* ---------- Lista ---------- */

function ExamCard({ exam, onOpen }: { exam: ExamRow; onOpen: (d: Dialog) => void }) {
  const [pending, start] = useTransition();
  const total = objectiveTotal(exam.parts);
  const complete = isComplete(exam.parts);
  return (
    <li className="card-inner p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <Icon3D name={exam.kind === "enem" ? "emoji/estrela.webp" : "emoji/tarefas.webp"} size={30} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 font-bold">
            {exam.name}
            <span className={cn("rounded-full px-2 text-[10px] font-bold uppercase", exam.kind === "enem" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary")}>
              {exam.kind === "enem" ? "ENEM" : "Simulado"}
            </span>
            {complete && (
              <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-2 text-[10px] font-bold uppercase text-success">
                <Check className="size-3" /> completo
              </span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {exam.source && <span>{exam.source}</span>}
            {exam.url && (
              <a href={exam.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-primary hover:underline">
                <FileText className="size-3.5" /> PDF <ExternalLink className="size-3" />
              </a>
            )}
          </p>
        </div>
        {total != null && (
          <div className="text-right">
            <p className={cn("text-2xl font-bold tabular-nums leading-none", total >= GOAL_TOTAL ? "text-success" : "text-primary")}>
              {total}
              <span className="text-sm text-muted-foreground">/{MAX_TOTAL}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">acertos</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PARTS.map((p) => {
          const r = exam.parts.find((x) => x.part === p.key);
          return (
            <button
              key={p.key}
              onClick={() => onOpen({ t: "part", exam, part: p.key })}
              className={cn(
                "rounded-xl border-2 bg-card p-2 text-left transition hover:border-primary",
                r ? "border-transparent" : "border-dashed border-border",
                p.key === "redacao" && "col-span-2 sm:col-span-1",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </span>
              {r ? (
                <>
                  <span className="block text-lg font-bold tabular-nums">
                    {p.key === "redacao" ? (r.essayScore ?? "–") : `${r.correct}`}
                    <span className="text-xs font-semibold text-muted-foreground">{p.key === "redacao" ? "/1000" : "/45"}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {fmtShortDay(r.day)}
                    {r.minutes ? ` · ${fmtMinutes(r.minutes)}` : ""}
                  </span>
                </>
              ) : (
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                  <Plus className="size-3.5" /> Registrar
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!complete && (
          <button onClick={() => onOpen({ t: "full", exam })} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/85">
            Concluir prova inteira
          </button>
        )}
        {exam.kind === "simulado" && (
          <button onClick={() => onOpen({ t: "edit", exam })} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground">
            <Pencil className="size-3.5" /> Editar
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => confirm(`Apagar "${exam.name}" e todos os registros dela?`) && start(() => deleteExam(exam.id))}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Apagar
        </button>
      </div>
    </li>
  );
}

/* ---------- Diálogos ---------- */

function SimuladoDialog({ exam, onClose }: { exam?: ExamRow; onClose: () => void }) {
  const [name, setName] = useState(exam?.name ?? "");
  const [source, setSource] = useState(exam?.source ?? "");
  const [url, setUrl] = useState(exam?.url ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = exam ? await updateExam(exam.id, { name, source, url }) : await createSimulado({ name, source, url });
      if (!r.ok) setError(r.error);
      else onClose();
    });
  return (
    <Modal title={exam ? "Editar simulado" : "Novo simulado"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nome">
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Simulado SAS 3" className={inputCls} />
        </Field>
        <Field label="Fonte">
          <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={120} placeholder="Ex.: Bernoulli, Poliedro, cursinho…" className={inputCls} />
        </Field>
        <Field label="Link do PDF" hint="Drive, site do cursinho… (envio de arquivo chega em breve)">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={inputCls} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <PrimaryButton type="submit" disabled={pending} className="w-full py-2.5">
          {pending ? "Salvando…" : exam ? "Salvar" : "Cadastrar simulado"}
        </PrimaryButton>
      </form>
    </Modal>
  );
}

function EnemPicker({ exams, onClose, onPicked }: { exams: ExamRow[]; onClose: () => void; onPicked: (e: ExamRow) => void }) {
  const router = useRouter();
  const have = new Set(exams.map((e) => e.enemKey).filter(Boolean));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const byYear = useMemo(() => {
    const m = new Map<number, EnemEntry[]>();
    for (const e of ENEM_LIST) m.set(e.year, [...(m.get(e.year) ?? []), e]);
    return [...m];
  }, []);
  const pick = async (e: EnemEntry) => {
    setBusy(e.key);
    setError("");
    const r = await addEnem(e.key);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
    const existing = exams.find((x) => x.id === r.id);
    onPicked(existing ?? { id: r.id, kind: "enem", name: e.label, source: "INEP", enemKey: e.key, url: null, createdAt: 0, parts: [] });
  };
  return (
    <Modal title="Registrar ENEM antigo" onClose={onClose} wide>
      <p className="mb-3 text-sm text-muted-foreground">
        Escolha a prova que você fez. ENEM completo vale <b className="text-xp">+{EXAM_XP.fullEnem} XP</b>.
      </p>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        {byYear.map(([year, list]) => (
          <div key={year} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{year}</span>
            <div className="flex flex-wrap gap-1.5">
              {list.map((e) => {
                const done = have.has(e.key);
                return (
                  <button
                    key={e.key}
                    disabled={busy !== null}
                    onClick={() => pick(e)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border-2 px-3 py-0.5 text-xs font-semibold transition disabled:opacity-60",
                      done ? "border-success/50 bg-success/10 text-success" : "border-primary/50 text-primary hover:bg-accent",
                    )}
                  >
                    {done && <Check className="size-3" />}
                    {busy === e.key ? "…" : ENEM_KIND_LABEL[e.kind]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Tempo em h + min. */
function TimeInput({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const h = value == null ? "" : String(Math.floor(value / 60));
  const m = value == null ? "" : String(value % 60);
  const set = (hh: string, mm: string) => (hh === "" && mm === "" ? onChange(null) : onChange((Number(hh) || 0) * 60 + Math.min(59, Number(mm) || 0)));
  return (
    <div className="flex items-center gap-1">
      <input inputMode="numeric" aria-label="horas" value={h} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 2), m)} placeholder="0" className={cn(inputCls, "w-14 text-center")} />
      <span className="text-xs text-muted-foreground">h</span>
      <input inputMode="numeric" aria-label="minutos" value={m} onChange={(e) => set(h, e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="00" className={cn(inputCls, "w-14 text-center")} />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  );
}

type Draft = { day: string; correct: string; minutes: number | null; essayScore: string; comps: (number | null)[] };

const draftOf = (r: PartRow | undefined, today: string): Draft => ({
  day: r?.day ?? today,
  correct: r?.correct != null ? String(r.correct) : "",
  minutes: r?.minutes ?? null,
  essayScore: r?.essayScore != null ? String(r.essayScore) : "",
  comps: r?.competencies ?? [null, null, null, null, null],
});

/** Converte o rascunho em entrada da action; null = parte deixada em branco. */
function toInput(part: PartKey, d: Draft, day: string) {
  if (part === "redacao") {
    const comps = d.comps.every((c) => c != null) ? (d.comps as number[]) : null;
    if (d.essayScore === "" && !comps) return null;
    return { part, day, minutes: d.minutes, essayScore: d.essayScore === "" ? null : Number(d.essayScore), competencies: comps };
  }
  if (d.correct === "") return null;
  return { part, day, minutes: d.minutes, correct: Number(d.correct) };
}

function EssayFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const sum = d.comps.every((c) => c != null) ? (d.comps as number[]).reduce((a, b) => a + b, 0) : null;
  return (
    <div className="space-y-2">
      <Field label="Nota (0–1000)" hint={sum != null && d.essayScore === "" ? `Soma das competências: ${sum}` : undefined}>
        <input
          inputMode="numeric"
          value={d.essayScore}
          onChange={(e) => set({ essayScore: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder={sum != null ? String(sum) : "Ex.: 760"}
          className={inputCls}
        />
      </Field>
      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">Competências (opcional)</p>
        <CompetencyPicker comps={d.comps} onChange={(comps) => set({ comps })} />
      </div>
    </div>
  );
}

function validate(part: PartKey, d: Draft): string | null {
  if (part === "redacao") {
    if (d.essayScore !== "" && Number(d.essayScore) > 1000) return "A nota vai até 1000";
    if (d.comps.some((c) => c != null) && d.comps.some((c) => c == null)) return "Preencha as 5 competências ou nenhuma";
  } else if (d.correct !== "" && Number(d.correct) > 45) return "Acertos vão de 0 a 45";
  return null;
}

function PartDialog({ exam, part, today, onClose, onXp }: { exam: ExamRow; part: PartKey; today: string; onClose: () => void; onXp: (xp: number, t: string) => void }) {
  const existing = exam.parts.find((p) => p.part === part);
  const [d, setD] = useState(() => draftOf(existing, today));
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const label = PARTS.find((p) => p.key === part)!.label;
  const save = () => {
    const v = validate(part, d);
    if (v) return setError(v);
    const input = toInput(part, d, d.day);
    if (!input) return setError(part === "redacao" ? "Informe a nota" : "Informe os acertos");
    start(async () => {
      const r = await saveExamParts(exam.id, [input]);
      if (!r.ok) return setError(r.error);
      onXp(r.xp, r.reasons.join(" · "));
      onClose();
    });
  };
  return (
    <Modal title={`${label} · ${exam.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input type="date" required value={d.day} max={today} onChange={(e) => set({ day: e.target.value })} className={inputCls} />
          </Field>
          {part !== "redacao" && (
            <Field label="Acertos (de 45)">
              <input
                autoFocus
                inputMode="numeric"
                value={d.correct}
                onChange={(e) => set({ correct: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                placeholder="0–45"
                className={inputCls}
              />
            </Field>
          )}
        </div>
        <Field label="Tempo gasto">
          <TimeInput value={d.minutes} onChange={(minutes) => set({ minutes })} />
        </Field>
        {part === "redacao" && <EssayFields d={d} set={set} />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          {existing && (
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("Apagar este registro?") && start(async () => (await deleteExamPart(exam.id, part), onClose()))}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label="Apagar registro"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <PrimaryButton type="submit" disabled={pending} className="flex-1 py-2.5">
            {pending ? "Salvando…" : existing ? "Salvar" : `Registrar · +${EXAM_XP.part} XP`}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function FullDialog({ exam, today, onClose, onXp }: { exam: ExamRow; today: string; onClose: () => void; onXp: (xp: number, t: string) => void }) {
  const [day, setDay] = useState(() => exam.parts.map((p) => p.day).sort().at(-1) ?? today);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(PARTS.map((p) => [p.key, draftOf(exam.parts.find((x) => x.part === p.key), today)])) as Record<PartKey, Draft>);
  const set = (k: PartKey) => (p: Partial<Draft>) => setDrafts((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const objective = PARTS.filter((p) => p.key !== "redacao");
  const sum = objective.reduce((a, p) => a + (Number(drafts[p.key].correct) || 0), 0);
  const save = () => {
    for (const p of PARTS) {
      const v = validate(p.key, drafts[p.key]);
      if (v) return setError(`${p.label}: ${v}`);
    }
    const inputs = PARTS.map((p) => toInput(p.key, drafts[p.key], day)).filter((x) => x !== null);
    if (!inputs.length) return setError("Preencha pelo menos uma parte");
    start(async () => {
      const r = await saveExamParts(exam.id, inputs);
      if (!r.ok) return setError(r.error);
      onXp(r.xp, r.reasons.at(-1) ?? "");
      onClose();
    });
  };
  return (
    <Modal title={exam.name} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Data da prova" className="w-44">
            <input type="date" required value={day} max={today} onChange={(e) => setDay(e.target.value)} className={inputCls} />
          </Field>
          <p className="ml-auto text-right">
            <span className="text-3xl font-bold tabular-nums text-primary">{sum}</span>
            <span className="text-sm text-muted-foreground">/{MAX_TOTAL}</span>
            <span className="block text-[11px] text-muted-foreground">deixe em branco o que ainda não fez</span>
          </p>
        </div>
        <div className="space-y-2">
          {objective.map((p) => (
            <div key={p.key} className="card-inner flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
              <span className="flex w-28 items-center gap-1.5 text-sm font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </span>
              <label className="flex items-center gap-1">
                <input
                  inputMode="numeric"
                  aria-label={`Acertos em ${p.label}`}
                  value={drafts[p.key].correct}
                  onChange={(e) => set(p.key)({ correct: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="–"
                  className={cn(inputCls, "w-16 text-center")}
                />
                <span className="text-xs text-muted-foreground">/45</span>
              </label>
              <div className="ml-auto">
                <TimeInput value={drafts[p.key].minutes} onChange={(minutes) => set(p.key)({ minutes })} />
              </div>
            </div>
          ))}
          <div className="card-inner space-y-2 p-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex w-28 items-center gap-1.5 text-sm font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: "var(--chart-5)" }} />
                Redação
              </span>
              <div className="ml-auto">
                <TimeInput value={drafts.redacao.minutes} onChange={(minutes) => set("redacao")({ minutes })} />
              </div>
            </div>
            <EssayFields d={drafts.redacao} set={set("redacao")} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <PrimaryButton type="submit" disabled={pending} className="w-full py-2.5">
          {pending ? "Salvando…" : `Salvar prova · até +${(exam.kind === "enem" ? EXAM_XP.fullEnem : EXAM_XP.fullSimulado) + 5 * EXAM_XP.part} XP`}
        </PrimaryButton>
        <p className="text-center text-xs text-muted-foreground">Feita em dias diferentes? Registre parte por parte tocando em cada área no card.</p>
      </form>
    </Modal>
  );
}
