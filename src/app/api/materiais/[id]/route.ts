import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { r2Enabled, r2Url } from "@/server/r2";

/** Abre um material: confere o dono e redireciona para o link ou para uma URL GET pré-assinada do R2. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/materiais/[id]">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.redirect(new URL("/entrar", req.url));
  const { id } = await ctx.params;
  const m = await getDb().query.materials.findFirst({
    where: and(eq(schema.materials.id, id), eq(schema.materials.userId, userId)),
  });
  if (!m) return new NextResponse("Material não encontrado", { status: 404 });
  if (m.storageKey) {
    if (!r2Enabled()) return new NextResponse("Armazenamento não configurado", { status: 503 });
    const name = m.storageKey.split("/").pop() ?? "arquivo";
    const download = req.nextUrl.searchParams.has("baixar");
    const url = r2Url("GET", m.storageKey, 3600, {
      "response-content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      ...(m.mime ? { "response-content-type": m.mime } : {}),
    });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (m.url) return NextResponse.redirect(m.url);
  return new NextResponse("Material sem arquivo", { status: 404 });
}
