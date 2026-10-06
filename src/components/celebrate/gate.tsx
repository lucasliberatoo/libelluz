"use client";

import dynamic from "next/dynamic";
import type { Celebrations } from "@/server/achievements";

// framer-motion e a animação só são baixados quando há algo para comemorar.
const CelebrateOverlay = dynamic(() => import("./overlay").then((m) => m.CelebrateOverlay), { ssr: false });

export function CelebrateGate({ data }: { data: Celebrations }) {
  // a chave muda quando chega algo novo, e o overlay reabre só para isso
  const key = `${data.level?.level ?? 0}|${data.achievements.map((a) => `${a.key}:${a.tier}`).join(",")}`;
  return <CelebrateOverlay key={key} data={data} />;
}
