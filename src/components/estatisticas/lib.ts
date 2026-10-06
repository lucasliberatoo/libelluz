// Peças puras da página de Estatísticas (usadas no servidor e no cliente).
import { addDays, weekStart } from "@/lib/day";

export const PERIODS = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "ano", label: "1 ano", days: 365 },
  { key: "tudo", label: "Tudo", days: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];
export type Bucket = "day" | "week" | "month";

export function parsePeriod(v: unknown): PeriodKey {
  return PERIODS.some((p) => p.key === v) ? (v as PeriodKey) : "30d";
}

/** Dias corridos entre duas datas "YYYY-MM-DD" (inclusive). */
export function spanDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Agrupamento da linha do tempo: por dia até ~1 mês, por semana até ~1 ano, por mês além disso. */
export function bucketFor(days: number): Bucket {
  return days <= 31 ? "day" : days <= 400 ? "week" : "month";
}

export function bucketKey(day: string, b: Bucket) {
  return b === "day" ? day : b === "week" ? weekStart(day) : day.slice(0, 7);
}

/** Todas as chaves de balde do intervalo, em ordem. */
export function bucketKeys(from: string, to: string, b: Bucket): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = bucketKey(d, b);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function bucketLabel(key: string, b: Bucket) {
  if (b === "month") return `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
  return `${Number(key.slice(8, 10))}/${key.slice(5, 7)}`;
}

/**
 * Maior sequência já feita, com as mesmas regras de `computeStreak` (lenha e descanso).
 * Hoje sem estudo não conta como dia perdido.
 */
export function longestStreak(studied: Iterable<string>, today: string, restDays: Iterable<string> = []): number {
  const set = new Set(studied);
  const rest = new Set(restDays);
  const sorted = [...set].filter((d) => d <= today).sort();
  if (!sorted.length) return 0;
  let streak = 0;
  let best = 0;
  let firewood = 0;
  let sinceWood = 0;
  for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
    if (set.has(d)) {
      streak++;
      best = Math.max(best, streak);
      if (++sinceWood >= 7) {
        sinceWood = 0;
        firewood = Math.min(2, firewood + 1);
      }
    } else if (d === today || rest.has(d)) {
      // não conta
    } else if (firewood > 0) {
      firewood--;
    } else {
      streak = 0;
      sinceWood = 0;
    }
  }
  return best;
}

/* ---------- Formatação ---------- */

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Horas a partir de minutos: "12,5 h", "45 min". */
export function fmtHours(min: number) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return `${fmtNum(h, h < 10 ? 1 : 0)} h`;
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
