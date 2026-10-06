import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo: cairn de pedrinhas empilhadas (arte do Figma). */
export function CairnLogo({ className }: { className?: string }) {
  return <Image src="/img/cairn.png" alt="" width={77} height={77} className={cn("size-7 object-contain", className)} aria-hidden />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 font-bold tracking-tight text-primary", className)}>
      <CairnLogo />
      <span className="text-lg">Libelluz</span>
    </span>
  );
}

export const FLAME_STAGES = [
  { name: "Faísca", from: "#ff8a3d", to: "#e8331f" },
  { name: "Chama", from: "#ffe14d", to: "#ff9f1a" },
  { name: "Labareda", from: "#f08cff", to: "#a23cf0" },
  { name: "Fogo-fátuo", from: "#8ff5e6", to: "#2cc4c9" },
  { name: "Chama Azul", from: "#7cc0ff", to: "#2f5bff" },
] as const;

export type FoguinhoMood = "happy" | "calm" | "sleepy" | "sad";
export type FoguinhoAccessory = "oculos" | "bone" | "fone" | "coroa" | "cachecol";

/** Ponto de apoio (em % da arte): centro x/y e largura. */
type Anchor = { x: number; y: number; w: number };

type Art = {
  src: string;
  w: number;
  h: number;
  /** tamanho da chama dentro da caixa (cresce a cada estágio) */
  scale: number;
  filter?: string;
  /** olhos (óculos, fone), topo da cabeça (boné, coroa), pescoço (cachecol), olho esquerdo (lágrima) */
  eyes: Anchor;
  top: Anchor;
  neck: Anchor;
  tear: { x: number; y: number };
};

// Arte enviada pelo Lucas. A Labareda usa a Faísca em magenta (a PNG original já vinha de óculos,
// e os óculos agora são um acessório); o Fogo-fátuo é a azul puxada para o verde-água.
const STAGE_ART: Art[] = [
  {
    src: "/img/foguinho-faisca.png",
    w: 310,
    h: 296,
    scale: 0.74,
    eyes: { x: 56, y: 44, w: 44 },
    top: { x: 57, y: 24, w: 46 },
    neck: { x: 57, y: 71, w: 50 },
    tear: { x: 45, y: 54 },
  },
  {
    src: "/img/foguinho-chama.png",
    w: 377,
    h: 365,
    scale: 0.82,
    eyes: { x: 50, y: 47, w: 56 },
    top: { x: 46, y: 14, w: 56 },
    neck: { x: 50, y: 76, w: 60 },
    tear: { x: 36, y: 60 },
  },
  {
    src: "/img/foguinho-faisca.png",
    w: 310,
    h: 296,
    scale: 0.88,
    filter: "hue-rotate(-70deg) saturate(1.1) brightness(1.05)",
    eyes: { x: 56, y: 44, w: 44 },
    top: { x: 57, y: 24, w: 46 },
    neck: { x: 57, y: 71, w: 50 },
    tear: { x: 45, y: 54 },
  },
  {
    src: "/img/foguinho-azul.png",
    w: 365,
    h: 428,
    scale: 0.94,
    filter: "hue-rotate(-40deg) saturate(0.85) brightness(1.18)",
    eyes: { x: 48, y: 45, w: 52 },
    top: { x: 48, y: 15, w: 56 },
    neck: { x: 47, y: 71, w: 58 },
    tear: { x: 36, y: 52 },
  },
  {
    src: "/img/foguinho-azul.png",
    w: 365,
    h: 428,
    scale: 1,
    eyes: { x: 48, y: 45, w: 52 },
    top: { x: 48, y: 15, w: 56 },
    neck: { x: 47, y: 71, w: 58 },
    tear: { x: 36, y: 52 },
  },
];

const clampStage = (s: number) => Math.min(Math.max(Math.round(s) || 0, 0), 4);

