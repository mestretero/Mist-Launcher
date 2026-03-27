import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

interface Props {
  price: string;
  onConfirm: (installmentCount: number, cardData?: any) => void;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  return value.replace(/\D/g, "").slice(0, 2);
}

function formatCvc(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function InstallmentSelector({ price, onConfirm }: Props) {
  const { t } = useTranslation();
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState(1);
  const [loading, setLoading] = useState(false);

  const rawDigits = cardNumber.replace(/\s/g, "");

  useEffect(() => {
    const bin = rawDigits.slice(0, 6);
    if (bin.length === 6) {
      api.payments.installments(bin, price).then((data) => {
        if (data?.installmentDetails?.[0]?.installmentPrices) {
          setInstallments(data.installmentDetails[0].installmentPrices);
        }
      });
    } else {
      setInstallments([]);
      setSelectedInstallment(1);
    }
  }, [rawDigits.slice(0, 6), price]);

  const handleSubmit = () => {
    setLoading(true);
    onConfirm(selectedInstallment, {
      cardNumber: rawDigits,
      cardHolderName: cardHolder,
      expireMonth: expMonth,
      expireYear: expYear,
      cvc,
    });
  };

  // Allow parent to reset loading state via new price (re-render)
  useEffect(() => {
    setLoading(false);
  }, [price]);

  const isFormValid =
    rawDigits.length >= 15 &&
    cardHolder.trim().length >= 3 &&
    expMonth.length === 2 &&
    expYear.length === 2 &&
    cvc.length >= 3;

  // Detect card brand from first digits
  const cardBrand = rawDigits.startsWith("4")
    ? "VISA"
    : rawDigits.startsWith("5")
    ? "MC"
    : rawDigits.startsWith("3")
    ? "AMEX"
    : null;

  const inputClass =
    "w-full px-4 py-3 bg-brand-950 border border-brand-800 rounded text-brand-100 text-xs font-bold tracking-widest uppercase focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-700";

  return (
    <div className="space-y-4 font-sans">
      {/* Card Number */}
      <div className="relative">
        <input
          placeholder={t("installment.cardNumber")}
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          maxLength={19}
          inputMode="numeric"
          className={inputClass}
        />
        {cardBrand && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-brand-500 tracking-widest">
            {cardBrand}
          </span>
        )}
      </div>

      {/* Card Holder */}
      <input
        placeholder={t("installment.cardHolder")}
        value={cardHolder}
        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
        className={inputClass}
      />

      {/* Expiry & CVC */}
      <div className="flex gap-3">
        <input
          placeholder={t("installment.month")}
          value={expMonth}
          onChange={(e) => {
            const v = formatExpiry(e.target.value);
            if (v === "" || (parseInt(v) >= 0 && parseInt(v) <= 12)) setExpMonth(v);
          }}
          maxLength={2}
          inputMode="numeric"
          className={`w-1/3 ${inputClass}`}
        />
        <input
          placeholder={t("installment.year")}
          value={expYear}
          onChange={(e) => setExpYear(formatExpiry(e.target.value))}
          maxLength={2}
          inputMode="numeric"
          className={`w-1/3 ${inputClass}`}
        />
        <input
          placeholder="CVC"
          value={cvc}
          onChange={(e) => setCvc(formatCvc(e.target.value))}
          maxLength={4}
          inputMode="numeric"
          type="password"
          className={`w-1/3 ${inputClass}`}
        />
      </div>

      {/* Installment Options */}
      {installments.length > 0 && (
        <div className="space-y-2 mt-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-500 mb-2 border-b border-brand-800 pb-2">
            {t("installment.options")}
          </p>
          {installments.map((inst: any) => {
            const isSelected = selectedInstallment === inst.installmentNumber;
            return (
              <button
                key={inst.installmentNumber}
                onClick={() => setSelectedInstallment(inst.installmentNumber)}
                className={`w-full flex justify-between px-4 py-3 rounded border text-xs font-bold tracking-widest uppercase transition-colors ${
                  isSelected
                    ? "bg-brand-200 text-brand-950 border-brand-200"
                    : "bg-brand-950 text-brand-300 border-brand-800 hover:border-brand-600"
                }`}
              >
                <span>
                  {inst.installmentNumber === 1
                    ? t("installment.single")
                    : t("installment.count", { count: inst.installmentNumber })}
                </span>
                <span>{parseFloat(inst.totalPrice).toFixed(2)} TL</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !isFormValid}
        className="w-full py-4 mt-6 bg-brand-200 hover:bg-white rounded text-brand-950 font-black tracking-widest uppercase text-sm disabled:opacity-50 transition-colors"
      >
        {loading ? t("installment.processing") : t("installment.pay", { price })}
      </button>
    </div>
  );
}
