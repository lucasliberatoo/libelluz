import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays } from "@/lib/day";
import { computeStreak, computeStudyMode } from "@/lib/game";
import { localClock, planNotifications, type RuleInput } from "@/lib/notification-rules";
import { createNotification, deliverPush } from "./notify";
import { restDaysOf } from "./schedule";

const { users, focusSessions, habitLogs, reviews, notifications, scheduleBlocks } = schema;

const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "";

/** Máximo de notificações novas por pessoa a cada execução (o cron roda a cada 30 min). */
const PER_RUN = 2;

/**
 * Junta, com poucas consultas agregadas, os dados que as regras precisam.
 * `onlyUserId` limita a uma pessoa (agenda do APK); sem ele, todo mundo (cron).
 */
export async function loadRuleInputs(now: Date, onlyUserId?: string): Promise<RuleInput[]> {
  const db = getDb();
  const clock = localClock(now);
  const today = clock.day;
  const mine = <T>(col: T) => (onlyUserId ? eq(col as never, onlyUserId) : undefined);

  const [us, dayRows, todayRows, water, overdue, subjects, blocks] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        petName: users.petName,
        enemDate: users.enemDate,
        waterGoal: users.waterGoal,
        focusGoalMin: users.focusGoalMin,
        restDay: users.restDay,
        createdAt: users.createdAt,
        notifPrefs: users.notifPrefs,
      })
      .from(users)
      .where(mine(users.id)),
    // minutos por pessoa e dia (sequência e modo)
    db
      .select({ userId: focusSessions.userId, day: focusSessions.day, min: sql<number>`sum(${focusSessions.durationMin})`.mapWith(Number) })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), isNotNull(focusSessions.day), mine(focusSessions.userId)))
      .groupBy(focusSessions.userId, focusSessions.day),
    // quem estudou hoje (todo mundo: para o "amigo estudou")
    db
      .select({ userId: focusSessions.userId, name: users.name, min: sql<number>`sum(${focusSessions.durationMin})`.mapWith(Number) })
      .from(focusSessions)
      .innerJoin(users, eq(users.id, focusSessions.userId))
      .where(and(isNotNull(focusSessions.endedAt), eq(focusSessions.day, today)))
      .groupBy(focusSessions.userId, users.name),
    db.select({ userId: habitLogs.userId, cups: habitLogs.waterCups }).from(habitLogs).where(and(eq(habitLogs.day, today), mine(habitLogs.userId))),
    // a revisão mais atrasada de cada pessoa (há quantos dias a matéria está sem revisão)
    db
      .selectDistinctOn([reviews.userId], {
        userId: reviews.userId,
        subject: reviews.subject,
        topic: reviews.topic,
        since: sql<number>`(${today}::date - ${reviews.dueDay}) + ${reviews.intervalDays}`.mapWith(Number),
      })
      .from(reviews)
      .where(and(isNull(reviews.doneAt), lt(reviews.dueDay, today), mine(reviews.userId)))
      .orderBy(reviews.userId, sql`${reviews.dueDay} - ${reviews.intervalDays}`),
    // matéria mais estudada nas últimas 2 semanas
    db
      .select({ userId: focusSessions.userId, subject: focusSessions.subject, min: sql<number>`sum(${focusSessions.durationMin})`.mapWith(Number) })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), gte(focusSessions.day, addDays(today, -13)), mine(focusSessions.userId)))
      .groupBy(focusSessions.userId, focusSessions.subject),
    // blocos de hoje que ainda não foram feitos (o primeiro vira o "plano do dia")
    db
      .select({
        userId: scheduleBlocks.userId,
        subject: scheduleBlocks.subject,
        topic: scheduleBlocks.topic,
        kind: scheduleBlocks.kind,
        min: scheduleBlocks.plannedMin,
        position: scheduleBlocks.position,
      })
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.day, today), isNull(scheduleBlocks.doneAt), mine(scheduleBlocks.userId)))
      .orderBy(scheduleBlocks.userId, scheduleBlocks.position, scheduleBlocks.createdAt),
  ]);

  const minsBy = new Map<string, Map<string, number>>();
  for (const r of dayRows) {
    if (!r.day || !(r.min > 0)) continue;
    if (!minsBy.has(r.userId)) minsBy.set(r.userId, new Map());
    minsBy.get(r.userId)!.set(r.day, r.min);
  }
  const fav = new Map<string, { subject: string; min: number }>();
  for (const s of subjects) if (s.min > (fav.get(s.userId)?.min ?? 0)) fav.set(s.userId, { subject: s.subject, min: s.min });
  const waterBy = new Map(water.map((w) => [w.userId, w.cups]));
  const blockBy = new Map<string, NonNullable<RuleInput["todayBlock"]>>();
  for (const b of blocks) {
    const cur = blockBy.get(b.userId);
    if (cur) cur.left++;
    else blockBy.set(b.userId, { subject: b.subject, topic: b.topic, kind: b.kind, min: b.min, left: 1 });
  }
  const overdueBy = new Map(overdue.map((o) => [o.userId, o]));
  // Por enquanto todo mundo do app é o grupo (como no ranking do Início).
  const studiedToday = todayRows.filter((r) => r.min > 0).sort((a, b) => b.min - a.min);

  return us.map((u) => {
    const mins = minsBy.get(u.id) ?? new Map<string, number>();
    const streak = computeStreak(mins.keys(), today, restDaysOf(u, today));
    const friend = studiedToday.find((r) => r.userId !== u.id && firstName(r.name));
    const o = overdueBy.get(u.id);
    return {
      now: clock,
      user: {
        id: u.id,
        firstName: firstName(u.name) || "você",
        petName: u.petName,
        enemDate: u.enemDate,
        waterGoal: u.waterGoal,
        prefs: u.notifPrefs ?? {},
      },
      mode: computeStudyMode(mins, today, u.focusGoalMin),
      streak: { streak: streak.streak, burned: streak.burned, studiedToday: streak.studiedToday },
      studiedYesterday: mins.has(addDays(today, -1)),
      everStudied: mins.size > 0,
      waterCups: waterBy.get(u.id) ?? 0,
      overdueReview: o ? { subject: o.subject, topic: o.topic, days: o.since } : null,
      todayBlock: blockBy.get(u.id) ?? null,
      favoriteSubject: fav.get(u.id)?.subject ?? null,
      friend: friend ? { name: firstName(friend.name), minutes: Math.round(friend.min) } : null,
    } satisfies RuleInput;
  });
}

