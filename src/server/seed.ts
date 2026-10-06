import "server-only";
import { getDb, schema } from "@/db";
import { TEMPLATE_TREE } from "@/lib/template-tree";

/** Copia a árvore-modelo para a pessoa (só se ela ainda não tiver nenhuma). */
export async function seedTree(userId: string) {
  const db = getDb();
  const existing = await db.query.studyNodes.findFirst({ where: (n, { eq }) => eq(n.userId, userId) });
  if (existing) return;
  const rows: (typeof schema.studyNodes.$inferInsert)[] = [];
  TEMPLATE_TREE.forEach((a, ai) => {
    const areaId = crypto.randomUUID();
    rows.push({ id: areaId, userId, parentId: null, level: "area", area: a.area, name: a.area, position: ai });
    a.subjects.forEach((s, si) => {
      const subjId = crypto.randomUUID();
      rows.push({ id: subjId, userId, parentId: areaId, level: "subject", area: a.area, name: s.name, position: si });
      s.topics.forEach((t, ti) =>
        rows.push({ id: crypto.randomUUID(), userId, parentId: subjId, level: "topic", area: a.area, name: t, position: ti }),
      );
    });
  });
  for (let i = 0; i < rows.length; i += 200) await db.insert(schema.studyNodes).values(rows.slice(i, i + 200));
}
