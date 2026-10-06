import { auth } from "@/auth";
import { Dashboard } from "@/components/dashboard/today";
import { getPetSummary } from "@/server/pet";
import { getDashboard } from "@/server/queries";

export default async function Home() {
  const userId = (await auth())!.user!.id!;
  const [data, pet] = await Promise.all([getDashboard(userId), getPetSummary(userId)]);
  return <Dashboard data={data} pet={pet} />;
}
