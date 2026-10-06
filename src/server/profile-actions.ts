"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";

const photo = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,/, "Formato inválido")
  .max(300_000, "Foto grande demais")
  .nullable();

/** Troca (ou remove, com null) a foto de perfil. A foto já chega comprimida (256px). */
export async function setAvatar(dataUrl: string | null) {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  const v = photo.parse(dataUrl);
  await getDb().update(schema.users).set({ image: v }).where(eq(schema.users.id, s.user.id));
  revalidatePath("/", "layout");
}
