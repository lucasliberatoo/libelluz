"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { kindFromMime, MATERIAL_KINDS, formatBytes } from "@/lib/media";
import { storageUsed } from "./materiais";
import { QUOTA_BYTES, r2Delete, r2Enabled, r2Head, r2Url, UPLOAD_MAX_BYTES } from "./r2";

const { materials, studyNodes } = schema;

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/entrar");
  return s.user.id;
}

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const meta = z.object({
  title: z.string().trim().min(1, "Dê um título").max(200),
  kind: z.enum(MATERIAL_KINDS),
  section: z.enum(["aula", "material"]),
  area: opt(40),
  subject: opt(80),
  nodeId: opt(64),
});

export type MaterialMeta = z.input<typeof meta>;
type Result = { error?: string };

/** Só aceita tópico da própria árvore; área e disciplina vêm dele quando houver. */
async function resolveNode(userId: string, m: z.output<typeof meta>) {
  if (!m.nodeId) return m;
  const node = await getDb().query.studyNodes.findFirst({ where: and(eq(studyNodes.id, m.nodeId), eq(studyNodes.userId, userId)) });
  return node ? m : { ...m, nodeId: null };
}

const linkSchema = meta.extend({
  url: z
    .string()
    .trim()
    .max(2000)
    .url("Link inválido")
    .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)"),
});

export async function addMaterialLink(input: z.input<typeof linkSchema>): Promise<Result> {
  const userId = await requireUser();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { url, ...m } = parsed.data;
  await getDb()
    .insert(materials)
    .values({ ...(await resolveNode(userId, m)), url, userId });
  revalidatePath("/aulas/materiais");
  return {};
}

const startSchema = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  mime: z.string().max(120).default(""),
});

/** Passo 1 do upload: confere limites e devolve a URL PUT pré-assinada (15 min). */
export async function startUpload(input: z.input<typeof startSchema>): Promise<Result & { key?: string; url?: string }> {
  const userId = await requireUser();
  if (!r2Enabled()) return { error: "Upload de arquivos ainda não configurado — use links." };
  const f = startSchema.parse(input);
  if (f.size > UPLOAD_MAX_BYTES) return { error: `Arquivo grande demais (máx. ${formatBytes(UPLOAD_MAX_BYTES)}). Para aulas longas, use um link.` };
  const used = await storageUsed(userId);
  if (used + f.size > QUOTA_BYTES)
    return { error: `Sem espaço: você usa ${formatBytes(used)} de ${formatBytes(QUOTA_BYTES)}. Apague algum arquivo ou use um link.` };
  const safe =
    f.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(-100) || "arquivo";
  const key = `u/${userId}/${randomUUID()}/${safe}`;
  return { key, url: r2Url("PUT", key, 900) };
}

const finishSchema = meta.extend({ key: z.string().max(400), mime: z.string().max(120).default("") });

/** Passo 2: o navegador já enviou o arquivo; confere o tamanho real no bucket e registra. */
export async function finishUpload(input: z.input<typeof finishSchema>): Promise<Result> {
  const userId = await requireUser();
  if (!r2Enabled()) return { error: "Upload não configurado." };
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { key, mime, ...m } = parsed.data;
  if (!key.startsWith(`u/${userId}/`) || key.includes("..")) return { error: "Arquivo inválido." };
  const db = getDb();
  if (await db.query.materials.findFirst({ where: eq(materials.storageKey, key) })) return { error: "Arquivo já registrado." };
  const size = await r2Head(key);
  if (size === null) return { error: "O arquivo não chegou ao armazenamento. Tente de novo." };
  const used = await storageUsed(userId);
  if (size > UPLOAD_MAX_BYTES || used + size > QUOTA_BYTES) {
    await r2Delete(key);
    return { error: "O arquivo passou do limite e foi descartado." };
  }
  await db.insert(materials).values({
    ...(await resolveNode(userId, m)),
    kind: m.kind === "other" ? kindFromMime(mime, key) : m.kind,
    userId,
    storageKey: key,
    size,
    mime: mime || null,
  });
  revalidatePath("/aulas/materiais");
  return {};
}

export async function deleteMaterial(id: string): Promise<Result> {
  const userId = await requireUser();
  const db = getDb();
  const m = await db.query.materials.findFirst({ where: and(eq(materials.id, z.string().parse(id)), eq(materials.userId, userId)) });
  if (!m) return { error: "Material não encontrado." };
  if (m.storageKey) {
    if (!r2Enabled()) return { error: "Armazenamento não configurado: não dá para apagar o arquivo agora." };
    if (!(await r2Delete(m.storageKey))) return { error: "Não consegui apagar o arquivo no armazenamento. Tente de novo." };
  }
  await db.delete(materials).where(and(eq(materials.id, m.id), eq(materials.userId, userId)));
  revalidatePath("/aulas/materiais");
  return {};
}
