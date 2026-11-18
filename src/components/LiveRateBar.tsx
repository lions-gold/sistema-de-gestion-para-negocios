import React, { useState } from 'react';
import {
  RefreshCw,
  Calculator,
  Check,
  Wifi,
  WifiOff,
  SlidersHorizontal,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LiveRateBarProps {
  rate: number;
  onUpdateRate: (newRate: number) => void;
  bcvRate?: number;
  paraleloRate?: number;
  lastUpdated?: string;
  source?: string;
  isLive?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  activeRateType?: 'bcv' | 'paralelo' | 'custom';
  onSelectRateType?: (type: 'bcv' | 'paralelo' | 'custom') => void;
}

export const LiveRateBar: React.FC<LiveRateBarProps> = ({
  rate,
  onUpdateRate,
  bcvRate = 916.65,
  paraleloRate = 1072.46,
  lastUpdated = 'Hoy',
  source,
  isLive = true,
  isLoading = false,
  onRefresh,
  activeRateType = 'bcv',
  onSelectRateType,
}) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [tempRate, setTempRate] = useState(rate.toString());
  const [calcUSD, setCalcUSD] = useState<number>(20);

  const handleSave = () => {
    const val = parseFloat(tempRate);
    if (!isNaN(val) && val > 0) {
      onUpdateRate(val);
      if (onSelectRateType) {
        onSelectRateType('custom');
      }
      setIsEditing(false);
    }
  };

  const selectRate = (type: 'bcv' | 'paralelo') => {
    if (onSelectRateType) {
      onSelectRateType(type);
    }
    if (type === 'bcv') {
      onUpdateRate(bcvRate);
    } else {
      onUpdateRate(paraleloRate);
    }
    setIsEditing(false);
  };

  return (
    <div className="w-full overflow-x-clip bg-[#0d0d10] border-b border-white/[0.07] py-2.5 px-3 sm:px-6 lg:px-8 safe-area-x">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 text-xs min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Unboxed clean connection label */}
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium shrink-0 h-8 sm:h-9 px-0.5"
            title={source || 'Banco Central de Venezuela'}
          >
            {isLive ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-semibold whitespace-nowrap">
                  {t.liveRate.apiLive}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-400 font-semibold whitespace-nowrap">
                  {t.liveRate.offline}
                </span>
              </>
            )}
          </div>

          {/* Segmented control for rate source */}
          <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 bg-[#09090b] p-1 rounded-lg border border-white/[0.08] w-full sm:w-auto min-w-0">
            <button
              type="button"
              onClick={() => selectRate('bcv')}
              className={`px-2 sm:px-2.5 h-7 rounded-md font-medium text-[11px] sm:text-xs transition-colors tabular-nums flex items-center justify-center min-w-0 ${
                activeRateType === 'bcv'
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <span className="truncate">{t.liveRate.bcvOfficial}: {bcvRate.toFixed(2)} Bs.</span>
            </button>

            <button
              type="button"
              onClick={() => selectRate('paralelo')}
              className={`px-2 sm:px-2.5 h-7 rounded-md font-medium text-[11px] sm:text-xs transition-colors tabular-nums flex items-center justify-center min-w-0 ${
                activeRateType === 'paralelo'
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <span className="truncate">{t.liveRate.parallel}: {paraleloRate.toFixed(2)} Bs.</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className="w-24 h-9 px-2.5 bg-zinc-950 border border-amber-400/70 rounded-lg text-amber-300 font-mono text-xs tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="w-9 h-9 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg transition-colors flex items-center justify-center shrink-0"
                  title={t.liveRate.saveManualTitle}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempRate(rate.toString());
                  setIsEditing(true);
                }}
                className="text-zinc-300 hover:text-amber-400 text-[11px] font-medium transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap h-9 px-2.5 rounded-lg bg-[#09090b] border border-white/[0.08] hover:border-amber-400/35"
                title={t.liveRate.adjustManualTitle}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{t.liveRate.customize}</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="w-9 h-9 text-zinc-300 hover:text-amber-400 rounded-lg bg-[#09090b] border border-white/[0.08] hover:border-amber-400/35 transition-colors shrink-0 disabled:opacity-50 flex items-center justify-center"
                title={t.liveRate.refreshTitle}
                aria-label={t.liveRate.refreshTitle}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}
          </div>

          <span className="text-zinc-500 text-[11px] hidden xl:inline tabular-nums whitespace-nowrap">
            {source ? `${source} · ` : ''}
            {t.liveRate.updated}: {lastUpdated}
          </span>
        </div>

        {/* Inline instant USD -> VES converter */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-2 bg-[#09090b] px-3 py-1 min-h-[36px] rounded-lg border border-white/[0.08] w-full lg:w-auto min-w-0 shrink-0">
          <div className="flex items-center gap-1.5 text-zinc-400 shrink-0">
            <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs whitespace-nowrap">{t.liveRate.converter}</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono tabular-nums min-w-0">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              value={calcUSD}
              onChange={(e) => setCalcUSD(parseFloat(e.target.value) || 0)}
              className="w-14 h-7 bg-zinc-900 border border-white/[0.1] rounded px-1.5 text-center text-zinc-100 text-xs focus:outline-none focus:border-amber-400 shrink-0"
            />
            <span className="text-zinc-400 text-xs whitespace-nowrap shrink-0">USD =</span>
            <span className="font-semibold text-amber-400 tabular-nums truncate">
              {(calcUSD * rate).toLocaleString('es-VE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              Bs.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
