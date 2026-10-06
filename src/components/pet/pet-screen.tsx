"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, Pencil } from "lucide-react";
import { FLAME_STAGES, Foguinho, Icon3D, type FoguinhoAccessory } from "@/components/brand";
import { cn } from "@/lib/utils";
import { accessoryEmoji, petVoice, STAGES } from "@/lib/heat";
import { renamePet } from "@/server/actions";
import { setPetAccessory } from "@/server/pet-actions";
import type { PetState } from "@/server/pet";

const BG = [
  "from-orange-200 via-orange-100 dark:from-orange-500/35 dark:via-orange-500/10",
  "from-yellow-200 via-yellow-100 dark:from-yellow-500/30 dark:via-yellow-500/10",
  "from-fuchsia-300 via-fuchsia-100 dark:from-fuchsia-500/35 dark:via-fuchsia-500/10",
  "from-teal-200 via-teal-100 dark:from-teal-500/35 dark:via-teal-500/10",
  "from-blue-300 via-blue-100 dark:from-blue-500/40 dark:via-blue-500/10",
];

const fmt = (n: number) => n.toLocaleString("pt-BR");

function moodLine(p: PetState, name: string) {
  switch (p.mood) {
    case "happy":
      return `${name} está feliz e brilhando: você estudou hoje!`;
    case "sleepy":
      return `${name} está ficando sonolento… estude um pouquinho antes de o dia acabar.`;
    case "sad":
      return p.sadReason === "firewood"
        ? `A lenha queimou ontem para salvar a sequência. ${name} ficou tristinho.`
        : `A sequência quebrou${p.lastPenalty ? ` e ${name} perdeu ${p.lastPenalty.lost} de calor` : ""}. Estude hoje para reacender!`;
    default:
      return `${name} está esperando o estudo de hoje.`;
  }
}

