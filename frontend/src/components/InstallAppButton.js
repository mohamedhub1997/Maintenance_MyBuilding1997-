import React, { useEffect, useState } from "react";
import { Smartphone, Share } from "lucide-react";
import { useT } from "../i18n";

/**
 * Install-as-app button.
 *  - Chrome/Edge/Android: catches `beforeinstallprompt` and shows a real Install button.
 *  - iOS Safari: there is no API, so we surface a one-line hint ("Share → Add to Home Screen").
 *  - Already installed (running in standalone mode): renders nothing.
 */
export default function InstallAppButton() {
  const t = useT();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const ua = window.navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(ios);

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  // Android / desktop Chrome: real prompt
  if (deferred) {
    return (
      <div className="px-3 pb-2">
        <button
          onClick={async () => {
            deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setDeferred(null);
          }}
          data-testid="install-app-button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-accent text-bg hover:bg-accent-hover"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {t("pwa.install")}
        </button>
      </div>
    );
  }

  // iOS: no API, just a hint that the user can show on demand
  if (isIOS) {
    return (
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowIOSHint((v) => !v)}
          data-testid="install-app-ios-hint"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {t("pwa.installIOS")}
        </button>
        {showIOSHint && (
          <div className="mt-2 text-[11px] text-slate-400 leading-relaxed bg-slate-900 border border-slate-800 rounded-md p-2 flex gap-2">
            <Share className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{t("pwa.iosSteps")}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
