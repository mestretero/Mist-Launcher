import { useTranslation } from "react-i18next";

interface BlockProps {
  config: { title?: string; content?: string };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
}

export function TextBlock({ config, isEditing, onConfigChange }: BlockProps) {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-1.5">
            {t("profile.blocks.textTitle", "Title")}
          </label>
          <input
            type="text"
            value={config.title ?? ""}
            onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
            placeholder={t("profile.blocks.textTitlePlaceholder", "Optional heading")}
            className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-white text-sm placeholder-[#5e6673] focus:outline-none focus:border-[#1a9fff] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-1.5">
            {t("profile.blocks.textContent", "Content")}
          </label>
          <textarea
            value={config.content ?? ""}
            onChange={(e) => onConfigChange({ ...config, content: e.target.value })}
            placeholder={t("profile.blocks.textContentPlaceholder", "Write something...")}
            maxLength={2000}
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-white text-sm placeholder-[#5e6673] focus:outline-none focus:border-[#1a9fff] transition-colors resize-none"
          />
          <p className="text-[10px] text-[#5e6673] mt-1 text-right">
            {(config.content ?? "").length} / 2000
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {config.title && (
        <h3 className="text-base font-bold text-white">{config.title}</h3>
      )}
      {config.content ? (
        <p className="text-sm text-[#c6d4df] leading-relaxed whitespace-pre-wrap">
          {config.content}
        </p>
      ) : (
        <p className="text-sm text-[#5e6673] italic">
          {t("profile.blocks.textEmpty", "No content yet.")}
        </p>
      )}
    </div>
  );
}
