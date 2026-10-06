"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { markCelebrationsSeen } from "./achievements";

const shownSchema = z.array(z.object({ key: z.string().min(1).max(64), tier: z.number().int().min(1).max(3) })).max(50);

/** Fechou a comemoração: marca as conquistas mostradas como vistas e guarda o nível atual como já comemorado. */
export async function dismissCelebrations(shown: { key: string; tier: number }[]) {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  const parsed = shownSchema.safeParse(shown);
  if (!parsed.success) return { ok: false };
  await markCelebrationsSeen(s.user.id, parsed.data);
  return { ok: true };
}
