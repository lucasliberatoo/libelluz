import "server-only";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf } from "@/lib/day";
import { fillBlocks, firstReview, nextReview, restDaysBetween, reviewXp, SCHEDULE_XP, SUGGESTED_POS } from "@/lib/schedule";
import { award } from "./xp";

const { scheduleBlocks, reviews, users, studyNodes, focusSessions } = schema;

export type Block = typeof scheduleBlocks.$inferSelect;

/** Dias de descanso planejado desde que a pessoa entrou (derivados do restDay atual). */
export function restDaysOf(u: { restDay: number | null; createdAt: Date }, today = dayOf()) {
  return restDaysBetween(dayOf(u.createdAt), today, u.restDay);
}

/* ---------- Leitura ---------- */

export async function getWeekBlocks(userId: string, ws: string) {
  return getDb().query.scheduleBlocks.findMany({
    where: and(eq(scheduleBlocks.userId, userId), gte(scheduleBlocks.day, ws), lte(scheduleBlocks.day, addDays(ws, 6))),
    orderBy: [asc(scheduleBlocks.day), asc(scheduleBlocks.position), asc(scheduleBlocks.createdAt)],
  });
}

/** Blocos de dias passados não concluídos (sem culpa: só ficam guardados aqui). */
export async function getPendingBlocks(userId: string, today = dayOf()) {
  return getDb().query.scheduleBlocks.findMany({
    where: and(eq(scheduleBlocks.userId, userId), lt(scheduleBlocks.day, today), isNull(scheduleBlocks.doneAt)),
    orderBy: [asc(scheduleBlocks.day), asc(scheduleBlocks.position)],
    limit: 50,
  });
}

/** Revisões abertas que vencem até `until`. */
export async function getOpenReviews(userId: string, until: string) {
  return getDb().query.reviews.findMany({
    where: and(eq(reviews.userId, userId), isNull(reviews.doneAt), lte(reviews.dueDay, until)),
    orderBy: [asc(reviews.dueDay)],
  });
}

/** Tópicos da árvore na ordem (área → disciplina → tópico) com minutos estudados. */
export async function getTopicsInOrder(userId: string) {
  const db = getDb();
  const [nodes, mins] = await Promise.all([
    db.query.studyNodes.findMany({ where: eq(studyNodes.userId, userId), orderBy: [asc(studyNodes.position), asc(studyNodes.name)] }),
    db
      .select({ topic: focusSessions.topic, min: sql<number>`coalesce(sum(${focusSessions.durationMin}),0)`.mapWith(Number) })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt)))
      .groupBy(focusSessions.topic),
  ]);
  const minBy = new Map(mins.map((m) => [m.topic, m.min]));
  const kids = new Map<string | null, typeof nodes>();
  for (const n of nodes) {
    const k = n.parentId ?? null;
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k)!.push(n);
  }
  const out: { nodeId: string; area: string; subject: string; topic: string; mastery: boolean; minutes: number }[] = [];
  for (const a of kids.get(null) ?? [])
    for (const s of kids.get(a.id) ?? [])
      for (const t of kids.get(s.id) ?? [])
        out.push({ nodeId: t.id, area: a.name, subject: s.name, topic: t.name, mastery: t.mastery, minutes: minBy.get(t.name) ?? 0 });
  return out;
}

/* ---------- O Foco preenche o bloco e cuida das revisões ---------- */

async function closeReview(userId: string, r: typeof reviews.$inferSelect, day: string, enemDate: string | null) {
  const db = getDb();
  const now = new Date();
  const done = await db
    .update(reviews)
    .set({ doneAt: now })
    .where(and(eq(reviews.id, r.id), isNull(reviews.doneAt)))
    .returning({ id: reviews.id });
  if (!done.length) return 0;
  const next = nextReview({ step: r.step, intervalDays: r.intervalDays, day, enemDate });
  // createdAt = doneAt da anterior: é assim que applyReviewAccuracy acha a próxima
  await db.insert(reviews).values({ userId, nodeId: r.nodeId, area: r.area, subject: r.subject, topic: r.topic, ...next, createdAt: now });
  // blocos futuros dessa revisão que ainda estavam vazios saem do cronograma
  await db
    .delete(scheduleBlocks)
    .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.reviewId, r.id), gt(scheduleBlocks.day, day), eq(scheduleBlocks.doneMin, 0)));
  return award(userId, day, reviewXp(day, r.dueDay), `Revisão: ${r.topic}`, `review:${r.id}`);
}

/**
 * Chamado ao encerrar uma sessão de foco: soma os minutos nos blocos do dia com o mesmo tópico,
 * conclui blocos (+XP), fecha/abre revisões. Retorna o XP dado.
 */
