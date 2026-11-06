import React, { useState } from 'react';
import { DollarSign, RefreshCw, Calculator, Check, ArrowRight } from 'lucide-react';

interface LiveRateBarProps {
  rate: number;
  onUpdateRate: (newRate: number) => void;
}

export const LiveRateBar: React.FC<LiveRateBarProps> = ({ rate, onUpdateRate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempRate, setTempRate] = useState(rate.toString());
  const [calcUSD, setCalcUSD] = useState<number>(20);

  const handleSave = () => {
    const val = parseFloat(tempRate);
    if (!isNaN(val) && val > 0) {
      onUpdateRate(val);
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border-y border-amber-500/15 py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Current Exchange Rate indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Tasa del Día (Venezuela):</span>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-24 px-2 py-0.5 bg-slate-800 border border-amber-400/50 rounded text-amber-300 font-mono text-xs focus:outline-none"
              />
              <button
                onClick={handleSave}
                className="p-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors"
                title="Guardar tasa"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white tabular-nums">
                1 USD = {rate.toFixed(2)} Bs.
              </span>
              <button
                onClick={() => {
                  setTempRate(rate.toString());
                  setIsEditing(true);
                }}
                className="text-xs text-amber-400/80 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
                title="Ajustar tasa actual"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Ajustar Tasa</span>
              </button>
            </div>
          )}

          <span className="text-slate-500 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-slate-400 text-xs hidden sm:inline">
            Ajuste en tiempo real en todo el almacén y POS
          </span>
        </div>

        {/* Right: Quick Converter Widget */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1 rounded border border-slate-800 text-xs">
          <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-slate-400">Conversor rápido:</span>
          <input
            type="number"
            min="1"
            value={calcUSD}
            onChange={(e) => setCalcUSD(parseFloat(e.target.value) || 0)}
            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white font-mono"
          />
          <span className="text-slate-400">USD</span>
          <ArrowRight className="w-3 h-3 text-amber-400" />
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            {(calcUSD * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
          </span>
        </div>
      </div>
    </div>
  );
};
