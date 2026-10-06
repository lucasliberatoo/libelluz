"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckSquare,
  Droplet,
  Headphones,
  Mic,
  NotebookPen,
  PersonStanding,
  Pin,
  Square,
  Trash2,
  Wind,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Foguinho } from "@/components/brand";
import {
  addFocusNote,
  addWaterCup,
  addWellnessHeat,
  deleteFocusNote,
  listFocusNotes,
  toggleFocusCheck,
  type FocusNote,
} from "@/server/focus-tools";
import { noiseState, playNoise, setNoiseVolume, stopNoise, subscribeNoise, type NoiseKind } from "./noise";

type Panel = "water" | "breath" | "stretch" | "noise" | "note" | "audio" | "check" | "insight";

const TOOLS: { id: Panel; icon: typeof Droplet; label: string }[] = [
  { id: "water", icon: Droplet, label: "Água" },
  { id: "breath", icon: Wind, label: "Respirar" },
  { id: "stretch", icon: PersonStanding, label: "Alongar" },
  { id: "noise", icon: Headphones, label: "Ruído" },
  { id: "note", icon: NotebookPen, label: "Nota" },
  { id: "audio", icon: Mic, label: "Áudio" },
  { id: "check", icon: CheckSquare, label: "Checklist" },
  { id: "insight", icon: Pin, label: "Insight" },
];

export function useNoise() {
  return useSyncExternalStore(subscribeNoise, noiseState, () => null);
}

