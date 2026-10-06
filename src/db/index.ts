import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: DB };

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada (crie o banco Neon na Vercel).");
  // Desenvolvimento local sem Neon: DATABASE_URL=pglite:./.pglite
  if (url.startsWith("pglite:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite");
    return drizzlePglite(new PGlite(url.slice(7)), { schema }) as DB;
  }
  return drizzle(neon(url), { schema });
}

/** Conexão preguiçosa: o build funciona mesmo sem DATABASE_URL. */
export function getDb(): DB {
  g.__db ??= create();
  return g.__db;
}

export const hasDatabase = () => !!process.env.DATABASE_URL;

export { schema };
