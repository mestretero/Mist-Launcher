import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { useLocalGameStore } from "../stores/localGameStore";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import { LANGUAGES, changeLanguage } from "../i18n";

type Tab = "account" | "security" | "privacy" | "notifications" | "scanner" | "language";

// ─── Shared UI Atoms ───────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
        on ? "bg-[#1a9fff]" : "bg-[#202530]"
      }`}
    >
      <span
        className={`inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          on ? "translate-x-[22px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  desc,
  children,
  noBorder,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 py-3.5 ${
        !noBorder ? "border-b border-white/[0.04]" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#c6d4df] leading-snug">{label}</p>
        {desc && (
          <p className="text-[11px] text-[#4a5260] mt-0.5 leading-relaxed">{desc}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3a4050] mb-2.5 px-0.5">
        {label}
      </p>
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0f16] overflow-hidden px-5">
        {children}
      </div>
    </div>
  );
}

// ─── Nav Icons ─────────────────────────────────────────────────────────────────

const icons: Record<Tab, React.ReactNode> = {
  account: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" />
    </svg>
  ),
  security: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  privacy: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  notifications: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  scanner: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </svg>
  ),
  language: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

// ─── Main Component ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, logout, loadSession, updateUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { scanConfig, loadScanConfig, updateScanConfig } = useLocalGameStore();

  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [copied, setCopied] = useState(false);

  // 2FA state
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCode, setQrCode] = useState("");
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);

  // Email verification state
  const [emailCode, setEmailCode] = useState("");
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);

  // Privacy prefs (from user.preferences)
  const prefs = (user?.preferences ?? {}) as Record<string, unknown>;
  const [profilePublic, setProfilePublic] = useState(prefs.profilePublic !== false);
  const [libraryPublic, setLibraryPublic] = useState(prefs.libraryPublic !== false);
  const [achievementsPublic, setAchievementsPublic] = useState(prefs.achievementsPublic !== false);

  // Notification prefs
  const [notifyFriends, setNotifyFriends] = useState(prefs.notifyFriendRequests !== false);
  const [notifyGroups, setNotifyGroups] = useState(prefs.notifyGroupMessages !== false);
  const [notifyAchievements, setNotifyAchievements] = useState(prefs.notifyAchievements !== false);
  const [notifySystem, setNotifySystem] = useState(prefs.notifySystem !== false);

  useEffect(() => {
    if (activeTab === "scanner" && !scanConfig) loadScanConfig();
  }, [activeTab]);

  const savePreference = async (key: string, value: unknown) => {
    try {
      await api.auth.updatePreferences({ [key]: value });
    } catch {
      addToast(t("common.error"), "error");
    }
  };

  const copyReferral = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      addToast(t("settings.referral.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 2FA actions
  const handleEnable2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaError("");
    try {
      const res = await api.auth.twoFactor.setup();
      setQrCode(res.qrCodeDataUrl);
      setTwoFaSecret(res.secret);
      setTwoFaStep("setup");
    } catch (err: any) {
      setTwoFaError(err.message || t("twoFactor.setupFailed"));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFaCode.length !== 6) return;
    setTwoFaLoading(true);
    setTwoFaError("");
    try {
      await api.auth.twoFactor.verify(twoFaCode);
      updateUser({ twoFactorEnabled: true });
      addToast(t("twoFactor.activated"), "success");
      setTwoFaStep("idle");
      setTwoFaCode("");
      await loadSession();
    } catch (err: any) {
      setTwoFaError(err.message || t("twoFactor.invalidCode"));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setTwoFaLoading(true);
    try {
      await api.auth.twoFactor.disable();
      updateUser({ twoFactorEnabled: false });
      addToast(t("twoFactor.disabled"), "info");
      setConfirmDisable(false);
      await loadSession();
    } catch {
      addToast(t("twoFactor.disableFailed"), "error");
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Scanner actions
  const addScanPath = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir && scanConfig) {
      await updateScanConfig({ ...scanConfig, scan_paths: [...scanConfig.scan_paths, dir as string] });
      addToast(t("settings.scannerSettings.addFolder"), "success");
    }
  };

  const removeScanPath = async (path: string) => {
    if (scanConfig) {
      await updateScanConfig({ ...scanConfig, scan_paths: scanConfig.scan_paths.filter((p) => p !== path) });
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString(i18n.language === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const NAV_TABS: Tab[] = ["account", "security", "privacy", "notifications", "scanner", "language"];

  return (
    <div className="flex h-full bg-[#0b0d11] font-sans text-[#c6d4df] overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className="w-[210px] flex-shrink-0 flex flex-col border-r border-white/[0.05] bg-[#0d1018] pt-8 pb-4">
        {/* Title */}
        <div className="px-5 mb-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#3a4050]">
            {t("settings.title")}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-2 flex-1">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] font-medium transition-all text-left ${
                  isActive
                    ? "bg-[#1a1f2e] text-[#1a9fff]"
                    : "text-[#5e6673] hover:text-[#c6d4df] hover:bg-white/[0.03]"
                }`}
              >
                <span className={isActive ? "text-[#1a9fff]" : "text-[#3d4450]"}>
                  {icons[tab]}
                </span>
                {t(`settings.tabs.${tab}`)}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        {user && (
          <div className="px-4 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1a1f2e] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-black text-[#1a9fff]">
                  {user.username?.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#8f98a0] truncate">{user.username}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[640px] mx-auto px-8 py-10 pb-20">

          {/* ─ Account Tab ─────────────────────────────────────────────────── */}
          {activeTab === "account" && (
            <>
              {/* Profile section */}
              <SectionBlock label={t("settings.account.profile")}>
                <div className="py-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1a1f2e] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-black text-[#1a9fff]">
                      {user?.username?.slice(0, 2).toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">{user?.username}</p>
                    <p className="text-[12px] text-[#5e6673] mt-0.5">{user?.email}</p>
                    {user?.createdAt && (
                      <p className="text-[11px] text-[#3d4450] mt-0.5">
                        {t("settings.account.memberSince")} {formatDate(user.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              </SectionBlock>

              {/* Referral code */}
              <SectionBlock label={t("settings.referral.title")}>
                <div className="py-3.5">
                  <p className="text-[11px] text-[#4a5260] mb-3 leading-relaxed">
                    {t("settings.referral.hint")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-2.5 rounded-lg bg-[#080a0f] border border-white/[0.06] font-mono text-[14px] font-bold text-[#1a9fff] tracking-[0.12em]">
                      {user?.referralCode ?? "—"}
                    </div>
                    <button
                      onClick={copyReferral}
                      className={`px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all border ${
                        copied
                          ? "bg-green-500/10 border-green-500/30 text-green-400"
                          : "bg-[#1a1f2e] border-white/[0.07] text-[#8f98a0] hover:text-white hover:border-white/[0.15]"
                      }`}
                    >
                      {copied ? (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          {t("settings.referral.copied")}
                        </span>
                      ) : t("settings.referral.copy")}
                    </button>
                  </div>
                </div>
              </SectionBlock>

              {/* Logout */}
              <SectionBlock label={t("settings.account.logout")}>
                <SettingRow label={t("settings.account.logout")} desc={t("settings.account.logoutHint")} noBorder>
                  <button
                    onClick={logout}
                    className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-colors"
                  >
                    {t("settings.account.logout")}
                  </button>
                </SettingRow>
              </SectionBlock>
            </>
          )}

          {/* ─ Security Tab ────────────────────────────────────────────────── */}
          {activeTab === "security" && (
            <>
              {/* Email Verification */}
              <SectionBlock label={t("settings.security.emailSection")}>
                {user?.isEmailVerified ? (
                  <SettingRow
                    label={t("settings.security.emailVerified")}
                    desc={user.email}
                    noBorder
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      {t("settings.security.emailVerified")}
                    </span>
                  </SettingRow>
                ) : (
                  <div className="py-3.5 space-y-3">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/[0.07] border border-amber-500/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div>
                        <p className="text-[12px] font-medium text-amber-400">{t("settings.security.emailNotVerified")}</p>
                        <p className="text-[11px] text-amber-400/60 mt-0.5">{user?.email}</p>
                      </div>
                    </div>

                    {!emailCodeSent ? (
                      <button
                        onClick={async () => {
                          setEmailVerifyLoading(true);
                          setEmailVerifyError("");
                          try {
                            await api.auth.resendVerification();
                            setEmailCodeSent(true);
                            addToast(t("settings.account.verificationSent"), "success");
                          } catch (err: any) {
                            setEmailVerifyError(err.message || t("common.error"));
                          } finally {
                            setEmailVerifyLoading(false);
                          }
                        }}
                        disabled={emailVerifyLoading}
                        className="px-4 py-2 rounded-lg bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] text-[12px] font-semibold hover:bg-[#1a9fff]/20 transition-colors disabled:opacity-50"
                      >
                        {emailVerifyLoading ? "..." : t("settings.security.resend")}
                      </button>
                    ) : (
                      <>
                        <p className="text-[12px] text-[#8f98a0]">{t("settings.security.enterCode")}</p>
                        <input
                          type="text"
                          maxLength={6}
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          autoFocus
                          className="w-full px-4 py-3 rounded-lg bg-[#080a0f] border border-white/[0.06] text-white text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#1a9fff]/50 transition-colors placeholder-[#2a2e38]"
                        />
                        {emailVerifyError && <p className="text-red-400 text-[11px] font-medium">{emailVerifyError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (emailCode.length !== 6) return;
                              setEmailVerifyLoading(true);
                              setEmailVerifyError("");
                              try {
                                await api.auth.verifyEmail(emailCode);
                                updateUser({ isEmailVerified: true });
                                addToast(t("settings.security.emailVerified"), "success");
                                setEmailCodeSent(false);
                                setEmailCode("");
                              } catch (err: any) {
                                setEmailVerifyError(err.message || t("common.error"));
                              } finally {
                                setEmailVerifyLoading(false);
                              }
                            }}
                            disabled={emailCode.length !== 6 || emailVerifyLoading}
                            className="px-4 py-2 rounded-lg bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] text-[12px] font-semibold hover:bg-[#1a9fff]/20 transition-colors disabled:opacity-40"
                          >
                            {emailVerifyLoading ? "..." : t("settings.security.verify")}
                          </button>
                          <button
                            onClick={async () => {
                              setEmailVerifyLoading(true);
                              try {
                                await api.auth.resendVerification();
                                setEmailCode("");
                                setEmailVerifyError("");
                                addToast(t("settings.account.verificationSent"), "success");
                              } catch {
                                addToast(t("common.error"), "error");
                              } finally {
                                setEmailVerifyLoading(false);
                              }
                            }}
                            disabled={emailVerifyLoading}
                            className="px-4 py-2 rounded-lg bg-[#1a1f2e] text-[#8f98a0] text-[12px] font-medium hover:text-white transition-colors disabled:opacity-50"
                          >
                            {t("settings.security.resend")}
                          </button>
                        </div>
                      </>
                    )}
                    {emailVerifyError && !emailCodeSent && <p className="text-red-400 text-[11px] font-medium">{emailVerifyError}</p>}
                  </div>
                )}
              </SectionBlock>

              {/* Two-Factor Authentication */}
              <SectionBlock label={t("settings.security.twoFaSection")}>
                <div className="py-3.5">
                  <p className="text-[11px] text-[#4a5260] mb-4 leading-relaxed">
                    {t("settings.security.twoFaHint")}
                  </p>

                  {/* Microsoft Authenticator badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a0e18] border border-white/[0.06] text-[10px] text-[#5e6673] font-medium">
                      <span className="w-2 h-2 rounded-full bg-[#00a4ef]" />
                      Microsoft Authenticator
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a0e18] border border-white/[0.06] text-[10px] text-[#5e6673] font-medium">
                      <span className="w-2 h-2 rounded-full bg-[#4285f4]" />
                      Google Authenticator
                    </div>
                  </div>

                  {/* 2FA Status */}
                  {user?.twoFactorEnabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/[0.07] border border-green-500/20">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 flex-shrink-0">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <p className="text-[12px] font-medium text-green-400">{t("settings.security.twoFaActive")}</p>
                      </div>

                      {!confirmDisable ? (
                        <button
                          onClick={() => setConfirmDisable(true)}
                          className="text-[12px] font-medium text-[#5e6673] hover:text-red-400 transition-colors"
                        >
                          {t("settings.security.disableTwoFa")}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDisable2FA}
                            disabled={twoFaLoading}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {twoFaLoading ? "..." : t("settings.security.confirmDisable")}
                          </button>
                          <button
                            onClick={() => setConfirmDisable(false)}
                            className="px-3 py-1.5 rounded-lg bg-[#1a1f2e] text-[#8f98a0] text-[12px] font-medium hover:text-white transition-colors"
                          >
                            {t("settings.security.cancel")}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : twoFaStep === "idle" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0a0e18] border border-white/[0.06]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[#4a5260] flex-shrink-0">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <p className="text-[12px] text-[#4a5260]">{t("settings.security.twoFaInactive")}</p>
                      </div>
                      <button
                        onClick={handleEnable2FA}
                        disabled={twoFaLoading}
                        className="px-4 py-2 rounded-lg bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] text-[12px] font-semibold hover:bg-[#1a9fff]/20 transition-colors disabled:opacity-50"
                      >
                        {twoFaLoading ? t("twoFactor.loading") : t("settings.security.enableTwoFa")}
                      </button>
                      {twoFaError && <p className="text-red-400 text-[11px] font-medium">{twoFaError}</p>}
                    </div>
                  ) : twoFaStep === "setup" ? (
                    <div className="space-y-4">
                      <p className="text-[12px] text-[#8f98a0] leading-relaxed">{t("settings.security.scanQr")}</p>

                      {qrCode && (
                        <div className="w-[160px] h-[160px] rounded-xl overflow-hidden border border-white/[0.08] bg-white p-2">
                          <img src={qrCode} alt="2FA QR" className="w-full h-full object-contain" />
                        </div>
                      )}

                      {twoFaSecret && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#3d4450] mb-1.5">
                            {t("settings.security.manualKey")}
                          </p>
                          <code className="block text-[11px] font-mono text-[#8f98a0] bg-[#080a0f] border border-white/[0.06] px-3 py-2 rounded-lg select-all">
                            {twoFaSecret}
                          </code>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setTwoFaStep("verify")}
                          className="px-4 py-2 rounded-lg bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] text-[12px] font-semibold hover:bg-[#1a9fff]/20 transition-colors"
                        >
                          {t("twoFactor.continueBtn")}
                        </button>
                        <button
                          onClick={() => setTwoFaStep("idle")}
                          className="px-4 py-2 rounded-lg bg-[#1a1f2e] text-[#8f98a0] text-[12px] font-medium hover:text-white transition-colors"
                        >
                          {t("settings.security.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[12px] text-[#8f98a0]">{t("settings.security.enterCode")}</p>
                      <input
                        type="text"
                        maxLength={6}
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        autoFocus
                        className="w-full px-4 py-3 rounded-lg bg-[#080a0f] border border-white/[0.06] text-white text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#1a9fff]/50 transition-colors placeholder-[#2a2e38]"
                      />
                      {twoFaError && <p className="text-red-400 text-[11px] font-medium">{twoFaError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleVerify2FA}
                          disabled={twoFaCode.length !== 6 || twoFaLoading}
                          className="px-4 py-2 rounded-lg bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] text-[12px] font-semibold hover:bg-[#1a9fff]/20 transition-colors disabled:opacity-40"
                        >
                          {twoFaLoading ? "..." : t("settings.security.verify")}
                        </button>
                        <button
                          onClick={() => { setTwoFaStep("setup"); setTwoFaError(""); setTwoFaCode(""); }}
                          className="px-4 py-2 rounded-lg bg-[#1a1f2e] text-[#8f98a0] text-[12px] font-medium hover:text-white transition-colors"
                        >
                          {t("settings.security.back")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </SectionBlock>
            </>
          )}

          {/* ─ Privacy Tab ─────────────────────────────────────────────────── */}
          {activeTab === "privacy" && (
            <SectionBlock label={t("settings.privacy.profileSection")}>
              <SettingRow
                label={t("settings.privacy.profilePublic")}
                desc={t("settings.privacy.profilePublicHint")}
              >
                <Toggle
                  on={profilePublic}
                  onChange={(v) => {
                    setProfilePublic(v);
                    savePreference("profilePublic", v);
                  }}
                />
              </SettingRow>
              <SettingRow
                label={t("settings.privacy.libraryPublic")}
                desc={t("settings.privacy.libraryPublicHint")}
              >
                <Toggle
                  on={libraryPublic}
                  onChange={(v) => {
                    setLibraryPublic(v);
                    savePreference("libraryPublic", v);
                  }}
                />
              </SettingRow>
              <SettingRow
                label={t("settings.privacy.achievementsPublic")}
                desc={t("settings.privacy.achievementsPublicHint")}
                noBorder
              >
                <Toggle
                  on={achievementsPublic}
                  onChange={(v) => {
                    setAchievementsPublic(v);
                    savePreference("achievementsPublic", v);
                  }}
                />
              </SettingRow>
            </SectionBlock>
          )}

          {/* ─ Notifications Tab ───────────────────────────────────────────── */}
          {activeTab === "notifications" && (
            <SectionBlock label={t("settings.notifications.title")}>
              <SettingRow
                label={t("settings.notifications.friendRequests")}
                desc={t("settings.notifications.friendRequestsHint")}
              >
                <Toggle
                  on={notifyFriends}
                  onChange={(v) => {
                    setNotifyFriends(v);
                    savePreference("notifyFriendRequests", v);
                  }}
                />
              </SettingRow>
              <SettingRow
                label={t("settings.notifications.groupMessages")}
                desc={t("settings.notifications.groupMessagesHint")}
              >
                <Toggle
                  on={notifyGroups}
                  onChange={(v) => {
                    setNotifyGroups(v);
                    savePreference("notifyGroupMessages", v);
                  }}
                />
              </SettingRow>
              <SettingRow
                label={t("settings.notifications.achievements")}
                desc={t("settings.notifications.achievementsHint")}
              >
                <Toggle
                  on={notifyAchievements}
                  onChange={(v) => {
                    setNotifyAchievements(v);
                    savePreference("notifyAchievements", v);
                  }}
                />
              </SettingRow>
              <SettingRow
                label={t("settings.notifications.system")}
                desc={t("settings.notifications.systemHint")}
                noBorder
              >
                <Toggle
                  on={notifySystem}
                  onChange={(v) => {
                    setNotifySystem(v);
                    savePreference("notifySystem", v);
                  }}
                />
              </SettingRow>
            </SectionBlock>
          )}

          {/* ─ Scanner Tab ─────────────────────────────────────────────────── */}
          {activeTab === "scanner" && (
            <SectionBlock label={t("settings.scannerSettings.title")}>
              <div className="py-3.5 space-y-3">
                <p className="text-[11px] text-[#4a5260] leading-relaxed">
                  {t("settings.scannerSettings.scanPathsHint")}
                </p>

                {!scanConfig ? (
                  <div className="flex items-center gap-2 text-[#4a5260] text-[12px]">
                    <div className="w-4 h-4 border-2 border-[#3d4450] border-t-[#1a9fff] rounded-full animate-spin" />
                    {t("common.loading")}
                  </div>
                ) : (
                  <>
                    {scanConfig.scan_paths.length === 0 ? (
                      <p className="text-[12px] text-[#3d4450] py-2">{t("settings.scannerSettings.noFolders")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {scanConfig.scan_paths.map((path) => (
                          <div
                            key={path}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#080a0f] border border-white/[0.05]"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[#3d4450] flex-shrink-0">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className="text-[12px] font-mono text-[#8f98a0] truncate flex-1">{path}</span>
                            <button
                              onClick={() => removeScanPath(path)}
                              className="text-[#3d4450] hover:text-red-400 transition-colors flex-shrink-0"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={addScanPath}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/[0.1] text-[#5e6673] hover:text-[#c6d4df] hover:border-white/[0.2] text-[12px] font-medium transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {t("settings.scannerSettings.addFolder")}
                    </button>
                  </>
                )}
              </div>
            </SectionBlock>
          )}

          {/* ─ Language Tab ────────────────────────────────────────────────── */}
          {activeTab === "language" && (
            <SectionBlock label={t("settings.language.title")}>
              <div className="py-3">
                <p className="text-[11px] text-[#4a5260] mb-4 leading-relaxed">{t("settings.language.hint")}</p>
                <div className="space-y-1">
                  {LANGUAGES.map((lang) => {
                    const isActive = i18n.language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left ${
                          isActive
                            ? "bg-[#1a1f2e] border border-[#1a9fff]/20"
                            : "hover:bg-white/[0.02] border border-transparent"
                        }`}
                      >
                        <span className="text-xl leading-none">{lang.flag}</span>
                        <div className="flex-1">
                          <p className={`text-[13px] font-semibold ${isActive ? "text-white" : "text-[#8f98a0]"}`}>
                            {lang.name}
                          </p>
                          <p className="text-[10px] text-[#3d4450] uppercase tracking-wider mt-0.5">{lang.code}</p>
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a9fff]">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SectionBlock>
          )}

        </div>
      </div>
    </div>
  );
}
