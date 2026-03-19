import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { InstallmentSelector } from "../components/InstallmentSelector";
import type { Game } from "../lib/types";

interface Props {
  slug: string;
  onBack: () => void;
}

export function GameDetailPage({ slug, onBack }: Props) {
  const { user } = useAuthStore();
  const [game, setGame] = useState<Game | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.games.getBySlug(slug).then(setGame);
  }, [slug]);

  if (!game) return <div className="p-6 text-gray-400">Yükleniyor...</div>;

  const basePrice = parseFloat(game.price);
  const gameDiscount = game.discountPercent;
  const studentDiscount = user?.isStudent ? 10 : 0;
  const referralDiscount = referralCode ? 5 : 0;
  const totalDiscount = Math.min(gameDiscount + studentDiscount + referralDiscount, 15);
  const finalPrice = basePrice * (1 - totalDiscount / 100);

  const handleBuy = async (installmentCount: number, cardData?: any) => {
    setError("");
    try {
      const result = await api.payments.init({
        gameId: game.id,
        referralCode: referralCode || undefined,
        paymentMethod: "CREDIT_CARD",
        installmentCount,
        ...cardData,
      });

      if (result.three_d_html) {
        const win = window.open("", "_blank", "width=500,height=600");
        if (win) {
          win.document.write(atob(result.three_d_html));
        }
      }

      setPaymentSuccess(true);
    } catch (err: any) {
      setError(err.message || "Ödeme başarısız");
    }
  };

  const screenshots = typeof game.screenshots === "string"
    ? JSON.parse(game.screenshots) : game.screenshots;
  const requirements = typeof game.minRequirements === "string"
    ? JSON.parse(game.minRequirements) : game.minRequirements;

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white mb-4">
        ← Mağazaya Dön
      </button>

      <div className="flex gap-6">
        <div className="flex-1">
          <img src={game.coverImageUrl} alt={game.title} className="w-full rounded-xl mb-4" />

          {screenshots?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mb-4">
              {screenshots.map((url: string, i: number) => (
                <img key={i} src={url} className="h-20 rounded-lg object-cover" />
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold mb-1">{game.title}</h1>
          <p className="text-sm text-gray-400 mb-4">{game.publisher.name}</p>
          <p className="text-gray-300 text-sm leading-relaxed">{game.description}</p>

          {requirements && Object.keys(requirements).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-400 mb-2">Minimum Sistem Gereksinimleri</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(requirements).map(([key, val]) => (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500 uppercase">{key}:</span>{" "}
                    <span className="text-gray-300">{val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-72 shrink-0">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sticky top-6">
            <div className="mb-3">
              {totalDiscount > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                    -%{totalDiscount}
                  </span>
                  <span className="text-sm text-gray-500 line-through">₺{basePrice.toFixed(2)}</span>
                </div>
              )}
              <div className="text-2xl font-bold">₺{finalPrice.toFixed(2)}</div>
            </div>

            {user?.isStudent && (
              <div className="text-xs text-green-400 mb-2">🎓 Öğrenci indirimi aktif (-%10)</div>
            )}

            <div className="mb-3">
              <input
                type="text" placeholder="Referans kodu (opsiyonel)"
                value={referralCode} onChange={(e) => setReferralCode(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              {referralCode && <div className="text-xs text-green-400 mt-1">-%5 referans indirimi</div>}
            </div>

            {paymentSuccess ? (
              <div className="text-center py-3">
                <div className="text-green-400 font-bold mb-1">✓ Satın alındı!</div>
                <p className="text-xs text-gray-400">Kütüphanene eklendi</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowPayment(!showPayment)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm"
                >
                  Satın Al
                </button>
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              </>
            )}

            {showPayment && !paymentSuccess && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <InstallmentSelector
                  price={finalPrice.toFixed(2)}
                  onConfirm={handleBuy}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
