import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { publicVapidKey } from "@/server/push";

const { pushSubscriptions } = schema;

/** Chave pública VAPID (o navegador precisa dela para assinar). */
export async function GET() {
  return Response.json({ publicKey: publicVapidKey() });
}

const Sub = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** Salva (ou passa para esta pessoa) a assinatura de push deste navegador. */
export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "assinatura inválida" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await getDb()
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, platform: "web" })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: keys.p256dh, auth: keys.auth } });
  return Response.json({ ok: true });
}

/** Cancela a assinatura deste navegador. */
export async function DELETE(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "inválido" }, { status: 400 });
  await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, parsed.data.endpoint)));
  return Response.json({ ok: true });
}