/** Barra de atalhos da sessão de foco + painéis. */
export function FocusTools({ sessionId, onBreak }: { sessionId: string; onBreak: (b: "breath" | "stretch") => void }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notes, setNotes] = useState<FocusNote[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const noise = useNoise();

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    listFocusNotes(sessionId).then((n) => alive && setNotes(n));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const counts: Partial<Record<Panel, number>> = {
    note: notes.filter((n) => n.kind === "note").length,
    insight: notes.filter((n) => n.kind === "insight").length,
    audio: notes.filter((n) => n.kind === "audio").length,
    check: notes.filter((n) => n.kind === "check" && !n.done).length,
  };

  const click = async (id: Panel) => {
    if (id === "water") {
      setToast("💧 Bebendo água…");
      const r = await addWaterCup();
      setToast(`💧 +1 copo · ${r.cups}/${r.goal} hoje`);
      return;
    }
    if (id === "breath" || id === "stretch") return onBreak(id);
    setPanel(panel === id ? null : id);
  };

  const add = async (kind: FocusNote["kind"], text: string, audio?: string) => {
    if (!sessionId) return;
    const n = await addFocusNote(sessionId, kind === "audio" ? { kind, text, audio: audio! } : { kind, text });
    setNotes((l) => [...l, n]);
  };
  const remove = (id: string) => {
    setNotes((l) => l.filter((n) => n.id !== id));
    void deleteFocusNote(id);
  };
  const toggle = (id: string) => {
    setNotes((l) => l.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
    void toggleFocusCheck(id);
  };

  return (
    <>
      <div className="no-scrollbar -mx-5 mt-7 flex justify-start gap-1 overflow-x-auto px-5 md:justify-center">
        {TOOLS.map(({ id, icon: Icon, label }) => {
          const active = panel === id || (id === "noise" && !!noise);
          return (
            <button
              key={id}
              onClick={() => click(id)}
              aria-label={label}
              className={cn(
                "relative flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] opacity-90 hover:bg-white/10",
                active && "bg-white/20 opacity-100",
              )}
            >
              <Icon className="size-5" />
              {label}
              {!!counts[id] && (
                <span className="absolute right-1 top-0.5 grid size-4 place-items-center rounded-full bg-white text-[10px] font-bold text-primary">
                  {counts[id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 w-fit rounded-full bg-white/20 px-3 py-1 text-sm font-medium"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

        {panel && (
          <motion.div
            key={panel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl bg-white p-4 text-left text-foreground shadow-lg dark:bg-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">{TOOLS.find((t) => t.id === panel)!.label}</h3>
                <button onClick={() => setPanel(null)} aria-label="Fechar" className="rounded-full p-1 hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
              {panel === "noise" && <NoisePanel />}
              {(panel === "note" || panel === "insight") && (
                <TextNotes
                  kind={panel}
                  notes={notes.filter((n) => n.kind === panel)}
                  onAdd={(t) => add(panel, t)}
                  onRemove={remove}
                />
              )}
              {panel === "check" && (
                <Checklist items={notes.filter((n) => n.kind === "check")} onAdd={(t) => add("check", t)} onToggle={toggle} onRemove={remove} />
              )}
              {panel === "audio" && (
                <AudioNotes notes={notes.filter((n) => n.kind === "audio")} onAdd={(a, label) => add("audio", label, a)} onRemove={remove} />
              )}
            </div>
          </motion.div>
        )}
    </>
  );
}

/* ---------- Ruído ---------- */

const NOISES: { k: NoiseKind; label: string; hint: string }[] = [
  { k: "branco", label: "Branco", hint: "chiado de TV, abafa conversas" },
  { k: "rosa", label: "Rosa", hint: "mais suave, tipo chuva" },
  { k: "marrom", label: "Marrom", hint: "grave, tipo cachoeira" },
];

function NoisePanel() {
  const noise = useNoise();
  const volume = noise?.volume ?? 0.4;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {NOISES.map((n) => (
          <button
            key={n.k}
            onClick={() => playNoise(n.k, volume)}
            className={cn(
              "rounded-xl border p-2 text-center transition",
              noise?.kind === n.k ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <span className="block font-semibold">{n.label}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">{n.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setNoiseVolume(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Volume do ruído"
        />
        {noise && (
          <button onClick={stopNoise} className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
            Parar
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Continua tocando se você navegar pelo app. Use fone para render mais.</p>
    </div>
  );
}

/* ---------- Nota rápida e insight ---------- */

function AddLine({ placeholder, onAdd, multiline }: { placeholder: string; onAdd: (t: string) => Promise<void> | void; multiline?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    await onAdd(t);
    setText("");
    setBusy(false);
  };
  return (
    <div className="flex items-end gap-2">
      {multiline ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
          placeholder={placeholder}
          rows={2}
          autoFocus
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        />
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder={placeholder}
          autoFocus
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        />
      )}
      <button onClick={submit} disabled={busy || !text.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Salvar
      </button>
    </div>
  );
}

function TextNotes({ kind, notes, onAdd, onRemove }: { kind: "note" | "insight"; notes: FocusNote[]; onAdd: (t: string) => Promise<void>; onRemove: (id: string) => void }) {
  return (
    <div>
      <AddLine
        multiline
        placeholder={kind === "note" ? "Anote algo rápido sem perder o foco…" : "O que você entendeu de importante? 📌"}
        onAdd={onAdd}
      />
      <ul className="mt-3 space-y-2">
        {notes.map((n) => (
          <li key={n.id} className={cn("group flex items-start gap-2 rounded-xl p-2.5 text-sm", kind === "insight" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-muted")}>
            <span>{kind === "insight" ? "📌" : "📝"}</span>
            <p className="flex-1 whitespace-pre-wrap">{n.text}</p>
            <button onClick={() => onRemove(n.id)} aria-label="Apagar" className="text-muted-foreground opacity-60 hover:opacity-100">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Fica salvo na sessão e em Mais → Notas do foco.</p>
    </div>
  );
}

/* ---------- Checklist ---------- */

function Checklist({ items, onAdd, onToggle, onRemove }: { items: FocusNote[]; onAdd: (t: string) => Promise<void>; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div>
      <AddLine placeholder="Ex.: resumo do capítulo 3 (Enter)" onAdd={onAdd} />
      <ul className="mt-3 space-y-1">
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
            <button
              onClick={() => onToggle(n.id)}
              aria-label={n.done ? "Desmarcar" : "Marcar"}
              className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2", n.done ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/40")}
            >
              {n.done && "✓"}
            </button>
            <span className={cn("flex-1 text-sm", n.done && "text-muted-foreground line-through")}>{n.text}</span>
            <button onClick={() => onRemove(n.id)} aria-label="Apagar" className="text-muted-foreground opacity-60 hover:opacity-100">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {items.filter((i) => i.done).length}/{items.length} feitos
        </p>
      )}
    </div>
  );
}

/* ---------- Nota em áudio ---------- */

const MAX_AUDIO_S = 180;

function AudioNotes({ notes, onAdd, onRemove }: { notes: FocusNote[]; onAdd: (dataUrl: string, label: string) => Promise<void>; onRemove: (id: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);

  useEffect(() => {
    if (rec && secs >= MAX_AUDIO_S) rec.stop();
  }, [rec, secs]);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: r.mimeType });
        const dataUrl = await new Promise<string>((res) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.readAsDataURL(blob);
        });
        setSaving(true);
        try {
          const now = new Date();
          await onAdd(dataUrl, `Áudio das ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`);
        } catch {
          setErr("Não consegui salvar o áudio.");
        }
        setSaving(false);
      };
      r.start(1000);
      setSecs(0);
      setRec(r);
    } catch {
      setErr("Sem acesso ao microfone. Libere a permissão no navegador.");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        {rec ? (
          <button onClick={() => rec.stop()} className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 font-semibold text-white">
            <Square className="size-4 fill-current" /> Parar · {secs}s
          </button>
        ) : (
          <button onClick={start} disabled={saving} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60">
            <Mic className="size-4" /> {saving ? "Salvando…" : "Gravar"}
          </button>
        )}
        <span className="text-xs text-muted-foreground">até 3 min</span>
      </div>
      {rec && <span className="mt-2 inline-block size-2 animate-pulse rounded-full bg-red-500" />}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <ul className="mt-3 space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="flex items-center gap-2">
            <audio controls src={n.audio ?? undefined} className="h-9 flex-1" />
            <button onClick={() => onRemove(n.id)} aria-label="Apagar" className="text-muted-foreground opacity-60 hover:opacity-100">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Pausas de bem-estar (respirar, alongar, pausa do Pomodoro) ---------- */

const STRETCHES = [
  { t: "Pescoço", d: "Incline a cabeça devagar para cada lado, 3 vezes.", s: 30 },
  { t: "Ombros", d: "Gire os ombros para trás em círculos grandes.", s: 30 },
  { t: "Punhos e dedos", d: "Estique os braços e puxe os dedos para trás, um de cada vez.", s: 30 },
  { t: "Costas", d: "Em pé, entrelace as mãos acima da cabeça e estique para cima.", s: 30 },
  { t: "Olhos", d: "Olhe para algo a 6 metros por 20 segundos.", s: 20 },
];

export function WellnessOverlay({
  mode,
  breakMs,
  onClose,
}: {
  mode: "breath" | "stretch" | "pomodoro";
  /** Pausa do Pomodoro: tempo restante em ms */
  breakMs?: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"breath" | "stretch" | "water">(mode === "stretch" ? "stretch" : "breath");
  const [drank, setDrank] = useState<string | null>(null);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-gradient-to-b from-sky-500 to-indigo-600 p-6 text-white"
    >
      <div className="w-full max-w-md text-center">
        {mode === "pomodoro" && (
          <>
            <p className="text-sm uppercase tracking-wide opacity-80">Pausa do Pomodoro</p>
            <p className="text-5xl font-bold tabular-nums">{fmt(breakMs ?? 0)}</p>
            <div className="mt-4 flex justify-center gap-2">
              {(["breath", "stretch", "water"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === t ? "bg-white text-primary" : "bg-white/15")}>
                  {t === "breath" ? "🌬️ Respirar" : t === "stretch" ? "🧘 Alongar" : "💧 Água"}
                </button>
              ))}
            </div>
          </>
        )}
        {tab === "breath" && <Breath />}
        {tab === "stretch" && <Stretch />}
        {tab === "water" && (
          <div className="my-8">
            <h2 className="text-2xl font-bold">Bebe uma água aí</h2>
            <p className="mt-1 opacity-85">Seu cérebro agradece. O foguinho também.</p>
            <div className="mx-auto my-8 grid size-32 place-items-center rounded-full bg-white/20 text-6xl">💧</div>
            <button
              onClick={async () => {
                const r = await addWaterCup();
                setDrank(`+1 copo · ${r.cups}/${r.goal} hoje`);
              }}
              className="rounded-full bg-white px-5 py-2 font-semibold text-primary"
            >
              {drank ?? "Bebi um copo"}
            </button>
          </div>
        )}
        <button onClick={onClose} className="mt-2 rounded-full bg-white/20 px-6 py-2 font-semibold">
          {mode === "pomodoro" ? "Pular pausa e voltar" : "Voltar ao foco"}
        </button>
      </div>
    </motion.div>
  );
}

function fmt(ms: number) {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Dá o calor da pausa uma vez, quando `ready` vira true. */
function useWellnessHeat(kind: "breath" | "stretch", ready: boolean) {
  const [heat, setHeat] = useState<number | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    addWellnessHeat(kind).then(setHeat, () => {});
  }, [kind, ready]);
  return heat;
}

function HeatToast({ heat }: { heat: number | null }) {
  if (heat === null) return null;
  return (
    <p className="mx-auto mt-3 w-fit rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
      {heat > 0 ? `+${heat} de calor para o foguinho 🌡️` : "Calor desta pausa já ganho hoje 🌡️"}
    </p>
  );
}

const BREATH_STEPS = ["Inspira", "Segura", "Solta", "Segura"];

function Breath() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), 4000);
    return () => clearInterval(id);
  }, []);
  // um ciclo completo (16 s) aquece o foguinho
  const heat = useWellnessHeat("breath", step >= 4);
  return (
    <div className="my-6">
      <h2 className="text-2xl font-bold">Vamos desacelerar e respirar</h2>
      <p className="mt-1 opacity-85">Respiração quadrada: 4s inspira · 4s segura · 4s solta · 4s segura</p>
      <motion.div
        animate={{ scale: [1, 1.35, 1.35, 1, 1] }}
        transition={{ duration: 16, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto my-8 grid size-40 place-items-center rounded-full bg-white/20"
      >
        <Foguinho stage={4} mood="sleepy" className="size-24" />
      </motion.div>
      <p className="text-2xl font-bold">{BREATH_STEPS[step % 4]}</p>
      <p className="text-sm opacity-75">ciclo {Math.floor(step / 4) + 1}</p>
      <HeatToast heat={heat} />
    </div>
  );
}

function Stretch() {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(STRETCHES[0].s);
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left > 0) return;
    const t = setTimeout(() => {
      if (i < STRETCHES.length - 1) {
        setI(i + 1);
        setLeft(STRETCHES[i + 1].s);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [left, i]);
  const s = STRETCHES[i];
  const finished = i === STRETCHES.length - 1 && left <= 0;
  const heat = useWellnessHeat("stretch", finished);
  return (
    <div className="my-6">
      <h2 className="text-2xl font-bold">Hora de alongar</h2>
      <p className="mt-1 opacity-85">
        {i + 1} de {STRETCHES.length}
      </p>
      <motion.div
        key={i}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-auto my-6 grid size-40 place-items-center rounded-full bg-white/20"
      >
        <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <Foguinho stage={1} mood="happy" className="size-24" />
        </motion.div>
      </motion.div>
      {finished ? (
        <>
          <p className="text-xl font-bold">Prontinho! Corpo agradece 🙌</p>
          <HeatToast heat={heat} />
        </>
      ) : (
        <>
          <p className="text-xl font-bold">{s.t}</p>
          <p className="mx-auto mt-1 max-w-xs opacity-90">{s.d}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums">{Math.max(0, left)}s</p>
          <button
            onClick={() => {
              if (i < STRETCHES.length - 1) {
                setI(i + 1);
                setLeft(STRETCHES[i + 1].s);
              } else setLeft(0);
            }}
            className="mt-2 text-sm underline opacity-80"
          >
            Próximo
          </button>
        </>
      )}
    </div>
  );
}
