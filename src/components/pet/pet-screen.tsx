"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { FLAME_STAGES, Foguinho, Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { renamePet } from "@/server/actions";

// Estágio atual: a evolução por calor chega na Fase 3. Por enquanto todo mundo é Faísca.
const CURRENT = 0;
const BG = [
  "from-orange-200 via-orange-100",
  "from-yellow-200 via-yellow-100",
  "from-fuchsia-300 via-fuchsia-100",
  "from-teal-200 via-teal-100",
  "from-blue-300 via-blue-100",
];

export function PetScreen({
  name,
  streak,
  studiedToday,
  tasks,
}: {
  name: string;
  streak: number;
  studiedToday: boolean;
  tasks: { icon: string; label: string; done: boolean }[];
}) {
  const [stage, setStage] = useState(CURRENT);
  const [pet, setPet] = useState(name);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const done = tasks.filter((t) => t.done).length;
  const locked = stage > CURRENT;
  const save = () => {
    setEditing(false);
    if (pet.trim() && pet !== name) start(() => renamePet(pet));
  };

  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-[2rem] bg-card shadow-xl ring-1 ring-border">
      <div className={cn("relative bg-gradient-to-b to-card px-5 pb-6 pt-5 text-center transition-colors dark:to-card", BG[stage])}>
        <Link href="/" aria-label="Voltar" className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-white/60 text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-sm font-semibold text-foreground">
          <Icon3D name="fogo.png" size={16} /> {streak}
        </span>

        <div className="mt-6 flex items-center justify-between">
          <button aria-label="Estágio anterior" disabled={stage === 0} onClick={() => setStage(stage - 1)} className="grid size-10 place-items-center rounded-full text-foreground disabled:opacity-20">
            <ChevronLeft className="size-7" />
          </button>
          <div className="relative grid size-52 place-items-center">
            {locked ? (
              <div className="relative">
                <Foguinho stage={stage} className="size-44 brightness-0 opacity-25" />
                <span className="absolute inset-0 grid place-items-center text-6xl font-black text-white drop-shadow">?</span>
              </div>
            ) : (
              <Foguinho stage={stage} mood={studiedToday ? "happy" : "sleepy"} className="size-48 animate-[bounce_3s_ease-in-out_infinite] drop-shadow-xl" />
            )}
          </div>
          <button aria-label="Próximo estágio" disabled={stage === FLAME_STAGES.length - 1} onClick={() => setStage(stage + 1)} className="grid size-10 place-items-center rounded-full text-foreground disabled:opacity-20">
            <ChevronRight className="size-7" />
          </button>
        </div>

        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-foreground/60">
          Estágio {stage + 1} · {locked ? "???" : FLAME_STAGES[stage].name}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2 text-foreground">
          {editing ? (
            <input
              autoFocus
              value={pet}
              maxLength={30}
              onChange={(e) => setPet(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-40 rounded-lg bg-white/80 px-2 py-0.5 text-center text-xl font-bold outline-none"
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold">{pet}</h1>
              <button aria-label="Renomear" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </button>
            </>
          )}
        </div>
        <div className="mx-auto mt-3 h-3 w-4/5 overflow-hidden rounded-full bg-white/60">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(done / tasks.length) * 100}%`, background: `linear-gradient(90deg, ${FLAME_STAGES[CURRENT].from}, ${FLAME_STAGES[CURRENT].to})` }}
          />
        </div>
        <p className="mt-1 text-xs text-foreground/70">Calor de hoje: {done}/{tasks.length}</p>
      </div>

      <div className="px-5 pb-6">
        <p className="mb-3 font-semibold">Complete as tarefinhas e aqueça seu foguinho para ele evoluir</p>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.label} className={cn("flex items-center gap-3 rounded-2xl p-3", t.done ? "bg-success/10" : "card-inner")}>
              <Icon3D name={t.icon} size={28} />
              <span className={cn("flex-1 text-sm", t.done && "text-muted-foreground line-through")}>{t.label}</span>
              <span className={cn("grid size-6 place-items-center rounded-full", t.done ? "bg-success text-white" : "ring-2 ring-border")}>
                {t.done && <Check className="size-4" />}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          A evolução para os próximos estágios (Chama, Labareda, Fogo-fátuo, Chama Azul) chega com o sistema de calor.
        </p>
      </div>
    </div>
  );
}
