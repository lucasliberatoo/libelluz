import type { Metadata } from "next";
import { auth } from "@/auth";
import { StatsScreen } from "@/components/estatisticas/stats-screen";
import { parsePeriod } from "@/components/estatisticas/lib";
import { getStats } from "@/server/stats-queries";

export const metadata: Metadata = { title: "Estatísticas · Libelluz" };

export default async function EstatisticasPage({ searchParams }: PageProps<"/estatisticas">) {
  const userId = (await auth())!.user!.id!;
  const { p } = await searchParams;
  return <StatsScreen data={await getStats(userId, parsePeriod(p))} />;
}
