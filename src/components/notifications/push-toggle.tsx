"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { disablePush, enablePush, pushState, type PushState } from "./push-client";

const TEXT: Record<PushState, string> = {
  on: "Ativadas neste aparelho. O foguinho te avisa mesmo com o app fechado.",
  off: "Desativadas neste aparelho. Você só vê os avisos no sino.",
  denied: "O navegador bloqueou as notificações. Libere nas configurações do site (ícone de cadeado) e tente de novo.",
  unsupported: "Este navegador não suporta notificações. No iPhone, instale o app na tela de início primeiro.",
  native: "No app Android, os lembretes do dia ficam agendados no próprio celular.",
  nokey: "As notificações ainda não foram configuradas no servidor.",
};

/** Botão "Ativar notificações" (pede permissão e assina o push deste aparelho). */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState("unsupported"));
  }, []);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    try {
      setState(await fn());
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  const Icon = state === "native" ? Smartphone : state === "on" ? BellRing : BellOff;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-3">
      <span className="grid size-10 place-items-center rounded-full bg-card text-primary">
        <Icon className="size-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm" aria-live="polite">
        {state ? TEXT[state] : "Verificando…"}
      </p>
      {(state === "off" || state === "native") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(enablePush)}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Ativando…" : state === "native" ? "Permitir lembretes" : "Ativar notificações"}
        </button>
      )}
      {state === "on" && (
        <button type="button" disabled={busy} onClick={() => run(disablePush)} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border disabled:opacity-60">
          Desativar
        </button>
      )}
    </div>
  );
}
