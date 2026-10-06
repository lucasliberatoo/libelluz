"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { MISSION_XP } from "@/lib/missions";
import { feedTargetOwner, getFeedPage, getMembers, REACTIONS, type FeedPage } from "./groups";
import { notify } from "./notify";
import { firstName } from "./queries";

const { feedPosts, feedReactions, feedComments, pokes, missions, users, focusSessions } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return { id: s.user.id, name: firstName(s.user.name) };
}

const meName = async (id: string, fallback: string) =>
  firstName((await getDb().query.users.findFirst({ where: eq(users.id, id), columns: { name: true } }))?.name) || fallback;

const target = z.object({ kind: z.enum(["session", "post", "achievement"]), id: z.string().min(1).max(200) });
type Target = z.infer<typeof target>;

const WHAT: Record<Target["kind"], string> = { session: "sua sessão de foco", post: "seu post", achievement: "sua conquista" };

/** Próxima página do feed. */
export async function loadFeed(cursor: string | null): Promise<FeedPage> {
  const me = await requireUser();
  return getFeedPage(me.id, z.string().max(200).nullable().parse(cursor));
}

/** Liga/desliga uma reação. Avisa o dono quando é de outra pessoa. */
export async function toggleReaction(t: Target, emoji: string) {
  const me = await requireUser();
  const { kind, id } = target.parse(t);
  if (!(REACTIONS as readonly string[]).includes(emoji)) throw new Error("Reação inválida");
  const owner = await feedTargetOwner(me.id, kind, id);
  if (!owner) throw new Error("Item não encontrado");
  const db = getDb();
  const removed = await db
    .delete(feedReactions)
    .where(and(eq(feedReactions.userId, me.id), eq(feedReactions.targetKind, kind), eq(feedReactions.targetId, id), eq(feedReactions.emoji, emoji)))
    .returning({ emoji: feedReactions.emoji });
  if (removed.length) return { on: false };
  await db.insert(feedReactions).values({ userId: me.id, targetKind: kind, targetId: id, emoji }).onConflictDoNothing();
  if (owner !== me.id) {
    const who = await meName(me.id, me.name);
    await notify(owner, {
      kind: "reaction",
      title: `${emoji} ${who} reagiu`,
      body: `${who} reagiu com ${emoji} ${WHAT[kind]}.`,
      url: "/grupos",
      dedupe: `reaction:${kind}:${id}:${me.id}:${emoji}`,
    });
  }
  return { on: true };
}

export type FeedComment = { id: string; userId: string; text: string; at: number; mine: boolean };

export async function getComments(t: Target): Promise<FeedComment[]> {
  const me = await requireUser();
  const { kind, id } = target.parse(t);
  if (!(await feedTargetOwner(me.id, kind, id))) return [];
  const rows = await getDb()
    .select({ id: feedComments.id, userId: feedComments.userId, text: feedComments.text, at: feedComments.createdAt })
    .from(feedComments)
    .where(and(eq(feedComments.targetKind, kind), eq(feedComments.targetId, id)))
    .orderBy(asc(feedComments.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, at: r.at.getTime(), mine: r.userId === me.id }));
}

export async function addComment(t: Target, text: string) {
  const me = await requireUser();
  const { kind, id } = target.parse(t);
  const body = z.string().trim().min(1, "Escreva algo").max(1000, "Comentário longo demais").parse(text);
  const owner = await feedTargetOwner(me.id, kind, id);
  if (!owner) throw new Error("Item não encontrado");
  const [row] = await getDb().insert(feedComments).values({ userId: me.id, targetKind: kind, targetId: id, text: body }).returning();
  if (owner !== me.id) {
    const who = await meName(me.id, me.name);
    await notify(owner, {
      kind: "comment",
      title: `💬 ${who} comentou`,
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
      url: "/grupos",
      dedupe: `comment:${row.id}`,
    });
  }
  return getComments({ kind, id });
}

export async function deleteComment(commentId: string) {
  const me = await requireUser();
  await getDb()
    .delete(feedComments)
    .where(and(eq(feedComments.id, z.string().max(64).parse(commentId)), eq(feedComments.userId, me.id)));
}

const postSchema = z
  .object({
    text: z.string().trim().max(2000, "Texto longo demais").transform((v) => v || null),
    photo: z
      .string()
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Foto inválida")
      .max(1_500_000, "Foto grande demais")
      .nullable(),
  })
  .refine((p) => p.text || p.photo, { message: "Escreva algo ou escolha uma foto" });

