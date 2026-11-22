import React, { useState } from 'react';
import { Plus, Ruler, Sparkles, Trash2, X } from 'lucide-react';
import { useSubsectionTranslation } from './LanguageSettings';
import {
  CLOTHING_SIZE_PRESETS,
  MAX_CLOTHING_SIZES,
  normalizeSizeList,
  parseSizesFromText,
  sanitizeSizeToken,
} from '../utils/clothingSizes';
import { translateSizeTokenLabel } from '../utils/platformLabelsI18n';

interface SizeTagBuilderProps {
  sizes: string[];
  onChange: (nextSizes: string[]) => void;
  storeDefaultSizes?: string[];
  sizeGuide?: string;
  onSizeGuideChange?: (nextGuide: string) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const SizeTagBuilder: React.FC<SizeTagBuilderProps> = ({
  sizes,
  onChange,
  storeDefaultSizes,
  sizeGuide,
  onSizeGuideChange,
  title,
  subtitle,
  compact = false,
}) => {
  const { lang, tr } = useSubsectionTranslation();
  const [customInput, setCustomInput] = useState('');

  const cleanSizes = normalizeSizeList(sizes);
  const storeDefaults = normalizeSizeList(storeDefaultSizes);

  const toggleSize = (size: string) => {
    const token = sanitizeSizeToken(size);
    if (!token) return;
    const exists = cleanSizes.some((s) => s.toLowerCase() === token.toLowerCase());
    if (exists) {
      onChange(cleanSizes.filter((s) => s.toLowerCase() !== token.toLowerCase()));
    } else {
      onChange(normalizeSizeList([...cleanSizes, token]));
    }
  };

  const applyPresetPack = (packSizes: string[]) => {
    onChange(normalizeSizeList([...cleanSizes, ...packSizes]));
  };

  const handleAddCustom = () => {
    const parsed = parseSizesFromText(customInput);
    if (parsed.length === 0) return;
    onChange(normalizeSizeList([...cleanSizes, ...parsed]));
    setCustomInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <div
      className={`rounded-xl bg-[#09090b] border border-white/[0.1] ${
        compact ? 'p-3.5 space-y-3' : 'p-4 space-y-3.5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 shrink-0" />
            <span>
              {title ||
                tr(
                  'Tallas disponibles (Opcional · Ropa, Calzado y Libre)',
                  'Available Sizes (Optional · Apparel, Footwear & Custom)',
                  '可选尺码设置（服饰、鞋靴及自由添加）'
                )}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
            {subtitle ||
              tr(
                'Agrega tallas indistintamente a cualquier producto o tienda mediante paquetes rápidos o escribiendo las tuyas (ej. S, M, L, 32, 41, Única).',
                'Attach sizes to any product or store regardless of category using quick presets or typing custom tags (e.g. S, M, L, 32, 41, One Size).',
                '无论店铺分类如何，均可为任意商品快速套用预设或输入自定义尺码（如 S、M、L、32、41、均码）。'
              )}
          </p>
        </div>

        {cleanSizes.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors shrink-0"
          >
            <Trash2 className="w-3 h-3" />
            <span>{tr('Limpiar', 'Clear', '清空')}</span>
          </button>
        )}
      </div>

      {/* Store preset shortcut if the merchant configured custom store default sizes */}
      {storeDefaults.length > 0 && (
        <div className="rounded-lg bg-amber-400/[0.06] border border-amber-400/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 shrink-0" />
              {tr(
                'Tallas predeterminadas de tu tienda',
                'Your store default sizes',
                '店铺默认尺码组合'
              )}
            </span>
            <button
              type="button"
              onClick={() => applyPresetPack(storeDefaults)}
              className="text-[11px] font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-md transition-colors"
            >
              {tr('Aplicar todas', 'Apply all', '全部套用')}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {storeDefaults.map((sz) => {
              const selected = cleanSizes.some((s) => s.toLowerCase() === sz.toLowerCase());
              return (
                <button
                  key={`store-def-${sz}`}
                  type="button"
                  onClick={() => toggleSize(sz)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                    selected
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/[0.1] hover:border-amber-400/40'
                  }`}
                >
                  {translateSizeTokenLabel(sz, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick preset packs */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-400 block">
          {tr('Paquetes rápidos de tallas (clic para agregar):', 'Quick size packs (click to add):', '快速尺码预设（点击添加）：')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CLOTHING_SIZE_PRESETS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => applyPresetPack(pack.sizes)}
              className="px-2.5 py-1.5 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-white/[0.08] hover:border-amber-400/35 text-[11px] font-medium text-zinc-200 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{pack.label[lang]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom manual size tag input */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={80}
          placeholder={tr(
            'Escribir talla personalizada (ej: XS, M, XL o 28, 30, 32)...',
            'Type custom size(s) (e.g. XS, M, XL or 28, 30, 32)...',
            '输入自定义尺码（例如：XS, M, XL 或 28, 30, 32）...'
          )}
          className="flex-1 min-w-0 px-3 py-2 min-h-[42px] rounded-lg bg-[#111114] border border-white/[0.12] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim() || cleanSizes.length >= MAX_CLOTHING_SIZES}
          className="px-3.5 py-2 min-h-[42px] rounded-lg bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 disabled:opacity-40 text-xs font-semibold text-zinc-100 border border-white/[0.1] transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{tr('Agregar talla', 'Add size', '添加尺码')}</span>
        </button>
      </div>

      {/* Selected active sizes */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
          <span>
            {tr('Tallas activas', 'Active sizes', '已选尺码')} ({cleanSizes.length}/{MAX_CLOTHING_SIZES})
          </span>
          {cleanSizes.length === 0 && (
            <span className="text-zinc-500">
              {tr('Sin tallas asignadas (producto estándar)', 'No sizes attached (standard product)', '未设置尺码（按标准单品展示）')}
            </span>
          )}
        </div>
        {cleanSizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cleanSizes.map((sz) => (
              <span
                key={`active-sz-${sz}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/35 text-xs font-semibold text-amber-200"
              >
                <span>{translateSizeTokenLabel(sz, lang)}</span>
                <button
                  type="button"
                  onClick={() => toggleSize(sz)}
                  className="text-amber-300/80 hover:text-white transition-colors"
                  aria-label={tr(
                    `Quitar talla ${translateSizeTokenLabel(sz, lang)}`,
                    `Remove size ${translateSizeTokenLabel(sz, lang)}`,
                    `移除尺码 ${translateSizeTokenLabel(sz, lang)}`
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Optional size guide / fit notes */}
      {onSizeGuideChange && (
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            {tr(
              'Guía de tallas / corte o desglose de stock (Opcional)',
              'Size guide / fit or per-size stock note (Optional)',
              '尺码指南 / 版型与分码库存说明（可选）'
            )}
          </label>
          <input
            type="text"
            value={sizeGuide || ''}
            onChange={(e) => onSizeGuideChange(e.target.value)}
            maxLength={300}
            placeholder={tr(
              'Ej: Corte Oversize · S (pecho 96cm), M (102cm), L (108cm)',
              'Ex: Relaxed Fit · S (chest 38"), M (40"), L (42")',
              '例：宽松版型 · S (胸围96cm), M (102cm), L (108cm)'
            )}
            className="w-full px-3 py-2 min-h-[40px] rounded-lg bg-[#111114] border border-white/[0.1] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
          />
        </div>
      )}
    </div>
  );
};
