import { useTranslation } from "react-i18next";

const BANNER_THEMES = [
  { id: "default", nameKey: "profile.themeDarkGalaxy" },
  { id: "cyber", nameKey: "profile.themeCyberNeon" },
  { id: "nature", nameKey: "profile.themeMysticForest" },
  { id: "mech", nameKey: "profile.themeMetallicWar" },
];

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", labelKey: "profile.blocks.visibilityPublic" },
  { value: "FRIENDS", labelKey: "profile.blocks.visibilityFriends" },
  { value: "PRIVATE", labelKey: "profile.blocks.visibilityPrivate" },
];

interface EditToolbarProps {
  visibility: string;
  allowComments: boolean;
  bannerTheme: string;
  onVisibilityChange: (v: string) => void;
  onAllowCommentsChange: (v: boolean) => void;
  onBannerThemeChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function EditToolbar({
  visibility,
  allowComments,
  bannerTheme,
  onVisibilityChange,
  onAllowCommentsChange,
  onBannerThemeChange,
  onSave,
  onCancel,
  saving,
}: EditToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-40 w-full bg-[#161920]/95 backdrop-blur-md border-b border-[#2a2e38] shadow-xl shadow-black/40">
      <div className="flex items-center gap-4 px-6 py-3 flex-wrap">
        {/* Editing indicator */}
        <div className="flex items-center gap-2 mr-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#1a9fff] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1a9fff]">
            {t("profile.blocks.editProfile")}
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-[#2a2e38] flex-shrink-0" />

        {/* Visibility dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#67707b] whitespace-nowrap">
            {t("profile.blocks.visibility")}
          </label>
          <div className="relative">
            <select
              value={visibility}
              onChange={(e) => onVisibilityChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-[#c6d4df] text-xs font-semibold focus:outline-none focus:border-[#1a9fff] transition-colors cursor-pointer"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            {/* Chevron */}
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#67707b]"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Allow comments toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#67707b] whitespace-nowrap">
            {t("profile.blocks.allowComments")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allowComments}
            onClick={() => onAllowCommentsChange(!allowComments)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              allowComments ? "bg-[#1a9fff]" : "bg-[#2a2e38]"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                allowComments ? "translate-x-4.5" : "translate-x-0.5"
              }`}
              style={{
                transform: allowComments ? "translateX(18px)" : "translateX(2px)",
              }}
            />
          </button>
        </div>

        {/* Banner theme dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#67707b] whitespace-nowrap">
            {t("profile.chooseTheme")}
          </label>
          <div className="relative">
            <select
              value={bannerTheme}
              onChange={(e) => onBannerThemeChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-[#c6d4df] text-xs font-semibold focus:outline-none focus:border-[#1a9fff] transition-colors cursor-pointer"
            >
              {BANNER_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {t(theme.nameKey)}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#67707b]"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Spacer pushes buttons to the right */}
        <div className="flex-1" />

        {/* Cancel button */}
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg border border-[#3d4450] text-[#8f98a0] hover:text-white hover:border-[#5e6673] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {t("profile.blocks.cancelEdit")}
        </button>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-[#1a9fff]/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              {/* Spinner */}
              <svg
                className="animate-spin"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {t("profile.blocks.saveChanges")}
            </>
          ) : (
            <>
              {/* Check icon */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {t("profile.blocks.saveChanges")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
