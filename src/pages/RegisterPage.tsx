import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { WindowControls } from "../components/WindowControls";

function getPasswordStrength(pw: string, t: (key: string) => string): { level: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: t("auth.passwordWeak"), color: "bg-red-500" };
  if (score <= 2) return { level: 2, label: t("auth.passwordFair"), color: "bg-yellow-500" };
  if (score <= 3) return { level: 3, label: t("auth.passwordGood"), color: "bg-blue-500" };
  return { level: 4, label: t("auth.passwordStrong"), color: "bg-green-500" };
}

export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { t } = useTranslation();
  const { register } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError(t("auth.mustAcceptTerms"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (err: any) {
      setError(err.message || t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const strength = password.length > 0 ? getPasswordStrength(password, t) : null;

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

        <p className="text-brand-400 text-sm mb-8 font-medium">{t("auth.registerTitle")}</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <input
            type="text"
            placeholder={t("auth.usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputClass}
          />

          <input
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />

          <div>
            <input
              type="password"
              placeholder={t("auth.passwordMinChars")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
            {strength && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength.level ? strength.color : "bg-brand-800"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-brand-500">
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-brand-800 bg-brand-950 accent-brand-200"
            />
            <span className="text-xs text-brand-400 leading-relaxed">
              <span className="text-brand-300 font-medium">{t("auth.termsOfService")}</span> {t("auth.and")}{" "}
              <span className="text-brand-300 font-medium">{t("auth.privacyPolicy")}</span>{t("auth.termsAcceptSuffix")}
            </span>
          </label>

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
            {loading ? t("auth.registering") : t("auth.registerButton")}
          </button>
        </form>

        <div className="mt-8 text-xs font-medium text-brand-500">
          {t("auth.hasAccount")}{" "}
          <button onClick={onSwitch} className="text-white hover:text-brand-300 transition-colors uppercase ml-1">
            {t("auth.loginLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
