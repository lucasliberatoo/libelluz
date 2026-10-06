import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dayOf } from "@/lib/day";
import { computeAlerts, computeSuggestions, phaseProgress, type MapSession, type MapSkill, type MapTopic } from "@/lib/mapa";

const { studyNodes, focusSessions } = schema;

export type MapSubject = { id: string; name: string; area: string };

/** Árvore achatada em tópicos com estatísticas de foco, alertas, sugestões e progresso por fase. */
export async function getMapa(userId: string) {
  const db = getDb();
  const today = dayOf();
  const [nodes, sessions] = await Promise.all([
    db.query.studyNodes.findMany({ where: eq(studyNodes.userId, userId), orderBy: [asc(studyNodes.position), asc(studyNodes.name)] }),
    db
      .select({
        nodeId: focusSessions.nodeId,
        subject: focusSessions.subject,
        topic: focusSessions.topic,
        kind: focusSessions.kind,
        day: focusSessions.day,
        min: focusSessions.durationMin,
        done: focusSessions.questionsDone,
        correct: focusSessions.questionsCorrect,
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNotNull(focusSessions.endedAt))),
  ]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const areas = nodes.filter((n) => n.level === "area");
  const areaOrder = new Map(areas.map((a, i) => [a.id, i]));
  const subjects: MapSubject[] = nodes
    .filter((n) => n.level === "subject" && n.parentId && byId.has(n.parentId))
    .sort((a, b) => (areaOrder.get(a.parentId!) ?? 0) - (areaOrder.get(b.parentId!) ?? 0))
    .map((n) => ({ id: n.id, name: n.name, area: byId.get(n.parentId!)!.name }));

  const skillsOf = new Map<string, MapSkill[]>();
  for (const n of nodes)
    if (n.level === "skill" && n.parentId)
      (skillsOf.get(n.parentId) ?? skillsOf.set(n.parentId, []).get(n.parentId)!).push({
        id: n.id,
        name: n.name,
        phase: n.phase,
        relevance: n.relevance,
        theory: n.theory,
        practice: n.practice,
        mastery: n.mastery,
      });

  const topics: MapTopic[] = [];
  const byKey = new Map<string, MapTopic>();
  for (const s of subjects)
    for (const n of nodes)
      if (n.level === "topic" && n.parentId === s.id) {
        const t: MapTopic = {
          id: n.id,
          name: n.name,
          phase: n.phase,
          relevance: n.relevance,
          theory: n.theory,
          practice: n.practice,
          mastery: n.mastery,
          subjectId: s.id,
          subject: s.name,
          area: s.area,
          skills: skillsOf.get(n.id) ?? [],
          minutes: 0,
          questions: 0,
          correct: 0,
          lastDay: null,
        };
        topics.push(t);
        byKey.set(`${s.name}/${n.name}`.toLocaleLowerCase("pt-BR"), t);
      }
  const topicById = new Map(topics.map((t) => [t.id, t]));

  const mapSessions: MapSession[] = [];
  for (const s of sessions) {
    let t = s.nodeId ? topicById.get(s.nodeId) : undefined;
    if (!t && s.nodeId) {
      const n = byId.get(s.nodeId);
      if (n?.level === "skill" && n.parentId) t = topicById.get(n.parentId);
    }
    t ??= byKey.get(`${s.subject}/${s.topic}`.toLocaleLowerCase("pt-BR"));
    if (!t || !s.day) continue;
    const done = Math.max(0, s.done ?? 0);
    const correct = Math.min(done, Math.max(0, s.correct ?? 0));
    t.minutes += s.min ?? 0;
    t.questions += done;
    t.correct += correct;
    if (!t.lastDay || s.day > t.lastDay) t.lastDay = s.day;
    mapSessions.push({ topicId: t.id, day: s.day, kind: s.kind, minutes: s.min ?? 0, done, correct });
  }
  for (const t of topics) t.minutes = Math.round(t.minutes);

  return {
    today,
    subjects,
    topics,
    phases: phaseProgress(topics),
    alerts: computeAlerts(topics, mapSessions, today),
    suggestions: computeSuggestions(topics, mapSessions),
  };
}

export type MapaData = Awaited<ReturnType<typeof getMapa>>;
