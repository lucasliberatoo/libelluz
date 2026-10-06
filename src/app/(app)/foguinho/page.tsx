import { auth } from "@/auth";
import { PetScreen } from "@/components/pet/pet-screen";
import { getDashboard } from "@/server/queries";

export default async function FoguinhoPage() {
  const d = await getDashboard((await auth())!.user!.id!);
  const h = d.habit;
  const tasks = [
    { icon: "emoji/cronometro.webp", label: "Estudar (qualquer sessão de foco)", done: d.streak.studiedToday },
    { icon: "emoji/check.webp", label: "Concluir as tarefas do dia", done: d.tasks.length > 0 && d.tasks.every((t) => t.done) },
    { icon: "emoji/agua.webp", label: `Beber ${d.user.waterGoal} copos de água`, done: h.water >= d.user.waterGoal },
    { icon: "livros.png", label: `Ler ${d.user.readingGoalMin} min`, done: h.readingMin >= d.user.readingGoalMin },
    { icon: "emoji/humor.webp", label: "Registrar o humor do dia", done: h.mood !== null },
    { icon: "emoji/exercicio.webp", label: "Fazer exercício físico", done: h.exercise },
  ];
  return <PetScreen name={d.user.petName} streak={d.streak.streak} studiedToday={d.streak.studiedToday} tasks={tasks} />;
}
