import { Suspense } from "react";
import { auth } from "@/auth";
import { Dashboard } from "@/components/dashboard/today";
import { getPetSummary } from "@/server/pet";
import { JourneyTab } from "@/components/dashboard/journey-tab";
import { RankingTab } from "@/components/dashboard/ranking-tab";
import { TabSkeleton } from "@/components/dashboard/tab-skeleton";
import { tabFromParam } from "@/components/dashboard/tabs";
import { WeekTab } from "@/components/dashboard/week-tab";
import { getDashboard } from "@/server/queries";

export default async function Home({ searchParams }: PageProps<"/">) {
  const userId = (await auth())!.user!.id!;
  const tab = tabFromParam((await searchParams).aba);
  const [data, pet] = await Promise.all([getDashboard(userId), getPetSummary(userId)]);
  // "Hoje" vem sempre; as outras abas só são consultadas quando a pessoa abre (?aba=),
  // com skeleton enquanto o servidor responde.
  return (
    <Dashboard
      data={data}
      pet={pet}
      tab={tab}
      panel={
        tab === "Hoje" ? null : (
          <Suspense fallback={<TabSkeleton />}>
            {tab === "Semana" ? <WeekTab userId={userId} /> : tab === "Jornada" ? <JourneyTab userId={userId} /> : <RankingTab userId={userId} />}
          </Suspense>
        )
      }
    />
  );
}