/**
 * Foguinho — um por estágio (cor, tamanho e brilho crescem), com humor e acessório.
 * `className` dimensiona a caixa (ex.: `size-20`); a chama fica centrada e proporcional dentro dela.
 */
export function Foguinho({
  stage = 2,
  mood = "happy",
  accessory,
  glasses,
  fx = true,
  className,
}: {
  stage?: number;
  mood?: FoguinhoMood;
  accessory?: FoguinhoAccessory | null;
  /** Atalho antigo para `accessory="oculos"`. */
  glasses?: boolean;
  /** brilho e partículas (desligue em silhuetas) */
  fx?: boolean;
  className?: string;
}) {
  const st = clampStage(stage);
  const a = STAGE_ART[st];
  const c = FLAME_STAGES[st];
  const acc = accessory ?? (glasses ? "oculos" : null);
  const ratio = a.w / a.h;
  const width = (ratio >= 1 ? 1 : ratio) * a.scale * 100;
  const moodFilter = mood === "sad" ? "grayscale(0.75) brightness(0.82)" : mood === "sleepy" ? "saturate(0.55) brightness(0.93)" : "";
  const dim = mood === "sad" || mood === "sleepy";

  return (
    <span className={cn("relative inline-grid size-20 shrink-0 place-items-center", className)} role="img" aria-label={`Foguinho ${c.name}`}>
      {fx && (
        // aura: maior e mais forte a cada estágio, some quando ele está apagando
        <span
          aria-hidden
          className="absolute inset-[6%] rounded-full blur-xl transition-opacity"
          style={{
            background: `radial-gradient(circle at 50% 58%, ${c.from} 0%, ${c.to}88 38%, transparent 70%)`,
            opacity: (dim ? 0.12 : 0.22) + st * (dim ? 0.04 : 0.1),
            transform: `scale(${0.7 + st * 0.08})`,
          }}
        />
      )}
      {fx && !dim && <Particles stage={st} />}
      <span className="relative block" style={{ width: `${width}%`, aspectRatio: `${a.w} / ${a.h}` }}>
        <Image
          src={a.src}
          alt=""
          width={a.w}
          height={a.h}
          draggable={false}
          className="block size-full select-none object-contain"
          style={{ filter: [a.filter ?? "", moodFilter].join(" ").trim() || undefined }}
        />
        {acc && <AccessoryArt id={acc} art={a} />}
        {mood === "sad" && <Tear at={a.tear} />}
      </span>
      {mood === "sleepy" && <Zzz />}
      {mood === "sad" && fx && <Smoke />}
      {mood === "happy" && fx && <Sparkles color={c.from} />}
    </span>
  );
}

/* ---------- Efeitos ---------- */

