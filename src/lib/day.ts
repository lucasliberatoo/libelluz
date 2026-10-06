// O dia vira à meia-noite no horário de Brasília.
export const TZ = "America/Sao_Paulo";

/** "YYYY-MM-DD" do instante dado, no fuso do app. */
export function dayOf(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Domingo da semana do dia. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayOf(day));
}

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Instante atual (fora do render de componentes, para o lint de pureza). */
export const nowMs = () => Date.now();
