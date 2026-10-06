import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dataUrlResponse } from "@/server/data-url";

export async function GET(_req: Request, ctx: RouteContext<"/api/diario/foto/[dia]">) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response(null, { status: 401 });
  const { dia } = await ctx.params;
  const h = await getDb().query.habitLogs.findFirst({
    where: and(eq(schema.habitLogs.userId, userId), eq(schema.habitLogs.day, dia)),
    columns: { photo: true },
  });
  return dataUrlResponse(h?.photo);
}
