"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { field, Modal } from "@/components/ui/kit";
import { addDays } from "@/lib/day";
import { daysLeft, fmtMetric, MISSION_METRICS, MISSION_XP, type MissionMetric } from "@/lib/missions";
import { cn } from "@/lib/utils";
import type { MissionView } from "@/server/groups";
import { createMission, deleteMission } from "@/server/groups-actions";
import { Avatar, Empty, useGroup, useMember } from "./parts";

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export function Missions({ list, today, weekStart }: { list: MissionView[]; today: string; weekStart: string }) {
  const [creating, setCreating] = useState(false);
  const active = list.filter((m) => m.status !== "ended");
  const past = list.filter((m) => m.status === "ended");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">Missões cooperativas: todo mundo soma junto. Completou, cada membro ganha o XP.</p>
        <button
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110"
        >
          <Plus className="size-4" /> Nova missão
        </button>
      </div>
      {active.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((m) => (
            <MissionCard key={m.id} m={m} today={today} />
          ))}
        </div>
      ) : (
        <section className="card-soft">
          <Empty icon="emoji/alvo.webp">Nenhuma missão ativa. Crie uma para o grupo!</Empty>
        </section>
      )}
      {past.length > 0 && (
        <>
          <h2 className="pt-2 font-bold text-muted-foreground">Encerradas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {past.map((m) => (
              <MissionCard key={m.id} m={m} today={today} />
            ))}
          </div>
        </>
      )}
      {creating && <MissionForm onClose={() => setCreating(false)} today={today} weekStart={weekStart} />}
    </div>
  );
}

function MissionCard({ m, today }: { m: MissionView; today: string }) {
  const [, start] = useTransition();
  const router = useRouter();
  const failed = m.status === "ended" && !m.done;
  return (
    <article className={cn("card-soft space-y-3 p-4", failed && "opacity-70")} data-mission={m.id}>
      <header className="flex items-start gap-3">
        <Icon3D name={m.done ? "emoji/trofeu.webp" : "emoji/alvo.webp"} size={38} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{m.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {fmtDay(m.startDay)} – {fmtDay(m.endDay)}
            </span>
            {m.status === "active" && !m.done && <span>· {daysLeft(m, today) === 1 ? "último dia" : `faltam ${daysLeft(m, today)} dias`}</span>}
            {m.status === "upcoming" && <span>· começa em breve</span>}
            <span className="inline-flex items-center gap-0.5">
              · <Users className="size-3" /> {m.duo ? "dupla/trio" : "grupo todo"}
            </span>
            {m.auto && (
              <span className="inline-flex items-center gap-0.5 text-primary">
                · <Sparkles className="size-3" /> automática
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">+{m.xp} XP</span>
        {m.mine && (
          <button
            aria-label="Apagar missão"
            onClick={() => confirm("Apagar esta missão?") && start(async () => (await deleteMission(m.id), router.refresh()))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-bold">
            {fmtMetric(m.metric, m.total)} <span className="font-normal text-muted-foreground">de {fmtMetric(m.metric, m.target)}</span>
          </span>
          <span className={cn("font-bold", m.done ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
            {m.done ? "Cumprida! 🎉" : `${m.pct}%`}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full transition-all", m.done ? "bg-emerald-500" : "bg-primary")} style={{ width: `${m.pct}%` }} />
        </div>
      </div>

      <ul className="space-y-1.5">
        {m.contributions.map((c) => (
          <Contribution key={c.userId} c={c} m={m} />
        ))}
      </ul>
    </article>
  );
}

function Contribution({ c, m }: { c: MissionView["contributions"][number]; m: MissionView }) {
  const { meId } = useGroup();
  const mem = useMember(c.userId);
  const share = c.value !== null && m.target > 0 ? Math.min(100, (c.value / m.target) * 100) : 0;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Avatar id={c.userId} size={24} />
      <span className={cn("w-20 truncate sm:w-28", c.userId === meId && "font-bold")}>{c.userId === meId ? "Você" : (mem?.firstName ?? "Alguém")}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} />
      </div>
      <span className="w-20 text-right tabular-nums text-muted-foreground">{c.value === null ? "oculto" : fmtMetric(m.metric, c.value)}</span>
    </li>
  );
}

function MissionForm({ onClose, today, weekStart }: { onClose: () => void; today: string; weekStart: string }) {
  const router = useRouter();
  const { members, meId } = useGroup();
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<MissionMetric>("hours");
  const [target, setTarget] = useState("10");
  const [startDay, setStart] = useState(today);
  const [endDay, setEnd] = useState(addDays(weekStart, 6));
  const [xp, setXp] = useState(String(MISSION_XP.default));
  const [who, setWho] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<string[]>([meId]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createMission({ title, metric, target: Number(target), startDay, endDay, xp: Number(xp), memberIds: who === "all" ? [] : picked });
      if ("error" in r) return setError(r.error ?? "Erro");
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal title="Nova missão" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <label className="block">
          Nome
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex.: 20h de exatas até sexta" className={cn(field, "mt-1")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Métrica
            <select value={metric} onChange={(e) => setMetric(e.target.value as MissionMetric)} className={cn(field, "mt-1")}>
              {MISSION_METRICS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Alvo ({MISSION_METRICS.find((x) => x.key === metric)!.unit})
            <input type="number" min={1} step="any" value={target} onChange={(e) => setTarget(e.target.value)} className={cn(field, "mt-1")} />
          </label>
          <label className="block">
            Início
            <input type="date" value={startDay} onChange={(e) => setStart(e.target.value)} className={cn(field, "mt-1")} />
          </label>
          <label className="block">
            Fim
            <input type="date" value={endDay} onChange={(e) => setEnd(e.target.value)} className={cn(field, "mt-1")} />
          </label>
          <label className="col-span-2 block">
            XP para cada membro ({MISSION_XP.min}–{MISSION_XP.max})
            <input type="number" min={MISSION_XP.min} max={MISSION_XP.max} value={xp} onChange={(e) => setXp(e.target.value)} className={cn(field, "mt-1")} />
          </label>
        </div>
        <div>
          <p className="mb-1.5">Quem participa</p>
          <div className="flex gap-2">
            {(
              [
                ["all", "Grupo todo"],
                ["some", "Dupla / trio"],
              ] as const
            ).map(([k, label]) => (
              <button
                type="button"
                key={k}
                aria-pressed={who === k}
                onClick={() => setWho(k)}
                className={cn(
                  "rounded-full border-2 px-3.5 py-1 font-semibold transition-colors",
                  who === k ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-card text-primary hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {who === "some" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {[...members.values()].map((m) => {
                const on = picked.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                    className={cn("flex items-center gap-1.5 rounded-full border-2 py-0.5 pl-0.5 pr-3", on ? "border-primary bg-primary/10" : "border-border")}
                  >
                    <Avatar id={m.id} size={24} /> {m.id === meId ? "Você" : m.firstName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && <p className="text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-semibold text-muted-foreground hover:bg-accent">
            Cancelar
          </button>
          <button disabled={pending} className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />} Criar missão
          </button>
        </div>
      </form>
    </Modal>
  );
}