/** Uma execução do agendador: decide e envia as notificações de todo mundo. */
export async function runNotificationCron(now = new Date()) {
  const db = getDb();
  const inputs = await loadRuleInputs(now);
  const plans = inputs.map((i) => ({ userId: i.user.id, list: planNotifications(i) })).filter((p) => p.list.length);
  if (!plans.length) return { users: inputs.length, created: 0, pushed: 0, at: localClock(now) };

  // o que já foi mandado (dedupe) para não gastar a vez com repetidas
  const keys = plans.flatMap((p) => p.list.map((n) => n.dedupe));
  const sent = await db
    .select({ userId: notifications.userId, dedupe: notifications.dedupe })
    .from(notifications)
    .where(and(inArray(notifications.userId, plans.map((p) => p.userId)), inArray(notifications.dedupe, keys)));
  const done = new Set(sent.map((s) => `${s.userId}|${s.dedupe}`));

  let created = 0;
  let pushed = 0;
  const detail: { userId: string; kinds: string[] }[] = [];
  await Promise.all(
    plans.map(async ({ userId, list }) => {
      const fresh = list.filter((n) => !done.has(`${userId}|${n.dedupe}`)).slice(0, PER_RUN);
      const kinds: string[] = [];
      for (const n of fresh) {
        const id = await createNotification(userId, n);
        if (!id) continue;
        created++;
        kinds.push(n.kind);
        const r = await deliverPush(userId, id).catch(() => ({ sent: 0 }));
        pushed += r.sent;
      }
      if (kinds.length) detail.push({ userId, kinds });
    }),
  );
  return { users: inputs.length, created, pushed, at: localClock(now), detail };
}
