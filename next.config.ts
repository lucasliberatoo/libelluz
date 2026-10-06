import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (banco local de desenvolvimento) carrega arquivos próprios em runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Foto do diário vai como data URL comprimida (até ~1,5 MB).
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
