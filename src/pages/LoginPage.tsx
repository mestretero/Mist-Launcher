import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../stores/authStore";
import { api, setAccessToken } from "../lib/api";
import { WindowControls } from "../components/WindowControls";
import { LANGUAGES, changeLanguage } from "../i18n";

export function LoginPage({ onSwitch, onForgotPassword }: { onSwitch: () => void; onForgotPassword?: () => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.login({ email, password });
      if (result.requires2FA) {
        setRequires2FA(true);
        setTwoFAUserId(result.userId || "");
        setLoading(false);
        return;
      }
      const { tokens, user } = result;
      try { await invoke("store_token", { key: "access_token", value: tokens!.accessToken }); } catch {}
      try { await invoke("store_token", { key: "refresh_token", value: tokens!.refreshToken }); } catch {}
      setAccessToken(tokens!.accessToken);
      useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      setError(err.message || t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.twoFactor.login(twoFAUserId, twoFACode);
      try { await invoke("store_token", { key: "access_token", value: result.tokens.accessToken }); } catch {}
      try { await invoke("store_token", { key: "refresh_token", value: result.tokens.refreshToken }); } catch {}
      setAccessToken(result.tokens.accessToken);
      useAuthStore.setState({ user: result.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      setError(err.message || t("auth.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center h-screen overflow-hidden" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <WindowControls />

      {/* Animated background */}
      <div className="absolute inset-0 bg-[#0a0c10]">
        <div className="absolute inset-0 opacity-30" style={{
          background: "radial-gradient(ellipse at 20% 50%, #1a3a5c 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #1c1a4a 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #0d2137 0%, transparent 50%)"
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }} />
      </div>

      {/* Glass card */}
      <div
        className="relative z-10 w-full max-w-[420px] mx-4"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="relative bg-[#12151a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top glow line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#1a9fff]/60 to-transparent" />

          <div className="p-8 pb-6">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a9fff] to-[#0066cc] flex items-center justify-center shadow-[0_4px_12px_rgba(26,159,255,0.3)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <span className="text-lg font-black text-white tracking-[0.2em]">STEALIKE</span>
            </div>

            {!requires2FA ? (
              <form onSubmit={handleSubmit}>
                <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-6">{t("auth.loginButton")}</h2>

                {/* Email */}
                <div className="mb-4">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "email" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.emailPlaceholder")}
                  </label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                    className="w-full px-4 py-3 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50 focus:bg-[#0a0c10]/80 transition-all placeholder-[#3d4450]"
                  />
                </div>

                {/* Password */}
                <div className="mb-6">
                  <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "pass" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                    {t("auth.passwordPlaceholder")}
                  </label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                    className="w-full px-4 py-3 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50 focus:bg-[#0a0c10]/80 transition-all placeholder-[#3d4450]"
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)] hover:shadow-[0_4px_28px_rgba(26,159,255,0.4)]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      {t("auth.loggingIn")}
                    </span>
                  ) : t("auth.loginButton")}
                </button>

                <button
                  type="button" onClick={onForgotPassword}
                  className="w-full mt-3 text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-medium transition-colors text-center"
                >
                  {t("auth.forgotPassword")}
                </button>
              </form>
            ) : (
              <form onSubmit={handle2FASubmit}>
                <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-2">{t("auth.twoFATitle")}</h2>
                <p className="text-[#5e6673] text-xs mb-6">{t("auth.twoFAHint")}</p>

                <div className="mb-6">
                  <input
                    type="text" maxLength={6} value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-4 py-4 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#1a9fff]/50 transition-all"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs font-medium">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || twoFACode.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)]">
                  {loading ? t("auth.verifying") : t("auth.verifyButton")}
                </button>
                <button type="button" onClick={() => { setRequires2FA(false); setTwoFACode(""); setError(""); }}
                  className="w-full mt-3 text-[11px] text-[#5e6673] hover:text-white font-medium transition-colors text-center">
                  {t("auth.goBack")}
                </button>
              </form>
            )}
          </div>

          {/* Bottom section */}
          <div className="px-8 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-1">
              {LANGUAGES.map((lang) => (
                <button key={lang.code} onClick={() => changeLanguage(lang.code)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    i18n.language === lang.code
                      ? "text-white bg-white/[0.08]"
                      : "text-[#3d4450] hover:text-[#8f98a0]"
                  }`}>
                  {lang.code}
                </button>
              ))}
            </div>
            <button onClick={onSwitch} className="text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors">
              {t("auth.registerLink")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
