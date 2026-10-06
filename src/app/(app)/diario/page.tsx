import { auth } from "@/auth";
import { Journal } from "@/components/diario/journal";
import { dayOf } from "@/lib/day";
import { getJournal } from "@/server/queries";

export default async function DiarioPage() {
  const userId = (await auth())!.user!.id!;
  return <Journal entries={await getJournal(userId)} today={dayOf()} />;
}
