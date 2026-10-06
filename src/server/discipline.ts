import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayOf } from "@/lib/day";
import { TOKENS, tokenBudget, type TokenBudget } from "@/lib/tokens";

// Leituras do Modo Disciplina. A conta dos tokens vive em `src/lib/tokens.ts`; aqui só juntamos
// as configurações, o XP do dia e o log de gastos — tudo agregado no SQL e em paralelo.

const { disciplineSettings, tokenSpends, xpEvents } = schema;

export type DisciplineApp = { pkg: string; label: string };

export type DisciplineSettings = {
  enabled: boolean;
  apps: DisciplineApp[];
  baseTokens: number;
  minutesPerToken: number;
  blockNotifications: boolean;
};

export type DisciplineSpend = { id: string; label: string; pkg: string; at: number; minutes: number };

export type Discipline = {
  day: string;
  settings: DisciplineSettings;
  xpToday: number;
  budget: TokenBudget;
  /** Gastos de hoje, do mais recente para o mais antigo. */
  today: DisciplineSpend[];
  /** Últimos 7 dias: quantos tokens por dia (só dias com gasto). */
  week: { day: string; spent: number; minutes: number }[];
};

export const DEFAULT_SETTINGS: DisciplineSettings = {
  enabled: false,
  apps: [],
  baseTokens: TOKENS.base,
  minutesPerToken: TOKENS.minutes,
  blockNotifications: true,
};

/** Configurações + conta dos tokens de hoje + log. */
export async function getDiscipline(userId: string): Promise<Discipline> {
  const db = getDb();
  const day = dayOf();
  const weekFrom = addDays(day, -6);

  const [row, xpRow, todayRows, weekRows] = await Promise.all([
    db.query.disciplineSettings.findFirst({ where: eq(disciplineSettings.userId, userId) }),
    db
      .select({ xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), eq(xpEvents.day, day))),
    db
      .select({
        id: tokenSpends.id,
        pkg: tokenSpends.pkg,
        label: tokenSpends.label,
        at: tokenSpends.at,
        minutes: tokenSpends.minutes,
      })
      .from(tokenSpends)
      .where(and(eq(tokenSpends.userId, userId), eq(tokenSpends.day, day)))
      .orderBy(desc(tokenSpends.at))
      .limit(50),
    db
      .select({
        day: tokenSpends.day,
        spent: sql<number>`count(*)::int`,
        minutes: sql<number>`coalesce(sum(${tokenSpends.minutes}), 0)::int`,
      })
      .from(tokenSpends)
      .where(and(eq(tokenSpends.userId, userId), gte(tokenSpends.day, weekFrom)))
      .groupBy(tokenSpends.day)
      .orderBy(desc(tokenSpends.day)),
  ]);

  const settings: DisciplineSettings = row
    ? {
        enabled: row.enabled,
        apps: row.apps ?? [],
        baseTokens: row.baseTokens,
        minutesPerToken: row.minutesPerToken,
        blockNotifications: row.blockNotifications,
      }
    : DEFAULT_SETTINGS;

  const xpToday = xpRow[0]?.xp ?? 0;
  const spentToday = weekRows.find((w) => w.day === day)?.spent ?? 0;

  return {
    day,
    settings,
    xpToday,
    budget: tokenBudget({ baseTokens: settings.baseTokens, xpToday, spent: spentToday }),
    today: todayRows.map((s) => ({ id: s.id, pkg: s.pkg, label: s.label, at: s.at.getTime(), minutes: s.minutes })),
    week: weekRows,
  };
}

/** Só a conta dos tokens — usada pelo celular a cada sincronização. */
export async function getTokenBudget(userId: string): Promise<{ day: string; budget: TokenBudget }> {
  const db = getDb();
  const day = dayOf();
  const [settingsRow, xpRow, spentRow] = await Promise.all([
    db.query.disciplineSettings.findFirst({
      where: eq(disciplineSettings.userId, userId),
      columns: { baseTokens: true },
    }),
    db
      .select({ xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), eq(xpEvents.day, day))),
    db
      .select({ spent: sql<number>`count(*)::int` })
      .from(tokenSpends)
      .where(and(eq(tokenSpends.userId, userId), eq(tokenSpends.day, day))),
  ]);
  return {
    day,
    budget: tokenBudget({
      baseTokens: settingsRow?.baseTokens ?? TOKENS.base,
      xpToday: xpRow[0]?.xp ?? 0,
      spent: spentRow[0]?.spent ?? 0,
    }),
  };
}
