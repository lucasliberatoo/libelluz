import { auth, isAdminEmail } from "@/auth";
import { QuestionBank } from "@/components/questoes/question-bank";
import { areaOptions } from "@/lib/area-tree";
import { getTree } from "@/server/queries";
import { getQuestionList, getQuestionStats } from "@/server/questoes";

export default async function QuestoesPage() {
  const session = (await auth())!;
  const userId = session.user!.id!;
  const [items, stats, tree] = await Promise.all([getQuestionList(userId), getQuestionStats(userId), getTree(userId)]);
  return <QuestionBank items={items} stats={stats} tree={areaOptions(tree)} admin={isAdminEmail(session.user?.email)} />;
}
