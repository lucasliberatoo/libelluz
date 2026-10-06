import Image from "next/image";
import { cn } from "@/lib/utils";

/** Ícone de conquista: emoji ("🔥") ou arquivo em /img ("emoji/trofeu.webp"). */
export function AchIcon({ icon, size = 40, className }: { icon: string; size?: number; className?: string }) {
  if (icon.includes(".")) {
    return (
      <Image
        src={`/img/${icon}`}
        alt=""
        width={size * 2}
        height={size * 2}
        style={{ width: size, height: size }}
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center leading-none", className)} style={{ width: size, height: size, fontSize: size * 0.8 }}>
      {icon}
    </span>
  );
}

/** Fileira de estrelas (cheias até `filled`). */
export function Stars({ filled, total, className }: { filled: number; total: number; className?: string }) {
  if (total <= 1) return null;
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${filled} de ${total} estrelas`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "text-amber-400 drop-shadow-[0_1px_0_rgb(180_83_9/0.5)]" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </span>
  );
}
