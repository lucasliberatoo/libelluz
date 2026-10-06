import { cn } from "@/lib/utils";

/** Logo: cairn de pedrinhas empilhadas. */
export function CairnLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <ellipse cx="16" cy="26" rx="11" ry="4.2" fill="currentColor" opacity="0.95" />
      <ellipse cx="15" cy="18.6" rx="8" ry="3.6" fill="currentColor" opacity="0.8" />
      <ellipse cx="16.5" cy="12" rx="5.6" ry="3" fill="currentColor" opacity="0.65" />
      <ellipse cx="15.6" cy="6.6" rx="3.4" ry="2.2" fill="currentColor" opacity="0.5" />
    </svg>
  );
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

/** Foguinho — arte provisória e original (a final virá depois). */
export function Foguinho({
  stage = 2,
  mood = "happy",
  glasses = false,
  className,
}: {
  stage?: number;
  mood?: Mood;
  glasses?: boolean;
  className?: string;
}) {
  const s = FLAME_STAGES[Math.min(Math.max(stage, 0), 4)];
  const id = `fg-${stage}-${mood}`;
  const dim = mood === "sad" ? 0.55 : mood === "sleepy" ? 0.8 : 1;
  return (
    <svg viewBox="0 0 100 110" className={cn("size-20", className)} aria-label="Foguinho">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.from} />
          <stop offset="1" stopColor={s.to} />
        </linearGradient>
      </defs>
      <g opacity={dim}>
        {/* corpo da chama */}
        <path
          d="M50 6c6 14 22 20 26 38 2 9 0 12 0 12 8-4 9-14 9-14 8 12 9 26 4 38-6 15-21 24-39 24S17 95 11 80C5 66 8 52 16 42c0 0 1 9 7 12 0 0-4-12 4-24 6-9 18-12 23-24z"
          fill={`url(#${id})`}
        />
        <path d="M50 52c10 6 16 14 16 26 0 11-7 18-16 18s-16-7-16-18c0-12 6-20 16-26z" fill="#fff" opacity="0.18" />
      </g>
      {/* rosto */}
      {glasses ? (
        <g>
          <path d="M28 60h44" stroke="#1a1030" strokeWidth="3" strokeLinecap="round" />
          <rect x="29" y="58" width="18" height="11" rx="5" fill="#1a1030" />
          <rect x="53" y="58" width="18" height="11" rx="5" fill="#1a1030" />
          <path d="M32 61l5-1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </g>
      ) : mood === "sleepy" ? (
        <g stroke="#1a1030" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M34 64q5 3 10 0" />
          <path d="M56 64q5 3 10 0" />
        </g>
      ) : (
        <g fill="#1a1030">
          <ellipse cx="39" cy="63" rx="4.2" ry={mood === "sad" ? 3.5 : 5} />
          <ellipse cx="61" cy="63" rx="4.2" ry={mood === "sad" ? 3.5 : 5} />
          <circle cx="40.5" cy="61" r="1.4" fill="#fff" />
          <circle cx="62.5" cy="61" r="1.4" fill="#fff" />
        </g>
      )}
      {mood === "sad" ? (
        <path d="M43 81q7-5 14 0" stroke="#1a1030" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M42 76q8 7 16 0" stroke="#1a1030" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === "happy" && (
        <g fill="#ff5a8a" opacity="0.45">
          <ellipse cx="30" cy="72" rx="4" ry="2.5" />
          <ellipse cx="70" cy="72" rx="4" ry="2.5" />
        </g>
      )}
    </svg>
  );
}
