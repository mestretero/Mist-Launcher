import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Mirror {
  sourceName: string;
  url: string;
}

interface CommunityLinkModalProps {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    size?: string;
    crackInfo?: string;
    mirrors: Mirror[];
  }) => Promise<void>;
}

export function CommunityLinkModal({ onClose, onSubmit }: CommunityLinkModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [crackInfo, setCrackInfo] = useState("");
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [mirrors, setMirrors] = useState<Mirror[]>([{ sourceName: "", url: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addMirror = () => setMirrors([...mirrors, { sourceName: "", url: "" }]);

  const removeMirror = (index: number) => {
    if (mirrors.length <= 1) return;
    setMirrors(mirrors.filter((_, i) => i !== index));
  };

  const updateMirror = (index: number, field: keyof Mirror, value: string) => {
    const updated = [...mirrors];
    updated[index] = { ...updated[index], [field]: value };
    setMirrors(updated);
  };

  const handleSubmit = async () => {
    setError("");
    if (title.length < 3) { setError(t("gameDetail.communityLinks.modal.linkTitle") + " min 3"); return; }
    const validMirrors = mirrors.filter((m) => m.sourceName && m.url);
    if (!validMirrors.length) { setError(t("gameDetail.communityLinks.modal.mirrors") + " required"); return; }
    for (const m of validMirrors) {
      if (!m.url.startsWith("http://") && !m.url.startsWith("https://")) {
        setError("URL must start with http:// or https://"); return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        title,
        description: description || undefined,
        size: size || undefined,
        crackInfo: crackInfo || undefined,
        mirrors: validMirrors,
      });
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#12151a] border border-[#2a2d35] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-bold text-lg">{t("gameDetail.communityLinks.modal.title")}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
        </div>

        {/* Title */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.linkTitle")} *</label>
          <input
            className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
            placeholder="ör. GTA V - Full Repack v1.68"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Crack Info + Size row */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.crackInfo")}</label>
            <input
              className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
              placeholder="ör. EMPRESS v1.68"
              value={crackInfo}
              onChange={(e) => setCrackInfo(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="w-28">
            <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.size")}</label>
            <input
              className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
              placeholder="47.2 GB"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.description")}</label>
          <textarea
            className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none resize-none"
            placeholder={t("gameDetail.communityLinks.modal.description") + "..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Mirrors */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">{t("gameDetail.communityLinks.modal.mirrors")} *</label>
          {mirrors.map((mirror, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input
                className="w-32 bg-[#0a0c10] border border-[#2a2d35] rounded-md px-2 py-2 text-[#1a9fff] text-sm focus:border-[#1a9fff] outline-none"
                placeholder={t("gameDetail.communityLinks.modal.sourceName")}
                value={mirror.sourceName}
                onChange={(e) => updateMirror(i, "sourceName", e.target.value)}
                maxLength={50}
              />
              <input
                className="flex-1 bg-[#0a0c10] border border-[#2a2d35] rounded-md px-2 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
                placeholder={t("gameDetail.communityLinks.modal.sourceUrl")}
                value={mirror.url}
                onChange={(e) => updateMirror(i, "url", e.target.value)}
                maxLength={500}
              />
              {mirrors.length > 1 && (
                <button onClick={() => removeMirror(i)} className="text-red-500 hover:text-red-400 text-lg min-w-[20px]">
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addMirror} className="text-[#1a9fff] text-sm hover:underline mt-1">
            {t("gameDetail.communityLinks.modal.addMirror")}
          </button>
        </div>

        {/* Error */}
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm">
            {t("gameDetail.communityLinks.modal.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-6 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "..." : t("gameDetail.communityLinks.modal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
