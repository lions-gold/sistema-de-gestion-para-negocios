import React, { useState } from 'react';
import {
  Package,
  Receipt,
  BookOpen,
  ArrowRight,
  MessageCircle,
  Coins,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import inventoryShowcaseImg from '../assets/images/inventory_bottles_showcase_1793999560657.jpg';
import posCellarImg from '../assets/images/pos_retail_cellar_1793999560459.jpg';

interface FeatureBentoProps {
  onOpenApp: (module?: 'inventory' | 'pos' | 'debtors' | 'cashier') => void;
  exchangeRate: number;
}

export const FeatureBento: React.FC<FeatureBentoProps> = ({ onOpenApp, exchangeRate }) => {
  const { t } = useLanguage();
  const [invImgError, setInvImgError] = useState(false);
  const [posImgError, setPosImgError] = useState(false);
  const bsFormatted = (145 * exchangeRate).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
  });

  return (
    <section id="inventario" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mb-12 lg:mb-14">
        <div className="text-xs font-semibold text-amber-400 mb-2">{t.bento.eyebrow}</div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-50 tracking-tight font-display text-balance">
          {t.bento.title}
        </h2>
        <p className="mt-3 text-base text-zinc-400 leading-relaxed">{t.bento.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Card 1 */}
        <div className="md:col-span-7 obsidian-surface rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-amber-400/30 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-amber-400">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">{t.bento.mod1Num}</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-50 mb-2 font-display">{t.bento.mod1Title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">{t.bento.mod1Desc}</p>
          </div>

          <div className="rounded-xl overflow-hidden border border-white/[0.08] relative group bg-[#09090b]">
            {!invImgError ? (
              <img
                src={inventoryShowcaseImg}
                alt={t.bento.mod1Title}
                referrerPolicy="no-referrer"
                onError={() => setInvImgError(true)}
                className="w-full h-48 sm:h-56 object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-48 sm:h-56 bg-zinc-900/90 flex items-center justify-center text-zinc-500">
                <Package className="w-10 h-10 text-amber-400/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/45 to-transparent flex items-end p-4">
              <div className="flex items-center justify-between gap-3 w-full text-xs">
                <span className="text-zinc-100 font-medium">{t.bento.mod1Footer}</span>
                <button
                  onClick={() => onOpenApp('inventory')}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{t.bento.mod1Btn}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div
          id="punto-de-venta"
          className="md:col-span-5 obsidian-surface rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-amber-400/30 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">{t.bento.mod2Num}</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-50 mb-2 font-display">{t.bento.mod2Title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-5">{t.bento.mod2Desc}</p>
          </div>

          <div className="rounded-xl overflow-hidden border border-white/[0.08] relative group bg-[#09090b]">
            {!posImgError ? (
              <img
                src={posCellarImg}
                alt={t.bento.mod2Title}
                referrerPolicy="no-referrer"
                onError={() => setPosImgError(true)}
                className="w-full h-44 object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-44 bg-zinc-900/90 flex items-center justify-center text-zinc-500">
                <Receipt className="w-10 h-10 text-emerald-400/50" />
              </div>
            )}
            <div className="p-3.5 bg-[#09090b]/95 border-t border-white/[0.08] flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-300">{t.bento.mod2Footer}</span>
              <button
                onClick={() => onOpenApp('pos')}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>{t.bento.mod2Btn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div
          id="fiados"
          className="md:col-span-6 obsidian-surface rounded-2xl p-6 sm:p-8 hover:border-amber-400/30 transition-colors flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-sky-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">{t.bento.mod3Num}</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-50 mb-2 font-display">{t.bento.mod3Title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-5">{t.bento.mod3Desc}</p>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.06] text-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {t.bento.mod3PreviewLabel}
                </span>
                <span className="font-mono text-zinc-500">WhatsApp</span>
              </div>
              <p className="text-zinc-300 leading-relaxed pt-1 border-t border-white/[0.06]">
                {t.bento.mod3PreviewBody.replace('{bsAmount}', bsFormatted)}
              </p>
            </div>

            <button
              onClick={() => onOpenApp('debtors')}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-amber-400 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>{t.bento.mod3Btn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 4 */}
        <div className="md:col-span-6 obsidian-surface rounded-2xl p-6 sm:p-8 hover:border-amber-400/30 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">{t.bento.mod4Num}</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-50 mb-2 font-display">{t.bento.mod4Title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-5">{t.bento.mod4Desc}</p>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.06] grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block mb-0.5">{t.bento.mod4Income}</span>
                <span className="font-mono text-emerald-400 font-bold text-sm tabular-nums">+$211.00 USD</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">{t.bento.mod4Expense}</span>
                <span className="font-mono text-rose-400 font-bold text-sm tabular-nums">-$23.50 USD</span>
              </div>
            </div>

            <button
              onClick={() => onOpenApp('cashier')}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-amber-400 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>{t.bento.mod4Btn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
