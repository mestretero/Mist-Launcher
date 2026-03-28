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
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function EditToolbar({
  visibility, allowComments,
  onVisibilityChange, onAllowCommentsChange,
  onSave, onCancel, saving,
}: EditToolbarProps) {
  const { t } = useTranslation();

  const selectCls = "appearance-none pl-3 pr-7 py-1.5 rounded bg-[#0a0c10] border border-[#2a2e38] text-[#c6d4df] text-xs font-semibold focus:outline-none focus:border-[#1a9fff] cursor-pointer";

  return (
    <div className="bg-[#161920]/95 backdrop-blur-md border border-[#2a2e38] rounded-xl shadow-xl shadow-black/40 p-4 space-y-3">
      {/* Row 1: Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Visibility */}
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.blocks.visibility")}</label>
          <select value={visibility} onChange={(e) => onVisibilityChange(e.target.value)} className={selectCls + " w-full"}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        </div>
        {/* Allow comments */}
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.blocks.allowComments")}</label>
          <button
            type="button" onClick={() => onAllowCommentsChange(!allowComments)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${
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
      {/* Row 2: Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[#2a2e38]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1a9fff] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1a9fff]">{t("profile.blocks.editProfile")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-1.5 rounded border border-[#3d4450] text-[#8f98a0] hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
            {t("profile.blocks.cancelEdit")}
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-md shadow-[#1a9fff]/20 disabled:opacity-60">
            {saving && <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            {t("profile.blocks.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
