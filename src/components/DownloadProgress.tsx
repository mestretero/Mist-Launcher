interface Props {
  percent: number;
  speedBps: number;
  etaSecs: number;
}

export function DownloadProgress({ percent, speedBps, etaSecs: _etaSecs }: Props) {
  const formatSpeed = (bps: number) => {
    if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
    if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${bps} B/s`;
  };

  return (
    <div className="w-40">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{percent.toFixed(0)}%</span>
        <span>{formatSpeed(speedBps)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
