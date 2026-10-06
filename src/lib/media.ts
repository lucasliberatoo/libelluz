/** Utilidades de materiais (servem no cliente e no servidor). */

export const MATERIAL_KINDS = ["pdf", "book", "video", "audio", "image", "link", "other"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const KIND_LABEL: Record<MaterialKind, string> = {
  pdf: "PDF",
  book: "Livro / apostila",
  video: "Vídeo",
  audio: "Áudio",
  image: "Imagem",
  link: "Link",
  other: "Outro",
};

/** ID do vídeo em links do YouTube (watch, youtu.be, shorts, embed, live). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      if (!id && m) id = m[1];
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export function kindFromUrl(url: string): MaterialKind {
  if (youtubeId(url) || /vimeo\.com/.test(url)) return "video";
  if (/\.pdf($|[?#])/i.test(url)) return "pdf";
  if (/\.(mp3|m4a|ogg|wav|opus)($|[?#])/i.test(url) || /spotify\.com|soundcloud\.com/.test(url)) return "audio";
  if (/\.(mp4|webm|mov|mkv)($|[?#])/i.test(url)) return "video";
  if (/\.(png|jpe?g|webp|gif)($|[?#])/i.test(url)) return "image";
  if (/\.epub($|[?#])/i.test(url)) return "book";
  return "link";
}

export function kindFromMime(mime: string, name = ""): MaterialKind {
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/epub+zip" || /\.(epub|mobi)$/i.test(name)) return "book";
  return "other";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}
