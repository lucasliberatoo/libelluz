import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { AchIcon } from "@/components/celebrate/ach-icon";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { getJourneyTab, type JourneyTabData } from "@/server/dashboard-tabs";

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Pedrinhas do cairn: de baixo (maior) para cima (menor). */
const STONES = [
  { cx: 50, cy: 88, rx: 34, ry: 10, fill: "#7c8aa5" },
  { cx: 48, cy: 70, rx: 27, ry: 9, fill: "#94a3b8" },
  { cx: 52, cy: 54, rx: 21, ry: 8, fill: "#a5b4cb" },
  { cx: 49, cy: 40, rx: 15, ry: 7, fill: "#b8c4d8" },
  { cx: 51, cy: 28, rx: 10, ry: 6, fill: "#cbd5e1" },
];

/** Cairn que cresce com o domínio da fase: 1 pedra na base, até 5 com 100%. */
function Cairn({ pct, done, size }: { pct: number; done: boolean; size: number }) {
  const n = 1 + Math.round((pct / 100) * (STONES.length - 1));
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="overflow-visible drop-shadow-sm">
      <ellipse cx="50" cy="97" rx="40" ry="4" className="fill-foreground/10" />
      {STONES.map((s, i) =>
        i < n ? (
          <g key={i}>
            <ellipse {...s} fill={done ? ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"][i] : s.fill} />
            <ellipse cx={s.cx - s.rx * 0.3} cy={s.cy - s.ry * 0.35} rx={s.rx * 0.45} ry={s.ry * 0.3} fill="white" opacity={0.35} />
          </g>
        ) : (
          <ellipse key={i} {...s} fill="none" className="stroke-muted-foreground/30" strokeWidth={1.5} strokeDasharray="3 3" />
        ),
      )}
    </svg>
  );
}

type Item =
  | { kind: "start"; h: number; x: number }
  | { kind: "phase"; h: number; x: number; i: number }
  | { kind: "level"; h: number; x: number; level: number; title: string; reached: boolean }
  | { kind: "ach"; h: number; x: number; a: JourneyTabData["achievements"][number] }
  | { kind: "end"; h: number; x: number; reached: boolean };

// posições horizontais (%) em zigue-zague, estilo trilha
const WAVE = [50, 74, 50, 26];

function buildPath(d: JourneyTabData) {
  const items: Item[] = [{ kind: "start", h: 64, x: 50 }];
  // ordem cronológica (mais antigas primeiro) espalhada pelos trechos entre as fases
  const achs = [...d.achievements].reverse();
  const perGap = Math.ceil(achs.length / 4) || 0;
  d.phases.forEach((_, i) => {
    items.push({ kind: "phase", h: 156, x: WAVE[(i * 2 + 1) % 4], i });
    if (i < d.phases.length - 1) {
      const lv = LEVELS[(i + 1) * 3 - 1]; // níveis 3, 6, 9, 12
      items.push({ kind: "level", h: 64, x: WAVE[(i * 2 + 2) % 4], level: lv.level, title: lv.title, reached: d.level.level >= lv.level });
      for (const a of achs.slice(i * perGap, (i + 1) * perGap).slice(0, 2)) items.push({ kind: "ach", h: 52, x: 50 + (WAVE[(i * 2 + 2) % 4] - 50) * 0.4, a });
    }
  });
  items.push({ kind: "end", h: 120, x: 50, reached: d.level.isMax });
  let y = 0;
  const pos = items.map((it) => {
    const cy = y + it.h / 2;
    y += it.h;
    return { it, cy };
  });
  return { pos, height: y };
}

