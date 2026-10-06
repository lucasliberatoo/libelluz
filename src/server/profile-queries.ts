import "server-only";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { avatarUrl } from "@/lib/avatar";
import { addDays, dayOf } from "@/lib/day";
import { computeStreak } from "@/lib/game";
import { levelFromXp } from "@/lib/levels";
import { restDaysOf } from "./schedule";

const { users, focusSessions, xpEvents, questionAttempts, examParts, essays, reviews, studyNodes } = schema;

/** Maior sequência de dias seguidos com estudo (sem lenha). */
function bestRun(days: string[]) {
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Tudo que a página de perfil mostra, com agregações no SQL (nada de linhas cruas). */
export async function getProfile(userId: string) {
  const db = getDb();
  const today = dayOf();
  const [u, focus, days, xp, attempts, exam, essay, rev, mastery] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, image: true, petName: true, enemDate: true, createdAt: true, restDay: true },
    }),
    db
      .select({
        min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number),
        sessions: count(),
        done: sql<number>`coalesce(sum(${focusSessions.questionsDone}), 0)`.mapWith(Number),
        correct: sql<number>`coalesce(sum(${focusSessions.questionsCorrect}), 0)`.mapWith(Number),
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt))),
    db
      .selectDistinct({ day: focusSessions.day })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt), sql`${focusSessions.durationMin} > 0`)),
    db
      .select({ xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`.mapWith(Number) })
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId)),
    db
      .select({ n: count(), ok: sql<number>`coalesce(sum(case when ${questionAttempts.correct} then 1 else 0 end), 0)`.mapWith(Number) })
      .from(questionAttempts)
      .where(eq(questionAttempts.userId, userId)),
    // melhor total das 4 provas objetivas (de 180) e quantas provas têm as 4 partes
    db
      .select({
        best: sql<number>`coalesce(max(t.total), 0)`.mapWith(Number),
        full: sql<number>`count(*) filter (where t.parts = 4)`.mapWith(Number),
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
    db
      .select({ n: count(), avg: sql<number>`coalesce(avg(${essays.score}), 0)`.mapWith(Number) })
      .from(essays)
      .where(eq(essays.userId, userId)),
    db.select({ n: count() }).from(reviews).where(and(eq(reviews.userId, userId), isNotNull(reviews.doneAt))),
    db
      .select({ n: count() })
      .from(studyNodes)
      .where(and(eq(studyNodes.userId, userId), eq(studyNodes.level, "skill"), eq(studyNodes.mastery, true))),
  ]);
  if (!u) throw new Error("Usuário não encontrado");

  const studied = days.map((d) => d.day!).filter(Boolean);
  const f = focus[0];
  const qDone = f.done + attempts[0].n;
  const qOk = f.correct + attempts[0].ok;
  return {
    user: {
      id: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      image: avatarUrl(u.id, u.image),
      hasPhoto: !!u.image?.startsWith("data:"),
      petName: u.petName,
      since: dayOf(u.createdAt),
      enemDate: u.enemDate,
      enemDays: u.enemDate ? Math.round((Date.parse(`${u.enemDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) : null,
    },
    level: levelFromXp(xp[0].xp),
    totalXp: xp[0].xp,
    streak: computeStreak(studied, today, restDaysOf(u, today)).streak,
    bestStreak: bestRun(studied),
    studiedDays: studied.length,
    hours: Math.round((f.min / 60) * 10) / 10,
    sessions: f.sessions,
    questions: qDone,
    accuracy: qDone ? Math.round((qOk / qDone) * 100) : null,
    examBest: exam[0].best,
    examsFull: exam[0].full,
    essays: essay[0].n,
    essayAvg: Math.round(essay[0].avg),
    reviewsDone: rev[0].n,
    mastered: mastery[0].n,
  };
}

export type Profile = Awaited<ReturnType<typeof getProfile>>;
