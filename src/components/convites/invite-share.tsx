"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

const message = (link: string, code: string) =>
  `🔥 Bora estudar pro ENEM comigo no Libelluz! Tem foguinho, XP, sequência e ranking com a galera.\n\nCrie sua conta por este link (o convite já vem preenchido): ${link}\n\nCódigo: ${code}`;

export function InviteShare({ code, compact }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}/cadastro?convite=${code}`;

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message(link(), code))}`, "_blank", "noopener");
  };
  const copy = async () => {
    await navigator.clipboard.writeText(link());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "Convite pro Libelluz", text: message(link(), code) }).catch(() => {});
    else await copy();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={whatsapp} className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95">
        <WhatsIcon /> {compact ? "WhatsApp" : "Enviar no WhatsApp"}
      </button>
      <button onClick={copy} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted">
        {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />} {copied ? "Copiado" : "Copiar link"}
      </button>
      <button onClick={share} aria-label="Compartilhar" className="grid size-7 place-items-center rounded-full ring-1 ring-border hover:bg-muted">
        <Share2 className="size-3.5" />
      </button>
    </div>
  );
}

function WhatsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .8 2.7.9 3.7.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.3-.6-.4ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.4-1.7A11.8 11.8 0 0 0 12 23.7a11.8 11.8 0 0 0 8.4-20.1Z" />
    </svg>
  );
}
