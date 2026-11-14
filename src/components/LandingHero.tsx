import React, { useState } from 'react';
import { ArrowRight, Store, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';

interface LandingHeroProps {
  onOpenApp: () => void;
  onOpenMerchant?: () => void;
  onOpenMarketplace?: () => void;
  showWarehousePos?: boolean;
  exchangeRate: number;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onOpenApp,
  onOpenMerchant,
  onOpenMarketplace,
  showWarehousePos = false,
  exchangeRate,
}) => {
  const { t } = useLanguage();
  const [gifError, setGifError] = useState(false);
  const logoGifSrc = `${import.meta.env.BASE_URL}smith-logo-animated.gif`;

  return (
    <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-white/[0.08] bg-obsidian-grid">
      {/* Subtle architectural radial glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[340px] bg-amber-500/[0.08] blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-8 py-2">
            <div className="space-y-6">
              {/* Unboxed clean metadata eyebrow */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400">
                <span className="text-amber-400 font-semibold">Material Assemble</span>
                <span aria-hidden="true">·</span>
                <span>Multi-SaaS Venezuela 2026</span>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-300">{t.hero.tagline}</span>
              </div>

              <h1
                className="font-bold text-zinc-50 tracking-tight leading-[1.08] font-display text-balance max-w-2xl"
                style={{ fontSize: 'clamp(2.25rem, 4.2vw, 3.75rem)' }}
              >
                {t.hero.headlinePrefix}{' '}
                <span className="text-amber-400">Smith Solutions E-Commerce</span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
                {t.hero.subheadline}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {onOpenMerchant && (
                  <button
                    onClick={onOpenMerchant}
                    className="px-5 py-3 text-sm sm:text-base font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-[0_6px_28px_-6px_rgba(245,158,11,0.45)] transition-all duration-150 flex items-center gap-2 whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <Store className="w-4 h-4 stroke-[2.2]" />
                    <span>{t.hero.ctaCreateStore}</span>
                  </button>
                )}

                {onOpenMarketplace && (
                  <button
                    onClick={onOpenMarketplace}
                    className="px-5 py-3 text-sm sm:text-base font-semibold text-zinc-100 bg-[#111114] hover:bg-zinc-900 border border-white/[0.12] hover:border-amber-400/40 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    <span>{t.hero.ctaViewStores}</span>
                  </button>
                )}

                {showWarehousePos && (
                  <button
                    onClick={onOpenApp}
                    className="px-5 py-3 text-sm sm:text-base font-medium text-zinc-300 hover:text-zinc-50 bg-transparent hover:bg-white/[0.04] border border-white/[0.08] rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px]"
                  >
                    <span>{t.hero.ctaOpenWarehouse}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Clean hairline tabular KPI strip */}
            <div className="pt-6 border-t border-white/[0.08] grid grid-cols-3 gap-6 text-xs sm:text-sm text-zinc-400">
              <div className="flex flex-col gap-1">
                <span className="font-mono font-bold text-xl sm:text-2xl text-zinc-50 tabular-nums">
                  {t.hero.stat1Val}
                </span>
                <span className="text-zinc-400">{t.hero.stat1Desc}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono font-bold text-xl sm:text-2xl text-amber-400 tabular-nums">
                  {t.hero.stat2Val}
                </span>
                <span className="text-zinc-400">{t.hero.stat2Desc}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono font-bold text-xl sm:text-2xl text-zinc-50 tabular-nums">
                  {t.hero.stat3Val}
                </span>
                <span className="text-zinc-400">{t.hero.stat3Desc}</span>
              </div>
            </div>
          </div>

          {/* Animated Platform Logo GIF Showcase */}
          <div className="lg:col-span-5 relative flex">
            <div className="relative w-full min-h-[380px] lg:h-full rounded-2xl overflow-hidden border border-white/[0.1] bg-[#0b0b0e] shadow-2xl shadow-black/90 flex flex-col justify-between p-5 sm:p-6">
              <div className="flex-1 flex items-center justify-center py-2">
                {!gifError ? (
                  <img
                    src={logoGifSrc}
                    alt="Smith Solutions E-Commerce Animated Platform Logo"
                    referrerPolicy="no-referrer"
                    onError={() => setGifError(true)}
                    className="w-60 h-60 sm:w-72 sm:h-72 object-contain rounded-3xl select-none"
                  />
                ) : (
                  <MaterialAssembleLogo size="xl" showText={false} useAnimatedGif={false} />
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#111114]/95 border border-white/[0.08] text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-100">{t.hero.overlayTitle}</span>
                  <span className="text-amber-400 font-mono tabular-nums">{t.hero.overlayItems}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400 pt-2 border-t border-white/[0.08]">
                  <span>{t.hero.overlayRate}</span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {exchangeRate.toFixed(2)} Bs / USD
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>{t.hero.overlayValue}</span>
                  <span className="font-mono text-amber-400 font-bold tabular-nums">$7,420.00 USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
