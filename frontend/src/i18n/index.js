import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./en";
import ar from "./ar";

const DICTS = { en, ar };
const DIRECTIONS = { en: "ltr", ar: "rtl" };
const STORAGE_KEY = "ma_lang";
const DEFAULT_LANG = "en";

function getInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const I18nContext = createContext({
  lang: DEFAULT_LANG,
  dir: "ltr",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  const dir = DIRECTIONS[lang] || "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang, dir]);

  const setLang = useCallback((next) => {
    if (DICTS[next]) setLangState(next);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || DICTS[DEFAULT_LANG];
      const raw = dict[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
      return interpolate(raw, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}

export const SUPPORTED_LANGS = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];
