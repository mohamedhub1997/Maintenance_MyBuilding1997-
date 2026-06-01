import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const HTTP_UNAUTHORIZED = 401;
const TOKEN_KEY = "ma_token";

// Endpoints whose 401 is informational ("am I logged in?") — must NOT trigger redirect.
const AUTH_BOOTSTRAP_PATHS = ["/auth/me", "/auth/login", "/auth/logout"];

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

// Cross-origin (e.g. Vercel → preview backend) we must NOT use credentials because
// some CDNs in front of the backend return `Access-Control-Allow-Origin: *` for
// OPTIONS preflights, which browsers reject with credentials. Bearer token in
// localStorage is the primary auth path — cookies are not needed.
// Auto-enable credentials only when calling the SAME origin (e.g. local dev).
const SAME_ORIGIN = (() => {
  try {
    return new URL(BACKEND_URL).origin === window.location.origin;
  } catch {
    return false;
  }
})();

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: SAME_ORIGIN,
});

// Attach Bearer token from localStorage on every request (race-proof, no cookie timing issues).
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isAuthBootstrap(url = "") {
  return AUTH_BOOTSTRAP_PATHS.some((p) => url.endsWith(p));
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    if (status === HTTP_UNAUTHORIZED && !isAuthBootstrap(url)) {
      // Real session-expired: drop token, force re-login.
      setToken(null);
      const path = window.location.pathname;
      if (path !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Global safety net so a missed .catch() never shows the red React/webpack overlay.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    if (e?.reason?.isAxiosError) {
      // We already surface API errors inline; swallow the unhandled rejection.
      e.preventDefault();
      // eslint-disable-next-line no-console
      console.warn("[api] swallowed unhandled axios rejection:", e.reason?.message);
    }
  });
}

export default api;

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  return JSON.stringify(d);
}
