import Link from "next/link";
import { auth, isAdminEmail } from "@/auth";
import { logoutAction } from "@/server/actions";
import { ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/questoes", label: "Questões", emoji: "📝" },
  { href: "/simulados", label: "Simulados e ENEMs", emoji: "🎯" },
  { href: "/redacoes", label: "Redações", emoji: "✍️" },
  { href: "/cronograma", label: "Cronograma", emoji: "🗓️" },
  { href: "/mapa", label: "Mapa", emoji: "🗺️" },
  { href: "/estatisticas", label: "Estatísticas", emoji: "📊" },
  { href: "/conquistas", label: "Conquistas", emoji: "🏆" },
  { href: "/diario", label: "Diário e humor", emoji: "📔" },
  { href: "/foco/notas", label: "Notas do foco", emoji: "📌" },
  { href: "/perfil", label: "Perfil", emoji: "🙂" },
  { href: "/config", label: "Configurações", emoji: "⚙️" },
  { href: "/disciplina", label: "Modo Disciplina", emoji: "🔒" },
  { href: "/baixar", label: "Baixar o app", emoji: "📲" },
];

export default async function MaisPage() {
  const admin = isAdminEmail((await auth())?.user?.email);
  const items = admin ? [...ITEMS, { href: "/convites", label: "Convites", emoji: "🎟️" }] : ITEMS;
  return (
    <section className="card-soft divide-y overflow-hidden">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted">
          <span className="text-xl">{i.emoji}</span>
          <span className="flex-1 font-medium">{i.label}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
      <form action={logoutAction}>
        <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted">
          <span className="text-xl">👋</span>
          <span className="flex-1 font-medium">Sair</span>
        </button>
      </form>
    </section>
  );
}
