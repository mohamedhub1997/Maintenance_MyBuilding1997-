import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n";
import { formatApiError } from "../lib/api";
import { Home, LogIn } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      if (u.role === "admin") navigate("/admin");
      else if (u.role === "tenant") navigate("/tenant");
      else navigate("/maintenance");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-in" data-testid="login-page">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Home className="w-5 h-5 text-bg" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">{t("common.appName")}</div>
            <div className="text-xl font-bold">{t("common.maintenancePortal")}</div>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-1">{t("login.welcome")}</h1>
          <p className="text-slate-400 text-sm mb-6">{t("login.subtitle")}</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">{t("login.username")}</label>
              <input
                data-testid="login-username-input"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="label">{t("login.password")}</label>
              <input
                data-testid="login-password-input"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div
                data-testid="login-error"
                className="text-sm text-red-400 bg-red-500/10 border border-red-900/40 rounded-md px-3 py-2"
              >
                {error}
              </div>
            )}
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full"
            >
              <LogIn className="w-4 h-4" />
              {busy ? t("login.signingIn") : t("login.button")}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-6 text-center">{t("login.help")}</p>
        </div>
      </div>
    </div>
  );
}
