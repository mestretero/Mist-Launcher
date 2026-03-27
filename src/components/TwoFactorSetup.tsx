import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToastStore } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";

interface TwoFactorSetupProps {
  enabled: boolean;
  onClose: () => void;
}

export function TwoFactorSetup({ enabled, onClose }: TwoFactorSetupProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { loadSession } = useAuthStore();
  const [verificationCode, setVerificationCode] = useState("");
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);
  const [step, setStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEnable = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.auth.twoFactor.setup();
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
      setStep("setup");
    } catch (err: any) {
      setError(err.message || t("twoFactor.setupFailed"));
      addToast(t("twoFactor.setupFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      addToast(t("twoFactor.enterCode"), "error");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.auth.twoFactor.verify(verificationCode);
      addToast(t("twoFactor.activated"), "success");
      setVerificationCode("");
      setStep("idle");
      await loadSession();
      onClose();
    } catch (err: any) {
      setError(err.message || t("twoFactor.verifyFailed"));
      addToast(t("twoFactor.invalidCode"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await api.auth.twoFactor.disable();
      addToast(t("twoFactor.disabled"), "info");
      setShowConfirmDisable(false);
      await loadSession();
      onClose();
    } catch (err: any) {
      addToast(t("twoFactor.disableFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (enabled) {
    return (
      <section className="rounded bg-brand-900 border border-brand-800 p-6 font-sans">
        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">
          {t("twoFactor.title")}
        </h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded flex items-center justify-center bg-green-400/10 border border-green-400/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-brand-100">{t("twoFactor.active")}</p>
              <p className="text-xs text-brand-500 mt-0.5">{t("twoFactor.activeHint")}</p>
            </div>
          </div>

          {!showConfirmDisable ? (
            <button
              onClick={() => setShowConfirmDisable(true)}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
            >
              {t("twoFactor.disable")}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDisable}
                disabled={loading}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-red-400 bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                {loading ? "..." : t("twoFactor.confirm")}
              </button>
              <button
                onClick={() => setShowConfirmDisable(false)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-brand-200 transition-colors"
              >
                {t("twoFactor.cancel")}
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded bg-brand-900 border border-brand-800 p-6 font-sans">
      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-6 border-b border-brand-800 pb-2">
        {t("twoFactor.title")}
      </h2>

      {step === "idle" && (
        <div>
          <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
            {t("twoFactor.setupHint")}
          </p>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="px-6 py-3 rounded bg-brand-200 text-brand-950 text-sm font-black transition-colors hover:bg-white uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? t("twoFactor.loading") : t("twoFactor.enable")}
          </button>
          {error && <p className="text-red-400 text-xs mt-3 font-bold">{error}</p>}
        </div>
      )}

      {step === "setup" && (
        <div>
          <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
            {t("twoFactor.scanHint")}
          </p>

          {qrCodeDataUrl ? (
            <div className="w-48 h-48 mx-auto mb-4">
              <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-full h-full rounded" />
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto mb-4 rounded bg-brand-950 border border-brand-800 flex items-center justify-center">
              <p className="text-xs text-brand-600 font-bold">{t("twoFactor.loading")}</p>
            </div>
          )}

          {secret && (
            <div className="mb-6 text-center">
              <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest mb-1">{t("twoFactor.manualCode")}</p>
              <code className="text-xs text-brand-200 font-mono bg-brand-950 border border-brand-800 px-3 py-1.5 rounded select-all">
                {secret}
              </code>
            </div>
          )}

          <button
            onClick={() => setStep("verify")}
            className="w-full py-3 rounded bg-brand-200 text-brand-950 text-sm font-black transition-colors hover:bg-white uppercase tracking-widest"
          >
            {t("twoFactor.continueBtn")}
          </button>
        </div>
      )}

      {step === "verify" && (
        <div>
          <p className="text-sm text-brand-400 font-medium mb-4 leading-relaxed">
            {t("twoFactor.verifyHint")}
          </p>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setVerificationCode(val);
              }}
              className="flex-1 px-4 py-3 rounded bg-brand-950 border border-brand-800 text-brand-100 text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:border-brand-600 transition-colors placeholder-brand-700"
            />
          </div>

          {error && <p className="text-red-400 text-xs mb-3 font-bold">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("setup"); setError(""); }}
              className="flex-1 py-3 rounded text-sm font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-brand-200 hover:border-brand-600 transition-colors"
            >
              {t("twoFactor.back")}
            </button>
            <button
              onClick={handleVerify}
              disabled={verificationCode.length !== 6 || loading}
              className="flex-1 py-3 rounded bg-brand-200 text-brand-950 text-sm font-black disabled:opacity-50 transition-colors hover:bg-white uppercase tracking-widest"
            >
              {loading ? t("twoFactor.verifying") : t("twoFactor.verify")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
