import { useTranslation } from "react-i18next";
import { LANGUAGES, changeLanguage } from "../i18n";

export function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((lang) => {
          const isActive = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                isActive
                  ? "border-[#1a9fff]/50 bg-[#1a9fff]/10 text-white"
                  : "border-[#2a2e38] bg-[#161920] text-[#8f98a0] hover:border-[#3d4450] hover:text-white"
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-white" : ""}`}>{lang.name}</p>
                <p className="text-[10px] text-[#5e6673] uppercase">{lang.code}</p>
              </div>
              {isActive && (
                <svg className="ml-auto text-[#1a9fff]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
