import { auth } from "@/auth";
import { SimuladosScreen } from "@/components/simulados/simulados";
import { dayOf } from "@/lib/day";
import { getExamsPage } from "@/server/exam-queries";

export default async function SimuladosPage() {
  const userId = (await auth())!.user!.id!;
  return <SimuladosScreen data={await getExamsPage(userId)} today={dayOf()} />;
}
