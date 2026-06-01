/**
 * Register the service worker on app load (PWA + push readiness).
 * Safe to call multiple times — browsers de-dupe registrations.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[sw] registration failed:", err);
      });
  });
}
