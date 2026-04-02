import { useState } from "react";
import { useTranslation } from "react-i18next";

interface BlockProps {
  config: any;
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  referralCode?: string;
}

export function ReferralBlock({ config: _config, isEditing, onConfigChange: _onConfigChange, referralCode }: BlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-xl bg-[#0a0c10] border border-[#2a2e38] text-center">
        <p className="text-sm text-[#8f98a0]">{t("profile.referralCode")}</p>
        <p className="text-xs text-[#5e6673] mt-1">{referralCode || "—"}</p>
      </div>
    );
  }

  if (!referralCode) {
    return <p className="text-sm text-[#5e6673] italic">{t("profile.blocks.noReferralCode", "No referral code.")}</p>;
  }

  return (
    <div>
      <h3 className="text-[10px] font-black text-[#8f98a0] uppercase tracking-widest mb-3">{t("profile.referralCode")}</h3>
      <div className="flex items-center justify-between p-3 rounded-lg bg-[#20232c]/50 border border-[#2a2e38]">
        <span className="text-sm font-black text-[#47bfff] tracking-widest">{referralCode}</span>
        <button
          onClick={handleCopy}
          className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
            copied
              ? "text-green-400"
              : "text-[#8f98a0] hover:text-white"
          }`}
        >
          {copied ? (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              {t("settings.referral.copied")}
            </span>
          ) : t("profile.copy")}
        </button>
      </div>
    </div>
  );
}
