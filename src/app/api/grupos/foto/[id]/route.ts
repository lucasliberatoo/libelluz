import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dataUrlResponse } from "@/server/data-url";

/** Foto de um post do feed (o grupo é todo mundo do app). Os posts não mudam de foto: cache longo. */
export async function GET(_req: Request, ctx: RouteContext<"/api/grupos/foto/[id]">) {
  if (!(await auth())?.user?.id) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const p = await getDb().query.feedPosts.findFirst({ where: eq(schema.feedPosts.id, id), columns: { photo: true } });
  return dataUrlResponse(p?.photo);
}
