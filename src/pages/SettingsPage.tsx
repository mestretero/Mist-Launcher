import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { useLocalGameStore } from "../stores/localGameStore";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { TwoFactorSetup } from "../components/TwoFactorSetup";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../components/LanguageSelector";

interface PaymentRecord {
  id: string;
  basePrice: string;
  finalAmount: string;
  installmentCount: number;
  status: string;
  createdAt: string;
  game: { title: string; coverImageUrl: string };
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [studentEmail, setStudentEmail] = useState("");
  const [studentStatus, setStudentStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [studentError, setStudentError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "payments" | "downloads" | "scanner" | "language">("account");
  const { scanConfig, loadScanConfig, updateScanConfig } = useLocalGameStore();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [downloadPath, setDownloadPath] = useState("C:/Games/Stealike");
  const [bandwidthLimit, setBandwidthLimit] = useState("0");

  // Load preferences from user object on mount
  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.downloadPath) setDownloadPath(user.preferences.downloadPath);
      if (user.preferences.bandwidthLimit) setBandwidthLimit(user.preferences.bandwidthLimit);
    }
  }, [user?.preferences]);

  useEffect(() => {
    if (activeTab === "scanner" && !scanConfig) {
      loadScanConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "payments" && payments.length === 0) {
      setPaymentsLoading(true);
      api.payments.history()
        .then((data) => { if (Array.isArray(data)) setPayments(data); })
        .catch(() => addToast(t("settings.payments.error"), "error"))
        .finally(() => setPaymentsLoading(false));
    }
  }, [activeTab]);

  const handleVerifyStudent = async () => {
    setStudentStatus("loading");
    setStudentError("");
    try {
      await api.auth.verifyStudent(studentEmail);
      setStudentStatus("success");
      addToast(t("settings.student.activated"), "success");
    } catch (err: any) {
      setStudentError(err.message || t("settings.student.failed"));
      setStudentStatus("error");
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      addToast(t("settings.referral.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: "account" as const, label: t("settings.tabs.account") },
    { id: "payments" as const, label: t("settings.tabs.payments") },
    { id: "downloads" as const, label: t("settings.tabs.downloads") },
    { id: "scanner" as const, label: t("settings.tabs.scanner") },
    { id: "language" as const, label: t("settings.tabs.language") },
  ];

  const handleScannerAddPath = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir && scanConfig) {
      const newPaths = [...scanConfig.scan_paths, dir as string];
      await updateScanConfig({ ...scanConfig, scan_paths: newPaths });
      addToast(t("settings.scannerSettings.addFolder"), "success");
    }
  };

  const handleScannerRemovePath = async (path: string) => {
    if (scanConfig) {
      const newPaths = scanConfig.scan_paths.filter(p => p !== path);
      await updateScanConfig({ ...scanConfig, scan_paths: newPaths });
    }
  };

  const handleToggleLauncher = async (launcher: string) => {
    if (!scanConfig) return;
    const excluded = scanConfig.exclude_launchers;
    const newExcluded = excluded.includes(launcher)
      ? excluded.filter(l => l !== launcher)
      : [...excluded, launcher];
    await updateScanConfig({ ...scanConfig, exclude_launchers: newExcluded });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

  const statusLabels: Record<string, { text: string; color: string }> = {
    SUCCESS: { text: t("settings.payments.success"), color: "text-green-400" },
    PENDING: { text: t("settings.payments.pending"), color: "text-yellow-400" },
    FAILED: { text: t("settings.payments.failed"), color: "text-red-400" },
    REFUNDED: { text: t("settings.payments.refunded"), color: "text-blue-400" },
  };

  return (
    <div className="flex h-full bg-[#1a1c23] font-sans text-[#c6d4df] overflow-hidden">

      {/* Left Sidebar - Navigation */}
      <div className="w-[300px] flex-shrink-0 bg-[#161920] border-r border-[#2a2e38] flex flex-col p-8 z-10 shadow-2xl">
        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-10 drop-shadow-sm flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          {t("settings.title")}
        </h1>

        <div className="flex flex-col gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-5 py-3.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                  isActive
                    ? "bg-[#2a2e38] text-white shadow-md border-l-4 border-[#47bfff]"
                    : "text-[#8f98a0] hover:text-white hover:bg-[#20232c] border-l-4 border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#1a1c23] to-[#0f1115] custom-scrollbar">
        <div className="max-w-[900px] mx-auto p-12 py-16">

          {/* Main Title Header */}
          <div className="mb-10 border-b border-[#2a2e38] pb-6 flex items-end justify-between">
            <div>
              <h2 className="text-4xl font-black text-white uppercase tracking-widest drop-shadow-md">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-[#8f98a0] mt-2 font-medium text-sm">{t("settings.subtitle")}</p>
            </div>
          </div>

          <div className="space-y-8 pb-32">

            {/* Account Tab Content */}
            {activeTab === "account" && (
              <>
                {!user?.isEmailVerified && (
                  <div className="rounded-xl bg-orange-900/20 border border-orange-700/50 p-5 flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-orange-400" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-black text-orange-400 uppercase tracking-widest">{t("settings.account.emailNotVerified")}</p>
                        <p className="text-xs font-semibold text-orange-400/70 mt-1">{t("settings.account.emailNotVerifiedHint")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { api.auth.verifyEmail("resend").catch(() => {}); addToast(t("settings.account.verificationSent"), "success"); }}
                      className="px-6 py-2.5 rounded text-[11px] font-black uppercase tracking-widest bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 transition-colors"
                    >
                      {t("settings.account.resend")}
                    </button>
                  </div>
                )}

                {/* Profile Box */}
                <section className="bg-gradient-to-tr from-[#161a20] to-[#1a1c23] border border-[#2a2e38] rounded-xl p-8 shadow-xl flex items-center gap-8 relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-[#2a2e38]/20 to-transparent pointer-events-none" />

                  <div className="w-24 h-24 rounded-full bg-[#2a2e38] border-4 border-[#3d4450] flex items-center justify-center shadow-lg relative z-10">
                    <span className="text-4xl font-black text-white">{user?.username?.slice(0, 2).toUpperCase() || "?"}</span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-[#47bfff] uppercase tracking-widest mb-1">{t("settings.account.profile")}</h3>
                    <div className="text-3xl font-black text-white uppercase tracking-wider mb-1">{user?.username}</div>
                    <div className="text-sm font-bold text-[#8f98a0]">{user?.email}</div>
                  </div>
                </section>

                {/* Student Discount Block */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl ring-1 ring-white/5">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 border-b border-[#2a2e38] pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    {t("settings.student.title")}
                  </h3>

                  {user?.isStudent || studentStatus === "success" ? (
                    <div className="flex items-center gap-5 bg-[#2a2e38]/40 border border-[#3d4450] p-5 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-400" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div>
                        <span className="text-purple-400 text-lg font-black tracking-wide block mb-1 uppercase">{t("settings.student.activated")}</span>
                        <span className="text-xs font-bold text-[#8f98a0]">{t("settings.student.hint")}</span>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center justify-center w-16 h-16 rounded-full bg-[#1a1c23] border-4 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                         <span className="font-black text-purple-400">-%10</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-[#8f98a0] font-medium mb-5 leading-relaxed bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                        {t("settings.student.hint")}
                      </p>
                      <div className="flex gap-4">
                        <input
                          type="email"
                          placeholder="ornek@universite.edu.tr"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          className="flex-1 px-5 py-3.5 rounded-lg bg-[#0f1115] border border-[#2a2e38] text-white text-sm focus:outline-none focus:border-[#47bfff] transition-all placeholder-[#5e6673] shadow-inner"
                        />
                        <button
                          onClick={handleVerifyStudent}
                          disabled={studentStatus === "loading" || !studentEmail.endsWith(".edu.tr")}
                          className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-[#47bfff] to-[#1a70cb] text-white text-xs font-black disabled:opacity-50 transition-all hover:scale-105 uppercase tracking-widest shadow-lg"
                        >
                          {studentStatus === "loading" ? t("settings.student.pending") : t("settings.student.activate")}
                        </button>
                      </div>
                      {studentError && <p className="text-red-400 text-xs mt-3 font-bold pl-2">{studentError}</p>}
                    </div>
                  )}
                </section>

                {/* Referral Code Block */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl ring-1 ring-white/5">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 border-b border-[#2a2e38] pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {t("settings.referral.title")}
                  </h3>
                  <p className="text-sm text-[#8f98a0] font-medium mb-5 leading-relaxed bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                    {t("settings.referral.hint")}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 px-5 py-4 rounded-lg bg-[#0f1115] border border-[#2a2e38] text-xl font-black tracking-[0.2em] text-center text-green-400 uppercase shadow-inner">
                      {user?.referralCode || "—"}
                    </div>
                    <button
                      onClick={copyReferralCode}
                      className="px-8 py-4 rounded-lg bg-[#2a2e38] text-white text-xs font-black transition-colors hover:bg-[#3d4450] uppercase tracking-widest min-w-[160px] shadow-lg border border-[#3d4450]"
                    >
                      {copied ? t("settings.referral.copied") : t("settings.referral.copy")}
                    </button>
                  </div>
                </section>

                {/* 2FA Form */}
                <TwoFactorSetup
                  enabled={!!user?.twoFactorEnabled}
                  onClose={() => {}}
                />

                {/* Logout Danger Zone */}
                <section className="bg-red-950/20 border border-red-900/30 rounded-xl p-8 shadow-xl relative overflow-hidden">
                  <h3 className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-4">{t("nav.logout")}</h3>
                  <p className="text-sm text-[#8f98a0] mb-6">{t("settings.subtitle")}</p>
                  <button
                    onClick={logout}
                    className="px-8 py-3 rounded-lg bg-red-900/40 border border-red-900 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-md"
                  >
                    {t("nav.logout")}
                  </button>
                </section>
              </>
            )}

            {/* Payment History Tab Content */}
            {activeTab === "payments" && (
              <div className="space-y-4">
                {paymentsLoading ? (
                  <div className="text-center py-24 bg-[#1a1c23]/60 rounded-xl border border-[#2a2e38]">
                    <div className="w-12 h-12 rounded-full mx-auto mb-6 border-4 border-[#2a2e38] border-t-[#47bfff] animate-spin" />
                    <p className="text-[#8f98a0] text-xs font-black uppercase tracking-widest">{t("common.loading")}</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-24 bg-[#1a1c23]/60 border border-[#2a2e38] rounded-xl flex flex-col items-center">
                    <svg className="mb-6 text-[#3d4450]" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <p className="text-[#8f98a0] text-sm font-black uppercase tracking-widest">{t("settings.payments.error")}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-[#2a2e38] bg-[#1a1c23]/80 backdrop-blur shadow-2xl">
                    {payments.map((payment, idx) => {
                      const status = statusLabels[payment.status] || { text: payment.status, color: "text-[#8f98a0]" };
                      return (
                        <div key={payment.id} className={`flex items-center gap-6 p-6 ${idx !== payments.length -1 ? 'border-b border-[#2a2e38]' : ''} hover:bg-[#20232c] transition-colors`}>
                          <img
                            src={payment.game.coverImageUrl}
                            alt={payment.game.title}
                            className="w-20 h-28 rounded object-cover flex-shrink-0 shadow-md border border-[#2a2e38]"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-black text-white uppercase tracking-widest truncate mb-1">{payment.game.title}</h4>
                            <div className="text-xs font-bold text-[#8f98a0] flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              {formatDate(payment.createdAt)}
                            </div>
                            {payment.installmentCount > 1 && (
                              <div className="inline-block mt-3 px-2 py-1 bg-[#2a2e38] rounded text-[10px] text-[#c6d4df] font-black uppercase tracking-widest border border-[#3d4450]">
                                {payment.installmentCount}x
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 min-w-[120px]">
                            <div className="text-2xl font-black text-white">{parseFloat(payment.finalAmount).toFixed(2)} TL</div>
                            <div className={`inline-block mt-1 px-3 py-1 bg-[#161920] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#2a2e38] ${status.color}`}>
                              {status.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Downloads Tab Content */}
            {activeTab === "downloads" && (
              <div className="space-y-8">
                {/* Download Location */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#47bfff]" />
                    {t("settings.tabs.downloads")}
                  </h3>
                  <p className="text-sm text-[#8f98a0] font-medium mb-5 bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                    {t("settings.downloads.pathUpdated")}
                  </p>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={downloadPath}
                      onChange={(e) => setDownloadPath(e.target.value)}
                      className="flex-1 px-5 py-3.5 rounded-lg bg-[#0f1115] border border-[#2a2e38] text-white text-sm focus:outline-none focus:border-[#47bfff] transition-all font-mono shadow-inner"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await api.auth.updatePreferences({ downloadPath });
                          addToast(t("settings.downloads.pathUpdated"), "success");
                        } catch { addToast(t("settings.downloads.pathError"), "error"); }
                      }}
                      className="px-8 py-3.5 rounded-lg bg-[#2a2e38] text-white text-xs font-black transition-colors hover:bg-[#3d4450] uppercase tracking-widest border border-[#3d4450] shadow-md"
                    >
                      {t("common.save")}
                    </button>
                  </div>
                </section>

                {/* Bandwidth Limit */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#47bfff]" />
                    {t("settings.tabs.downloads")}
                  </h3>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: "0", label: t("settings.downloads.noLimit") },
                        { value: "10485760", label: "10 MB/s" },
                        { value: "5242880", label: "5 MB/s" },
                        { value: "2097152", label: "2 MB/s" },
                        { value: "1048576", label: "1 MB/s" },
                        { value: "524288", label: "512 KB/s" },
                      ].map((opt) => {
                        const isActive = bandwidthLimit === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={async () => {
                              setBandwidthLimit(opt.value);
                              try {
                                await api.auth.updatePreferences({ bandwidthLimit: opt.value });
                                addToast(opt.label, "success");
                              } catch { addToast(t("common.error"), "error"); }
                            }}
                            className={`px-4 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                              isActive
                                ? "bg-[#47bfff]/10 text-[#47bfff] border-[#47bfff] shadow-[0_4px_16px_rgba(71,191,255,0.15)]"
                                : "bg-[#20232c]/50 text-[#67707b] border-[#2a2e38] hover:border-[#3d4450] hover:text-[#8f98a0]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Cache Clear */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-6 shadow-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">{t("settings.tabs.downloads")}</h3>
                    <p className="text-xs font-bold text-[#67707b]">{t("settings.downloads.cacheCleared")}</p>
                  </div>
                  <button
                    onClick={() => addToast(t("settings.downloads.cacheCleared"), "success")}
                    className="px-6 py-2.5 rounded-lg bg-[#2a2e38] border border-[#3d4450] text-[#c6d4df] hover:bg-[#3d4450] hover:text-white transition-all text-xs font-black uppercase tracking-widest shadow-md"
                  >
                    {t("common.delete")}
                  </button>
                </section>
              </div>
            )}

            {/* Scanner Tab Content */}
            {activeTab === "scanner" && (
              <div className="space-y-8">
                {/* Scan Paths */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 border-b border-[#2a2e38] pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    {t("settings.scannerSettings.scanPaths")}
                  </h3>
                  <p className="text-sm text-[#8f98a0] font-medium mb-6 bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                    {t("settings.scannerSettings.title")}
                  </p>

                  {!scanConfig ? (
                    <div className="flex items-center gap-3 text-[#47bfff] font-bold text-sm bg-[#1a1c23] p-6 rounded-xl border border-[#2a2e38]">
                      <div className="w-5 h-5 border-2 border-[#47bfff] border-t-transparent rounded-full animate-spin" />
                      {t("common.loading")}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-6">
                        {scanConfig.scan_paths.length === 0 && (
                          <div className="text-center py-10 bg-[#0f1115] border border-dashed border-[#2a2e38] rounded-xl text-[#5e6673] font-bold uppercase tracking-widest text-xs">
                            {t("settings.scannerSettings.scanPaths")}
                          </div>
                        )}
                        {scanConfig.scan_paths.map((path) => (
                          <div key={path} className="flex items-center justify-between bg-[#0f1115] border border-[#2a2e38] rounded-lg px-5 py-3">
                            <span className="text-white text-sm font-mono truncate flex-1 tracking-wide">{path}</span>
                            <button
                              onClick={() => handleScannerRemovePath(path)}
                              className="text-red-400 hover:text-red-300 bg-red-900/10 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors border border-red-900/30"
                            >
                              {t("scanner.remove")}
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleScannerAddPath}
                        className="px-6 py-3 rounded-lg bg-[#2a2e38] text-white text-xs font-black transition-colors hover:bg-[#3d4450] uppercase tracking-widest border border-[#3d4450] shadow-md flex items-center gap-2 justify-center w-full"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        {t("settings.scannerSettings.addFolder")}
                      </button>
                    </>
                  )}
                </section>

                {/* Launcher Filters */}
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl">
                   <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 border-b border-[#2a2e38] pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {t("settings.scannerSettings.launcherFilters")}
                  </h3>
                  <p className="text-sm text-[#8f98a0] font-medium mb-6">
                    {t("settings.scannerSettings.launcherFilters")}
                  </p>

                  {!scanConfig ? (
                    <div className="h-20 bg-[#2a2e38]/50 animate-pulse rounded-xl" />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {["steam", "epic", "ubisoft", "ea", "gog", "battlenet"].map((launcher) => {
                        const isExcluded = scanConfig.exclude_launchers.includes(launcher);
                        return (
                          <label key={launcher} className={`flex items-center gap-4 cursor-pointer group p-4 rounded-xl border-2 transition-all ${isExcluded ? 'bg-red-950/20 border-red-900/50' : 'bg-[#0f1115] border-[#2a2e38] hover:border-[#3d4450]'}`}>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={isExcluded}
                                onChange={() => handleToggleLauncher(launcher)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border ${isExcluded ? 'bg-red-500 border-red-500' : 'bg-[#1a1c23] border-[#3d4450]'} flex items-center justify-center transition-colors`}>
                                {isExcluded && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                            </div>
                            <div className="flex flex-col">
                               <span className={`text-sm font-black uppercase tracking-widest ${isExcluded ? 'text-red-400' : 'text-white'}`}>{launcher}</span>
                               <span className={`text-[10px] font-bold ${isExcluded ? 'text-red-500/70 block' : 'hidden'}`}>{t("settings.scannerSettings.launcherFilters")}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Language Tab Content */}
            {activeTab === "language" && (
              <div className="space-y-8">
                <section className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 shadow-xl">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-6 border-b border-[#2a2e38] pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#47bfff]" />
                    {t("settings.language.title")}
                  </h3>
                  <p className="text-sm text-[#8f98a0] font-medium mb-6">
                    {t("settings.language.hint")}
                  </p>
                  <LanguageSelector />
                </section>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
