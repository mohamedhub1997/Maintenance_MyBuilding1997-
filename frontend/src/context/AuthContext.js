import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { getToken, setToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Only probe /auth/me if we have evidence of a prior session (Bearer token or cookie).
    // If there's no token at all, skip the network probe — saves a guaranteed 401.
    if (!getToken()) {
      setLoading(false);
      // Still attempt cookie-only probe, but ignore failure quietly.
      api
        .get("/auth/me")
        .then((res) => { if (!cancelled) setUser(res.data); })
        .catch(() => { /* no cookie session — stay logged out */ });
      return () => { cancelled = true; };
    }

    api
      .get("/auth/me")
      .then((res) => { if (!cancelled) setUser(res.data); })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    if (res.data?.token) setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout request failed:", err?.message || err);
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