export async function syncFocusToSchedule(
  userId: string,
  s: { nodeId: string | null; area: string; subject: string; topic: string; kind: string },
  day: string,
  minutes: number,
) {
  if (minutes < 1) return 0;
  const db = getDb();
  const isReview = s.kind === "Revisão";
  let xp = 0;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { enemDate: true } });
  const enemDate = u?.enemDate ?? null;

  const blocks = await db.query.scheduleBlocks.findMany({
    where: and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.day, day), eq(scheduleBlocks.topic, s.topic)),
    orderBy: [asc(scheduleBlocks.position), asc(scheduleBlocks.createdAt)],
  });
  let reviewToClose: string | null = null;
  for (const f of fillBlocks(blocks, minutes, isReview ? "review" : "study")) {
    const b = blocks.find((x) => x.id === f.id)!;
    const finish = f.completed && !b.doneAt;
    await db
      .update(scheduleBlocks)
      .set({ doneMin: f.doneMin, ...(finish ? { doneAt: new Date() } : {}) })
      .where(eq(scheduleBlocks.id, b.id));
    if (finish) {
      xp += await award(userId, day, SCHEDULE_XP.block, "Bloco do cronograma", `block:${b.id}`);
      if (b.kind === "review" && b.reviewId) reviewToClose ??= b.reviewId;
    }
    if (isReview && b.kind === "review" && b.reviewId) reviewToClose ??= b.reviewId;
  }

  const open = await db.query.reviews.findMany({
    where: and(eq(reviews.userId, userId), eq(reviews.topic, s.topic), isNull(reviews.doneAt)),
    orderBy: [asc(reviews.dueDay)],
  });
  const target = (reviewToClose && open.find((r) => r.id === reviewToClose)) || (isReview ? open[0] : undefined);
  if (target) xp += await closeReview(userId, target, day, enemDate);
  else if (!open.length) {
    // 1º estudo do tópico (ou revisão livre sem revisão marcada): agenda a 1ª revisão para amanhã
    await db.insert(reviews).values({ userId, nodeId: s.nodeId, area: s.area, subject: s.subject, topic: s.topic, ...firstReview(day, enemDate) });
  }
  return xp;
}

/** Depois do resumo de uma sessão de Revisão: o acerto ajusta o intervalo da próxima. */
export async function applyReviewAccuracy(userId: string, s: { topic: string; startedAt: Date }, done: number, correct: number) {
  if (!done) return;
  const db = getDb();
  const accuracy = Math.round((correct / done) * 100);
  const closed = await db.query.reviews.findFirst({
    where: and(eq(reviews.userId, userId), eq(reviews.topic, s.topic), isNotNull(reviews.doneAt), gte(reviews.doneAt, s.startedAt)),
    orderBy: [desc(reviews.doneAt)],
  });
  if (!closed?.doneAt) return;
  await db.update(reviews).set({ lastAccuracy: accuracy }).where(eq(reviews.id, closed.id));
  const next = await db.query.reviews.findFirst({
    where: and(eq(reviews.userId, userId), eq(reviews.topic, s.topic), isNull(reviews.doneAt), gte(reviews.createdAt, closed.doneAt)),
  });
  if (!next) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { enemDate: true } });
  const plan = nextReview({ step: closed.step, intervalDays: closed.intervalDays, accuracy, day: dayOf(closed.doneAt), enemDate: u?.enemDate });
  await db.update(reviews).set(plan).where(eq(reviews.id, next.id));
}

/* ---------- Página do cronograma ---------- */

export async function getSchedulePage(userId: string, ws: string) {
  const db = getDb();
  const today = dayOf();
  const [u, blocks, pending, open, topics] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    getWeekBlocks(userId, ws),
    getPendingBlocks(userId, today),
    getOpenReviews(userId, addDays(ws, 6)),
    getTopicsInOrder(userId),
  ]);
  if (!u) throw new Error("Usuário não encontrado");
  const pick = (b: Block) => ({
    id: b.id,
    day: b.day,
    area: b.area,
    subject: b.subject,
    topic: b.topic,
    kind: b.kind,
    plannedMin: b.plannedMin,
    doneMin: b.doneMin,
    done: !!b.doneAt,
    suggested: b.position >= SUGGESTED_POS,
  });
  const scheduled = new Set(blocks.map((b) => b.reviewId).filter(Boolean));
  return {
    today,
    weekStart: ws,
    config: { weekMinutes: u.weekMinutes, restDay: u.restDay, enemDate: u.enemDate },
    blocks: blocks.map(pick),
    pending: pending.map(pick),
    // revisões que vencem até o fim da semana e ainda não têm bloco nela
    reviews: open.filter((r) => !scheduled.has(r.id)).map((r) => ({ id: r.id, area: r.area, subject: r.subject, topic: r.topic, dueDay: r.dueDay })),
    topics: topics.map((t) => ({ nodeId: t.nodeId, area: t.area, subject: t.subject, topic: t.topic, mastery: t.mastery })),
  };
}

export type SchedulePageData = Awaited<ReturnType<typeof getSchedulePage>>;
export type BlockView = SchedulePageData["blocks"][number];

/** Plano de hoje para o dashboard: blocos do dia e revisões vencidas sem bloco hoje. */
export async function getTodayPlan(userId: string, today = dayOf()) {
  const db = getDb();
  const [blocks, open] = await Promise.all([
    db.query.scheduleBlocks.findMany({
      where: and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.day, today)),
      orderBy: [asc(scheduleBlocks.position), asc(scheduleBlocks.createdAt)],
    }),
    getOpenReviews(userId, today),
  ]);
  const scheduled = new Set(blocks.map((b) => b.reviewId).filter(Boolean));
  return {
    blocks: blocks.map((b) => ({
      id: b.id,
      area: b.area,
      subject: b.subject,
      topic: b.topic,
      kind: b.kind,
      plannedMin: b.plannedMin,
      doneMin: b.doneMin,
      done: !!b.doneAt,
    })),
    reviews: open
      .filter((r) => !scheduled.has(r.id))
      .map((r) => ({ id: r.id, area: r.area, subject: r.subject, topic: r.topic, dueDay: r.dueDay, late: r.dueDay < today })),
  };
}
