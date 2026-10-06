import { auth } from "@/auth";
import { ScheduleBoard } from "@/components/cronograma/schedule-board";
import { dayOf, weekStart } from "@/lib/day";
import { getSchedulePage } from "@/server/schedule";

export default async function CronogramaPage({ searchParams }: PageProps<"/cronograma">) {
  const userId = (await auth())!.user!.id!;
  const sp = await searchParams;
  const w = Array.isArray(sp.w) ? sp.w[0] : sp.w;
  const ws = weekStart(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : dayOf());
  const data = await getSchedulePage(userId, ws);
  return <ScheduleBoard key={ws} data={data} />;
}
