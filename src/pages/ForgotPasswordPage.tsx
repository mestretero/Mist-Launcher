import { useState } from "react";
import mistLogo from "../assets/mist-logo.png";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const bgCoverModules = import.meta.glob("../assets/bg-covers/*.jpg", { eager: true, import: "default" });
const BG_COVERS: string[] = (Object.values(bgCoverModules) as string[])
  .map((v) => ({ v, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .map(({ v }) => v);
import { WindowControls } from "../components/WindowControls";
import { LANGUAGES, changeLanguage } from "../i18n";

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setStep("reset");
    } catch (err: any) {
      setError(err.message || t("auth.resetError"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) { setError(t("auth.codeMustBe6Digits")); return; }
    if (newPassword.length < 8) { setError(t("auth.passwordMinLength")); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(email, code, newPassword);
      setStep("done");
    } catch (err: any) {
      setError(err.message || t("auth.resetError"));
    } finally {
      setLoading(false);
    }
  };

  const COLS = 28;
  const colCovers = Array.from({ length: COLS }, (_, i) => {
    const start = (i * 3) % BG_COVERS.length;
    const slice = [...BG_COVERS.slice(start), ...BG_COVERS].slice(0, 10);
    return [...slice, ...slice];
  });

  return (
    <div className="relative flex items-center justify-center h-screen overflow-hidden" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <WindowControls />

      {/* Background - diagonal scrolling game cards */}
      <div className="absolute inset-0 bg-[#030712] overflow-hidden">
        {colCovers.length > 0 && (
          <div className="absolute flex" style={{ transform: "rotate(-8deg)", top: "-90vh", left: "-90vw", width: "280vw", height: "280vh", gap: "0.8vw" }}>
            {colCovers.map((covers, col) => (
              <div key={col} className={col % 2 === 0 ? "animate-scroll-up" : "animate-scroll-down"}
                style={{ animationDuration: `${28 + col * 6}s`, display: "flex", flexDirection: "column", gap: "0.8vw", minWidth: "9vw" }}>
                {covers.map((url, i) => (
                  <img key={i} src={url} alt="" className="object-cover rounded-lg flex-shrink-0" style={{ opacity: 0.45, width: "9vw", height: "12.5vw" }} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #030712cc 0%, #030712aa 50%, #030712cc 100%)", backdropFilter: "blur(1px)" }} />
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div className="relative bg-[#030712]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#1a9fff]/60 to-transparent" />

          <div className="p-8 pb-6">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <img src={mistLogo} alt="MIST" className="h-16 w-16 object-contain rounded-xl" />
            </div>

            <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-2">{t("auth.resetTitle")}</h2>

            {step === "done" && (
              <div className="mt-6">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-emerald-400 text-sm font-bold text-center mb-2">{t("auth.passwordResetDone")}</p>
                <p className="text-[#5e6673] text-xs text-center leading-relaxed mb-6">{t("auth.passwordResetDoneHint")}</p>
                <button onClick={onBack}
                  className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] text-white font-bold text-sm rounded-lg transition-all tracking-wider">
                  {t("auth.backToLogin")}
                </button>
              </div>
            )}

            {step === "email" && (
              <form onSubmit={handleSendCode}>
                <p className="text-[#5e6673] text-xs leading-relaxed mb-6">{t("auth.resetHint")}</p>

                <div className="mb-6">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "email" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.emailPlaceholder")}
                  </label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                    className={`w-full px-4 py-3 bg-[#0a0c10]/60 border rounded-lg text-white text-sm focus:outline-none transition-all placeholder-[#3d4450] ${focused === "email" ? "border-[#1a9fff]/50 bg-[#0a0c10]/80" : "border-white/[0.06]"}`}
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

            {step === "reset" && (
              <form onSubmit={handleResetPassword}>
                <p className="text-[#5e6673] text-xs leading-relaxed mb-6">{t("auth.codeSentHint", { email })}</p>

                <div className="mb-4">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "code" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.verificationCode")}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    onFocus={() => setFocused("code")}
                    onBlur={() => setFocused(null)}
                    placeholder="000000"
                    required
                    className={`w-full px-4 py-3 bg-[#0a0c10]/60 border rounded-lg text-white text-2xl text-center font-mono tracking-[0.5em] focus:outline-none transition-all placeholder-[#2a3040] ${focused === "code" ? "border-[#1a9fff]/50 bg-[#0a0c10]/80" : "border-white/[0.06]"}`}
                  />
                </div>

                <div className="mb-6">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "password" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.newPassword")}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    required
                    minLength={8}
                    className={`w-full px-4 py-3 bg-[#0a0c10]/60 border rounded-lg text-white text-sm focus:outline-none transition-all placeholder-[#3d4450] ${focused === "password" ? "border-[#1a9fff]/50 bg-[#0a0c10]/80" : "border-white/[0.06]"}`}
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs font-medium">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)] mb-2">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      {t("auth.sending")}
                    </span>
                  ) : t("auth.resetPasswordButton")}
                </button>

                <button type="button" onClick={() => { setStep("email"); setCode(""); setNewPassword(""); setError(""); }}
                  className="w-full py-2 text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors">
                  {t("auth.useAnotherEmail")}
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
