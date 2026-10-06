import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql, type SQLWrapper } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayOf, TZ } from "@/lib/day";
import { computeStreak } from "@/lib/game";
import { levelFromXp } from "@/lib/levels";
import {
  ACHIEVEMENT_BY_KEY,
  ACHIEVEMENTS,
  longestRun,
  newUnlocks,
  unlockText,
  viewOf,
  xpForTier,
  type Metrics,
  type Unlock,
} from "@/lib/achievements";
import { notify } from "./notify";
import { getUser, minutesByDay, totalXp } from "./queries";
import { restDaysOf } from "./schedule";
import { award } from "./xp";

const {
  users,
  achievements,
  focusSessions: fs,
  questionAttempts,
  questions,
  essays,
  examParts,
  xpEvents,
  studyNodes,
  reviews,
  scheduleBlocks,
  dailyTasks,
  habitLogs,
  feedReactions,
  feedComments,
  pokes,
} = schema;

const num = (s: SQLWrapper) => sql<number>`coalesce(${s}, 0)`.mapWith(Number);
/** Timestamp (UTC) na hora local do app. */
const local = (col: SQLWrapper) => sql`((${col} at time zone 'UTC') at time zone '${sql.raw(TZ)}')`;
const hourOf = (col: SQLWrapper) => sql`extract(hour from ${local(col)})`;

/** Métricas das conquistas, todas agregadas no SQL e em paralelo. */
export async function computeMetrics(userId: string): Promise<Metrics> {
  const db = getDb();
  const today = dayOf();
  const closed = and(eq(fs.userId, userId), isNotNull(fs.endedAt));
  const [u, mins, xp, focus, focusByArea, bankByArea, essay, exam, phases, mastered, rev, blocks, tasks, water, habits, reacts, comments, poked] =
    await Promise.all([
      getUser(userId),
      minutesByDay(userId),
      totalXp(userId),
      db
        .select({
          min: num(sql`sum(${fs.durationMin})`),
          n: num(count()),
          longest: num(sql`max(${fs.durationMin})`),
          early: num(sql`count(*) filter (where ${hourOf(fs.startedAt)} >= 4 and ${hourOf(fs.startedAt)} < 7)`),
          late: num(sql`count(*) filter (where ${hourOf(fs.startedAt)} >= 23 or ${hourOf(fs.startedAt)} < 4)`),
          perfect: num(sql`count(*) filter (where ${fs.questionsDone} >= 10 and ${fs.questionsCorrect} >= ${fs.questionsDone})`),
        })
        .from(fs)
        .where(closed),
      db
        .select({ area: fs.area, n: num(sql`sum(${fs.questionsDone})`) })
        .from(fs)
        .where(closed)
        .groupBy(fs.area),
      db
        .select({ area: questions.area, n: num(count()) })
        .from(questionAttempts)
        .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
        .where(eq(questionAttempts.userId, userId))
        .groupBy(questions.area),
      db
        .select({ n: num(count(essays.score)), best: num(sql`max(${essays.score})`) })
        .from(essays)
        .where(eq(essays.userId, userId)),
      db
        .select({
          best: num(sql`max(t.total)`),
          full: num(sql`count(*) filter (where t.parts = 4)`),
        })
        .from(
          db
            .select({
              total: sql<number>`sum(${examParts.correct})`.as("total"),
              parts: sql<number>`count(${examParts.correct})`.as("parts"),
            })
            .from(examParts)
            .where(and(eq(examParts.userId, userId), sql`${examParts.part} <> 'redacao'`))
            .groupBy(examParts.examId)
            .as("t"),
        ),
      // fase concluída = bônus do Mapa já dado (mapa:fase:<fase>)
      db
        .select({ n: num(count()) })
        .from(xpEvents)
        .where(and(eq(xpEvents.userId, userId), sql`${xpEvents.dedupe} like 'mapa:fase:%'`)),
      db
        .select({ n: num(count()) })
        .from(studyNodes)
        .where(and(eq(studyNodes.userId, userId), eq(studyNodes.level, "skill"), eq(studyNodes.mastery, true))),
      db
        .select({ n: num(count()) })
        .from(reviews)
        .where(and(eq(reviews.userId, userId), isNotNull(reviews.doneAt), sql`${local(reviews.doneAt)}::date <= ${reviews.dueDay}`)),
      db
        .select({ n: num(count()) })
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.userId, userId), isNotNull(scheduleBlocks.doneAt))),
      db
        .select({ n: num(count()) })
        .from(dailyTasks)
        .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.done, true))),
      // dias que bateram a meta de água (só a data; a sequência sai daqui)
      db
        .select({ day: habitLogs.day })
        .from(habitLogs)
        .innerJoin(users, eq(users.id, habitLogs.userId))
        .where(and(eq(habitLogs.userId, userId), sql`${habitLogs.waterCups} >= greatest(${users.waterGoal}, 1)`)),
      db
        .select({
          reading: num(sql`sum(${habitLogs.readingMin})`),
          exercise: num(sql`count(*) filter (where ${habitLogs.exercise})`),
          journal: num(sql`count(*) filter (where length(trim(coalesce(${habitLogs.journal}, ''))) > 0)`),
        })
        .from(habitLogs)
        .where(eq(habitLogs.userId, userId)),
      db.select({ n: num(count()) }).from(feedReactions).where(eq(feedReactions.userId, userId)),
      db.select({ n: num(count()) }).from(feedComments).where(eq(feedComments.userId, userId)),
      db.select({ n: num(count()) }).from(pokes).where(eq(pokes.fromId, userId)),
    ]);

  const studied = [...mins.keys()];
  const current = u ? computeStreak(studied, today, restDaysOf(u, today)).streak : 0;
  const byArea: Record<string, number> = {};
  for (const r of [...focusByArea, ...bankByArea]) byArea[r.area] = (byArea[r.area] ?? 0) + r.n;
  const f = focus[0];
  return {
    streak: Math.max(current, longestRun(studied)),
    focusMin: f.min,
    sessions: f.n,
    longestSessionMin: f.longest,
    bestDayMin: [...mins.values()].reduce((a, b) => Math.max(a, b), 0),
    earlySessions: f.early,
    lateSessions: f.late,
    perfectSessions: f.perfect,
    questions: Object.values(byArea).reduce((a, b) => a + b, 0),
    questionsByArea: byArea,
    essays: essay[0].n,
    essayBest: essay[0].best,
    examsFull: exam[0].full,
    examBest: exam[0].best,
    phasesDone: phases[0].n,
    masteredSkills: mastered[0].n,
    reviewsOnTime: rev[0].n,
    blocksDone: blocks[0].n,
    tasksDone: tasks[0].n,
    waterStreak: longestRun(water.map((w) => w.day)),
    readingMin: habits[0].reading,
    exerciseDays: habits[0].exercise,
    journalDays: habits[0].journal,
    social: reacts[0].n + comments[0].n,
    pokes: poked[0].n,
    level: levelFromXp(xp).level,
  };
}

