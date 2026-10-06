// Calor 🌡️ do foguinho: moeda separada do XP, que vem dos hábitos do dia. Funções puras.
import { addDays, TZ } from "./day";
import { computeStreak, type StreakInfo } from "./game";

/* ---------- Quanto vale cada coisa ---------- */

export const HEAT = {
  water: 2, // bateu a meta de água
  reading: 2, // bateu a meta de leitura
  allTasks: 3, // concluiu todas as tarefas do dia (tarefas + blocos do cronograma)
  mood: 1, // registrou o humor
  exercise: 2, // fez exercício
  journal: 1, // escreveu um relato no diário
  /** Estudo: vale o maior degrau atingido no dia (não soma). */
  study: [
    { min: 25, heat: 3 },
    { min: 60, heat: 5 },
    { min: 120, heat: 8 },
    { min: 180, heat: 10 },
  ],
  /** heatEvents: respiração e alongar, uma vez por dia cada. */
  breath: 2,
  stretch: 2,
  /** Quebrar a sequência tira esta fração do calor já juntado no estágio atual (sem regredir de estágio). */
  breakPenalty: 0.2,
} as const;

/**
 * Estágios e calibração.
 *
 * Referência: alguém constante estuda 6 dias por semana (de 1h30 a 2h30) e cuida dos hábitos básicos.
 *   dia de estudo típico ≈ estudo (5–8, média 6,5) + água 2 + humor 1 + tarefas 3
 *                          + leitura/exercício/relato em parte dos dias (~2)              ≈ 14,5
 *   dia de descanso      ≈ água + humor + às vezes exercício                             ≈ 3,5
 *   semana               ≈ 6 × 14,5 + 3,5 ≈ 90  →  média ≈ 13 de calor por dia.
 * Limiares = 13 × dias até cada evolução (o máximo num dia é 25, então ninguém "pula" meses):
 *   Chama       13 × 14  (~2 semanas) =  182
 *   Labareda    13 × 60  (~2 meses)   =  780
 *   Fogo-fátuo  13 × 150 (~5 meses)   = 1950
 *   Chama Azul  13 × 270 (~9 meses)   = 3510
 * Cada degrau é maior que o anterior (182 → 598 → 1170 → 1560): cada evolução é mais difícil.
 */
export const HEAT_PER_DAY_REF = 13;
export const STAGES = [
  { name: "Faísca", at: 0 },
  { name: "Chama", at: HEAT_PER_DAY_REF * 14 },
  { name: "Labareda", at: HEAT_PER_DAY_REF * 60 },
  { name: "Fogo-fátuo", at: HEAT_PER_DAY_REF * 150 },
  { name: "Chama Azul", at: HEAT_PER_DAY_REF * 270 },
] as const;

export function stageOf(total: number) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (total >= STAGES[i].at) s = i;
  return s;
}

/* ---------- Um dia ---------- */

export type DayInput = {
  day: string;
  focusMin: number;
  water: number;
  readingMin: number;
  mood: boolean;
  exercise: boolean;
  journal: boolean;
  tasksDone: number;
  tasksTotal: number;
  /** heatEvents do dia, somados por motivo (ex.: { breath: 2, stretch: 2 }) */
  events: Record<string, number>;
};

export type Goals = { water: number; reading: number };

export type ChecklistItem = {
  key: "study" | "tasks" | "water" | "reading" | "mood" | "exercise" | "journal" | "breath" | "stretch";
  label: string;
  icon: string;
  /** calor ganho hoje com este item */
  heat: number;
  /** calor máximo possível com este item */
  max: number;
  done: boolean;
  /** dica curta (o que falta / próximo degrau) */
  hint?: string;
  href?: string;
};

export const emptyDay = (day: string): DayInput => ({
  day,
  focusMin: 0,
  water: 0,
  readingMin: 0,
  mood: false,
  exercise: false,
  journal: false,
  tasksDone: 0,
  tasksTotal: 0,
  events: {},
});

