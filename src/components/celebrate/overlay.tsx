"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";
import type { CelebrationAchievement, Celebrations } from "@/server/achievements";
import { dismissCelebrations } from "@/server/achievement-actions";
import { AchIcon } from "./ach-icon";

type Slide =
  | { kind: "level"; level: number; title: string }
  | { kind: "one"; a: CelebrationAchievement }
  | { kind: "many"; list: CelebrationAchievement[] };

/** Monta a fila: nível primeiro; até 3 conquistas uma a uma, mais que isso num cartão só. */
function slidesOf(d: Celebrations): Slide[] {
  const out: Slide[] = [];
  if (d.level) out.push({ kind: "level", ...d.level });
  if (d.achievements.length > 3) out.push({ kind: "many", list: d.achievements });
  else out.push(...d.achievements.map((a) => ({ kind: "one" as const, a })));
  return out;
}

const CONFETTI_COLORS = ["#2563eb", "#f59e0b", "#ef4444", "#10b981", "#a855f7", "#38bdf8"];
/** Pseudoaleatório determinístico (render puro). */
const rand = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: rand(i, 1) * 100,
        delay: rand(i, 2) * 0.6,
        dur: 1.8 + rand(i, 3) * 1.4,
        drift: (rand(i, 4) - 0.5) * 120,
        rot: rand(i, 5) * 720 - 360,
        w: 6 + rand(i, 6) * 6,
        round: rand(i, 7) > 0.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={cn("absolute top-0 block", p.round ? "rounded-full" : "rounded-[2px]")}
          style={{ left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.w * 1.6, background: p.color }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.rot, opacity: [1, 1, 0.8, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/** Raios girando atrás do ícone. */
function Rays({ color }: { color: string }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 200 200"
      className="absolute inset-0 size-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M100 100 L92 0 L108 0 Z" fill={color} opacity={0.18} transform={`rotate(${i * 30} 100 100)`} />
      ))}
    </motion.svg>
  );
}

function StarRow({ stars, max }: { stars: number; max: number }) {
  if (max <= 1) return null;
  return (
    <div className="mt-2 flex justify-center gap-1.5 text-3xl">
      {Array.from({ length: max }, (_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.35 + i * 0.18, type: "spring", stiffness: 380, damping: 14 }}
          className={i < stars ? "text-amber-400 drop-shadow-[0_2px_0_rgb(180_83_9/0.5)]" : "text-muted-foreground/25"}
        >
          ★
        </motion.span>
      ))}
    </div>
  );
}

function XpPill({ xp, delay = 0.5 }: { xp: number; delay?: number }) {
  return (
    <motion.span
      initial={{ y: 12, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 16 }}
      className="inline-flex items-center gap-1 rounded-full bg-xp/15 px-3 py-1 text-sm font-extrabold text-xp"
    >
      +{xp} XP
    </motion.span>
  );
}

function LevelSlide({ level, title }: { level: number; title: string }) {
  const next = LEVELS.find((l) => l.level === level + 1);
  return (
    <>
      <div className="relative mx-auto grid size-44 place-items-center">
        <Rays color="#a855f7" />
        <motion.div
          initial={{ scale: 0.2, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12 }}
          className="relative grid size-28 place-items-center rounded-[2rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-xl ring-4 ring-white/70 dark:ring-white/20"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-90">Nível</span>
          <span className="-mt-3 text-6xl font-black tabular-nums leading-none">{level}</span>
        </motion.div>
      </div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-primary">Parabéns!</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight">Você subiu para o nível {level}</h2>
      <p className="mt-1 text-lg font-bold text-xp">{title}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {next ? `Próximo: ${next.title}, com ${next.xp.toLocaleString("pt-BR")} XP. Bora!` : "Nível máximo. Você é lenda!"}
      </p>
    </>
  );
}

function OneSlide({ a }: { a: CelebrationAchievement }) {
  return (
    <>
      <div className="relative mx-auto grid size-44 place-items-center">
        <Rays color="#f59e0b" />
        <motion.div
          initial={{ scale: 0.2, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 11 }}
          className="relative grid size-28 place-items-center rounded-full bg-gradient-to-b from-amber-100 to-amber-300 shadow-xl ring-4 ring-amber-400/60 dark:from-amber-400/30 dark:to-amber-600/40"
        >
          <AchIcon icon={a.icon} size={64} />
        </motion.div>
      </div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Conquista desbloqueada</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight">{a.name}</h2>
      <StarRow stars={a.stars} max={a.maxTier} />
      <p className="mt-2 text-sm text-muted-foreground">{a.goal}</p>
      <div className="mt-3">
        <XpPill xp={a.xp} />
      </div>
    </>
  );
}

function ManySlide({ list }: { list: CelebrationAchievement[] }) {
  const xp = list.reduce((s, a) => s + a.xp, 0);
  return (
    <>
      <motion.div
        initial={{ scale: 0.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 12 }}
        className="mx-auto grid size-20 place-items-center"
      >
        <AchIcon icon="emoji/trofeu.webp" size={72} />
      </motion.div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Que sequência!</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight">{list.length} conquistas novas</h2>
      <ul className="no-scrollbar mt-4 grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto text-left sm:grid-cols-3">
        {list.map((a, i) => (
          <motion.li
            key={`${a.key}:${a.tier}`}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + Math.min(i, 12) * 0.06 }}
            className="card-inner flex items-center gap-2 p-2"
          >
            <AchIcon icon={a.icon} size={28} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold">{a.name}</span>
              <span className="block text-[11px] text-amber-500">{a.stars ? "★".repeat(a.stars) : "★"}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-4">
        <XpPill xp={xp} delay={0.4} />
      </div>
    </>
  );
}

export function CelebrateOverlay({ data }: { data: Celebrations }) {
  const slides = useMemo(() => slidesOf(data), [data]);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(slides.length > 0);
  const [, start] = useTransition();
  const reduce = useReducedMotion();

  const close = () => {
    setOpen(false);
    start(async () => {
      await dismissCelebrations(data.achievements.map((a) => ({ key: a.key, tier: a.tier })));
    });
  };
  const last = i >= slides.length - 1;
  const next = () => (last ? close() : setI(i + 1));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const s = slides[i];
  return (
    <AnimatePresence>
      {open && s && (
        <motion.div
          key="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Comemoração"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          {!reduce && <Confetti key={i} />}
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -16 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="card-soft relative w-full max-w-sm overflow-hidden px-6 pb-6 pt-4 text-center"
            >
              <button
                aria-label="Fechar"
                onClick={close}
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
              {s.kind === "level" ? <LevelSlide level={s.level} title={s.title} /> : s.kind === "one" ? <OneSlide a={s.a} /> : <ManySlide list={s.list} />}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  autoFocus
                  onClick={next}
                  className="h-11 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_4px_0_0_oklch(0.42_0.2_264)] transition active:translate-y-0.5 active:shadow-none"
                >
                  {last ? "Continuar" : "Próximo"}
                </button>
                {last && s.kind !== "level" && (
                  <Link href="/conquistas" onClick={close} className="text-sm font-semibold text-primary hover:underline">
                    Ver todas as conquistas
                  </Link>
                )}
              </div>
              {slides.length > 1 && (
                <div className="mt-3 flex justify-center gap-1.5">
                  {slides.map((_, j) => (
                    <span key={j} className={cn("h-1.5 rounded-full transition-all", j === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
