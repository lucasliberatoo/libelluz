import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { AchIcon, Stars } from "@/components/celebrate/ach-icon";
import { ACHIEVEMENT_XP, CATEGORIES, type AchievementView } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { evaluateAchievements, getAchievementsPage } from "@/server/achievements";

export const metadata: Metadata = { title: "Conquistas · Libelluz" };

export default async function ConquistasPage() {
  const userId = (await auth())!.user!.id!;
  after(() => evaluateAchievements(userId).catch(() => null));
  const { views, unlocked, stars, totalStars } = await getAchievementsPage(userId);
  const pct = Math.round((stars / totalStars) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="card-soft relative overflow-hidden p-5 md:p-6">
        <div aria-hidden className="absolute -right-10 -top-10 size-48 rounded-full bg-amber-400/15 blur-2xl" />
        <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground md:hidden">
          <ChevronLeft className="size-4" /> Início
        </Link>
        <div className="relative flex items-center gap-4">
          <AchIcon icon="emoji/trofeu.webp" size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight">Conquistas</h1>
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">{unlocked}</b> de {views.length} desbloqueadas · <b className="text-foreground">{stars}</b>/{totalStars} estrelas
            </p>
            <div className="mt-2 h-2.5 max-w-md overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <p className="relative mt-3 text-xs text-muted-foreground">
          Cada estrela vale XP: ★ {ACHIEVEMENT_XP[0]} · ★★ {ACHIEVEMENT_XP[1]} · ★★★ {ACHIEVEMENT_XP[2]}. Algumas são secretas e só aparecem quando você as descobre.
        </p>
      </section>

      {CATEGORIES.map((cat) => {
        const list = views.filter((v) => v.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="card-soft p-4 md:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              {cat}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {list.filter((v) => v.tier > 0).length}/{list.length}
              </span>
            </h2>
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((v) => (
                <AchievementCard key={v.key} v={v} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AchievementCard({ v }: { v: AchievementView }) {
  const done = v.tier >= v.maxTier;
  return (
    <li
      className={cn(
        "card-inner flex gap-3 p-3",
        done && "bg-amber-50 ring-1 ring-amber-300/70 dark:bg-amber-500/10 dark:ring-amber-400/30",
        v.hidden && "opacity-80",
      )}
    >
      <span
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-2xl",
          v.tier > 0 ? "bg-gradient-to-b from-amber-100 to-amber-200 dark:from-amber-400/25 dark:to-amber-600/30" : "bg-card",
        )}
      >
        <AchIcon icon={v.icon} size={36} className={cn(v.tier === 0 && !v.hidden && "opacity-40 grayscale")} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate font-bold">{v.name}</p>
          {v.maxTier > 1 ? <Stars filled={v.tier} total={v.maxTier} className="text-sm" /> : v.tier > 0 && <span className="text-sm text-amber-400">★</span>}
        </div>
        <p className="text-xs text-muted-foreground">{v.goal}</p>
        {!v.hidden && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-card dark:bg-background/60">
              <div className={cn("h-full rounded-full", done ? "bg-amber-400" : "bg-primary")} style={{ width: `${v.pct}%` }} />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {done ? "completa!" : `${v.valueLabel}/${v.targetLabel}`}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
