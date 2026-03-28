import { useTranslation } from "react-i18next";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", labelKey: "profile.blocks.visibilityPublic" },
  { value: "FRIENDS", labelKey: "profile.blocks.visibilityFriends" },
  { value: "PRIVATE", labelKey: "profile.blocks.visibilityPrivate" },
];

interface EditToolbarProps {
  visibility: string;
  allowComments: boolean;
  onVisibilityChange: (v: string) => void;
  onAllowCommentsChange: (v: boolean) => void;
}

export function EditToolbar({ visibility, allowComments, onVisibilityChange, onAllowCommentsChange }: EditToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-[#161920]/90 backdrop-blur-md border border-[#2a2e38] rounded-xl p-4 mb-4">
      <div className="flex items-center gap-4">
        {/* Visibility */}
        <div className="flex-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.blocks.visibility")}</label>
          <select
            value={visibility} onChange={(e) => onVisibilityChange(e.target.value)}
            className="w-full appearance-none px-3 py-2 rounded bg-[#0a0c10] border border-[#2a2e38] text-[#c6d4df] text-xs font-semibold focus:outline-none focus:border-[#1a9fff] cursor-pointer"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        </div>
        {/* Allow comments */}
        <div className="flex-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.blocks.allowComments")}</label>
          <button
            type="button" onClick={() => onAllowCommentsChange(!allowComments)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold transition-colors ${
              allowComments ? "bg-[#1a9fff]/10 border-[#1a9fff]/30 text-[#1a9fff]" : "bg-[#0a0c10] border-[#2a2e38] text-[#5e6673]"
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${allowComments ? "bg-[#1a9fff] border-[#1a9fff]" : "border-[#3d4450]"}`}>
              {allowComments && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            {allowComments ? t("profile.blocks.allowComments") : t("profile.blocks.commentsDisabled")}
          </button>
        </div>
      </div>
    </div>
  );
}
