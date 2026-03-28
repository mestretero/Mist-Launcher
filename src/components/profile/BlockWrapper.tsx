import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface BlockWrapperProps {
  block: { id: string; type: string; visible: boolean };
  isEditing: boolean;
  children: React.ReactNode;
  onToggleVisible: () => void;
  onDelete: () => void;
}

function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-[#5e6673]"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function BlockWrapper({
  block,
  isEditing,
  children,
  onToggleVisible,
  onDelete,
}: BlockWrapperProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // In view mode, just render children as-is
  if (!isEditing) {
    return <>{children}</>;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-xl border transition-all ${
        isDragging
          ? "border-[#1a9fff]/60 shadow-2xl shadow-[#1a9fff]/10 z-50 opacity-80"
          : block.visible
          ? "border-dashed border-[#3d4450] hover:border-[#1a9fff]/40"
          : "border-dashed border-[#2a2e38] opacity-60 hover:border-[#3d4450]"
      }`}
    >
      {/* Drag handle — left edge */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 rounded-l-xl hover:bg-[#1a9fff]/10 transition-colors"
        title="Drag to reorder"
      >
        <GripIcon />
      </div>

      {/* Top-right controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Visibility toggle */}
        <button
          onClick={onToggleVisible}
          title={block.visible ? "Hide block" : "Show block"}
          className={`p-1.5 rounded-lg border transition-all ${
            block.visible
              ? "border-[#2a2e38] bg-[#0a0c10] text-[#8f98a0] hover:text-[#1a9fff] hover:border-[#1a9fff]/40"
              : "border-[#3d4450] bg-[#161920] text-[#5e6673] hover:text-[#c6d4df]"
          }`}
        >
          <EyeIcon visible={block.visible} />
        </button>

        {/* Delete */}
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
              className="px-2 py-1 rounded-lg bg-red-900/80 border border-red-700/60 text-red-300 text-[10px] font-black uppercase tracking-wider hover:bg-red-800 transition-colors"
            >
              {t("common.confirm", "Confirm")}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 rounded-lg bg-[#0a0c10] border border-[#2a2e38] text-[#8f98a0] text-[10px] font-black uppercase tracking-wider hover:text-[#c6d4df] transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            title={t("profile.blocks.confirmDelete")}
            className="p-1.5 rounded-lg border border-[#2a2e38] bg-[#0a0c10] text-[#8f98a0] hover:text-red-400 hover:border-red-900/50 transition-all"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Content area — padded to avoid overlap with drag handle */}
      <div className="pl-10 pr-3 py-4">
        {children}
      </div>

      {/* Hidden overlay */}
      {!block.visible && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0c10]/80 border border-[#2a2e38] backdrop-blur-sm">
            <EyeIcon visible={false} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673]">
              {t("profile.blocks.blockHidden")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
