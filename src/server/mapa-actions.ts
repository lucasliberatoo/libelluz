"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { MAPA_XP } from "@/lib/mapa";
import { PHASES } from "@/lib/template-tree";
import { award } from "./xp";

const { studyNodes } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const flagSchema = z.enum(["theory", "practice", "mastery"]);
type Node = typeof studyNodes.$inferSelect;

export type MarkResult = { xp: number; messages: string[] };

/**
 * Depois de mudar marcas: mantém o tópico em sincronia com as habilidades (marcado quando todas estão)
 * e dá os bônus de Domínio (+20 por nó), tópico completo (+50) e fase completa (+500), sem repetir.
 */
async function afterChange(userId: string, topicIds: Set<string>, masteredIds: string[]): Promise<MarkResult> {
  const db = getDb();
  const day = dayOf();
  const all = await db.query.studyNodes.findMany({ where: eq(studyNodes.userId, userId) });
  const byId = new Map(all.map((n) => [n.id, n]));
  const kids = (id: string) => all.filter((n) => n.parentId === id && n.level === "skill");
  let xp = 0;
  const messages: string[] = [];

  for (const id of masteredIds) {
    const n = byId.get(id);
    if (n?.mastery) xp += await award(userId, day, MAPA_XP.mastery, `Domínio: ${n.name}`, `mapa:dominio:${id}`);
  }
  if (xp) messages.push(`+${xp} XP de Domínio`);

  for (const tid of topicIds) {
    const topic = byId.get(tid);
    if (!topic) continue;
    const skills = kids(tid);
    if (skills.length) {
      const sync = {
        theory: skills.every((s) => s.theory),
        practice: skills.every((s) => s.practice),
        mastery: skills.every((s) => s.mastery),
      };
      if (sync.theory !== topic.theory || sync.practice !== topic.practice || sync.mastery !== topic.mastery) {
        await db.update(studyNodes).set(sync).where(and(eq(studyNodes.id, tid), eq(studyNodes.userId, userId)));
        Object.assign(topic, sync);
      }
    }
    if (topic.mastery) {
      const got = await award(userId, day, MAPA_XP.topicDone, `Tópico dominado: ${topic.name}`, `mapa:topico:${tid}`);
      if (got) {
        xp += got;
        messages.push(`${topic.name} 100%! +${got} XP`);
      }
    }
  }

  // Fases: unidades = habilidades + tópicos sem habilidades.
  const topicsWithSkills = new Set(all.filter((n) => n.level === "skill" && n.parentId).map((n) => n.parentId!));
  const unitPhase = (n: Node) => n.phase ?? (n.parentId ? byId.get(n.parentId)?.phase : null) ?? null;
  const unitsList = all.filter((n) => n.level === "skill" || (n.level === "topic" && !topicsWithSkills.has(n.id)));
  const touched = new Set(
    [...masteredIds, ...[...topicIds].flatMap((t) => [t, ...kids(t).map((k) => k.id)])].map((id) => byId.get(id)).filter(Boolean).map((n) => unitPhase(n!)),
  );
  for (const phase of PHASES) {
    if (!touched.has(phase)) continue;
    const u = unitsList.filter((n) => unitPhase(n) === phase);
    if (u.length && u.every((n) => n.mastery)) {
      const got = await award(userId, day, MAPA_XP.phaseDone, `Fase concluída: ${phase}`, `mapa:fase:${phase}`);
      if (got) {
        xp += got;
        messages.push(`Fase ${phase} concluída! +${got} XP`);
      }
    }
  }
  return { xp, messages };
}

async function ownNode(userId: string, id: string) {
  const n = await getDb().query.studyNodes.findFirst({ where: and(eq(studyNodes.id, id), eq(studyNodes.userId, userId)) });
  if (!n) throw new Error("Item não encontrado");
  return n;
}

/** Marca/desmarca Teoria, Prática ou Domínio de uma habilidade (ou de um tópico sem habilidades). */
export async function setNodeFlag(nodeId: string, flag: "theory" | "practice" | "mastery", value: boolean): Promise<MarkResult> {
  const userId = await requireUser();
  const f = flagSchema.parse(flag);
  const v = z.boolean().parse(value);
  const node = await ownNode(userId, z.string().min(1).parse(nodeId));
  if (node.level !== "skill" && node.level !== "topic") throw new Error("Só habilidades e tópicos têm marcas");
  const db = getDb();
  if (node.level === "topic") {
    const hasSkills = await db.query.studyNodes.findFirst({ where: and(eq(studyNodes.parentId, node.id), eq(studyNodes.userId, userId)) });
    if (hasSkills) throw new Error("Marque nas habilidades do tópico");
  }
  await db.update(studyNodes).set({ [f]: v }).where(and(eq(studyNodes.id, node.id), eq(studyNodes.userId, userId)));
  const topicId = node.level === "skill" ? node.parentId! : node.id;
  const res = await afterChange(userId, new Set([topicId]), f === "mastery" && v ? [node.id] : []);
  revalidatePath("/mapa");
  return res;
}

/** Aplica uma sugestão: marca a etapa no tópico e em todas as suas habilidades (Domínio inclui Teoria e Prática). */
export async function markTopic(topicId: string, flag: "theory" | "practice" | "mastery"): Promise<MarkResult> {
  const userId = await requireUser();
  const f = flagSchema.parse(flag);
  const topic = await ownNode(userId, z.string().min(1).parse(topicId));
  if (topic.level !== "topic") throw new Error("Não é um tópico");
  const db = getDb();
  const skills = await db.query.studyNodes.findMany({ where: and(eq(studyNodes.parentId, topic.id), eq(studyNodes.userId, userId)) });
  const set = f === "mastery" ? { theory: true, practice: true, mastery: true } : { [f]: true };
  const ids = [topic.id, ...skills.map((s) => s.id)];
  const newlyMastered = f === "mastery" ? [topic, ...skills].filter((n) => !n.mastery && (n.id !== topic.id || !skills.length)).map((n) => n.id) : [];
  await db.update(studyNodes).set(set).where(and(eq(studyNodes.userId, userId), inArray(studyNodes.id, ids)));
  const res = await afterChange(userId, new Set([topic.id]), newlyMastered);
  revalidatePath("/mapa");
  return res;
}

const metaSchema = z.object({
  phase: z.enum(PHASES).nullable(),
  relevance: z.string().trim().max(80).nullable(),
});

/** Edita fase e relevância de um nó (tópico ou habilidade). */
export async function setNodeMeta(nodeId: string, meta: { phase: string | null; relevance: string | null }) {
  const userId = await requireUser();
  const m = metaSchema.parse(meta);
  await ownNode(userId, z.string().min(1).parse(nodeId));
  await getDb()
    .update(studyNodes)
    .set({ phase: m.phase, relevance: m.relevance || null })
    .where(and(eq(studyNodes.id, nodeId), eq(studyNodes.userId, userId)));
  revalidatePath("/aulas");
  revalidatePath("/mapa");
}
