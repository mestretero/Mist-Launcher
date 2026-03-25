import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import { TwoFactorSetup } from "../components/TwoFactorSetup";

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
  const { user, logout } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [studentEmail, setStudentEmail] = useState("");
  const [studentStatus, setStudentStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [studentError, setStudentError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "payments" | "downloads">("account");
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
    if (activeTab === "payments" && payments.length === 0) {
      setPaymentsLoading(true);
      api.payments.history()
        .then((data) => { if (Array.isArray(data)) setPayments(data); })
        .catch(() => addToast("Ödeme geçmişi yüklenemedi", "error"))
        .finally(() => setPaymentsLoading(false));
    }
  }, [activeTab]);

  const handleVerifyStudent = async () => {
    setStudentStatus("loading");
    setStudentError("");
    try {
      await api.auth.verifyStudent(studentEmail);
      setStudentStatus("success");
      addToast("Öğrenci indirimi aktifleştirildi!", "success");
    } catch (err: any) {
      setStudentError(err.message || "Doğrulama başarısız");
      setStudentStatus("error");
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      addToast("Referans kodu kopyalandı!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: "account" as const, label: "Hesap" },
    { id: "payments" as const, label: "Ödeme Geçmişi" },
    { id: "downloads" as const, label: "İndirmeler" },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

  const statusLabels: Record<string, { text: string; color: string }> = {
    SUCCESS: { text: "Başarılı", color: "text-green-400" },
    PENDING: { text: "Beklemede", color: "text-yellow-400" },
    FAILED: { text: "Başarısız", color: "text-red-400" },
    REFUNDED: { text: "İade Edildi", color: "text-blue-400" },
  };

  return (
    <div className="p-8 max-w-3xl min-h-screen bg-brand-950 font-sans">
      <div className="flex items-center gap-4 mb-8 border-b border-brand-800 pb-4">
        <h1 className="text-2xl font-black text-brand-100 uppercase tracking-widest">Ayarlar</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-brand-900 rounded p-1 border border-brand-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? "bg-brand-800 text-brand-100 shadow-sm"
                : "text-brand-500 hover:text-brand-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {!user?.isEmailVerified && (
            <div className="rounded bg-yellow-900/20 border border-yellow-700/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-yellow-400" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <p className="text-sm font-bold text-yellow-400">E-posta Dogrulanmadi</p>
                  <p className="text-xs text-brand-400 mt-0.5">Hesabinizi dogrulamak icin e-postanizi kontrol edin.</p>
                </div>
              </div>
              <button
                onClick={() => { api.auth.verifyEmail("resend").catch(() => {}); addToast("Dogrulama e-postasi gonderildi", "success"); }}
                className="px-4 py-2 rounded bg-yellow-700/30 text-yellow-400 text-xs font-bold uppercase tracking-widest hover:bg-yellow-700/50 transition-colors"
              >
                Tekrar Gonder
              </button>
            </div>
          )}
          {/* Profile */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Profil Bilgileri</h2>
            <div className="flex items-center gap-6 mb-2">
              <div className="w-16 h-16 rounded flex items-center justify-center text-xl font-black text-brand-950 bg-brand-200">
                {user?.username?.slice(0, 2).toUpperCase() || "?"}
              </div>
              <div>
                <div className="text-xl font-black text-brand-100 uppercase tracking-wider">{user?.username}</div>
                <div className="text-sm font-medium text-brand-400 mt-1">{user?.email}</div>
              </div>
            </div>
          </section>

          {/* Student Discount */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Öğrenci Doğrulaması</h2>
            {user?.isStudent || studentStatus === "success" ? (
              <div className="flex items-center gap-4 bg-brand-950 border border-brand-800 p-4 rounded">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-800">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-200" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <span className="text-brand-200 text-base font-bold tracking-wide">Öğrenci İndirimi Aktif</span>
                  <span className="ml-3 text-xs font-black px-2 py-1 rounded bg-brand-200 text-brand-950">-%10</span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
                  .edu.tr uzantılı e-posta adresinizle doğrulama yaparak %10 öğrenci indirimi kazanabilirsiniz.
                </p>
                <div className="flex gap-4">
                  <input
                    type="email"
                    placeholder="ornek@universite.edu.tr"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="flex-1 px-4 py-3 rounded bg-brand-950 border border-brand-800 text-brand-100 text-sm focus:outline-none focus:border-brand-600 transition-colors placeholder-brand-600"
                  />
                  <button
                    onClick={handleVerifyStudent}
                    disabled={studentStatus === "loading" || !studentEmail.endsWith(".edu.tr")}
                    className="px-6 py-3 rounded bg-brand-200 text-brand-950 text-sm font-black disabled:opacity-50 transition-colors hover:bg-white uppercase tracking-widest"
                  >
                    {studentStatus === "loading" ? "Bekleniyor..." : "Doğrula"}
                  </button>
                </div>
                {studentError && <p className="text-red-400 text-xs mt-3 font-bold">{studentError}</p>}
              </div>
            )}
          </section>

          {/* Referral Code */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Referans Kodu</h2>
            <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
              Referans kodunuzu arkadaşlarınızla paylaşın. Onlar mağazada %5 indirim alırken, siz de %1 cüzdan kredisi kazanın.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 px-4 py-3 rounded bg-brand-950 border border-brand-800 text-base font-black tracking-widest text-brand-200 uppercase flex items-center">
                {user?.referralCode || "—"}
              </div>
              <button
                onClick={copyReferralCode}
                className="px-6 py-3 rounded bg-brand-100 text-brand-950 text-sm font-black transition-colors hover:bg-white uppercase tracking-widest w-40 flex justify-center"
              >
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
          </section>

          {/* Logout */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Oturum</h2>
            <button
              onClick={logout}
              className="px-6 py-3 rounded bg-red-900/30 border border-red-900/50 text-red-400 text-sm font-black uppercase tracking-widest hover:bg-red-900/50 transition-colors"
            >
              Oturumu Kapat
            </button>
          </section>

          {/* Two-Factor Authentication */}
          <TwoFactorSetup
            enabled={!!user?.twoFactorEnabled}
            onClose={() => {}}
          />
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {paymentsLoading ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 rounded-full mx-auto mb-4 border-4 border-brand-800 border-t-brand-200 animate-spin" />
              <p className="text-brand-500 text-xs font-bold uppercase tracking-widest">Yükleniyor...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 bg-brand-900 border border-brand-800 rounded">
              <svg className="mx-auto mb-4 text-brand-700" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <p className="text-brand-500 text-sm font-bold uppercase tracking-widest">Henüz ödeme bulunmuyor</p>
            </div>
          ) : (
            payments.map((payment) => {
              const status = statusLabels[payment.status] || { text: payment.status, color: "text-brand-400" };
              return (
                <div key={payment.id} className="flex items-center gap-4 bg-brand-900 border border-brand-800 rounded p-4 hover:border-brand-700 transition-colors">
                  <img
                    src={payment.game.coverImageUrl}
                    alt={payment.game.title}
                    className="w-16 h-16 rounded object-cover flex-shrink-0 border border-brand-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-brand-100 truncate">{payment.game.title}</div>
                    <div className="text-xs text-brand-500 font-medium mt-1">{formatDate(payment.createdAt)}</div>
                    {payment.installmentCount > 1 && (
                      <div className="text-[10px] text-brand-400 font-bold mt-0.5">{payment.installmentCount} taksit</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-brand-100">{parseFloat(payment.finalAmount).toFixed(2)} TL</div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${status.color}`}>{status.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Downloads Tab */}
      {activeTab === "downloads" && (
        <div className="space-y-6">
          {/* Download Location */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">İndirme Konumu</h2>
            <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
              Oyunların yükleneceği varsayılan klasörü belirleyin.
            </p>
            <div className="flex gap-4">
              <input
                type="text"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                className="flex-1 px-4 py-3 rounded bg-brand-950 border border-brand-800 text-brand-100 text-sm focus:outline-none focus:border-brand-600 transition-colors font-mono"
              />
              <button
                onClick={async () => {
                  try {
                    await api.auth.updatePreferences({ downloadPath });
                    addToast("İndirme konumu güncellendi", "success");
                  } catch { addToast("İndirme konumu kaydedilemedi", "error"); }
                }}
                className="px-6 py-3 rounded bg-brand-200 text-brand-950 text-sm font-black transition-colors hover:bg-white uppercase tracking-widest"
              >
                Kaydet
              </button>
            </div>
          </section>

          {/* Bandwidth Limit */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Bant Genişliği</h2>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-brand-100 font-bold">İndirme Hız Sınırı</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "0", label: "Sınırsız" },
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
                          addToast(`Hız sınırı: ${opt.label}`, "success");
                        } catch { addToast("Hız sınırı kaydedilemedi", "error"); }
                      }}
                      className={`px-4 py-2.5 rounded text-xs font-bold uppercase tracking-widest transition-colors border ${
                        isActive
                          ? "bg-brand-200 text-brand-950 border-brand-200"
                          : "bg-brand-950 text-brand-400 border-brand-800 hover:border-brand-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Cache */}
          <section className="rounded bg-brand-900 border border-brand-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">Önbellek</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-100 font-bold">İndirme Önbelleği</p>
                <p className="text-xs text-brand-500 font-medium mt-1">Geçici dosyalar ve kısmi indirmeler</p>
              </div>
              <button
                onClick={() => addToast("Önbellek temizlendi", "success")}
                className="px-4 py-2 rounded bg-brand-950 border border-brand-800 text-xs font-bold text-brand-300 hover:text-brand-100 hover:border-brand-600 transition-colors uppercase tracking-widest"
              >
                Temizle
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
