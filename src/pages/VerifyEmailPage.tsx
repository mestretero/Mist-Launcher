import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";
import { WindowControls } from "../components/WindowControls";
import mistLogo from "../assets/mist-logo.png";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { user, confirmEmail, logout } = useAuthStore();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await confirmEmail(code);
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendSent(false);
    setError("");
    try {
      await api.auth.resendVerification();
      setResendSent(true);
      setCode("");
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      className="relative flex items-center justify-center h-screen overflow-hidden"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <WindowControls />

      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0c10]">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 60% 30%, #1a2a4a 0%, transparent 55%), radial-gradient(ellipse at 40% 70%, #0d2a3a 0%, transparent 55%)",
          }}
        />
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[420px] mx-4"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="relative bg-[#12151a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#1a9fff]/60 to-transparent" />

          <div className="p-8 pb-7">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <img src={mistLogo} alt="MIST" className="h-9 w-9 object-contain rounded-xl" />
              <span className="text-lg font-black text-white tracking-[0.2em]">MIST</span>
            </div>

            {/* Icon + heading */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#1a9fff]/10 border border-[#1a9fff]/20 flex items-center justify-center mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="text-white text-[15px] font-bold uppercase tracking-[0.12em] mb-2">
                {t("auth.verifyEmailTitle")}
              </h2>
              <p className="text-[12px] text-[#5e6673] leading-relaxed max-w-[280px]">
                {t("auth.verifyEmailHint")}{" "}
                <span className="text-[#8f98a0] font-medium">{user?.email}</span>
              </p>
            </div>

            <form onSubmit={handleVerify}>
              {/* OTP input */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block text-[#5e6673]">
                  {t("auth.verifyEmailCodeLabel")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3.5 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-center text-2xl tracking-[0.6em] font-mono focus:outline-none focus:border-[#1a9fff]/50 transition-all placeholder-[#2a2e38]"
                />
              </div>

              {error && (
                <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-xs font-medium">{error}</p>
                </div>
              )}

              {resendSent && (
                <div className="mb-4 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-xs font-medium">{t("settings.account.verificationSent")}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={code.length !== 6 || loading}
                className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-40 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t("auth.verifying")}
                  </span>
                ) : (
                  t("auth.verifyButton")
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors disabled:opacity-50"
            >
              {resendLoading ? "..." : t("settings.security.resend")}
            </button>
            <button
              onClick={logout}
              className="text-[11px] text-[#3d4450] hover:text-[#8f98a0] font-medium transition-colors"
            >
              {t("auth.differentAccount")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
