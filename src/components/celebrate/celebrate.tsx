import { Suspense } from "react";
import { after } from "next/server";
import { evaluateAchievements, getCelebrations } from "@/server/achievements";
import { CelebrateGate } from "./gate";

/**
 * Comemoração de nível e conquistas, montada no layout (app).
 * A avaliação das conquistas roda depois da resposta (after) e no máximo 1 vez por minuto;
 * o que ela desbloquear aparece na próxima renderização do layout.
 */
export function Celebrate({ userId }: { userId: string }) {
  after(() => evaluateAchievements(userId).catch((e) => console.error("[conquistas]", e)));
  return (
    <Suspense fallback={null}>
      <Pending userId={userId} />
    </Suspense>
  );
}

async function Pending({ userId }: { userId: string }) {
  const data = await getCelebrations(userId).catch(() => null);
  if (!data || (!data.level && !data.achievements.length)) return null;
  return <CelebrateGate data={data} />;
}
