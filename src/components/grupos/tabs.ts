/** Abas do grupo. Módulo sem "use client": a página (servidor) e a barra (cliente) leem a mesma lista. */
export const GROUP_TABS = [
  { k: "feed", label: "Feed" },
  { k: "agora", label: "Estudando agora" },
  { k: "ranking", label: "Ranking" },
  { k: "missoes", label: "Missões" },
] as const;

export type GroupTab = (typeof GROUP_TABS)[number]["k"];

export const groupTabHref = (k: GroupTab) => (k === "feed" ? "/grupos" : `/grupos?tab=${k}`);
