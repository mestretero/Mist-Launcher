import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";

interface Props {
  gameId: string;
}

export function AddToCollectionDropdown({ gameId }: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.collections
      .list()
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = async (collectionId: string, collectionName: string) => {
    try {
      await api.collections.addGame(collectionId, gameId);
      addToast(`"${collectionName}" koleksiyonuna eklendi`, "success");
    } catch (err: any) {
      addToast(err?.message || "Koleksiyona eklenemedi", "error");
    }
    setOpen(false);
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
        Koleksiyona Ekle
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-brand-900 border border-brand-800 rounded shadow-2xl overflow-hidden">
          {loading ? (
            <div className="py-4 text-center">
              <span className="text-xs text-brand-500 font-medium">Yükleniyor...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-4 px-3 text-center">
              <span className="text-xs text-brand-500 font-medium">
                Henüz koleksiyon yok. Koleksiyonlar sayfasından oluşturabilirsiniz.
              </span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleAdd(col.id, col.name)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-brand-500">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate">{col.name}</span>
                  <span className="ml-auto text-[10px] text-brand-600 font-bold">{col.games?.length || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
