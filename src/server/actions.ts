"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, consumeInvite, findUsableInvite, INVITE_COOKIE, isAdminEmail, signIn, signOut } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { computeStudyMode, sessionXp, XP } from "@/lib/game";
import { applyReviewAccuracy, syncFocusToSchedule } from "./schedule";
import { seedTree } from "./seed";
import { award } from "./xp";
import { getActiveFocus, getUser, minutesByDay, type ActiveFocus } from "./queries";

const { focusSessions, dailyTasks, habitLogs, users, invites, studyNodes } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

/* ---------- Auth ---------- */

const signupSchema = z.object({
  name: z.string().trim().min(2, "Seu nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
  invite: z.string().trim().toUpperCase().optional().default(""),
});

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const values = { name: raw.name ?? "", email: raw.email ?? "", invite: raw.invite ?? "" };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { name, email, password, invite } = parsed.data;
  const db = getDb();
  if (await db.query.users.findFirst({ where: eq(users.email, email) })) return { error: "Esse e-mail já tem conta. Entre por aqui.", values };
  const admin = isAdminEmail(email);
  if (!admin && !(invite && (await findUsableInvite(invite)))) return { error: "Código de convite inválido ou já usado.", values };
  const [u] = await db
    .insert(users)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 10) })
    .returning({ id: users.id });
  if (!admin) await consumeInvite(invite, u.id);
  await seedTree(u.id);
  await signIn("credentials", { email, password, redirectTo: "/" });
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/" });
  } catch (e) {
    if ((e as { type?: string })?.type === "CredentialsSignin")
      return { error: "E-mail ou senha incorretos.", values: { email: String(form.get("email") ?? "") } };
    throw e;
  }
}

