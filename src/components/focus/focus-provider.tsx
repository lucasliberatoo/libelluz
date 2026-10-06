"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type StudyKind = "Teoria" | "Questões" | "Revisão" | "Videoaula" | "Flashcards" | "Redação";
export type FocusMethod = "Cronometrado" | "Pomodoro" | "Livre";

export type FocusConfig = {
  area: string;
  subject: string;
  topic: string;
  kind: StudyKind;
  method: FocusMethod;
  minutes: number; // ignorado no Livre
};

export type FocusSession = FocusConfig & {
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number; // tempo pausado é descartado
};

type Ctx = {
  session: FocusSession | null;
  now: number;
  elapsedMs: number;
  start: (c: FocusConfig) => void;
  pause: () => void;
  resume: () => void;
  stop: () => FocusSession | null;
};

const FocusCtx = createContext<Ctx | null>(null);
const KEY = "libelluz.focus";

function load(): FocusSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusSession) : null;
  } catch {
    return null;
  }
}

function save(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function elapsedOf(s: FocusSession, now: number) {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedMs);
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSession(load());
  }, []);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  const update = useCallback((s: FocusSession | null) => {
    setSession(s);
    save(s);
    setNow(Date.now());
  }, []);

  const start = useCallback(
    (c: FocusConfig) => update({ ...c, startedAt: Date.now(), pausedAt: null, pausedMs: 0 }),
    [update],
  );
  const pause = useCallback(() => {
    if (session && !session.pausedAt) update({ ...session, pausedAt: Date.now() });
  }, [session, update]);
  const resume = useCallback(() => {
    if (session?.pausedAt)
      update({ ...session, pausedMs: session.pausedMs + (Date.now() - session.pausedAt), pausedAt: null });
  }, [session, update]);
  const stop = useCallback(() => {
    const s = session ? { ...session, pausedAt: session.pausedAt ?? Date.now() } : null;
    update(null);
    return s;
  }, [session, update]);

  const elapsedMs = session ? elapsedOf(session, now) : 0;

  return (
    <FocusCtx.Provider value={{ session, now, elapsedMs, start, pause, resume, stop }}>
      {children}
    </FocusCtx.Provider>
  );
}

export function useFocus() {
  const c = useContext(FocusCtx);
  if (!c) throw new Error("useFocus fora do FocusProvider");
  return c;
}

export function fmtClock(ms: number) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
