"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { PublicMember } from "@/server/groups";
import { GroupCtx } from "./parts";
import { GROUP_TABS, groupTabHref, type GroupTab } from "./tabs";

export function GroupsScreen({
  tab,
  members,
  meId,
  now,
  studyingCount,
  children,
}: {
  tab: GroupTab;
  members: PublicMember[];
  meId: string;
  now: number;
  studyingCount: number;
  children: React.ReactNode;
}) {
  const ctx = useMemo(() => ({ members: new Map(members.map((m) => [m.id, m])), meId, now }), [members, meId, now]);
  return (
    <GroupCtx.Provider value={ctx}>
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="card-soft flex flex-col gap-3 p-4 md:px-6">
          <div className="flex items-center gap-3">
            <Icon3D name="emoji/grupo.webp" size={40} />
            <div className="flex-1">
              <h1 className="text-xl font-bold leading-tight">Grupo</h1>
              <p className="text-sm text-muted-foreground">
                {members.length} {members.length === 1 ? "pessoa" : "pessoas"} · todo mundo do Libelluz
              </p>
            </div>
            <div className="hidden -space-x-2 sm:flex">
              {members.slice(0, 6).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-card">
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt={m.firstName} className="size-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{m.firstName[0]?.toUpperCase()}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <nav className="grid grid-cols-4 gap-1 md:flex" aria-label="Seções do grupo">
            {GROUP_TABS.map((t) => (
              <Link
                key={t.k}
                href={groupTabHref(t.k)}
                scroll={false}
                aria-current={tab === t.k ? "page" : undefined}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1 py-1.5 text-[13px] font-semibold transition-colors md:gap-1.5 md:px-4 md:text-sm",
                  tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-primary",
                )}
              >
                {t.k === "agora" ? (
                  <>
                    <span className="md:hidden">Agora</span>
                    <span className="hidden md:inline">{t.label}</span>
                  </>
                ) : (
                  t.label
                )}
                {t.k === "agora" && studyingCount > 0 && (
                  <span className={cn("rounded-full px-1.5 text-xs", tab === t.k ? "bg-white/25" : "bg-emerald-500 text-white")}>{studyingCount}</span>
                )}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </GroupCtx.Provider>
  );
}
