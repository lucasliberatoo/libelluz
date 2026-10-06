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

type Mood = "happy" | "sleepy" | "sad";

const STAGE_ART = [
  { src: "/img/foguinho-faisca.png", w: 310, h: 296 },
  { src: "/img/foguinho-chama.png", w: 377, h: 365 },
  { src: "/img/foguinho-labareda.png", w: 103, h: 137 },
  // Fogo-fátuo ainda sem arte: usa a azul com matiz esverdeado.
  { src: "/img/foguinho-azul.png", w: 365, h: 428, filter: "hue-rotate(-40deg) saturate(0.8) brightness(1.15)" },
  { src: "/img/foguinho-azul.png", w: 365, h: 428 },
] as const;

/** Foguinho — arte enviada pelo Lucas, uma por estágio. */
export function Foguinho({
  stage = 2,
  mood = "happy",
  className,
}: {
  stage?: number;
  mood?: Mood;
  /** Mantido por compatibilidade: a arte da Labareda já vem de óculos. */
  glasses?: boolean;
  className?: string;
}) {
  const a = STAGE_ART[Math.min(Math.max(stage, 0), 4)];
  const moodFilter = mood === "sad" ? "grayscale(0.7) brightness(0.85)" : mood === "sleepy" ? "saturate(0.6) brightness(0.95)" : "";
  return (
    <Image
      src={a.src}
      alt="Foguinho"
      width={a.w}
      height={a.h}
      className={cn("size-20 object-contain", className)}
      style={{ filter: [("filter" in a ? a.filter : ""), moodFilter].join(" ").trim() || undefined }}
    />
  );
}

/** Ícone 3D (imagens em public/img). */
export function Icon3D({ name, size = 28, className, alt = "" }: { name: string; size?: number; className?: string; alt?: string }) {
  return <Image src={`/img/${name}`} alt={alt} width={size * 2} height={size * 2} style={{ width: size, height: size }} className={cn("shrink-0 object-contain", className)} />;
}
