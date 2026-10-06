// Catálogo de conquistas (PROMPT §16): regras puras, sem banco. A avaliação fica em src/server/achievements.ts.
import { addDays } from "./day";

/** Tudo o que as conquistas leem. Calculado no servidor com agregações SQL. */
export type Metrics = {
  /** maior sequência de dias de foco (a atual, com lenha, ou a melhor da história) */
  streak: number;
  focusMin: number;
  sessions: number;
  /** maior sessão única, em minutos */
  longestSessionMin: number;
  /** maior soma de foco num dia, em minutos */
  bestDayMin: number;
  /** sessões começadas antes das 7h / a partir das 23h (horário de Brasília) */
  earlySessions: number;
  lateSessions: number;
  /** sessões com 10+ questões e 100% de acerto */
  perfectSessions: number;
  questions: number;
  questionsByArea: Record<string, number>;
  essays: number;
  essayBest: number;
  /** provas com as 4 partes objetivas lançadas */
  examsFull: number;
  /** melhor soma de acertos das 4 provas objetivas (de 180) */
  examBest: number;
  phasesDone: number;
  masteredSkills: number;
  reviewsOnTime: number;
  blocksDone: number;
  tasksDone: number;
  /** maior sequência de dias batendo a meta de água */
  waterStreak: number;
  readingMin: number;
  exerciseDays: number;
  journalDays: number;
  /** reações + comentários feitos no feed */
  social: number;
  pokes: number;
  level: number;
};

export const EMPTY_METRICS: Metrics = {
  streak: 0,
  focusMin: 0,
  sessions: 0,
  longestSessionMin: 0,
  bestDayMin: 0,
  earlySessions: 0,
  lateSessions: 0,
  perfectSessions: 0,
  questions: 0,
  questionsByArea: {},
  essays: 0,
  essayBest: 0,
  examsFull: 0,
  examBest: 0,
  phasesDone: 0,
  masteredSkills: 0,
  reviewsOnTime: 0,
  blocksDone: 0,
  tasksDone: 0,
  waterStreak: 0,
  readingMin: 0,
  exerciseDays: 0,
  journalDays: 0,
  social: 0,
  pokes: 0,
  level: 1,
};

