import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Props {
  price: string;
  onConfirm: (installmentCount: number, cardData?: any) => void;
}

export function InstallmentSelector({ price, onConfirm }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, "").slice(0, 6);
    if (bin.length === 6) {
      api.payments.installments(bin, price).then((data) => {
        if (data?.installmentDetails?.[0]?.installmentPrices) {
          setInstallments(data.installmentDetails[0].installmentPrices);
        }
      });
    }
  }, [cardNumber, price]);

  const handleSubmit = () => {
    setLoading(true);
    onConfirm(selectedInstallment, {
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardHolderName: cardHolder,
      expireMonth: expMonth,
      expireYear: expYear,
      cvc,
    });
  };

  return (
    <div className="space-y-3">
      <input
        placeholder="Kart numarası" value={cardNumber}
        onChange={(e) => setCardNumber(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs"
      />
      <input
        placeholder="Kart üzerindeki isim" value={cardHolder}
        onChange={(e) => setCardHolder(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs"
      />
      <div className="flex gap-2">
        <input placeholder="AA" value={expMonth} onChange={(e) => setExpMonth(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
        <input placeholder="YYYY" value={expYear} onChange={(e) => setExpYear(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
        <input placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
      </div>

      {installments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium">Taksit Seçenekleri</p>
          {installments.map((inst: any) => (
            <button
              key={inst.installmentNumber}
              onClick={() => setSelectedInstallment(inst.installmentNumber)}
              className={`w-full flex justify-between px-3 py-2 rounded-lg text-xs ${
                selectedInstallment === inst.installmentNumber
                  ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-750"
              }`}
            >
              <span>{inst.installmentNumber === 1 ? "Tek çekim" : `${inst.installmentNumber} taksit`}</span>
              <span>₺{parseFloat(inst.totalPrice).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit} disabled={loading || !cardNumber || !cardHolder}
        className="w-full py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium text-sm disabled:opacity-50"
      >
        {loading ? "İşleniyor..." : `₺${price} Öde`}
      </button>
    </div>
  );
}
