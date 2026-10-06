"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { enemByKey } from "@/lib/enem-list";
import { examAwards, objectiveTotal, PART_KEYS } from "@/lib/exams";
import { getExams } from "./exam-queries";
import { award } from "./xp";

const { exams, examParts } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

async function ownExam(userId: string, id: string) {
  const [e] = await getDb()
    .select()
    .from(exams)
    .where(and(eq(exams.id, id), eq(exams.userId, userId)));
  if (!e) throw new Error("Prova não encontrada");
  return e;
}

const done = () => revalidatePath("/simulados");

const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((s) => !s || /^https?:\/\//i.test(s), "O link precisa começar com http:// ou https://")
  .optional()
  .default("");

const simuladoSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao simulado").max(120),
  source: z.string().trim().max(120).optional().default(""),
  url: urlSchema,
});

export type ExamFormResult = { ok: true; id: string } | { ok: false; error: string };

export async function createSimulado(input: z.input<typeof simuladoSchema>): Promise<ExamFormResult> {
  const userId = await requireUser();
  const r = simuladoSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const [e] = await getDb()
    .insert(exams)
    .values({ userId, kind: "simulado", name: r.data.name, source: r.data.source || null, url: r.data.url || null })
    .returning({ id: exams.id });
  done();
  return { ok: true, id: e.id };
}

export async function updateExam(id: string, input: z.input<typeof simuladoSchema>): Promise<ExamFormResult> {
  const userId = await requireUser();
  await ownExam(userId, id);
  const r = simuladoSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  await getDb()
    .update(exams)
    .set({ name: r.data.name, source: r.data.source || null, url: r.data.url || null })
    .where(and(eq(exams.id, id), eq(exams.userId, userId)));
  done();
  return { ok: true, id };
}

/** Registra um ENEM antigo da lista. Cada ENEM entra uma vez por pessoa. */
export async function addEnem(key: string): Promise<ExamFormResult> {
  const userId = await requireUser();
  const entry = enemByKey(z.string().max(40).parse(key));
  if (!entry) return { ok: false, error: "ENEM desconhecido" };
  const db = getDb();
  const [existing] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(and(eq(exams.userId, userId), eq(exams.enemKey, entry.key)));
  if (existing) return { ok: true, id: existing.id };
  const [e] = await db
    .insert(exams)
    .values({ userId, kind: "enem", name: entry.label, source: "INEP", enemKey: entry.key })
    .returning({ id: exams.id });
  done();
  return { ok: true, id: e.id };
}

export async function deleteExam(id: string) {
  const userId = await requireUser();
  await getDb()
    .delete(exams)
    .where(and(eq(exams.id, id), eq(exams.userId, userId)));
  done();
}

const competency = z
  .number()
  .int()
  .min(0)
  .max(200)
  .refine((n) => n % 40 === 0, "Competências vão de 40 em 40");

const partSchema = z
  .object({
    part: z.enum(PART_KEYS),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    correct: z.number().int().min(0).max(45).nullable().optional(),
    minutes: z.number().int().min(0).max(600).nullable().optional(),
    essayScore: z.number().int().min(0).max(1000).nullable().optional(),
    competencies: z.array(competency).length(5).nullable().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.part === "redacao") {
      if (p.essayScore == null && !p.competencies) ctx.addIssue({ code: "custom", message: "Informe a nota da redação" });
    } else if (p.correct == null) {
      ctx.addIssue({ code: "custom", message: "Informe os acertos (de 45)" });
    }
  });

export type SavePartsResult = { ok: true; xp: number; reasons: string[] } | { ok: false; error: string };

/** Salva uma ou várias partes (prova inteira de uma vez) e dá o XP devido. */
export async function saveExamParts(examId: string, input: z.input<typeof partSchema>[]): Promise<SavePartsResult> {
  const userId = await requireUser();
  const exam = await ownExam(userId, examId);
  const r = z.array(partSchema).min(1).max(5).safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const db = getDb();
  for (const p of r.data) {
    const isEssay = p.part === "redacao";
    const comps = isEssay ? (p.competencies ?? null) : null;
    const essayScore = isEssay ? (p.essayScore ?? comps!.reduce((a, b) => a + b, 0)) : null;
    const values = {
      day: p.day,
      correct: isEssay ? null : p.correct!,
      total: 45,
      minutes: p.minutes ?? null,
      essayScore,
      competencies: comps,
    };
    await db
      .insert(examParts)
      .values({ examId, userId, part: p.part, ...values })
      .onConflictDoUpdate({ target: [examParts.examId, examParts.part], set: values });
  }
  const all = await getExams(userId);
  const me = all.find((e) => e.id === examId)!;
  const others = all.filter((e) => e.id !== examId).map((e) => objectiveTotal(e.parts)).filter((n): n is number => n != null);
  const awards = examAwards(
    { id: exam.id, kind: exam.kind },
    r.data.map((p) => p.part),
    me.parts,
    others.length ? Math.max(...others) : null,
  );
  const today = dayOf();
  let xp = 0;
  const reasons: string[] = [];
  for (const a of awards) {
    const got = await award(userId, today, a.amount, a.reason, a.dedupe);
    if (got) {
      xp += got;
      reasons.push(a.reason);
    }
  }
  done();
  revalidatePath("/");
  return { ok: true, xp, reasons };
}

export async function deleteExamPart(examId: string, part: string) {
  const userId = await requireUser();
  await ownExam(userId, examId);
  const key = z.enum(PART_KEYS).parse(part);
  await getDb()
    .delete(examParts)
    .where(and(eq(examParts.examId, examId), eq(examParts.userId, userId), eq(examParts.part, key)));
  done();
}
