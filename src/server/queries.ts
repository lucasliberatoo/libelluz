import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf, weekStart, weekdayOf, WEEKDAYS } from "@/lib/day";
import { computeStreak, computeStudyMode } from "@/lib/game";
import { levelFromXp } from "@/lib/levels";
import { avatarUrl } from "@/lib/avatar";
import { getTodayPlan, restDaysOf } from "./schedule";

const { users, focusSessions, xpEvents, dailyTasks, habitLogs, studyNodes } = schema;

export type ActiveFocus = {
  id: string;
  area: string;
  subject: string;
  topic: string;
  kind: string;
  method: string;
  minutes: number;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
};

export const getActiveFocus = cache(async (userId: string): Promise<ActiveFocus | null> => {
  const s = await getDb().query.focusSessions.findFirst({
    where: and(eq(focusSessions.userId, userId), isNull(focusSessions.endedAt)),
    orderBy: (f, { desc }) => desc(f.startedAt),
  });
  if (!s) return null;
  return {
    id: s.id,
    area: s.area,
    subject: s.subject,
    topic: s.topic,
    kind: s.kind,
    method: s.method,
    minutes: s.plannedMin,
    startedAt: s.startedAt.getTime(),
    pausedAt: s.pausedAt?.getTime() ?? null,
    pausedMs: s.pausedMs,
  };
});

/** Minutos de foco por dia (sessões encerradas). */
export const minutesByDay = cache(async (userId: string, from?: string) => {
  const rows = await getDb()
    .select({ day: focusSessions.day, min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number) })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        isNotNull(focusSessions.endedAt),
        from ? gte(focusSessions.day, from) : undefined,
      ),
    )
    .groupBy(focusSessions.day);
  return new Map(rows.filter((r) => r.day && r.min > 0).map((r) => [r.day!, r.min]));
});

// cache(): várias partes da mesma página (layout + página) pedem os mesmos dados; busca uma vez só.
export const getUser = cache(async (userId: string) => getDb().query.users.findFirst({ where: eq(users.id, userId) }));

