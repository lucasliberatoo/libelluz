"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { ACCESSORY_IDS, type AccessoryId } from "@/lib/heat";
import { getPetState } from "./pet";

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const accessorySchema = z.enum(ACCESSORY_IDS as [AccessoryId, ...AccessoryId[]]).nullable();

/** Equipa (ou tira, com null) um acessório já desbloqueado. */
export async function setPetAccessory(input: AccessoryId | null) {
  const userId = await requireUser();
  const id = accessorySchema.parse(input);
  if (id) {
    const pet = await getPetState(userId);
    if (!pet.accessories.find((a) => a.id === id)?.unlocked) throw new Error("Acessório ainda bloqueado");
  }
  await getDb().update(schema.users).set({ petAccessory: id }).where(eq(schema.users.id, userId));
  revalidatePath("/", "layout");
}
