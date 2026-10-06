import "server-only";

/** Devolve um data URL guardado no banco como arquivo, com cache no navegador. */
export function dataUrlResponse(dataUrl: string | null | undefined) {
  const m = dataUrl?.match(/^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/i);
  if (!m) return new Response(null, { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
