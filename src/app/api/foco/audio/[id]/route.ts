import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { dataUrlResponse } from "@/server/data-url";

export async function GET(_req: Request, ctx: RouteContext<"/api/foco/audio/[id]">) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const n = await getDb().query.focusNotes.findFirst({
    where: and(eq(schema.focusNotes.id, id), eq(schema.focusNotes.userId, userId)),
    columns: { audio: true },
  });
  return dataUrlResponse(n?.audio);
}
