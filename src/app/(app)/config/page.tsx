import { auth } from "@/auth";
import { PrivacyForm } from "@/components/grupos/privacy-form";
import { ProfileForm } from "@/components/perfil/profile-form";
import { getUser } from "@/server/queries";

export default async function ConfigPage() {
  const u = (await getUser((await auth())!.user!.id!))!;
  return (<>
    <ProfileForm
      initial={{
        name: u.name ?? "",
        petName: u.petName,
        enemDate: u.enemDate ?? "",
        waterGoal: u.waterGoal,
        readingGoalMin: u.readingGoalMin,
        focusGoalMin: u.focusGoalMin,
        questionsGoal: u.questionsGoal,
        dailyXpGoal: u.dailyXpGoal,
        weeklyXpGoal: u.weeklyXpGoal,
      }}
    />
    <PrivacyForm initial={u.privacy} /></>
  );
}
