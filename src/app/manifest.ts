import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Libelluz",
    short_name: "Libelluz",
    description: "Estude para o ENEM evoluindo rumo aos 160+.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6fa",
    theme_color: "#2f5bff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Modo Foco", url: "/foco", icons: [{ src: "/icon-192.png", sizes: "192x192" }] }],
  };
}
