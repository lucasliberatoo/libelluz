import "server-only";
import { presign, toAmzDate } from "@/lib/sigv4";

/** Cloudflare R2 (S3-compatível), acessado só por URLs pré-assinadas. */

export const R2_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

export const UPLOAD_MAX_BYTES = 500 * 1024 * 1024; // 500 MB por arquivo
export const QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB por pessoa

export const r2MissingVars = () => R2_VARS.filter((v) => !process.env[v]);
export const r2Enabled = () => r2MissingVars().length === 0;

export function r2Url(method: "GET" | "PUT" | "DELETE" | "HEAD", key: string, expires = 900, query?: Record<string, string>) {
  if (!r2Enabled()) throw new Error("R2 não configurado");
  const e = process.env;
  return presign({
    method,
    host: `${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    path: `/${e.R2_BUCKET}/${key}`,
    region: "auto",
    accessKeyId: e.R2_ACCESS_KEY_ID!,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY!,
    amzDate: toAmzDate(new Date()),
    expires,
    query,
  }).url;
}

/** Tamanho real do objeto no bucket (null se não existe). */
export async function r2Head(key: string): Promise<number | null> {
  const res = await fetch(r2Url("HEAD", key, 60), { method: "HEAD", cache: "no-store" });
  if (!res.ok) return null;
  return Number(res.headers.get("content-length") ?? 0);
}

export async function r2Delete(key: string) {
  const res = await fetch(r2Url("DELETE", key, 60), { method: "DELETE", cache: "no-store" });
  return res.ok || res.status === 404;
}
