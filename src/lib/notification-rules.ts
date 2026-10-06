// Regras das notificações do foguinho (estilo Duolingo). Funções puras: o cron junta os dados e chama planNotifications.
import { addDays } from "./day";
import type { StudyMode } from "./game";

/** Tipos que a pessoa pode ligar/desligar em /config. */
export const NOTIF_KINDS = [
  { kind: "streak", label: "Sequência em risco", hint: "À noite, se você ainda não estudou" },
  { kind: "plan", label: "Plano do dia", hint: "De manhã, o bloco do cronograma e a revisão de hoje" },
  { kind: "review", label: "Revisões atrasadas", hint: "Quando uma matéria fica sem revisão" },
  { kind: "friend", label: "Amigos estudando", hint: "Quando alguém estudou e você não" },
  { kind: "water", label: "Água", hint: "Um lembrete no meio da tarde" },
  { kind: "enem", label: "Contagem pro ENEM", hint: "Nos marcos de 100, 60, 30, 14, 7, 3 e 1 dia" },
  { kind: "firewood", label: "Lenha queimada", hint: "Quando a lenha salvou a sequência" },
  { kind: "cold", label: "Foguinho esfriando", hint: "Depois de dois dias sem estudar" },
  { kind: "poke", label: "Cutucadas", hint: "Quando um amigo te cutuca" },
  { kind: "reaction", label: "Reações e comentários", hint: "No seu feed" },
  { kind: "achievement", label: "Conquistas e missões", hint: "Quando você desbloqueia algo" },
] as const;

/** Tipos que obedecem a uma mesma chave nas preferências. */
const PREF_ALIAS: Record<string, string> = { comment: "reaction", mission: "achievement", streak2: "streak" };

export type NotifPrefs = { off?: string[]; quietStart?: number; quietEnd?: number };
export const DEFAULT_QUIET = { start: 22, end: 8 };

export const ENEM_MILESTONES = [100, 60, 30, 14, 7, 3, 1];

export function quietRange(p: NotifPrefs) {
  return { start: p.quietStart ?? DEFAULT_QUIET.start, end: p.quietEnd ?? DEFAULT_QUIET.end };
}

