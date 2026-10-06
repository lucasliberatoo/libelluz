import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { summarizeExams, type ExamRow, type ExamSummary, type PartKey } from "@/lib/exams";

const { exams, examParts } = schema;

export type ExamsPageData = { exams: ExamRow[]; summary: ExamSummary };

export async function getExams(userId: string): Promise<ExamRow[]> {
  const db = getDb();
  const [rows, parts] = await Promise.all([
    db.select().from(exams).where(eq(exams.userId, userId)).orderBy(desc(exams.createdAt)),
    db.select().from(examParts).where(eq(examParts.userId, userId)),
  ]);
  return rows.map((e) => ({
    id: e.id,
    kind: e.kind,
    name: e.name,
    source: e.source,
    enemKey: e.enemKey,
    url: e.url,
    createdAt: e.createdAt.getTime(),
    parts: parts
      .filter((p) => p.examId === e.id)
      .map((p) => ({
        part: p.part as PartKey,
        day: p.day,
        correct: p.correct,
        minutes: p.minutes,
        essayScore: p.essayScore,
        competencies: p.competencies,
      })),
  }));
}

export async function getExamsPage(userId: string): Promise<ExamsPageData> {
  const list = await getExams(userId);
  return { exams: list, summary: summarizeExams(list) };
}
