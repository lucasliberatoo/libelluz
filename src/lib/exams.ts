// Simulados e ENEMs antigos: partes, XP e resumo "Rumo aos 160+". Funções puras.

export const EXAM_XP = {
  part: 40,
  fullSimulado: 250,
  fullEnem: 300, // no lugar dos 250
  record: 100,
} as const;

export const PARTS = [
  { key: "natureza", label: "Natureza", short: "CN", color: "var(--chart-2)" },
  { key: "matematica", label: "Matemática", short: "MT", color: "var(--chart-1)" },
  { key: "linguagens", label: "Linguagens", short: "LC", color: "var(--chart-3)" },
  { key: "humanas", label: "Humanas", short: "CH", color: "var(--chart-4)" },
  { key: "redacao", label: "Redação", short: "RED", color: "var(--chart-5)" },
] as const;

export type PartKey = (typeof PARTS)[number]["key"];
export const OBJECTIVE: PartKey[] = ["natureza", "matematica", "linguagens", "humanas"];
export const PART_KEYS = PARTS.map((p) => p.key) as [PartKey, ...PartKey[]];
export const partLabel = (k: string) => PARTS.find((p) => p.key === k)?.label ?? k;

export const GOAL_TOTAL = 160;
export const MAX_TOTAL = 180;
/** Notas possíveis de cada competência (0–200, de 40 em 40). */
export const COMPETENCY_STEPS = [0, 40, 80, 120, 160, 200];

export type PartRow = {
  part: PartKey;
  day: string;
  correct: number | null;
  minutes: number | null;
  essayScore: number | null;
  competencies: number[] | null;
};

export type ExamRow = {
  id: string;
  kind: "simulado" | "enem";
  name: string;
  source: string | null;
  enemKey: string | null;
  url: string | null;
  createdAt: number;
  parts: PartRow[];
};

/** Total de acertos das 4 objetivas (de 180), ou null se alguma ainda falta. */
export function objectiveTotal(parts: PartRow[]): number | null {
  let sum = 0;
  for (const k of OBJECTIVE) {
    const p = parts.find((x) => x.part === k);
    if (!p || p.correct == null) return null;
    sum += p.correct;
  }
  return sum;
}

/** Dia em que o total ficou completo (a última das 4 objetivas). */
export function totalDay(parts: PartRow[]): string | null {
  const days = parts.filter((p) => OBJECTIVE.includes(p.part)).map((p) => p.day);
  return days.length === 4 ? days.sort().at(-1)! : null;
}

export const isComplete = (parts: PartRow[]) => PART_KEYS.every((k) => parts.some((p) => p.part === k));

export type TimelinePoint = {
  examId: string;
  name: string;
  day: string;
  total: number;
  natureza: number;
  matematica: number;
  linguagens: number;
  humanas: number;
  redacao: number | null;
};

export type ExamSummary = {
  timeline: TimelinePoint[];
  record: TimelinePoint | null;
  last: TimelinePoint | null;
  /** last.total − penúltimo total */
  delta: number | null;
  essays: { examId: string; name: string; day: string; score: number }[];
  completeCount: number;
};

export function summarizeExams(exams: ExamRow[]): ExamSummary {
  const timeline: TimelinePoint[] = [];
  const essays: ExamSummary["essays"] = [];
  let completeCount = 0;
  for (const e of exams) {
    if (isComplete(e.parts)) completeCount++;
    const red = e.parts.find((p) => p.part === "redacao");
    if (red?.essayScore != null) essays.push({ examId: e.id, name: e.name, day: red.day, score: red.essayScore });
    const total = objectiveTotal(e.parts);
    if (total == null) continue;
    const by = (k: PartKey) => e.parts.find((p) => p.part === k)?.correct ?? 0;
    timeline.push({
      examId: e.id,
      name: e.name,
      day: totalDay(e.parts)!,
      total,
      natureza: by("natureza"),
      matematica: by("matematica"),
      linguagens: by("linguagens"),
      humanas: by("humanas"),
      redacao: red?.essayScore ?? null,
    });
  }
  timeline.sort((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name));
  essays.sort((a, b) => a.day.localeCompare(b.day));
  const record = timeline.reduce<TimelinePoint | null>((m, p) => (!m || p.total > m.total ? p : m), null);
  const last = timeline.at(-1) ?? null;
  const prev = timeline.at(-2) ?? null;
  return { timeline, record, last, delta: last && prev ? last.total - prev.total : null, essays, completeCount };
}

/**
 * XP ao registrar/editar partes de uma prova. As chaves de dedupe garantem que cada bônus só sai uma vez.
 * `otherBest` = maior total (de 180) entre as OUTRAS provas da pessoa (null se nenhuma).
 */
export function examAwards(
  exam: { id: string; kind: "simulado" | "enem" },
  savedParts: PartKey[],
  allParts: PartRow[],
  otherBest: number | null,
): { amount: number; reason: string; dedupe: string }[] {
  const out: { amount: number; reason: string; dedupe: string }[] = [];
  for (const p of savedParts) {
    out.push({ amount: EXAM_XP.part, reason: `Simulado: ${partLabel(p)}`, dedupe: `exampart:${exam.id}:${p}` });
  }
  if (isComplete(allParts)) {
    out.push(
      exam.kind === "enem"
        ? { amount: EXAM_XP.fullEnem, reason: "ENEM antigo completo", dedupe: `examfull:${exam.id}` }
        : { amount: EXAM_XP.fullSimulado, reason: "Simulado completo", dedupe: `examfull:${exam.id}` },
    );
  }
  const total = objectiveTotal(allParts);
  // Recorde só conta quando supera uma prova anterior.
  if (total != null && otherBest != null && total > otherBest) {
    out.push({ amount: EXAM_XP.record, reason: `Novo recorde: ${total}/180`, dedupe: `examrecord:${exam.id}` });
  }
  return out;
}

/** "1h20" a partir de minutos. */
export function fmtMinutes(m: number | null | undefined) {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`;
}
