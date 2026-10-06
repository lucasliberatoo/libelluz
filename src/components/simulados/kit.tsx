"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { COMPETENCY_STEPS } from "@/lib/exams";
import { cn } from "@/lib/utils";

/** Seletor Questões | Simulados (mesmo visual nas duas páginas). */
export function SectionTabs({ active }: { active: "questoes" | "simulados" }) {
  const tabs = [
    { key: "questoes", href: "/questoes", label: "Questões" },
    { key: "simulados", href: "/simulados", label: "Simulados" },
  ] as const;
  return (
    <nav className="flex gap-2" aria-label="Questões e Simulados">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "rounded-full border-2 px-4 py-1 text-sm font-semibold transition-colors",
            t.key === active ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary hover:bg-accent",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // Portal: o <main> do app cria um contexto de empilhamento abaixo da barra inferior.
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={cn(
          "card-soft max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex-1 text-lg font-bold">{title}</h3>
          <button aria-label="Fechar" onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const inputCls =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60";

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cn("rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/85 disabled:opacity-60", className)} />;
}

export function GhostButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cn("rounded-full border-2 border-primary/60 px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-accent disabled:opacity-60", className)} />;
}

/** "+50 XP" flutuante depois de salvar. */
export function useXpToast() {
  const [toast, setToast] = useState<{ xp: number; text: string; k: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div key={toast.k} role="status" data-xp-toast className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
      <div className="card-soft flex items-center gap-2 px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-4">
        <Icon3D name="moeda-xp.png" size={26} />
        <span className="text-lg font-bold text-xp">+{toast.xp} XP</span>
        <span className="max-w-56 truncate text-sm text-muted-foreground">{toast.text}</span>
      </div>
    </div>
  ) : null;
  return { show: (xp: number, text: string) => xp > 0 && setToast({ xp, text, k: Date.now() }), node };
}

export const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };
export const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
export const fmtShortDay = (d: string) => d.slice(5).split("-").reverse().join("/");
export const fmtLongDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** C1–C5 (0–200, de 40 em 40). */
export function CompetencyPicker({ comps, onChange }: { comps: (number | null)[]; onChange: (c: (number | null)[]) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {comps.map((c, i) => (
        <label key={i} className="block text-center">
          <span className="text-[11px] font-semibold text-muted-foreground">C{i + 1}</span>
          <select
            value={c ?? ""}
            onChange={(e) => onChange(comps.map((x, j) => (j === i ? (e.target.value === "" ? null : Number(e.target.value)) : x)))}
            className={cn(inputCls, "appearance-none px-1 text-center")}
          >
            <option value="">–</option>
            {COMPETENCY_STEPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
