import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { pushSubscriptions } = schema;

/** Chave pública VAPID. Fica em NEXT_PUBLIC_ para o navegador poder assinar; VAPID_PUBLIC_KEY é aceita por compatibilidade. */
export const publicVapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;

/** Chaves VAPID (Web Push). Sem elas o push é pulado e o sino continua funcionando. */
export function vapid() {
  const publicKey = publicVapidKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:dracodabliu@gmail.com" };
}

export type PushPayload = { title: string; body: string; url?: string | null; tag?: string; id?: string };

/**
 * Envia um push para todas as assinaturas web da pessoa.
 * Assinaturas que voltam 404/410 (expiradas ou canceladas) são apagadas.
 */
export async function sendWebPush(userId: string, payload: PushPayload) {
  const keys = vapid();
  if (!keys) return { sent: 0, removed: 0, skipped: "sem VAPID" as const };
  const subs = await getDb()
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.platform, "web")));
  if (!subs.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify({ ...payload, url: payload.url || "/notificacoes" });
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      if (!s.p256dh || !s.auth) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: keys,
          TTL: 60 * 60 * 6,
          urgency: "normal",
          topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.warn("[push] falhou", code ?? (e as Error).message);
      }
    }),
  );
  if (gone.length) await getDb().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return { sent, removed: gone.length };
}
