import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { materials, studyNodes } = schema;

export async function getMaterials(userId: string) {
  return getDb()
    .select({
      id: materials.id,
      title: materials.title,
      kind: materials.kind,
      section: materials.section,
      area: materials.area,
      subject: materials.subject,
      nodeId: materials.nodeId,
      topic: studyNodes.name,
      url: materials.url,
      isFile: sql<boolean>`${materials.storageKey} is not null`,
      size: materials.size,
      mime: materials.mime,
      createdAt: materials.createdAt,
    })
    .from(materials)
    .leftJoin(studyNodes, eq(studyNodes.id, materials.nodeId))
    .where(eq(materials.userId, userId))
    .orderBy(desc(materials.createdAt));
}

export type MaterialItem = Awaited<ReturnType<typeof getMaterials>>[number];

/** Bytes guardados no R2 pela pessoa. */
export async function storageUsed(userId: string) {
  const [{ used }] = await getDb()
    .select({ used: sql<number>`coalesce(sum(${materials.size}) filter (where ${materials.storageKey} is not null), 0)`.mapWith(Number) })
    .from(materials)
    .where(eq(materials.userId, userId));
  return used;
}
