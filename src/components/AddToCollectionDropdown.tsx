import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";

interface Props {
  /** Store game ID (server-side) */
  gameId?: string;
  /** Local game ID (SQLite) */
  localGameId?: string;
}

export function AddToCollectionDropdown({ gameId, localGameId }: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const data = await api.collections.list();
        setCollections(Array.isArray(data) ? data : []);

        // For local games, check which collections they're already in
        if (localGameId) {
          const colIds = await invoke<string[]>("get_collections_for_local_game", { gameId: localGameId });
          setMemberOf(new Set(colIds));
        } else if (gameId) {
          // For store games, check via existing collection items
          const cols = Array.isArray(data) ? data : [];
          const ids = new Set<string>();
          for (const col of cols) {
            if (col.items?.some((item: any) => item.gameId === gameId || item.game?.id === gameId)) {
              ids.add(col.id);
            }
          }
          setMemberOf(ids);
        }
      } catch {
        setCollections([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, gameId, localGameId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = async (collectionId: string, collectionName: string) => {
    const isIn = memberOf.has(collectionId);

    try {
      if (localGameId) {
        if (isIn) {
          await invoke("remove_local_game_from_collection", { collectionId, gameId: localGameId });
          addToast(t("common.removedFromCollection", { name: collectionName }), "info");
        } else {
          await invoke("add_local_game_to_collection", { collectionId, gameId: localGameId });
          addToast(t("common.addedToCollection", { name: collectionName }), "success");
        }
      } else if (gameId) {
        if (isIn) {
          await api.collections.removeGame(collectionId, gameId);
          addToast(t("common.removedFromCollection", { name: collectionName }), "info");
        } else {
          await api.collections.addGame(collectionId, gameId);
          addToast(t("common.addedToCollection", { name: collectionName }), "success");
        }
      }

      setMemberOf(prev => {
        const next = new Set(prev);
        if (isIn) next.delete(collectionId);
        else next.add(collectionId);
        return next;
      });
    } catch (err: any) {
      addToast(err?.message || t("common.operationFailed"), "error");
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded bg-brand-950 border border-brand-800 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-brand-800 text-brand-300 hover:text-brand-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        {t("library.addToCollection")}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-brand-900 border border-brand-800 rounded shadow-2xl overflow-hidden">
          {loading ? (
            <div className="py-4 text-center">
              <span className="text-xs text-brand-500 font-medium">{t("common.loading")}</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-4 px-3 text-center">
              <span className="text-xs text-brand-500 font-medium">
                {t("common.noCollections")}
              </span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {collections.map((col) => {
                const isIn = memberOf.has(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => handleToggle(col.id, col.name)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isIn ? "bg-yellow-400 border-yellow-400" : "border-brand-600"}`}>
                      {isIn && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-[10px] text-brand-600 font-bold">{col.items?.length || col.games?.length || 0}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