const THROTTLE_MS = 60_000;

/**
 * Confere as conquistas e grava as estrelas novas (+XP e notificação).
 * Roda no máximo 1 vez a cada 60 s por pessoa (users.achievementsCheckedAt), a não ser com `force`.
 */
export async function evaluateAchievements(userId: string, opts: { force?: boolean } = {}): Promise<Unlock[]> {
  const db = getDb();
  if (!opts.force) {
    // reserva atômica do horário: só uma avaliação passa por minuto
    const cutoff = new Date(Date.now() - THROTTLE_MS);
    const claimed = await db
      .update(users)
      .set({ achievementsCheckedAt: new Date() })
      .where(and(eq(users.id, userId), or(isNull(users.achievementsCheckedAt), lt(users.achievementsCheckedAt, cutoff))))
      .returning({ id: users.id });
    if (!claimed.length) return [];
  } else {
    await db.update(users).set({ achievementsCheckedAt: new Date() }).where(eq(users.id, userId));
  }

  const [metrics, have] = await Promise.all([
    computeMetrics(userId),
    db.select({ key: achievements.key, tier: achievements.tier }).from(achievements).where(eq(achievements.userId, userId)),
  ]);
  const fresh = newUnlocks(
    metrics,
    have.map((h) => `${h.key}:${h.tier}`),
  );
  if (!fresh.length) return [];

  const inserted = await db
    .insert(achievements)
    .values(fresh.map((f) => ({ userId, key: f.key, tier: f.tier })))
    .onConflictDoNothing()
    .returning({ key: achievements.key, tier: achievements.tier });

  const day = dayOf();
  await Promise.all(
    inserted.map(async (r) => {
      const t = unlockText(r);
      if (!t) return;
      await award(userId, day, xpForTier(r.tier), `Conquista: ${t.name}${t.stars ? ` ${"★".repeat(t.stars)}` : ""}`, `ach:${r.key}:${r.tier}`);
      await notify(userId, {
        kind: "achievement",
        title: `🏆 Conquista desbloqueada: ${t.name}${t.stars ? ` ${"★".repeat(t.stars)}` : ""}`,
        body: `${t.goal}. +${t.xp} XP!`,
        url: "/conquistas",
        dedupe: `ach:${r.key}:${r.tier}`,
      }).catch(() => null);
    }),
  );
  return inserted;
}

