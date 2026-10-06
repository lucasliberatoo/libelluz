// Redação: eixos, etiquetas de erro, XP, sorteio e ritmo. Funções puras.
import { addDays, weekdayOf } from "./day";

export const ESSAY_XP = {
  essay: 50,
  bands: [
    { min: 900, xp: 50 },
    { min: 800, xp: 30 },
    { min: 600, xp: 10 },
  ],
} as const;

/** Bônus pela faixa da nota (só a maior faixa atingida). */
export function essayBandBonus(score: number | null | undefined) {
  if (score == null) return 0;
  return ESSAY_XP.bands.find((b) => score >= b.min)?.xp ?? 0;
}

export const AXES = ["educação", "saúde", "tecnologia", "meio ambiente", "sociedade", "economia", "cultura"] as const;
export type Axis = (typeof AXES)[number];

export const AXIS_EMOJI: Record<string, string> = {
  educação: "🎓",
  saúde: "🩺",
  tecnologia: "💻",
  "meio ambiente": "🌳",
  sociedade: "🤝",
  economia: "💰",
  cultura: "🎭",
};

export const ERROR_TAGS = [
  "Tangenciou o tema",
  "Fuga ao tema",
  "Proposta de intervenção incompleta",
  "Coesão",
  "Repertório improdutivo",
  "Norma culta",
  "Tese pouco clara",
  "Argumentação superficial",
  "Conclusão fraca",
] as const;

export const COMPETENCY_NAMES = [
  "C1 · Norma culta",
  "C2 · Tema e repertório",
  "C3 · Argumentação",
  "C4 · Coesão",
  "C5 · Proposta de intervenção",
];

/** Temas oficiais de redações do ENEM (públicos), para começar o banco. */
export const SAMPLE_THEMES: { title: string; axis: Axis; source: string }[] = [
  { title: "Perspectivas acerca do envelhecimento na sociedade brasileira", axis: "sociedade", source: "ENEM 2025" },
  { title: "Desafios para a valorização da herança africana no Brasil", axis: "cultura", source: "ENEM 2024" },
  { title: "Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil", axis: "economia", source: "ENEM 2023" },
  { title: "Desafios para a valorização de comunidades e povos tradicionais no Brasil", axis: "cultura", source: "ENEM 2022" },
  { title: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil", axis: "sociedade", source: "ENEM 2021" },
  { title: "O estigma associado às doenças mentais na sociedade brasileira", axis: "saúde", source: "ENEM 2020" },
  { title: "O desafio de reduzir as desigualdades entre as regiões do Brasil", axis: "economia", source: "ENEM 2020 Digital" },
  { title: "Democratização do acesso ao cinema no Brasil", axis: "cultura", source: "ENEM 2019" },
  { title: "Manipulação do comportamento do usuário pelo controle de dados na internet", axis: "tecnologia", source: "ENEM 2018" },
  { title: "Desafios para a formação educacional de surdos no Brasil", axis: "educação", source: "ENEM 2017" },
  { title: "Caminhos para combater a intolerância religiosa no Brasil", axis: "cultura", source: "ENEM 2016" },
  { title: "A persistência da violência contra a mulher na sociedade brasileira", axis: "sociedade", source: "ENEM 2015" },
  { title: "Publicidade infantil em questão no Brasil", axis: "economia", source: "ENEM 2014" },
  { title: "Efeitos da implantação da Lei Seca no Brasil", axis: "saúde", source: "ENEM 2013" },
  { title: "O movimento imigratório para o Brasil no século XXI", axis: "sociedade", source: "ENEM 2012" },
  { title: "Viver em rede no século XXI: os limites entre o público e o privado", axis: "tecnologia", source: "ENEM 2011" },
  { title: "O trabalho na construção da dignidade humana", axis: "economia", source: "ENEM 2010" },
  { title: "Como preservar a floresta Amazônica", axis: "meio ambiente", source: "ENEM 2008" },
];

export type Rhythm = "fixo" | "semana";

/** Primeiro dia do ciclo atual: a segunda-feira (tema da semana) ou o último dia fixo ≤ hoje. */
export function cycleStart(rhythm: Rhythm, essayDay: number, today: string): string {
  const target = rhythm === "semana" ? 1 : essayDay;
  return addDays(today, -((weekdayOf(today) - target + 7) % 7));
}

/** O próximo sorteio automático já é devido? (`lastDraw` = dia do último sorteio, ou null) */
export function drawDue(rhythm: Rhythm, essayDay: number, today: string, lastDraw: string | null) {
  return !lastDraw || lastDraw < cycleStart(rhythm, essayDay, today);
}

/** Dia do próximo sorteio automático (depois de hoje). */
export function nextDrawDay(rhythm: Rhythm, essayDay: number, today: string) {
  return addDays(cycleStart(rhythm, essayDay, today), 7);
}

/**
 * Escolhe um tema do estoque. Eixos menos praticados pesam mais (peso 1/(1+n)²).
 * `exclude` evita repetir o tema que acabou de ser passado, se houver outra opção.
 */
export function pickTheme<T extends { id: string; axis: string }>(
  stock: T[],
  practiced: Record<string, number>,
  rand: () => number = Math.random,
  exclude?: string | null,
): T | null {
  const pool = stock.length > 1 && exclude ? stock.filter((t) => t.id !== exclude) : stock;
  if (!pool.length) return null;
  const w = pool.map((t) => 1 / (1 + (practiced[t.axis] ?? 0)) ** 2);
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r < 0) return pool[i];
  }
  return pool.at(-1)!;
}

/** Eixos que a pessoa vem passando (soma de passCount ≥ min), do mais evitado ao menos. */
export function avoidedAxes(themes: { axis: string; passCount: number }[], min = 3) {
  const m = new Map<string, number>();
  for (const t of themes) m.set(t.axis, (m.get(t.axis) ?? 0) + t.passCount);
  return [...m].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).map(([axis, passes]) => ({ axis, passes }));
}
