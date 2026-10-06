"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, Infinity as InfinityIcon, Pause, Play, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { CairnLogo } from "@/components/brand";
import { listFocusNotes, type FocusNote } from "@/server/focus-tools";
import { FocusTools, WellnessOverlay } from "./focus-tools";
import { chime, stopNoise } from "./noise";
import { discardFocus, saveFocusResult, type FocusResult } from "@/server/actions";
import {
  fmtClock,
  type FocusMethod,
  type StudyKind,
  useFocus,
} from "./focus-provider";

const KINDS: StudyKind[] = ["Teoria", "Questões", "Revisão", "Videoaula", "Flashcards", "Redação"];
const METHODS: { m: FocusMethod; icon: React.ReactNode }[] = [
  { m: "Cronometrado", icon: <Timer className="size-4" /> },
  { m: "Pomodoro", icon: <Apple className="size-4" /> },
  { m: "Livre", icon: <InfinityIcon className="size-4" /> },
];
const PRESETS = [30, 60, 90, 120];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`;
}

export type FocusTree = { area: string; subjects: { name: string; topics: string[] }[] }[];
export type FocusSuggestion = { label: string; area: string; subject: string; topic: string; kind?: StudyKind };
export type FocusPreset = { area: string; subject: string; topic: string; kind?: StudyKind; minutes?: number };

export function FocusScreen({
  tree,
  suggestions,
  preset,
}: {
  tree: FocusTree;
  suggestions: FocusSuggestion[];
  preset: FocusPreset | null;
}) {
  const { session } = useFocus();
  const [summary, setSummary] = useState<FocusResult | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <AnimatePresence mode="wait">
        {summary ? (
          <motion.div key="sum" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Summary s={summary} onClose={() => setSummary(null)} />
          </motion.div>
        ) : session ? (
          <motion.div key="run" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Running onStop={setSummary} />
          </motion.div>
        ) : (
          <motion.div key="cfg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Configure tree={tree} suggestions={suggestions} preset={preset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-white bg-white text-primary shadow" : "border-white/50 text-white hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function Configure({ tree, suggestions, preset }: { tree: FocusTree; suggestions: FocusSuggestion[]; preset: FocusPreset | null }) {
  const { start } = useFocus();
  const first = preset ?? suggestions[0] ?? {
    area: tree[0]?.area ?? "",
    subject: tree[0]?.subjects[0]?.name ?? "",
    topic: tree[0]?.subjects[0]?.topics[0] ?? "",
  };
  const [area, setArea] = useState<string>(first.area);
  const subjects = tree.find((a) => a.area === area)?.subjects ?? [];
  const [subject, setSubject] = useState<string>(first.subject);
  const topics = subjects.find((s) => s.name === subject)?.topics ?? [];
  const [topic, setTopic] = useState<string>(first.topic);
  const [kind, setKind] = useState<StudyKind>(preset?.kind ?? (preset ? "Teoria" : suggestions[0]?.kind) ?? "Teoria");
  const [method, setMethod] = useState<FocusMethod>("Cronometrado");
  const [minutes, setMinutes] = useState(preset?.minutes ?? 60);
  const [starting, setStarting] = useState(false);

  const pick = (c: FocusSuggestion) => {
    setArea(c.area);
    setSubject(c.subject);
    setTopic(c.topic);
    if (c.kind) setKind(c.kind);
  };

  const go = async () => {
    if (!topic || starting) return;
    setStarting(true);
    try {
      await start({ area, subject, topic, kind, method, minutes: method === "Pomodoro" ? 25 : method === "Livre" ? 50 : minutes });
    } finally {
      setStarting(false);
    }
  };

  const select = "w-full rounded-xl border-0 bg-white/15 px-3 py-2.5 text-sm font-medium text-white outline-none ring-1 ring-white/30 focus:ring-2 focus:ring-white [&>option]:text-foreground";

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-b from-primary to-blue-500 p-5 text-white shadow-xl md:p-7">
      <h1 className="text-center text-xl font-bold">Modo Foco</h1>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-80">Sugestões de hoje</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {suggestions.map((s) => (
            <Chip key={s.label} active={topic === s.topic} onClick={() => pick(s)}>
              {s.label}
            </Chip>
          ))}
          {!suggestions.length && <p className="text-sm opacity-80">Escolha a matéria abaixo.</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          className={select}
          value={area}
          onChange={(e) => {
            const a = tree.find((x) => x.area === e.target.value)!;
            setArea(a.area);
            setSubject(a.subjects[0]?.name ?? "");
            setTopic(a.subjects[0]?.topics[0] ?? "");
          }}
        >
          {tree.map((a) => (
            <option key={a.area}>{a.area}</option>
          ))}
        </select>
        <select
          className={select}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setTopic(subjects.find((s) => s.name === e.target.value)?.topics[0] ?? "");
          }}
        >
          {subjects.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
        <select className={select} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide opacity-80">Tipo de estudo</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k}
          </Chip>
        ))}
      </div>

      <button
        onClick={go}
        disabled={starting}
        className="mx-auto mt-7 grid size-36 place-items-center rounded-full border-[6px] border-white/80 transition hover:scale-[1.03] active:scale-95"
        aria-label="Começar"
      >
        <Play className="ml-2 size-14 fill-white" />
      </button>

      <div className="mt-6 flex justify-center gap-2">
        {METHODS.map(({ m, icon }) => (
          <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
            {icon}
            {m}
          </Chip>
        ))}
      </div>

      {method === "Cronometrado" && (
        <div className="mt-5">
          <div className="mb-1 text-center text-2xl font-bold tabular-nums">{fmtMin(minutes)}</div>
          <input
            type="range"
            min={10}
            max={240}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="mt-2 flex justify-center gap-2">
            {PRESETS.map((p) => (
              <Chip key={p} active={minutes === p} onClick={() => setMinutes(p)}>
                {fmtMin(p)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {method === "Pomodoro" && (
        <p className="mt-5 text-center text-sm opacity-90">25 min de foco · 5 min de pausa com bem-estar</p>
      )}
      {method === "Livre" && (
        <p className="mt-5 text-center text-sm opacity-90">Sem limite. Vou sugerir uma pausa a cada ~50 min.</p>
      )}

      <button
        onClick={go}
        disabled={starting}
        className="mt-6 w-full rounded-full bg-white py-3.5 text-lg font-bold text-primary shadow-lg transition hover:brightness-95 active:scale-[0.98]"
      >
        {starting ? "Começando…" : "Começar Estudo"}
      </button>
    </section>
  );
}

const POMODORO_MS = 25 * 60_000;
const FREE_BREAK_MS = 50 * 60_000;

function Running({ onStop }: { onStop: (s: FocusResult) => void }) {
  const { session, elapsedMs, now, pause, resume, stop } = useFocus();
  const [overlay, setOverlay] = useState<"breath" | "stretch" | null>(null);
  const [breakUntil, setBreakUntil] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);
  // ciclos/avisos já tratados (os anteriores a abrir a tela não disparam de novo)
  const [pomoDone, setPomoDone] = useState(() => Math.floor(elapsedMs / POMODORO_MS));
  const [freeSeen, setFreeSeen] = useState(() => Math.floor(elapsedMs / FREE_BREAK_MS));
  const [overDismissed, setOverDismissed] = useState(false);

  const method = session?.method;
  const paused = !!session?.pausedAt;
  const free = method === "Livre";
  const pomodoro = method === "Pomodoro";
  const target = (session?.minutes ?? 0) * 60_000;
  const pomoIndex = Math.floor(elapsedMs / POMODORO_MS);
  const pomoDue = pomodoro && !paused && pomoIndex > pomoDone;
  const overTime = !free && !pomodoro && target > 0 && elapsedMs >= target;
  const freeBreak = free && !paused && Math.floor(elapsedMs / FREE_BREAK_MS) > freeSeen;
  const breakMs = breakUntil ? Math.max(0, breakUntil - now) : 0;

  // Pomodoro: a cada 25 min, pausa sozinho e abre a tela de bem-estar (5 min; 15 a cada 4 ciclos)
  useEffect(() => {
    if (!pomoDue) return;
    const t = setTimeout(() => {
      pause();
      chime();
      setPomoDone(pomoIndex);
      setBreakUntil(Date.now() + (pomoIndex % 4 === 0 ? 15 : 5) * 60_000);
    }, 0);
    return () => clearTimeout(t);
  }, [pomoDue, pomoIndex, pause]);

  // fim da pausa do Pomodoro: volta ao foco
  useEffect(() => {
    if (!breakUntil || breakMs > 0) return;
    const t = setTimeout(() => {
      chime();
      setBreakUntil(null);
      resume();
    }, 0);
    return () => clearTimeout(t);
  }, [breakUntil, breakMs, resume]);

  useEffect(() => {
    if (overTime || freeBreak) chime();
  }, [overTime, freeBreak]);

  if (!session) return null;
  const ringTarget = pomodoro ? POMODORO_MS : free ? FREE_BREAK_MS : target;
  const inCycle = pomodoro ? elapsedMs - pomoIndex * POMODORO_MS : free ? elapsedMs % FREE_BREAK_MS : elapsedMs;
  const pct = Math.min(1, inCycle / ringTarget);
  const remaining = Math.max(0, ringTarget - inCycle);
  const r = 120;
  const c = 2 * Math.PI * r;

  const openWellness = (m: "breath" | "stretch") => {
    if (!paused) pause();
    setOverlay(m);
  };
  const closeWellness = () => {
    setOverlay(null);
    resume();
  };

  return (
    <section className="rounded-3xl bg-gradient-to-b from-primary to-blue-500 p-5 text-center text-white shadow-xl md:p-7">
      <p className="text-sm opacity-85">
        {session.subject} · {session.kind}
      </p>
      <h1 className="text-xl font-bold">{session.topic}</h1>

      <div className="relative mx-auto mt-6 size-64 md:size-72">
        <svg viewBox="0 0 260 260" className="size-full -rotate-90">
          <circle cx="130" cy="130" r={r} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="12" />
          <circle
            cx="130"
            cy="130"
            r={r}
            fill="none"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <p className="text-5xl font-bold tabular-nums">{fmtClock(free || overTime ? elapsedMs : remaining)}</p>
            <p className="mt-1 text-sm opacity-80">
              {paused
                ? "pausado (não conta)"
                : free
                  ? "modo livre"
                  : pomodoro
                    ? `Pomodoro ${pomoIndex + 1} · ${fmtClock(elapsedMs)} no total`
                    : overTime
                      ? "tempo cumprido · seguindo"
                      : `${session.method} · ${fmtClock(elapsedMs)} feitos`}
            </p>
          </div>
        </div>
      </div>

      {overTime && !overDismissed && (
        <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-white/15 p-3 text-sm">
          <p className="font-semibold">⏰ Tempo cumprido! Mandou bem.</p>
          <p className="opacity-85">Encerre para salvar ou continue estudando: o tempo extra também conta.</p>
          <button onClick={() => setOverDismissed(true)} className="mt-2 rounded-full bg-white/20 px-4 py-1 font-semibold">
            Continuar estudando
          </button>
        </div>
      )}
      {freeBreak && (
        <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-white/15 p-3 text-sm">
          <p className="font-semibold">Já são {Math.floor(elapsedMs / 60_000)} min de foco. Que tal uma pausa?</p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              onClick={() => {
                setFreeSeen(Math.floor(elapsedMs / FREE_BREAK_MS));
                openWellness("breath");
              }}
              className="rounded-full bg-white px-4 py-1 font-semibold text-primary"
            >
              Fazer uma pausa
            </button>
            <button onClick={() => setFreeSeen(Math.floor(elapsedMs / FREE_BREAK_MS))} className="rounded-full bg-white/20 px-4 py-1 font-semibold">
              Seguir
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={paused ? resume : pause}
          className="grid size-16 place-items-center rounded-full bg-white text-primary shadow-lg active:scale-95"
          aria-label={paused ? "Retomar" : "Pausar"}
        >
          {paused ? <Play className="ml-1 size-7 fill-current" /> : <Pause className="size-7 fill-current" />}
        </button>
        <button
          disabled={stopping || !session.id}
          onClick={async () => {
            setStopping(true);
            stopNoise();
            const r = await stop();
            setStopping(false);
            if (r) onStop(r);
          }}
          className="grid size-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/60 active:scale-95"
          aria-label="Encerrar"
        >
          <Square className="size-6 fill-current" />
        </button>
      </div>

      <FocusTools sessionId={session.id} onBreak={openWellness} />
      <p className="mt-3 text-xs opacity-70">Pode navegar pelo app: o timer e o ruído continuam.</p>

      <AnimatePresence>
        {overlay && <WellnessOverlay key="w" mode={overlay} onClose={closeWellness} />}
        {breakUntil && !overlay && (
          <WellnessOverlay
            key="p"
            mode="pomodoro"
            breakMs={breakMs}
            onClose={() => {
              setBreakUntil(null);
              resume();
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

const MOODS = ["😄", "🙂", "😐", "😕", "😫"];

function Summary({ s, onClose }: { s: FocusResult; onClose: () => void }) {
  const router = useRouter();
  const [done, setDone] = useState("");
  const [hits, setHits] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [extraXp, setExtraXp] = useState<number | null>(null);
  const [saved, setSaved] = useState<FocusNote[]>([]);
  useEffect(() => {
    let alive = true;
    listFocusNotes(s.id).then((n) => alive && setSaved(n));
    return () => {
      alive = false;
    };
  }, [s.id]);
  const [pending, startTransition] = useTransition();
  const asksQuestions = s.kind === "Questões" || s.kind === "Revisão";
  const d = Number(done) || 0;
  const h = Math.min(Number(hits) || 0, d);
  const boosted = s.area === "Matemática" || s.area === "Natureza";

  const save = () =>
    startTransition(async () => {
      const xp = await saveFocusResult(s.id, { done: d || undefined, correct: d ? h : undefined, mood: mood ?? undefined, notes: notes || undefined });
      setExtraXp(xp);
      onClose();
      router.push("/");
    });

  const discard = () =>
    startTransition(async () => {
      await discardFocus(s.id);
      onClose();
    });

  return (
    <section className="card-soft p-6 text-center">
      <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
        <CairnLogo className="mx-auto size-16" />
      </motion.div>
      <p className="mt-2 text-sm text-muted-foreground">Uma pedra nova no seu cairn</p>
      <h1 className="mt-1 text-2xl font-extrabold">{fmtMin(s.minutes)} de foco</h1>
      <p className="text-muted-foreground">
        {s.subject} · {s.topic} · {s.kind}
      </p>
      <p className="mt-4 text-4xl font-extrabold text-xp">+{s.xp + (extraXp ?? 0)} XP</p>
      {boosted && <p className="text-xs text-muted-foreground">inclui +20% de Natureza/Matemática</p>}
      {s.minutes < 25 && <p className="mt-1 text-xs text-muted-foreground">Cada 25 min de foco valem +10 XP.</p>}

      {saved.length > 0 && <SavedNotes notes={saved} />}

      {asksQuestions && (
        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <label className="text-sm">
            Questões feitas
            <input
              inputMode="numeric"
              value={done}
              onChange={(e) => setDone(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-lg font-bold"
            />
          </label>
          <label className="text-sm">
            Acertos
            <input
              inputMode="numeric"
              value={hits}
              onChange={(e) => setHits(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-lg font-bold"
            />
          </label>
          {d > 0 && (
            <p className="col-span-2 text-sm text-muted-foreground">
              {d - h} erros · {Math.round((h / d) * 100)}% de acerto · +{h * 3 + (d - h)} XP
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm text-muted-foreground">Como foi a sessão?</p>
        <div className="flex justify-center gap-2 text-3xl">
          {MOODS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMood(i)}
              className={cn("rounded-full p-1 transition hover:scale-110", mood === i ? "scale-110 bg-accent" : "opacity-60 hover:opacity-100")}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas da sessão (opcional)"
        rows={2}
        className="mt-5 w-full rounded-xl border bg-background px-3 py-2 text-sm"
      />

      <button onClick={save} disabled={pending} className="mt-5 w-full rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar sessão"}
      </button>
      {s.minutes < 1 && (
        <button onClick={discard} disabled={pending} className="mt-2 text-sm text-muted-foreground underline">
          Descartar (começou sem querer)
        </button>
      )}
    </section>
  );
}

function SavedNotes({ notes }: { notes: FocusNote[] }) {
  const checks = notes.filter((n) => n.kind === "check");
  return (
    <div className="mt-5 rounded-2xl bg-muted/60 p-3 text-left text-sm">
      <p className="mb-2 font-semibold">Salvo nesta sessão</p>
      <ul className="space-y-1.5">
        {notes
          .filter((n) => n.kind !== "check")
          .map((n) => (
            <li key={n.id} className="flex items-start gap-2">
              <span>{n.kind === "insight" ? "📌" : n.kind === "audio" ? "🎙️" : "📝"}</span>
              {n.kind === "audio" ? <audio controls src={n.audio ?? undefined} className="h-8 flex-1" /> : <p className="flex-1 whitespace-pre-wrap">{n.text}</p>}
            </li>
          ))}
        {checks.length > 0 && (
          <li className="flex items-start gap-2">
            <span>☑️</span>
            <p className="flex-1">
              Checklist: {checks.filter((c) => c.done).length}/{checks.length} feitos
            </p>
          </li>
        )}
      </ul>
      <Link href="/foco/notas" className="mt-2 inline-block text-xs font-medium text-primary underline">
        Ver todas as notas do foco
      </Link>
    </div>
  );
}
