"use client";

import { useActionState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { saveProfile } from "@/server/actions";

type P = {
  name: string;
  petName: string;
  enemDate: string;
  waterGoal: number;
  readingGoalMin: number;
  focusGoalMin: number;
  questionsGoal: number;
  dailyXpGoal: number;
  weeklyXpGoal: number;
};

const noop = () => () => {};
const input = "mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export function ProfileForm({ initial }: { initial: P }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const { theme: rawTheme, setTheme } = useTheme();
  // o tema só existe no navegador; no servidor nenhum botão fica marcado (evita erro de hidratação)
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const theme = mounted ? rawTheme : undefined;
  const field = (name: keyof P, label: string, type = "number") => (
    <label className="text-sm">
      {label}
      <input name={name} type={type} defaultValue={initial[name]} className={input} />
    </label>
  );
  return (
    <form action={action} className="space-y-4">
      <section className="card-soft space-y-3 p-5">
        <h1 className="text-xl font-bold">Configurações</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("name", "Seu nome", "text")}
          {field("petName", "Nome do foguinho", "text")}
          {field("enemDate", "Data do ENEM", "date")}
        </div>
      </section>
      <section className="card-soft space-y-3 p-5">
        <h2 className="font-bold">Metas diárias</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("focusGoalMin", "Foco (min/dia)")}
          {field("questionsGoal", "Questões/dia")}
          {field("dailyXpGoal", "XP/dia")}
          {field("weeklyXpGoal", "XP/semana")}
          {field("waterGoal", "Água (copos)")}
          {field("readingGoalMin", "Leitura (min)")}
        </div>
      </section>
      <section className="card-soft flex items-center gap-3 p-5">
        <h2 className="flex-1 font-bold">Tema</h2>
        {[
          ["system", "Automático"],
          ["light", "Claro"],
          ["dark", "Escuro"],
        ].map(([v, l]) => (
          <button
            type="button"
            key={v}
            onClick={() => setTheme(v)}
            className={`rounded-full px-3 py-1 text-sm ${theme === v ? "bg-primary text-white" : "ring-1 ring-border"}`}
          >
            {l}
          </button>
        ))}
      </section>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state && !state.error && <p className="text-sm text-success">Salvo!</p>}
      <button disabled={pending} className="w-full rounded-full bg-primary py-3 font-bold text-white disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