export const CATEGORIES = ["Foco", "Questões", "Provas e redação", "Estudos", "Hábitos", "Social"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Achievement = {
  key: string;
  name: string;
  category: Category;
  /** emoji ("🔥") ou caminho dentro de /img ("emoji/trofeu.webp") */
  icon: string;
  /** limiar de cada estrela, crescente (1 a 3 estrelas) */
  tiers: readonly number[];
  /** o que fazer para chegar ao limiar n */
  goal: (n: number) => string;
  /** valor atual da métrica */
  value: (m: Metrics) => number;
  /** como mostrar o valor/limiar (ex.: horas) */
  fmt?: (n: number) => string;
  secret?: boolean;
};

/** XP por estrela: 1ª = 50, 2ª = 100, 3ª = 200. */
export const ACHIEVEMENT_XP = [50, 100, 200] as const;
export const xpForTier = (tier: number) => ACHIEVEMENT_XP[Math.min(Math.max(tier, 1), 3) - 1];

const h = (min: number) => min / 60;
const fmtInt = (n: number) => Math.floor(n).toLocaleString("pt-BR");
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
const areaQ = (area: string) => (m: Metrics) => m.questionsByArea[area] ?? 0;

export const ACHIEVEMENTS: readonly Achievement[] = [
  /* ---------- Foco ---------- */
  { key: "primeiro-foco", name: "Primeira faísca", category: "Foco", icon: "emoji/calor.webp", tiers: [1], goal: () => "Termine sua primeira sessão de foco", value: (m) => m.sessions },
  { key: "em-chamas", name: "Em chamas", category: "Foco", icon: "fogo.png", tiers: [7, 30, 100], goal: (n) => `Sequência de ${n} dias de foco`, value: (m) => m.streak },
  { key: "maratonista", name: "Maratonista", category: "Foco", icon: "emoji/cronometro.webp", tiers: [10, 50, 100], goal: (n) => `${n} horas de foco no total`, value: (m) => h(m.focusMin), fmt: (n) => `${fmtInt(n)} h` },
  { key: "dia-epico", name: "Dia épico", category: "Foco", icon: "emoji/foguete.webp", tiers: [3, 5, 8], goal: (n) => `${n} horas de foco num só dia`, value: (m) => h(m.bestDayMin), fmt: (n) => `${String(Math.floor(n * 10) / 10).replace(".", ",")} h` },
  { key: "sessoes", name: "Constante", category: "Foco", icon: "emoji/raio.webp", tiers: [25, 100, 300], goal: (n) => plural(n, "sessão de foco", "sessões de foco"), value: (m) => m.sessions },
  { key: "madrugador", name: "Madrugador", category: "Foco", icon: "emoji/sol.webp", tiers: [1, 10, 30], goal: (n) => `${plural(n, "sessão começada", "sessões começadas")} antes das 7h`, value: (m) => m.earlySessions, secret: true },
  { key: "coruja", name: "Coruja", category: "Foco", icon: "emoji/lua.webp", tiers: [1, 10, 30], goal: (n) => `${plural(n, "sessão começada", "sessões começadas")} depois das 23h`, value: (m) => m.lateSessions, secret: true },
  { key: "imersao", name: "Imersão profunda", category: "Foco", icon: "🤿", tiers: [120], goal: () => "Uma sessão de foco de 2 horas sem parar", value: (m) => m.longestSessionMin, fmt: (n) => `${fmtInt(n)} min`, secret: true },

  /* ---------- Questões ---------- */
  { key: "questionador", name: "Questionador", category: "Questões", icon: "emoji/alvo.webp", tiers: [250, 1000, 5000], goal: (n) => `${fmtInt(n)} questões resolvidas`, value: (m) => m.questions },
  { key: "matematico", name: "Matemático", category: "Questões", icon: "📐", tiers: [100, 500, 1000], goal: (n) => `${fmtInt(n)} questões de Matemática`, value: areaQ("Matemática") },
  { key: "naturalista", name: "Naturalista", category: "Questões", icon: "🧪", tiers: [100, 500, 1000], goal: (n) => `${fmtInt(n)} questões de Natureza`, value: areaQ("Natureza") },
  { key: "linguista", name: "Linguista", category: "Questões", icon: "📚", tiers: [100, 500, 1000], goal: (n) => `${fmtInt(n)} questões de Linguagens`, value: areaQ("Linguagens") },
  { key: "humanista", name: "Humanista", category: "Questões", icon: "🏛️", tiers: [100, 500, 1000], goal: (n) => `${fmtInt(n)} questões de Humanas`, value: areaQ("Humanas") },
  { key: "perfeccionista", name: "Perfeccionista", category: "Questões", icon: "💯", tiers: [1, 5, 20], goal: (n) => `${plural(n, "sessão", "sessões")} com 10+ questões e 100% de acerto`, value: (m) => m.perfectSessions, secret: true },

  /* ---------- Provas e redação ---------- */
  { key: "escritor", name: "Escritor", category: "Provas e redação", icon: "✍️", tiers: [1, 5, 20], goal: (n) => plural(n, "redação corrigida", "redações corrigidas"), value: (m) => m.essays },
  { key: "nota-900", name: "Nota 900+", category: "Provas e redação", icon: "emoji/estrela.webp", tiers: [900], goal: () => "Tire 900 ou mais numa redação", value: (m) => m.essayBest },
  { key: "nota-mil", name: "Nota mil", category: "Provas e redação", icon: "emoji/coroa.webp", tiers: [1000], goal: () => "Tire 1000 numa redação", value: (m) => m.essayBest, secret: true },
  { key: "simulado-completo", name: "Prova de fogo", category: "Provas e redação", icon: "emoji/tarefas.webp", tiers: [1, 5, 15], goal: (n) => `${plural(n, "simulado completo", "simulados completos")} (4 provas)`, value: (m) => m.examsFull },
  { key: "rumo-150", name: "Rumo aos 150", category: "Provas e redação", icon: "emoji/grafico.webp", tiers: [150], goal: () => "150+ acertos num simulado", value: (m) => m.examBest },
  { key: "elite-160", name: "Elite 160+", category: "Provas e redação", icon: "emoji/trofeu.webp", tiers: [160], goal: () => "160+ acertos num simulado", value: (m) => m.examBest },

  /* ---------- Estudos (Mapa, cronograma, revisões) ---------- */
  { key: "desbravador", name: "Desbravador", category: "Estudos", icon: "cairn.png", tiers: [1, 3, 5], goal: (n) => (n === 1 ? "Conclua a primeira fase do Mapa" : `Conclua ${n} fases do Mapa`), value: (m) => m.phasesDone },
  { key: "dominio", name: "Domínio", category: "Estudos", icon: "emoji/check.webp", tiers: [10, 50, 150], goal: (n) => `${n} habilidades marcadas como Domínio`, value: (m) => m.masteredSkills },
  { key: "revisor", name: "Revisor", category: "Estudos", icon: "emoji/revisao.webp", tiers: [10, 50, 150], goal: (n) => `${n} revisões feitas em dia`, value: (m) => m.reviewsOnTime },
  { key: "pontual", name: "Pontual", category: "Estudos", icon: "calendario.png", tiers: [10, 50, 200], goal: (n) => `${n} blocos do cronograma cumpridos`, value: (m) => m.blocksDone },
  { key: "organizado", name: "Organizado", category: "Estudos", icon: "✅", tiers: [10, 100, 500], goal: (n) => `${n} tarefas do dia concluídas`, value: (m) => m.tasksDone },
  { key: "escalada", name: "Escalada", category: "Estudos", icon: "moeda-xp.png", tiers: [5, 10, 15], goal: (n) => `Chegue ao nível ${n}`, value: (m) => m.level },

  /* ---------- Hábitos ---------- */
  { key: "hidratado", name: "Hidratado", category: "Hábitos", icon: "emoji/agua.webp", tiers: [7, 30, 100], goal: (n) => `Meta de água ${n} dias seguidos`, value: (m) => m.waterStreak },
  { key: "leitor", name: "Leitor", category: "Hábitos", icon: "livros.png", tiers: [5, 25, 100], goal: (n) => `${n} horas de leitura`, value: (m) => h(m.readingMin), fmt: (n) => `${fmtInt(n)} h` },
  { key: "atleta", name: "Atleta", category: "Hábitos", icon: "emoji/exercicio.webp", tiers: [7, 30, 100], goal: (n) => `${n} dias com exercício físico`, value: (m) => m.exerciseDays },
  { key: "diario", name: "Querido diário", category: "Hábitos", icon: "emoji/humor.webp", tiers: [10, 30, 100], goal: (n) => `${n} relatos no diário`, value: (m) => m.journalDays },

  /* ---------- Social ---------- */
  { key: "social", name: "Social", category: "Social", icon: "emoji/grupo.webp", tiers: [1, 25, 100], goal: (n) => `${plural(n, "reação ou comentário", "reações ou comentários")} no feed`, value: (m) => m.social },
  { key: "cutucador", name: "Cutucador", category: "Social", icon: "👉", tiers: [1, 10, 50], goal: (n) => `Cutuque amigos ${plural(n, "vez", "vezes")}`, value: (m) => m.pokes },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));
