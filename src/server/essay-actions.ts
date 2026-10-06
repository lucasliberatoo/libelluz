"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { AXES, ESSAY_XP, essayBandBonus, SAMPLE_THEMES } from "@/lib/essay";
import { drawTheme } from "./essay-queries";
import { award } from "./xp";

const { users, essayThemes, essays } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const done = () => revalidatePath("/redacoes");
const theme = (userId: string, id: string) => and(eq(essayThemes.id, id), eq(essayThemes.userId, userId));

export type Result = { ok: true; id?: string; xp?: number } | { ok: false; error: string };

/* ---------- Ritmo ---------- */

export async function setEssayRhythm(rhythm: string, day: number) {
  const userId = await requireUser();
  const r = z.object({ rhythm: z.enum(["fixo", "semana"]), day: z.number().int().min(0).max(6) }).parse({ rhythm, day });
  await getDb().update(users).set({ essayRhythm: r.rhythm, essayDay: r.day }).where(eq(users.id, userId));
  done();
}

/* ---------- Banco de temas ---------- */

const themeSchema = z.object({
  title: z.string().trim().min(3, "Escreva o tema").max(300),
  axis: z.enum(AXES),
  source: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export async function saveTheme(input: z.input<typeof themeSchema>, id?: string): Promise<Result> {
  const userId = await requireUser();
  const r = themeSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const v = { title: r.data.title, axis: r.data.axis, source: r.data.source || null, notes: r.data.notes || null };
  const db = getDb();
  if (id) {
    await db.update(essayThemes).set(v).where(theme(userId, id));
  } else {
    const [t] = await db.insert(essayThemes).values({ userId, ...v }).returning({ id: essayThemes.id });
    id = t.id;
  }
  done();
  return { ok: true, id };
}

export async function deleteTheme(id: string) {
  const userId = await requireUser();
  await getDb().delete(essayThemes).where(theme(userId, id));
  done();
}

/** Devolve um tema (já feito) ao estoque do sorteio. */
export async function restockTheme(id: string) {
  const userId = await requireUser();
  await getDb().update(essayThemes).set({ status: "stock" }).where(theme(userId, id));
  done();
}

/** Carrega os temas oficiais de ENEMs anteriores (só com o banco vazio). */
export async function seedSampleThemes() {
  const userId = await requireUser();
  const db = getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(essayThemes)
    .where(eq(essayThemes.userId, userId));
  if (Number(n) > 0) return;
  await db.insert(essayThemes).values(SAMPLE_THEMES.map((t) => ({ userId, ...t })));
  done();
}

/* ---------- Sorteio ---------- */

async function currentTheme(userId: string) {
  const [t] = await getDb()
    .select({ id: essayThemes.id })
    .from(essayThemes)
    .where(and(eq(essayThemes.userId, userId), sql`${essayThemes.status} in ('drawn','accepted')`));
  return t?.id ?? null;
}

export async function drawNow(): Promise<Result> {
  const userId = await requireUser();
  const cur = await currentTheme(userId);
  if (cur) return { ok: true, id: cur };
  const id = await drawTheme(userId);
  done();
  return id ? { ok: true, id } : { ok: false, error: "Seu estoque de temas está vazio. Cadastre alguns temas primeiro." };
}

export async function acceptTheme(id: string) {
  const userId = await requireUser();
  await getDb().update(essayThemes).set({ status: "accepted" }).where(theme(userId, id));
  done();
}

/** Passa o tema: volta ao estoque (passCount+1) e já sorteia outro. */
export async function passTheme(id: string): Promise<Result> {
  const userId = await requireUser();
  await getDb()
    .update(essayThemes)
    .set({ status: "stock", passCount: sql`${essayThemes.passCount} + 1` })
    .where(theme(userId, id));
  const next = await drawTheme(userId, id);
  done();
  return next ? { ok: true, id: next } : { ok: false, error: "Sem outros temas no estoque." };
}

/* ---------- Redações ---------- */

const competency = z
  .number()
  .int()
  .min(0)
  .max(200)
  .refine((n) => n % 40 === 0, "Competências vão de 40 em 40");

const MAX_PHOTO = 1_500_000;

const essaySchema = z.object({
  themeId: z.string().max(64).nullable().optional(),
  title: z.string().trim().min(3, "Escreva o tema da redação").max(300),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  score: z.number().int().min(0).max(1000).nullable().optional(),
  competencies: z.array(competency).length(5).nullable().optional(),
  errorTags: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  comments: z.string().max(10000).optional().default(""),
  text: z.string().max(20000).optional().default(""),
  // undefined = manter a foto atual (edição); null = remover
  photo: z
    .string()
    .max(MAX_PHOTO, "Foto grande demais (máx. 1,5 MB)")
    .refine((s) => s.startsWith("data:image/"), "Foto inválida")
    .nullable()
    .optional(),
});

export async function saveEssay(input: z.input<typeof essaySchema>, id?: string): Promise<Result> {
  const userId = await requireUser();
  const r = essaySchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const d = r.data;
  const db = getDb();
  let themeId: string | null = null;
  if (d.themeId) {
    const [t] = await db.select({ id: essayThemes.id }).from(essayThemes).where(theme(userId, d.themeId));
    themeId = t?.id ?? null;
  }
  const comps = d.competencies ?? null;
  const score = d.score ?? (comps ? comps.reduce((a, b) => a + b, 0) : null);
  const values = {
    themeId,
    title: d.title,
    day: d.day,
    score,
    competencies: comps,
    errorTags: [...new Set(d.errorTags)],
    comments: d.comments || null,
    text: d.text || null,
    ...(d.photo !== undefined ? { photo: d.photo } : {}),
  };
  if (id) {
    const res = await db
      .update(essays)
      .set(values)
      .where(and(eq(essays.id, id), eq(essays.userId, userId)))
      .returning({ id: essays.id });
    if (!res.length) return { ok: false, error: "Redação não encontrada" };
  } else {
    const [e] = await db.insert(essays).values({ userId, ...values }).returning({ id: essays.id });
    id = e.id;
  }
  if (themeId) await db.update(essayThemes).set({ status: "done" }).where(theme(userId, themeId));

  const today = dayOf();
  let xp = await award(userId, today, ESSAY_XP.essay, `Redação: ${d.title.slice(0, 60)}`, `essay:${id}`);
  const bonus = essayBandBonus(score);
  if (bonus) xp += await award(userId, today, bonus, `Redação nota ${score}`, `essayband:${id}`);
  done();
  revalidatePath("/");
  return { ok: true, id, xp };
}

export async function deleteEssay(id: string) {
  const userId = await requireUser();
  await getDb()
    .delete(essays)
    .where(and(eq(essays.id, id), eq(essays.userId, userId)));
  done();
}

export async function getEssayPhoto(id: string): Promise<string | null> {
  const userId = await requireUser();
  const [e] = await getDb()
    .select({ photo: essays.photo })
    .from(essays)
    .where(and(eq(essays.id, z.string().max(64).parse(id)), eq(essays.userId, userId)));
  return e?.photo ?? null;
}
