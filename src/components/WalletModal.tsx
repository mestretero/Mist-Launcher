import { useState, useEffect, useCallback } from "react";
import type { WalletTransaction } from "../lib/types";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";

interface WalletModalProps {
  onClose: () => void;
}

const PRESET_AMOUNTS = [25, 50, 100, 250];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TypeIcon({ type }: { type: WalletTransaction["type"] }) {
  if (type === "DEPOSIT") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
      </svg>
    );
  }
  if (type === "PURCHASE") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  if (type === "REFERRAL_EARNING") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  // REFUND
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function WalletModal({ onClose }: WalletModalProps) {
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<"balance" | "history">("balance");
  const [amount, setAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load history when switching to history tab
  useEffect(() => {
    if (activeTab === "history" && transactions.length === 0) {
      setHistoryLoading(true);
      api.wallet
        .history()
        .then((data) => {
          if (Array.isArray(data)) setTransactions(data);
        })
        .catch(() => addToast("Cuzdan gecmisi yuklenemedi", "error"))
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab]);

  const handleDeposit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      addToast("Gecerli bir tutar girin", "error");
      return;
    }
    setDepositing(true);
    try {
      await api.wallet.deposit(value.toFixed(2));
      addToast(`${value.toFixed(2)} TL basariyla yuklendi`, "success");
      setAmount("");
      // Refresh user data
      useAuthStore.getState().loadSession();
    } catch (err: any) {
      addToast(err.message || "Yukleme basarisiz", "error");
    } finally {
      setDepositing(false);
    }
  };

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const balance = user?.walletBalance ? parseFloat(user.walletBalance).toFixed(2) : "0.00";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm font-sans"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md bg-brand-900 border border-brand-800 rounded shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-800">
          <h2 className="text-sm font-black uppercase tracking-widest text-brand-100">Cuzdan</h2>
          <button
            onClick={onClose}
            className="text-brand-500 hover:text-brand-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mt-4 bg-brand-950 rounded p-1 border border-brand-800">
          <button
            onClick={() => setActiveTab("balance")}
            className={`flex-1 py-2 rounded text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === "balance"
                ? "bg-brand-800 text-brand-100 shadow-sm"
                : "text-brand-500 hover:text-brand-300"
            }`}
          >
            Bakiye
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 rounded text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === "history"
                ? "bg-brand-800 text-brand-100 shadow-sm"
                : "text-brand-500 hover:text-brand-300"
            }`}
          >
            Gecmis
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "balance" && (
            <div>
              {/* Balance display */}
              <div className="text-center py-6 mb-6 bg-brand-950 border border-brand-800 rounded">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
                  Mevcut Bakiye
                </p>
                <p className="text-3xl font-black text-brand-100">{balance} TL</p>
              </div>

              {/* Preset amounts */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(String(preset))}
                    className={`py-2.5 rounded text-xs font-bold uppercase tracking-widest transition-colors border ${
                      amount === String(preset)
                        ? "bg-brand-200 text-brand-950 border-brand-200"
                        : "bg-brand-950 text-brand-400 border-brand-800 hover:border-brand-600 hover:text-brand-300"
                    }`}
                  >
                    {preset} TL
                  </button>
                ))}
              </div>

              {/* Custom amount input + deposit button */}
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Tutar (TL)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  className="flex-1 px-4 py-3 rounded bg-brand-950 border border-brand-800 text-brand-100 text-sm focus:outline-none focus:border-brand-600 transition-colors placeholder-brand-600"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositing || !amount}
                  className="px-6 py-3 rounded bg-brand-200 text-brand-950 text-sm font-black disabled:opacity-50 transition-colors hover:bg-white uppercase tracking-widest"
                >
                  {depositing ? "..." : "Yukle"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {historyLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 rounded-full mx-auto mb-3 border-4 border-brand-800 border-t-brand-200 animate-spin" />
                  <p className="text-brand-500 text-xs font-bold uppercase tracking-widest">
                    Yukleniyor...
                  </p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto mb-3 text-brand-700" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <p className="text-brand-500 text-sm font-bold uppercase tracking-widest">
                    Henuz islem yok
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {transactions.map((tx) => {
                    const amt = parseFloat(tx.amount);
                    const isPositive = amt > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 p-3 rounded bg-brand-950 border border-brand-800"
                      >
                        <div className="w-8 h-8 rounded flex items-center justify-center bg-brand-900 border border-brand-800 flex-shrink-0">
                          <TypeIcon type={tx.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-brand-200 truncate">
                            {tx.description || tx.type}
                          </p>
                          <p className="text-[10px] text-brand-500 font-medium mt-0.5">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-black flex-shrink-0 ${
                            isPositive ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {amt.toFixed(2)} TL
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
