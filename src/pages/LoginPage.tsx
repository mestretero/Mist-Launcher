import { useState } from "react";
import mistLogo from "../assets/mist-logo.png";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api, setAccessToken, API_URL } from "../lib/api";

const bgCoverModules = import.meta.glob("../assets/bg-covers/*.jpg", { eager: true, import: "default" });
const BG_COVERS: string[] = (Object.values(bgCoverModules) as string[])
  .map((v) => ({ v, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .map(({ v }) => v);
import { WindowControls } from "../components/WindowControls";
import { LANGUAGES, changeLanguage } from "../i18n";

interface SavedAccount {
  email: string;
  username: string;
  avatarUrl?: string;
}

// ─── Device ID (generated once, stored permanently) ────────────────────────────

function getDeviceId(): string {
  let id = localStorage.getItem("mist_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mist_device_id", id);
  }
  return id;
}

// ─── Saved Accounts (localStorage — not sensitive data) ────────────────────────

function loadSavedAccounts(): SavedAccount[] {
  try {
    const json = localStorage.getItem("mist_saved_accounts");
    if (json) return JSON.parse(json);
  } catch {}
  return [];
}

function saveSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem("mist_saved_accounts", JSON.stringify(accounts));
}

function addSavedAccount(account: SavedAccount) {
  const accounts = loadSavedAccounts();
  const filtered = accounts.filter((a) => a.email !== account.email);
  filtered.unshift(account);
  saveSavedAccounts(filtered.slice(0, 5));
}

function removeSavedAccount(email: string) {
  const accounts = loadSavedAccounts();
  saveSavedAccounts(accounts.filter((a) => a.email !== email));
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LoginPage({ onSwitch, onForgotPassword }: { onSwitch: () => void; onForgotPassword?: () => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");

  // Saved accounts & device
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => loadSavedAccounts());
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [deviceId] = useState<string>(() => getDeviceId());

  const handleSelectAccount = (acc: SavedAccount) => {
    setSelectedAccount(acc);
    setEmail(acc.email);
    setPassword("");
    setError("");
  };

  const handleDeselectAccount = () => {
    setSelectedAccount(null);
    setEmail("");
    setPassword("");
    setError("");
  };

  const handleRemoveAccount = (e: React.MouseEvent, accEmail: string) => {
    e.stopPropagation();
    removeSavedAccount(accEmail);
    const updated = savedAccounts.filter((a) => a.email !== accEmail);
    setSavedAccounts(updated);
    if (selectedAccount?.email === accEmail) handleDeselectAccount();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.login({ email, password, deviceId });
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

      if (rememberMe) {
        addSavedAccount({ email: user.email, username: user.username, avatarUrl: user.avatarUrl });
      }

      useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
      if (result.dailyBonusAwarded) {
        useToastStore.getState().addToast(t("marketplace.dailyBonus"), "success");
      }
    } catch (err: any) {
      const msg: string = err.message || "";
      if (msg.toLowerCase().includes("verify your email")) {
        setError(t("auth.emailNotVerifiedLogin"));
      } else {
        setError(msg || t("auth.loginFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.twoFactor.login(twoFAUserId, twoFACode, deviceId);
      try { await invoke("store_token", { key: "access_token", value: result.tokens.accessToken }); } catch {}
      try { await invoke("store_token", { key: "refresh_token", value: result.tokens.refreshToken }); } catch {}
      setAccessToken(result.tokens.accessToken);

      if (rememberMe) {
        addSavedAccount({ email: result.user.email, username: result.user.username, avatarUrl: result.user.avatarUrl });
      }

      useAuthStore.setState({ user: result.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      setError(err.message || t("auth.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const hasSaved = savedAccounts.length > 0;

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
              <div
                key={col}
                className={col % 2 === 0 ? "animate-scroll-up" : "animate-scroll-down"}
                style={{ animationDuration: `${28 + col * 6}s`, display: "flex", flexDirection: "column", gap: "0.8vw", minWidth: "9vw" }}
              >
                {covers.map((url, i) => (
                  <img key={i} src={url} alt="" className="object-cover rounded-lg flex-shrink-0" style={{ opacity: 0.45, width: "9vw", height: "12.5vw" }} />
                ))}
              </div>
            ))}
          </div>
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #030712cc 0%, #030712aa 50%, #030712cc 100%)", backdropFilter: "blur(1px)" }} />
      </div>

      {/* Glass card */}
      <div
        className={`relative z-10 mx-4 ${hasSaved && !requires2FA ? "w-full max-w-[680px]" : "w-full max-w-[420px]"}`}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="relative bg-[#030712]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#1a9fff]/60 to-transparent" />

          <div className="p-8 pb-6">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
              <img src={mistLogo} alt="MIST" className="h-16 w-16 object-contain rounded-xl" />
            </div>

            {/* ── 2FA Screen ───────────────────────────────────────── */}
            {requires2FA ? (
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

            /* ── Main: Saved accounts + Login form ─────────────────── */
            ) : (
              <div className={hasSaved ? "flex gap-6" : ""}>

                {/* Left side: Saved account cards */}
                {hasSaved && (
                  <div className="w-[200px] flex-shrink-0 border-r border-white/[0.04] pr-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#3d4450] mb-3">
                      {t("auth.savedAccounts")}
                    </p>
                    <div className="space-y-2 mb-3">
                      {savedAccounts.map((acc) => {
                        const isSelected = selectedAccount?.email === acc.email;
                        return (
                          <button
                            key={acc.email}
                            onClick={() => handleSelectAccount(acc)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-left group relative ${
                              isSelected
                                ? "bg-[#1a9fff]/10 border border-[#1a9fff]/30"
                                : "hover:bg-white/[0.03] border border-transparent"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "bg-[#1a9fff]/20" : "bg-[#1a1c23] border border-white/[0.06]"
                            }`}>
                              {acc.avatarUrl ? (
                                <img src={acc.avatarUrl!.startsWith("http") ? acc.avatarUrl : `${API_URL}${acc.avatarUrl}`} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span className={`text-[10px] font-black ${isSelected ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                                  {acc.username.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[12px] font-semibold truncate ${isSelected ? "text-white" : "text-[#8f98a0]"}`}>
                                {acc.username}
                              </p>
                              <p className="text-[10px] text-[#3d4450] truncate">{acc.email}</p>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={(e) => handleRemoveAccount(e, acc.email)}
                              className="absolute right-1.5 top-1.5 w-4 h-4 rounded-full bg-[#1a1c23] border border-white/[0.06] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-red-500/50 hover:bg-red-500/10"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#5e6673] hover:text-red-400">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleDeselectAccount}
                      className="w-full text-[10px] text-[#3d4450] hover:text-[#8f98a0] font-semibold transition-colors text-center py-1"
                    >
                      {t("auth.differentAccount")}
                    </button>
                  </div>
                )}

                {/* Right side: Login form */}
                <div className="flex-1">
                  <form onSubmit={handleLogin}>
                    {selectedAccount ? (
                      /* Selected account → show avatar + just password */
                      <>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-full bg-[#1a1c23] border border-white/[0.06] flex items-center justify-center">
                            {selectedAccount.avatarUrl ? (
                              <img src={selectedAccount.avatarUrl!.startsWith("http") ? selectedAccount.avatarUrl : `${API_URL}${selectedAccount.avatarUrl}`} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-[#1a9fff]">
                                {selectedAccount.username.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{selectedAccount.username}</p>
                            <p className="text-[11px] text-[#5e6673]">{selectedAccount.email}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "pass" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                            {t("auth.passwordPlaceholder")}
                          </label>
                          <input
                            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                            onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                            className="w-full px-4 py-3 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50 focus:bg-[#0a0c10]/80 transition-all placeholder-[#3d4450]"
                          />
                        </div>
                      </>
                    ) : (
                      /* No selection → full form */
                      <>
                        <h2 className="text-white text-sm font-bold uppercase tracking-[0.15em] mb-6">{t("auth.loginButton")}</h2>

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

                        <div className="mb-4">
                          <label className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 block transition-colors ${focused === "pass" ? "text-[#1a9fff]" : "text-[#5e6673]"}`}>
                            {t("auth.passwordPlaceholder")}
                          </label>
                          <input
                            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                            onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                            className="w-full px-4 py-3 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50 focus:bg-[#0a0c10]/80 transition-all placeholder-[#3d4450]"
                          />
                        </div>
                      </>
                    )}

                    {/* Remember me */}
                    <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-[16px] h-[16px] appearance-none rounded border border-white/10 bg-[#0a0c10] checked:bg-[#1a9fff] checked:border-[#1a9fff] transition-colors peer"
                        />
                        <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <span className="text-[11px] text-[#5e6673] group-hover:text-[#8f98a0] transition-colors font-medium">
                        {t("auth.rememberMe")}
                      </span>
                    </label>

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
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <a href="https://discord.gg/mist" target="_blank" rel="noopener noreferrer" className="text-[#5e6673] hover:text-[#5865F2] transition-colors" title="Discord">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="https://github.com/mestretero/Mist-Launcher" target="_blank" rel="noopener noreferrer" className="text-[#5e6673] hover:text-white transition-colors" title="GitHub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <button onClick={onSwitch} className="text-[11px] text-[#5e6673] hover:text-[#1a9fff] font-semibold transition-colors">
                {t("auth.registerLink")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
