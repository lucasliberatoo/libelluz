// Regras de XP, sequência (com lenha) e modo de estudo. Funções puras.
import { addDays } from "./day";

export const XP = {
  login: 5,
  per25min: 10,
  focusMilestones: [
    { min: 60, xp: 20, label: "1h de foco no dia" },
    { min: 120, xp: 40, label: "2h de foco no dia" },
    { min: 300, xp: 100, label: "5h de foco no dia" },
  ],
  correct: 3,
  wrong: 1,
  questionMilestones: [
    { n: 10, xp: 10, label: "10 questões no dia" },
    { n: 50, xp: 50, label: "50 questões no dia" },
  ],
  taskDone: 10,
  allTasks: 30,
  boostAreas: ["Matemática", "Natureza"],
  boost: 1.2,
  advancedBoost: 1.1,
} as const;

/** XP de uma sessão de foco (sem bônus diários). */
export function sessionXp(o: { minutes: number; area: string; done?: number | null; correct?: number | null; advanced?: boolean }) {
  const done = Math.max(0, o.done ?? 0);
  const correct = Math.min(done, Math.max(0, o.correct ?? 0));
  let xp = Math.floor(o.minutes / 25) * XP.per25min + correct * XP.correct + (done - correct) * XP.wrong;
  if ((XP.boostAreas as readonly string[]).includes(o.area)) xp *= XP.boost;
  if (o.advanced) xp *= XP.advancedBoost;
  return Math.round(xp);
}

export type StreakInfo = {
  streak: number;
  firewood: number;
  /** dias (YYYY-MM-DD) protegidos pela lenha */
  burned: string[];
  studiedToday: boolean;
};

/**
 * Sequência calculada a partir dos dias estudados.
 * Lenha: +1 a cada 7 dias seguidos (máx. 2). Um dia em branco queima 1 lenha no lugar de zerar.
 * Hoje ainda não estudado não quebra a sequência.
 * Dias de descanso planejado (`restDays`) sem estudo são pulados: não quebram nem gastam lenha.
 */
export function computeStreak(studiedDays: Iterable<string>, today: string, restDays?: Iterable<string>): StreakInfo {
  const set = new Set(studiedDays);
  const rest = new Set(restDays ?? []);
  const sorted = [...set].filter((d) => d <= today).sort();
  if (!sorted.length) return { streak: 0, firewood: 0, burned: [], studiedToday: false };
  let streak = 0;
  let firewood = 0;
  let sinceWood = 0;
  let burned: string[] = [];
  for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
    if (set.has(d)) {
      streak++;
      sinceWood++;
      if (sinceWood >= 7) {
        sinceWood = 0;
        firewood = Math.min(2, firewood + 1);
      }
    } else if (d === today || rest.has(d)) {
      // o dia ainda não acabou / descanso planejado
    } else if (firewood > 0) {
      firewood--;
      burned.push(d);
    } else {
      streak = 0;
      sinceWood = 0;
      burned = [];
    }
  }
  return { streak, firewood, burned, studiedToday: set.has(today) };
}

export type StudyMode = "Baixo" | "Regular" | "Avançado";

/** Modo automático pelos últimos 14 dias. */
export function computeStudyMode(minutesByDay: Map<string, number>, today: string, focusGoalMin: number): StudyMode {
  let days = 0;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const m = minutesByDay.get(addDays(today, -i)) ?? 0;
    if (m > 0) days++;
    total += m;
  }
  if (days >= 10 && total / 14 >= focusGoalMin * 0.9) return "Avançado";
  if (days >= 5) return "Regular";
  return "Baixo";
}
