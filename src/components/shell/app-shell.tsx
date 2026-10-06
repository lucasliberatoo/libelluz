"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useSyncExternalStore } from "react";
import {
  Bell,
  BookOpen,
  Home,
  Menu,
  Moon,
  Sun,
  Users,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon3D, Wordmark } from "@/components/brand";
import { fmtClock, useFocus } from "@/components/focus/focus-provider";

export type ShellUser = { name: string; image: string | null; streak: number; xp: number };
const UserCtx = createContext<ShellUser>({ name: "", image: null, streak: 0, xp: 0 });
const useShellUser = () => useContext(UserCtx);
const noop = () => () => {};

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
  const mounted = useSyncExternalStore(noop, () => true, () => false);
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
  const { streak } = useShellUser();
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold", className)}>
      <Icon3D name="fogo.png" size={18} />
      {streak}
    </span>
  );
}

function CoinBadge({ className }: { className?: string }) {
  const { xp } = useShellUser();
  return (
    <span title="Suas moedas de XP" className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums", className)}>
      <Icon3D name="moeda-xp.png" size={18} />
      {xp.toLocaleString("pt-BR")}
    </span>
  );
}

function Avatar({ className }: { className?: string }) {
  const { name, image } = useShellUser();
  return (
    <Link href="/perfil" aria-label="Perfil" className={cn("grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-200 text-sm font-bold text-violet-700", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        (name[0] ?? "?").toUpperCase()
      )}
    </Link>
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
    <header className="sticky top-0 z-40 hidden px-3 pt-3 md:block lg:px-4">
      <nav className="card-soft mx-auto flex max-w-[1440px] items-center gap-1 px-4 py-2">
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
        <CoinBadge className="bg-amber-500/10" />
        <StreakBadge className="bg-orange-500/10" />
        <ThemeToggle />
        <button aria-label="Notificações" className="grid size-9 place-items-center rounded-full hover:bg-accent">
          <Bell className="size-5" />
        </button>
        <Avatar className="ml-1" />
      </nav>
    </header>
  );
}

function MobileHeader() {
  const user = useShellUser();
  return (
    <header className="relative z-30 bg-header px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-white md:hidden">
      <div className="flex items-center gap-3">
        <Avatar className="bg-white/20 text-white" />
        <p className="flex-1 font-semibold">Olá, {user.name}!</p>
        <CoinBadge className="bg-white/15" />
        <StreakBadge className="bg-white/15" />
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

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <UserCtx.Provider value={user}>
    <div className="min-h-dvh">
      <TopNav />
      <MobileHeader />
      <main className="relative z-30 mx-auto -mt-7 max-w-[1440px] px-3 pb-28 md:mt-0 md:px-3 md:pb-10 md:pt-4 lg:px-4">
        {children}
      </main>
      <BottomNav />
    </div>
    </UserCtx.Provider>
  );
}
