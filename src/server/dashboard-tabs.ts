import "server-only";
import { and, count, desc, eq, gte, isNotNull, lte, sql, type SQLWrapper } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf, TZ, weekStart, WEEKDAYS } from "@/lib/day";
import { levelFromXp } from "@/lib/levels";
import { ACHIEVEMENTS, unlockText } from "@/lib/achievements";
import { avatarUrl } from "@/lib/avatar";
import { getMapa } from "./mapa-queries";
import { firstName, getUser, totalXp } from "./queries";
import { restDaysOf } from "./schedule";
import { getRecentAchievements } from "./achievements";

const { users, focusSessions: fs, xpEvents, questionAttempts, scheduleBlocks, achievements } = schema;

const num = (s: SQLWrapper) => sql<number>`coalesce(${s}, 0)`.mapWith(Number);
const localDay = (col: SQLWrapper) => sql<string>`(((${col} at time zone 'UTC') at time zone '${sql.raw(TZ)}')::date)::text`;
/** Meia-noite de Brasília (UTC−3) do dia, em UTC. */
const midnightUtc = (day: string) => new Date(`${day}T03:00:00Z`);

/* ---------- Semana ---------- */

export async function getWeekTab(userId: string) {
  const db = getDb();
  const today = dayOf();
  const ws = weekStart(today);
  const lastWs = addDays(ws, -7);
  const we = addDays(ws, 6);
  const [u, focus, bank, xp, blocks] = await Promise.all([
    getUser(userId),
    db
      .select({
        day: fs.day,
        min: num(sql`sum(${fs.durationMin})`),
        done: num(sql`sum(${fs.questionsDone})`),
        correct: num(sql`sum(${fs.questionsCorrect})`),
      })
      .from(fs)
      .where(and(eq(fs.userId, userId), isNotNull(fs.endedAt), gte(fs.day, lastWs), lte(fs.day, we)))
      .groupBy(fs.day),
    db
      .select({
        day: localDay(questionAttempts.at),
        done: num(count()),
        correct: num(sql`sum(case when ${questionAttempts.correct} then 1 else 0 end)`),
      })
      .from(questionAttempts)
      .where(and(eq(questionAttempts.userId, userId), gte(questionAttempts.at, midnightUtc(lastWs))))
      .groupBy(sql`1`),
    db
      .select({ day: xpEvents.day, xp: num(sql`sum(${xpEvents.amount})`) })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), gte(xpEvents.day, lastWs), lte(xpEvents.day, we)))
      .groupBy(xpEvents.day),
    db
      .select({
        cur: sql<boolean>`${scheduleBlocks.day} >= ${ws}`,
        total: num(count()),
        done: num(count(scheduleBlocks.doneAt)),
      })
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.userId, userId), gte(scheduleBlocks.day, lastWs), lte(scheduleBlocks.day, we)))
      .groupBy(sql`1`),
  ]);
  if (!u) throw new Error("Usuário não encontrado");

  const rest = new Set(restDaysOf(u, we));
  const byDay = new Map<string, { min: number; done: number; correct: number; xp: number }>();
  const at = (d: string) => byDay.get(d) ?? byDay.set(d, { min: 0, done: 0, correct: 0, xp: 0 }).get(d)!;
  for (const r of focus) if (r.day) Object.assign(at(r.day), { min: r.min, done: at(r.day).done + r.done, correct: at(r.day).correct + r.correct });
  for (const r of bank) if (r.day) Object.assign(at(r.day), { done: at(r.day).done + r.done, correct: at(r.day).correct + r.correct });
  for (const r of xp) at(r.day).xp = r.xp;

  const sumWeek = (from: string) => {
    const t = { min: 0, done: 0, correct: 0, xp: 0 };
    for (let i = 0; i < 7; i++) {
      const v = byDay.get(addDays(from, i));
      if (v) (Object.keys(t) as (keyof typeof t)[]).forEach((k) => (t[k] += v[k]));
    }
    return t;
  };
  const cur = sumWeek(ws);
  const prev = sumWeek(lastWs);
  const blk = (c: boolean) => blocks.find((b) => !!b.cur === c) ?? { total: 0, done: 0 };

  const days = WEEKDAYS.map((label, i) => {
    const day = addDays(ws, i);
    const v = byDay.get(day);
    const isRest = rest.has(day) && !(v?.min ?? 0);
    return {
      label,
      day,
      min: Math.round(v?.min ?? 0),
      goalMin: isRest ? 0 : u.focusGoalMin,
      xp: v?.xp ?? 0,
      today: day === today,
      future: day > today,
      rest: isRest,
    };
  });
  const best = days.reduce<(typeof days)[number] | null>((b, d) => (d.min > (b?.min ?? 0) ? d : b), null);

  return {
    days,
    goalMin: days.reduce((s, d) => s + d.goalMin, 0),
    cur: { ...cur, blocksDone: blk(true).done, blocksTotal: blk(true).total },
    prev: { ...prev, blocksDone: blk(false).done, blocksTotal: blk(false).total },
    weeklyXpGoal: u.weeklyXpGoal,
    best: best ? { label: best.label, day: best.day, min: best.min } : null,
    goalDays: days.filter((d) => d.goalMin > 0 && d.min >= d.goalMin).length,
  };
}

