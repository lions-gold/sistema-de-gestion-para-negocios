import React, { useState } from 'react';
import {
  Package,
  Receipt,
  BookOpen,
  ArrowRight,
  MessageCircle,
  Coins,
  Ruler,
  Store,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import inventoryShowcaseImg from '../assets/images/inventory_bottles_showcase_1793999560657.jpg';
import posCellarImg from '../assets/images/pos_retail_cellar_1793999560459.jpg';
import fashionBoutiqueImg from '../assets/images/fashion_boutique_showcase_1795218110948.jpg';

interface FeatureBentoProps {
  onOpenApp: (module?: 'inventory' | 'pos' | 'debtors' | 'cashier') => void;
  exchangeRate: number;
}

export const FeatureBento: React.FC<FeatureBentoProps> = ({ onOpenApp, exchangeRate }) => {
  const { t, tr } = useLanguage();
  const [invImgError, setInvImgError] = useState(false);
  const [posImgError, setPosImgError] = useState(false);
  const [fashionImgError, setFashionImgError] = useState(false);
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
        {/* Featured Boutique & Storefront Spotlight */}
        <div className="md:col-span-12 min-w-0 obsidian-surface rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 hover:border-amber-400/35 transition-colors">
          <div className="lg:col-span-6 p-5 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-amber-400">
                  <Store className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {tr('Storefronts & Moda', 'Storefronts & Apparel', '品牌商城与服饰尺码')}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-zinc-50 font-display">
                {tr(
                  'Vitrinas Multi-Rubro con Configurador de Tallas de Ropa y Calzado',
                  'Multi-Category Storefronts with Apparel & Footwear Size Configurator',
                  '全品类旗舰店面：内置服装、鞋靴自定义尺码体系'
                )}
              </h3>

              <p className="text-sm text-zinc-400 leading-relaxed">
                {tr(
                  'Sin importar la categoría de tu tienda, habilita al instante tallas alfabéticas (XS–3XL), pantalones (26–42), calzado (35–44) o medidas personalizadas con guía de tallas, selector directo en vitrina y descuento exacto de inventario.',
                  'Regardless of your store category, instantly enable alpha sizes (XS–3XL), numeric pants (26–42), footwear (35–44), or custom tags with fit guides, direct storefront pickers, and accurate multi-size stock deduction.',
                  '无论您的店铺属于何种品类，均可一键启用字母尺码 (XS–3XL)、裤装码 (26–42)、鞋码 (35–44) 或自定义尺码，配备尺码表指南、前台直观选码与精准库存扣减。'
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 mr-1">
                  <Ruler className="w-3.5 h-3.5" />
                  {tr('Tallas:', 'Sizes:', '尺码预设:')}
                </span>
                {['XS', 'S', 'M', 'L', 'XL', '38', '40', '42'].map((sz) => (
                  <span
                    key={sz}
                    className="px-2.5 py-1 rounded-md bg-[#09090b] border border-white/[0.1] text-[11px] font-mono font-semibold text-zinc-200"
                  >
                    {sz}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.08] text-xs">
              <span className="text-zinc-400">
                {tr(
                  'Incluye vista rápida de producto y factura dual PDF con talla seleccionada',
                  'Includes product quick-view modal and dual PDF invoice with chosen size',
                  '含商品快速预览弹窗与带已选尺码的双联 PDF 发票'
                )}
              </span>
              <button
                onClick={() => onOpenApp('inventory')}
                className="px-4 py-2 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>{tr('Explorar Catálogo', 'Explore Catalog', '查看目录模块')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[220px] sm:min-h-[260px] bg-[#09090b] overflow-hidden border-t lg:border-t-0 lg:border-l border-white/[0.08] group">
            {!fashionImgError ? (
              <img
                src={fashionBoutiqueImg}
                alt={tr(
                  'Exhibición de tienda de ropa y vitrina boutique',
                  'Boutique apparel showcase and storefront display',
                  '精品服装店与橱窗展示'
                )}
                referrerPolicy="no-referrer"
                onError={() => setFashionImgError(true)}
                className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900/90 flex items-center justify-center text-zinc-500">
                <Store className="w-10 h-10 text-amber-400/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/25 to-transparent flex items-end p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
                <span className="text-zinc-100 font-semibold">
                  {tr('Boutiques, Calzado y Comercio Multi-Talla', 'Boutiques, Footwear & Multi-Size Retail', '精品服饰、鞋靴与多尺码零售')}
                </span>
                <span className="font-mono text-amber-400 font-semibold tabular-nums">
                  {exchangeRate.toFixed(2)} Bs/USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 1 */}
        <div className="md:col-span-7 min-w-0 obsidian-surface rounded-2xl p-5 sm:p-8 flex flex-col justify-between hover:border-amber-400/30 transition-colors">
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/55 to-transparent flex items-end p-3.5 sm:p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full text-xs min-w-0">
                <span className="text-zinc-100 font-medium truncate">{t.bento.mod1Footer}</span>
                <button
                  onClick={() => onOpenApp('inventory')}
                  className="px-4 py-2 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors sm:whitespace-nowrap shrink-0"
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
          className="md:col-span-5 min-w-0 obsidian-surface rounded-2xl p-5 sm:p-8 flex flex-col justify-between hover:border-amber-400/30 transition-colors"
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
            <div className="p-3.5 bg-[#09090b]/95 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <span className="text-zinc-300">{t.bento.mod2Footer}</span>
              <button
                onClick={() => onOpenApp('pos')}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 min-h-[36px]"
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
          className="md:col-span-6 min-w-0 obsidian-surface rounded-2xl p-5 sm:p-8 hover:border-amber-400/30 transition-colors flex flex-col justify-between"
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
              className="w-full min-h-[42px] py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-amber-400 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>{t.bento.mod3Btn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 4 */}
        <div className="md:col-span-6 min-w-0 obsidian-surface rounded-2xl p-5 sm:p-8 hover:border-amber-400/30 transition-colors flex flex-col justify-between">
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
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.06] grid grid-cols-2 gap-3 sm:gap-4 text-xs">
              <div className="min-w-0">
                <span className="text-zinc-500 block mb-0.5">{t.bento.mod4Income}</span>
                <span className="font-mono text-emerald-400 font-bold text-sm tabular-nums break-words">+$211.00 USD</span>
              </div>
              <div className="min-w-0">
                <span className="text-zinc-500 block mb-0.5">{t.bento.mod4Expense}</span>
                <span className="font-mono text-rose-400 font-bold text-sm tabular-nums break-words">-$23.50 USD</span>
              </div>
            </div>

            <button
              onClick={() => onOpenApp('cashier')}
              className="w-full min-h-[42px] py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-amber-400 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
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
