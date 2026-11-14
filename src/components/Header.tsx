import React from 'react';
import { Globe, Camera, Store, ShieldCheck, ShoppingBag } from 'lucide-react';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';
import { AppMainView } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

interface HeaderProps {
  currentView: AppMainView;
  onNavigate: (view: AppMainView) => void;
  exchangeRate: number;
  onOpenGitHub: () => void;
  onOpenScanner?: () => void;
  showWarehousePos?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenScanner,
  showWarehousePos = false,
}) => {
  const { t } = useLanguage();

  const navLinkClass = (active: boolean) =>
    `relative py-1.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded ${
      active
        ? 'text-zinc-50 font-semibold after:content-[""] after:absolute after:left-0 after:right-0 after:-bottom-[13px] after:h-[2px] after:bg-amber-400'
        : 'text-zinc-400 hover:text-zinc-100'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/85 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-6 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-lg shrink-0"
          title="Smith Solutions E-Commerce"
        >
          <MaterialAssembleLogo size="sm" variant="compact" />
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-7">
          <button
            onClick={() => onNavigate('marketplace')}
            className={navLinkClass(currentView === 'marketplace')}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t.header.stores}</span>
          </button>

          <button
            onClick={() => onNavigate('merchant')}
            className={navLinkClass(currentView === 'merchant')}
          >
            <Store className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t.header.myStore}</span>
          </button>

          {showWarehousePos && (
            <button
              onClick={() => onNavigate('app')}
              className={navLinkClass(currentView === 'app')}
            >
              <span>{t.header.warehousePos}</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('admin')}
            className={navLinkClass(currentView === 'admin')}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t.header.admin}</span>
          </button>
        </nav>

        {/* Zone 3: Language Switcher + Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LanguageSwitcher />

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="p-2 text-amber-400 bg-zinc-900 border border-white/[0.1] rounded-lg hover:bg-zinc-800 transition-colors md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              title={t.header.scannerTitle}
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onNavigate(currentView === 'landing' ? 'merchant' : 'landing')}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-[0_1px_20px_-4px_rgba(245,158,11,0.45)] transition-all duration-150 whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {currentView === 'landing' ? (
              <>
                <Store className="w-4 h-4 hidden sm:block" />
                <span className="hidden sm:inline">{t.header.createStoreFull}</span>
                <span className="sm:hidden">{t.header.createStoreShort}</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                <span>{t.header.home}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
