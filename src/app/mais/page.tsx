import Link from "next/link";
import { ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/questoes", label: "Questões e Simulados", emoji: "📝" },
  { href: "/redacoes", label: "Redações", emoji: "✍️" },
  { href: "/cronograma", label: "Cronograma", emoji: "🗓️" },
  { href: "/mapa", label: "Mapa", emoji: "🗺️" },
  { href: "/perfil", label: "Perfil", emoji: "🙂" },
  { href: "/config", label: "Configurações", emoji: "⚙️" },
];

export default function MaisPage() {
  return (
    <section className="card-soft divide-y overflow-hidden">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted">
          <span className="text-xl">{i.emoji}</span>
          <span className="flex-1 font-medium">{i.label}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </section>
  );
}
