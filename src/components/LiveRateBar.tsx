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
  isLive?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  activeRateType?: 'bcv' | 'paralelo' | 'custom';
  onSelectRateType?: (type: 'bcv' | 'paralelo' | 'custom') => void;
}

export const LiveRateBar: React.FC<LiveRateBarProps> = ({
  rate,
  onUpdateRate,
  bcvRate = 896.12,
  paraleloRate = 1024.24,
  lastUpdated = 'Hoy',
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
    <div className="bg-[#0d0d10] border-b border-white/[0.07] py-2 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Unboxed clean connection label */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium shrink-0">
            {isLive ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{t.liveRate.apiLive}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-semibold">{t.liveRate.offline}</span>
              </>
            )}
          </div>

          {/* Segmented control for rate source */}
          <div className="flex items-center gap-0.5 bg-[#09090b] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => selectRate('bcv')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors whitespace-nowrap tabular-nums ${
                activeRateType === 'bcv'
                  ? 'bg-zinc-100 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {t.liveRate.bcvOfficial}: {bcvRate.toFixed(2)} Bs.
            </button>

            <button
              onClick={() => selectRate('paralelo')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors whitespace-nowrap tabular-nums ${
                activeRateType === 'paralelo'
                  ? 'bg-zinc-100 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {t.liveRate.parallel}: {paraleloRate.toFixed(2)} Bs.
            </button>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.01"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-24 px-2 py-1 bg-zinc-950 border border-amber-400/70 rounded-md text-amber-300 font-mono text-xs tabular-nums focus:outline-none"
              />
              <button
                onClick={handleSave}
                className="p-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-md transition-colors"
                title={t.liveRate.saveManualTitle}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempRate(rate.toString());
                setIsEditing(true);
              }}
              className="text-zinc-400 hover:text-amber-400 text-[11px] transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
              title={t.liveRate.adjustManualTitle}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{t.liveRate.customize}</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-zinc-400 hover:text-amber-400 rounded-md hover:bg-white/[0.05] transition-colors shrink-0 disabled:opacity-50"
              title={t.liveRate.refreshTitle}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          )}

          <span className="text-zinc-500 text-[11px] hidden lg:inline tabular-nums">
            {t.liveRate.updated}: {lastUpdated}
          </span>
        </div>

        {/* Inline instant USD -> VES converter */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-[#09090b] px-3 py-1 rounded-lg border border-white/[0.08] shrink-0">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">{t.liveRate.converter}</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <input
              type="number"
              min="1"
              value={calcUSD}
              onChange={(e) => setCalcUSD(parseFloat(e.target.value) || 0)}
              className="w-12 bg-zinc-900 border border-white/[0.1] rounded px-1.5 py-0.5 text-center text-zinc-100 focus:outline-none focus:border-amber-400"
            />
            <span className="text-zinc-400 text-xs">USD =</span>
            <span className="font-semibold text-amber-400 tabular-nums">
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
