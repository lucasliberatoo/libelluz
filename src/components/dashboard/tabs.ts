// Abas do Início: rótulo ↔ ?aba= na URL.
export const DASH_TABS = ["Hoje", "Semana", "Jornada", "Ranking & Conquistas"] as const;
export type DashTab = (typeof DASH_TABS)[number];

const SLUG: Record<DashTab, string> = { Hoje: "", Semana: "semana", Jornada: "jornada", "Ranking & Conquistas": "ranking" };

export const tabHref = (t: DashTab) => (SLUG[t] ? `/?aba=${SLUG[t]}` : "/");

export function tabFromParam(p: string | string[] | undefined): DashTab {
  const v = Array.isArray(p) ? p[0] : p;
  return DASH_TABS.find((t) => SLUG[t] && SLUG[t] === v) ?? "Hoje";
}
