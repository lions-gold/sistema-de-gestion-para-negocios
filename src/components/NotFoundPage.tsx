import React from 'react';
import {
  Home,
  Package,
  Receipt,
  Coins,
  ArrowLeft,
  SearchX,
  Compass,
} from 'lucide-react';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';
import { useLanguage } from '../i18n/LanguageContext';

interface NotFoundPageProps {
  attemptedPath: string;
  onNavigateHome: () => void;
  onNavigateModule: (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  attemptedPath,
  onNavigateHome,
  onNavigateModule,
}) => {
  const { t } = useLanguage();

  const quickRoutes: Array<{
    title: string;
    desc: string;
    tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
    icon: React.ReactNode;
  }> = [
    {
      title: t.notFound.routes.inventoryTitle,
      desc: t.notFound.routes.inventoryDesc,
      tab: 'inventory',
      icon: <Package className="w-5 h-5 text-amber-400" />,
    },
    {
      title: t.notFound.routes.posTitle,
      desc: t.notFound.routes.posDesc,
      tab: 'pos',
      icon: <Receipt className="w-5 h-5 text-sky-400" />,
    },
    {
      title: t.notFound.routes.cashierTitle,
      desc: t.notFound.routes.cashierDesc,
      tab: 'cashier',
      icon: <Coins className="w-5 h-5 text-emerald-400" />,
    },
  ];

  return (
    <section
      aria-labelledby="error-404-title"
      className="min-h-[75vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16 relative overflow-hidden bg-obsidian-grid"
    >
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[300px] bg-amber-500/[0.08] blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto relative z-10 space-y-10">
        <div className="obsidian-surface rounded-2xl p-6 sm:p-10 shadow-2xl shadow-black/70 text-center space-y-6">
          <div className="flex justify-center">
            <MaterialAssembleLogo size="lg" variant="compact" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400">
              <SearchX className="w-4 h-4" />
              <span>{t.notFound.badge}</span>
            </div>

            <h1
              id="error-404-title"
              className="text-6xl sm:text-8xl font-black font-display tracking-tighter text-zinc-50 tabular-nums select-none"
            >
              404
            </h1>

            <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 font-display text-balance max-w-xl">
              {t.notFound.heading}
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
              {t.notFound.descBefore}{' '}
              <code className="px-2 py-0.5 rounded bg-[#09090b] border border-white/[0.1] text-amber-400 font-mono text-xs break-all">
                {attemptedPath || '/404'}
              </code>{' '}
              {t.notFound.descAfter}{' '}
              <strong className="text-zinc-200">Smith Solutions E-Commerce</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onNavigateHome}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded-lg text-sm flex items-center gap-2 shadow-[0_6px_24px_-6px_rgba(245,158,11,0.45)] transition-all active:scale-95 min-h-[44px]"
            >
              <Home className="w-4 h-4" />
              <span>{t.notFound.backHome}</span>
            </button>

            <button
              onClick={() => onNavigateModule('pos')}
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-semibold rounded-lg text-sm border border-white/[0.1] flex items-center gap-2 transition-all active:scale-95 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>{t.notFound.routes.posTitle}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="font-semibold text-zinc-200 flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>{t.notFound.quickTitle}</span>
            </span>
            <span className="hidden sm:inline font-mono text-zinc-500">{t.notFound.quickSubtitle}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickRoutes.map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigateModule(item.tab)}
                className="obsidian-surface hover:border-amber-400/35 rounded-xl p-4 text-left transition-all flex items-start gap-3 group min-h-[44px]"
              >
                <div className="p-2.5 rounded-lg bg-[#09090b] border border-white/[0.08] shrink-0 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors font-display">
                    {item.title}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
