interface Props {
  slug: string;
  onBack: () => void;
}

export function GameDetailPage({ slug, onBack }: Props) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white mb-4">← Geri</button>
      <p className="text-gray-500">Oyun detayları yükleniyor: {slug}</p>
    </div>
  );
}
