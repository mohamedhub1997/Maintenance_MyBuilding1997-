import api from "./api";

// Convert URL-safe base64 → Uint8Array (web-push requires Uint8Array for applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getRegistration() {
  if (!isPushSupported()) return null;
  let reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getCurrentSubscription() {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeForPush() {
  if (!isPushSupported()) throw new Error("Push not supported on this browser");
  const reg = await getRegistration();
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("Permission denied");
  }
  const { data } = await api.get("/notifications/vapid-key");
  if (!data?.key) throw new Error("Server is missing VAPID key");
  /*fix: change const to let in push subscription*/
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
  }
  const subJson = sub.toJSON();
  await api.post("/notifications/subscribe", {
    endpoint: subJson.endpoint,
    keys: subJson.keys,
  });
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const subJson = sub.toJSON();
  try {
    await api.post("/notifications/unsubscribe", {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });
  } catch {
    /* ignore network */
  }
  await sub.unsubscribe();
}

