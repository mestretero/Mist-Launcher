import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api, API_URL } from "../lib/api";
import { CURRENCY_NAME } from "../lib/constants";

interface Theme {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  category: string;
}

type Filter = "all" | "game" | "crossover" | "owned";

export function MarketplacePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);

  useEffect(() => {
    Promise.all([
      api.marketplace.getThemes(),
      api.marketplace.getMyThemes(),
    ]).then(([themeList, owned]) => {
      setThemes(Array.isArray(themeList) ? themeList : []);
      setOwnedIds(Array.isArray(owned) ? owned : []);
    }).catch(() => addToast(t("common.error"), "error"))
      .finally(() => setLoading(false));
  }, []);

  const balance = user?.walletBalance ? Number(user.walletBalance) : 0;

  const filtered = themes.filter((theme) => {
    if (filter === "owned") return ownedIds.includes(theme.id);
    if (filter === "game") return theme.category === "game";
    if (filter === "crossover") return theme.category === "crossover";
    return true;
  });

  const handlePurchase = async (themeId: string) => {
    setPurchasing(themeId);
    try {
      const result = await api.marketplace.purchase(themeId);
      setOwnedIds((prev) => [...prev, themeId]);
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, walletBalance: String(result.newBalance) } : s.user,
      }));
      addToast(t("marketplace.purchaseSuccess"), "success");
      setPreviewTheme(null);
    } catch (err: any) {
      addToast(err?.message || t("common.error"), "error");
    } finally {
      setPurchasing(null);
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("marketplace.all") },
    { key: "game", label: t("marketplace.games") },
    { key: "crossover", label: t("marketplace.crossovers") },
    { key: "owned", label: t("marketplace.myThemes") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0c10]">
        <svg className="animate-spin text-[#1a9fff]" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0c10] overflow-y-auto custom-scrollbar">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-widest">{t("marketplace.title")}</h1>
            <p className="text-sm text-[#5e6673] mt-1">{t("marketplace.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="text-lg font-black text-[#1a9fff]">{balance}</span>
            <span className="text-xs font-bold text-[#5e6673] uppercase">{CURRENCY_NAME}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                filter === f.key
                  ? "bg-[#1a9fff] text-white"
                  : "bg-[#1a1c23] text-[#5e6673] hover:text-white border border-[#2a2e38]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((theme) => {
            const owned = ownedIds.includes(theme.id);
            const isFree = theme.price === 0;
            const canAfford = balance >= theme.price;
            const imgUrl = theme.imageUrl.startsWith("http") ? theme.imageUrl : `${API_URL}${theme.imageUrl}`;

            return (
              <div
                key={theme.id}
                className="group bg-[#1a1c23] border border-[#2a2e38] rounded-xl overflow-hidden hover:border-[#1a9fff]/40 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:shadow-[#1a9fff]/5"
                onClick={() => setPreviewTheme(theme)}
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={theme.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-transparent to-transparent" />

                  {/* Category badge */}
                  <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                    theme.category === "crossover"
                      ? "bg-purple-500/80 text-white"
                      : theme.category === "game"
                      ? "bg-emerald-500/80 text-white"
                      : "bg-[#1a9fff]/80 text-white"
                  }`}>
                    {theme.category === "crossover" ? t("marketplace.categoryCrossover") :
                     theme.category === "game" ? t("marketplace.categoryGame") :
                     t("marketplace.categoryDefault")}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white truncate">{theme.name}</h3>

                  {isFree ? (
                    <span className="px-3 py-1.5 rounded-lg bg-[#1a9fff]/10 text-[#1a9fff] text-[10px] font-black uppercase tracking-widest">
                      {t("marketplace.free")}
                    </span>
                  ) : owned ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                      {t("marketplace.owned")}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canAfford) { addToast(t("marketplace.insufficientBalance"), "error"); return; }
                        handlePurchase(theme.id);
                      }}
                      disabled={purchasing === theme.id}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        "bg-[#1a9fff] text-white hover:bg-[#1a9fff]/80 active:scale-95"
                      }`}
                    >
                      {purchasing === theme.id ? "..." : `${theme.price} ${CURRENCY_NAME}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3d4450" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
            <p className="text-sm text-[#5e6673]">{t("marketplace.noThemes")}</p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewTheme(null)}>
          <div className="max-w-4xl w-full mx-4 bg-[#1a1c23] border border-[#2a2e38] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Full image */}
            <div className="relative aspect-video">
              <img
                src={previewTheme.imageUrl.startsWith("http") ? previewTheme.imageUrl : `${API_URL}${previewTheme.imageUrl}`}
                alt={previewTheme.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setPreviewTheme(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Modal footer */}
            <div className="p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">{previewTheme.name}</h2>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  previewTheme.category === "crossover" ? "text-purple-400" :
                  previewTheme.category === "game" ? "text-emerald-400" : "text-[#1a9fff]"
                }`}>
                  {previewTheme.category === "crossover" ? t("marketplace.categoryCrossover") :
                   previewTheme.category === "game" ? t("marketplace.categoryGame") :
                   t("marketplace.categoryDefault")}
                </span>
              </div>

              {previewTheme.price === 0 ? (
                <span className="px-5 py-2.5 rounded-xl bg-[#1a9fff]/10 text-[#1a9fff] text-xs font-black uppercase tracking-widest">
                  {t("marketplace.free")}
                </span>
              ) : ownedIds.includes(previewTheme.id) ? (
                <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-widest">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  {t("marketplace.owned")}
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (balance < previewTheme.price) { addToast(t("marketplace.insufficientBalance"), "error"); return; }
                    handlePurchase(previewTheme.id);
                  }}
                  disabled={purchasing === previewTheme.id}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-[#1a9fff] text-white hover:bg-[#1a9fff]/80 active:scale-95"
                >
                  {purchasing === previewTheme.id ? "..." : `${t("marketplace.buy")} — ${previewTheme.price} ${CURRENCY_NAME}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
