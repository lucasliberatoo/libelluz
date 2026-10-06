"use client";

import { useSyncExternalStore } from "react";

// Ponte com o plugin nativo "AppBlocker" (pasta `android-plugins/app-blocker`).
//
// Não importamos `@capacitor/core`: o bundle do site não deve depender dele. No APK, o Capacitor
// injeta `window.Capacitor` com `registerPlugin`; no navegador nada disso existe e `appBlocker()`
// devolve null — a página então só explica que o bloqueio vale no app Android.

export type PermKey = "usage" | "overlay" | "notifications" | "notificationAccess" | "battery";

export type AppBlockerPerms = Record<PermKey, boolean>;

export type AppBlockerInfo = {
  platform: string;
  canBlock: boolean;
  running: boolean;
  perms: AppBlockerPerms;
};

export type NativeApp = { pkg: string; label: string; suggested: boolean };

export type PendingSpend = { id: string; pkg: string; label: string; at: number; day: string; minutes: number };

export type NativeState = {
  enabled: boolean;
  day: string;
  tokensLeft: number;
  baseTokens: number;
  minutesPerToken: number;
  blockNotifications: boolean;
  running: boolean;
  blocked: string[];
  unlocks: Record<string, number>;
  pending: PendingSpend[];
};

export type NativeConfig = {
  enabled?: boolean;
  apps?: { pkg: string; label: string }[];
  baseTokens?: number;
  minutesPerToken?: number;
  blockNotifications?: boolean;
  tokensLeft?: number;
  day?: string;
};

export type AppBlocker = {
  getInfo(): Promise<AppBlockerInfo>;
  openSettings(options: { which: PermKey }): Promise<void>;
  listApps(): Promise<{ apps: NativeApp[] }>;
  setConfig(options: NativeConfig): Promise<NativeState>;
  getState(): Promise<NativeState>;
  ack(options: { ids: string[] }): Promise<NativeState>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  registerPlugin?: <T>(name: string) => T;
};

let cached: AppBlocker | null | undefined;

/** O plugin, ou null no navegador e em qualquer APK antigo sem ele. */
export function appBlocker(): AppBlocker | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (typeof window === "undefined") return null;
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.("AppBlocker") || !cap.registerPlugin) return null;
    cached = cap.registerPlugin<AppBlocker>("AppBlocker");
  } catch {
    cached = null; // nunca derruba a página por causa da ponte
  }
  return cached;
}

const noSubscribe = () => () => {};

/** true só no APK com o plugin. Via useSyncExternalStore para não dar diferença entre servidor e cliente. */
export function useAppBlockerPresent(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => appBlocker() !== null,
    () => false,
  );
}

export const PERM_LABELS: Record<PermKey, { title: string; why: string; required: boolean }> = {
  usage: {
    title: "Acesso a estatísticas de uso",
    why: "É assim que o Libelluz sabe qual app você acabou de abrir. Nada sai do seu celular.",
    required: true,
  },
  overlay: {
    title: "Sobrepor a outros apps",
    why: "Permite mostrar a tela do token por cima do app bloqueado.",
    required: true,
  },
  notificationAccess: {
    title: "Acesso a notificações",
    why: "Deixa o Libelluz silenciar as notificações dos apps bloqueados enquanto você não gasta um token.",
    required: false,
  },
  notifications: {
    title: "Notificações do Libelluz",
    why: "Mostra o aviso discreto “Modo Disciplina ativo”, que mantém o bloqueio rodando.",
    required: false,
  },
  battery: {
    title: "Ignorar otimização de bateria",
    why: "Evita que o Android desligue o bloqueio quando o celular fica parado.",
    required: false,
  },
};

export const PERM_ORDER: PermKey[] = ["usage", "overlay", "notificationAccess", "notifications", "battery"];

/**
 * Lista curada para quem está no navegador (sem o plugin não há como ler os apps instalados).
 * No APK a lista vem do próprio celular, com todos os apps.
 */
export const KNOWN_APPS: { pkg: string; label: string }[] = [
  { pkg: "com.instagram.android", label: "Instagram" },
  { pkg: "com.zhiliaoapp.musically", label: "TikTok" },
  { pkg: "com.google.android.youtube", label: "YouTube" },
  { pkg: "com.twitter.android", label: "X (Twitter)" },
  { pkg: "com.whatsapp", label: "WhatsApp" },
  { pkg: "com.facebook.katana", label: "Facebook" },
  { pkg: "com.snapchat.android", label: "Snapchat" },
  { pkg: "com.reddit.frontpage", label: "Reddit" },
  { pkg: "com.netflix.mediaclient", label: "Netflix" },
  { pkg: "com.discord", label: "Discord" },
  { pkg: "org.telegram.messenger", label: "Telegram" },
  { pkg: "tv.twitch.android.app", label: "Twitch" },
  { pkg: "com.pinterest", label: "Pinterest" },
  { pkg: "com.spotify.music", label: "Spotify" },
];
