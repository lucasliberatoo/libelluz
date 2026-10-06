/** URL da foto de perfil. Fotos enviadas (data URL) são servidas por /api/avatar com cache. */
export function avatarUrl(userId: string, image: string | null | undefined): string | null {
  if (!image) return null;
  if (!image.startsWith("data:")) return image;
  let h = 0;
  for (let i = 0; i < image.length; i += 97) h = (h * 31 + image.charCodeAt(i)) | 0;
  return `/api/avatar/${userId}?v=${(h >>> 0).toString(36)}${image.length.toString(36)}`;
}
