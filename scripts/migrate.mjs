// Aplica as migrações do Drizzle. Roda no build da Vercel; sem DATABASE_URL, só avisa.
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL ausente: pulando migrações.");
  process.exit(0);
}
if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(url.slice(7));
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.close();
} else {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
}
console.log("[migrate] ok");