export async function googleAction(form: FormData) {
  const invite = String(form.get("invite") ?? "").trim().toUpperCase();
  if (invite) (await cookies()).set(INVITE_COOKIE, invite, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  await signIn("google", { redirectTo: "/" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/entrar" });
}

/* ---------- Foco ---------- */

const focusSchema = z.object({
  area: z.string(),
  subject: z.string(),
  topic: z.string(),
  kind: z.string(),
  method: z.string(),
  minutes: z.number().int().min(1).max(600),
});

export async function startFocus(input: z.infer<typeof focusSchema>): Promise<ActiveFocus> {
  const userId = await requireUser();
  const c = focusSchema.parse(input);
  const db = getDb();
  // Só uma sessão aberta por vez: encerra qualquer outra esquecida.
  const open = await getActiveFocus(userId);
  if (open) await stopFocus(open.id);
  const now = new Date();
  const node = await db.query.studyNodes.findFirst({
    where: and(eq(studyNodes.userId, userId), eq(studyNodes.level, "topic"), eq(studyNodes.name, c.topic)),
  });
  const [s] = await db
    .insert(focusSessions)
    .values({
      userId,
      nodeId: node?.id,
      area: c.area,
      subject: c.subject,
      topic: c.topic,
      kind: c.kind,
      method: c.method,
      plannedMin: c.minutes,
      startedAt: now,
      day: dayOf(now),
    })
    .returning();
  return { ...c, id: s.id, startedAt: now.getTime(), pausedAt: null, pausedMs: 0 };
}

async function ownSession(userId: string, id: string) {
  const s = await getDb().query.focusSessions.findFirst({ where: and(eq(focusSessions.id, id), eq(focusSessions.userId, userId)) });
  if (!s) throw new Error("Sessão não encontrada");
  return s;
}

export async function pauseFocus(id: string) {
  const userId = await requireUser();
  const s = await ownSession(userId, id);
  if (s.pausedAt || s.endedAt) return;
  await getDb().update(focusSessions).set({ pausedAt: new Date() }).where(eq(focusSessions.id, id));
}

export async function resumeFocus(id: string) {
  const userId = await requireUser();
  const s = await ownSession(userId, id);
  if (!s.pausedAt || s.endedAt) return;
  await getDb()
    .update(focusSessions)
    .set({ pausedAt: null, pausedMs: s.pausedMs + (Date.now() - s.pausedAt.getTime()) })
    .where(eq(focusSessions.id, id));
}

export type FocusResult = { id: string; minutes: number; xp: number; area: string; subject: string; topic: string; kind: string };

/** Encerra a sessão, salva a duração (tempo pausado é descartado) e dá o XP do tempo. */
export async function stopFocus(id: string): Promise<FocusResult> {
  const userId = await requireUser();
  const s = await ownSession(userId, id);
  const db = getDb();
  const end = s.endedAt ?? new Date();
  const stopAt = s.pausedAt ?? end;
  const minutes = Math.max(0, (stopAt.getTime() - s.startedAt.getTime() - s.pausedMs) / 60000);
  const day = s.day ?? dayOf(s.startedAt);
  let xp = 0;
  if (!s.endedAt) {
    const closed = await db
      .update(focusSessions)
      .set({ endedAt: end, durationMin: Math.round(minutes * 10) / 10 })
      .where(and(eq(focusSessions.id, id), isNull(focusSessions.endedAt)))
      .returning({ id: focusSessions.id });
    // Cronograma: soma no bloco do dia com o mesmo tópico e cuida das revisões (só uma vez por sessão)
    if (closed.length) xp += await syncFocusToSchedule(userId, s, day, minutes);
  }
  const u = await getUser(userId);
  const mode = computeStudyMode(await minutesByDay(userId), dayOf(), u?.focusGoalMin ?? 180);
  xp += await award(
    userId,
    day,
    sessionXp({ minutes, area: s.area, advanced: mode === "Avançado" }),
    `Foco: ${s.topic}`,
    `focus:${id}`,
  );
  // Marcos de foco do dia
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${focusSessions.durationMin}),0)`.mapWith(Number) })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.day, day)));
  for (const m of XP.focusMilestones)
    if (total >= m.min) xp += await award(userId, day, m.xp, m.label, `focus${m.min}:${day}`);
  revalidatePath("/", "layout");
  return { id, minutes: Math.round(minutes), xp, area: s.area, subject: s.subject, topic: s.topic, kind: s.kind };
}

const resultSchema = z.object({
  done: z.number().int().min(0).max(1000).optional(),
  correct: z.number().int().min(0).max(1000).optional(),
  mood: z.number().int().min(0).max(4).optional(),
  notes: z.string().max(5000).optional(),
});

/** Questões feitas/acertos, humor e notas da sessão. Retorna o XP extra. */
export async function saveFocusResult(id: string, input: z.infer<typeof resultSchema>) {
  const userId = await requireUser();
  const r = resultSchema.parse(input);
  const s = await ownSession(userId, id);
  const done = r.done ?? 0;
  const correct = Math.min(done, r.correct ?? 0);
  const db = getDb();
  await db
    .update(focusSessions)
    .set({ questionsDone: done || null, questionsCorrect: done ? correct : null, mood: r.mood ?? null, notes: r.notes || null })
    .where(eq(focusSessions.id, id));
  const day = s.day ?? dayOf(s.startedAt);
  let xp = 0;
  if (done) {
    xp += await award(userId, day, sessionXp({ minutes: 0, area: s.area, done, correct }), `Questões: ${s.topic}`, `questions:${id}`);
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(${focusSessions.questionsDone}),0)`.mapWith(Number) })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), eq(focusSessions.day, day)));
    for (const m of XP.questionMilestones)
      if (total >= m.n) xp += await award(userId, day, m.xp, m.label, `q${m.n}:${day}`);
  }
  if (s.kind === "Revisão") await applyReviewAccuracy(userId, s, done, correct);
  revalidatePath("/", "layout");
  return xp;
}

/** Descarta uma sessão sem tempo útil (ex.: começou sem querer). */
export async function discardFocus(id: string) {
  const userId = await requireUser();
  await ownSession(userId, id);
  await getDb().delete(focusSessions).where(eq(focusSessions.id, id));
  revalidatePath("/", "layout");
}

/* ---------- Tarefas do dia ---------- */

export async function addTask(title: string, area?: string | null) {
  const userId = await requireUser();
  const t = title.trim().slice(0, 200);
  if (!t) return;
  await getDb().insert(dailyTasks).values({ userId, day: dayOf(), title: t, area: area || null });
  revalidatePath("/");
}

export async function toggleTask(id: string) {
  const userId = await requireUser();
  const db = getDb();
  const t = await db.query.dailyTasks.findFirst({ where: and(eq(dailyTasks.id, id), eq(dailyTasks.userId, userId)) });
  if (!t) return;
  await db.update(dailyTasks).set({ done: !t.done }).where(eq(dailyTasks.id, id));
  if (!t.done) {
    await award(userId, t.day, XP.taskDone, `Tarefa: ${t.title}`, `task:${id}`);
    const pending = await db.query.dailyTasks.findFirst({
      where: and(eq(dailyTasks.userId, userId), eq(dailyTasks.day, t.day), eq(dailyTasks.done, false)),
    });
    if (!pending) await award(userId, t.day, XP.allTasks, "Todas as tarefas do dia", `alltasks:${t.day}`);
  }
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const userId = await requireUser();
  await getDb().delete(dailyTasks).where(and(eq(dailyTasks.id, id), eq(dailyTasks.userId, userId)));
  revalidatePath("/");
}

