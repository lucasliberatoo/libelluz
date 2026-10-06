import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { TEMPLATE_TREE } from "@/lib/template-tree";

const { studyNodes } = schema;
type NodeInsert = typeof studyNodes.$inferInsert;

const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

async function insertMany(rows: NodeInsert[]) {
  const db = getDb();
  for (let i = 0; i < rows.length; i += 200) await db.insert(studyNodes).values(rows.slice(i, i + 200));
}

/** Copia a árvore-modelo (com fases, relevância e habilidades) para a pessoa, só se ela ainda não tiver nenhuma. */
export async function seedTree(userId: string) {
  const db = getDb();
  const existing = await db.query.studyNodes.findFirst({ where: (n, { eq }) => eq(n.userId, userId) });
  if (existing) return;
  const rows: NodeInsert[] = [];
  TEMPLATE_TREE.forEach((a, ai) => {
    const areaId = crypto.randomUUID();
    rows.push({ id: areaId, userId, parentId: null, level: "area", area: a.area, name: a.area, position: ai });
    a.subjects.forEach((s, si) => {
      const subjId = crypto.randomUUID();
      rows.push({ id: subjId, userId, parentId: areaId, level: "subject", area: a.area, name: s.name, position: si });
      s.topics.forEach((t, ti) => {
        const topicId = crypto.randomUUID();
        rows.push({ id: topicId, userId, parentId: subjId, level: "topic", area: a.area, name: t.name, position: ti, phase: t.phase, relevance: t.relevance });
        t.skills.forEach((k, ki) =>
          rows.push({ userId, parentId: topicId, level: "skill", area: a.area, name: k.name, position: ki, phase: k.phase, relevance: k.relevance }),
        );
      });
    });
  });
  await insertMany(rows);
}

/**
 * Backfill para árvores criadas antes das fases/habilidades. Idempotente: casa área → disciplina → tópico
 * pelo nome, preenche fase/relevância só onde estão vazias, cria habilidades (e tópicos novos do modelo)
 * que faltam e nunca apaga nem renomeia nada. Áreas e disciplinas apagadas pela pessoa não voltam.
 * Retorna quantos nós foram criados ou atualizados.
 */
export async function enrichTree(userId: string) {
  const db = getDb();
  const nodes = await db.query.studyNodes.findMany({ where: eq(studyNodes.userId, userId) });
  if (!nodes.length) return 0;

  const children = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const k = n.parentId ?? "";
    if (!children.has(k)) children.set(k, []);
    children.get(k)!.push(n);
  }
  const kids = (parentId: string | null) => children.get(parentId ?? "") ?? [];
  const find = (parentId: string | null, level: string, name: string) =>
    kids(parentId).find((n) => n.level === level && norm(n.name) === norm(name));
  const nextPos = (parentId: string) => kids(parentId).reduce((m, n) => Math.max(m, n.position), -1) + 1;

  const inserts: NodeInsert[] = [];
  const setPhase = new Map<string, string[]>();
  const setRelevance = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, v: string, id: string) => (m.get(v) ?? m.set(v, []).get(v)!).push(id);

  for (const a of TEMPLATE_TREE) {
    const area = find(null, "area", a.area);
    if (!area) continue;
    for (const s of a.subjects) {
      const subj = find(area.id, "subject", s.name);
      if (!subj) continue;
      let topicPos = nextPos(subj.id);
      for (const t of s.topics) {
        const topic = find(subj.id, "topic", t.name);
        if (!topic) {
          const id = crypto.randomUUID();
          inserts.push({ id, userId, parentId: subj.id, level: "topic", area: area.area, name: t.name, position: topicPos++, phase: t.phase, relevance: t.relevance });
          t.skills.forEach((k, ki) =>
            inserts.push({ userId, parentId: id, level: "skill", area: area.area, name: k.name, position: ki, phase: k.phase, relevance: k.relevance }),
          );
          continue;
        }
        if (!topic.phase) push(setPhase, t.phase, topic.id);
        if (!topic.relevance) push(setRelevance, t.relevance, topic.id);
        let skillPos = nextPos(topic.id);
        // habilidades novas herdam as marcas que a pessoa já tinha dado ao tópico inteiro
        const flags = { theory: topic.theory, practice: topic.practice, mastery: topic.mastery };
        for (const k of t.skills) {
          const skill = find(topic.id, "skill", k.name);
          if (!skill) {
            inserts.push({ userId, parentId: topic.id, level: "skill", area: area.area, name: k.name, position: skillPos++, phase: k.phase, relevance: k.relevance, ...flags });
            continue;
          }
          if (!skill.phase) push(setPhase, k.phase, skill.id);
          if (!skill.relevance) push(setRelevance, k.relevance, skill.id);
        }
      }
    }
  }

  await insertMany(inserts);
  let updated = 0;
  for (const [phase, ids] of setPhase) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await db.update(studyNodes).set({ phase }).where(and(eq(studyNodes.userId, userId), inArray(studyNodes.id, chunk), isNull(studyNodes.phase)));
      updated += chunk.length;
    }
  }
  for (const [relevance, ids] of setRelevance) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await db
        .update(studyNodes)
        .set({ relevance })
        .where(and(eq(studyNodes.userId, userId), inArray(studyNodes.id, chunk), isNull(studyNodes.relevance)));
      updated += chunk.length;
    }
  }
  return inserts.length + updated;
}

/**
 * Chamada barata nas páginas da árvore: só roda o backfill quando nenhum nó da pessoa tem fase
 * (árvore anterior às fases). Depois da primeira vez, é uma consulta de uma linha.
 */
export async function ensureTreeEnriched(userId: string) {
  const db = getDb();
  const [withPhase] = await db
    .select({ id: studyNodes.id })
    .from(studyNodes)
    .where(and(eq(studyNodes.userId, userId), isNotNull(studyNodes.phase)))
    .limit(1);
  if (withPhase) return 0;
  return enrichTree(userId);
}