export const totalXp = cache(async (userId: string) => {
  const [r] = await getDb()
    .select({ xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`.mapWith(Number) })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId));
  return r?.xp ?? 0;
});

export async function getShellData(userId: string) {
  const today = dayOf();
  const [u, mins, xp] = await Promise.all([getUser(userId), minutesByDay(userId), totalXp(userId)]);
  const streak = computeStreak(mins.keys(), today, u ? restDaysOf(u, today) : undefined);
  return { name: firstName(u?.name), image: avatarUrl(userId, u?.image), streak: streak.streak, xp };
}

export const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "você";

export async function getDashboard(userId: string) {
  const db = getDb();
  const today = dayOf();
  const ws = weekStart(today);
  const lastWs = addDays(ws, -7);

  const [u, mins, xpTotal, xpRows, tasks, habit, sessionsWeek, accuracyRows, lastFocus, groupRows, plan] = await Promise.all([
    getUser(userId),
    minutesByDay(userId),
    totalXp(userId),
    db
      .select({ day: xpEvents.day, xp: sql<number>`sum(${xpEvents.amount})`.mapWith(Number) })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), gte(xpEvents.day, ws)))
      .groupBy(xpEvents.day),
    db.query.dailyTasks.findMany({
      where: and(eq(dailyTasks.userId, userId), eq(dailyTasks.day, today)),
      orderBy: [asc(dailyTasks.createdAt)],
    }),
    db.query.habitLogs.findFirst({ where: and(eq(habitLogs.userId, userId), eq(habitLogs.day, today)) }),
    db.query.focusSessions.findMany({
      where: and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt), gte(focusSessions.day, lastWs)),
    }),
    db
      .select({
        done: sql<number>`coalesce(sum(${focusSessions.questionsDone}), 0)`.mapWith(Number),
        correct: sql<number>`coalesce(sum(${focusSessions.questionsCorrect}), 0)`.mapWith(Number),
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), gte(focusSessions.day, addDays(today, -13)))),
    db.query.focusSessions.findFirst({
      where: and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt)),
      orderBy: (f, { desc }) => desc(f.endedAt),
    }),
    // Ranking do grupo: todo mundo do app é o grupo por enquanto.
    db
      .select({ userId: focusSessions.userId, min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number) })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), gte(focusSessions.day, ws)))
      .groupBy(focusSessions.userId),
    getTodayPlan(userId, today),
  ]);
  if (!u) throw new Error("Usuário não encontrado");

  const restDays = new Set(restDaysOf(u, addDays(ws, 6)));
  const streak = computeStreak(mins.keys(), today, restDays);
  const mode = computeStudyMode(mins, today, u.focusGoalMin);
  const lv = levelFromXp(xpTotal);

  const xpByDay = new Map(xpRows.map((r) => [r.day, r.xp]));
  const xpWeek = WEEKDAYS.map((d, i) => ({ d, xp: xpByDay.get(addDays(ws, i)) ?? 0 }));

  const thisWeek = sessionsWeek.filter((s) => s.day! >= ws);
  const lastWeek = sessionsWeek.filter((s) => s.day! < ws);
  const weekHours = WEEKDAYS.map((d, i) => ({
    d,
    h: round1((mins.get(addDays(ws, i)) ?? 0) / 60),
  }));
  const sumMin = (l: typeof sessionsWeek) => l.reduce((a, s) => a + (s.durationMin ?? 0), 0);
  const weekMin = sumMin(thisWeek);
  const lastWeekMin = sumMin(lastWeek);
  const byArea = new Map<string, number>();
  thisWeek.forEach((s) => byArea.set(s.area, (byArea.get(s.area) ?? 0) + (s.durationMin ?? 0)));

  const todaySessions = thisWeek.filter((s) => s.day === today);
  const todayMin = todaySessions.reduce((a, s) => a + (s.durationMin ?? 0), 0);
  const todayQuestions = todaySessions.reduce((a, s) => a + (s.questionsDone ?? 0), 0);

  const record = [...mins.values()].reduce((a, b) => Math.max(a, b), 0);
  const ranking = groupRows.sort((a, b) => b.min - a.min);
  const rank = ranking.findIndex((r) => r.userId === userId);

  const joined = dayOf(u.createdAt);
  const weekDots = WEEKDAYS.map((_, i) => {
    const d = addDays(ws, i);
    if (d < joined) return "future" as const;
    if (d > today) return restDays.has(d) ? ("rest" as const) : ("future" as const);
    if (mins.has(d)) return "studied" as const;
    if (streak.burned.includes(d)) return "firewood" as const;
    if (d === today) return "today" as const;
    if (restDays.has(d)) return "rest" as const;
    return "missed" as const;
  });

  return {
    today,
    todayIndex: weekdayOf(today),
    user: {
      name: u.name ?? "",
      firstName: firstName(u.name),
      image: avatarUrl(u.id, u.image),
      petName: u.petName,
      waterGoal: u.waterGoal,
      readingGoalMin: u.readingGoalMin,
    },
    level: lv,
    totalXp: xpTotal,
    studiedDays: mins.size,
    studyMode: mode,
    streak,
    weekDots,
    xp: { week: xpWeek, goals: { day: u.dailyXpGoal, week: u.weeklyXpGoal } },
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, area: t.area, plannedMin: t.plannedMin, done: t.done })),
    blocks: plan.blocks,
    reviews: plan.reviews,
    habit: {
      water: habit?.waterCups ?? 0,
      mood: habit?.mood ?? null,
      journal: habit?.journal ?? "",
      photo: habit?.photo ?? null,
      readingMin: habit?.readingMin ?? 0,
      exercise: habit?.exercise ?? false,
    },
    goals: [
      { label: "Horas de foco", value: round1(todayMin / 60), target: round1(u.focusGoalMin / 60), unit: "h" },
      { label: "Questões", value: todayQuestions, target: u.questionsGoal, unit: "" },
      {
        label: "Tarefas",
        value: tasks.filter((t) => t.done).length + plan.blocks.filter((b) => b.done).length,
        target: Math.max(tasks.length + plan.blocks.length, 1),
        unit: "",
      },
    ],
    lastFocus: lastFocus
      ? { area: lastFocus.area, subject: lastFocus.subject, topic: lastFocus.topic, kind: lastFocus.kind }
      : null,
    stats: {
      weekHours,
      weekVsLast: lastWeekMin > 0 ? Math.round(((weekMin - lastWeekMin) / lastWeekMin) * 100) : null,
      hoursByArea: [...byArea.entries()].map(([name, m]) => ({ name, h: round1(m / 60) })).sort((a, b) => b.h - a.h),
      accuracy: accuracyRows[0]?.done ? Math.round((accuracyRows[0].correct / accuracyRows[0].done) * 100) : null,
      questions14: accuracyRows[0]?.done ?? 0,
      recordDayHours: round1(record / 60),
      groupRank: rank >= 0 ? rank + 1 : null,
      groupSize: ranking.length,
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Árvore da pessoa, em formato aninhado. */
export async function getTree(userId: string) {
  const nodes = await getDb().query.studyNodes.findMany({
    where: eq(studyNodes.userId, userId),
    orderBy: [asc(studyNodes.position), asc(studyNodes.name)],
  });
  type N = (typeof nodes)[number] & { children: N[] };
  const map = new Map<string, N>(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots: N[] = [];
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n);
    else roots.push(n);
  }
  return roots;
}

export type TreeNode = Awaited<ReturnType<typeof getTree>>[number];

/** Minutos e sessões por tópico (para a árvore em Aulas). */
export async function getTopicMinutes(userId: string) {
  const rows = await getDb()
    .select({ topic: focusSessions.topic, subject: focusSessions.subject, min: sql<number>`coalesce(sum(${focusSessions.durationMin}),0)`.mapWith(Number) })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt)))
    .groupBy(focusSessions.subject, focusSessions.topic);
  return Object.fromEntries(rows.map((r) => [`${r.subject}/${r.topic}`, r.min]));
}


/** Diário: humor, relato e foto de cada dia. */
export async function getJournal(userId: string) {
  // Sem trazer as fotos (data URLs pesadas): cada uma é baixada sob demanda por /api/diario/foto/[dia].
  const rows = await getDb()
    .select({
      day: habitLogs.day,
      mood: habitLogs.mood,
      journal: habitLogs.journal,
      photoLen: sql<number | null>`length(${habitLogs.photo})`,
      water: habitLogs.waterCups,
      readingMin: habitLogs.readingMin,
      exercise: habitLogs.exercise,
    })
    .from(habitLogs)
    .where(eq(habitLogs.userId, userId))
    .orderBy(desc(habitLogs.day));
  return rows.map(({ photoLen, ...r }) => ({ ...r, photo: photoLen ? `/api/diario/foto/${r.day}?v=${photoLen}` : null }));
}

export type JournalEntry = Awaited<ReturnType<typeof getJournal>>[number];
