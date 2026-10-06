// Cronograma em blocos e revisões espaçadas. Funções puras (testadas em schedule.test.ts).
import { addDays, weekdayOf } from "./day";

/* ---------- Constantes ---------- */

export const SCHEDULE_XP = {
  block: 10, // bateu o plannedMin de um bloco
  review: 15, // revisão feita
  reviewOnTime: 5, // bônus: feita no dia certo ou antes
} as const;

/** Intervalos dos três primeiros passos (dias). Depois: manutenção ×2,5. */
export const REVIEW_STEPS = [1, 7, 30] as const;
export const MAINTENANCE_FACTOR = 2.5;
export const REVIEW_MIN = 30; // duração padrão de um bloco de revisão
export const MIN_BLOCK = 30;
export const MAX_BLOCK = 90;

/** Blocos criados pelo "Sugerir minha semana" ficam com position >= este valor (os manuais ficam abaixo). */
export const SUGGESTED_POS = 1000;

/** Peso de cada área na sugestão: ênfase em Natureza e Matemática. */
export const AREA_WEIGHT: Record<string, number> = {
  Natureza: 2,
  Matemática: 2,
  Linguagens: 1,
  Humanas: 1,
  Redação: 0.5,
};

export const LEISURE = [
  "Uma caminhada sem fone, só olhando a rua",
  "Cinema ou um filme em casa com pipoca",
  "Encontrar os amigos (sem falar de ENEM)",
  "Jogar bola, andar de bike ou nadar",
  "Cozinhar algo novo",
  "Ler um livro só por prazer",
  "Um parque, uma praça, um pôr do sol",
  "Dormir até tarde, sem culpa",
];

/** Sugestão de lazer estável para a semana. */
export function leisureFor(weekStartDay: string) {
  const n = Math.floor(new Date(`${weekStartDay}T12:00:00Z`).getTime() / (7 * 864e5));
  return LEISURE[((n % LEISURE.length) + LEISURE.length) % LEISURE.length];
}

/* ---------- Revisões espaçadas ---------- */

export type ReviewPlan = { step: number; intervalDays: number; dueDay: string };

