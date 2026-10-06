import Link from "next/link";
import { Icon3D } from "@/components/brand";
import { AchIcon } from "@/components/celebrate/ach-icon";
import { getRankingTab } from "@/server/dashboard-tabs";
import { RankingBoard } from "./ranking-board";

const ago = (ms: number, now: number) => {
  const m = Math.round((now - ms) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};

export async function RankingTab({ userId }: { userId: string }) {
  const d = await getRankingTab(userId);
  const now = d.now;
  return (
    <div className="grid gap-3 md:grid-cols-12 md:gap-4">
      <RankingBoard rows={d.rows} weekLabel={d.weekStart.split("-").reverse().slice(0, 2).join("/")} />
      <div className="grid content-start gap-3 md:col-span-5 md:gap-4">
        <Link href="/conquistas" className="card-inner group flex items-center gap-3 p-4 transition hover:ring-2 hover:ring-primary/30">
          <Icon3D name="emoji/trofeu.webp" size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Suas conquistas</p>
            <p className="text-xl font-extrabold tabular-nums">
              {d.unlocked}
              <span className="text-sm font-semibold text-muted-foreground">/{d.total}</span>
              <span className="ml-2 text-sm text-amber-500">★ {d.stars}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.round((d.unlocked / d.total) * 100)}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-primary group-hover:underline">Ver →</span>
        </Link>
        <section className="card-inner p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Icon3D name="emoji/estrela.webp" size={20} /> Conquistas recentes
          </h3>
          {d.recent.length ? (
            <ul className="space-y-2">
              {d.recent.map((r) => (
                <li key={`${r.who}:${r.key}:${r.tier}:${r.at}`} className="flex items-center gap-3 rounded-xl bg-card p-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
                    <AchIcon icon={r.icon} size={26} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.name} {r.stars > 0 && <span className="text-amber-500">{"★".repeat(r.stars)}</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.me ? "você" : r.who} · há {ago(r.at, now)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém desbloqueou conquistas nos últimos 30 dias. Seja o primeiro!</p>
          )}
        </section>
      </div>
    </div>
  );
}
