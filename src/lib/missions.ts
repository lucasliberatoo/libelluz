// Missões cooperativas (grupo inteiro ou dupla). Funções puras: o servidor agrega os números por dia no SQL.
import { addDays } from "./day";

export type MissionMetric = "hours" | "questions" | "sessions" | "days";

export const MISSION_METRICS: { key: MissionMetric; label: string; unit: string }[] = [
  { key: "hours", label: "Horas de foco", unit: "h" },
  { key: "questions", label: "Questões", unit: "questões" },
  { key: "sessions", label: "Sessões de foco", unit: "sessões" },
  { key: "days", label: "Dias estudados", unit: "dias" },
];

/** XP das missões (fica aqui, não em lib/game.ts). */
export const MISSION_XP = { weekly: 150, default: 100, min: 20, max: 300 } as const;

export type MissionLike = {
  metric: MissionMetric;
  target: number;
  startDay: string;
  endDay: string;
  /** vazio = grupo inteiro */
  memberIds: string[];
};

/** Números de uma pessoa num dia (agregados no SQL). */
export type DailyStat = { userId: string; day: string; minutes: number; questions: number; sessions: number };

export type MissionProgress = {
  total: number;
  pct: number;
  done: boolean;
  /** contribuição de cada membro, da maior para a menor */
  contributions: { userId: string; value: number }[];
};

/** Quem participa: os membros escolhidos ou, se vazio, todo mundo do grupo. */
export function missionMembers(m: Pick<MissionLike, "memberIds">, everyone: string[]) {
  return m.memberIds.length ? m.memberIds.filter((id) => everyone.includes(id)) : everyone;
}

/** Valor de uma métrica a partir das linhas diárias de uma pessoa. */
export function metricValue(metric: MissionMetric, rows: DailyStat[]) {
  switch (metric) {
    case "hours":
      return rows.reduce((a, r) => a + r.minutes, 0) / 60;
    case "questions":
      return rows.reduce((a, r) => a + r.questions, 0);
    case "sessions":
      return rows.reduce((a, r) => a + r.sessions, 0);
    case "days":
      return new Set(rows.filter((r) => r.minutes > 0).map((r) => r.day)).size;
  }
}

export function missionProgress(m: MissionLike, stats: DailyStat[], everyone: string[]): MissionProgress {
  const members = missionMembers(m, everyone);
  const inPeriod = stats.filter((s) => s.day >= m.startDay && s.day <= m.endDay);
  const contributions = members
    .map((userId) => ({ userId, value: round1(metricValue(m.metric, inPeriod.filter((s) => s.userId === userId))) }))
    .sort((a, b) => b.value - a.value);
  const total = round1(contributions.reduce((a, c) => a + c.value, 0));
  const pct = m.target > 0 ? Math.min(100, Math.round((total / m.target) * 100)) : 0;
  return { total, pct, done: m.target > 0 && total >= m.target, contributions };
}

export type MissionStatus = "upcoming" | "active" | "ended";

export function missionStatus(m: Pick<MissionLike, "startDay" | "endDay">, today: string): MissionStatus {
  if (today < m.startDay) return "upcoming";
  if (today > m.endDay) return "ended";
  return "active";
}

export function daysLeft(m: Pick<MissionLike, "endDay">, today: string) {
  const ms = new Date(`${m.endDay}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}

/** Id fixo da missão automática da semana: evita criar duas se duas pessoas abrirem ao mesmo tempo. */
export const weeklyMissionId = (ws: string) => `weekly-${ws}`;

/** Missão da semana sugerida (alterna a métrica a cada semana; alvo proporcional ao tamanho do grupo). */
export function suggestWeeklyMission(ws: string, memberCount: number) {
  const n = Math.max(1, memberCount);
  const week = Math.floor(new Date(`${ws}T12:00:00Z`).getTime() / (7 * 86_400_000));
  const options = [
    { title: "Missão da semana: horas juntos", metric: "hours" as const, target: 5 * n },
    { title: "Missão da semana: maratona de questões", metric: "questions" as const, target: 80 * n },
    { title: "Missão da semana: ninguém fica parado", metric: "days" as const, target: 4 * n },
  ];
  const o = options[((week % options.length) + options.length) % options.length];
  return { ...o, startDay: ws, endDay: addDays(ws, 6), memberIds: [] as string[], xp: MISSION_XP.weekly };
}

export function fmtMetric(metric: MissionMetric, v: number) {
  if (metric === "hours") return `${fmtNum(v)}h`;
  const unit = MISSION_METRICS.find((x) => x.key === metric)!.unit;
  return `${fmtNum(v)} ${unit}`;
}

const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));
const round1 = (n: number) => Math.round(n * 10) / 10;