export function studyHeat(min: number) {
  let h = 0;
  for (const s of HEAT.study) if (min >= s.min) h = s.heat;
  return h;
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(Math.round(m % 60)).padStart(2, "0") : ""}` : `${Math.round(m)} min`);

/** Calor de um dia e o checklist do que já foi feito. */
export function heatOfDay(d: DayInput, goals: Goals): { heat: number; items: ChecklistItem[] } {
  const waterGoal = Math.max(1, goals.water);
  const readingGoal = Math.max(1, goals.reading);
  const sh = studyHeat(d.focusMin);
  const next = HEAT.study.find((s) => d.focusMin < s.min);
  const maxStudy = HEAT.study[HEAT.study.length - 1].heat;
  const tasksOk = d.tasksTotal > 0 && d.tasksDone >= d.tasksTotal;
  const breath = Math.min(HEAT.breath, d.events.breath ?? 0);
  const stretch = Math.min(HEAT.stretch, d.events.stretch ?? 0);
  // outros heatEvents (futuros) entram no total sem item próprio
  const otherEvents = Object.entries(d.events)
    .filter(([k]) => k !== "breath" && k !== "stretch")
    .reduce((a, [, v]) => a + Math.max(0, v), 0);

  const items: ChecklistItem[] = [
    {
      key: "study",
      label: "Estudar (mais horas, mais calor)",
      icon: "emoji/cronometro.webp",
      heat: sh,
      max: maxStudy,
      done: sh > 0,
      hint: next
        ? `${fmtMin(d.focusMin)} hoje · ${fmtMin(next.min)} = +${next.heat - sh}`
        : `${fmtMin(d.focusMin)} hoje · calor máximo!`,
      href: "/foco",
    },
    {
      key: "tasks",
      label: "Concluir todas as tarefas do dia",
      icon: "emoji/tarefas.webp",
      heat: tasksOk ? HEAT.allTasks : 0,
      max: HEAT.allTasks,
      done: tasksOk,
      hint: d.tasksTotal ? `${d.tasksDone}/${d.tasksTotal} feitas` : "nenhuma tarefa ainda",
      href: "/",
    },
    {
      key: "water",
      label: `Beber ${waterGoal} copos de água`,
      icon: "emoji/agua.webp",
      heat: d.water >= waterGoal ? HEAT.water : 0,
      max: HEAT.water,
      done: d.water >= waterGoal,
      hint: `${Math.min(d.water, waterGoal)}/${waterGoal} copos`,
      href: "/",
    },
    {
      key: "reading",
      label: `Ler ${readingGoal} min`,
      icon: "livros.png",
      heat: d.readingMin >= readingGoal ? HEAT.reading : 0,
      max: HEAT.reading,
      done: d.readingMin >= readingGoal,
      hint: `${Math.min(d.readingMin, readingGoal)}/${readingGoal} min`,
      href: "/",
    },
    { key: "mood", label: "Registrar o humor do dia", icon: "emoji/humor.webp", heat: d.mood ? HEAT.mood : 0, max: HEAT.mood, done: d.mood, href: "/" },
    { key: "exercise", label: "Fazer exercício físico", icon: "emoji/exercicio.webp", heat: d.exercise ? HEAT.exercise : 0, max: HEAT.exercise, done: d.exercise, href: "/" },
    { key: "journal", label: "Escrever no diário", icon: "emoji/livro.webp", heat: d.journal ? HEAT.journal : 0, max: HEAT.journal, done: d.journal, href: "/diario" },
    { key: "breath", label: "Pausa para respirar (no Foco)", icon: "emoji/lua.webp", heat: breath, max: HEAT.breath, done: breath > 0, href: "/foco" },
    { key: "stretch", label: "Pausa para alongar (no Foco)", icon: "emoji/sol.webp", heat: stretch, max: HEAT.stretch, done: stretch > 0, href: "/foco" },
  ];
  return { heat: items.reduce((a, i) => a + i.heat, 0) + otherEvents, items };
}

/* ---------- A sequência dia a dia ---------- */

/**
 * Percorre os dias com as mesmas regras de `computeStreak` (lenha, descanso, hoje não quebra),
 * mas dizendo em que dias a sequência quebrou. O teste garante que o fim bate com `computeStreak`.
 */
export function streakTimeline(studiedDays: Iterable<string>, today: string, restDays?: Iterable<string>) {
  const set = new Set(studiedDays);
  const rest = new Set(restDays ?? []);
  const sorted = [...set].filter((d) => d <= today).sort();
  const breaks: string[] = [];
  let best = 0;
  if (!sorted.length) return { breaks, best, streak: 0 };
  let streak = 0;
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
      // o dia ainda não acabou / descanso planejado
    } else if (firewood > 0) {
      firewood--;
    } else {
      if (streak > 0) breaks.push(d);
      streak = 0;
      sinceWood = 0;
    }
  }
  return { breaks, best, streak };
}

/* ---------- Histórico inteiro ---------- */

export type HeatHistory = {
  total: number;
  stage: number;
  stageName: string;
  /** calor dentro do estágio atual */
  intoStage: number;
  /** tamanho do estágio atual (0 no último) */
  stageSpan: number;
  todayHeat: number;
  todayChecklist: ChecklistItem[];
  /** quedas de calor por quebra da sequência */
  penalties: { day: string; lost: number }[];
  streak: StreakInfo;
  bestStreak: number;
  studiedDays: number;
  focusMin: number;
};

export function heatHistory(o: { days: DayInput[]; today: string; goals: Goals; restDays?: Iterable<string>; from?: string }): HeatHistory {
  const byDay = new Map(o.days.filter((d) => d.day <= o.today).map((d) => [d.day, d]));
  const studied = [...byDay.values()].filter((d) => d.focusMin > 0).map((d) => d.day);
  const rest = [...(o.restDays ?? [])];
  const streak = computeStreak(studied, o.today, rest);
  const tl = streakTimeline(studied, o.today, rest);
  const breaks = new Set(tl.breaks);

  let total = 0;
  const penalties: { day: string; lost: number }[] = [];
  const first = [...byDay.keys(), o.from ?? o.today].sort()[0];
  for (let d = first; d <= o.today; d = addDays(d, 1)) {
    const day = byDay.get(d);
    if (day) total += heatOfDay(day, o.goals).heat;
    if (breaks.has(d)) {
      const into = total - STAGES[stageOf(total)].at;
      const lost = Math.round(into * HEAT.breakPenalty);
      if (lost > 0) {
        total -= lost;
        penalties.push({ day: d, lost });
      }
    }
  }
  const stage = stageOf(total);
  const next = STAGES[stage + 1];
  const today = heatOfDay(byDay.get(o.today) ?? emptyDay(o.today), o.goals);
  return {
    total,
    stage,
    stageName: STAGES[stage].name,
    intoStage: total - STAGES[stage].at,
    stageSpan: next ? next.at - STAGES[stage].at : 0,
    todayHeat: today.heat,
    todayChecklist: today.items,
    penalties,
    streak,
    bestStreak: tl.best,
    studiedDays: studied.length,
    focusMin: [...byDay.values()].reduce((a, d) => a + d.focusMin, 0),
  };
}

/* ---------- Humor ---------- */

export type PetMood = "happy" | "calm" | "sleepy" | "sad";

/** Hora (0–23) em São Paulo. */
export function spHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
}

/**
 * Feliz quando estudou hoje; triste/apagado quando a lenha queimou ontem, a sequência quebrou ontem
 * ou a sequência está zerada depois de já ter quebrado; sonolento a partir das 18h sem estudo;
 * calmo no resto do tempo.
 */
export function petMood(o: { today: string; hour: number; streak: StreakInfo; penalties: { day: string }[]; breaks?: string[] }): PetMood {
  if (o.streak.studiedToday) return "happy";
  const y = addDays(o.today, -1);
  if (o.streak.burned.includes(y) || o.penalties.some((p) => p.day === y) || o.breaks?.includes(y)) return "sad";
  // sequência apagada depois de uma quebra: continua tristinho até reacender
  if (o.streak.streak === 0 && (o.penalties.length > 0 || (o.breaks?.length ?? 0) > 0)) return "sad";
  if (o.hour >= 18) return "sleepy";
  return "calm";
}

/* ---------- Acessórios ---------- */

export const ACCESSORIES = [
  { id: "oculos", name: "Óculos escuros", emoji: "🕶️", need: "7 dias seguidos de estudo", target: 7, stat: "bestStreak" },
  { id: "bone", name: "Boné", emoji: "🧢", need: "30 dias estudados", target: 30, stat: "studiedDays" },
  { id: "fone", name: "Fone", emoji: "🎧", need: "50 horas de foco", target: 50, stat: "focusHours" },
  { id: "coroa", name: "Coroa", emoji: "👑", need: "Chegar à Chama Azul", target: 4, stat: "stage" },
  { id: "cachecol", name: "Cachecol", emoji: "🧣", need: "10 simulados ou partes", target: 10, stat: "examParts" },
] as const;

export type AccessoryId = (typeof ACCESSORIES)[number]["id"];
export const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id) as AccessoryId[];

export type AccessoryStats = { bestStreak: number; studiedDays: number; focusHours: number; stage: number; examParts: number };

export function accessoryProgress(s: AccessoryStats) {
  return ACCESSORIES.map((a) => {
    const value = s[a.stat];
    return { id: a.id, name: a.name, emoji: a.emoji, need: a.need, target: a.target, value: Math.min(value, a.target), unlocked: value >= a.target };
  });
}

export const accessoryEmoji = (id: string | null | undefined) => ACCESSORIES.find((a) => a.id === id)?.emoji ?? "";

/**
 * A voz das notificações: o acessório equipado dá o jeitinho de falar do foguinho.
 * Quem manda notificação (`notify`) pode usar isto para assinar a mensagem na voz do bichinho.
 */
export function petVoice(name: string, accessory: string | null | undefined) {
  const voices: Record<string, { tone: string; sign: string }> = {
    oculos: { tone: "descolado", sign: `😎 ${name}` },
    bone: { tone: "animado, de treinador", sign: `🧢 ${name}` },
    fone: { tone: "concentrado e tranquilo", sign: `🎧 ${name}` },
    coroa: { tone: "majestoso e orgulhoso", sign: `👑 ${name}` },
    cachecol: { tone: "aconchegante e cuidadoso", sign: `🧣 ${name}` },
  };
  return voices[accessory ?? ""] ?? { tone: "doce e animado", sign: `🔥 ${name}` };
}
