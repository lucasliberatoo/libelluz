// Mapa de progresso: regras puras (progresso por fase, alertas e sugestões de T/P/D).
import { addDays } from "./day";
import { PHASES, type Phase } from "./template-tree";

export const MAPA_XP = { mastery: 20, topicDone: 50, phaseDone: 500 } as const;

export type Flag = "theory" | "practice" | "mastery";
export const FLAGS: Flag[] = ["theory", "practice", "mastery"];
export const FLAG_LABEL: Record<Flag, string> = { theory: "Teoria", practice: "Prática", mastery: "Domínio" };

export type MapSkill = {
  id: string;
  name: string;
  phase: string | null;
  relevance: string | null;
  theory: boolean;
  practice: boolean;
  mastery: boolean;
};

export type MapTopic = MapSkill & {
  subjectId: string;
  subject: string;
  area: string;
  skills: MapSkill[];
  minutes: number;
  questions: number;
  correct: number;
  lastDay: string | null;
};

export type MapSession = {
  topicId: string;
  day: string;
  kind: string;
  minutes: number;
  done: number;
  correct: number;
};

export const isPhase = (p: string | null | undefined): p is Phase => !!p && (PHASES as readonly string[]).includes(p);

/** Unidades de progresso: cada habilidade, ou o próprio tópico quando ele não tem habilidades. */
export function units(t: MapTopic): MapSkill[] {
  return t.skills.length ? t.skills.map((s) => ({ ...s, phase: s.phase ?? t.phase })) : [t];
}

/** Fração (0–1) das unidades do tópico com a marca dada. */
export function topicShare(t: MapTopic, flag: Flag, phase?: string) {
  const u = units(t).filter((s) => !phase || s.phase === phase);
  return u.length ? u.filter((s) => s[flag]).length / u.length : 0;
}

export const topicComplete = (t: MapTopic) => units(t).every((s) => s.mastery);

export type PhaseProgress = { phase: Phase; total: number; mastered: number; theory: number; practice: number };

