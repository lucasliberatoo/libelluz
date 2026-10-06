import { auth } from "@/auth";
import { StudyTree } from "@/components/aulas/study-tree";
import { getTopicMinutes, getTree } from "@/server/queries";
import { ensureTreeEnriched } from "@/server/seed";

export default async function AulasPage() {
  const userId = (await auth())!.user!.id!;
  await ensureTreeEnriched(userId);
  const [tree, minutes] = await Promise.all([getTree(userId), getTopicMinutes(userId)]);
  return <StudyTree tree={tree} minutes={minutes} />;
}
