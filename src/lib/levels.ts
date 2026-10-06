// Proposta inicial (PROMPT §6) — ainda a validar com o Lucas.
export const LEVELS = [
  { level: 1, title: "Novato", xp: 0 },
  { level: 2, title: "Aprendiz", xp: 300 },
  { level: 3, title: "Iniciante", xp: 800 },
  { level: 4, title: "Explorador", xp: 1600 },
  { level: 5, title: "Estudante", xp: 2800 },
  { level: 6, title: "Dedicado", xp: 4500 },
  { level: 7, title: "Construtor", xp: 6800 },
  { level: 8, title: "Persistente", xp: 9800 },
  { level: 9, title: "Estrategista", xp: 13600 },
  { level: 10, title: "Atacante", xp: 18300 },
  { level: 11, title: "Veterano", xp: 24000 },
  { level: 12, title: "Especialista", xp: 31000 },
  { level: 13, title: "Mestre", xp: 39500 },
  { level: 14, title: "Elite", xp: 49500 },
  { level: 15, title: "Lenda 160+", xp: 61000 },
] as const;

export function levelFromXp(totalXp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (totalXp >= LEVELS[i].xp) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1];
  return {
    level: cur.level,
    title: cur.title,
    intoLevel: totalXp - cur.xp,
    levelSpan: next ? next.xp - cur.xp : 0,
    isMax: !next,
  };
}
