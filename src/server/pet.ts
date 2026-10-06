import "server-only";
import { cache } from "react";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf } from "@/lib/day";
import {
  accessoryProgress,
  ACCESSORY_IDS,
  emptyDay,
  heatHistory,
  petMood,
  spHour,
  streakTimeline,
  type AccessoryId,
  type DayInput,
} from "@/lib/heat";
import { restDaysOf } from "./schedule";

const { users, focusSessions, habitLogs, dailyTasks, scheduleBlocks, heatEvents, examParts } = schema;

/**
 * Estado do foguinho: calor, estágio, humor, checklist de hoje e acessórios.
 * Tudo agregado no SQL por dia (sem trazer linhas nem fotos), em paralelo.
 */
export const getPetState = cache(async (userId: string) => {
  const db = getDb();
  const today = dayOf();

  const [u, focus, habits, tasks, blocks, events, exams] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { petName: true, petAccessory: true, waterGoal: true, readingGoalMin: true, restDay: true, createdAt: true },
    }),
    db
      .select({ day: focusSessions.day, min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number) })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt)))
      .groupBy(focusSessions.day),
    db
      .select({
        day: habitLogs.day,
        water: habitLogs.waterCups,
        readingMin: habitLogs.readingMin,
        mood: sql<boolean>`${habitLogs.mood} is not null`,
        exercise: habitLogs.exercise,
        journal: sql<boolean>`coalesce(length(trim(${habitLogs.journal})), 0) > 0`,
      })
      .from(habitLogs)
      .where(eq(habitLogs.userId, userId)),
    db
      .select({ day: dailyTasks.day, total: sql<number>`count(*)`.mapWith(Number), done: sql<number>`count(*) filter (where ${dailyTasks.done})`.mapWith(Number) })
      .from(dailyTasks)
      .where(and(eq(dailyTasks.userId, userId), lte(dailyTasks.day, today)))
      .groupBy(dailyTasks.day),
    db
      .select({
        day: scheduleBlocks.day,
        total: sql<number>`count(*)`.mapWith(Number),
        done: sql<number>`count(*) filter (where ${scheduleBlocks.doneAt} is not null)`.mapWith(Number),
      })
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.userId, userId), lte(scheduleBlocks.day, today)))
      .groupBy(scheduleBlocks.day),
    db
      .select({ day: heatEvents.day, reason: heatEvents.reason, amount: sql<number>`coalesce(sum(${heatEvents.amount}), 0)`.mapWith(Number) })
      .from(heatEvents)
      .where(eq(heatEvents.userId, userId))
      .groupBy(heatEvents.day, heatEvents.reason),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(examParts)
      .where(eq(examParts.userId, userId)),
  ]);
  if (!u) throw new Error("Usuário não encontrado");

  const days = new Map<string, DayInput>();
  const at = (d: string) => {
    let x = days.get(d);
    if (!x) days.set(d, (x = emptyDay(d)));
    return x;
  };
  for (const f of focus) if (f.day && f.min > 0) at(f.day).focusMin = f.min;
  for (const h of habits) Object.assign(at(h.day), { water: h.water, readingMin: h.readingMin, mood: !!h.mood, exercise: h.exercise, journal: !!h.journal });
  for (const t of [...tasks, ...blocks]) {
    const x = at(t.day);
    x.tasksTotal += t.total;
    x.tasksDone += t.done;
  }
  for (const e of events) at(e.day).events[e.reason] = (at(e.day).events[e.reason] ?? 0) + e.amount;

  const restDays = restDaysOf(u, today);
  const h = heatHistory({
    days: [...days.values()],
    today,
    goals: { water: u.waterGoal, reading: u.readingGoalMin },
    restDays,
    from: dayOf(u.createdAt),
  });
  const breaks = streakTimeline(
    [...days.values()].filter((d) => d.focusMin > 0).map((d) => d.day),
    today,
    restDays,
  ).breaks;
  const mood = petMood({ today, hour: spHour(new Date()), streak: h.streak, penalties: h.penalties, breaks });

  const accessories = accessoryProgress({
    bestStreak: h.bestStreak,
    studiedDays: h.studiedDays,
    focusHours: Math.floor(h.focusMin / 60),
    stage: h.stage,
    examParts: exams[0]?.n ?? 0,
  });
  const equipped = accessories.find((a) => a.id === u.petAccessory && a.unlocked)?.id ?? null;
  const yesterday = addDays(today, -1);

  return {
    name: u.petName,
    stage: h.stage,
    stageName: h.stageName,
    total: h.total,
    intoStage: h.intoStage,
    stageSpan: h.stageSpan,
    todayHeat: h.todayHeat,
    todayChecklist: h.todayChecklist,
    mood,
    /** motivo do humor triste, para a tela */
    sadReason: mood !== "sad" ? null : h.streak.burned.includes(yesterday) ? ("firewood" as const) : ("broke" as const),
    lastPenalty: h.penalties.at(-1) ?? null,
    streak: h.streak,
    accessory: equipped as AccessoryId | null,
    accessories,
  };
});

export type PetState = Awaited<ReturnType<typeof getPetState>>;

/** O pouco que o card da sequência precisa (mesma consulta em cache do /foguinho). */
export async function getPetSummary(userId: string) {
  const p = await getPetState(userId);
  return {
    name: p.name,
    stage: p.stage,
    stageName: p.stageName,
    intoStage: p.intoStage,
    stageSpan: p.stageSpan,
    todayHeat: p.todayHeat,
    mood: p.mood,
    accessory: p.accessory,
    accessoryEmoji: p.accessories.find((a) => a.id === p.accessory)?.emoji ?? "",
    todo: p.todayChecklist.filter((t) => !t.done).length,
  };
}

export type PetSummary = Awaited<ReturnType<typeof getPetSummary>>;

export const isAccessoryId = (s: string): s is AccessoryId => (ACCESSORY_IDS as string[]).includes(s);
