import Link from "next/link";
import { auth, isAdminEmail } from "@/auth";
import { Foguinho, Icon3D } from "@/components/brand";
import { LEVELS, levelFromXp } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/queries";
import { logoutAction } from "@/server/actions";

export default async function PerfilPage() {
  const s = (await auth())!;
  const d = await getDashboard(s.user!.id!);
  const lv = levelFromXp(d.totalXp);
  return (
    <div className="space-y-4">
      <section className="card-soft flex flex-col items-center gap-2 p-6 text-center">
        <Foguinho stage={0} className="size-24" />
        <h1 className="text-xl font-bold">{d.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Nível {lv.level} · {lv.title} · {d.totalXp.toLocaleString("pt-BR")} XP
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <span className="flex items-center gap-1"><Icon3D name="fogo.png" size={18} /> {d.streak.streak} dias</span>
          <span className="flex items-center gap-1"><Icon3D name="calendario.png" size={18} /> {d.studiedDays} estudados</span>
          <span className="flex items-center gap-1"><Icon3D name="gauge.png" size={18} /> {d.studyMode}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/config" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white">Metas e perfil</Link>
          {isAdminEmail(s.user?.email) && (
            <Link href="/convites" className="rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary">Convites</Link>
          )}
          <form action={logoutAction}>
            <button className="rounded-full px-4 py-1.5 text-sm text-muted-foreground ring-1 ring-border">Sair</button>
          </form>
        </div>
      </section>
      <section className="card-soft p-4">
        <h2 className="mb-3 font-bold">Níveis</h2>
        <ol className="grid gap-1.5 sm:grid-cols-3">
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
      </section>
    </div>
  );
}
