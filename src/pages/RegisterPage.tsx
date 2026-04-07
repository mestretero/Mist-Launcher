import { useState } from "react";
import mistLogo from "../assets/mist-logo.png";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { WindowControls } from "../components/WindowControls";
import { LANGUAGES, changeLanguage } from "../i18n";

const bgCoverModules = import.meta.glob("../assets/bg-covers/*.jpg", { eager: true, import: "default" });
const BG_COVERS: string[] = (Object.values(bgCoverModules) as string[])
  .map((v) => ({ v, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .map(({ v }) => v);

function getPasswordStrength(pw: string, t: (key: string) => string): { level: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: t("auth.passwordWeak"), color: "#ef4444" };
  if (score <= 2) return { level: 2, label: t("auth.passwordFair"), color: "#f97316" };
  if (score <= 3) return { level: 3, label: t("auth.passwordGood"), color: "#3b82f6" };
  return { level: 4, label: t("auth.passwordStrong"), color: "#22c55e" };
}

export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { t, i18n } = useTranslation();
  const { register } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) { setError(t("auth.mustAcceptTerms")); return; }
    setError("");
    setLoading(true);
    try {
      await register(email, username, password, referralCode.trim() || undefined);
    } catch (err: any) {
      const code = err.message;
      if (code === "EMAIL_TAKEN") setError(t("auth.emailTaken"));
      else if (code === "USERNAME_TAKEN") setError(t("auth.usernameTaken"));
      else setError(code || t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const strength = password.length > 0 ? getPasswordStrength(password, t) : null;

  const inputCls = (name: string) =>
    `w-full px-4 py-3 bg-[#0a0c10]/60 border rounded-lg text-white text-sm focus:outline-none transition-all placeholder-[#3d4450] ${
      focused === name ? "border-[#1a9fff]/50 bg-[#0a0c10]/80" : "border-white/[0.06]"
    }`;

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

            <form onSubmit={handleSubmit}>
              <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-6">{t("auth.registerButton")}</h2>

              {/* Username */}
              <div className="mb-3">
                <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "user" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                  {t("auth.usernamePlaceholder")}
                </label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                  onFocus={() => setFocused("user")} onBlur={() => setFocused(null)} className={inputCls("user")} />
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "email" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                  {t("auth.emailPlaceholder")}
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} className={inputCls("email")} />
              </div>

              {/* Password */}
              <div className="mb-5">
                <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "pass" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                  {t("auth.passwordMinChars")}
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)} className={inputCls("pass")} />
                <p className="text-[10px] text-[#3d4450] mt-1">{t("auth.passwordRules")}</p>
                {strength && (
                  <div className="mt-2.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= strength.level ? strength.color : "#1a1c23" }} />
                      ))}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] mt-1.5" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Referral Code */}
              <div className="mb-4">
                <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "ref" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                  {t("auth.referralCodeLabel")}
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  onFocus={() => setFocused("ref")}
                  onBlur={() => setFocused(null)}
                  className={inputCls("ref")}
                  placeholder="FRIEND-CODE"
                  maxLength={20}
                  autoComplete="off"
                />
                {referralCode.trim().length > 0 && (
                  <p className="text-[10px] text-[#1a9fff] mt-1.5 font-medium">
                    {t("auth.referralCodeHint")}
                  </p>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 mb-5 cursor-pointer select-none group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-[18px] h-[18px] appearance-none rounded border border-white/10 bg-[#0a0c10] checked:bg-[#1a9fff] checked:border-[#1a9fff] transition-colors peer" />
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="text-[11px] text-[#5e6673] leading-[1.6]">
                  <a href="https://mistlauncher.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#1a9fff] hover:underline">{t("auth.termsOfService")}</a> {t("auth.and")} <a href="https://mistlauncher.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#1a9fff] hover:underline">{t("auth.privacyPolicy")}</a> {t("auth.termsAcceptSuffix")}
                </span>
              </label>

              {error && (
                <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-xs font-medium">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 tracking-wider shadow-[0_4px_20px_rgba(26,159,255,0.25)] hover:shadow-[0_4px_28px_rgba(26,159,255,0.4)]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {t("auth.registering")}
                  </span>
                ) : t("auth.registerButton")}
              </button>
            </form>
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
            <button onClick={onSwitch} className="text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors">
              {t("auth.loginLink")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