export function phaseProgress(topics: MapTopic[]): PhaseProgress[] {
  return PHASES.map((phase) => {
    const u = topics.flatMap(units).filter((s) => s.phase === phase);
    return {
      phase,
      total: u.length,
      mastered: u.filter((s) => s.mastery).length,
      theory: u.filter((s) => s.theory).length,
      practice: u.filter((s) => s.practice).length,
    };
  });
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/* ---------- Alertas ---------- */

export type Alert = { tone: "red" | "yellow" | "green"; text: string; topicId?: string };

const acc = (l: MapSession[]) => {
  const done = l.reduce((a, s) => a + s.done, 0);
  const correct = l.reduce((a, s) => a + s.correct, 0);
  return { done, correct, pct: done ? Math.round((correct / done) * 100) : null };
};

export const QUESTION_KINDS = ["Questões", "Revisão"];
export const THEORY_KINDS = ["Teoria", "Videoaula"];

/**
 * 🔴 tópico estudado há 14+ dias sem voltar; 🟡 acerto abaixo de 60% nos últimos 30 dias (10+ questões);
 * 🟢 disciplina com acerto subindo 10+ pontos (últimos 14 dias contra os 14–60 anteriores).
 */
export function computeAlerts(topics: MapTopic[], sessions: MapSession[], today: string, max = 6): Alert[] {
  const byTopic = new Map<string, MapSession[]>();
  for (const s of sessions) (byTopic.get(s.topicId) ?? byTopic.set(s.topicId, []).get(s.topicId)!).push(s);

  const red: (Alert & { n: number })[] = [];
  const yellow: (Alert & { n: number })[] = [];
  for (const t of topics) {
    if (t.lastDay) {
      const d = daysBetween(t.lastDay, today);
      if (d >= 14) red.push({ tone: "red", text: `${t.name} há ${d} dias sem revisão`, topicId: t.id, n: d });
    }
    const recent = acc((byTopic.get(t.id) ?? []).filter((s) => s.day >= addDays(today, -30)));
    if (recent.done >= 10 && recent.pct! < 60)
      yellow.push({ tone: "yellow", text: `Errando mais em ${t.name} (${recent.pct}% de acerto)`, topicId: t.id, n: -recent.pct! });
  }

  const green: (Alert & { n: number })[] = [];
  const bySubject = new Map<string, { name: string; list: MapSession[] }>();
  for (const t of topics) {
    const l = byTopic.get(t.id);
    if (!l) continue;
    const e = bySubject.get(t.subjectId) ?? bySubject.set(t.subjectId, { name: t.subject, list: [] }).get(t.subjectId)!;
    e.list.push(...l);
  }
  for (const { name, list } of bySubject.values()) {
    const now = acc(list.filter((s) => s.day > addDays(today, -14)));
    const before = acc(list.filter((s) => s.day <= addDays(today, -14) && s.day > addDays(today, -60)));
    if (now.done >= 5 && before.done >= 5 && now.pct! - before.pct! >= 10)
      green.push({ tone: "green", text: `${name} evoluindo (${before.pct}% → ${now.pct}%)`, n: now.pct! - before.pct! });
  }

  const sort = (l: (Alert & { n: number })[]): Alert[] => l.sort((a, b) => b.n - a.n).map(({ tone, text, topicId }) => ({ tone, text, topicId }));
  const r = sort(red).slice(0, 3);
  const y = sort(yellow).slice(0, 2);
  const g = sort(green).slice(0, 2);
  return [...r, ...y, ...g].slice(0, max);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/* ---------- Sugestões ---------- */

export type Suggestion = { topicId: string; flag: Flag; text: string };

/**
 * Domínio: 3+ sessões de questões no tópico com 80%+ de acerto (pelo menos 15 questões).
 * Teoria: sessão de Teoria/Videoaula no tópico. Prática: sessão de Questões no tópico.
 * Só sugere o que ainda não está todo marcado.
 */
export function computeSuggestions(topics: MapTopic[], sessions: MapSession[], max = 4): Suggestion[] {
  const byTopic = new Map<string, MapSession[]>();
  for (const s of sessions) (byTopic.get(s.topicId) ?? byTopic.set(s.topicId, []).get(s.topicId)!).push(s);
  const out: (Suggestion & { rank: number; last: string })[] = [];
  for (const t of topics) {
    const l = byTopic.get(t.id);
    if (!l?.length) continue;
    const last = l.reduce((m, s) => (s.day > m ? s.day : m), "");
    const q = l.filter((s) => QUESTION_KINDS.includes(s.kind) && s.done > 0);
    const a = acc(q);
    if (q.length >= 3 && a.done >= 15 && a.pct! >= 80 && topicShare(t, "mastery") < 1) {
      out.push({ topicId: t.id, flag: "mastery", rank: 0, last, text: `${q.length} sessões de questões em ${t.name} com ${a.pct}% — marcar Domínio?` });
      continue;
    }
    const th = l.filter((s) => THEORY_KINDS.includes(s.kind));
    if (th.length && topicShare(t, "theory") < 1) {
      out.push({ topicId: t.id, flag: "theory", rank: 1, last, text: `${th.length} ${th.length === 1 ? "sessão" : "sessões"} de teoria em ${t.name} — marcar Teoria?` });
      continue;
    }
    const pr = l.filter((s) => s.kind === "Questões");
    if (pr.length && topicShare(t, "practice") < 1)
      out.push({ topicId: t.id, flag: "practice", rank: 2, last, text: `${pr.length} ${pr.length === 1 ? "sessão" : "sessões"} de questões em ${t.name} — marcar Prática?` });
  }
  return out
    .sort((a, b) => a.rank - b.rank || b.last.localeCompare(a.last))
    .slice(0, max)
    .map(({ topicId, flag, text }) => ({ topicId, flag, text }));
}
