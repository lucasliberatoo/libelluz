"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { cn } from "@/lib/utils";
import { poke } from "@/server/groups-actions";
import { Avatar, Empty, fmtDuration, joinNames, StreakLevel, useGroup, useMember } from "./parts";

type Data = {
  now: { userId: string; subject: string; topic: string; area: string; elapsedMin: number }[];
  studied: { userId: string; minutes: number | null; sessions: number }[];
  notYet: { userId: string; poked: boolean }[];
  pokedMe: string[];
};

export function StudyingNow({ data }: { data: Data }) {
  const { members } = useGroup();
  return (
    <div className="space-y-4">
      {data.pokedMe.length > 0 && (
        <div className="card-soft flex items-center gap-3 border-l-4 border-primary p-4 text-sm">
          <span className="text-2xl">👉</span>
          <p>
            <b>{joinNames(data.pokedMe.map((id) => members.get(id)?.firstName ?? "Alguém"))}</b> te cutuc
            {data.pokedMe.length > 1 ? "aram" : "ou"} hoje. Bora estudar?
          </p>
        </div>
      )}

      <section className="card-soft p-4 md:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Estudando agora
          <span className="ml-auto text-sm font-semibold text-muted-foreground">{data.now.length}</span>
        </h2>
        {data.now.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {data.now.map((s) => (
              <li key={s.userId} className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-3">
                <span className="relative">
                  <Avatar id={s.userId} size={44} />
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <Name id={s.userId} />
                  <p className="truncate text-sm">
                    <b>{s.subject}</b>
                    {s.topic && <span className="text-muted-foreground"> · {s.topic}</span>}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">há {fmtDuration(s.elapsedMin)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="emoji/lua.webp">Ninguém em foco agora. Que tal puxar a fila?</Empty>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card-soft p-4 md:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Icon3D name="emoji/check.webp" size={22} /> Já estudaram hoje
            <span className="ml-auto text-sm font-semibold text-muted-foreground">{data.studied.length}</span>
          </h2>
          {data.studied.length ? (
            <ul className="space-y-2">
              {data.studied.map((s) => (
                <li key={s.userId} className="flex items-center gap-3">
                  <Avatar id={s.userId} size={36} />
                  <div className="min-w-0 flex-1">
                    <Name id={s.userId} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {s.minutes !== null ? fmtDuration(s.minutes) : `${s.sessions} ${s.sessions === 1 ? "sessão" : "sessões"}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Ninguém ainda hoje.</p>
          )}
        </section>

        <section className="card-soft p-4 md:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Icon3D name="emoji/lua.webp" size={22} /> Ainda não estudaram
            <span className="ml-auto text-sm font-semibold text-muted-foreground">{data.notYet.length}</span>
          </h2>
          {data.notYet.length ? (
            <ul className="space-y-2">
              {data.notYet.map((p) => (
                <PokeRow key={p.userId} {...p} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Todo mundo já estudou hoje! 🔥</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Name({ id }: { id: string }) {
  const { meId } = useGroup();
  const m = useMember(id);
  return (
    <p className="flex flex-wrap items-center gap-x-2 font-semibold">
      <span className="truncate">{m?.name ?? "Alguém"}</span>
      {id === meId && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
      <StreakLevel id={id} />
    </p>
  );
}

function PokeRow({ userId, poked }: { userId: string; poked: boolean }) {
  const { meId } = useGroup();
  const [done, setDone] = useState(poked);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const me = userId === meId;
  return (
    <li className="flex items-center gap-3">
      <Avatar id={userId} size={36} />
      <div className="min-w-0 flex-1">
        <Name id={userId} />
        {msg && <p className="text-xs text-destructive">{msg}</p>}
      </div>
      {!me && (
        <button
          disabled={done || pending}
          onClick={() =>
            start(async () => {
              const r = await poke(userId);
              if ("error" in r) setMsg(r.error ?? null);
              setDone(true);
            })
          }
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-95",
            done ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:brightness-110",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : <span>👉</span>}
          {done ? "Cutucado" : "Cutucar"}
        </button>
      )}
    </li>
  );
}
