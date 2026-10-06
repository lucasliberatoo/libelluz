import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dataUrlResponse } from "@/server/data-url";

export async function GET(_req: Request, ctx: RouteContext<"/api/avatar/[id]">) {
  if (!(await auth())?.user?.id) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const u = await getDb().query.users.findFirst({ where: eq(schema.users.id, id), columns: { image: true } });
  return dataUrlResponse(u?.image);
}
