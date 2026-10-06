import "server-only";
import { and, eq, gte, isNotNull, lte, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf, TZ } from "@/lib/day";
import { computeStreak } from "@/lib/game";
import { restDaysBetween } from "@/lib/schedule";
import { summarizeExams } from "@/lib/exams";
import {
  bucketFor,
  bucketKey,
  bucketKeys,
  bucketLabel,
  longestStreak,
  PERIODS,
  spanDays,
  type Bucket,
  type PeriodKey,
} from "@/components/estatisticas/lib";
import { getExams } from "./exam-queries";

const { users, focusSessions, xpEvents, questionAttempts, questions, habitLogs, scheduleBlocks, reviews, essays } = schema;

/* Toda a agregação é feita no SQL (GROUP BY). Datas internas vão como literais validados. */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function lit(day: string) {
  if (!DAY_RE.test(day)) throw new Error("data inválida");
  return sql.raw(`'${day}'`);
}
/** Meia-noite de Brasília (UTC−3, sem horário de verão) do dia, em UTC — para colunas timestamp. */
const midnightUtc = (day: string) => sql.raw(`'${day} 03:00:00'`);
/** Timestamp (gravado em UTC) convertido para a hora local do app. */
const local = (col: SQLWrapper) => sql`((${col} at time zone 'UTC') at time zone '${sql.raw(TZ)}')`;
/** 'c' = período atual, 'p' = período anterior. */
const curOrPrev = (col: SQLWrapper, from: string) => sql<string>`case when ${col} >= ${lit(from)} then 'c' else 'p' end`;

const num = (s: SQL) => sql<number>`coalesce(${s}, 0)`.mapWith(Number);
const ord1 = sql`1`;
const ord2 = sql`2`;

export type Pair = { cur: number; prev: number | null };
export type AreaRow = { area: string; min: number; done: number; correct: number };
export type SubjectRow = AreaRow & { subject: string };

export type StatsData = Awaited<ReturnType<typeof getStats>>;

