import { timingSafeEqual } from "node:crypto";
import { hasDatabase } from "@/db";
import { runNotificationCron } from "@/server/push-cron";

// Chamado pelo GitHub Actions a cada 30 min (.github/workflows/notificacoes.yml).
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDatabase()) return Response.json({ error: "sem banco" }, { status: 503 });
  // ?now=2026-10-06T22:00:00Z simula outro horário (testes)
  const nowParam = new URL(req.url).searchParams.get("now");
  const now = nowParam && !Number.isNaN(Date.parse(nowParam)) ? new Date(nowParam) : new Date();
  const result = await runNotificationCron(now);
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