/* ---------- Leituras para as telas ---------- */

export type CelebrationAchievement = { key: string; tier: number; name: string; icon: string; stars: number; maxTier: number; goal: string; xp: number };
export type Celebrations = { level: { level: number; title: string } | null; achievements: CelebrationAchievement[] };

/** O que ainda não foi comemorado: conquistas com seenAt nulo e subida de nível desde users.lastLevelSeen. */
export async function getCelebrations(userId: string): Promise<Celebrations> {
  const [u, xp, rows] = await Promise.all([
    getUser(userId),
    totalXp(userId),
    getDb()
      .select({ key: achievements.key, tier: achievements.tier })
      .from(achievements)
      .where(and(eq(achievements.userId, userId), isNull(achievements.seenAt)))
      .orderBy(achievements.unlockedAt)
      .limit(30),
  ]);
  const lv = levelFromXp(xp);
  const list = rows.flatMap((r) => {
    const t = unlockText(r);
    return t ? [{ key: r.key, tier: r.tier, ...t }] : [];
  });
  return { level: u && lv.level > u.lastLevelSeen ? { level: lv.level, title: lv.title } : null, achievements: list };
}

/** Página /conquistas: visão de cada conquista com estrelas e progresso. */
export async function getAchievementsPage(userId: string) {
  const [metrics, rows] = await Promise.all([
    computeMetrics(userId),
    getDb()
      .select({ key: achievements.key, tier: sql<number>`max(${achievements.tier})`.mapWith(Number), at: sql<Date>`max(${achievements.unlockedAt})` })
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .groupBy(achievements.key),
  ]);
  const stored = new Map(rows.map((r) => [r.key, r.tier]));
  const views = ACHIEVEMENTS.map((a) => viewOf(a, metrics, stored.get(a.key) ?? 0));
  return {
    views,
    unlocked: views.filter((v) => v.tier > 0).length,
    stars: views.reduce((s, v) => s + v.tier, 0),
    totalStars: views.reduce((s, v) => s + v.maxTier, 0),
  };
}

/** Conquistas recentes (do grupo inteiro), para o Início. Respeita quem esconde o feed. */
export async function getRecentAchievements(viewerId: string, limit = 8) {
  const rows = await getDb()
    .select({
      userId: achievements.userId,
      name: users.name,
      privacy: users.privacy,
      key: achievements.key,
      tier: achievements.tier,
      at: achievements.unlockedAt,
    })
    .from(achievements)
    .innerJoin(users, eq(users.id, achievements.userId))
    .where(gte(achievements.unlockedAt, new Date(Date.now() - 30 * 86_400_000)))
    .orderBy(desc(achievements.unlockedAt))
    .limit(60);
  return rows
    .filter((r) => r.userId === viewerId || !r.privacy?.hideFeed)
    .filter((r) => ACHIEVEMENT_BY_KEY.has(r.key))
    .slice(0, limit)
    .map((r) => {
      const t = unlockText(r)!;
      return { me: r.userId === viewerId, who: (r.name ?? "").trim().split(/\s+/)[0] || "Alguém", key: r.key, tier: r.tier, name: t.name, icon: t.icon, stars: t.stars, at: r.at.getTime() };
    });
}

/** Marca como vistas as conquistas mostradas e guarda o nível já comemorado. */
export async function markCelebrationsSeen(userId: string, shown: Unlock[]) {
  const db = getDb();
  const xp = await totalXp(userId);
  const level = levelFromXp(xp).level;
  const now = new Date();
  await Promise.all([
    db
      .update(users)
      .set({ lastLevelSeen: sql`greatest(${users.lastLevelSeen}, ${level})` })
      .where(eq(users.id, userId)),
    ...groupByTier(shown).map(([tier, keys]) =>
      db
        .update(achievements)
        .set({ seenAt: now })
        .where(and(eq(achievements.userId, userId), eq(achievements.tier, tier), inArray(achievements.key, keys), isNull(achievements.seenAt))),
    ),
  ]);
}

function groupByTier(list: Unlock[]): [number, string[]][] {
  const m = new Map<number, string[]>();
  for (const u of list) (m.get(u.tier) ?? m.set(u.tier, []).get(u.tier)!).push(u.key);
  return [...m.entries()];
}
