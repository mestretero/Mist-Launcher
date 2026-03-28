import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ScreenshotItem {
  url: string;
  caption?: string;
}

interface BlockProps {
  config: { images: ScreenshotItem[] };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
}

export function ScreenshotsBlock({ config, isEditing, onConfigChange }: BlockProps) {
  const { t } = useTranslation();
  const images: ScreenshotItem[] = config.images ?? [];
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newCaption, setNewCaption] = useState("");

  function addImage() {
    if (!newUrl.trim() || images.length >= 6) return;
    onConfigChange({ ...config, images: [...images, { url: newUrl.trim(), caption: newCaption.trim() || undefined }] });
    setNewUrl("");
    setNewCaption("");
  }

  function removeImage(index: number) {
    onConfigChange({ ...config, images: images.filter((_, i) => i !== index) });
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        {/* Existing images */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden aspect-video bg-[#0a0c10]">
                <img src={img.url} alt={img.caption ?? ""} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                {img.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                    <p className="text-[10px] text-white truncate">{img.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        {images.length < 6 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673]">
              {t("profile.blocks.screenshotsAdd", "Add Screenshot")} ({images.length}/6)
            </p>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={t("profile.blocks.screenshotsUrlPlaceholder", "Image URL")}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-white text-sm placeholder-[#5e6673] focus:outline-none focus:border-[#1a9fff] transition-colors"
            />
            <input
              type="text"
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder={t("profile.blocks.screenshotsCaptionPlaceholder", "Caption (optional)")}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-white text-sm placeholder-[#5e6673] focus:outline-none focus:border-[#1a9fff] transition-colors"
            />
            <button
              onClick={addImage}
              disabled={!newUrl.trim()}
              className="px-4 py-2 rounded-lg bg-[#1a9fff] text-white text-sm font-bold uppercase tracking-widest hover:bg-[#1a9fff]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("profile.blocks.screenshotsAddBtn", "Add")}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.screenshotsEmpty", "No screenshots added.")}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            className="relative group rounded-xl overflow-hidden aspect-video bg-[#0a0c10] border border-[#2a2e38] hover:border-[#1a9fff]/40 transition-colors"
          >
            <img src={img.url} alt={img.caption ?? ""} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </div>
            {img.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                <p className="text-[10px] text-white truncate">{img.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightbox].url}
              alt={images[lightbox].caption ?? ""}
              className="w-full rounded-xl object-contain max-h-[80vh]"
            />
            {images[lightbox].caption && (
              <p className="text-center text-sm text-[#c6d4df] mt-3">{images[lightbox].caption}</p>
            )}
            <div className="flex justify-center gap-2 mt-4">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === lightbox ? "bg-[#1a9fff]" : "bg-white/30"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
