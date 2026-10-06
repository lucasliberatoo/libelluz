import type { Metadata } from "next";
import { after } from "next/server";
import { auth } from "@/auth";
import { Feed } from "@/components/grupos/feed";
import { GroupsScreen } from "@/components/grupos/groups-screen";
import { Missions } from "@/components/grupos/missions";
import { Ranking } from "@/components/grupos/ranking";
import { StudyingNow } from "@/components/grupos/studying-now";
import { GROUP_TABS, type GroupTab } from "@/components/grupos/tabs";
import { dayOf, nowMs, weekStart } from "@/lib/day";
import {
  countStudyingNow,
  ensureWeeklyMission,
  getFeedPage,
  getMembers,
  getMissions,
  getRanking,
  getStudyingNow,
  publicMember,
  settleMissions,
} from "@/server/groups";

export const metadata: Metadata = { title: "Grupo · Libelluz" };

export default async function GruposPage({ searchParams }: PageProps<"/grupos">) {
  const userId = (await auth())!.user!.id!;
  const { tab: raw } = await searchParams;
  const tab: GroupTab = GROUP_TABS.some((t) => t.k === raw) ? (raw as GroupTab) : "feed";
  const today = dayOf();

  // Missões: a da semana aparece sozinha; o XP das completadas é dado depois da resposta.
  if (tab === "missoes") await ensureWeeklyMission(today);
  after(async () => {
    if (tab !== "missoes") await ensureWeeklyMission(today);
    await settleMissions(today);
  });

  const [members, studyingCount, content] = await Promise.all([
    getMembers(),
    countStudyingNow(userId),
    (async () => {
      switch (tab) {
        case "agora":
          return <StudyingNow data={await getStudyingNow(userId)} />;
        case "ranking":
          return <Ranking data={await getRanking(userId)} />;
        case "missoes":
          return <Missions list={await getMissions(userId)} today={today} weekStart={weekStart(today)} />;
        default: {
          const page = await getFeedPage(userId);
          const first = page.items[0];
          // nova publicação muda o primeiro item: o feed recomeça do topo
          return <Feed key={first ? `${first.kind}/${first.id}` : "vazio"} initial={page} />;
        }
      }
    })(),
  ]);

  return (
    <GroupsScreen tab={tab} members={members.map(publicMember)} meId={userId} now={nowMs()} studyingCount={studyingCount}>
      {content}
    </GroupsScreen>
  );
}
