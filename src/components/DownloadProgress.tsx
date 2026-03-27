import { useTranslation } from "react-i18next";

interface Props {
  percent: number;
  speedBps: number;
  etaSecs: number;
}

export function DownloadProgress({ percent, speedBps, etaSecs }: Props) {
  const { t } = useTranslation();

  const formatSpeed = (bps: number) => {
    if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
    if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${bps} B/s`;
  };

  const formatEta = (secs: number) => {
    if (secs <= 0) return "";
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="w-full h-full flex flex-col justify-center font-sans pr-4">
      <div className="flex justify-between text-[11px] font-bold tracking-widest uppercase text-brand-400 mb-2">
        <span>{percent.toFixed(0)}%</span>
        <div className="flex gap-3">
          {etaSecs > 0 && (
            <span className="text-brand-500">{formatEta(etaSecs)} {t("download.remaining")}</span>
          )}
          <span>{formatSpeed(speedBps)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-brand-950 border border-brand-800 rounded-full overflow-hidden">
        <div className="h-full bg-brand-200 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
