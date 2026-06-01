import React, { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { isPushSupported, subscribeForPush, unsubscribeFromPush, getCurrentSubscription } from "../lib/push";
import { useT } from "../i18n";

export default function NotificationToggle() {
  const t = useT();
  const supported = isPushSupported();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    getCurrentSubscription()
      .then((s) => setEnabled(!!s && Notification.permission === "granted"))
      .catch(() => setEnabled(false));
  }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        await subscribeForPush();
        setEnabled(true);
      }
    } catch (e) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3 pb-2">
      <button
        onClick={toggle}
        disabled={busy}
        data-testid="push-toggle-button"
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition ${
          enabled
            ? "bg-accent/15 text-accent border border-accent/30"
            : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
        {enabled ? t("notif.enabled") : t("notif.enable")}
      </button>
      {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
    </div>
  );
}
