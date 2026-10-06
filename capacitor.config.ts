import type { CapacitorConfig } from "@capacitor/cli";

// O APK é uma "casca" que abre o site em produção: toda atualização do site chega no app sem reinstalar.
const config: CapacitorConfig = {
  appId: "app.libelluz",
  appName: "Libelluz",
  webDir: "capacitor-shell",
  server: {
    url: process.env.LIBELLUZ_URL ?? "https://libelluz.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#2f5bff",
  },
};

export default config;
