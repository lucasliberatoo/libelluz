"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { Chip } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import type { RankingData } from "@/server/groups";
import { Avatar, StreakLevel, useGroup, useMember } from "./parts";

const METRICS = [
  { k: "hours", label: "Horas" },
  { k: "xp", label: "XP" },
  { k: "questions", label: "Questões" },
] as const;
type Metric = (typeof METRICS)[number]["k"];

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const MEDALS = ["🥇", "🥈", "🥉"];

export function Ranking({ data }: { data: RankingData }) {
  const { meId } = useGroup();
  const [metric, setMetric] = useState<Metric>("hours");
  const value = (r: RankingData["rows"][number]) => r[metric];
  // quem esconde as horas fica fora do ranking de horas (aparece no fim, sem posição)
  const ranked = data.rows.filter((r) => value(r) !== null).sort((a, b) => value(b)! - value(a)! || (a.userId === meId ? -1 : 1));
  const hidden = data.rows.filter((r) => value(r) === null);
  const me = data.rows.find((r) => r.userId === meId);

  return (
    <section className="card-soft p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Icon3D name="emoji/trofeu.webp" size={36} />
        <div className="flex-1">
          <h2 className="font-bold leading-tight">Ranking da semana</h2>
          <p className="text-sm text-muted-foreground">
            {fmtDay(data.weekStart)} – {fmtDay(data.weekEnd)} · zera todo domingo
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Métrica do ranking">
          {METRICS.map((m) => (
            <Chip key={m.k} active={metric === m.k} onClick={() => setMetric(m.k)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </div>

      <ol className="space-y-2">
        {ranked.map((r, i) => (
          <Row key={r.userId} pos={i} row={r} metric={metric} me={r.userId === meId} />
        ))}
        {hidden.map((r) => (
          <li key={r.userId} className="flex items-center gap-3 rounded-2xl px-3 py-2 opacity-70">
            <span className="w-7 text-center text-sm text-muted-foreground">–</span>
            <Avatar id={r.userId} size={36} />
            <NameCell id={r.userId} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeOff className="size-3.5" /> oculto
            </span>
          </li>
        ))}
      </ol>

      {me?.hiddenForOthers && (me.hiddenForOthers.hours || me.hiddenForOthers.accuracy) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="size-3.5" />
          Suas {[me.hiddenForOthers.hours && "horas", me.hiddenForOthers.accuracy && "taxa de acerto"].filter(Boolean).join(" e ")} não
          aparecem para o grupo (Configurações).
        </p>
      )}
    </section>
  );
}

function Row({ pos, row, metric, me }: { pos: number; row: RankingData["rows"][number]; metric: Metric; me: boolean }) {
  const v = row[metric] ?? 0;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2",
        me ? "bg-primary/10 ring-2 ring-primary" : pos < 3 ? "bg-muted/50" : undefined,
      )}
      aria-current={me ? "true" : undefined}
    >
      <span className="w-7 text-center text-lg font-bold tabular-nums">{MEDALS[pos] ?? <span className="text-sm text-muted-foreground">{pos + 1}º</span>}</span>
      <Avatar id={row.userId} size={36} />
      <NameCell id={row.userId} me={me} />
      <span className="text-right">
        <span className="block font-bold tabular-nums text-primary">
          {metric === "hours" ? `${String(v).replace(".", ",")}h` : metric === "xp" ? `${v} XP` : v}
        </span>
        {metric === "questions" && row.accuracy !== null && <span className="block text-xs text-muted-foreground">{row.accuracy}% acerto</span>}
      </span>
    </li>
  );
}

function NameCell({ id, me }: { id: string; me?: boolean }) {
  const m = useMember(id);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold">
        {m?.name ?? "Alguém"} {me && <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[11px] font-bold text-primary-foreground">você</span>}
      </p>
      <StreakLevel id={id} />
    </div>
  );
}