export type WeekTabData = Awaited<ReturnType<typeof getWeekTab>>;

/* ---------- Jornada ---------- */

export async function getJourneyTab(userId: string) {
  const [mapa, xp, unlocked] = await Promise.all([
    getMapa(userId),
    totalXp(userId),
    getDb()
      .select({ key: achievements.key, tier: achievements.tier, at: achievements.unlockedAt })
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .orderBy(desc(achievements.unlockedAt))
      .limit(12),
  ]);
  return {
    phases: mapa.phases.map((p) => ({ phase: p.phase, total: p.total, mastered: p.mastered, theory: p.theory, practice: p.practice })),
    level: levelFromXp(xp),
    totalXp: xp,
    achievements: unlocked.flatMap((a) => {
      const t = unlockText(a);
      return t ? [{ key: a.key, tier: a.tier, name: t.name, icon: t.icon, stars: t.stars }] : [];
    }),
  };
}

export type JourneyTabData = Awaited<ReturnType<typeof getJourneyTab>>;

/* ---------- Ranking & Conquistas ---------- */

/**
 * Ranking semanal + conquistas recentes.
 *
 * PONTO DE INTEGRAÇÃO (Grupos): hoje "o grupo" é todo mundo do app, porque o uso é privado entre
 * amigos. Quando `src/server/groups.ts` existir, troque só a consulta `people` abaixo pelos membros
 * do grupo da pessoa (algo como `getGroupMembers(userId)`); o resto (horas/XP/questões da semana,
 * privacidade e conquistas recentes) continua igual.
 */
export async function getRankingTab(userId: string) {
  const db = getDb();
  const today = dayOf();
  const ws = weekStart(today);
  // o grupo: todo mundo do app (uso privado entre amigos)
  const [people, focus, bank, xp, recent, mine] = await Promise.all([
    db.select({ id: users.id, name: users.name, image: users.image, privacy: users.privacy }).from(users),
    db
      .select({ userId: fs.userId, min: num(sql`sum(${fs.durationMin})`), done: num(sql`sum(${fs.questionsDone})`) })
      .from(fs)
      .where(and(isNotNull(fs.endedAt), gte(fs.day, ws)))
      .groupBy(fs.userId),
    db
      .select({ userId: questionAttempts.userId, done: num(count()) })
      .from(questionAttempts)
      .where(gte(questionAttempts.at, midnightUtc(ws)))
      .groupBy(questionAttempts.userId),
    db
      .select({ userId: xpEvents.userId, xp: num(sql`sum(${xpEvents.amount})`) })
      .from(xpEvents)
      .where(gte(xpEvents.day, ws))
      .groupBy(xpEvents.userId),
    getRecentAchievements(userId, 8),
    db
      .select({ n: num(sql`count(distinct ${achievements.key})`), stars: num(count()) })
      .from(achievements)
      .where(eq(achievements.userId, userId)),
  ]);
  const fMap = new Map(focus.map((r) => [r.userId, r]));
  const bMap = new Map(bank.map((r) => [r.userId, r.done]));
  const xMap = new Map(xp.map((r) => [r.userId, r.xp]));
  const rows = people.map((p) => {
    const me = p.id === userId;
    const hide = !me && !!p.privacy?.hideHours;
    return {
      id: p.id,
      me,
      name: me ? "Você" : firstName(p.name),
      image: avatarUrl(p.id, p.image),
      /** null = escondido pela privacidade */
      hours: hide ? null : Math.round(((fMap.get(p.id)?.min ?? 0) / 60) * 10) / 10,
      xp: xMap.get(p.id) ?? 0,
      questions: (fMap.get(p.id)?.done ?? 0) + (bMap.get(p.id) ?? 0),
    };
  });
  return {
    weekStart: ws,
    now: Date.now(),
    rows,
    recent,
    unlocked: mine[0]?.n ?? 0,
    stars: mine[0]?.stars ?? 0,
    total: ACHIEVEMENTS.length,
  };
}

export type RankingTabData = Awaited<ReturnType<typeof getRankingTab>>;