function Particles({ stage }: { stage: number }) {
  const c = FLAME_STAGES[stage];
  const n = 2 + stage * 2;
  // posições fixas (sem aleatoriedade no render)
  const xs = [30, 70, 18, 82, 42, 60, 24, 76, 50, 36];
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      {Array.from({ length: n }, (_, i) => {
        const x = xs[i % xs.length];
        const dur = 2.2 + (i % 4) * 0.5;
        const r = stage >= 3 ? 1.6 + (i % 3) * 0.5 : 1.2 + (i % 2) * 0.6;
        return (
          <circle key={i} cx={x} cy={78} r={r} fill={i % 2 ? c.from : c.to} opacity="0">
            <animate attributeName="cy" values="80;18" dur={`${dur}s`} begin={`${(i * 0.37) % dur}s`} repeatCount="indefinite" />
            <animate attributeName="cx" values={`${x};${x + (i % 2 ? 5 : -5)};${x}`} dur={`${dur}s`} begin={`${(i * 0.37) % dur}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0" dur={`${dur}s`} begin={`${(i * 0.37) % dur}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
      {stage === 4 &&
        [
          [14, 22],
          [86, 30],
          [80, 10],
        ].map(([x, y], i) => (
          <path key={`s${i}`} d={`M${x} ${y - 4} L${x + 1} ${y - 1} L${x + 4} ${y} L${x + 1} ${y + 1} L${x} ${y + 4} L${x - 1} ${y + 1} L${x - 4} ${y} L${x - 1} ${y - 1} Z`} fill="#dbeafe">
            <animate attributeName="opacity" values="0.2;1;0.2" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" />
          </path>
        ))}
    </svg>
  );
}

function Sparkles({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      {[
        [10, 40, 0],
        [90, 50, 0.6],
        [84, 14, 1.1],
      ].map(([x, y, b], i) => (
        <path key={i} d={`M${x} ${y - 5} Q${x} ${y} ${x + 5} ${y} Q${x} ${y} ${x} ${y + 5} Q${x} ${y} ${x - 5} ${y} Q${x} ${y} ${x} ${y - 5} Z`} fill={i === 1 ? color : "#ffd84d"} opacity="0">
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin={`${b}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Zzz() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      {[0, 1, 2].map((i) => (
        <text key={i} x={70 + i * 8} y={30 - i * 9} fontSize={9 + i * 3} fontWeight="800" fill="#7c8db5" opacity="0">
          z
          <animate attributeName="opacity" values="0;1;0" dur="3s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
        </text>
      ))}
    </svg>
  );
}

function Smoke() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      {[0, 1].map((i) => (
        <path key={i} d="M50 14 C44 8 56 4 50 -4" fill="none" stroke="#9aa3b2" strokeWidth="3" strokeLinecap="round" opacity="0">
          <animate attributeName="opacity" values="0;0.7;0" dur="3s" begin={`${i * 1.5}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" values="0 6;0 -6" dur="3s" begin={`${i * 1.5}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

function Tear({ at }: { at: { x: number; y: number } }) {
  return (
    <svg aria-hidden viewBox="0 0 10 14" className="absolute w-[9%]" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <path d="M5 0 C5 0 0 7 0 9.5 A5 5 0 0 0 10 9.5 C10 7 5 0 5 0 Z" fill="#7cc4ff" stroke="#3b82f6" strokeWidth="0.8">
        <animateTransform attributeName="transform" type="translate" values="0 0;0 3;0 0" dur="2.4s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/* ---------- Acessórios (SVG por cima da arte) ---------- */

function place(an: Anchor, k: number, mode: "center" | "bottom", dy = 0): React.CSSProperties {
  return {
    left: `${an.x}%`,
    top: `${an.y + dy}%`,
    width: `${an.w * k}%`,
    transform: mode === "center" ? "translate(-50%, -50%)" : "translate(-50%, -100%)",
  };
}

function AccessoryArt({ id, art }: { id: FoguinhoAccessory; art: Art }) {
  const cls = "pointer-events-none absolute overflow-visible drop-shadow-sm";
  switch (id) {
    case "oculos":
      return (
        <svg aria-hidden viewBox="0 0 120 40" className={cls} style={place(art.eyes, 1.12, "center")}>
          <path d="M2 9 Q60 2 118 9" fill="none" stroke="#0f1220" strokeWidth="5" strokeLinecap="round" />
          <path d="M6 8 H53 V22 Q53 36 33 36 H24 Q6 36 6 22 Z" fill="#141826" />
          <path d="M67 8 H114 V22 Q114 36 96 36 H87 Q67 36 67 22 Z" fill="#141826" />
          <rect x="50" y="10" width="20" height="6" rx="3" fill="#141826" />
          <path d="M14 14 L28 14" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
          <path d="M75 14 L89 14" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "bone":
      return (
        <svg aria-hidden viewBox="0 0 130 64" className={cls} style={place(art.top, 1.3, "bottom", 7)}>
          <path d="M14 54 C12 18 40 4 64 4 C90 4 112 18 112 54 Z" fill="#3b5bdb" />
          <path d="M64 4 C58 18 56 36 58 54" fill="none" stroke="#2f49b5" strokeWidth="2.5" />
          <path d="M36 12 C38 24 40 40 40 54" fill="none" stroke="#2f49b5" strokeWidth="2" />
          <path d="M14 54 H112" stroke="#2a3f9e" strokeWidth="5" strokeLinecap="round" />
          <path d="M96 50 C108 48 124 52 128 60 C116 63 100 62 90 58 Z" fill="#2a3f9e" />
          <circle cx="64" cy="5" r="4.5" fill="#2a3f9e" />
          <circle cx="82" cy="32" r="8" fill="#fff" />
          <path d="M82 25 L84.5 30 L90 31 L86 35 L87 40 L82 37.5 L77 40 L78 35 L74 31 L79.5 30 Z" fill="#f59f00" />
        </svg>
      );
    case "coroa":
      return (
        <svg aria-hidden viewBox="0 0 100 62" className={cls} style={place(art.top, 0.95, "bottom", 4)}>
          <defs>
            <linearGradient id="fg-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe066" />
              <stop offset="1" stopColor="#f59f00" />
            </linearGradient>
          </defs>
          <path d="M8 54 L4 16 L28 34 L50 4 L72 34 L96 16 L92 54 Z" fill="url(#fg-gold)" stroke="#e67700" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="8" y="50" width="84" height="10" rx="3" fill="#f59f00" stroke="#e67700" strokeWidth="2" />
          <circle cx="50" cy="4" r="4" fill="#ff6b6b" />
          <circle cx="4" cy="16" r="3.5" fill="#4dabf7" />
          <circle cx="96" cy="16" r="3.5" fill="#4dabf7" />
          <circle cx="50" cy="38" r="5" fill="#e64980" />
          <circle cx="28" cy="44" r="3" fill="#4dabf7" />
          <circle cx="72" cy="44" r="3" fill="#4dabf7" />
        </svg>
      );
    case "fone":
      return (
        <svg aria-hidden viewBox="0 0 140 92" className={cls} style={place({ ...art.eyes, w: art.eyes.w * 1.75 }, 1, "bottom", 14)}>
          <path d="M20 70 C16 10 124 10 120 70" fill="none" stroke="#212529" strokeWidth="9" strokeLinecap="round" />
          <path d="M20 70 C16 10 124 10 120 70" fill="none" stroke="#495057" strokeWidth="3" strokeLinecap="round" />
          <rect x="4" y="52" width="26" height="38" rx="11" fill="#e8590c" />
          <rect x="110" y="52" width="26" height="38" rx="11" fill="#e8590c" />
          <rect x="22" y="58" width="9" height="26" rx="4" fill="#212529" />
          <rect x="109" y="58" width="9" height="26" rx="4" fill="#212529" />
        </svg>
      );
    case "cachecol":
      return (
        <svg aria-hidden viewBox="0 0 120 64" className={cls} style={place(art.neck, 1.15, "center", 6)}>
          <path d="M4 14 C40 30 80 30 116 14 L114 32 C80 48 40 48 6 32 Z" fill="#e03131" />
          <path d="M20 22 L22 40 M40 27 L41 45 M60 28 L60 46 M80 27 L79 45 M100 22 L98 40" stroke="#fff" strokeOpacity=".75" strokeWidth="4" />
          <path d="M74 34 L68 62 L86 62 L90 34 Z" fill="#c92a2a" />
          <path d="M70 50 L88 50" stroke="#fff" strokeOpacity=".75" strokeWidth="4" />
          <path d="M68 62 l2 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l2 -4 l1 4" fill="none" stroke="#c92a2a" strokeWidth="2" />
        </svg>
      );
  }
}

/** Ícone 3D (imagens em public/img). */
export function Icon3D({ name, size = 28, className, alt = "" }: { name: string; size?: number; className?: string; alt?: string }) {
  return <Image src={`/img/${name}`} alt={alt} width={size * 2} height={size * 2} style={{ width: size, height: size }} className={cn("shrink-0 object-contain", className)} />;
}
