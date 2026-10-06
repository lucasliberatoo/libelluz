import type { CapacitorConfig } from "@capacitor/cli";

// O APK é uma "casca" que abre o site em produção: toda atualização do site chega no app sem reinstalar.
//
// Plugins: o `npx cap sync android` acha sozinho todo plugin declarado nas dependências do
// package.json — inclusive o plugin local do Modo Disciplina, que é um pacote dentro do repo
// ("libelluz-app-blocker": "file:android-plugins/app-blocker", pasta `android-plugins/app-blocker`).
// NÃO use `includePlugins` aqui: ele vira uma lista fechada e qualquer plugin fora dela
// (@capacitor/local-notifications, por exemplo) deixa de entrar no APK sem aviso nenhum.
// O workflow `.github/workflows/apk.yml` confere no CI que os plugins esperados foram registrados.
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
