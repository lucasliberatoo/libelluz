import { auth } from "@/auth";
import { FocusScreen, type FocusSuggestion, type FocusTree } from "@/components/focus/focus-screen";
import type { StudyKind } from "@/components/focus/focus-provider";

// tipos aceitos em ?kind= (o Configure é client; a lista fica aqui para o servidor validar)
const KINDS: StudyKind[] = ["Teoria", "Questões", "Revisão", "Videoaula", "Flashcards", "Redação"];
import { getDashboard, getTree } from "@/server/queries";

export default async function FocoPage({ searchParams }: PageProps<"/foco">) {
  const userId = (await auth())!.user!.id!;
  const [roots, dash, sp] = await Promise.all([getTree(userId), getDashboard(userId), searchParams]);
  const tree: FocusTree = roots.map((a) => ({
    area: a.name,
    subjects: a.children.map((s) => ({ name: s.name, topics: s.children.map((t) => t.name) })),
  }));
  const suggestions: FocusSuggestion[] = [];
  if (dash.lastFocus) suggestions.push({ label: `▶ ${dash.lastFocus.topic}`, ...dash.lastFocus, kind: undefined });
  // cronograma de hoje e revisões do dia no topo
  for (const b of dash.blocks.filter((b) => !b.done)) {
    const hit = findTopic(tree, b.topic);
    if (hit) suggestions.unshift({ label: b.kind === "review" ? `↻ ${b.topic}` : b.topic, ...hit, kind: b.kind === "review" ? "Revisão" : undefined });
  }
  for (const r of dash.reviews) {
    const hit = findTopic(tree, r.topic);
    if (hit) suggestions.push({ label: `↻ ${r.topic}`, ...hit, kind: "Revisão" });
  }
  for (const t of dash.tasks.filter((t) => !t.done)) {
    const hit = findTopic(tree, t.title);
    if (hit) suggestions.push({ label: t.title, ...hit });
  }
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const topic = one(sp.topic);
  const hit = topic ? findTopic(tree, topic) : null;
  const kind = one(sp.kind);
  const min = Number(one(sp.min));
  const preset = hit
    ? {
        ...hit,
        kind: KINDS.includes(kind as StudyKind) ? (kind as StudyKind) : undefined,
        minutes: Number.isFinite(min) && min > 0 ? Math.min(240, Math.max(10, Math.round(min / 5) * 5)) : undefined,
      }
    : null;
  return <FocusScreen tree={tree} suggestions={dedupe(suggestions)} preset={preset} />;
}

function findTopic(tree: FocusTree, name: string) {
  const n = name.trim().toLowerCase();
  for (const a of tree)
    for (const s of a.subjects)
      for (const t of s.topics) if (t.toLowerCase() === n) return { area: a.area, subject: s.name, topic: t };
  return null;
}

function dedupe(l: FocusSuggestion[]) {
  const seen = new Set<string>();
  return l.filter((s) => (seen.has(s.topic) ? false : (seen.add(s.topic), true)));
}
