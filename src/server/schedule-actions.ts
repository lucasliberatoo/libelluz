"use server";

import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { addDays, dayOf, weekStart } from "@/lib/day";
import { nextFreeDay, SUGGESTED_POS, suggestWeek } from "@/lib/schedule";
import { getOpenReviews, getTopicsInOrder, getWeekBlocks } from "./schedule";

const { scheduleBlocks, users, studyNodes, reviews } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function refresh() {
  revalidatePath("/cronograma");
  revalidatePath("/");
}

async function ownBlock(userId: string, id: string) {
  const b = await getDb().query.scheduleBlocks.findFirst({ where: and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)) });
  if (!b) throw new Error("Bloco não encontrado");
  return b;
}

async function nextPosition(userId: string, day: string) {
  const [{ max }] = await getDb()
    .select({ max: sql<number>`coalesce(max(${scheduleBlocks.position}), -1)`.mapWith(Number) })
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.day, day), sql`${scheduleBlocks.position} < ${SUGGESTED_POS}`));
  return max + 1;
}

/* ---------- Blocos ---------- */

const addSchema = z.object({
  nodeId: z.string().min(1),
  day: daySchema,
  minutes: z.number().int().min(10).max(300),
  kind: z.enum(["study", "review"]),
});

export async function addBlock(input: z.infer<typeof addSchema>) {
  const userId = await requireUser();
  const v = addSchema.parse(input);
  const db = getDb();
  const topic = await db.query.studyNodes.findFirst({ where: and(eq(studyNodes.id, v.nodeId), eq(studyNodes.userId, userId)) });
  if (!topic || topic.level !== "topic" || !topic.parentId) throw new Error("Tópico não encontrado");
  const subject = await db.query.studyNodes.findFirst({ where: and(eq(studyNodes.id, topic.parentId), eq(studyNodes.userId, userId)) });
  let reviewId: string | null = null;
  if (v.kind === "review") {
    const r = await db.query.reviews.findFirst({
      where: and(eq(reviews.userId, userId), eq(reviews.topic, topic.name), isNull(reviews.doneAt)),
    });
    reviewId = r?.id ?? null;
  }
  await db.insert(scheduleBlocks).values({
    userId,
    day: v.day,
    nodeId: topic.id,
    area: topic.area,
    subject: subject?.name ?? topic.area,
    topic: topic.name,
    kind: v.kind,
    plannedMin: v.minutes,
    reviewId,
    position: await nextPosition(userId, v.day),
  });
  refresh();
}

export async function moveBlock(id: string, day: string) {
  const userId = await requireUser();
  const d = daySchema.parse(day);
  const b = await ownBlock(userId, id);
  if (b.day === d) return;
  // mover = escolha da pessoa: deixa de ser "sugerido"
  await getDb()
    .update(scheduleBlocks)
    .set({ day: d, position: await nextPosition(userId, d) })
    .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)));
  refresh();
}

export async function resizeBlock(id: string, minutes: number) {
  const userId = await requireUser();
  const m = z.number().int().min(10).max(300).parse(minutes);
  await ownBlock(userId, id);
  await getDb().update(scheduleBlocks).set({ plannedMin: m }).where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)));
  refresh();
}

export async function removeBlock(id: string) {
  const userId = await requireUser();
  await getDb().delete(scheduleBlocks).where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)));
  refresh();
}

/** Pendente → hoje, ou → próximo dia com folga. */
export async function reschedulePending(id: string, to: "today" | "next") {
  const userId = await requireUser();
  const b = await ownBlock(userId, id);
  const today = dayOf();
  let day = today;
  if (to === "next") {
    const db = getDb();
    const u = (await db.query.users.findFirst({ where: eq(users.id, userId) }))!;
    const rows = await db
      .select({ day: scheduleBlocks.day, min: sql<number>`coalesce(sum(${scheduleBlocks.plannedMin}),0)`.mapWith(Number) })
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.userId, userId), gte(scheduleBlocks.day, today), lte(scheduleBlocks.day, addDays(today, 14))))
      .groupBy(scheduleBlocks.day);
    day = nextFreeDay({
      from: today,
      min: Math.max(10, b.plannedMin - b.doneMin),
      weekMinutes: u.weekMinutes,
      restDay: u.restDay,
      plannedByDay: new Map(rows.map((r) => [r.day, r.min])),
    });
  }
  await getDb()
    .update(scheduleBlocks)
    .set({ day, position: await nextPosition(userId, day) })
    .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)));
  refresh();
  return day;
}

/* ---------- Configuração ---------- */

const configSchema = z.object({
  weekMinutes: z.array(z.number().int().min(0).max(960)).length(7),
  restDay: z.number().int().min(0).max(6).nullable(),
});

export async function saveScheduleConfig(input: z.infer<typeof configSchema>) {
  const userId = await requireUser();
  const v = configSchema.parse(input);
  await getDb().update(users).set(v).where(eq(users.id, userId));
  refresh();
}

/* ---------- Sugerir minha semana ---------- */

/** Substitui os blocos sugeridos ainda vazios da semana por uma nova sugestão. Retorna quantos blocos criou. */
export async function suggestMyWeek(ws: string) {
  const userId = await requireUser();
  const start = weekStart(daySchema.parse(ws));
  const today = dayOf();
  const db = getDb();
  const u = (await db.query.users.findFirst({ where: eq(users.id, userId) }))!;
  const existing = await getWeekBlocks(userId, start);
  // saem: sugeridos, sem progresso, de hoje em diante
  const drop = existing.filter((b) => b.position >= SUGGESTED_POS && b.doneMin <= 0 && !b.doneAt && b.day >= today);
  const dropIds = new Set(drop.map((b) => b.id));
  const kept = existing.filter((b) => !dropIds.has(b.id));
  const [topics, open] = await Promise.all([getTopicsInOrder(userId), getOpenReviews(userId, addDays(start, 6))]);
  const plan = suggestWeek({
    weekStart: start,
    today,
    weekMinutes: u.weekMinutes,
    restDay: u.restDay,
    topics,
    reviews: open,
    kept: kept.filter((b) => b.day >= today).map((b) => ({ day: b.day, topic: b.topic, plannedMin: b.plannedMin, reviewId: b.reviewId })),
  });
  for (const b of drop) await db.delete(scheduleBlocks).where(and(eq(scheduleBlocks.id, b.id), eq(scheduleBlocks.userId, userId)));
  const perDay = new Map<string, number>();
  const rows = plan.map((p) => {
    const i = perDay.get(p.day) ?? 0;
    perDay.set(p.day, i + 1);
    return { userId, ...p, position: SUGGESTED_POS + i };
  });
  if (rows.length) await db.insert(scheduleBlocks).values(rows);
  refresh();
  return rows.length;
}
