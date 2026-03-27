import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { WindowControls } from "../components/WindowControls";
import { LANGUAGES, changeLanguage } from "../i18n";

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("auth.resetError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center h-screen overflow-hidden" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <WindowControls />

      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0c10]">
        <div className="absolute inset-0 opacity-30" style={{
          background: "radial-gradient(ellipse at 50% 40%, #1a3a5c 0%, transparent 50%)"
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }} />
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div className="relative bg-[#12151a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#1a9fff]/60 to-transparent" />

          <div className="p-8 pb-6">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a9fff] to-[#0066cc] flex items-center justify-center shadow-[0_4px_12px_rgba(26,159,255,0.3)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="text-lg font-black text-white tracking-[0.2em]">STEALIKE</span>
            </div>

            <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-2">{t("auth.resetTitle")}</h2>

            {success ? (
              <div className="mt-6">
                {/* Success state */}
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1a9fff]/10 border border-[#1a9fff]/20 mx-auto mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-[#1a9fff] text-sm font-bold text-center mb-2">{t("auth.resetLinkSent")}</p>
                <p className="text-[#5e6673] text-xs text-center leading-relaxed mb-6">{t("auth.resetLinkSentHint")}</p>
                <button onClick={onBack}
                  className="w-full py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-white font-bold text-sm rounded-lg transition-all tracking-wider">
                  {t("auth.backToLogin")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="text-[#5e6673] text-xs leading-relaxed mb-6">{t("auth.resetHint")}</p>

                <div className="mb-6">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.emailPlaceholder")}
                  </label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    className={`w-full px-4 py-3 bg-[#0a0c10]/60 border rounded-lg text-white text-sm focus:outline-none transition-all placeholder-[#3d4450] ${focused ? "border-[#1a9fff]/50 bg-[#0a0c10]/80" : "border-white/[0.06]"}`}
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs font-medium">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)]">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      {t("auth.sending")}
                    </span>
                  ) : t("auth.sendResetLink")}
                </button>
              </form>
            )}
          </div>

          {/* Bottom */}
          <div className="px-8 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-1">
              {LANGUAGES.map((lang) => (
                <button key={lang.code} onClick={() => changeLanguage(lang.code)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    i18n.language === lang.code ? "text-white bg-white/[0.08]" : "text-[#3d4450] hover:text-[#8f98a0]"
                  }`}>{lang.code}</button>
              ))}
            </div>
            <button onClick={onBack} className="text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors">
              {t("auth.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
