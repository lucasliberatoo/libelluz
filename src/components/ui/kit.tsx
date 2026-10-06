"use client";

import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Peças pequenas usadas no banco de questões e nos materiais. */

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border-2 px-3.5 py-1 text-sm font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-card text-primary hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function Select({
  value,
  onChange,
  label,
  disabled,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("relative min-w-0 flex-1 md:max-w-60", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-xl border bg-background pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Portal no body: fica acima da barra inferior do celular (fora do contexto de empilhamento da página).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="card-soft max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-b-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <button aria-label="Fechar" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const field = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
