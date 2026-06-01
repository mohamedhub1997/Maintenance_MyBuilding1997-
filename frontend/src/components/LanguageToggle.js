import React from "react";
import { useI18n, SUPPORTED_LANGS } from "../i18n";
import { Globe } from "lucide-react";

export default function LanguageToggle({ compact = false }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="px-3 py-2">
      {!compact && (
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
          <Globe className="w-3 h-3" /> {t("common.language")}
        </div>
      )}
      <div className="flex gap-1 bg-slate-900 rounded-md p-1 border border-slate-800">
        {SUPPORTED_LANGS.map((l) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              data-testid={`lang-${l.code}`}
              className={`flex-1 text-xs font-semibold py-1.5 rounded ${
                active ? "bg-accent text-bg" : "text-slate-300 hover:text-white"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