/* ---------- Hábitos (aquecem o foguinho, não dão XP de estudo) ---------- */

const habitSchema = z.object({
  waterCups: z.number().int().min(0).max(30).optional(),
  mood: z.number().int().min(0).max(4).nullable().optional(),
  journal: z.string().max(10000).optional(),
  photo: z
    .string()
    .startsWith("data:image/")
    .max(1_500_000, "Foto grande demais")
    .nullable()
    .optional(),
  readingMin: z.number().int().min(0).max(1440).optional(),
  exercise: z.boolean().optional(),
});

export async function setHabit(input: z.infer<typeof habitSchema>) {
  const userId = await requireUser();
  const v = habitSchema.parse(input);
  await getDb()
    .insert(habitLogs)
    .values({ userId, day: dayOf(), ...v })
    .onConflictDoUpdate({ target: [habitLogs.userId, habitLogs.day], set: v });
  revalidatePath("/");
}

/* ---------- Perfil e metas ---------- */

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  petName: z.string().trim().min(1).max(30),
  enemDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  waterGoal: z.coerce.number().int().min(1).max(30),
  readingGoalMin: z.coerce.number().int().min(0).max(600),
  focusGoalMin: z.coerce.number().int().min(10).max(900),
  questionsGoal: z.coerce.number().int().min(0).max(1000),
  dailyXpGoal: z.coerce.number().int().min(10).max(10000),
  weeklyXpGoal: z.coerce.number().int().min(50).max(70000),
});

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUser();
  const p = profileSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Confira os campos: " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  await getDb()
    .update(users)
    .set({ ...p.data, enemDate: p.data.enemDate || null })
    .where(eq(users.id, userId));
  revalidatePath("/", "layout");
  return {};
}

export async function renamePet(name: string) {
  const userId = await requireUser();
  const n = name.trim().slice(0, 30);
  if (n) await getDb().update(users).set({ petName: n }).where(eq(users.id, userId));
  revalidatePath("/");
}

/* ---------- Convites (só admin) ---------- */

export async function createInvite() {
  const s = await auth();
  if (!s?.user?.id || !isAdminEmail(s.user.email)) throw new Error("Só o admin cria convites");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join("");
  await getDb().insert(invites).values({ code, createdBy: s.user.id });
  revalidatePath("/convites");
}

/* ---------- Árvore de estudos ---------- */

export async function addNode(parentId: string, name: string) {
  const userId = await requireUser();
  const n = name.trim().slice(0, 120);
  if (!n) return;
  const db = getDb();
  const parent = await db.query.studyNodes.findFirst({ where: and(eq(studyNodes.id, parentId), eq(studyNodes.userId, userId)) });
  if (!parent || parent.level === "skill") return;
  const level = parent.level === "area" ? "subject" : parent.level === "subject" ? "topic" : "skill";
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${studyNodes.position}), -1)`.mapWith(Number) })
    .from(studyNodes)
    .where(eq(studyNodes.parentId, parentId));
  await db.insert(studyNodes).values({ userId, parentId, level, area: parent.area, name: n, position: max + 1 });
  revalidatePath("/aulas");
}

export async function renameNode(id: string, name: string) {
  const userId = await requireUser();
  const n = name.trim().slice(0, 120);
  if (n) await getDb().update(studyNodes).set({ name: n }).where(and(eq(studyNodes.id, id), eq(studyNodes.userId, userId)));
  revalidatePath("/aulas");
}

export async function deleteNode(id: string) {
  const userId = await requireUser();
  const db = getDb();
  // apaga o nó e todos os descendentes
  const all = await db.query.studyNodes.findMany({ where: eq(studyNodes.userId, userId) });
  const kill = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of all)
      if (n.parentId && kill.has(n.parentId) && !kill.has(n.id)) {
        kill.add(n.id);
        grew = true;
      }
  }
  for (const k of kill) await db.delete(studyNodes).where(and(eq(studyNodes.id, k), eq(studyNodes.userId, userId)));
  revalidatePath("/aulas");
}

export async function resetTreeIfEmpty() {
  const userId = await requireUser();
  await seedTree(userId);
  revalidatePath("/aulas");
}
