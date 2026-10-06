import "server-only";
import { cache } from "react";
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { avatarUrl } from "@/lib/avatar";
import { addDays, dayOf, nowMs, weekStart } from "@/lib/day";
import { computeStreak } from "@/lib/game";
import { levelFromXp } from "@/lib/levels";
import {
  missionMembers,
  missionProgress,
  missionStatus,
  suggestWeeklyMission,
  weeklyMissionId,
  type DailyStat,
  type MissionMetric,
} from "@/lib/missions";
import { notify } from "./notify";
import { firstName } from "./queries";
import { restDaysOf } from "./schedule";
import { award } from "./xp";

/*
 * Grupos: um grupo só, com todo mundo do app (o app é privado, só entra quem tem convite).
 * Tudo agregado no SQL e em paralelo; fotos nunca vão embutidas nas listas.
 */

const { users, focusSessions, xpEvents, feedReactions, feedComments, pokes, missions, questionAttempts } = schema;

export type Privacy = { hideAccuracy?: boolean; hideHours?: boolean; hideFeed?: boolean; hideStudyingNow?: boolean };

export const FEED_PAGE = 20;
export const REACTIONS = ["🔥", "👏", "💪"] as const;
export type TargetKind = "session" | "post" | "achievement";

/** Início do dia (America/Sao_Paulo, sem horário de verão desde 2019) como instante. */
const dayStartUtc = (day: string) => new Date(`${day}T00:00:00-03:00`);
const spDay = (col: typeof questionAttempts.at) => sql<string>`to_char((${col} at time zone 'UTC') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;

/* ---------- Membros ---------- */

export const getMembers = cache(async () => {
  const db = getDb();
  const today = dayOf();
  const [rows, xpRows, dayRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, image: users.image, privacy: users.privacy, restDay: users.restDay, createdAt: users.createdAt })
      .from(users),
    db
      .select({ userId: xpEvents.userId, xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`.mapWith(Number) })
      .from(xpEvents)
      .groupBy(xpEvents.userId),
    db
      .selectDistinct({ userId: focusSessions.userId, day: focusSessions.day })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), gt(focusSessions.durationMin, 0))),
  ]);
  const xp = new Map(xpRows.map((r) => [r.userId, r.xp]));
  const days = new Map<string, string[]>();
  for (const r of dayRows) if (r.day) (days.get(r.userId) ?? days.set(r.userId, []).get(r.userId)!).push(r.day);
  return rows
    .map((u) => {
      const streak = computeStreak(days.get(u.id) ?? [], today, restDaysOf(u, today));
      return {
        id: u.id,
        name: u.name?.trim() || "Sem nome",
        firstName: firstName(u.name),
        image: avatarUrl(u.id, u.image),
        privacy: (u.privacy ?? {}) as Privacy,
        level: levelFromXp(xp.get(u.id) ?? 0).level,
        streak: streak.streak,
        studiedToday: streak.studiedToday,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

export type Member = Awaited<ReturnType<typeof getMembers>>[number];
/** O que vai para o navegador (sem a privacidade dos outros). */
export type PublicMember = Omit<Member, "privacy">;
export function publicMember(m: Member): PublicMember {
  const { privacy, ...rest } = m;
  void privacy;
  return rest;
}

/* ---------- Feed ---------- */

type FeedRow = {
  kind: TargetKind;
  id: string;
  user_id: string;
  at_text: string;
  at_ms: number;
  subject: string | null;
  topic: string | null;
  area: string | null;
  minutes: number | null;
  q_done: number | null;
  q_correct: number | null;
  body: string | null;
  has_photo: boolean;
  ach_key: string | null;
  tier: number | null;
};

export type FeedItem = {
  kind: TargetKind;
  id: string;
  userId: string;
  at: number;
  session?: { subject: string; topic: string; area: string; minutes: number; questions: number; accuracy: number | null };
  post?: { text: string | null; photo: string | null };
  achievement?: { key: string; tier: number };
  reactions: { emoji: string; count: number; users: string[]; mine: boolean }[];
  comments: number;
};

export type FeedPage = { items: FeedItem[]; next: string | null };

const encodeCursor = (r: FeedRow) => `${r.at_text}|${r.id}`;
function decodeCursor(c?: string | null) {
  if (!c) return null;
  const i = c.indexOf("|");
  if (i < 0) return null;
  const at = c.slice(0, i);
  if (!/^\d{4}-\d{2}-\d{2}[ T][\d:.]+$/.test(at)) return null;
  return { at, id: c.slice(i + 1) };
}

/** Uma página do feed: sessões encerradas + posts + conquistas, mais recentes primeiro (cursor = instante|id). */
export async function getFeedPage(viewerId: string, cursor?: string | null): Promise<FeedPage> {
  const db = getDb();
  const c = decodeCursor(cursor);
  const [res, members] = await Promise.all([
    db.execute(sql`
      select f.*, f.at::text as at_text, (extract(epoch from f.at) * 1000)::float8 as at_ms from (
        select 'session'::text as kind, s.id, s.user_id, s.ended_at as at, s.subject, s.topic, s.area,
          s.duration_min::float8 as minutes, s.questions_done as q_done, s.questions_correct as q_correct,
          null::text as body, false as has_photo, null::text as ach_key, null::int as tier
        from ${focusSessions} s join ${users} u on u.id = s.user_id
        where s.ended_at is not null and s.duration_min >= 1
          and (s.user_id = ${viewerId} or coalesce((u.privacy->>'hideFeed')::boolean, false) = false)
        union all
        select 'post', p.id, p.user_id, p.created_at, null, null, null, null, null, null, p.text, p.photo is not null, null, null
        from ${schema.feedPosts} p
        union all
        select 'achievement', a.user_id || ':' || a.key || ':' || a.tier, a.user_id, a.unlocked_at, null, null, null, null, null, null, null, false, a.key, a.tier
        from ${schema.achievements} a
      ) f
      ${c ? sql`where (f.at, f.id) < (${c.at}::timestamp, ${c.id})` : sql``}
      order by f.at desc, f.id desc
      limit ${FEED_PAGE + 1}
    `),
    getMembers(),
  ]);
  const all = (res as unknown as { rows: FeedRow[] }).rows;
  const rows = all.slice(0, FEED_PAGE);
  const next = all.length > FEED_PAGE ? encodeCursor(rows[rows.length - 1]) : null;
  if (!rows.length) return { items: [], next: null };

  const byKind = (k: TargetKind) => rows.filter((r) => r.kind === k).map((r) => r.id);
  const targetFilter = (t: { targetKind: AnyPgColumn; targetId: AnyPgColumn }) =>
    or(
      ...(["session", "post", "achievement"] as const)
        .filter((k) => byKind(k).length)
        .map((k) => and(eq(t.targetKind, k), inArray(t.targetId, byKind(k)))),
    );
  const [reactRows, commentRows] = await Promise.all([
    db
      .select({
        kind: feedReactions.targetKind,
        id: feedReactions.targetId,
        emoji: feedReactions.emoji,
        n: sql<number>`count(*)`.mapWith(Number),
        users: sql<string>`string_agg(${feedReactions.userId}, ',' order by ${feedReactions.createdAt})`,
        mine: sql<boolean>`bool_or(${feedReactions.userId} = ${viewerId})`,
      })
      .from(feedReactions)
      .where(targetFilter(feedReactions))
      .groupBy(feedReactions.targetKind, feedReactions.targetId, feedReactions.emoji),
    db
      .select({ kind: feedComments.targetKind, id: feedComments.targetId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(feedComments)
      .where(targetFilter(feedComments))
      .groupBy(feedComments.targetKind, feedComments.targetId),
  ]);
  const privacy = new Map(members.map((m) => [m.id, m.privacy]));
  const comments = new Map(commentRows.map((r) => [`${r.kind}/${r.id}`, r.n]));

  const items = rows.map((r): FeedItem => {
    const key = `${r.kind}/${r.id}`;
    const reactions = REACTIONS.map((emoji) => {
      const x = reactRows.find((y) => `${y.kind}/${y.id}` === key && y.emoji === emoji);
      return { emoji, count: x?.n ?? 0, users: x?.users?.split(",") ?? [], mine: !!x?.mine };
    });
    const base = { kind: r.kind, id: r.id, userId: r.user_id, at: Number(r.at_ms), reactions, comments: comments.get(key) ?? 0 };
    if (r.kind === "session") {
      const done = Number(r.q_done ?? 0);
      const hideAcc = r.user_id !== viewerId && !!privacy.get(r.user_id)?.hideAccuracy;
      return {
        ...base,
        session: {
          subject: r.subject ?? "",
          topic: r.topic ?? "",
          area: r.area ?? "",
          minutes: Number(r.minutes ?? 0),
          questions: done,
          accuracy: done > 0 && !hideAcc ? Math.round((Number(r.q_correct ?? 0) / done) * 100) : null,
        },
      };
    }
    if (r.kind === "post") return { ...base, post: { text: r.body, photo: r.has_photo ? `/api/grupos/foto/${r.id}` : null } };
    return { ...base, achievement: { key: r.ach_key ?? "", tier: Number(r.tier ?? 1) } };
  });
  return { items, next };
}

/** Dono de um item do feed, se a pessoa pode vê-lo (respeita hideFeed). */
export async function feedTargetOwner(viewerId: string, kind: TargetKind, id: string): Promise<string | null> {
  const db = getDb();
  if (kind === "post") {
    const p = await db.query.feedPosts.findFirst({ where: eq(schema.feedPosts.id, id), columns: { userId: true } });
    return p?.userId ?? null;
  }
  if (kind === "session") {
    const [s] = await db
      .select({ userId: focusSessions.userId, privacy: users.privacy })
      .from(focusSessions)
      .innerJoin(users, eq(users.id, focusSessions.userId))
      .where(and(eq(focusSessions.id, id), isNotNull(focusSessions.endedAt)));
    if (!s) return null;
    if (s.userId !== viewerId && (s.privacy as Privacy)?.hideFeed) return null;
    return s.userId;
  }
  const parts = id.split(":");
  if (parts.length < 3) return null;
  const [userId, tier] = [parts[0], Number(parts[parts.length - 1])];
  const key = parts.slice(1, -1).join(":");
  const a = await db.query.achievements.findFirst({
    where: and(eq(schema.achievements.userId, userId), eq(schema.achievements.key, key), eq(schema.achievements.tier, tier)),
    columns: { userId: true },
  });
  return a?.userId ?? null;
}

/* ---------- Estudando agora / hoje ---------- */

export async function getStudyingNow(viewerId: string) {
  const db = getDb();
  const today = dayOf();
  const now = nowMs();
  const [members, open, todayRows, myPokes, pokedMe] = await Promise.all([
    getMembers(),
    db
      .select({
        userId: focusSessions.userId,
        subject: focusSessions.subject,
        topic: focusSessions.topic,
        area: focusSessions.area,
        startedAt: focusSessions.startedAt,
        pausedMs: focusSessions.pausedMs,
      })
      .from(focusSessions)
      // sessões esquecidas abertas há mais de 12h não contam
      .where(and(isNull(focusSessions.endedAt), isNull(focusSessions.pausedAt), gt(focusSessions.startedAt, new Date(now - 12 * 3600_000))))
      .orderBy(focusSessions.startedAt),
    db
      .select({
        userId: focusSessions.userId,
        min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number),
        sessions: sql<number>`count(*)`.mapWith(Number),
      })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), eq(focusSessions.day, today)))
      .groupBy(focusSessions.userId),
    db.select({ toId: pokes.toId }).from(pokes).where(and(eq(pokes.fromId, viewerId), eq(pokes.day, today))),
    db.select({ fromId: pokes.fromId }).from(pokes).where(and(eq(pokes.toId, viewerId), eq(pokes.day, today))),
  ]);
  const priv = new Map(members.map((m) => [m.id, m.privacy]));
  const hidden = (id: string, k: keyof Privacy) => id !== viewerId && !!priv.get(id)?.[k];
  const seen = new Set<string>();
  const now_ = open
    .filter((s) => !hidden(s.userId, "hideStudyingNow") && !seen.has(s.userId) && seen.add(s.userId))
    .map((s) => ({
      userId: s.userId,
      subject: s.subject,
      topic: s.topic,
      area: s.area,
      elapsedMin: Math.max(0, Math.floor((now - s.startedAt.getTime() - s.pausedMs) / 60000)),
    }));
  const mins = new Map(todayRows.filter((r) => r.min > 0).map((r) => [r.userId, r]));
  const studied = members
    .filter((m) => mins.has(m.id))
    .map((m) => ({ userId: m.id, minutes: hidden(m.id, "hideHours") ? null : mins.get(m.id)!.min, sessions: mins.get(m.id)!.sessions }))
    .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  const notYet = members.filter((m) => !mins.has(m.id)).map((m) => ({ userId: m.id, poked: myPokes.some((p) => p.toId === m.id) }));
  return { now: now_, studied, notYet, pokedMe: pokedMe.map((p) => p.fromId) };
}

/** Quantos estão em foco agora (para o selo da aba), respeitando hideStudyingNow. */
export async function countStudyingNow(viewerId: string) {
  const [r] = await getDb()
    .select({ n: sql<number>`count(distinct ${focusSessions.userId})`.mapWith(Number) })
    .from(focusSessions)
    .innerJoin(users, eq(users.id, focusSessions.userId))
    .where(
      and(
        isNull(focusSessions.endedAt),
        isNull(focusSessions.pausedAt),
        gt(focusSessions.startedAt, new Date(nowMs() - 12 * 3600_000)),
        or(eq(users.id, viewerId), sql`coalesce((${users.privacy}->>'hideStudyingNow')::boolean, false) = false`),
      ),
    );
  return r?.n ?? 0;
}

/* ---------- Ranking semanal ---------- */

export async function getRanking(viewerId: string) {
  const db = getDb();
  const today = dayOf();
  const ws = weekStart(today);
  const [members, focus, xp, attempts] = await Promise.all([
    getMembers(),
    db
      .select({
        userId: focusSessions.userId,
        min: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number),
        done: sql<number>`coalesce(sum(${focusSessions.questionsDone}), 0)`.mapWith(Number),
        correct: sql<number>`coalesce(sum(${focusSessions.questionsCorrect}), 0)`.mapWith(Number),
      })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), gte(focusSessions.day, ws)))
      .groupBy(focusSessions.userId),
    db
      .select({ userId: xpEvents.userId, xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`.mapWith(Number) })
      .from(xpEvents)
      .where(gte(xpEvents.day, ws))
      .groupBy(xpEvents.userId),
    db
      .select({
        userId: questionAttempts.userId,
        done: sql<number>`count(*)`.mapWith(Number),
        correct: sql<number>`count(*) filter (where ${questionAttempts.correct})`.mapWith(Number),
      })
      .from(questionAttempts)
      .where(gte(questionAttempts.at, dayStartUtc(ws)))
      .groupBy(questionAttempts.userId),
  ]);
  const f = new Map(focus.map((r) => [r.userId, r]));
  const x = new Map(xp.map((r) => [r.userId, r.xp]));
  const a = new Map(attempts.map((r) => [r.userId, r]));
  const rows = members.map((m) => {
    const me = m.id === viewerId;
    const done = (f.get(m.id)?.done ?? 0) + (a.get(m.id)?.done ?? 0);
    const correct = (f.get(m.id)?.correct ?? 0) + (a.get(m.id)?.correct ?? 0);
    return {
      userId: m.id,
      hours: !me && m.privacy.hideHours ? null : Math.round(((f.get(m.id)?.min ?? 0) / 60) * 10) / 10,
      xp: x.get(m.id) ?? 0,
      questions: done,
      accuracy: done > 0 && (me || !m.privacy.hideAccuracy) ? Math.round((correct / done) * 100) : null,
      hiddenForOthers: me ? { hours: !!m.privacy.hideHours, accuracy: !!m.privacy.hideAccuracy } : undefined,
    };
  });
  return { weekStart: ws, weekEnd: addDays(ws, 6), rows };
}

export type RankingData = Awaited<ReturnType<typeof getRanking>>;

/* ---------- Missões ---------- */

/** Números por pessoa e dia, no intervalo (agregados no SQL). */
async function dailyStats(from: string, to: string): Promise<DailyStat[]> {
  const db = getDb();
  const [focus, attempts] = await Promise.all([
    db
      .select({
        userId: focusSessions.userId,
        day: focusSessions.day,
        minutes: sql<number>`coalesce(sum(${focusSessions.durationMin}), 0)`.mapWith(Number),
        questions: sql<number>`coalesce(sum(${focusSessions.questionsDone}), 0)`.mapWith(Number),
        sessions: sql<number>`count(*)`.mapWith(Number),
      })
      .from(focusSessions)
      .where(and(isNotNull(focusSessions.endedAt), gte(focusSessions.day, from), lte(focusSessions.day, to)))
      .groupBy(focusSessions.userId, focusSessions.day),
    db
      .select({ userId: questionAttempts.userId, day: spDay(questionAttempts.at), n: sql<number>`count(*)`.mapWith(Number) })
      .from(questionAttempts)
      .where(and(gte(questionAttempts.at, dayStartUtc(from)), sql`${questionAttempts.at} < ${dayStartUtc(addDays(to, 1))}`))
      .groupBy(questionAttempts.userId, spDay(questionAttempts.at)),
  ]);
  const out: DailyStat[] = focus.filter((r) => r.day).map((r) => ({ userId: r.userId, day: r.day!, minutes: r.minutes, questions: r.questions, sessions: r.sessions }));
  for (const r of attempts) {
    const e = out.find((o) => o.userId === r.userId && o.day === r.day);
    if (e) e.questions += r.n;
    else out.push({ userId: r.userId, day: r.day, minutes: 0, questions: r.n, sessions: 0 });
  }
  return out;
}

/** Garante a missão automática da semana quando não há nenhuma ativa (id fixo: nunca duplica). */
export async function ensureWeeklyMission(today = dayOf()) {
  const db = getDb();
  const [active, members] = await Promise.all([
    db.select({ id: missions.id }).from(missions).where(and(lte(missions.startDay, today), gte(missions.endDay, today))).limit(1),
    getMembers(),
  ]);
  if (active.length) return;
  const ws = weekStart(today);
  const s = suggestWeeklyMission(ws, members.length);
  await db.insert(missions).values({ id: weeklyMissionId(ws), ...s }).onConflictDoNothing();
}

async function missionsWithProgress(where: ReturnType<typeof and>) {
  const db = getDb();
  const [list, members] = await Promise.all([db.select().from(missions).where(where).orderBy(desc(missions.endDay), desc(missions.createdAt)), getMembers()]);
  if (!list.length) return [];
  const from = list.reduce((a, m) => (m.startDay < a ? m.startDay : a), list[0].startDay);
  const to = list.reduce((a, m) => (m.endDay > a ? m.endDay : a), list[0].endDay);
  const stats = await dailyStats(from, to);
  const everyone = members.map((m) => m.id);
  return list.map((m) => ({ ...m, metric: m.metric as MissionMetric, progress: missionProgress({ ...m, metric: m.metric as MissionMetric }, stats, everyone) }));
}

export async function getMissions(viewerId: string) {
  const today = dayOf();
  const [list, members] = await Promise.all([missionsWithProgress(and(gte(missions.endDay, addDays(today, -28)))), getMembers()]);
  const priv = new Map(members.map((m) => [m.id, m.privacy]));
  return list.map((m) => ({
    id: m.id,
    title: m.title,
    metric: m.metric,
    target: m.target,
    startDay: m.startDay,
    endDay: m.endDay,
    xp: m.xp,
    auto: m.createdBy === null,
    mine: m.createdBy === viewerId,
    status: missionStatus(m, today),
    duo: m.memberIds.length > 0,
    total: m.progress.total,
    pct: m.progress.pct,
    done: m.progress.done,
    contributions: m.progress.contributions.map((c) => ({
      userId: c.userId,
      // horas escondidas: conta no total, mas não aparece o valor de cada um
      value: m.metric === "hours" && c.userId !== viewerId && priv.get(c.userId)?.hideHours ? null : c.value,
    })),
  }));
}

export type MissionView = Awaited<ReturnType<typeof getMissions>>[number];

/** Dá o XP das missões completadas (preguiçoso: roda quando alguém abre /grupos). Dedupe mission:<id>:<user>. */
export async function settleMissions(today = dayOf()) {
  const list = await missionsWithProgress(and(lte(missions.startDay, today), gte(missions.endDay, addDays(today, -14))));
  const done = list.filter((m) => m.progress.done);
  if (!done.length) return;
  const members = await getMembers();
  const everyone = members.map((m) => m.id);
  const keys = done.flatMap((m) => missionMembers(m, everyone).map((u) => ({ m, u, key: `mission:${m.id}:${u}` })));
  const paid = await getDb()
    .select({ dedupe: xpEvents.dedupe })
    .from(xpEvents)
    .where(and(like(xpEvents.dedupe, "mission:%"), inArray(xpEvents.dedupe, keys.map((k) => k.key))));
  const already = new Set(paid.map((p) => p.dedupe));
  await Promise.all(
    keys
      .filter((k) => !already.has(k.key))
      .map(async ({ m, u, key }) => {
        const got = await award(u, today, m.xp, `Missão: ${m.title}`, key);
        if (got > 0)
          await notify(u, {
            kind: "mission",
            title: "🎯 Missão cumprida!",
            body: `${m.title} · +${got} XP para você`,
            url: "/grupos?tab=missoes",
            dedupe: `mission:${m.id}`,
          });
      }),
  );
}
