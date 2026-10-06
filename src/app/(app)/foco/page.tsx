import { auth } from "@/auth";
import { FocusScreen, type FocusSuggestion, type FocusTree } from "@/components/focus/focus-screen";
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
  for (const t of dash.tasks.filter((t) => !t.done)) {
    const hit = findTopic(tree, t.title);
    if (hit) suggestions.push({ label: t.title, ...hit });
  }
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const topic = one(sp.topic);
  const preset = topic ? findTopic(tree, topic) : null;
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
