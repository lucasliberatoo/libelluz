"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { setAvatar } from "@/server/profile-actions";

/** Recorta no centro (quadrado) e reduz para 256px em JPEG. */
async function squareJpeg(file: File, size = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

export function AvatarEditor({ name, image, hasPhoto }: { name: string; image: string | null; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = preview ?? image;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    try {
      const url = await squareJpeg(f);
      setPreview(url);
      start(async () => {
        await setAvatar(url);
      });
    } catch {
      setErr("Não consegui ler essa imagem.");
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label="Trocar foto de perfil"
        className="group relative grid size-28 place-items-center overflow-hidden rounded-full bg-violet-200 text-4xl font-bold text-violet-700 ring-4 ring-white shadow-lg dark:ring-card"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          (name[0] ?? "?").toUpperCase()
        )}
        <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-1 text-white opacity-90 transition group-hover:opacity-100">
          <Camera className="size-4" />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" onClick={() => input.current?.click()} className="font-semibold text-primary">
          {pending ? "Salvando…" : shown ? "Trocar foto" : "Pôr foto"}
        </button>
        {(hasPhoto || preview) && !pending && (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              start(async () => {
                await setAvatar(null);
              });
            }}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <Trash2 className="size-3" /> Remover
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
