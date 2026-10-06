"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckSquare,
  Droplet,
  Headphones,
  Infinity as InfinityIcon,
  Mic,
  NotebookPen,
  Pause,
  Pin,
  Play,
  Square,
  Timer,
  Wind,
  PersonStanding,
  Apple,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CairnLogo, Foguinho } from "@/components/brand";
import { tree, reviewsToday, tasksToday } from "@/lib/mock";
import {
  fmtClock,
  type FocusConfig,
  type FocusMethod,
  type FocusSession,
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

export function FocusScreen() {
  const { session } = useFocus();
  const [summary, setSummary] = useState<FocusSession | null>(null);

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
            <Configure />
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

function Configure() {
  const { start } = useFocus();
  const first = tasksToday[0];
  const [area, setArea] = useState<string>(first.area);
  const subjects = tree.find((a) => a.area === area)?.subjects ?? [];
  const [subject, setSubject] = useState<string>(first.subject);
  const topics = subjects.find((s) => s.name === subject)?.topics ?? [];
  const [topic, setTopic] = useState<string>(first.topic);
  const [kind, setKind] = useState<StudyKind>("Teoria");
  const [method, setMethod] = useState<FocusMethod>("Cronometrado");
  const [minutes, setMinutes] = useState(60);

  const pick = (c: Partial<FocusConfig>) => {
    if (c.area) setArea(c.area);
    if (c.subject) setSubject(c.subject);
    if (c.topic) setTopic(c.topic);
    if (c.kind) setKind(c.kind);
  };

  const suggestions = [
    ...reviewsToday.map((r) => ({ label: `↻ ${r.topic}`, area: r.area, topic: r.topic, kind: "Revisão" as StudyKind })),
    ...tasksToday.slice(0, 3).map((t) => ({ label: t.topic, area: t.area, subject: t.subject, topic: t.topic })),
  ];

  const select = "w-full rounded-xl border-0 bg-white/15 px-3 py-2.5 text-sm font-medium text-white outline-none ring-1 ring-white/30 focus:ring-2 focus:ring-white [&>option]:text-foreground";

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-b from-primary to-blue-500 p-5 text-white shadow-xl md:p-7">
      <h1 className="text-center text-xl font-bold">Modo Foco</h1>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-80">Sugestões de hoje</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {suggestions.map((s) => {
            const subj =
              "subject" in s && s.subject
                ? s.subject
                : tree.flatMap((a) => a.subjects).find((x) => x.topics.includes(s.topic))?.name;
            return (
              <Chip key={s.label} active={topic === s.topic} onClick={() => pick({ ...s, subject: subj })}>
                {s.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          className={select}
          value={area}
          onChange={(e) => {
            const a = tree.find((x) => x.area === e.target.value)!;
            setArea(a.area);
            setSubject(a.subjects[0].name);
            setTopic(a.subjects[0].topics[0]);
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
            setTopic(subjects.find((s) => s.name === e.target.value)!.topics[0]);
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
        onClick={() => start({ area, subject, topic, kind, method, minutes: method === "Pomodoro" ? 25 : minutes })}
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
        onClick={() => start({ area, subject, topic, kind, method, minutes: method === "Pomodoro" ? 25 : minutes })}
        className="mt-6 w-full rounded-full bg-white py-3.5 text-lg font-bold text-primary shadow-lg transition hover:brightness-95 active:scale-[0.98]"
      >
        Começar Estudo
      </button>
    </section>
  );
}

const TOOLS = [
  { icon: Droplet, label: "Água" },
  { icon: Wind, label: "Respirar" },
  { icon: PersonStanding, label: "Alongar" },
  { icon: Headphones, label: "Ruído" },
  { icon: NotebookPen, label: "Nota" },
  { icon: Mic, label: "Áudio" },
  { icon: CheckSquare, label: "Checklist" },
  { icon: Pin, label: "Insight" },
];

function Running({ onStop }: { onStop: (s: FocusSession) => void }) {
  const { session, elapsedMs, pause, resume, stop } = useFocus();
  const [breathing, setBreathing] = useState(false);
  if (!session) return null;
  const free = session.method === "Livre";
  const target = (free ? 50 : session.minutes) * 60_000;
  const pct = Math.min(1, elapsedMs / target);
  const remaining = Math.max(0, target - elapsedMs);
  const r = 120;
  const c = 2 * Math.PI * r;
  const paused = !!session.pausedAt;

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
            <p className="text-5xl font-bold tabular-nums">{fmtClock(free ? elapsedMs : remaining)}</p>
            <p className="mt-1 text-sm opacity-80">
              {paused ? "pausado (não conta)" : free ? "modo livre" : `${session.method} · ${fmtClock(elapsedMs)} feitos`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={paused ? resume : pause}
          className="grid size-16 place-items-center rounded-full bg-white text-primary shadow-lg active:scale-95"
          aria-label={paused ? "Retomar" : "Pausar"}
        >
          {paused ? <Play className="ml-1 size-7 fill-current" /> : <Pause className="size-7 fill-current" />}
        </button>
        <button
          onClick={() => {
            const s = stop();
            if (s) onStop(s);
          }}
          className="grid size-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/60 active:scale-95"
          aria-label="Encerrar"
        >
          <Square className="size-6 fill-current" />
        </button>
      </div>

      <div className="no-scrollbar -mx-5 mt-7 flex justify-start gap-1 overflow-x-auto px-5 md:justify-center">
        {TOOLS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => label === "Respirar" && setBreathing(true)}
            className="flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] opacity-90 hover:bg-white/10"
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs opacity-70">Pode navegar pelo app: o timer continua rodando.</p>

      <AnimatePresence>{breathing && <BreathOverlay onClose={() => setBreathing(false)} />}</AnimatePresence>
    </section>
  );
}

function BreathOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-b from-sky-500 to-indigo-600 p-6 text-white"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold">Vamos desacelerar e respirar</h2>
        <p className="mt-1 opacity-85">Respiração quadrada: 4s inspira · 4s segura · 4s solta · 4s segura</p>
        <motion.div
          animate={{ scale: [1, 1.35, 1.35, 1, 1] }}
          transition={{ duration: 16, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto my-10 grid size-40 place-items-center rounded-full bg-white/20"
        >
          <Foguinho stage={4} mood="sleepy" className="size-24" />
        </motion.div>
        <button onClick={onClose} className="rounded-full bg-white/20 px-6 py-2 font-semibold">
          Voltar ao foco
        </button>
      </div>
    </motion.div>
  );
}

function Summary({ s, onClose }: { s: FocusSession; onClose: () => void }) {
  const ms = Math.max(0, (s.pausedAt ?? Date.now()) - s.startedAt - s.pausedMs);
  const min = Math.floor(ms / 60000);
  const [done, setDone] = useState("");
  const [hits, setHits] = useState("");
  const asksQuestions = s.kind === "Questões" || s.kind === "Revisão";
  const d = Number(done) || 0;
  const h = Math.min(Number(hits) || 0, d);
  const bonus = s.area === "Matemática" || s.area === "Natureza" ? 1.2 : 1;
  const xp = Math.round((Math.floor(min / 25) * 10 + h * 3 + (d - h) * 1) * bonus);

  return (
    <section className="card-soft p-6 text-center">
      <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
        <CairnLogo className="mx-auto size-16 text-primary" />
      </motion.div>
      <p className="mt-2 text-sm text-muted-foreground">Uma pedra nova no seu cairn</p>
      <h1 className="mt-1 text-2xl font-extrabold">{fmtClock(ms)} de foco</h1>
      <p className="text-muted-foreground">
        {s.subject} · {s.topic} · {s.kind}
      </p>
      <p className="mt-4 text-4xl font-extrabold text-xp">+{xp} XP</p>
      {bonus > 1 && <p className="text-xs text-muted-foreground">inclui +20% de Natureza/Matemática</p>}

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
              {d - h} erros · {Math.round((h / d) * 100)}% de acerto
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm text-muted-foreground">Como foi a sessão?</p>
        <div className="flex justify-center gap-2 text-3xl">
          {["😄", "🙂", "😐", "😕", "😫"].map((m) => (
            <button key={m} className="rounded-full p-1 opacity-70 hover:scale-110 hover:opacity-100">
              {m}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onClose} className="mt-6 w-full rounded-full bg-primary py-3 font-bold text-primary-foreground">
        Salvar sessão
      </button>
    </section>
  );
}
