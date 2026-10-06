"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Foguinho, FLAME_STAGES, Icon3D, type FoguinhoAccessory } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { PetSummary } from "@/server/pet";

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export type WeekDot = "studied" | "today" | "firewood" | "missed" | "future" | "rest";

const DOT_TITLE: Partial<Record<WeekDot, string>> = {
  firewood: "Protegido pela lenha",
  rest: "Descanso planejado",
  missed: "Dia em branco",
  studied: "Estudou",
};

/**
 * Card da sequência no Início: o foguinho de verdade (estágio, humor e acessório),
 * a lenha guardada, a barra de calor do estágio e a semana em bolinhas.
 */
export function StreakCard({
  streak,
  weekDots,
  pet,
}: {
  streak: { streak: number; firewood: number; studiedToday: boolean };
  weekDots: readonly WeekDot[];
  pet?: PetSummary | null;
}) {
  const stage = pet?.stage ?? 0;
  const c = FLAME_STAGES[Math.min(Math.max(stage, 0), FLAME_STAGES.length - 1)];
  const pct = pet ? (pet.stageSpan ? Math.min(100, (pet.intoStage / pet.stageSpan) * 100) : 100) : 0;

  return (
    <section className="card-inner p-4 text-center">
      <div className="flex items-center justify-between text-left">
        <span className="text-xs font-semibold text-muted-foreground">Sequência</span>
        <span
          title="Ganha 1 a cada 7 dias seguidos (máx. 2). Protege um dia em branco."
          className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-medium"
        >
          <Icon3D name="emoji/lenha.webp" size={14} /> {streak.firewood} lenha
        </span>
      </div>

      <Link href="/foguinho" aria-label="Abrir seu foguinho" className="group mt-1 block">
        <Foguinho
          stage={stage}
          mood={pet?.mood ?? (streak.studiedToday ? "happy" : "sleepy")}
          accessory={(pet?.accessory ?? null) as FoguinhoAccessory | null}
          className="mx-auto size-24 transition group-hover:-translate-y-0.5"
        />
        {pet && (
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {pet.name}
            {pet.accessoryEmoji && <span className="ml-1">{pet.accessoryEmoji}</span>} · {pet.stageName}
          </p>
        )}
      </Link>

      <p className="mt-1 text-xl font-extrabold">
        {streak.streak} {streak.streak === 1 ? "dia seguido" : "dias seguidos"}
      </p>

      {pet ? (
        <div className="mx-auto mt-2 w-full text-left">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon3D name="emoji/calor.webp" size={13} /> {pet.stageSpan ? `${pet.intoStage}/${pet.stageSpan}` : pet.intoStage} de calor
            </span>
            <span>{pet.todayHeat > 0 ? `+${pet.todayHeat} hoje` : "nada hoje"}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-card ring-1 ring-border">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.from}, ${c.to})` }} />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {streak.studiedToday ? "Foguinho aceso hoje! Mantenha o foco." : "Estude um pouco hoje para não deixar o fogo apagar."}
        </p>
      )}

      {!streak.studiedToday ? (
        <Link href="/foco" className="mx-auto mt-3 block h-7 w-3/4 rounded-full bg-primary text-xs font-semibold leading-7 text-white hover:brightness-110">
          Estudar agora
        </Link>
      ) : (
        <Link href="/foguinho" className="mx-auto mt-3 flex w-fit items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
          {pet?.todo ? `${pet.todo} tarefinha${pet.todo === 1 ? "" : "s"} para aquecer` : "Ver o foguinho"}
          <ChevronRight className="size-3.5" />
        </Link>
      )}

      <div className="mt-3 flex justify-center gap-1">
        {weekDots.map((w, i) => (
          <span
            key={i}
            title={DOT_TITLE[w]}
            className={cn(
              "grid size-7 place-items-center rounded-full text-[11px] font-bold",
              w === "studied" && "bg-primary text-primary-foreground",
              w === "today" && "bg-card text-primary ring-2 ring-primary",
              w === "firewood" && "bg-amber-600 text-white",
              w === "missed" && "bg-destructive/15 text-destructive",
              w === "future" && "bg-card text-muted-foreground",
              w === "rest" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            )}
          >
            {DAYS[i]}
          </span>
        ))}
      </div>
    </section>
  );
}
