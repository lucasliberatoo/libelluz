"use client";

import { useMemo, useState, useTransition } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Camera, Check, ChevronDown, ExternalLink, Image as ImageIcon, Pencil, Plus, RotateCcw, Settings2, Shuffle, SkipForward, Trash2, X } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { axisTick, CompetencyPicker, Field, fmtLongDay, fmtShortDay, GhostButton, inputCls, Modal, PrimaryButton, tooltipStyle, useXpToast } from "@/components/simulados/kit";
import { WEEKDAYS } from "@/lib/day";
import { avoidedAxes, AXES, AXIS_EMOJI, COMPETENCY_NAMES, ERROR_TAGS, ESSAY_XP, nextDrawDay, type Axis } from "@/lib/essay";
import { cn } from "@/lib/utils";
import {
  acceptTheme,
  deleteEssay,
  deleteTheme,
  drawNow,
  getEssayPhoto,
  passTheme,
  restockTheme,
  saveEssay,
  saveTheme,
  seedSampleThemes,
  setEssayRhythm,
} from "@/server/essay-actions";
import type { EssayPageData, EssayRow, ThemeRow } from "@/server/essay-queries";

const WEEKDAY_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const COMP_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Dialog = { t: "essay"; essay?: EssayRow; theme?: ThemeRow | null } | { t: "theme"; theme?: ThemeRow } | null;

export function RedacoesScreen({ data }: { data: EssayPageData }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const toast = useXpToast();
  const close = () => setDialog(null);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid gap-4 md:grid-cols-12 md:gap-6">
        <CurrentTheme data={data} onWrite={(theme) => setDialog({ t: "essay", theme })} />
        <Summary data={data} />
      </div>
      <Evolution essays={data.essays} />
      <div className="grid items-start gap-4 md:grid-cols-12 md:gap-6">
        <EssayList essays={data.essays} onNew={() => setDialog({ t: "essay", theme: data.current?.status === "accepted" ? data.current : null })} onEdit={(essay) => setDialog({ t: "essay", essay })} />
        <ThemeBank themes={data.themes} onAdd={() => setDialog({ t: "theme" })} onEdit={(theme) => setDialog({ t: "theme", theme })} />
      </div>
      {dialog?.t === "essay" && <EssayDialog data={data} essay={dialog.essay} theme={dialog.theme} onClose={close} onXp={toast.show} />}
      {dialog?.t === "theme" && <ThemeDialog theme={dialog.theme} onClose={close} />}
      {toast.node}
    </div>
  );
}

/* ---------- Tema da vez ---------- */

