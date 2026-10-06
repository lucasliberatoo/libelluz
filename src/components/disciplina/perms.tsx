"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, RefreshCw } from "lucide-react";
import { appBlocker, PERM_LABELS, PERM_ORDER, type AppBlockerInfo, type PermKey } from "./bridge";

/**
 * Permissões do Modo Disciplina. Nenhuma delas é um diálogo comum do Android: cada uma mora numa
 * tela das Configurações. Por isso pedimos uma a uma, com a explicação do porquê, e mostramos o
 * estado de cada uma. Ao voltar das Configurações o estado é relido sozinho.
 */
export function PermsCard({ onInfo }: { onInfo: (info: AppBlockerInfo | null) => void }) {
  const [info, setInfo] = useState<AppBlockerInfo | null>(null);
  const [asking, setAsking] = useState<PermKey | null>(null);
  const [tick, setTick] = useState(0);

  // Lê o estado das permissões: na montagem, ao voltar das Configurações e no botão de atualizar.
  useEffect(() => {
    const plugin = appBlocker();
    if (!plugin) return;
    let alive = true;
    const read = () =>
      plugin.getInfo().then(
        (next) => {
          if (!alive) return;
          setInfo(next);
          onInfo(next);
        },
        () => {
          if (!alive) return;
          setInfo(null);
          onInfo(null);
        },
      );
    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onInfo, tick]);

  const ask = (which: PermKey) => {
    const plugin = appBlocker();
    if (!plugin) return;
    setAsking(which);
    plugin
      .openSettings({ which })
      .catch(() => {
        // A tela pode não existir no aparelho; o estado continua visível abaixo.
      })
      .finally(() => setAsking(null));
  };

  const perms = info?.perms;
  const missing = PERM_ORDER.filter((k) => PERM_LABELS[k].required && !perms?.[k]);
  // Uma por vez: só a primeira pendente obrigatória aparece em destaque.
  const next = missing[0] ?? PERM_ORDER.find((k) => !perms?.[k]);

  return (
    <section className="card-soft space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-bold">Permissões</h2>
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          aria-label="Verificar permissões de novo"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {missing.length === 0
          ? "Tudo pronto: o bloqueio pode funcionar."
          : "Falta liberar o essencial. Toque em uma por vez — o Android abre a tela de Configurações certa."}
      </p>
      <ul className="divide-y">
        {PERM_ORDER.map((key) => {
          const { title, why, required } = PERM_LABELS[key];
          const ok = !!perms?.[key];
          const highlight = !ok && key === next;
          return (
            <li key={key} className="flex items-start gap-3 py-3">
              <span
                aria-hidden
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                  ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                {ok ? <Check className="size-4" /> : <span className="text-xs font-bold">!</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {title}
                  {!required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{why}</p>
                <p className={`mt-1 text-xs font-semibold ${ok ? "text-success" : "text-muted-foreground"}`}>
                  {ok ? "Liberada" : "Ainda não liberada"}
                </p>
              </div>
              {!ok && (
                <button
                  type="button"
                  disabled={asking === key}
                  onClick={() => ask(key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                    highlight ? "bg-primary text-white" : "ring-1 ring-border"
                  }`}
                >
                  Permitir
                  <ChevronRight className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {info && !info.canBlock && (
        <p className="text-xs text-muted-foreground">
          Sem o acesso ao uso e a sobreposição, o Modo Disciplina fica só com a contagem de tokens aqui no app.
        </p>
      )}
    </section>
  );
}
