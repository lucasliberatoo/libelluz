"use client";

// Ajudantes do navegador para o push: Web Push (site/PWA) e lembretes locais (APK).

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

/** Rodando dentro do APK (Capacitor)? */
export const isNativeApp = () => typeof window !== "undefined" && !!(window as CapWindow).Capacitor?.isNativePlatform?.();

export type PushState = "unsupported" | "native" | "denied" | "off" | "on" | "nokey";

export const webPushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  // em produção o SW já é registrado pelo ServiceWorkerRegister; aqui garantimos (também em dev)
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return reg;
}

export async function pushState(): Promise<PushState> {
  if (isNativeApp()) return "native";
  if (!webPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pede permissão, assina e salva no servidor. */
export async function enablePush(): Promise<PushState> {
  if (isNativeApp()) {
    await syncNativeReminders(true);
    return "native";
  }
  if (!webPushSupported()) return "unsupported";
  // a chave pública vem do build (NEXT_PUBLIC_) ou, se não estiver lá, do servidor
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    ((await fetch("/api/push/assinatura").then((r) => r.json())) as { publicKey: string | null }).publicKey;
  if (!publicKey) return "nokey";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // chave trocada no servidor: assina de novo
  if (sub && sub.options.applicationServerKey) {
    const cur = new Uint8Array(sub.options.applicationServerKey);
    const want = keyBytes(publicKey);
    if (cur.length !== want.length || cur.some((b, i) => b !== want[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const res = await fetch("/api/push/assinatura", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return res.ok ? "on" : "off";
}

export async function disablePush(): Promise<PushState> {
  if (!webPushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/assinatura", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return "off";
}

type Reminder = { id: number; at: string; title: string; body: string; url: string };

/**
 * APK: agenda os lembretes locais de hoje (o WebView do Android não recebe Web Push).
 * Cancela os pendentes e agenda de novo a cada abertura, então quem já estudou não recebe o aviso da sequência.
 */
export async function syncNativeReminders(askPermission = false) {
  if (!isNativeApp()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && askPermission) perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return false;
    const { reminders } = (await fetch("/api/push/agenda", { cache: "no-store" }).then((r) => r.json())) as { reminders: Reminder[] };
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (reminders.length) {
      await LocalNotifications.schedule({
        notifications: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          schedule: { at: new Date(r.at), allowWhileIdle: true },
          extra: { url: r.url },
        })),
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** APK: tocar no lembrete local abre a página certa. */
export async function listenNativeTaps(go: (url: string) => void) {
  if (!isNativeApp()) return () => {};
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const h = await LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
      const url = (a.notification.extra as { url?: string } | undefined)?.url;
      if (url) go(url);
    });
    return () => void h.remove();
  } catch {
    return () => {};
  }
}
