import React from 'react';
import { Package, Receipt, Camera, ShoppingBag, Store, Globe, ShieldCheck } from 'lucide-react';
import { AppMainView } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';

interface MobileBottomNavProps {
  currentView: AppMainView;
  activeTab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  onSelectTab: (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => void;
  onNavigateView: (view: AppMainView) => void;
  onOpenScanner: () => void;
  showWarehousePos?: boolean;
  cartCount?: number;
  lowStockCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  activeTab,
  onSelectTab,
  onNavigateView,
  onOpenScanner,
  showWarehousePos = false,
  cartCount = 0,
  lowStockCount = 0,
}) => {
  const { t } = useLanguage();

  const btnClass = (active: boolean) =>
    `flex flex-col items-center justify-center h-full min-h-[48px] px-1 relative transition-all active:scale-95 ${
      active
        ? 'text-amber-400 font-semibold before:content-[""] before:absolute before:top-0 before:left-1/4 before:right-1/4 before:h-[2px] before:bg-amber-400 before:rounded-b'
        : 'text-zinc-400 hover:text-zinc-100'
    }`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.08] shadow-2xl safe-area-bottom safe-area-x">
      <div className="grid grid-cols-5 items-center h-16 px-1 max-w-md mx-auto">
        <button
          onClick={() => onNavigateView('marketplace')}
          className={btnClass(currentView === 'marketplace')}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.stores}</span>
        </button>

        <button
          onClick={() => onNavigateView('merchant')}
          className={btnClass(currentView === 'merchant')}
        >
          <Store className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.myStore}</span>
        </button>

        <div className="flex items-center justify-center h-full">
          <button
            onClick={onOpenScanner}
            className="w-13 h-13 -mt-4 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 flex flex-col items-center justify-center shadow-[0_6px_20px_rgba(245,158,11,0.35)] active:scale-95 transition-transform border-2 border-[#09090b]"
            title={t.mobileNav.scanTitle}
            aria-label={t.mobileNav.scanTitle}
          >
            <Camera className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {showWarehousePos ? (
          <button
            onClick={() => onSelectTab('inventory')}
            className={btnClass(currentView === 'app' && activeTab === 'inventory')}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.warehouse}</span>
            {lowStockCount > 0 && (
              <span className="absolute top-1.5 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                {lowStockCount}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={() => onNavigateView('landing')}
            className={btnClass(currentView === 'landing')}
          >
            <Globe className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.home}</span>
          </button>
        )}

        {showWarehousePos ? (
          <button
            onClick={() => onSelectTab('pos')}
            className={btnClass(currentView === 'app' && activeTab === 'pos')}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.pos}</span>
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-zinc-950 text-[9px] font-bold flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={() => onNavigateView('admin')}
            className={btnClass(currentView === 'admin')}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">{t.mobileNav.admin}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
