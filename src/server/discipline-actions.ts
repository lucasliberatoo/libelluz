"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { clampBase, clampMinutes } from "@/lib/tokens";
import { getTokenBudget, type DisciplineSettings } from "./discipline";

// Ações do Modo Disciplina: salvar as configurações e receber a fila de tokens gastos no celular.

const { disciplineSettings, tokenSpends } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const appSchema = z.object({
  pkg: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._]+$/, "Pacote inválido"),
  label: z.string().trim().min(1).max(60),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  apps: z.array(appSchema).max(40),
  baseTokens: z.number().int(),
  minutesPerToken: z.number().int(),
  blockNotifications: z.boolean(),
});

export type SaveResult = { ok: true; settings: DisciplineSettings } | { ok: false; error: string };

/** Salva os apps escolhidos e as regras dos tokens. */
export async function saveDisciplineSettings(input: unknown): Promise<SaveResult> {
  const userId = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  // Um app por pacote, mesmo se a lista vier repetida.
  const seen = new Set<string>();
  const apps = parsed.data.apps.filter((a) => (seen.has(a.pkg) ? false : seen.add(a.pkg)));
  const settings: DisciplineSettings = {
    enabled: parsed.data.enabled && apps.length > 0,
    apps,
    baseTokens: clampBase(parsed.data.baseTokens),
    minutesPerToken: clampMinutes(parsed.data.minutesPerToken),
    blockNotifications: parsed.data.blockNotifications,
  };

  await getDb()
    .insert(disciplineSettings)
    .values({ userId, ...settings, updatedAt: new Date() })
    .onConflictDoUpdate({ target: disciplineSettings.userId, set: { ...settings, updatedAt: new Date() } });

  revalidatePath("/disciplina");
  return { ok: true, settings };
}

const spendSchema = z.object({
  id: z.string().trim().min(1).max(64),
  pkg: z.string().trim().min(1).max(120),
  label: z.string().trim().max(60).default(""),
  day: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  at: z.number().int().nonnegative(),
  minutes: z.number().int().min(1).max(240),
});

const syncSchema = z.object({ spends: z.array(spendSchema).max(200) });

export type SyncResult = {
  /** Ids que o celular pode tirar da fila. */
  ackIds: string[];
  day: string;
  tokensLeft: number;
  total: number;
  minutesPerToken: number;
  baseTokens: number;
};

/**
 * Recebe os tokens gastos pelo plugin nativo e devolve a conta de hoje.
 * `id` vem do celular e é único por pessoa, então reenviar a fila não duplica nada.
 */
export async function syncDiscipline(input: unknown): Promise<SyncResult> {
  const userId = await requireUser();
  const parsed = syncSchema.safeParse(input);
  const spends = parsed.success ? parsed.data.spends : [];

  const db = getDb();
  if (spends.length) {
    await db
      .insert(tokenSpends)
      .values(
        spends.map((s) => ({
          userId,
          day: s.day,
          at: new Date(s.at || Date.now()),
          pkg: s.pkg,
          label: s.label || s.pkg,
          minutes: s.minutes,
          clientId: s.id,
        })),
      )
      .onConflictDoNothing({ target: [tokenSpends.userId, tokenSpends.clientId] });
  }

  const [{ day, budget }, settings] = await Promise.all([
    getTokenBudget(userId),
    db.query.disciplineSettings.findFirst({
      where: (t, { eq }) => eq(t.userId, userId),
      columns: { minutesPerToken: true, baseTokens: true },
    }),
  ]);

  if (spends.length) revalidatePath("/disciplina");

  return {
    ackIds: spends.map((s) => s.id),
    day: day || dayOf(),
    tokensLeft: budget.left,
    total: budget.total,
    baseTokens: budget.base,
    minutesPerToken: settings?.minutesPerToken ?? clampMinutes(10),
  };
}
