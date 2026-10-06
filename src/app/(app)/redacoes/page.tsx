import { auth } from "@/auth";
import { RedacoesScreen } from "@/components/redacoes/redacoes";
import { getEssayPage } from "@/server/essay-queries";

export default async function RedacoesPage() {
  const userId = (await auth())!.user!.id!;
  return <RedacoesScreen data={await getEssayPage(userId)} />;
}
