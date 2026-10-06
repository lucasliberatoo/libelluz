import { auth } from "@/auth";
import { Dashboard } from "@/components/dashboard/today";
import { getDashboard } from "@/server/queries";

export default async function Home() {
  const userId = (await auth())!.user!.id!;
  return <Dashboard data={await getDashboard(userId)} />;
}