export function PetScreen({ pet }: { pet: PetState }) {
  const [view, setView] = useState(pet.stage);
  const [name, setName] = useState(pet.name);
  const [editing, setEditing] = useState(false);
  const [acc, setAcc] = useState<FoguinhoAccessory | null>(pet.accessory);
  const [, start] = useTransition();
  const locked = view > pet.stage;
  const cur = FLAME_STAGES[pet.stage];
  const next = STAGES[pet.stage + 1];
  const pct = pet.stageSpan ? Math.min(100, (pet.intoStage / pet.stageSpan) * 100) : 100;
  const accEmoji = accessoryEmoji(acc);
  const voice = petVoice(name, acc);
  const doneCount = pet.todayChecklist.filter((t) => t.done).length;
  const maxToday = pet.todayChecklist.reduce((a, t) => a + t.max, 0);

  const save = () => {
    setEditing(false);
    if (name.trim() && name !== pet.name) start(() => renamePet(name));
  };
  const equip = (id: FoguinhoAccessory) => {
    const v = acc === id ? null : id;
    setAcc(v);
    start(() => setPetAccessory(v));
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 md:items-start md:gap-6">
      {/* ---------- O foguinho ---------- */}
      <section className="overflow-hidden rounded-[2rem] bg-card shadow-xl ring-1 ring-border md:sticky md:top-24">
        <div className={cn("relative bg-gradient-to-b to-card px-5 pb-6 pt-5 text-center transition-colors", BG[view])}>
          <Link href="/" aria-label="Voltar" className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-white/60 text-foreground dark:bg-black/30">
            <ArrowLeft className="size-5" />
          </Link>
          <span title="Sequência" className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-sm font-semibold text-foreground dark:bg-black/30">
            <Icon3D name="fogo.png" size={16} /> {pet.streak.streak}
          </span>

          <div className="mt-6 flex items-center justify-between">
            <button aria-label="Estágio anterior" disabled={view === 0} onClick={() => setView(view - 1)} className="grid size-10 place-items-center rounded-full text-foreground disabled:opacity-20">
              <ChevronLeft className="size-7" />
            </button>
            <div className="relative grid size-52 place-items-center md:size-60">
              {locked ? (
                <>
                  <Foguinho stage={view} fx={false} mood="calm" className="size-full opacity-25 brightness-0 dark:invert" />
                  <span className="absolute inset-0 grid place-items-center text-7xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">?</span>
                </>
              ) : (
                <Foguinho
                  stage={view}
                  mood={view === pet.stage ? pet.mood : "happy"}
                  accessory={acc}
                  className={cn("size-full drop-shadow-xl", view === pet.stage && pet.mood === "happy" && "animate-[bounce_3s_ease-in-out_infinite]")}
                />
              )}
            </div>
            <button aria-label="Próximo estágio" disabled={view === FLAME_STAGES.length - 1} onClick={() => setView(view + 1)} className="grid size-10 place-items-center rounded-full text-foreground disabled:opacity-20">
              <ChevronRight className="size-7" />
            </button>
          </div>

          <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
            {FLAME_STAGES.map((s, i) => (
              <button
                key={s.name}
                tabIndex={-1}
                onClick={() => setView(i)}
                className={cn("h-2 rounded-full transition-all", i === view ? "w-6" : "w-2", i > pet.stage && "opacity-30")}
                style={{ background: `linear-gradient(90deg, ${s.from}, ${s.to})` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-foreground/60">
            Estágio {view + 1} · {locked ? "???" : FLAME_STAGES[view].name}
          </p>
          {view !== pet.stage && (
            <p className="text-xs text-foreground/70">
              {locked
                ? `Chega com ${fmt(STAGES[view].at)} de calor · faltam ${fmt(STAGES[view].at - pet.total)}`
                : "Estágio que você já passou"}
            </p>
          )}

          <div className="mt-1 flex items-center justify-center gap-2 text-foreground">
            {editing ? (
              <input
                autoFocus
                value={name}
                maxLength={30}
                aria-label="Nome do foguinho"
                onChange={(e) => setName(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="w-44 rounded-lg bg-white/80 px-2 py-0.5 text-center text-xl font-bold outline-none dark:bg-black/30"
              />
            ) : (
              <>
                <h1 className="text-2xl font-bold">{name}</h1>
                {accEmoji && (
                  <span title={`Acessório: ${pet.accessories.find((a) => a.id === acc)?.name}`} className="text-xl">
                    {accEmoji}
                  </span>
                )}
                <button aria-label="Renomear" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                </button>
              </>
            )}
          </div>
          <p className="mx-auto mt-1 max-w-xs text-sm text-foreground/75">{moodLine(pet, name)}</p>

          {/* barra de calor do estágio */}
          <div className="mx-auto mt-4 w-full max-w-sm text-left">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground/80">
              <span className="flex items-center gap-1">
                <Icon3D name="emoji/calor.webp" size={16} /> {fmt(pet.intoStage)}
                {pet.stageSpan ? ` / ${fmt(pet.stageSpan)}` : ""} de calor
              </span>
              <span>{next ? `até ${next.name}` : "estágio máximo!"}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-black/5 dark:bg-black/30">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cur.from}, ${cur.to})` }} />
            </div>
            <p className="mt-1 text-center text-xs text-foreground/70">
              Hoje: +{pet.todayHeat} de calor · total {fmt(pet.total)}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {/* ---------- Como aquecer hoje ---------- */}
        <section className="card-soft p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Como aquecer o {name} hoje</h2>
              <p className="text-xs text-muted-foreground">Cada tarefinha dá calor. Barra cheia, ele evolui.</p>
            </div>
            <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-200">
              {doneCount}/{pet.todayChecklist.length} · {pet.todayHeat}/{maxToday}
            </span>
          </div>
          <ul className="space-y-2">
            {pet.todayChecklist.map((t) => (
              <li key={t.key}>
                <Link href={t.href ?? "/"} className={cn("flex items-center gap-3 rounded-2xl p-3 transition hover:brightness-[0.98]", t.done ? "bg-success/10" : "card-inner")}>
                  <Icon3D name={t.icon} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", t.done && t.heat >= t.max && "text-muted-foreground line-through")}>{t.label}</span>
                    {t.hint && <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>}
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", t.done ? "bg-orange-500 text-white" : "bg-card text-muted-foreground ring-1 ring-border")}>
                    +{t.done ? t.heat : t.max}
                  </span>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", t.done ? "bg-success text-white" : "ring-2 ring-border")}>
                    {t.done && <Check className="size-4" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Perder a sequência apaga 20% do calor do estágio atual (ele nunca volta de estágio). A lenha guardada protege um dia em branco.
          </p>
        </section>

        {/* ---------- Acessórios ---------- */}
        <section className="card-soft p-4 md:p-5">
          <h2 className="font-bold">Acessórios</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Desbloqueie com constância e toque para vestir. O acessório aparece ao lado do nome e dá a voz das notificações — agora {voice.tone}, assinando{" "}
            <span className="font-semibold">{voice.sign}</span>.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pet.accessories.map((a) => {
              const on = acc === a.id;
              return (
                <button
                  key={a.id}
                  disabled={!a.unlocked}
                  onClick={() => equip(a.id)}
                  aria-pressed={on}
                  className={cn(
                    "relative flex flex-col items-center rounded-2xl p-3 text-center transition",
                    on ? "bg-primary/10 ring-2 ring-primary" : "card-inner",
                    a.unlocked ? "hover:-translate-y-0.5" : "cursor-not-allowed",
                  )}
                >
                  <Foguinho stage={pet.stage} mood="calm" fx={false} accessory={a.id} className={cn("size-16", !a.unlocked && "opacity-40 grayscale")} />
                  {!a.unlocked && <Lock className="absolute right-2 top-2 size-4 text-muted-foreground" />}
                  <span className="mt-1 text-sm font-semibold">{a.name}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">{a.unlocked ? (on ? "Vestindo · toque para tirar" : "Toque para vestir") : a.need}</span>
                  {!a.unlocked && (
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-card">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(a.value / a.target) * 100}%` }} />
                    </span>
                  )}
                  {!a.unlocked && (
                    <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {a.value}/{a.target}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