function CurrentTheme({ data, onWrite }: { data: EssayPageData; onWrite: (t: ThemeRow) => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const t = data.current;
  const stock = data.themes.filter((x) => x.status === "stock").length;
  const next = nextDrawDay(data.rhythm, data.essayDay, data.today);
  const rhythmText =
    data.rhythm === "semana" ? "Tema da semana: sorteado toda segunda, faça quando der." : `Dia fixo: um tema sorteado ${data.essayDay === 0 || data.essayDay === 6 ? "todo" : "toda"} ${WEEKDAY_FULL[data.essayDay]}.`;
  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      setMsg("");
      const r = (await fn()) as { ok?: boolean; error?: string } | undefined;
      if (r && r.ok === false) setMsg(r.error ?? "");
    });

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-5 text-white shadow-lg md:col-span-7 md:p-6 min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <Icon3D name="emoji/livro.webp" size={28} />
        <h1 className="flex-1 text-sm font-bold uppercase tracking-wide text-white/85">{data.rhythm === "semana" ? "Tema da semana" : "Tema da vez"}</h1>
        <button onClick={() => setSettings((s) => !s)} aria-label="Ritmo das redações" className="rounded-full p-1.5 text-white/85 hover:bg-white/15">
          <Settings2 className="size-5" />
        </button>
      </div>

      {settings && <RhythmSettings data={data} onDone={() => setSettings(false)} />}

      {t ? (
        <>
          <p className="text-xl font-bold leading-snug md:text-2xl">{t.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold capitalize">
              {AXIS_EMOJI[t.axis]} {t.axis}
            </span>
            {t.source && <SourceLink source={t.source} className="text-white/85" />}
            {t.status === "accepted" && <span className="rounded-full bg-success px-2.5 py-0.5 font-bold">aceito</span>}
          </div>
          {t.notes && (
            <div className="mt-3">
              <button onClick={() => setShowNotes((s) => !s)} className="flex items-center gap-1 text-xs font-semibold text-white/85">
                Repertório anotado <ChevronDown className={cn("size-3.5 transition", showNotes && "rotate-180")} />
              </button>
              {showNotes && <p className="mt-1 whitespace-pre-wrap rounded-xl bg-white/10 p-3 text-sm">{t.notes}</p>}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {t.status === "drawn" ? (
              <>
                <button disabled={pending} onClick={() => act(() => acceptTheme(t.id))} className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow disabled:opacity-60">
                  <Check className="size-4" /> Aceitar
                </button>
                <button disabled={pending} onClick={() => act(() => passTheme(t.id))} className="flex items-center gap-1.5 rounded-full border-2 border-white/60 px-5 py-2 text-sm font-bold disabled:opacity-60">
                  <SkipForward className="size-4" /> Passar
                </button>
              </>
            ) : (
              <>
                <button onClick={() => onWrite(t)} className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow">
                  <Pencil className="size-4" /> Registrar redação · +{ESSAY_XP.essay} XP
                </button>
                <button disabled={pending} onClick={() => act(() => passTheme(t.id))} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60">
                  <SkipForward className="size-4" /> Trocar tema
                </button>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-white/70">Passar não tem limite: o tema volta ao estoque e reaparece mais tarde.</p>
        </>
      ) : (
        <>
          <p className="text-xl font-bold md:text-2xl">{stock ? "Nenhum tema sorteado agora" : "Seu estoque de temas está vazio"}</p>
          <p className="mt-1 text-sm text-white/85">
            {stock
              ? `Próximo sorteio automático: ${WEEKDAY_FULL[Number(new Date(`${next}T12:00:00Z`).getUTCDay())]}, ${fmtShortDay(next)}. Quer adiantar?`
              : "Cadastre temas no banco (ou carregue os de ENEMs anteriores) para o sorteio funcionar."}
          </p>
          {stock > 0 && (
            <button disabled={pending} onClick={() => act(() => drawNow())} className="mt-4 flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow disabled:opacity-60">
              <Shuffle className="size-4" /> {pending ? "Sorteando…" : "Sortear agora"}
            </button>
          )}
        </>
      )}
      {msg && <p className="mt-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm">{msg}</p>}
      <p className="mt-4 border-t border-white/20 pt-3 text-xs text-white/75">
        {rhythmText} {stock} {stock === 1 ? "tema" : "temas"} no estoque.
      </p>
    </section>
  );
}

function RhythmSettings({ data, onDone }: { data: EssayPageData; onDone: () => void }) {
  const [rhythm, setRhythm] = useState(data.rhythm);
  const [day, setDay] = useState(data.essayDay);
  const [pending, start] = useTransition();
  return (
    <div className="mb-4 space-y-3 rounded-xl bg-white/15 p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["semana", "Tema da semana", "sorteado na segunda"],
            ["fixo", "Dia fixo", "sorteia no dia escolhido"],
          ] as const
        ).map(([k, label, sub]) => (
          <button key={k} onClick={() => setRhythm(k)} className={cn("rounded-xl border-2 p-2 text-left", rhythm === k ? "border-white bg-white/20" : "border-white/30")}>
            <span className="block font-bold">{label}</span>
            <span className="text-xs text-white/80">{sub}</span>
          </button>
        ))}
      </div>
      {rhythm === "fixo" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w, i) => (
            <button key={w} onClick={() => setDay(i)} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", day === i ? "bg-white text-primary" : "bg-white/15")}>
              {w}
            </button>
          ))}
        </div>
      )}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setEssayRhythm(rhythm, day);
            onDone();
          })
        }
        className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-primary disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar ritmo"}
      </button>
    </div>
  );
}

function SourceLink({ source, className }: { source: string; className?: string }) {
  return /^https?:\/\//.test(source) ? (
    <a href={source} target="_blank" rel="noreferrer" className={cn("flex items-center gap-1 font-semibold underline-offset-2 hover:underline", className)}>
      fonte <ExternalLink className="size-3" />
    </a>
  ) : (
    <span className={className}>{source}</span>
  );
}

/* ---------- Resumo ---------- */

