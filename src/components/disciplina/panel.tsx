"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Coins, Plus, Search, Smartphone, X } from "lucide-react";
import { Modal, field } from "@/components/ui/kit";
import { Icon3D } from "@/components/brand";
import { TOKENS, clampBase, clampMinutes, tokenBudget, tokensLabel } from "@/lib/tokens";
import type { Discipline, DisciplineApp } from "@/server/discipline";
import { saveDisciplineSettings, syncDiscipline } from "@/server/discipline-actions";
import { KNOWN_APPS, appBlocker, useAppBlockerPresent, type AppBlockerInfo, type NativeApp } from "./bridge";
import { PermsCard } from "./perms";

/**
 * Modo Disciplina. A página funciona em qualquer navegador (dá para escolher os apps e as regras),
 * mas o bloqueio em si só roda no APK Android, onde o plugin nativo existe.
 */
export function DisciplinaPanel({ initial }: { initial: Discipline }) {
  const [enabled, setEnabled] = useState(initial.settings.enabled);
  const [apps, setApps] = useState<DisciplineApp[]>(initial.settings.apps);
  const [baseTokens, setBaseTokens] = useState(initial.settings.baseTokens);
  const [minutes, setMinutes] = useState(initial.settings.minutesPerToken);
  const [blockNotifs, setBlockNotifs] = useState(initial.settings.blockNotifications);

  const [spent, setSpent] = useState(initial.budget.spent);
  const native = useAppBlockerPresent();
  const [info, setInfo] = useState<AppBlockerInfo | null>(null);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const budget = useMemo(() => tokenBudget({ baseTokens, xpToday: initial.xpToday, spent }), [baseTokens, initial.xpToday, spent]);

  // Montagem no APK: sobe a fila de tokens gastos offline e desce a configuração atual.
  useEffect(() => {
    const plugin = appBlocker();
    if (!plugin) return;
    let alive = true;
    const base = {
      enabled: initial.settings.enabled,
      apps: initial.settings.apps,
      baseTokens: initial.settings.baseTokens,
      minutesPerToken: initial.settings.minutesPerToken,
      blockNotifications: initial.settings.blockNotifications,
      day: initial.day,
    };
    plugin
      .getState()
      .then((state) => {
        if (!state.pending?.length) return initial.budget.left;
        return syncDiscipline({ spends: state.pending })
          .then((res) => plugin.ack({ ids: res.ackIds }).then(() => res))
          .then((res) => {
            if (alive) setSpent(Math.max(0, res.total - res.tokensLeft));
            return res.tokensLeft;
          });
      })
      .then((tokensLeft) => plugin.setConfig({ ...base, tokensLeft }))
      .catch(() => {
        // Falha de ponte nunca quebra a página: o bloqueio segue com o que já estava salvo.
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  const save = () => {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const res = await saveDisciplineSettings({
        enabled,
        apps,
        baseTokens,
        minutesPerToken: minutes,
        blockNotifications: blockNotifs,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEnabled(res.settings.enabled);
      setSaved(true);
      const plugin = appBlocker();
      if (!plugin) return;
      try {
        await plugin.setConfig({
          enabled: res.settings.enabled,
          apps: res.settings.apps,
          baseTokens: res.settings.baseTokens,
          minutesPerToken: res.settings.minutesPerToken,
          blockNotifications: res.settings.blockNotifications,
          tokensLeft: budget.left,
          day: initial.day,
        });
      } catch {
        // idem: o servidor já guardou a escolha.
      }
    });
  };

  const toggleApp = (app: DisciplineApp) =>
    setApps((prev) => (prev.some((a) => a.pkg === app.pkg) ? prev.filter((a) => a.pkg !== app.pkg) : [...prev, app]));

  return (
    <div className="space-y-4">
      <TokensCard budget={budget} minutes={minutes} xpToday={initial.xpToday} />

      {native ? <PermsCard onInfo={setInfo} /> : <BrowserNotice />}

      <section className="card-soft space-y-3 p-5">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 font-bold">Apps bloqueados</h2>
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus className="size-3.5" />
            Escolher
          </button>
        </div>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum app escolhido ainda. Comece pelos dois ou três que mais te roubam tempo.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {apps.map((a) => (
              <li key={a.pkg}>
                <button
                  type="button"
                  onClick={() => toggleApp(a)}
                  className="flex items-center gap-1.5 rounded-full border-2 border-primary/60 bg-card px-3 py-1 text-sm font-semibold text-primary"
                >
                  {a.label}
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft space-y-4 p-5">
        <h2 className="font-bold">Regras</h2>
        <Row
          label="Modo Disciplina ligado"
          hint={apps.length === 0 ? "Escolha pelo menos um app para poder ligar." : "Bloqueia os apps acima até você gastar um token."}
        >
          <Switch checked={enabled && apps.length > 0} disabled={apps.length === 0} onChange={setEnabled} label="Modo Disciplina" />
        </Row>
        <Row label="Bloquear as notificações desses apps" hint="Os avisos deles ficam silenciosos enquanto não há token valendo.">
          <Switch checked={blockNotifs} onChange={setBlockNotifs} label="Bloquear notificações" />
        </Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Tokens de graça por dia
            <input
              type="number"
              min={TOKENS.baseMin}
              max={TOKENS.baseMax}
              value={baseTokens}
              onChange={(e) => setBaseTokens(clampBase(Number(e.target.value)))}
              className={`mt-1 ${field}`}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Com 0, todo token precisa ser ganho estudando.
            </span>
          </label>
          <label className="text-sm">
            Minutos por token
            <input
              type="number"
              min={TOKENS.minutesMin}
              max={TOKENS.minutesMax}
              value={minutes}
              onChange={(e) => setMinutes(clampMinutes(Number(e.target.value)))}
              className={`mt-1 ${field}`}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              De {TOKENS.minutesMin} a {TOKENS.minutesMax} minutos.
            </span>
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && <p className="text-sm text-success">Salvo!</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full rounded-full bg-primary py-3 font-bold text-white disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        {native && info && !info.running && enabled && info.canBlock && (
          <p className="text-xs text-muted-foreground">
            O bloqueio liga sozinho depois de salvar. Se o aviso &quot;Modo Disciplina ativo&quot; não aparecer, abra o Libelluz de novo.
          </p>
        )}
      </section>

      <LogCard initial={initial} />

      {picker && (
        <AppPicker
          native={native}
          selected={apps}
          onToggle={toggleApp}
          onClose={() => {
            setPicker(false);
            setSaved(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- peças ---------- */

function TokensCard({ budget, minutes, xpToday }: { budget: ReturnType<typeof tokenBudget>; minutes: number; xpToday: number }) {
  return (
    <section className="card-soft space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Icon3D name="emoji/raio.webp" size={32} alt="" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Modo Disciplina</h1>
          <p className="text-sm text-muted-foreground">{tokensLabel(budget.left)} — cada um vale {minutes} min.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: Math.min(budget.total, 20) }, (_, i) => (
          <span
            key={i}
            className={`size-5 rounded-full ring-2 ${i < budget.left ? "bg-amber-400 ring-amber-500/40" : "bg-muted ring-border"}`}
          />
        ))}
      </div>
      <dl className="card-inner grid grid-cols-3 gap-2 p-3 text-center text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">De graça</dt>
          <dd className="font-bold">{budget.base}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ganhos com XP</dt>
          <dd className="font-bold">{budget.earned}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Gastos hoje</dt>
          <dd className="font-bold">{budget.spent}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Você tem {xpToday} XP hoje.{" "}
        {budget.xpToNext === null
          ? `Já chegou no limite de ${TOKENS.maxEarned} tokens extras do dia.`
          : `Faltam ${budget.xpToNext} XP para ganhar mais 1 token.`}{" "}
        Cada {TOKENS.xpPerToken} XP vale 1 token extra.
      </p>
    </section>
  );
}

function BrowserNotice() {
  return (
    <section className="card-soft space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Smartphone className="size-5 text-primary" />
        <h2 className="flex-1 font-bold">O bloqueio só funciona no app Android</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        O navegador não pode ver nem fechar outros apps do celular. Aqui você escolhe os apps e as regras; o bloqueio de verdade
        — a tela do token e o silêncio das notificações — acontece no APK do Libelluz, que usa as permissões de acesso ao uso e
        de sobreposição do Android.
      </p>
      <Link href="/baixar" className="block rounded-full bg-primary py-2.5 text-center font-bold text-white">
        Baixar o app para Android
      </Link>
      <p className="text-xs text-muted-foreground">Já instalado? Abra esta página dentro do app para liberar as permissões.</p>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-primary" : "bg-muted ring-1 ring-border"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

const curated = (): NativeApp[] => KNOWN_APPS.map((a) => ({ ...a, suggested: true }));

function AppPicker({
  native,
  selected,
  onToggle,
  onClose,
}: {
  native: boolean;
  selected: DisciplineApp[];
  onToggle: (app: DisciplineApp) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<NativeApp[] | null>(() => (appBlocker() ? null : curated()));
  const [query, setQuery] = useState("");

  // No APK a lista vem do celular; no navegador ela já veio pronta no estado inicial.
  useEffect(() => {
    const plugin = appBlocker();
    if (!plugin) return;
    let alive = true;
    plugin.listApps().then(
      (res) => {
        if (alive) setList(res.apps ?? []);
      },
      () => {
        if (alive) setList(curated());
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = list ?? [];
    return q ? all.filter((a) => a.label.toLowerCase().includes(q) || a.pkg.includes(q)) : all.slice(0, 120);
  }, [list, query]);

  return (
    <Modal title="Escolher apps" onClose={onClose}>
      <div className="space-y-3">
        {!native && (
          <p className="card-inner p-3 text-xs text-muted-foreground">
            No navegador mostramos uma lista curta dos apps mais comuns. No app Android a lista traz tudo o que está instalado.
          </p>
        )}
        <label className="relative block">
          <span className="sr-only">Procurar app</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar app"
            className={`pl-9 ${field}`}
          />
        </label>
        {list === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Lendo os apps do celular…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum app com esse nome.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y overflow-y-auto">
            {shown.map((a) => {
              const on = selected.some((s) => s.pkg === a.pkg);
              return (
                <li key={a.pkg}>
                  <button
                    type="button"
                    onClick={() => onToggle({ pkg: a.pkg, label: a.label })}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-muted"
                  >
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-md ${on ? "bg-primary text-white" : "ring-1 ring-border"}`}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.pkg}</span>
                    </span>
                    {a.suggested && <Coins className="size-4 shrink-0 text-amber-500" aria-label="Sugestão" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={onClose} className="w-full rounded-full bg-primary py-2.5 font-bold text-white">
          Pronto
        </button>
        <p className="text-xs text-muted-foreground">Não esqueça de salvar depois de fechar.</p>
      </div>
    </Modal>
  );
}

function LogCard({ initial }: { initial: Discipline }) {
  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  return (
    <section className="card-soft space-y-3 p-5">
      <h2 className="font-bold">Seu uso</h2>
      {initial.today.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum token gasto hoje. Bom sinal.</p>
      ) : (
        <ul className="divide-y text-sm">
          {initial.today.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">
                {fmt(s.at)} · {s.minutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
      {initial.week.length > 0 && (
        <div className="card-inner space-y-1 p-3 text-xs">
          <p className="font-semibold">Últimos 7 dias</p>
          {initial.week.map((w) => (
            <p key={w.day} className="flex justify-between text-muted-foreground">
              <span>{w.day.slice(8)}/{w.day.slice(5, 7)}</span>
              <span>
                {w.spent} {w.spent === 1 ? "token" : "tokens"} · {w.minutes} min
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
