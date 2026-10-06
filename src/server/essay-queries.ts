import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { drawDue, pickTheme, type Rhythm } from "@/lib/essay";

const { users, essayThemes, essays } = schema;

export type ThemeRow = {
  id: string;
  title: string;
  axis: string;
  source: string | null;
  notes: string | null;
  status: "stock" | "drawn" | "accepted" | "done";
  passCount: number;
  essays: number;
};

export type EssayRow = {
  id: string;
  themeId: string | null;
  title: string;
  axis: string | null;
  day: string;
  score: number | null;
  competencies: number[] | null;
  errorTags: string[];
  comments: string | null;
  text: string | null;
  hasPhoto: boolean;
};

export type EssayPageData = {
  rhythm: Rhythm;
  essayDay: number;
  today: string;
  themes: ThemeRow[];
  essays: EssayRow[];
  current: ThemeRow | null;
  lastDraw: string | null;
};

const dayOfTs = (d: Date | null) => (d ? dayOf(d) : null);

/** Quantas redações (mais temas aceitos ainda não escritos) cada eixo já teve: base do sorteio. */
async function practiceByAxis(userId: string) {
  const db = getDb();
  const rows = await db
    .select({ axis: essayThemes.axis })
    .from(essayThemes)
    .where(and(eq(essayThemes.userId, userId), eq(essayThemes.status, "accepted")));
  const written = await db
    .select({ axis: essayThemes.axis })
    .from(essays)
    .innerJoin(essayThemes, eq(essays.themeId, essayThemes.id))
    .where(eq(essays.userId, userId));
  const m: Record<string, number> = {};
  for (const r of [...rows, ...written]) m[r.axis] = (m[r.axis] ?? 0) + 1;
  return m;
}

/** Sorteia um tema do estoque e o marca como "da vez". Retorna o id ou null se o estoque está vazio. */
export async function drawTheme(userId: string, exclude?: string | null): Promise<string | null> {
  const db = getDb();
  const stock = await db
    .select({ id: essayThemes.id, axis: essayThemes.axis })
    .from(essayThemes)
    .where(and(eq(essayThemes.userId, userId), eq(essayThemes.status, "stock")));
  const t = pickTheme(stock, await practiceByAxis(userId), Math.random, exclude);
  if (!t) return null;
  await db
    .update(essayThemes)
    .set({ status: "drawn", drawnAt: new Date() })
    .where(and(eq(essayThemes.id, t.id), eq(essayThemes.userId, userId)));
  return t.id;
}

export async function getEssayPage(userId: string): Promise<EssayPageData> {
  const db = getDb();
  const today = dayOf();
  const [u] = await db.select({ rhythm: users.essayRhythm, day: users.essayDay }).from(users).where(eq(users.id, userId));
  const rhythm: Rhythm = u?.rhythm === "fixo" ? "fixo" : "semana";
  const essayDay = u?.day ?? 6;

  const loadThemes = () =>
    db.select().from(essayThemes).where(eq(essayThemes.userId, userId)).orderBy(desc(essayThemes.createdAt));
  let themeRows = await loadThemes();

  const findCurrent = () =>
    themeRows
      .filter((t) => t.status === "drawn" || t.status === "accepted")
      .sort((a, b) => (b.drawnAt?.getTime() ?? 0) - (a.drawnAt?.getTime() ?? 0))[0];
  const lastDrawOf = () =>
    themeRows.reduce<string | null>((m, t) => {
      const d = dayOfTs(t.drawnAt);
      return d && (!m || d > m) ? d : m;
    }, null);

  // Sorteio automático: no dia fixo ou na segunda (tema da semana), se ainda não há tema da vez.
  if (!findCurrent() && drawDue(rhythm, essayDay, today, lastDrawOf())) {
    if (await drawTheme(userId)) themeRows = await loadThemes();
  }

  const essayRows = await db
    .select({
      id: essays.id,
      themeId: essays.themeId,
      title: essays.title,
      day: essays.day,
      score: essays.score,
      competencies: essays.competencies,
      errorTags: essays.errorTags,
      comments: essays.comments,
      text: essays.text,
      hasPhoto: sql<boolean>`${essays.photo} is not null`,
      createdAt: essays.createdAt,
    })
    .from(essays)
    .where(eq(essays.userId, userId))
    .orderBy(desc(essays.day), desc(essays.createdAt));

  const axisOf = new Map(themeRows.map((t) => [t.id, t.axis]));
  const countBy = new Map<string, number>();
  for (const e of essayRows) if (e.themeId) countBy.set(e.themeId, (countBy.get(e.themeId) ?? 0) + 1);

  const themes: ThemeRow[] = themeRows.map((t) => ({
    id: t.id,
    title: t.title,
    axis: t.axis,
    source: t.source,
    notes: t.notes,
    status: t.status,
    passCount: t.passCount,
    essays: countBy.get(t.id) ?? 0,
  }));
  const cur = findCurrent();
  return {
    rhythm,
    essayDay,
    today,
    themes,
    current: cur ? themes.find((t) => t.id === cur.id)! : null,
    lastDraw: lastDrawOf(),
    essays: essayRows.map((e) => ({
      id: e.id,
      themeId: e.themeId,
      title: e.title,
      axis: e.themeId ? (axisOf.get(e.themeId) ?? null) : null,
      day: e.day,
      score: e.score,
      competencies: e.competencies,
      errorTags: e.errorTags,
      comments: e.comments,
      text: e.text,
      hasPhoto: Boolean(e.hasPhoto),
    })),
  };
}
