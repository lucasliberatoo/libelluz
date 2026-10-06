import { auth } from "@/auth";
import { DisciplinaPanel } from "@/components/disciplina/panel";
import { getDiscipline } from "@/server/discipline";

export const metadata = { title: "Modo Disciplina" };

export default async function DisciplinaPage() {
  const userId = (await auth())!.user!.id!;
  const data = await getDiscipline(userId);
  return <DisciplinaPanel initial={data} />;
}
