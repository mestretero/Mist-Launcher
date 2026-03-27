import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../stores/authStore";
import { api, setAccessToken } from "../lib/api";
import { WindowControls } from "../components/WindowControls";

export function LoginPage({ onSwitch, onForgotPassword }: { onSwitch: () => void; onForgotPassword?: () => void }) {
  const { t } = useTranslation();
  // Auth state updated directly via useAuthStore.setState after login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Call login API directly to check for 2FA
      const result = await api.auth.login({ email, password });
      if (result.requires2FA) {
        setRequires2FA(true);
        setTwoFAUserId(result.userId || "");
        setLoading(false);
        return;
      }
      // Normal login - store tokens and set auth state directly
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

  const inputClass = "w-full px-4 py-3 bg-brand-900 border border-brand-800 rounded text-brand-100 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-600";

  return (
    <div className="flex items-center justify-center h-screen bg-brand-950 font-sans" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <WindowControls />
      <div className="w-full max-w-[400px] p-10 bg-brand-900/50 border border-brand-800 rounded flex flex-col items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>

        <div className="flex items-center gap-3 mb-2 w-full justify-center">
          <div className="w-10 h-10 rounded bg-brand-800 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-widest uppercase">
            Stealike
          </span>
        </div>

        {!requires2FA ? (
          <>
            <p className="text-brand-400 text-sm mb-8 font-medium">{t("auth.loginTitle")}</p>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />

              <input
                type="password"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-brand-400 hover:text-white transition-colors"
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs font-medium text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-brand-200 hover:bg-white text-brand-950 font-bold text-sm rounded transition-colors disabled:opacity-50"
              >
                {loading ? t("auth.loggingIn") : t("auth.loginButton")}
              </button>
            </form>

            <div className="mt-8 text-xs font-medium text-brand-500">
              {t("auth.noAccount")}{" "}
              <button onClick={onSwitch} className="text-white hover:text-brand-300 transition-colors uppercase ml-1">
                {t("auth.registerLink")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-brand-400 text-sm mb-2 font-medium">{t("auth.twoFATitle")}</p>
            <p className="text-brand-500 text-xs mb-6 text-center leading-relaxed">
              {t("auth.twoFAHint")}
            </p>

            <form onSubmit={handle2FASubmit} className="w-full space-y-4">
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={twoFACode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTwoFACode(val);
                }}
                className="w-full px-4 py-3 bg-brand-900 border border-brand-800 rounded text-brand-100 text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-700"
              />

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs font-medium text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || twoFACode.length !== 6}
                className="w-full py-3 bg-brand-200 hover:bg-white text-brand-950 font-bold text-sm rounded transition-colors disabled:opacity-50"
              >
                {loading ? t("auth.verifying") : t("auth.verifyButton")}
              </button>
            </form>

            <button
              onClick={() => { setRequires2FA(false); setTwoFACode(""); setError(""); }}
              className="mt-4 text-xs text-brand-400 hover:text-white transition-colors"
            >
              {t("auth.goBack")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