export async function createPost(input: { text: string; photo: string | null }) {
  const me = await requireUser();
  const p = postSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  await getDb().insert(feedPosts).values({ userId: me.id, text: p.data.text, photo: p.data.photo });
  revalidatePath("/grupos");
  return { ok: true };
}

export async function deletePost(postId: string) {
  const me = await requireUser();
  const id = z.string().max(64).parse(postId);
  const db = getDb();
  const del = await db.delete(feedPosts).where(and(eq(feedPosts.id, id), eq(feedPosts.userId, me.id))).returning({ id: feedPosts.id });
  if (del.length)
    await Promise.all([
      db.delete(feedReactions).where(and(eq(feedReactions.targetKind, "post"), eq(feedReactions.targetId, id))),
      db.delete(feedComments).where(and(eq(feedComments.targetKind, "post"), eq(feedComments.targetId, id))),
    ]);
  revalidatePath("/grupos");
}

/** Cutucar quem ainda não estudou hoje: no máximo 1 vez por pessoa por dia. */
export async function poke(toId: string) {
  const me = await requireUser();
  const to = z.string().min(1).max(64).parse(toId);
  if (to === me.id) return { error: "Não dá para se cutucar 😅" };
  const day = dayOf();
  const db = getDb();
  const [target, studied] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, to), columns: { id: true, name: true } }),
    db.query.focusSessions.findFirst({ where: and(eq(focusSessions.userId, to), eq(focusSessions.day, day)), columns: { endedAt: true, durationMin: true } }),
  ]);
  if (!target) return { error: "Pessoa não encontrada" };
  if (studied?.endedAt && (studied.durationMin ?? 0) > 0) return { error: `${firstName(target.name)} já estudou hoje` };
  const [row] = await db.insert(pokes).values({ fromId: me.id, toId: to, day }).onConflictDoNothing().returning({ id: pokes.id });
  if (!row) return { error: `Você já cutucou ${firstName(target.name)} hoje` };
  const who = await meName(me.id, me.name);
  await notify(to, {
    kind: "poke",
    title: `👉 ${who} te cutucou`,
    body: "Bora estudar? O foguinho tá esfriando…",
    url: "/foco",
    dedupe: `poke:${me.id}:${day}`,
  });
  revalidatePath("/grupos");
  return { ok: true };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const missionSchema = z
  .object({
    title: z.string().trim().min(3, "Dê um nome à missão").max(80),
    metric: z.enum(["hours", "questions", "sessions", "days"]),
    target: z.coerce.number().positive("O alvo precisa ser maior que zero").max(10000),
    startDay: day,
    endDay: day,
    memberIds: z.array(z.string().max(64)).max(20),
    xp: z.coerce.number().int().min(MISSION_XP.min).max(MISSION_XP.max),
  })
  .refine((m) => m.endDay >= m.startDay, { message: "O fim precisa ser depois do início" })
  .refine((m) => m.memberIds.length !== 1, { message: "Escolha pelo menos 2 pessoas (ou o grupo todo)" });

export type MissionInput = z.input<typeof missionSchema>;

export async function createMission(input: MissionInput) {
  const me = await requireUser();
  const p = missionSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const everyone = new Set((await getMembers()).map((m) => m.id));
  const memberIds = [...new Set(p.data.memberIds)].filter((id) => everyone.has(id));
  // dupla com o grupo inteiro = missão do grupo
  await getDb()
    .insert(missions)
    .values({ ...p.data, memberIds: memberIds.length >= everyone.size ? [] : memberIds, createdBy: me.id });
  revalidatePath("/grupos");
  return { ok: true };
}

export async function deleteMission(missionId: string) {
  const me = await requireUser();
  await getDb()
    .delete(missions)
    .where(and(eq(missions.id, z.string().max(64).parse(missionId)), eq(missions.createdBy, me.id)));
  revalidatePath("/grupos");
}

const privacySchema = z.object({
  hideAccuracy: z.boolean(),
  hideHours: z.boolean(),
  hideFeed: z.boolean(),
  hideStudyingNow: z.boolean(),
});

export async function savePrivacy(input: z.input<typeof privacySchema>) {
  const me = await requireUser();
  const privacy = privacySchema.parse(input);
  await getDb().update(users).set({ privacy }).where(eq(users.id, me.id));
  revalidatePath("/grupos");
  revalidatePath("/config");
  return { ok: true };
}
