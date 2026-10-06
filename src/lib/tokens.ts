// Modo Disciplina: a regra dos tokens.
//
// A pessoa escolhe os apps que quer bloquear e recebe tokens por dia. Cada token libera o app por
// alguns minutos. A ideia é que o token seja *ganho*: parte vem de graça (para o dia não começar
// travado) e o resto vem do XP do dia — estudou, ganhou XP, ganhou token.

export const TOKENS = {
  /** Tokens que todo dia começa com, sem estudar nada. Editável em /disciplina. */
  base: 3,
  baseMin: 0,
  baseMax: 10,
  /** Minutos liberados por token. Editável em /disciplina. */
  minutes: 10,
  minutesMin: 5,
  minutesMax: 60,
  /** XP do dia necessário para ganhar 1 token extra. */
  xpPerToken: 100,
  /** Teto de tokens extras ganhos com XP num dia. */
  maxEarned: 5,
} as const;

export type TokenBudget = {
  /** Tokens de graça do dia. */
  base: number;
  /** Tokens ganhos com o XP de hoje. */
  earned: number;
  /** base + earned. */
  total: number;
  /** Quantos já foram gastos hoje. */
  spent: number;
  /** Quanto sobrou (nunca negativo). */
  left: number;
  /** XP que falta para o próximo token extra; null quando o teto já foi batido. */
  xpToNext: number | null;
};

/** Tokens extras que `xp` de XP num dia rende. */
export function earnedTokens(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  return Math.min(TOKENS.maxEarned, Math.floor(xp / TOKENS.xpPerToken));
}

/** XP que falta para o próximo token extra; null se o teto do dia já foi atingido. */
export function xpToNextToken(xp: number): number | null {
  if (earnedTokens(xp) >= TOKENS.maxEarned) return null;
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return TOKENS.xpPerToken - (Math.floor(safe) % TOKENS.xpPerToken);
}

/** A conta do dia: base + XP − gastos. */
export function tokenBudget(o: { baseTokens?: number | null; xpToday?: number | null; spent?: number | null }): TokenBudget {
  const base = clamp(o.baseTokens ?? TOKENS.base, TOKENS.baseMin, TOKENS.baseMax);
  const xp = Math.max(0, Math.floor(o.xpToday ?? 0));
  const earned = earnedTokens(xp);
  const total = base + earned;
  const spent = Math.max(0, Math.floor(o.spent ?? 0));
  return { base, earned, total, spent, left: Math.max(0, total - spent), xpToNext: xpToNextToken(xp) };
}

export function clampBase(n: number): number {
  return clamp(n, TOKENS.baseMin, TOKENS.baseMax);
}

export function clampMinutes(n: number): number {
  return clamp(n, TOKENS.minutesMin, TOKENS.minutesMax);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** "Restam 2 tokens", "Resta 1 token", "Sem tokens hoje". */
export function tokensLabel(left: number): string {
  if (left <= 0) return "Sem tokens hoje";
  return left === 1 ? "Resta 1 token" : `Restam ${left} tokens`;
}

/** O texto da tela que aparece no celular ao abrir um app bloqueado. */
export function gateText(o: { left: number; minutes: number; app: string }): string {
  if (o.left <= 0) return `Seus tokens de hoje acabaram. Estude no Libelluz para ganhar mais.`;
  return `Você está prestes a gastar 1 token. Restam ${o.left}. É realmente necessário? (1 token = ${o.minutes} min no ${o.app})`;
}
