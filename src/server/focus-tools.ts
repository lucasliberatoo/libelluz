"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { HEAT } from "@/lib/heat";

// Atalhos da tela de Foco: água, notas, insights, áudios e checklist da sessão.

const { focusNotes, focusSessions, habitLogs, heatEvents, users } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

export type FocusNote = {
  id: string;
  kind: "note" | "insight" | "audio" | "check";
  text: string | null;
  audio: string | null;
  done: boolean;
  createdAt: number;
};

const toNote = (n: typeof focusNotes.$inferSelect): FocusNote => ({
  id: n.id,
  kind: n.kind,
  text: n.text,
  audio: n.audio,
  done: n.done,
  createdAt: n.createdAt.getTime(),
});

/** +1 copo de água no dia. Devolve copos e meta. */
export async function addWaterCup() {
  const userId = await requireUser();
  const db = getDb();
  const [row] = await db
    .insert(habitLogs)
    .values({ userId, day: dayOf(), waterCups: 1 })
    .onConflictDoUpdate({
      target: [habitLogs.userId, habitLogs.day],
      set: { waterCups: sql`least(${habitLogs.waterCups} + 1, 30)` },
    })
    .returning({ cups: habitLogs.waterCups });
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { waterGoal: true } });
  revalidatePath("/");
  return { cups: row.cups, goal: u?.waterGoal ?? 8 };
}

/** Calor do foguinho pela pausa de respirar ou alongar (+2, uma vez por dia cada). Devolve o calor dado. */
export async function addWellnessHeat(kind: "breath" | "stretch") {
  const userId = await requireUser();
  const k = z.enum(["breath", "stretch"]).parse(kind);
  const day = dayOf();
  const res = await getDb()
    .insert(heatEvents)
    .values({ userId, day, amount: HEAT[k], reason: k, dedupe: `${k}:${day}` })
    .onConflictDoNothing()
    .returning({ id: heatEvents.id });
  return res.length ? HEAT[k] : 0;
}

async function ownSession(userId: string, sessionId: string) {
  const s = await getDb().query.focusSessions.findFirst({
    where: and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)),
    columns: { id: true },
  });
  if (!s) throw new Error("Sessão não encontrada");
}

export async function listFocusNotes(sessionId: string): Promise<FocusNote[]> {
  const userId = await requireUser();
  const rows = await getDb().query.focusNotes.findMany({
    where: and(eq(focusNotes.sessionId, sessionId), eq(focusNotes.userId, userId)),
    orderBy: [asc(focusNotes.createdAt)],
  });
  return rows.map(toNote);
}

const noteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["note", "insight", "check"]), text: z.string().trim().min(1).max(5000) }),
  z.object({
    kind: z.literal("audio"),
    text: z.string().max(200).optional(),
    // ~3 min de opus a 32 kbps cabem com folga
    audio: z.string().startsWith("data:audio/").max(1_800_000, "Áudio longo demais (máx. ~3 min)"),
  }),
]);

export async function addFocusNote(sessionId: string, input: z.infer<typeof noteSchema>): Promise<FocusNote> {
  const userId = await requireUser();
  const v = noteSchema.parse(input);
  await ownSession(userId, sessionId);
  const [n] = await getDb()
    .insert(focusNotes)
    .values({ userId, sessionId, kind: v.kind, text: v.text ?? null, audio: v.kind === "audio" ? v.audio : null })
    .returning();
  return toNote(n);
}

export async function toggleFocusCheck(id: string) {
  const userId = await requireUser();
  await getDb()
    .update(focusNotes)
    .set({ done: sql`not ${focusNotes.done}` })
    .where(and(eq(focusNotes.id, id), eq(focusNotes.userId, userId)));
}

export async function deleteFocusNote(id: string) {
  const userId = await requireUser();
  await getDb().delete(focusNotes).where(and(eq(focusNotes.id, id), eq(focusNotes.userId, userId)));
}

/** Todas as notas, insights e áudios, agrupados por sessão (mais recentes primeiro). */
export async function allFocusNotes() {
  const userId = await requireUser();
  const db = getDb();
  const rows = await db
    .select({
      note: { id: focusNotes.id, kind: focusNotes.kind, text: focusNotes.text, done: focusNotes.done, createdAt: focusNotes.createdAt },
      s: { id: focusSessions.id, subject: focusSessions.subject, topic: focusSessions.topic, kind: focusSessions.kind, day: focusSessions.day },
    })
    .from(focusNotes)
    .innerJoin(focusSessions, eq(focusNotes.sessionId, focusSessions.id))
    .where(eq(focusNotes.userId, userId))
    .orderBy(desc(focusSessions.startedAt), asc(focusNotes.createdAt))
    .limit(500);
  const groups: { session: (typeof rows)[number]["s"]; notes: FocusNote[] }[] = [];
  for (const r of rows) {
    let g = groups.at(-1);
    if (!g || g.session.id !== r.s.id) groups.push((g = { session: r.s, notes: [] }));
    // o áudio não vem junto (é pesado): o player busca em /api/foco/audio/[id] só quando tocar
    g.notes.push({ ...r.note, audio: r.note.kind === "audio" ? `/api/foco/audio/${r.note.id}` : null, createdAt: r.note.createdAt.getTime() });
  }
  return groups;
}
