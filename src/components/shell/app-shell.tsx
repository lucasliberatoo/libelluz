"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Home,
  Menu,
  Moon,
  Sun,
  Users,
  Flame,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand";
import { fmtClock, useFocus } from "@/components/focus/focus-provider";
import { user } from "@/lib/mock";

const DESKTOP_NAV = [
  { href: "/", label: "Início" },
  { href: "/aulas", label: "Aulas" },
  { href: "/questoes", label: "Questões/Simulados" },
  { href: "/redacoes", label: "Redações" },
  { href: "/cronograma", label: "Cronograma" },
  { href: "/mapa", label: "Mapa" },
  { href: "/grupos", label: "Grupos" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      aria-label="Alternar tema"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("grid size-9 place-items-center rounded-full hover:bg-accent", className)}
    >
      {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </button>
  );
}

function StreakBadge({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold", className)}>
      <Flame className="size-4 fill-current text-streak" />
      {user.streak}
    </span>
  );
}

function FocusPill() {
  const { session, elapsedMs } = useFocus();
  if (!session) return null;
  return (
    <Link
      href="/foco"
      className="flex items-center gap-1.5 rounded-full bg-focus px-3 py-1 text-sm font-semibold tabular-nums text-focus-foreground shadow"
    >
      <Timer className="size-4" />
      {fmtClock(elapsedMs)}
      {session.pausedAt && <span className="text-xs opacity-80">pausado</span>}
    </Link>
  );
}

function TopNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden px-6 pt-4 md:block">
      <nav className="card-soft mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
        <Link href="/" className="mr-4">
          <Wordmark />
        </Link>
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {DESKTOP_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                isActive(path, n.href) && "bg-accent text-accent-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>
        <FocusPill />
        <StreakBadge className="bg-orange-500/10" />
        <ThemeToggle />
        <button aria-label="Notificações" className="grid size-9 place-items-center rounded-full hover:bg-accent">
          <Bell className="size-5" />
        </button>
      </nav>
    </header>
  );
}

function MobileHeader() {
  return (
    <header className="relative z-30 bg-header px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-white md:hidden">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-white/20 text-sm font-bold">L</div>
        <p className="flex-1 font-semibold">Olá, {user.name}!</p>
        <StreakBadge className="bg-white/15" />
        <ThemeToggle className="hover:bg-white/15" />
        <button aria-label="Notificações" className="grid size-9 place-items-center rounded-full hover:bg-white/15">
          <Bell className="size-5" />
        </button>
      </div>
    </header>
  );
}

function FocusButton() {
  const { session, elapsedMs } = useFocus();
  const target = session && session.method !== "Livre" ? session.minutes * 60_000 : 50 * 60_000;
  const pct = session ? Math.min(1, elapsedMs / target) : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <Link href="/foco" aria-label="Modo Foco" className="relative -mt-8 grid size-[68px] place-items-center">
      <span className="absolute inset-0 rounded-full bg-card shadow-lg ring-4 ring-background" />
      {session ? (
        <>
          <svg viewBox="0 0 68 68" className="absolute inset-0 -rotate-90">
            <circle cx="34" cy="34" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
            <circle
              cx="34"
              cy="34"
              r={r}
              fill="none"
              stroke="var(--focus)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
            />
          </svg>
          <span className="relative text-[13px] font-bold tabular-nums">{fmtClock(elapsedMs)}</span>
        </>
      ) : (
        <span className="relative grid size-[52px] place-items-center rounded-full bg-gradient-to-b from-red-400 to-red-600 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-inner">
          Foco
        </span>
      )}
    </Link>
  );
}

function BottomNav() {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
        isActive(path, href) && "text-primary",
      )}
    >
      <Icon className="size-6" />
      {label}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        {item("/", "Início", Home)}
        {item("/aulas", "Aulas", BookOpen)}
        <div className="flex flex-1 justify-center">
          <FocusButton />
        </div>
        {item("/grupos", "Grupos", Users)}
        {item("/mais", "Mais", Menu)}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <TopNav />
      <MobileHeader />
      <main className="relative z-30 mx-auto -mt-7 max-w-6xl px-4 pb-28 md:mt-0 md:px-6 md:pb-10 md:pt-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