function Summary({ data }: { data: EssayPageData }) {
  const scored = data.essays.filter((e) => e.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, e) => a + e.score!, 0) / scored.length) : null;
  const best = scored.length ? Math.max(...scored.map((e) => e.score!)) : null;
  const perAxis = AXES.map((a) => ({ axis: a, n: data.essays.filter((e) => e.axis === a).length }));
  const maxN = Math.max(1, ...perAxis.map((p) => p.n));
  const avoided = avoidedAxes(data.themes);
  return (
    <section className="card-soft min-w-0 p-4 md:col-span-5 md:p-5">
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Redações" value={data.essays.length} tone="text-primary" />
        <MiniStat label="Média" value={avg ?? "–"} tone="text-violet-500" />
        <MiniStat label="Melhor" value={best ?? "–"} tone="text-amber-500" />
      </div>
      <p className="mb-2 text-sm font-bold">Eixos praticados</p>
      <ul className="space-y-1.5">
        {perAxis.map((p) => (
          <li key={p.axis} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate capitalize">
              {AXIS_EMOJI[p.axis]} {p.axis}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(p.n / maxN) * 100}%` }} />
            </div>
            <span className="w-4 text-right tabular-nums text-muted-foreground">{p.n}</span>
          </li>
        ))}
      </ul>
      {avoided.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-xl bg-warning/15 p-3 text-xs">
          <Icon3D name="emoji/sino.webp" size={20} />
          <p>
            Você passou{" "}
            {avoided.slice(0, 2).map((a, i) => (
              <span key={a.axis}>
                {i > 0 && " e "}
                <b>
                  {a.passes} temas de {a.axis}
                </b>
              </span>
            ))}
            . O sorteio vai insistir um pouco: é justamente onde dá para crescer.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">O sorteio prioriza os eixos que você menos praticou.</p>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="card-inner p-2.5">
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------- Evolução ---------- */

function Evolution({ essays }: { essays: EssayRow[] }) {
  const [view, setView] = useState<"total" | "comp">("total");
  const data = [...essays]
    .filter((e) => e.score != null)
    .reverse()
    .map((e) => ({
      d: fmtShortDay(e.day),
      title: e.title,
      score: e.score,
      ...Object.fromEntries((e.competencies ?? []).map((c, i) => [`c${i + 1}`, c])),
    }));
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of essays) for (const t of e.errorTags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [essays]);
  return (
    <section className="card-soft p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-xl font-bold">
          <Icon3D name="emoji/grafico.webp" size={24} /> Evolução
        </h2>
        {(
          [
            ["total", "Nota total"],
            ["comp", "Por competência"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={cn("rounded-full border-2 px-3 py-0.5 text-sm font-semibold", view === k ? "border-primary bg-primary text-white" : "border-primary/60 text-primary")}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-12">
        <div className="card-inner min-w-0 p-3 md:col-span-8">
          {data.length === 0 ? (
            <p className="grid h-56 place-items-center px-6 text-center text-sm text-muted-foreground">Registre redações com nota para ver sua evolução aqui.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={axisTick} minTickGap={16} />
                  {view === "total" ? (
                    <YAxis domain={[0, 1000]} ticks={[0, 200, 400, 600, 800, 1000]} axisLine={false} tickLine={false} tick={axisTick} />
                  ) : (
                    <YAxis domain={[0, 200]} ticks={[0, 40, 80, 120, 160, 200]} axisLine={false} tickLine={false} tick={axisTick} />
                  )}
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ""} />
                  {view === "total" ? (
                    <>
                      <ReferenceLine y={900} stroke="var(--success)" strokeDasharray="6 4" label={{ value: "900", position: "insideTopLeft", fontSize: 11, fill: "var(--success)" }} />
                      <Line dataKey="score" name="Nota" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} type="monotone" />
                    </>
                  ) : (
                    <>
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      {COMPETENCY_NAMES.map((n, i) => (
                        <Line key={n} dataKey={`c${i + 1}`} name={`C${i + 1}`} stroke={COMP_COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls type="monotone" />
                      ))}
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card-inner p-4 md:col-span-4">
          <p className="mb-2 text-sm font-bold">Erros mais frequentes</p>
          {tags.length ? (
            <ul className="space-y-1.5 text-sm">
              {tags.map(([t, n]) => (
                <li key={t} className="flex items-center justify-between gap-2">
                  <span className="truncate">{t}</span>
                  <span className="rounded-full bg-destructive/10 px-2 text-xs font-bold tabular-nums text-destructive">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Marque as etiquetas de erro da correção para ver padrões aqui.</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            XP: +{ESSAY_XP.essay} por redação, +10 com 600+, +30 com 800+, +50 com 900+.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Minhas redações ---------- */

function EssayList({ essays, onNew, onEdit }: { essays: EssayRow[]; onNew: () => void; onEdit: (e: EssayRow) => void }) {
  return (
    <section className="card-soft min-w-0 p-4 md:col-span-7 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-xl font-bold">
          <Icon3D name="emoji/tarefas.webp" size={24} /> Minhas redações
        </h2>
        <PrimaryButton onClick={onNew} className="flex items-center gap-1">
          <Plus className="size-4" /> Registrar
        </PrimaryButton>
      </div>
      {essays.length === 0 ? (
        <p className="card-inner p-6 text-center text-sm text-muted-foreground">Nenhuma redação registrada ainda. Aceite o tema da vez e mãos à obra!</p>
      ) : (
        <ul className="space-y-3">
          {essays.map((e) => (
            <EssayItem key={e.id} e={e} onEdit={() => onEdit(e)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EssayItem({ e, onEdit }: { e: EssayRow; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="card-inner p-3 md:p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <div className={cn("grid size-14 shrink-0 place-items-center rounded-xl bg-card text-lg font-bold tabular-nums", e.score == null ? "text-muted-foreground" : e.score >= 900 ? "text-success" : e.score >= 600 ? "text-primary" : "text-amber-500")}>
          {e.score ?? "–"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">{e.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{fmtLongDay(e.day)}</span>
            {e.axis && (
              <span className="capitalize">
                {AXIS_EMOJI[e.axis]} {e.axis}
              </span>
            )}
            {e.hasPhoto && <ImageIcon className="size-3.5" />}
          </p>
          {e.errorTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {e.errorTags.map((t) => (
                <span key={t} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {e.competencies && (
            <div className="grid grid-cols-5 gap-1.5">
              {e.competencies.map((c, i) => (
                <div key={i} className="rounded-lg bg-card p-1.5 text-center">
                  <p className="text-[10px] font-semibold text-muted-foreground">C{i + 1}</p>
                  <p className="font-bold tabular-nums">{c}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(c / 200) * 100}%`, background: COMP_COLORS[i] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {e.comments && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Comentários da correção</p>
              <p className="whitespace-pre-wrap text-sm">{e.comments}</p>
            </div>
          )}
          {e.text && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Texto</p>
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-card p-3 text-sm leading-relaxed">{e.text}</p>
            </div>
          )}
          {e.hasPhoto &&
            (photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Foto da redação" className="max-h-[70vh] w-full rounded-xl bg-card object-contain" />
            ) : (
              <button disabled={pending} onClick={() => start(async () => setPhoto(await getEssayPhoto(e.id)))} className="flex items-center gap-1 text-sm font-semibold text-primary">
                <ImageIcon className="size-4" /> {pending ? "Carregando…" : "Ver foto"}
              </button>
            ))}
          <div className="flex gap-2">
            <button onClick={onEdit} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground">
              <Pencil className="size-3.5" /> Editar
            </button>
            <button
              disabled={pending}
              onClick={() => confirm("Apagar esta redação?") && start(() => deleteEssay(e.id))}
              className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Apagar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- Banco de temas ---------- */

