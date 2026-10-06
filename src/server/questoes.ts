import "server-only";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { questions, questionAttempts, users } = schema;

/** XP do banco de questões (fica aqui, não em lib/game.ts). */
export const QUESTION_XP = { create: 2, share: 3, correct: 3, wrong: 1 } as const;

/** Questão visível para a pessoa: dela, ou compartilhada (grupo = todo mundo do app, por enquanto) ou global. */
export const canSee = (userId: string) => or(eq(questions.userId, userId), ne(questions.visibility, "private"));

/** Lista leve (sem as imagens, que são data URLs pesadas). */
export async function getQuestionList(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: questions.id,
      userId: questions.userId,
      author: users.name,
      area: questions.area,
      subject: questions.subject,
      topic: questions.topic,
      statement: questions.statement,
      imageCount: sql<number>`jsonb_array_length(${questions.images})`.mapWith(Number),
      alternatives: questions.alternatives,
      source: questions.source,
      visibility: questions.visibility,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .where(canSee(userId))
    .orderBy(desc(questions.createdAt))
    .limit(1000);
  const last = await lastAttempts(userId);
  return rows.map((r) => ({ ...r, mine: r.userId === userId, last: last.get(r.id) ?? null }));
}

export type QuestionListItem = Awaited<ReturnType<typeof getQuestionList>>[number];

/** Resultado da última tentativa da pessoa em cada questão. */
export async function lastAttempts(userId: string) {
  const rows = await getDb()
    .selectDistinctOn([questionAttempts.questionId], { questionId: questionAttempts.questionId, correct: questionAttempts.correct })
    .from(questionAttempts)
    .where(eq(questionAttempts.userId, userId))
    .orderBy(questionAttempts.questionId, desc(questionAttempts.at));
  return new Map(rows.map((r) => [r.questionId, r.correct ? ("right" as const) : ("wrong" as const)]));
}

export async function getQuestionStats(userId: string) {
  const db = getDb();
  const byArea = await db
    .select({
      area: questions.area,
      total: sql<number>`count(*)`.mapWith(Number),
      correct: sql<number>`count(*) filter (where ${questionAttempts.correct})`.mapWith(Number),
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
    .where(eq(questionAttempts.userId, userId))
    .groupBy(questions.area);
  const [{ mine }] = await db
    .select({ mine: sql<number>`count(*)`.mapWith(Number) })
    .from(questions)
    .where(eq(questions.userId, userId));
  const attempts = byArea.reduce((a, r) => a + r.total, 0);
  const correct = byArea.reduce((a, r) => a + r.correct, 0);
  return { mine, attempts, correct, byArea };
}

export type QuestionStats = Awaited<ReturnType<typeof getQuestionStats>>;

export async function findVisibleQuestion(userId: string, id: string) {
  const [q] = await getDb()
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), canSee(userId)))
    .limit(1);
  return q ?? null;
}
