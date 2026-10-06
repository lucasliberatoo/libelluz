"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { pauseFocus, resumeFocus, startFocus, stopFocus, type FocusResult } from "@/server/actions";
import type { ActiveFocus } from "@/server/queries";

export type StudyKind = "Teoria" | "Questões" | "Revisão" | "Videoaula" | "Flashcards" | "Redação";
export type FocusMethod = "Cronometrado" | "Pomodoro" | "Livre";

export type FocusConfig = {
  area: string;
  subject: string;
  topic: string;
  kind: StudyKind;
  method: FocusMethod;
  minutes: number; // no Livre, só referência para sugerir pausa
};

/** Sessão em andamento. Os timestamps ficam no servidor: sobrevive a recarregar/fechar. */
export type FocusSession = Omit<ActiveFocus, "kind" | "method"> & { kind: StudyKind; method: FocusMethod };

type Ctx = {
  session: FocusSession | null;
  now: number;
  elapsedMs: number;
  start: (c: FocusConfig) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<FocusResult | null>;
};

const FocusCtx = createContext<Ctx | null>(null);

export function elapsedOf(s: Pick<FocusSession, "startedAt" | "pausedAt" | "pausedMs">, now: number) {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedMs);
}

export function FocusProvider({
  initial,
  serverNow,
  children,
}: {
  initial: ActiveFocus | null;
  /** Mesmo "agora" no servidor e no cliente para não dar erro de hidratação. */
  serverNow: number;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<FocusSession | null>(initial as FocusSession | null);
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!session) return;
    const tick = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(tick);
      clearInterval(id);
    };
  }, [session]);

  const start = useCallback(async (c: FocusConfig) => {
    const t = Date.now();
    setNow(t);
    setSession({ ...c, id: "", startedAt: t, pausedAt: null, pausedMs: 0 });
    const s = await startFocus(c);
    setSession(s as FocusSession);
  }, []);

  const pause = useCallback(() => {
    if (!session || session.pausedAt) return;
    setSession({ ...session, pausedAt: Date.now() });
    if (session.id) void pauseFocus(session.id);
  }, [session]);

  const resume = useCallback(() => {
    if (!session?.pausedAt) return;
    const t = Date.now();
    setNow(t);
    setSession({ ...session, pausedMs: session.pausedMs + (t - session.pausedAt), pausedAt: null });
    if (session.id) void resumeFocus(session.id);
  }, [session]);

  const stop = useCallback(async () => {
    if (!session?.id) return null;
    const id = session.id;
    setSession(null);
    return stopFocus(id);
  }, [session]);

  const elapsedMs = session ? elapsedOf(session, now) : 0;

  return <FocusCtx.Provider value={{ session, now, elapsedMs, start, pause, resume, stop }}>{children}</FocusCtx.Provider>;
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
