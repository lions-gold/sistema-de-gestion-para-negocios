import React, { useState } from 'react';
import { Globe, Camera, Store, ShieldCheck, ShoppingBag, Package, Menu, X } from 'lucide-react';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';
import { AppMainView } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { PWAInstallButton } from './PWAInstallButton';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClass = (active: boolean) =>
    `relative py-1.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded ${
      active
        ? 'text-zinc-50 font-semibold after:content-[""] after:absolute after:left-0 after:right-0 after:-bottom-[13px] after:h-[2px] after:bg-amber-400'
        : 'text-zinc-400 hover:text-zinc-100'
    }`;

  const mobileDrawerItemClass = (active: boolean) =>
    `w-full min-h-[48px] px-4 py-3 rounded-xl border text-left text-sm font-medium flex items-center gap-3 active:scale-[0.99] transition-all ${
      active
        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 font-semibold'
        : 'bg-[#111114] border-white/[0.08] text-zinc-200 hover:bg-zinc-900'
    }`;

  const handleMobileNav = (view: AppMainView) => {
    setMobileMenuOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.08] safe-area-top transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleMobileNav('landing')}
          className="flex items-center text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-lg shrink-0 min-h-[40px]"
          title="Smith Solutions E-Commerce"
        >
          <MaterialAssembleLogo size="sm" variant="compact" />
        </button>

        {/* Zone 2: Clean single-line navigation links (Desktop/Tablet) */}
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

        {/* Zone 3: Language Switcher + Install App + Mobile Drawer / Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <PWAInstallButton />
          <LanguageSwitcher compact />

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="hidden sm:flex md:hidden p-2 text-amber-400 bg-zinc-900 border border-white/[0.1] rounded-lg hover:bg-zinc-800 active:scale-95 transition-all min-w-[44px] min-h-[44px] items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              title={t.header.scannerTitle}
              aria-label={t.header.scannerTitle}
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onNavigate(currentView === 'landing' ? 'merchant' : 'landing')}
            className="hidden sm:flex px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-[0_1px_20px_-4px_rgba(245,158,11,0.45)] transition-all duration-150 whitespace-nowrap shrink-0 items-center gap-1.5 sm:gap-2 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {currentView === 'landing' ? (
              <>
                <Store className="w-4 h-4 hidden sm:block" />
                <span>{t.header.createStoreFull}</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                <span>{t.header.home}</span>
              </>
            )}
          </button>

          {/* Mobile Menu Toggle (ensures 1-tap access on small 360px+ phones to all views including Admin & Scanner) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden min-w-[44px] min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-white/[0.1] text-zinc-100 flex items-center justify-center transition-all"
            aria-label={mobileMenuOpen ? t.common.close : 'Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Full Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#09090b]/98 backdrop-blur-2xl px-4 py-4 space-y-2.5 max-h-[75dvh] overflow-y-auto">
          <button onClick={() => handleMobileNav('landing')} className={mobileDrawerItemClass(currentView === 'landing')}>
            <Globe className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{t.header.home}</span>
          </button>

          <button onClick={() => handleMobileNav('marketplace')} className={mobileDrawerItemClass(currentView === 'marketplace')}>
            <ShoppingBag className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{t.header.stores}</span>
          </button>

          <button onClick={() => handleMobileNav('merchant')} className={mobileDrawerItemClass(currentView === 'merchant')}>
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{t.header.myStore}</span>
          </button>

          {showWarehousePos && (
            <button onClick={() => handleMobileNav('app')} className={mobileDrawerItemClass(currentView === 'app')}>
              <Package className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{t.header.warehousePos}</span>
            </button>
          )}

          <button onClick={() => handleMobileNav('admin')} className={mobileDrawerItemClass(currentView === 'admin')}>
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{t.header.admin}</span>
          </button>

          {onOpenScanner && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenScanner();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>{t.header.scannerTitle}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