/** Dias até a data-alvo (null se não houver ou já passou). */
function daysLeft(today: string, enemDate?: string | null) {
  if (!enemDate) return null;
  const d = Math.round((Date.parse(`${enemDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
  return d > 0 ? d : null;
}

/** Perto da prova (< 60 dias), o intervalo vira no máximo metade do tempo restante. */
function squeeze(interval: number, today: string, enemDate?: string | null) {
  const left = daysLeft(today, enemDate);
  if (left !== null && left < 60) return Math.max(1, Math.min(interval, Math.floor(left / 2)));
  return interval;
}

/** 1ª revisão, criada depois do 1º estudo do tópico: amanhã. */
export function firstReview(day: string, enemDate?: string | null): ReviewPlan {
  const intervalDays = squeeze(REVIEW_STEPS[0], day, enemDate);
  return { step: 0, intervalDays, dueDay: addDays(day, intervalDays) };
}

/**
 * Próxima revisão depois de concluir a revisão no passo `step` (0 = a de 1 dia).
 * Passos 1 → 7 → 30, depois manutenção ×2,5 do último intervalo.
 * Acerto < 60%: volta um passo (não avança; na manutenção mantém o intervalo).
 * Acerto > 85%: avança e estica ×1,5.
 */
export function nextReview(o: {
  step: number;
  intervalDays: number;
  accuracy?: number | null; // 0–100
  day: string; // dia em que a revisão foi feita
  enemDate?: string | null;
}): ReviewPlan {
  const acc = o.accuracy ?? null;
  const low = acc !== null && acc < 60;
  const high = acc !== null && acc > 85;
  const step = low ? Math.max(0, o.step) : o.step + 1;
  let interval: number;
  if (step < REVIEW_STEPS.length) interval = REVIEW_STEPS[step];
  else if (low) interval = Math.max(REVIEW_STEPS[REVIEW_STEPS.length - 1], o.intervalDays);
  else interval = Math.round(Math.max(o.intervalDays, REVIEW_STEPS[REVIEW_STEPS.length - 1]) * MAINTENANCE_FACTOR);
  if (high) interval = Math.round(interval * 1.5);
  interval = squeeze(interval, o.day, o.enemDate);
  return { step, intervalDays: interval, dueDay: addDays(o.day, interval) };
}

/** XP de uma revisão concluída no dia `day` com vencimento em `dueDay`. */
export function reviewXp(day: string, dueDay: string) {
  return SCHEDULE_XP.review + (day <= dueDay ? SCHEDULE_XP.reviewOnTime : 0);
}

/* ---------- Dias de descanso ---------- */

/** Dias (YYYY-MM-DD) de descanso entre `from` e `to`, inclusive. */
export function restDaysBetween(from: string, to: string, restDay: number | null | undefined): string[] {
  if (restDay === null || restDay === undefined || from > to) return [];
  const out: string[] = [];
  let d = addDays(from, (restDay - weekdayOf(from) + 7) % 7);
  for (; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
}

/** Minutos disponíveis no dia (0 no descanso). */
export function capacityOf(day: string, weekMinutes: number[], restDay: number | null | undefined) {
  const wd = weekdayOf(day);
  if (restDay === wd) return 0;
  return Math.max(0, weekMinutes[wd] ?? 0);
}

/* ---------- Sugerir minha semana ---------- */

export type TopicInfo = {
  nodeId: string | null;
  area: string;
  subject: string;
  topic: string;
  mastery: boolean;
  minutes: number; // minutos já estudados
};

export type DueReview = { id: string; nodeId: string | null; area: string; subject: string; topic: string; dueDay: string };

export type PlannedBlock = {
  day: string;
  nodeId: string | null;
  area: string;
  subject: string;
  topic: string;
  kind: "study" | "review";
  plannedMin: number;
  reviewId: string | null;
};

export type KeptBlock = { day: string; topic: string; plannedMin: number; reviewId: string | null };

/** Quebra os minutos livres de um dia em blocos de 30–90 min (múltiplos de 5). */
export function splitMinutes(free: number): number[] {
  const out: number[] = [];
  let rem = Math.floor(free / 5) * 5;
  while (rem >= MIN_BLOCK) {
    let size: number;
    if (rem <= MAX_BLOCK) size = rem;
    else if (rem - 60 >= MIN_BLOCK) size = 60;
    else size = rem - MIN_BLOCK;
    out.push(size);
    rem -= size;
  }
  return out;
}

/** Ordem das áreas por round-robin ponderado (suave): intercala e dá mais vez a Natureza e Matemática. */
export function areaSequence(areas: string[], n: number): string[] {
  const w = areas.map((a) => AREA_WEIGHT[a] ?? 1);
  const total = w.reduce((s, x) => s + x, 0);
  const cur = areas.map(() => 0);
  const out: string[] = [];
  for (let k = 0; k < n && areas.length; k++) {
    let best = 0;
    for (let i = 0; i < areas.length; i++) {
      cur[i] += w[i];
      if (cur[i] > cur[best]) best = i;
    }
    cur[best] -= total;
    out.push(areas[best]);
  }
  return out;
}

/**
 * Distribui a semana: primeiro as revisões que vencem (as atrasadas vão no 1º dia livre),
 * depois tópicos na ordem da árvore — sem domínio e sem horas primeiro —, intercalando áreas.
 * `kept` são os blocos que ficam (manuais ou com progresso): ocupam capacidade e não se repetem.
 * Só planeja de `today` em diante.
 */
export function suggestWeek(o: {
  weekStart: string;
  today: string;
  weekMinutes: number[];
  restDay: number | null | undefined;
  topics: TopicInfo[]; // na ordem da árvore
  reviews: DueReview[];
  kept: KeptBlock[];
}): PlannedBlock[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(o.weekStart, i)).filter((d) => d >= o.today);
  const free = new Map(days.map((d) => [d, capacityOf(d, o.weekMinutes, o.restDay)]));
  for (const k of o.kept) if (free.has(k.day)) free.set(k.day, free.get(k.day)! - k.plannedMin);
  const open = days.filter((d) => free.get(d)! > 0);
  const out: PlannedBlock[] = [];
  if (!open.length) return out;
  const weekEnd = addDays(o.weekStart, 6);

  // 1) Revisões que vencem até o fim da semana
  const keptReviews = new Set(o.kept.map((k) => k.reviewId).filter(Boolean));
  const due = o.reviews.filter((r) => r.dueDay <= weekEnd && !keptReviews.has(r.id)).sort((a, b) => a.dueDay.localeCompare(b.dueDay));
  for (const r of due) {
    const candidates = [...open.filter((d) => d >= r.dueDay), ...open.filter((d) => d < r.dueDay).reverse()];
    const day = candidates.find((d) => free.get(d)! >= REVIEW_MIN);
    if (!day) continue;
    free.set(day, free.get(day)! - REVIEW_MIN);
    out.push({ day, nodeId: r.nodeId, area: r.area, subject: r.subject, topic: r.topic, kind: "review", plannedMin: REVIEW_MIN, reviewId: r.id });
  }

  // 2) Estudo: filas por área, sem domínio; sem horas antes
  const used = new Set(o.kept.map((k) => k.topic));
  const pending = o.topics.filter((t) => !t.mastery && !used.has(t.topic));
  const ordered = [...pending.filter((t) => t.minutes <= 0), ...pending.filter((t) => t.minutes > 0)];
  const queues = new Map<string, TopicInfo[]>();
  for (const t of ordered) {
    if (!queues.has(t.area)) queues.set(t.area, []);
    queues.get(t.area)!.push(t);
  }
  const slots: { day: string; min: number }[] = [];
  for (const d of open) for (const m of splitMinutes(free.get(d)!)) slots.push({ day: d, min: m });
  const areas = [...queues.keys()];
  const seq = areaSequence(areas, slots.length * Math.max(1, areas.length));
  let si = 0;
  for (const slot of slots) {
    let t: TopicInfo | undefined;
    // pega a próxima área da sequência que ainda tenha tópicos (e evita repetir a área anterior do mesmo dia)
    const prev = out.filter((b) => b.day === slot.day && b.kind === "study").at(-1)?.area;
    for (let tries = 0; tries < seq.length && !t; tries++) {
      const a = seq[si++ % seq.length];
      const q = queues.get(a)!;
      if (!q.length) continue;
      if (a === prev && areas.some((x) => x !== a && queues.get(x)!.length)) continue;
      t = q.shift();
    }
    if (!t) break;
    out.push({ day: slot.day, nodeId: t.nodeId, area: t.area, subject: t.subject, topic: t.topic, kind: "study", plannedMin: slot.min, reviewId: null });
  }
  return out;
}

/**
 * Próximo dia livre (a partir de `from`) para um bloco pendente de `min` minutos:
 * primeiro dia de estudo com folga suficiente; se nenhum em 14 dias, o 1º dia de estudo; senão `from`.
 */
export function nextFreeDay(o: {
  from: string;
  min: number;
  weekMinutes: number[];
  restDay: number | null | undefined;
  plannedByDay: Map<string, number>;
}): string {
  let firstStudy: string | null = null;
  for (let i = 0; i < 14; i++) {
    const d = addDays(o.from, i);
    const cap = capacityOf(d, o.weekMinutes, o.restDay);
    if (cap <= 0) continue;
    firstStudy ??= d;
    if (cap - (o.plannedByDay.get(d) ?? 0) >= o.min) return d;
  }
  return firstStudy ?? o.from;
}

/**
 * Distribui os minutos de uma sessão de foco pelos blocos do dia daquele tópico
 * (os do mesmo tipo primeiro; o que sobrar fica no último). Retorna os novos doneMin;
 * `completed` diz se o bloco bateu o planejado (quem chama só marca doneAt uma vez).
 */
export function fillBlocks<B extends { id: string; kind: "study" | "review"; plannedMin: number; doneMin: number }>(
  blocks: B[],
  minutes: number,
  kind: "study" | "review",
): { id: string; doneMin: number; completed: boolean }[] {
  if (!blocks.length || minutes <= 0) return [];
  const sorted = [...blocks].sort((a, b) => (a.kind === kind ? 0 : 1) - (b.kind === kind ? 0 : 1));
  let rem = minutes;
  const out: { id: string; doneMin: number; completed: boolean }[] = [];
  for (let i = 0; i < sorted.length && rem > 0; i++) {
    const b = sorted[i];
    const last = i === sorted.length - 1;
    const room = Math.max(0, b.plannedMin - b.doneMin);
    if (!room && !last) continue;
    const add = last ? rem : Math.min(room, rem);
    rem -= add;
    const doneMin = Math.round((b.doneMin + add) * 10) / 10;
    out.push({ id: b.id, doneMin, completed: doneMin >= b.plannedMin - 1 }); // 1 min de folga
  }
  return out;
}