const STATUS_LABEL: Record<ThemeRow["status"], string> = { stock: "no estoque", drawn: "sorteado", accepted: "aceito", done: "feito" };

function ThemeBank({ themes, onAdd, onEdit }: { themes: ThemeRow[]; onAdd: () => void; onEdit: (t: ThemeRow) => void }) {
  const [axis, setAxis] = useState<Axis | null>(null);
  const [pending, start] = useTransition();
  const shown = themes.filter((t) => !axis || t.axis === axis);
  return (
    <section className="card-soft min-w-0 p-4 md:col-span-5 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-bold">
          <Icon3D name="emoji/livro.webp" size={22} /> Banco de temas
        </h2>
        <GhostButton onClick={onAdd} className="flex items-center gap-1 px-3 py-1">
          <Plus className="size-4" /> Tema
        </GhostButton>
      </div>
      {themes.length === 0 ? (
        <div className="card-inner space-y-3 p-5 text-center">
          <p className="text-sm text-muted-foreground">Seu banco está vazio. Comece com os temas oficiais de redações de ENEMs anteriores e vá somando os seus.</p>
          <PrimaryButton disabled={pending} onClick={() => start(() => seedSampleThemes())}>
            {pending ? "Carregando…" : "Carregar temas de ENEMs anteriores"}
          </PrimaryButton>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
            <button onClick={() => setAxis(null)} className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", !axis ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
              Todos ({themes.length})
            </button>
            {AXES.map((a) => {
              const n = themes.filter((t) => t.axis === a).length;
              return (
                n > 0 && (
                  <button key={a} onClick={() => setAxis(a)} className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", axis === a ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    {AXIS_EMOJI[a]} {a} ({n})
                  </button>
                )
              );
            })}
          </div>
          <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1">
            {shown.map((t) => (
              <li key={t.id} className="card-inner group flex items-start gap-2 p-2.5">
                <span className="mt-0.5 text-base" aria-hidden>
                  {AXIS_EMOJI[t.axis] ?? "📝"}
                </span>
                <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold leading-snug">{t.title}</p>
                  <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                    <span className={cn(t.status === "done" && "text-success", (t.status === "drawn" || t.status === "accepted") && "font-semibold text-primary")}>{STATUS_LABEL[t.status]}</span>
                    {t.source && !/^https?:/.test(t.source) && <span>{t.source}</span>}
                    {t.passCount > 0 && <span>passado {t.passCount}×</span>}
                    {t.notes && <span>📌 repertório</span>}
                  </p>
                </button>
                {t.status === "done" && (
                  <button disabled={pending} onClick={() => start(() => restockTheme(t.id))} title="Devolver ao sorteio" aria-label="Devolver ao sorteio" className="rounded-full p-1 text-muted-foreground hover:text-primary">
                    <RotateCcw className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ThemeDialog({ theme, onClose }: { theme?: ThemeRow; onClose: () => void }) {
  const [title, setTitle] = useState(theme?.title ?? "");
  const [axis, setAxis] = useState<Axis>((theme?.axis as Axis) ?? "sociedade");
  const [source, setSource] = useState(theme?.source ?? "");
  const [notes, setNotes] = useState(theme?.notes ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={theme ? "Editar tema" : "Novo tema"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveTheme({ title, axis, source, notes }, theme?.id);
            if (!r.ok) setError(r.error);
            else onClose();
          });
        }}
      >
        <Field label="Tema">
          <textarea autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} rows={2} maxLength={300} placeholder="Ex.: Desafios para..." className={inputCls} />
        </Field>
        <Field label="Eixo">
          <div className="flex flex-wrap gap-1.5">
            {AXES.map((a) => (
              <button type="button" key={a} onClick={() => setAxis(a)} className={cn("rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold capitalize", axis === a ? "border-primary bg-primary text-white" : "border-border")}>
                {AXIS_EMOJI[a]} {a}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Link ou fonte">
          <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} placeholder="https://… ou ENEM 2019" className={inputCls} />
        </Field>
        <Field label="Anotações de repertório">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} placeholder="Citações, dados, filmes, leis…" className={inputCls} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          {theme && (
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("Apagar este tema do banco?") && start(async () => (await deleteTheme(theme.id), onClose()))}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label="Apagar tema"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <PrimaryButton type="submit" disabled={pending} className="flex-1 py-2.5">
            {pending ? "Salvando…" : theme ? "Salvar" : "Adicionar ao banco"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Registro de redação ---------- */

const MAX_PHOTO = 1_500_000;

/** Reduz a foto no navegador (JPEG) até caber em ~1,5 MB, preservando a leitura da letra. */
async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  for (const [side, q] of [
    [1800, 0.82],
    [1600, 0.75],
    [1400, 0.7],
    [1200, 0.65],
    [1000, 0.6],
  ] as const) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= MAX_PHOTO) return url;
  }
  throw new Error("Foto grande demais mesmo depois de comprimir");
}

function EssayDialog({
  data,
  essay,
  theme,
  onClose,
  onXp,
}: {
  data: EssayPageData;
  essay?: EssayRow;
  theme?: ThemeRow | null;
  onClose: () => void;
  onXp: (xp: number, t: string) => void;
}) {
  const [themeId, setThemeId] = useState<string>(essay?.themeId ?? theme?.id ?? "");
  const [title, setTitle] = useState(essay?.title ?? theme?.title ?? "");
  const [day, setDay] = useState(essay?.day ?? data.today);
  const [mode, setMode] = useState<"texto" | "foto">(essay?.hasPhoto && !essay.text ? "foto" : "texto");
  const [text, setText] = useState(essay?.text ?? "");
  // undefined = manter a foto já salva
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [score, setScore] = useState(essay?.score != null ? String(essay.score) : "");
  const [comps, setComps] = useState<(number | null)[]>(essay?.competencies ?? [null, null, null, null, null]);
  const [tags, setTags] = useState<string[]>(essay?.errorTags ?? []);
  const [customTag, setCustomTag] = useState("");
  const [comments, setComments] = useState(essay?.comments ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const sum = comps.every((c) => c != null) ? (comps as number[]).reduce((a, b) => a + b, 0) : null;
  const allTags = [...new Set([...ERROR_TAGS, ...tags])];
  const usable = data.themes.filter((t) => t.status !== "done" || t.id === themeId);
  const hasPhoto = photo === undefined ? !!essay?.hasPhoto : !!photo;

  const save = () => {
    if (comps.some((c) => c != null) && comps.some((c) => c == null)) return setError("Preencha as 5 competências ou nenhuma");
    if (score !== "" && Number(score) > 1000) return setError("A nota vai até 1000");
    start(async () => {
      const r = await saveEssay(
        {
          themeId: themeId || null,
          title,
          day,
          score: score === "" ? null : Number(score),
          competencies: comps.every((c) => c != null) ? (comps as number[]) : null,
          errorTags: tags,
          comments,
          text,
          photo,
        },
        essay?.id,
      );
      if (!r.ok) return setError(r.error);
      onXp(r.xp ?? 0, "Redação registrada");
      onClose();
    });
  };

  return (
    <Modal title={essay ? "Editar redação" : "Registrar redação"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label="Tema do banco (opcional)">
            <select
              value={themeId}
              onChange={(e) => {
                setThemeId(e.target.value);
                const t = data.themes.find((x) => x.id === e.target.value);
                if (t) setTitle(t.title);
              }}
              className={inputCls}
            >
              <option value="">— tema avulso —</option>
              {usable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title.length > 70 ? `${t.title.slice(0, 70)}…` : t.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" required value={day} max={data.today} onChange={(e) => setDay(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Tema">
          <textarea required value={title} onChange={(e) => setTitle(e.target.value)} rows={2} maxLength={300} className={inputCls} />
        </Field>

        <div>
          <div className="mb-2 flex gap-2">
            {(["texto", "foto"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)} className={cn("rounded-full border-2 px-3 py-0.5 text-sm font-semibold capitalize", mode === m ? "border-primary bg-primary text-white" : "border-primary/60 text-primary")}>
                {m}
              </button>
            ))}
          </div>
          {mode === "texto" ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="Cole ou digite sua redação…" className={cn(inputCls, "leading-relaxed")} />
          ) : hasPhoto ? (
            <div className="relative">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Foto da redação" className="max-h-72 w-full rounded-xl object-contain" />
              ) : (
                <p className="card-inner p-4 text-sm text-muted-foreground">Foto já salva nesta redação.</p>
              )}
              <button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white" aria-label="Remover foto">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary">
              <Camera className="size-4" /> Tirar ou escolher foto da folha
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setPhoto(await compressPhoto(f));
                    setError("");
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Nota (0–1000)" hint={sum != null && score === "" ? `Soma: ${sum}` : undefined}>
            <input inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={sum != null ? String(sum) : "Ex.: 840"} className={inputCls} />
          </Field>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Competências (opcional, 0–200)</p>
            <CompetencyPicker comps={comps} onChange={setComps} />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Etiquetas de erro</p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold transition", on ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {t}
                </button>
              );
            })}
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = customTag.trim();
                  if (v && !tags.includes(v)) setTags([...tags, v]);
                  setCustomTag("");
                }
              }}
              maxLength={60}
              placeholder="+ outra (Enter)"
              className="w-32 rounded-full border bg-background px-2.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <Field label="Comentários da correção">
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} maxLength={10000} placeholder="O que o corretor apontou…" className={inputCls} />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <PrimaryButton type="submit" disabled={pending} className="w-full py-2.5">
          {pending ? "Salvando…" : essay ? "Salvar" : `Registrar · +${ESSAY_XP.essay} XP`}
        </PrimaryButton>
      </form>
    </Modal>
  );
}