export const TOTAL_STARS = ACHIEVEMENTS.reduce((s, a) => s + a.tiers.length, 0);

/** Quantas estrelas o valor alcança. */
export function tierFor(a: Pick<Achievement, "tiers">, value: number) {
  let t = 0;
  for (const th of a.tiers) if (value >= th) t++;
  return t;
}

export type Unlock = { key: string; tier: number };
export const unlockId = (u: Unlock) => `${u.key}:${u.tier}`;

/** Estrelas novas (ainda não gravadas) para as métricas dadas. Cada estrela é um desbloqueio. */
export function newUnlocks(m: Metrics, have: Iterable<string>, catalog: readonly Achievement[] = ACHIEVEMENTS): Unlock[] {
  const got = new Set(have);
  const out: Unlock[] = [];
  for (const a of catalog) {
    const t = tierFor(a, a.value(m));
    for (let tier = 1; tier <= t; tier++) if (!got.has(`${a.key}:${tier}`)) out.push({ key: a.key, tier });
  }
  return out;
}

export type AchievementView = {
  key: string;
  name: string;
  icon: string;
  category: Category;
  secret: boolean;
  /** escondida: secreta e ainda sem estrela */
  hidden: boolean;
  tier: number;
  maxTier: number;
  /** texto do próximo objetivo (ou do último, se completa) */
  goal: string;
  /** progresso até a próxima estrela, 0–100 */
  pct: number;
  valueLabel: string;
  targetLabel: string | null;
};

/** Como mostrar uma conquista: estrelas gravadas + progresso até a próxima. Secretas sem estrela viram "???". */
export function viewOf(a: Achievement, m: Metrics, storedTier = 0): AchievementView {
  const value = a.value(m);
  const tier = Math.max(storedTier, tierFor(a, value));
  const maxTier = a.tiers.length;
  const next = tier < maxTier ? a.tiers[tier] : null;
  const prev = tier > 0 ? a.tiers[tier - 1] : 0;
  const fmt = a.fmt ?? fmtInt;
  const hidden = !!a.secret && tier === 0;
  const pct = next == null ? 100 : Math.max(0, Math.min(100, Math.round(((value - prev) / (next - prev)) * 100)));
  return {
    key: a.key,
    name: hidden ? "???" : a.name,
    icon: hidden ? "🔒" : a.icon,
    category: a.category,
    secret: !!a.secret,
    hidden,
    tier,
    maxTier,
    goal: hidden ? "Conquista secreta. Continue estudando para descobrir." : a.goal(next ?? a.tiers[maxTier - 1]),
    pct,
    valueLabel: fmt(Math.min(value, next ?? value)),
    targetLabel: next == null ? null : fmt(next),
  };
}

/** Texto curto de um desbloqueio (para notificação e comemoração). */
export function unlockText(u: Unlock) {
  const a = ACHIEVEMENT_BY_KEY.get(u.key);
  if (!a) return null;
  return {
    name: a.name,
    icon: a.icon,
    stars: a.tiers.length > 1 ? u.tier : 0,
    maxTier: a.tiers.length,
    goal: a.goal(a.tiers[Math.min(u.tier, a.tiers.length) - 1]),
    xp: xpForTier(u.tier),
  };
}

/* ---------- Auxiliares de métricas (puros) ---------- */

/** Maior sequência de dias consecutivos na lista (sem ordem garantida). */
export function longestRun(days: Iterable<string>) {
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of [...new Set(days)].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