export async function getStats(userId: string, period: PeriodKey) {
  const db = getDb();
  const today = dayOf();

  const [u] = await db
    .select({ focusGoalMin: users.focusGoalMin, restDay: users.restDay, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!u) throw new Error("Usuário não encontrado");

  // Minutos/sessões/questões por dia, desde sempre: alimenta resumo, linha do tempo, calendário e sequências.
  const daily = await db
    .select({
      day: focusSessions.day,
      min: num(sql`sum(${focusSessions.durationMin})`),
      n: num(sql`count(*)`),
      done: num(sql`sum(${focusSessions.questionsDone})`),
      correct: num(sql`sum(${focusSessions.questionsCorrect})`),
    })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt), isNotNull(focusSessions.day)))
    .groupBy(focusSessions.day);
  const days = daily.filter((d) => d.day).map((d) => ({ ...d, day: d.day! })).sort((a, b) => (a.day < b.day ? -1 : 1));

  const joined = dayOf(u.createdAt);
  const firstDay = days[0]?.day && days[0].day < joined ? days[0].day : joined;
  const def = PERIODS.find((p) => p.key === period)!;
  const from = def.days ? addDays(today, -(def.days - 1)) : firstDay;
  const len = spanDays(from, today);
  const prevFrom = def.days ? addDays(from, -len) : null;
  const prevTo = def.days ? addDays(from, -1) : null;
  const lo = prevFrom ?? from; // início da janela consultada (inclui o período anterior)
  const bucket: Bucket = bucketFor(len);

  const fs = focusSessions;
  const inFocus = and(eq(fs.userId, userId), isNotNull(fs.endedAt), gte(fs.day, from), lte(fs.day, today));

  const [areaRows, kindRows, methodRows, hourRows, dowRows, xpDayRows, xpSrcRows, bankRows, habitRows, blockRows, reviewRows, essayRows, examList] =
    await Promise.all([
      db
        .select({
          area: fs.area,
          subject: fs.subject,
          min: num(sql`sum(${fs.durationMin})`),
          done: num(sql`sum(${fs.questionsDone})`),
          correct: num(sql`sum(${fs.questionsCorrect})`),
        })
        .from(fs)
        .where(inFocus)
        .groupBy(fs.area, fs.subject),
      db
        .select({ name: fs.kind, min: num(sql`sum(${fs.durationMin})`), n: num(sql`count(*)`) })
        .from(fs)
        .where(inFocus)
        .groupBy(fs.kind),
      db
        .select({ name: fs.method, min: num(sql`sum(${fs.durationMin})`), n: num(sql`count(*)`) })
        .from(fs)
        .where(inFocus)
        .groupBy(fs.method),
      db
        .select({ h: sql<number>`extract(hour from ${local(fs.startedAt)})`.mapWith(Number), min: num(sql`sum(${fs.durationMin})`) })
        .from(fs)
        .where(inFocus)
        .groupBy(ord1),
      db
        .select({ d: sql<number>`extract(dow from ${fs.day})`.mapWith(Number), min: num(sql`sum(${fs.durationMin})`), n: num(sql`count(distinct ${fs.day})`) })
        .from(fs)
        .where(inFocus)
        .groupBy(ord1),
      db
        .select({ day: xpEvents.day, xp: num(sql`sum(${xpEvents.amount})`) })
        .from(xpEvents)
        .where(and(eq(xpEvents.userId, userId), gte(xpEvents.day, lo), lte(xpEvents.day, today)))
        .groupBy(xpEvents.day),
      db
        .select({ cat: sql<string>`${xpCategory}`, xp: num(sql`sum(${xpEvents.amount})`) })
        .from(xpEvents)
        .where(and(eq(xpEvents.userId, userId), gte(xpEvents.day, from), lte(xpEvents.day, today)))
        .groupBy(ord1),
      // Banco de questões: só área/matéria da questão (nunca o enunciado ou imagens).
      db
        .select({
          per: curOrPrev(local(questionAttempts.at), from),
          area: questions.area,
          subject: sql<string>`coalesce(${questions.subject}, '')`,
          done: num(sql`count(*)`),
          correct: num(sql`sum(case when ${questionAttempts.correct} then 1 else 0 end)`),
        })
        .from(questionAttempts)
        .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
        .where(and(eq(questionAttempts.userId, userId), gte(questionAttempts.at, sql`${midnightUtc(lo)}`)))
        .groupBy(ord1, ord2, sql`3`),
      // Hábitos: só agregados (a foto e o diário ficam de fora).
      db
        .select({
          per: curOrPrev(habitLogs.day, from),
          days: num(sql`count(*)`),
          water: num(sql`avg(nullif(${habitLogs.waterCups}, 0))`),
          waterDays: num(sql`count(nullif(${habitLogs.waterCups}, 0))`),
          reading: num(sql`avg(nullif(${habitLogs.readingMin}, 0))`),
          readingDays: num(sql`count(nullif(${habitLogs.readingMin}, 0))`),
          exercise: num(sql`sum(case when ${habitLogs.exercise} then 1 else 0 end)`),
          mood: sql<number | null>`avg(${habitLogs.mood})`.mapWith((v) => (v == null ? null : Number(v))),
        })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), gte(habitLogs.day, lo), lte(habitLogs.day, today)))
        .groupBy(ord1),
      db
        .select({
          per: curOrPrev(scheduleBlocks.day, from),
          total: num(sql`count(*)`),
          done: num(sql`count(${scheduleBlocks.doneAt})`),
          planned: num(sql`sum(${scheduleBlocks.plannedMin})`),
          doneMin: num(sql`sum(least(${scheduleBlocks.doneMin}, ${scheduleBlocks.plannedMin}))`),
        })
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.userId, userId), gte(scheduleBlocks.day, lo), lte(scheduleBlocks.day, today)))
        .groupBy(ord1),
      db
        .select({
          per: curOrPrev(reviews.dueDay, from),
          total: num(sql`count(*)`),
          onTime: num(sql`sum(case when ${reviews.doneAt} is not null and ${local(reviews.doneAt)}::date <= ${reviews.dueDay} then 1 else 0 end)`),
          late: num(sql`sum(case when ${reviews.doneAt} is not null and ${local(reviews.doneAt)}::date > ${reviews.dueDay} then 1 else 0 end)`),
        })
        .from(reviews)
        .where(and(eq(reviews.userId, userId), gte(reviews.dueDay, lo), lte(reviews.dueDay, today)))
        .groupBy(ord1),
      db
        .select({
          per: sql<string>`case when ${essays.day} >= ${lit(from)} then 'c' else 'all' end`,
          n: num(sql`count(${essays.score})`),
          avg: num(sql`avg(${essays.score})`),
          best: num(sql`max(${essays.score})`),
        })
        .from(essays)
        .where(eq(essays.userId, userId))
        .groupBy(ord1),
      getExams(userId),
    ]);

  /* ---------- Resumo ---------- */
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const cur = days.filter((d) => inRange(d.day, from, today));
  const prev = prevFrom ? days.filter((d) => inRange(d.day, prevFrom, prevTo!)) : null;
  const sum = <T,>(l: T[], f: (x: T) => number) => l.reduce((a, x) => a + f(x), 0);

  const bank = { c: { done: 0, correct: 0 }, p: { done: 0, correct: 0 } };
  for (const r of bankRows) {
    const t = bank[r.per === "c" ? "c" : "p"];
    t.done += r.done;
    t.correct += r.correct;
  }
  const xpCur = sum(xpDayRows.filter((r) => r.day >= from), (r) => r.xp);
  const xpPrev = prevFrom ? sum(xpDayRows.filter((r) => r.day < from), (r) => r.xp) : null;
  const qCur = sum(cur, (d) => d.done) + bank.c.done;
  const qCorCur = sum(cur, (d) => d.correct) + bank.c.correct;
  const qPrev = prev ? sum(prev, (d) => d.done) + bank.p.done : null;
  const qCorPrev = prev ? sum(prev, (d) => d.correct) + bank.p.correct : null;

  const studiedSet = days.filter((d) => d.min > 0).map((d) => d.day);
  const rest = restDaysBetween(firstDay, today, u.restDay);
  const streak = computeStreak(studiedSet, today, rest);

  const summary = {
    focusMin: pair(sum(cur, (d) => d.min), prev && sum(prev, (d) => d.min)),
    sessions: pair(sum(cur, (d) => d.n), prev && sum(prev, (d) => d.n)),
    daysStudied: pair(cur.filter((d) => d.min > 0).length, prev && prev.filter((d) => d.min > 0).length),
    xp: pair(xpCur, xpPrev),
    questions: pair(qCur, qPrev),
    accuracy: { cur: qCur ? Math.round((qCorCur / qCur) * 100) : null, prev: qPrev ? Math.round((qCorPrev! / qPrev) * 100) : null },
    streak: streak.streak,
    streakRecord: Math.max(streak.streak, longestStreak(studiedSet, today, rest)),
    firewood: streak.firewood,
  };

  /* ---------- Linha do tempo (foco e XP) ---------- */
  const keys = bucketKeys(from, today, bucket);
  const minBy = new Map<string, number>();
  const dayCount = new Map<string, number>();
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const k = bucketKey(d, bucket);
    dayCount.set(k, (dayCount.get(k) ?? 0) + 1);
  }
  for (const d of cur) minBy.set(bucketKey(d.day, bucket), (minBy.get(bucketKey(d.day, bucket)) ?? 0) + d.min);
  const xpBy = new Map<string, number>();
  for (const r of xpDayRows) if (r.day >= from) xpBy.set(bucketKey(r.day, bucket), (xpBy.get(bucketKey(r.day, bucket)) ?? 0) + r.xp);
  const timeline = keys.map((k) => {
    const min = minBy.get(k) ?? 0;
    const n = dayCount.get(k) ?? 1;
    return { k, label: bucketLabel(k, bucket), totalH: round1(min / 60), avgH: round1(min / 60 / n), days: n, xp: xpBy.get(k) ?? 0 };
  });

  // Calendário do ano: últimas 53 semanas, de domingo a hoje.
  const heatFrom = addDays(today, -364 - new Date(`${today}T12:00:00Z`).getUTCDay());
  const heat = days.filter((d) => d.day >= heatFrom && d.min > 0).map((d) => [d.day, Math.round(d.min)] as [string, number]);

  /* ---------- Áreas e matérias ---------- */
  const areaMap = new Map<string, AreaRow & { bankDone: number; bankCorrect: number }>();
  const subjMap = new Map<string, SubjectRow & { bankDone: number; bankCorrect: number }>();
  const blank = { min: 0, done: 0, correct: 0, bankDone: 0, bankCorrect: 0 };
  for (const r of areaRows) {
    const a = areaMap.get(r.area) ?? { area: r.area, ...blank };
    a.min += r.min;
    a.done += r.done;
    a.correct += r.correct;
    areaMap.set(r.area, a);
    const key = `${r.area}|${r.subject}`;
    const s = subjMap.get(key) ?? { area: r.area, subject: r.subject, ...blank };
    s.min += r.min;
    s.done += r.done;
    s.correct += r.correct;
    subjMap.set(key, s);
  }
  for (const r of bankRows) {
    if (r.per !== "c") continue;
    const a = areaMap.get(r.area) ?? { area: r.area, ...blank };
    a.bankDone += r.done;
    a.bankCorrect += r.correct;
    areaMap.set(r.area, a);
    if (!r.subject) continue;
    const key = `${r.area}|${r.subject}`;
    const s = subjMap.get(key) ?? { area: r.area, subject: r.subject, ...blank };
    s.bankDone += r.done;
    s.bankCorrect += r.correct;
    subjMap.set(key, s);
  }
  const areas = [...areaMap.values()].sort((a, b) => b.min - a.min);
  const subjects = [...subjMap.values()];

  /* ---------- Horários ---------- */
  const hours = Array.from({ length: 24 }, (_, h) => Math.round(hourRows.find((r) => r.h === h)?.min ?? 0));
  const weekdays = Array.from({ length: 7 }, (_, d) => {
    const r = dowRows.find((x) => x.d === d);
    return { min: Math.round(r?.min ?? 0), days: r?.n ?? 0 };
  });

  /* ---------- Hábitos, cronograma, revisões ---------- */
  const habit = (per: string) => habitRows.find((r) => r.per === per) ?? null;
  const blocks = (per: string) => blockRows.find((r) => r.per === per) ?? null;
  const rev = (per: string) => reviewRows.find((r) => r.per === per) ?? null;

  /* ---------- Simulados e redação ---------- */
  const ex = summarizeExams(examList);
  const essayCur = essayRows.find((r) => r.per === "c");
  const essayAll = essayRows.reduce(
    (a, r) => ({ n: a.n + r.n, sum: a.sum + r.avg * r.n, best: Math.max(a.best, r.best) }),
    { n: 0, sum: 0, best: 0 },
  );

  return {
    period,
    range: { from, to: today, days: len, prevFrom, prevTo },
    bucket,
    goalH: round1(u.focusGoalMin / 60),
    summary,
    timeline,
    heat: { from: heatFrom, to: today, days: heat, goalMin: u.focusGoalMin },
    areas,
    subjects,
    kinds: kindRows.sort((a, b) => b.min - a.min),
    methods: methodRows.sort((a, b) => b.min - a.min),
    hours,
    weekdays,
    xpSources: xpSrcRows.filter((r) => r.xp > 0).sort((a, b) => b.xp - a.xp),
    exams: {
      count: ex.timeline.length,
      last: ex.last ? { name: ex.last.name, day: ex.last.day, total: ex.last.total } : null,
      record: ex.record ? { name: ex.record.name, day: ex.record.day, total: ex.record.total } : null,
      delta: ex.delta,
    },
    essays: {
      periodAvg: essayCur?.n ? Math.round(essayCur.avg) : null,
      periodCount: essayCur?.n ?? 0,
      avg: essayAll.n ? Math.round(essayAll.sum / essayAll.n) : null,
      count: essayAll.n,
      best: essayAll.n ? essayAll.best : null,
    },
    habits: { cur: habit("c"), prev: prevFrom ? habit("p") : null },
    plan: {
      blocks: blocks("c"),
      prevBlocks: prevFrom ? blocks("p") : null,
      reviews: rev("c"),
      prevReviews: prevFrom ? rev("p") : null,
    },
  };
}

