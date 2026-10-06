"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { savePrivacy } from "@/server/groups-actions";

type P = { hideAccuracy?: boolean; hideHours?: boolean; hideFeed?: boolean; hideStudyingNow?: boolean };

const OPTIONS: { k: keyof P; label: string; hint: string }[] = [
  { k: "hideFeed", label: "Esconder minhas sessões do feed", hint: "Suas sessões de foco não viram card no feed do grupo." },
  { k: "hideStudyingNow", label: "Não aparecer em “Estudando agora”", hint: "Ninguém vê quando você está em foco." },
  { k: "hideHours", label: "Esconder minhas horas", hint: "Você sai do ranking de horas e suas horas não aparecem." },
  { k: "hideAccuracy", label: "Esconder minha taxa de acerto", hint: "O % de acerto some do feed e do ranking." },
];

/** Privacidade no grupo (seção no fim de /config). */
export function PrivacyForm({ initial }: { initial: P }) {
  const [v, setV] = useState<Required<P>>({
    hideAccuracy: !!initial.hideAccuracy,
    hideHours: !!initial.hideHours,
    hideFeed: !!initial.hideFeed,
    hideStudyingNow: !!initial.hideStudyingNow,
  });
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const toggle = (k: keyof P) => {
    const next = { ...v, [k]: !v[k] };
    setV(next);
    setSaved(false);
    start(async () => {
      await savePrivacy(next);
      setSaved(true);
    });
  };

  return (
    <section className="card-soft mt-4 space-y-3 p-5" aria-labelledby="privacy-title">
      <div className="flex items-center gap-2">
        <Icon3D name="emoji/grupo.webp" size={26} />
        <h2 id="privacy-title" className="flex-1 font-bold">
          Privacidade no grupo
        </h2>
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" /> Salvo
            </span>
          )
        )}
      </div>
      <p className="text-sm text-muted-foreground">Escolha o que o grupo vê de você. Você sempre vê tudo seu.</p>
      <ul className="divide-y">
        {OPTIONS.map((o) => (
          <li key={o.k}>
            <label className="flex cursor-pointer items-center gap-3 py-3">
              <span className="flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
              <input type="checkbox" role="switch" checked={v[o.k]} onChange={() => toggle(o.k)} className="peer sr-only" name={o.k} />
              <span
                aria-hidden
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary",
                  v[o.k] ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", v[o.k] ? "left-[22px]" : "left-0.5")} />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
