"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, isAdminEmail } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { award } from "./xp";
import { canSee, findVisibleQuestion, lastAttempts, QUESTION_XP } from "./questoes";

const { questions, questionAttempts, studyNodes } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return { id: s.user.id, admin: isAdminEmail(s.user.email) };
}

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const questionSchema = z
  .object({
    id: z.string().optional(),
    area: z.string().trim().min(1, "Escolha a área").max(40),
    subject: opt(80),
    topic: opt(160),
    nodeId: opt(64),
    statement: z.string().trim().max(10000),
    images: z
      .array(z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Imagem inválida").max(700_000, "Imagem grande demais"))
      .max(3, "No máximo 3 imagens"),
    alternatives: z.array(z.string().trim().max(2000)).max(5),
    answer: z.number().int().min(0).max(4),
    explanation: opt(5000),
    source: opt(200),
    visibility: z.enum(["private", "group", "global"]),
  })
  .transform((q) => {
    // tira alternativas vazias do fim (pode cadastrar só A–D, por exemplo)
    const alts = [...q.alternatives];
    while (alts.length && !alts[alts.length - 1]) alts.pop();
    return { ...q, alternatives: alts };
  })
  .refine((q) => q.statement || q.images.length, { message: "Escreva o enunciado (ou anexe uma imagem)" })
  .refine((q) => q.alternatives.length >= 2 && q.alternatives.every(Boolean), {
    message: "Preencha pelo menos as alternativas A e B, sem pular letras",
  })
  .refine((q) => q.answer < q.alternatives.length, { message: "O gabarito precisa ser uma alternativa preenchida" });

export type QuestionInput = z.input<typeof questionSchema>;

export async function saveQuestion(input: QuestionInput): Promise<{ error?: string; xp?: number; id?: string }> {
  const me = await requireUser();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...q } = parsed.data;
  if (q.visibility === "global" && !me.admin) return { error: "Só o admin pode publicar questões globais." };
  const db = getDb();
  if (q.nodeId) {
    const node = await db.query.studyNodes.findFirst({ where: and(eq(studyNodes.id, q.nodeId), eq(studyNodes.userId, me.id)) });
    if (!node) q.nodeId = null;
  }
  let qid = id;
  if (id) {
    const res = await db
      .update(questions)
      .set(q)
      .where(and(eq(questions.id, id), eq(questions.userId, me.id)))
      .returning({ id: questions.id });
    if (!res.length) return { error: "Questão não encontrada." };
  } else {
    [{ id: qid }] = await db.insert(questions).values({ ...q, userId: me.id }).returning({ id: questions.id });
  }
  const day = dayOf();
  let xp = 0;
  if (!id) xp += await award(me.id, day, QUESTION_XP.create, "Cadastrou uma questão", `q-create:${qid}`);
  if (q.visibility !== "private") xp += await award(me.id, day, QUESTION_XP.share, "Compartilhou uma questão", `q-share:${qid}`);
  revalidatePath("/questoes");
  revalidatePath("/", "layout");
  return { xp, id: qid };
}

export async function deleteQuestion(id: string) {
  const me = await requireUser();
  await getDb()
    .delete(questions)
    .where(and(eq(questions.id, z.string().parse(id)), eq(questions.userId, me.id)));
  revalidatePath("/questoes");
}

/** Questão completa (com imagens) para ver ou editar. */
export async function getQuestionFull(id: string) {
  const me = await requireUser();
  const q = await findVisibleQuestion(me.id, z.string().parse(id));
  if (!q) return null;
  return { ...q, mine: q.userId === me.id };
}

export type FullQuestion = NonNullable<Awaited<ReturnType<typeof getQuestionFull>>>;

const drawSchema = z.object({
  scope: z.enum(["all", "mine", "group", "global"]),
  area: z.string().max(40).optional(),
  subject: z.string().max(80).optional(),
  exclude: z.array(z.string()).max(500).default([]),
});

/**
 * Sorteia a próxima questão para revisar. Peso: errada na última vez (5) >
 * nunca respondida (3) > acertada (1). Volta sem gabarito.
 */
export async function drawReview(input: z.input<typeof drawSchema>) {
  const me = await requireUser();
  const f = drawSchema.parse(input);
  const db = getDb();
  const conds = [canSee(me.id), sql`${questions.answer} is not null`];
  if (f.scope === "mine") conds.push(eq(questions.userId, me.id));
  if (f.scope === "group") conds.push(eq(questions.visibility, "group"));
  if (f.scope === "global") conds.push(eq(questions.visibility, "global"));
  if (f.area) conds.push(eq(questions.area, f.area));
  if (f.subject) conds.push(eq(questions.subject, f.subject));
  const cands = await db.select({ id: questions.id }).from(questions).where(and(...conds));
  const total = cands.length;
  const excluded = new Set(f.exclude);
  let pool = cands.filter((c) => !excluded.has(c.id));
  if (!pool.length) pool = cands; // já passou por todas: recomeça
  if (!pool.length) return { total: 0, question: null };
  const last = await lastAttempts(me.id);
  const W = { wrong: 5, right: 1 } as const;
  const weight = (id: string) => {
    const l = last.get(id);
    return l ? W[l] : 3;
  };
  const sum = pool.reduce((a, c) => a + weight(c.id), 0);
  let r = Math.random() * sum;
  let pick = pool[0].id;
  for (const c of pool) {
    r -= weight(c.id);
    if (r <= 0) {
      pick = c.id;
      break;
    }
  }
  const [q] = await db.select().from(questions).where(eq(questions.id, pick));
  return {
    total,
    question: {
      id: q.id,
      area: q.area,
      subject: q.subject,
      topic: q.topic,
      statement: q.statement,
      images: q.images,
      alternatives: q.alternatives,
      source: q.source,
      last: last.get(q.id) ?? null,
    },
  };
}

export type ReviewQuestion = NonNullable<Awaited<ReturnType<typeof drawReview>>["question"]>;

export async function answerQuestion(id: string, choice: number) {
  const me = await requireUser();
  const q = await findVisibleQuestion(me.id, z.string().parse(id));
  if (!q || q.answer === null) return null;
  const c = z.number().int().min(0).max(4).parse(choice);
  const correct = c === q.answer;
  await getDb().insert(questionAttempts).values({ userId: me.id, questionId: q.id, correct });
  const day = dayOf();
  // XP uma vez por questão por dia (responder de novo a mesma não dá XP extra)
  const xp = await award(
    me.id,
    day,
    correct ? QUESTION_XP.correct : QUESTION_XP.wrong,
    correct ? "Acertou uma questão do banco" : "Respondeu uma questão do banco",
    `q-ans:${q.id}:${day}`,
  );
  revalidatePath("/questoes");
  return { correct, answer: q.answer, explanation: q.explanation, xp };
}