/** Categoria legível do XP, pela chave de dedupe (estável) e, na falta dela, pelo motivo. */
const xpCategory = sql`case
  when ${xpEvents.dedupe} like 'focus%' or ${xpEvents.reason} like 'Foco:%' or ${xpEvents.reason} like '%de foco no dia' then 'Foco'
  when ${xpEvents.dedupe} like 'questions:%' or ${xpEvents.dedupe} ~ '^q[0-9]+:' or ${xpEvents.dedupe} like 'q-%' or ${xpEvents.reason} like '%quest%' then 'Questões'
  when ${xpEvents.dedupe} like 'block:%' or ${xpEvents.dedupe} like 'review:%' then 'Cronograma e revisões'
  when ${xpEvents.dedupe} like 'task:%' or ${xpEvents.dedupe} like 'alltasks:%' then 'Tarefas do dia'
  when ${xpEvents.dedupe} like 'exam%' or ${xpEvents.reason} like 'Simulado%' or ${xpEvents.reason} like 'ENEM%' then 'Simulados'
  when ${xpEvents.dedupe} like 'essay%' or ${xpEvents.reason} like 'Redação%' then 'Redação'
  when ${xpEvents.dedupe} like 'mapa:%' then 'Mapa de estudos'
  when ${xpEvents.dedupe} like 'login:%' then 'Entrar no app'
  else 'Outros' end`;

function pair(cur: number, prev: number | null): Pair {
  return { cur, prev };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
