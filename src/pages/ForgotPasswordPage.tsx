import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { WindowControls } from "../components/WindowControls";

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const inputClass =
    "w-full px-4 py-3 bg-brand-900 border border-brand-800 rounded text-brand-100 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-600";

  return (
    <div
      className="flex items-center justify-center h-screen bg-brand-950 font-sans"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <WindowControls />
      <div
        className="w-full max-w-[400px] p-10 bg-brand-900/50 border border-brand-800 rounded flex flex-col items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2 w-full justify-center">
          <div className="w-10 h-10 rounded bg-brand-800 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-widest uppercase">
            Stealike
          </span>
        </div>

        <p className="text-brand-400 text-sm mb-8 font-medium uppercase tracking-widest">
          {t("auth.resetTitle")}
        </p>

        {success ? (
          <div className="w-full text-center">
            <div className="mb-6">
              <svg
                className="mx-auto mb-4 text-brand-200"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-sm text-brand-200 font-bold mb-2">
                {t("auth.resetLinkSent")}
              </p>
              <p className="text-sm text-brand-400 font-medium">
                {t("auth.resetLinkSentHint")}
              </p>
            </div>
            <button
              onClick={onBack}
              className="text-sm font-bold text-white hover:text-brand-300 transition-colors uppercase tracking-widest"
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-brand-500 font-medium text-center mb-6 leading-relaxed">
              {t("auth.resetHint")}
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs font-medium text-center">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-brand-200 hover:bg-white text-brand-950 font-bold text-sm rounded transition-colors disabled:opacity-50 uppercase tracking-widest"
              >
                {loading
                  ? t("auth.sending")
                  : t("auth.sendResetLink")}
              </button>
            </form>

            <div className="mt-8 text-xs font-medium text-brand-500">
              <button
                onClick={onBack}
                className="text-white hover:text-brand-300 transition-colors uppercase ml-1"
              >
                {t("auth.backToLogin")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
