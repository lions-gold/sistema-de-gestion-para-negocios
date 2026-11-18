import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Globe,
  Camera,
  Store,
  ShieldCheck,
  ShoppingBag,
  Package,
  Menu,
  X,
  LogOut,
  Wifi,
  WifiOff,
  Layers,
  BarChart3,
  MessageCircle,
  ChevronRight,
  FileDown,
} from 'lucide-react';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';
import { AppMainView } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { PWAInstallButton } from './PWAInstallButton';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { getOfflineQueue, subscribeOfflineQueue } from '../services/offlineSyncService';
import { downloadTrilingualPlatformGuidePDF } from '../utils/platformGuideExport';

interface HeaderProps {
  currentView: AppMainView;
  onNavigate: (view: AppMainView) => void;
  exchangeRate: number;
  onOpenGitHub: () => void;
  onOpenScanner?: () => void;
  showWarehousePos?: boolean;
  authUser?: User | null;
  onSignOut?: () => Promise<void>;
  isOfflinePanelOpen?: boolean;
  onToggleOfflinePanel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenScanner,
  showWarehousePos = false,
  authUser = null,
  onSignOut,
  isOfflinePanelOpen = false,
  onToggleOfflinePanel,
}) => {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { isOnline } = useOnlineStatus();
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() => getOfflineQueue().length);

  useEffect(() => {
    const unsub = subscribeOfflineQueue((next) => setPendingOfflineCount(next.length));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const menuItemClass = (active: boolean) =>
    `w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left text-sm font-medium flex items-center justify-between gap-3 active:scale-[0.99] transition-all ${
      active
        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 font-semibold'
        : 'bg-[#111114] border-white/[0.08] text-zinc-200 hover:bg-zinc-900 hover:border-white/[0.16]'
    }`;

  const handleMenuNav = (view: AppMainView) => {
    setMenuOpen(false);
    onNavigate(view);
  };

  const handleNavigateServiceSection = (sectionId: string) => {
    setMenuOpen(false);
    if (currentView !== 'landing') {
      onNavigate('landing');
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.08] safe-area-top safe-area-x transition-colors"
    >
      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 lg:gap-4 min-w-0">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleMenuNav('landing')}
          className="flex items-center text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-lg min-w-0 shrink h-9 sm:h-10"
          title="Smith Solutions E-Commerce"
        >
          <MaterialAssembleLogo size="sm" variant="compact" />
        </button>

        {/* Zone 2 & 3: Utility Controls + Primary Action + Unified Horizontal-Bars Menu (All Devices) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onToggleOfflinePanel && (
            <button
              type="button"
              onClick={onToggleOfflinePanel}
              aria-pressed={isOfflinePanelOpen}
              title={
                !isOnline
                  ? 'Modo Offline Activo — Ver datos y ventas locales'
                  : pendingOfflineCount > 0
                    ? `${pendingOfflineCount} operación(es) locales por sincronizar`
                    : 'Respaldo y Modo Offline'
              }
              className={`hidden sm:inline-flex items-center justify-center gap-1.5 px-2.5 h-9 sm:h-10 rounded-lg border text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${
                !isOnline || pendingOfflineCount > 0
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300 hover:bg-amber-500/25'
                  : isOfflinePanelOpen
                    ? 'bg-zinc-800 border-amber-400/40 text-amber-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/[0.1] text-zinc-300 hover:text-white'
              }`}
            >
              {!isOnline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="hidden 2xl:inline">{!isOnline ? 'Offline' : 'Respaldo'}</span>
              {pendingOfflineCount > 0 && (
                <span className="font-mono font-bold text-[11px] bg-amber-400 text-zinc-950 px-1.5 rounded tabular-nums">
                  {pendingOfflineCount}
                </span>
              )}
            </button>
          )}

          <PWAInstallButton />
          <LanguageSwitcher compact />

          {authUser ? (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 h-10 rounded-lg bg-[#111114] border border-white/[0.08] max-w-[150px] xl:max-w-[180px]">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || authUser.email || 'Google'}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {(authUser.displayName || authUser.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-xs text-zinc-200 truncate font-medium">
                {authUser.displayName?.split(' ')[0] || authUser.email?.split('@')[0]}
              </span>
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOut().catch(() => {});
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                  title="Cerrar sesión de Google"
                  aria-label="Cerrar sesión de Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center">
              <GoogleAuthButton
                label="Acceder"
                variant="compact"
                showDeviceNotice={false}
                className="!h-10 !min-h-[40px] !py-0"
              />
            </div>
          )}

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="hidden sm:flex lg:hidden w-10 h-10 text-amber-400 bg-zinc-900 border border-white/[0.1] rounded-lg hover:bg-zinc-800 active:scale-95 transition-all items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 shrink-0"
              title={t.header.scannerTitle}
              aria-label={t.header.scannerTitle}
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onNavigate(currentView === 'landing' ? 'merchant' : 'landing')}
            className="hidden xl:inline-flex px-3.5 h-10 text-xs xl:text-sm font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-[0_1px_20px_-4px_rgba(245,158,11,0.45)] transition-all duration-150 whitespace-nowrap shrink-0 items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {currentView === 'landing' ? (
              <>
                <Store className="w-4 h-4 shrink-0" />
                <span>{t.header.createStoreFull}</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 shrink-0" />
                <span>{t.header.home}</span>
              </>
            )}
          </button>

          {/* Horizontal-Bars Menu Toggle (All Viewports: Mobile, Tablet, Laptop & PC) */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`h-9 sm:h-10 px-2.5 lg:px-3.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
              menuOpen
                ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/[0.12] text-zinc-100'
            }`}
            aria-label={menuOpen ? t.common.close : t.header.storesAndServices}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {menuOpen ? (
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            ) : (
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            )}
            <span className="hidden lg:inline">{t.header.storesAndServices}</span>
          </button>
        </div>

        {/* Desktop & Laptop Floating Horizontal-Bars Dropdown (lg+) */}
        {menuOpen && (
          <div
            role="menu"
            className="hidden lg:block absolute right-6 lg:right-8 top-[calc(100%+8px)] w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.12] bg-[#09090b]/98 backdrop-blur-2xl shadow-2xl shadow-black/80 p-4 space-y-4 max-h-[82vh] overflow-y-auto z-50"
          >
            {/* Group 1: Tiendas y Portales */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 px-1 tracking-wide">
                {t.header.storesGroup}
              </div>

              <button
                onClick={() => handleMenuNav('landing')}
                className={menuItemClass(currentView === 'landing')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.home}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <button
                onClick={() => handleMenuNav('marketplace')}
                className={menuItemClass(currentView === 'marketplace')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.stores}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <button
                onClick={() => handleMenuNav('merchant')}
                className={menuItemClass(currentView === 'merchant')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Store className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.myStore}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              {showWarehousePos && (
                <button
                  onClick={() => handleMenuNav('app')}
                  className={menuItemClass(currentView === 'app')}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{t.header.warehousePos}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </button>
              )}

              <button
                onClick={() => handleMenuNav('admin')}
                className={menuItemClass(currentView === 'admin')}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.admin}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
            </div>

            <div className="border-t border-white/[0.08]" />

            {/* Group 2: Servicios y Soluciones */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 px-1 tracking-wide">
                {t.header.servicesGroup}
              </div>

              <button
                type="button"
                onClick={() => handleNavigateServiceSection('inventario')}
                className={menuItemClass(false)}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.serviceModules}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigateServiceSection('comparativa')}
                className={menuItemClass(false)}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.serviceComparison}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigateServiceSection('contacto')}
                className={menuItemClass(false)}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <MessageCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t.header.serviceContact}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  downloadTrilingualPlatformGuidePDF('all');
                }}
                className={menuItemClass(false)}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <FileDown className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{t.header.downloadGuide}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              {onOpenScanner && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenScanner();
                  }}
                  className={menuItemClass(false)}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{t.header.scannerTitle}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </button>
              )}

              {onToggleOfflinePanel && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleOfflinePanel();
                  }}
                  className={menuItemClass(isOfflinePanelOpen)}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {!isOnline ? (
                      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {!isOnline ? 'Modo Offline Activo' : 'Respaldo y Modo Offline'}
                    </span>
                  </span>
                  {pendingOfflineCount > 0 ? (
                    <span className="font-mono font-bold text-xs bg-amber-400 text-zinc-950 px-2 py-0.5 rounded tabular-nums shrink-0">
                      {pendingOfflineCount}
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile & Tablet Full Navigation Drawer (< lg) */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/[0.08] bg-[#09090b]/98 backdrop-blur-2xl px-4 py-4 space-y-2.5 max-h-[78dvh] overflow-y-auto">
          {/* Google Account Card / Quick Sign-In inside mobile drawer */}
          <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08]">
            {authUser ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt={authUser.displayName || ''}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {(authUser.displayName || authUser.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {authUser.displayName || 'Cuenta Google'}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">{authUser.email}</div>
                  </div>
                </div>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={() => {
                      onSignOut().catch(() => {});
                      setMenuOpen(false);
                    }}
                    className="px-3 py-2 min-h-[40px] rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs text-zinc-300 font-medium flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir</span>
                  </button>
                )}
              </div>
            ) : (
              <GoogleAuthButton
                label="Iniciar sesión / Registrarse con Google"
                variant="primary"
                fullWidth
                onSuccess={() => setMenuOpen(false)}
              />
            )}
          </div>

          <div className="text-[11px] font-semibold text-zinc-400 px-1 pt-1">
            {t.header.storesGroup}
          </div>

          <button onClick={() => handleMenuNav('landing')} className={menuItemClass(currentView === 'landing')}>
            <span className="flex items-center gap-3 min-w-0">
              <Globe className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.home}</span>
            </span>
          </button>

          <button onClick={() => handleMenuNav('marketplace')} className={menuItemClass(currentView === 'marketplace')}>
            <span className="flex items-center gap-3 min-w-0">
              <ShoppingBag className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.stores}</span>
            </span>
          </button>

          <button onClick={() => handleMenuNav('merchant')} className={menuItemClass(currentView === 'merchant')}>
            <span className="flex items-center gap-3 min-w-0">
              <Store className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.myStore}</span>
            </span>
          </button>

          {showWarehousePos && (
            <button onClick={() => handleMenuNav('app')} className={menuItemClass(currentView === 'app')}>
              <span className="flex items-center gap-3 min-w-0">
                <Package className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="truncate">{t.header.warehousePos}</span>
              </span>
            </button>
          )}

          <button onClick={() => handleMenuNav('admin')} className={menuItemClass(currentView === 'admin')}>
            <span className="flex items-center gap-3 min-w-0">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.admin}</span>
            </span>
          </button>

          <div className="text-[11px] font-semibold text-zinc-400 px-1 pt-2">
            {t.header.servicesGroup}
          </div>

          <button
            type="button"
            onClick={() => handleNavigateServiceSection('inventario')}
            className={menuItemClass(false)}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Layers className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.serviceModules}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateServiceSection('comparativa')}
            className={menuItemClass(false)}
          >
            <span className="flex items-center gap-3 min-w-0">
              <BarChart3 className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.serviceComparison}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateServiceSection('contacto')}
            className={menuItemClass(false)}
          >
            <span className="flex items-center gap-3 min-w-0">
              <MessageCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">{t.header.serviceContact}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              downloadTrilingualPlatformGuidePDF('all');
            }}
            className={menuItemClass(false)}
          >
            <span className="flex items-center gap-3 min-w-0">
              <FileDown className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="truncate">{t.header.downloadGuide}</span>
            </span>
          </button>

          {onToggleOfflinePanel && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onToggleOfflinePanel();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl border bg-[#111114] border-white/[0.08] text-zinc-200 hover:bg-zinc-900 text-left text-sm font-medium flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-3 min-w-0">
                {!isOnline ? (
                  <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate">
                  {!isOnline ? 'Modo Offline Activo' : 'Respaldo y Modo Offline'}
                </span>
              </span>
              {pendingOfflineCount > 0 && (
                <span className="font-mono font-bold text-xs bg-amber-400 text-zinc-950 px-2 py-0.5 rounded tabular-nums shrink-0">
                  {pendingOfflineCount}
                </span>
              )}
            </button>
          )}

          {onOpenScanner && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenScanner();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>{t.header.scannerTitle}</span>
            </button>
          )}

          <PWAInstallButton variant="drawer" />

          <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08] flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-zinc-300">
              {t.header.languageLabel}
            </span>
            <LanguageSwitcher placement="up" align="right" />
          </div>
        </div>
      )}
    </header>
  );
};
