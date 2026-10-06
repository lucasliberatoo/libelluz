import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { BarChart3, ChevronRight, Download, LogOut, NotebookPen, Settings, Sparkles } from "lucide-react";
import { auth, isAdminEmail } from "@/auth";
import { getDb, schema } from "@/db";
import { Foguinho, Icon3D } from "@/components/brand";
import { AvatarEditor } from "@/components/perfil/avatar-editor";
import { InviteShare } from "@/components/convites/invite-share";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { createInvite, logoutAction } from "@/server/actions";
import { getProfile } from "@/server/profile-queries";

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function PerfilPage() {
  const s = (await auth())!;
  const admin = isAdminEmail(s.user?.email);
  const [p, invite] = await Promise.all([
    getProfile(s.user!.id!),
    admin
      ? getDb().query.invites.findFirst({ where: isNull(schema.invites.usedBy), orderBy: desc(schema.invites.createdAt) })
      : null,
  ]);
  const lv = p.level;
  const pct = lv.isMax ? 100 : Math.round((lv.intoLevel / lv.levelSpan) * 100);

  const tiles = [
    { icon: "emoji/cronometro.webp", label: "Horas de foco", value: p.hours.toLocaleString("pt-BR"), sub: `${p.sessions} sessões` },
    { icon: "calendario.png", label: "Dias estudados", value: p.studiedDays, sub: `desde ${fmtDate(p.user.since)}` },
    { icon: "fogo.png", label: "Sequência", value: `${p.streak} dias`, sub: `recorde: ${p.bestStreak}` },
    { icon: "emoji/alvo.webp", label: "Questões", value: p.questions.toLocaleString("pt-BR"), sub: p.accuracy == null ? "sem acertos registrados" : `${p.accuracy}% de acerto` },
    { icon: "emoji/trofeu.webp", label: "Melhor simulado", value: p.examBest ? `${p.examBest}/180` : "—", sub: `${p.examsFull} provas completas` },
    { icon: "livros.png", label: "Redações", value: p.essays, sub: p.essays ? `média ${p.essayAvg}` : "nenhuma ainda" },
    { icon: "emoji/estrela.webp", label: "Habilidades dominadas", value: p.mastered, sub: "no Mapa" },
    { icon: "emoji/revisao.webp", label: "Revisões feitas", value: p.reviewsDone, sub: "1 → 7 → 30 dias" },
  ];

  const links = [
    { href: "/estatisticas", label: "Estatísticas completas", icon: BarChart3 },
    { href: "/config", label: "Metas e dados do perfil", icon: Settings },
    { href: "/diario", label: "Diário e humor", icon: NotebookPen },
    { href: "/foco/notas", label: "Notas do foco", icon: Sparkles },
    { href: "/baixar", label: "Baixar o app", icon: Download },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="card-soft overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary to-sky-400" />
        <div className="-mt-14 flex flex-col items-center gap-4 px-5 pb-5 md:flex-row md:items-end md:text-left">
          <AvatarEditor name={p.user.name} image={p.user.image} hasPhoto={p.user.hasPhoto} />
          <div className="flex-1 text-center md:pb-6 md:text-left">
            <h1 className="text-2xl font-extrabold leading-tight">{p.user.name || "Você"}</h1>
            <p className="text-sm text-muted-foreground">{p.user.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs md:justify-start">
              <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">
                Nível {lv.level} · {lv.title}
              </span>
              {p.user.enemDays != null && p.user.enemDays >= 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  🎯 faltam {p.user.enemDays} dias pro ENEM
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="border-t px-5 py-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold">{p.totalXp.toLocaleString("pt-BR")} XP</span>
            <span className="text-muted-foreground">
              {lv.isMax ? "nível máximo!" : `${(lv.levelSpan - lv.intoLevel).toLocaleString("pt-BR")} XP para o nível ${lv.level + 1}`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card-soft p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon3D name={t.icon} size={20} /> {t.label}
            </div>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{t.value}</p>
            <p className="truncate text-xs text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/foguinho" className="card-soft flex items-center gap-4 p-4 transition hover:bg-muted/50">
          <Foguinho stage={1} className="size-16" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Seu foguinho</p>
            <p className="text-lg font-bold">{p.user.petName}</p>
            <p className="text-xs text-muted-foreground">Cuide dele com água, leitura e estudo</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>

        {admin ? (
          <section className="card-soft space-y-3 p-4">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-bold">Convidar amigos</h2>
              <Link href="/convites" className="text-xs font-semibold text-primary">
                Ver todos
              </Link>
            </div>
            {invite ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Convite disponível: <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold tracking-widest text-foreground">{invite.code}</code>
                </p>
                <InviteShare code={invite.code} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum convite livre agora.</p>
            )}
            <form action={createInvite}>
              <button className="text-xs font-semibold text-primary underline">Gerar novo convite</button>
            </form>
          </section>
        ) : (
          <section className="card-soft p-4">
            <h2 className="font-bold">Chamar amigos</h2>
            <p className="mt-1 text-sm text-muted-foreground">O Libelluz é só para convidados. Peça um convite ao Lucas e mande pelo WhatsApp.</p>
          </section>
        )}
      </div>

      <section className="card-soft divide-y overflow-hidden">
        {links.map(({ href, label, icon: I }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted">
            <I className="size-5 text-primary" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-muted-foreground hover:bg-muted">
            <LogOut className="size-5" />
            <span className="flex-1 font-medium">Sair</span>
          </button>
        </form>
      </section>

      <details className="card-soft group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
          Níveis e títulos
          <ChevronRight className="size-4 text-muted-foreground transition group-open:rotate-90" />
        </summary>
        <ol className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <li
              key={l.level}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                l.level === lv.level ? "bg-primary text-white" : l.level < lv.level ? "bg-muted" : "bg-muted/40 text-muted-foreground",
              )}
            >
              <span>
                {l.level}. {l.title}
              </span>
              <span className="tabular-nums text-xs opacity-80">{l.xp.toLocaleString("pt-BR")} XP</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