export async function JourneyTab({ userId }: { userId: string }) {
  const d = await getJourneyTab(userId);
  const { pos, height } = buildPath(d);
  const current = d.phases.findIndex((p) => !(p.total > 0 && p.mastered >= p.total));
  const totalUnits = d.phases.reduce((s, p) => s + p.total, 0);
  const totalMastered = d.phases.reduce((s, p) => s + p.mastered, 0);
  const lvPct = d.level.isMax ? 100 : pctOf(d.level.intoLevel, d.level.levelSpan);
  // curva suave entre os pontos (coordenadas: x em %, y em px)
  const pts = pos.map((p) => [p.it.x, p.cy] as const);
  const path = pts
    .map(([x, y], i) => {
      if (!i) return `M${x} ${y}`;
      const [px, py] = pts[i - 1];
      const my = (py + y) / 2;
      return `C${px} ${my} ${x} ${my} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="grid gap-3 md:grid-cols-12 md:gap-4">
      <section className="card-inner relative overflow-hidden px-2 py-4 md:col-span-7 lg:col-span-8">
        <div className="relative mx-auto max-w-md" style={{ height }}>
          <svg aria-hidden className="absolute inset-0 size-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            <path d={path} fill="none" className="stroke-primary/25" strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" className="stroke-card" strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {pos.map(({ it, cy }, k) => (
            <div key={k} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${it.x}%`, top: cy }}>
              <Node it={it} d={d} current={current} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid content-start gap-3 md:col-span-5 md:gap-4 lg:col-span-4">
        <section className="card-inner p-4">
          <p className="text-[11px] text-muted-foreground">Sua jornada</p>
          <p className="text-lg font-extrabold">
            Nível {d.level.level} · {d.level.title}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-xp" style={{ width: `${lvPct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {d.level.isMax ? "nível máximo!" : `${(d.level.levelSpan - d.level.intoLevel).toLocaleString("pt-BR")} XP para o próximo nível`}
          </p>
        </section>
        <section className="card-inner p-4">
          <p className="text-[11px] text-muted-foreground">Domínio no Mapa</p>
          <p className="text-3xl font-extrabold tabular-nums text-primary">{pctOf(totalMastered, totalUnits)}%</p>
          <ul className="mt-2 space-y-1.5">
            {d.phases.map((p) => (
              <li key={p.phase} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 truncate">{p.phase}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pctOf(p.mastered, p.total)}%` }} />
                </span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">{pctOf(p.mastered, p.total)}%</span>
              </li>
            ))}
          </ul>
          <Link href="/mapa" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Abrir o Mapa →
          </Link>
        </section>
      </div>
    </div>
  );
}

function Node({ it, d, current }: { it: Item; d: JourneyTabData; current: number }) {
  if (it.kind === "start")
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-border">
        <Icon3D name="emoji/foguete.webp" size={18} /> Começo
      </span>
    );
  if (it.kind === "level")
    return (
      <span
        title={`Nível ${it.level} · ${it.title}`}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold shadow-sm",
          it.reached ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white" : "bg-card text-muted-foreground ring-1 ring-border",
        )}
      >
        {it.reached ? <Icon3D name="moeda-xp.png" size={16} /> : <Lock className="size-3.5" />}
        Nível {it.level} · {it.title}
      </span>
    );
  if (it.kind === "ach")
    return (
      <Link
        href="/conquistas"
        title={it.a.name}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/40"
      >
        <AchIcon icon={it.a.icon} size={18} /> {it.a.name}
        {it.a.stars > 0 && <span className="text-amber-500">{"★".repeat(it.a.stars)}</span>}
      </Link>
    );
  if (it.kind === "end")
    return (
      <div className={cn("flex flex-col items-center text-center", !it.reached && "opacity-70")}>
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-b from-amber-200 to-amber-400 shadow-md ring-4 ring-card dark:from-amber-400/40 dark:to-amber-600/50">
          <Icon3D name="emoji/trofeu.webp" size={40} />
        </span>
        <span className="mt-1 whitespace-nowrap text-xs font-extrabold">ENEM · Lenda 160+</span>
      </div>
    );
  const p = d.phases[it.i];
  const pct = pctOf(p.mastered, p.total);
  const done = p.total > 0 && p.mastered >= p.total;
  const here = it.i === current;
  const locked = current >= 0 && it.i > current && pct === 0;
  return (
    <Link href="/mapa" className="group flex w-36 flex-col items-center text-center">
      <span className="relative">
        {here && <span className="absolute inset-2 animate-ping rounded-full bg-primary/20" />}
        <span
          className={cn(
            "relative grid place-items-center rounded-full bg-card shadow-md ring-4 transition group-hover:-translate-y-0.5",
            done ? "ring-amber-400" : here ? "ring-primary" : "ring-border",
            locked && "opacity-60",
          )}
          style={{ width: 80 + pct * 0.3, height: 80 + pct * 0.3 }}
        >
          <Cairn pct={pct} done={done} size={52 + pct * 0.3} />
          {done && (
            <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-amber-400 text-white shadow">
              <Check className="size-4" strokeWidth={3} />
            </span>
          )}
        </span>
        {here && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
            Você está aqui
          </span>
        )}
      </span>
      <span className="mt-1.5 text-sm font-extrabold leading-tight">{p.phase}</span>
      <span className="text-[11px] text-muted-foreground">
        {p.total ? `${pct}% de domínio · ${p.mastered}/${p.total}` : "sem habilidades"}
      </span>
    </Link>
  );
}