/** Horário de silêncio (hora local 0–23). Início = fim desliga o silêncio. */
export function isQuiet(hour: number, p: NotifPrefs) {
  const { start, end } = quietRange(p);
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export function kindEnabled(kind: string, p: NotifPrefs) {
  const k = PREF_ALIAS[kind] ?? kind;
  return !(p.off ?? []).includes(k);
}

/** Dias até o ENEM, se hoje for um dos marcos. */
export function enemMilestone(today: string, enemDate: string | null | undefined) {
  if (!enemDate) return null;
  const left = Math.round((Date.parse(`${enemDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return ENEM_MILESTONES.includes(left) ? left : null;
}

/** Hora e dia no fuso de Brasília. */
export function localClock(d: Date, tz = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

export type RuleInput = {
  /** hora local (Brasília) */
  now: { day: string; hour: number; minute: number };
  user: { id: string; firstName: string; petName: string; enemDate: string | null; waterGoal: number; prefs: NotifPrefs };
  mode: StudyMode;
  streak: { streak: number; burned: string[]; studiedToday: boolean };
  studiedYesterday: boolean;
  /** já estudou alguma vez */
  everStudied: boolean;
  waterCups: number;
  /** revisão mais atrasada: há quantos dias a matéria está sem revisão */
  overdueReview: { subject: string; topic: string; days: number } | null;
  /** primeiro bloco do cronograma de hoje que ainda não foi feito (+ quantos faltam) */
  todayBlock: { subject: string; topic: string; kind: "study" | "review"; min: number; left: number } | null;
  /** matéria que a pessoa mais estudou nos últimos dias (para o "ciúmes") */
  favoriteSubject: string | null;
  /** amigo que mais estudou hoje */
  friend: { name: string; minutes: number } | null;
};

export type PlannedNotification = { kind: string; title: string; body: string; url: string; dedupe: string };

type Ctx = RuleInput & { pet: string; extra: Record<string, string | number> };
type Phrase = (c: Ctx) => string;
type Phrases = Record<StudyMode, Phrase[]>;

const hm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m} min`;
};
const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Dados da frase do "plano do dia". */
const planExtra = (b: NonNullable<RuleInput["todayBlock"]>) => ({
  subject: b.subject,
  topic: b.topic,
  time: hm(b.min),
  what: b.kind === "review" ? "revisão" : "estudo",
  left: b.left,
});

// Baixo: insistente. Regular: amigo. Avançado: comemorativo.
const PHRASES: Record<string, { title: string; url: string; text: Phrases }> = {
  streak: {
    title: "🔥 Sequência em risco",
    url: "/foco",
    text: {
      Baixo: [
        (c) => `${dias(c.streak.streak)} de foguinho. Não vai deixar apagar por 25 minutinhos, né?`,
        (c) => `${c.pet} tá olhando pra você. ${dias(c.streak.streak)} de sequência vão pro lixo se hoje passar em branco.`,
        (c) => `Ei, ${c.user.firstName}. Só 25 minutos e a sequência de ${dias(c.streak.streak)} continua viva. Só 25!`,
        (c) => `O dia tá acabando e o ${c.pet} ainda tá com fome. Um foco rapidinho resolve.`,
      ],
      Regular: [
        (c) => `${dias(c.streak.streak)} de foguinho. Não vai deixar apagar por 25 minutinhos, né?`,
        (c) => `${c.pet} guardou um lugar no sofá pra você estudar. A sequência de ${dias(c.streak.streak)} agradece.`,
        (c) => `Falta só o de hoje pra sequência chegar a ${dias(c.streak.streak + 1)}. Bora?`,
      ],
      Avançado: [
        (c) => `${dias(c.streak.streak)} seguidos, que fase! Falta só o de hoje pra fechar com chave de ouro.`,
        (c) => `Máquina! ${dias(c.streak.streak)} de foguinho. Um foco hoje e o ${c.pet} chega a ${dias(c.streak.streak + 1)}.`,
        (c) => `${c.pet} já separou a comemoração dos ${dias(c.streak.streak + 1)}. Só falta você aparecer hoje.`,
      ],
    },
  },
  streak2: {
    title: "🚨 Última chamada",
    url: "/foco",
    text: {
      Baixo: [
        (c) => `Sério, ${c.user.firstName}: o ${c.pet} vai apagar à meia-noite. 25 minutos. Agora.`,
        (c) => `Último aviso do ${c.pet}: ${dias(c.streak.streak)} de sequência dependem dos próximos minutos.`,
      ],
      Regular: [(c) => `Ainda dá tempo! Um foco curtinho e os ${dias(c.streak.streak)} de sequência continuam.`],
      Avançado: [(c) => `Ainda dá tempo de manter os ${dias(c.streak.streak)}. Você não chegou até aqui à toa.`],
    },
  },
  plan: {
    title: "📅 O plano de hoje",
    url: "/cronograma",
    text: {
      Baixo: [
        (c) => `Hoje o cronograma pediu ${c.extra.what}: ${c.extra.topic}, ${c.extra.time}. Começa agora que depois enrola.`,
        (c) => `${c.pet} já abriu o caderno em ${c.extra.topic} (${c.extra.time}). Falta só você sentar.`,
        (c) => `Bom dia, ${c.user.firstName}! ${c.extra.time} de ${c.extra.subject} esperando por você hoje.`,
      ],
      Regular: [
        (c) => `Hoje tem ${c.extra.what} de ${c.extra.topic}: ${c.extra.time}. Bora começar?`,
        (c) => `Bom dia! O cronograma de hoje abre com ${c.extra.subject} (${c.extra.time}).`,
      ],
      Avançado: [
        (c) => `Bom dia, máquina! Hoje: ${c.extra.topic}, ${c.extra.time}. ${c.pet} já está de olho.`,
        (c) => `Plano de hoje pronto: ${c.extra.what} de ${c.extra.topic} em ${c.extra.time}. Mais um dia impecável?`,
      ],
    },
  },
  review: {
    title: "🧠 Revisão atrasada",
    url: "/cronograma",
    text: {
      Baixo: [
        (c) => `${c.extra.subject} está há ${dias(Number(c.extra.days))} sem revisão. Ela tá com ciúmes da ${c.extra.rival}.`,
        (c) => `${c.extra.subject} tá esquecida há ${dias(Number(c.extra.days))}. Se não revisar, ela vai embora da sua cabeça.`,
        (c) => `${c.pet} achou ${c.extra.subject} chorando num canto: ${dias(Number(c.extra.days))} sem revisão.`,
      ],
      Regular: [
        (c) => `${c.extra.subject} está há ${dias(Number(c.extra.days))} sem revisão. Ela tá com ciúmes da ${c.extra.rival}.`,
        (c) => `Revisão de ${c.extra.topic} na fila. 15 minutinhos e ela sai da lista.`,
      ],
      Avançado: [
        (c) => `Você tá voando em ${c.extra.rival}! Só não esquece de ${c.extra.subject}: ${dias(Number(c.extra.days))} sem revisão.`,
        (c) => `Revisão de ${c.extra.topic} pendente. Uma passada rápida e a memória fica blindada.`,
      ],
    },
  },
  friend: {
    title: "👀 Olha quem estudou",
    url: "/grupos",
    text: {
      Baixo: [
        (c) => `O ${c.extra.name} estudou ${c.extra.time} hoje. Você estudou… vamos mudar isso?`,
        (c) => `${c.extra.name}: ${c.extra.time} de estudo hoje. Você: 0. O ${c.pet} tá com vergonha.`,
      ],
      Regular: [
        (c) => `O ${c.extra.name} estudou ${c.extra.time} hoje. Você estudou… vamos mudar isso?`,
        (c) => `${c.extra.name} já fez ${c.extra.time} hoje. Que tal entrar no ritmo?`,
      ],
      Avançado: [
        (c) => `${c.extra.name} já fez ${c.extra.time} hoje. Bora mostrar quem manda no ranking?`,
        (c) => `O ${c.extra.name} tá encostando: ${c.extra.time} hoje. Hora de abrir vantagem!`,
      ],
    },
  },
  water: {
    title: "💧 Pausa estratégica",
    url: "/",
    text: {
      Baixo: [(c) => `Bebe uma água aí, ${c.user.firstName}. Cérebro seco não aprende.`, () => `Pausa estratégica: bebe uma água aí.`],
      Regular: [() => `Pausa estratégica: bebe uma água aí.`, (c) => `${c.pet} lembrou: um copo d'água agora e o foco volta melhor.`],
      Avançado: [() => `Atleta dos estudos se hidrata. Um copo d'água agora!`, () => `Pausa estratégica: bebe uma água aí.`],
    },
  },
  enem: {
    title: "🎯 Contagem pro ENEM",
    url: "/cronograma",
    text: {
      Baixo: [
        (c) => `Faltam ${dias(Number(c.extra.left))} pro ENEM. Cada dia sem estudar conta, viu?`,
        (c) => `${dias(Number(c.extra.left))} pro ENEM. O ${c.pet} acredita em você, mas precisa te ver estudando.`,
      ],
      Regular: [(c) => `Faltam ${dias(Number(c.extra.left))} pro ENEM. Um passo por dia e chega.`],
      Avançado: [
        (c) => `Faltam ${dias(Number(c.extra.left))} pro ENEM, e você tá no ritmo certo. Rumo aos 160+!`,
        (c) => `${dias(Number(c.extra.left))} pro ENEM. Com essa constância, o ${c.pet} já tá vendo a aprovação.`,
      ],
    },
  },
  firewood: {
    title: "🛡️ A lenha salvou",
    url: "/foguinho",
    text: {
      Baixo: [
        () => `Sua lenha protegeu o foguinho ontem. Hoje é com você!`,
        (c) => `Ontem a lenha segurou as pontas. Hoje não tem mais desculpa, ${c.user.firstName}.`,
      ],
      Regular: [() => `Sua lenha protegeu o foguinho ontem. Hoje é com você!`],
      Avançado: [(c) => `Sua lenha protegeu o ${c.pet} ontem. Hoje é dia de voltar com tudo!`],
    },
  },
  cold: {
    title: "🥶 Foguinho esfriando",
    url: "/foco",
    text: {
      Baixo: [
        (c) => `${c.pet} tá ficando com frio. Bora estudar?`,
        (c) => `${c.pet} tá tremendo aqui. Dois dias sem estudo… só você pode esquentar ele.`,
        (c) => `Brrr. ${c.pet} tá virando cinza. Um foco de 25 minutos acende de novo.`,
      ],
      Regular: [(c) => `${c.pet} tá ficando com frio. Bora estudar?`],
      Avançado: [(c) => `${c.pet} sentiu sua falta esses dias. Bora voltar com tudo?`],
    },
  },
};

const PRIORITY = ["streak2", "streak", "firewood", "plan", "enem", "review", "friend", "cold", "water"];

/** Hash simples para variar a frase de forma estável (o mesmo dia e tipo sempre dão a mesma frase). */
export function pick<T>(list: T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

function build(kind: string, c: Ctx, dedupe: string): PlannedNotification {
  const p = PHRASES[kind];
  const phrases = p.text[c.mode].length ? p.text[c.mode] : p.text.Regular;
  return { kind: kind === "streak2" ? "streak" : kind, title: p.title, body: pick(phrases, `${c.user.id}:${dedupe}`)(c), url: p.url, dedupe };
}

/**
 * Decide o que mandar agora para uma pessoa (todos os candidatos, do mais importante ao menos).
 * O dedupe é por dia: quem chama filtra os que já foram enviados.
 */
export function planNotifications(input: RuleInput): PlannedNotification[] {
  const { now, user, streak } = input;
  if (isQuiet(now.hour, user.prefs)) return [];
  const c: Ctx = { ...input, pet: user.petName || "Brasa", extra: {} };
  const day = now.day;
  const out: PlannedNotification[] = [];
  const add = (kind: string, dedupe: string, extra: Record<string, string | number> = {}) => {
    if (!kindEnabled(kind, user.prefs)) return;
    out.push(build(kind, { ...c, extra }, dedupe));
  };

  const studied = streak.studiedToday;

  // sequência em risco: a partir das 19h; no modo Baixo (insistente), avisa de novo às 21h
  if (!studied && streak.streak > 0 && now.hour >= 19) {
    add("streak", `streak:${day}`);
    if (now.hour >= 21 && input.mode === "Baixo") add("streak2", `streak2:${day}`);
  }

  // lenha queimada ontem: de manhã
  const yesterday = addDays(day, -1);
  if (streak.burned.includes(yesterday) && now.hour >= 8) add("firewood", `firewood:${yesterday}`);

  // plano do dia (bloco do cronograma / revisão de hoje): de manhã, se ainda não estudou
  const b = input.todayBlock;
  if (!studied && b && now.hour >= 8 && now.hour < 12) add("plan", `plan:${day}`, planExtra(b));

  // contagem pro ENEM nos marcos
  const left = enemMilestone(day, user.enemDate);
  if (left !== null && now.hour >= 9) add("enem", `enem:${user.enemDate}:${left}`, { left });

  // revisão vencida: no fim da tarde
  const r = input.overdueReview;
  if (r && r.days >= 2 && now.hour >= 16) {
    const rival = input.favoriteSubject && input.favoriteSubject !== r.subject ? input.favoriteSubject : "Biologia";
    add("review", `review:${day}`, { subject: r.subject, topic: r.topic, days: r.days, rival: rival === r.subject ? "Física" : rival });
  }

  // amigo estudou e você não
  const f = input.friend;
  if (!studied && f && f.minutes >= 30 && now.hour >= 15) add("friend", `friend:${day}`, { name: f.name, time: hm(f.minutes) });

  // foguinho esfriando: dois dias sem estudo
  if (!studied && !input.studiedYesterday && input.everStudied && now.hour >= 12) add("cold", `cold:${day}`);

  // água no meio da tarde
  if (now.hour >= 15 && now.hour < 17 && input.waterCups < user.waterGoal) add("water", `water:${day}`);

  const rank = (n: PlannedNotification) => PRIORITY.indexOf(n.dedupe.split(":")[0]);
  return out.sort((a, b) => rank(a) - rank(b));
}

/* ---------- Lembretes locais do APK ---------- */

export type LocalReminder = { id: number; at: string; title: string; body: string; url: string; kind: string };

/** Horário (hora local) de cada lembrete local do dia. */
const LOCAL_AT: Record<string, [number, number]> = { plan: [9, 0], water: [15, 30], review: [17, 0], streak: [20, 0] };

/**
 * Lembretes que o APK agenda localmente para hoje (sem push remoto no WebView).
 * `offsetMin` = diferença do fuso de Brasília para UTC em minutos (–180).
 */
export function planLocalReminders(input: RuleInput, nowMs: number, offsetMin = -180): LocalReminder[] {
  const out: LocalReminder[] = [];
  const c: Ctx = { ...input, pet: input.user.petName || "Brasa", extra: {} };
  const day = input.now.day;
  const at = (kind: string) => {
    const [h, m] = LOCAL_AT[kind];
    const utc = Date.parse(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`) - offsetMin * 60_000;
    return { h, utc };
  };
  const push = (kind: string, extra: Record<string, string | number> = {}) => {
    if (!kindEnabled(kind, input.user.prefs)) return;
    const { h, utc } = at(kind);
    if (utc <= nowMs || isQuiet(h, input.user.prefs)) return;
    const n = build(kind, { ...c, extra }, `${kind}:${day}`);
    // id numérico estável por tipo e dia (o Android exige int32)
    const id = Number(day.replaceAll("-", "").slice(2)) * 10 + Object.keys(LOCAL_AT).indexOf(kind);
    out.push({ id, at: new Date(utc).toISOString(), title: n.title, body: n.body, url: n.url, kind: n.kind });
  };
  if (input.todayBlock && !input.streak.studiedToday) push("plan", planExtra(input.todayBlock));
  if (input.waterCups < input.user.waterGoal) push("water");
  const r = input.overdueReview;
  if (r) {
    const rival = input.favoriteSubject && input.favoriteSubject !== r.subject ? input.favoriteSubject : "Biologia";
    push("review", { subject: r.subject, topic: r.topic, days: r.days, rival: rival === r.subject ? "Física" : rival });
  }
  if (!input.streak.studiedToday) {
    if (input.streak.streak > 0) push("streak");
  }
  return out;
}
