"use client";

import { createContext, useContext } from "react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { PublicMember } from "@/server/groups";

/** Membros do grupo + quem está vendo, para os cards acharem nome e foto pelo id. */
export const GroupCtx = createContext<{ members: Map<string, PublicMember>; meId: string; now: number }>({
  members: new Map(),
  meId: "",
  now: 0,
});
export const useGroup = () => useContext(GroupCtx);
export const useMember = (id: string) => useGroup().members.get(id);

export function Avatar({ id, size = 40, className }: { id: string; size?: number; className?: string }) {
  const m = useMember(id);
  const initials = (m?.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-bold text-primary", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {m?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/** Foguinho (sequência) + nível. */
export function StreakLevel({ id, className }: { id: string; className?: string }) {
  const m = useMember(id);
  if (!m) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-0.5" title={`${m.streak} dias seguidos`}>
        <Icon3D name="fogo.png" size={14} />
        <span className={m.streak > 0 ? "text-orange-600 dark:text-orange-400" : undefined}>{m.streak}</span>
      </span>
      <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] text-primary">Nv {m.level}</span>
    </span>
  );
}

export function fmtDuration(min: number) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

export function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "ontem" : `há ${d} dias`;
  return new Date(at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
}

/** "Ana", "Ana e Bia", "Ana, Bia e mais 2". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} e mais ${names.length - 2}`;
}

export function Empty({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
      <Icon3D name={icon} size={44} />
      {children}
    </div>
  );
}
