/** Versão enxuta da árvore (Área → Disciplina → Tópico) para seletores nos formulários. */

export type AreaOption = { area: string; subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] };

type Node = { id: string; name: string; level: string; children: Node[] };

export function areaOptions(tree: Node[]): AreaOption[] {
  return tree
    .filter((a) => a.level === "area")
    .map((a) => ({
      area: a.name,
      subjects: a.children.map((s) => ({ id: s.id, name: s.name, topics: s.children.map((t) => ({ id: t.id, name: t.name })) })),
    }));
}

export const AREAS = ["Linguagens", "Humanas", "Natureza", "Matemática", "Redação"];

export const AREA_DOT: Record<string, string> = {
  Natureza: "bg-emerald-500",
  Matemática: "bg-blue-500",
  Linguagens: "bg-amber-500",
  Humanas: "bg-rose-500",
  Redação: "bg-violet-500",
};
