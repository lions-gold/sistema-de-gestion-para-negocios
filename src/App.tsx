import React, { useState, useEffect } from 'react';
import { Product, Debtor, CashMovement, Sale } from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_DEBTORS, 
  INITIAL_MOVEMENTS, 
  INITIAL_SALES, 
  INITIAL_EXCHANGE_RATE 
} from './data/mockData';
import { Header } from './components/Header';
import { LiveRateBar } from './components/LiveRateBar';
import { LandingHero } from './components/LandingHero';
import { FeatureBento } from './components/FeatureBento';
import { ComparisonSection } from './components/ComparisonSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { WarehouseApp } from './components/WarehouseApp';
import { GitHubModal } from './components/GitHubModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { fetchLiveExchangeRates, BCVRatesState } from './services/bcvApi';
import { getStoredEmailConfig, recordSimulatedEmailDispatch } from './utils/alertNotifications';
import { CookieBanner } from './components/CookieBanner';
import { NotFoundPage } from './components/NotFoundPage';
import { MarketplaceDirectory } from './components/MarketplaceDirectory';
import { MerchantPortal } from './components/MerchantPortal';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import {
  applyRouteMetaTags,
  trackAnalyticsPageView,
  resolvePathToRoute,
  ROUTE_SEO_MAP,
  AppRouteKey,
  AppMainView,
} from './utils/seoAndAnalytics';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, SUPER_ADMIN_EMAIL } from './firebase';
import {
  DEFAULT_BILLING_SETTINGS,
  isSuperAdminUser,
  subscribeOwnerStores,
  subscribePlatformBillingSettings,
} from './services/saasService';
import { PlatformBillingSettings, StoreTenant } from './types';
import { Lock, MessageCircle, ShieldCheck } from 'lucide-react';
import { useLanguage } from './i18n/LanguageContext';

export default function App() {
  const { lang, t } = useLanguage();
  const initialRoute = resolvePathToRoute(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  const [currentView, setCurrentView] = useState<AppMainView>(
    initialRoute.is404 ? 'not_found' : initialRoute.view
  );
  const [selectedStoreSlug, setSelectedStoreSlug] = useState<string | undefined>(
    initialRoute.storeSlug
  );
  const [attemptedPath, setAttemptedPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [exchangeRate, setExchangeRate] = useState<number>(INITIAL_EXCHANGE_RATE);
  const [bcvData, setBcvData] = useState<BCVRatesState>({
    bcv: 896.12,
    paralelo: 1024.24,
    lastUpdated: 'Conectando...',
    isLive: true,
    activeRateType: 'bcv',
  });
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [debtors, setDebtors] = useState<Debtor[]>(INITIAL_DEBTORS);
  const [movements, setMovements] = useState<CashMovement[]>(INITIAL_MOVEMENTS);
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES);
  const [appInitialTab, setAppInitialTab] = useState<
    'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'
  >(initialRoute.tab);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Admin-controlled Almacén & POS access state
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [platformBilling, setPlatformBilling] = useState<PlatformBillingSettings>(
    DEFAULT_BILLING_SETTINGS
  );
  const [ownerStores, setOwnerStores] = useState<StoreTenant[]>([]);
  const [capturedReferralCode, setCapturedReferralCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const urlRef = new URLSearchParams(window.location.search).get('ref');
      if (urlRef && urlRef.trim().length >= 4) {
        const normalized = urlRef.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '').slice(0, 32);
        localStorage.setItem('smith_referral_code_v1', normalized);
        return normalized;
      }
      return localStorage.getItem('smith_referral_code_v1') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const unsubBilling = subscribePlatformBillingSettings(setPlatformBilling);
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
    });
    return () => {
      unsubBilling();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setOwnerStores([]);
      return;
    }
    const unsubStores = subscribeOwnerStores(authUser.uid, setOwnerStores);
    return () => unsubStores();
  }, [authUser]);

  const isSuperAdmin = isSuperAdminUser(authUser);
  const canAccessWarehousePos =
    isSuperAdmin ||
    Boolean(platformBilling.warehousePosEnabled) ||
    ownerStores.some((s) => Boolean(s.warehousePosEnabled));

  // Fetch real-time BCV dollar rate from API
  const refreshBCVRate = async () => {
    setIsRateLoading(true);
    try {
      const data = await fetchLiveExchangeRates();
      setBcvData(data);
      if (data.activeRateType === 'bcv') {
        setExchangeRate(data.bcv);
      } else if (data.activeRateType === 'paralelo') {
        setExchangeRate(data.paralelo);
      }
    } catch (err) {
      console.error('Error fetching live BCV rate:', err);
    } finally {
      setIsRateLoading(false);
    }
  };

  useEffect(() => {
    refreshBCVRate();
    // Auto refresh every 10 minutes
    const interval = setInterval(refreshBCVRate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolvePathToRoute(window.location.pathname);
      setAttemptedPath(window.location.pathname);
      setSelectedStoreSlug(resolved.storeSlug);
      if (resolved.is404) {
        setCurrentView('not_found');
      } else {
        setAppInitialTab(resolved.tab);
        setCurrentView(resolved.view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update dynamic Title tags, Meta descriptions, Canonical URL, and track Google Analytics page_view
  useEffect(() => {
    const routeKey: AppRouteKey =
      currentView === 'not_found'
        ? 'not_found'
        : currentView === 'landing'
          ? 'landing'
          : currentView === 'marketplace'
            ? 'marketplace'
            : currentView === 'merchant'
              ? 'merchant'
              : currentView === 'admin'
                ? 'admin'
                : appInitialTab;

    applyRouteMetaTags(routeKey, lang);
    const trackPath =
      currentView === 'not_found'
        ? attemptedPath
        : currentView === 'marketplace' && selectedStoreSlug
          ? `/tienda/${selectedStoreSlug}`
          : ROUTE_SEO_MAP[routeKey].path;
    trackAnalyticsPageView(routeKey, trackPath);
  }, [currentView, appInitialTab, attemptedPath, selectedStoreSlug, lang]);

  const navigateTo = (
    view: AppMainView,
    tab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales',
    customPath?: string
  ) => {
    const nextTab = tab || appInitialTab;
    if (tab) {
      setAppInitialTab(tab);
    }
    setCurrentView(view);

    let nextPath = '/';
    if (view === 'not_found') {
      nextPath = customPath || '/404';
      setAttemptedPath(nextPath);
    } else if (view === 'landing') {
      nextPath = '/';
      setSelectedStoreSlug(undefined);
    } else if (view === 'marketplace') {
      nextPath = customPath || '/tiendas';
      if (customPath && customPath.startsWith('/tienda/')) {
        setSelectedStoreSlug(customPath.replace('/tienda/', ''));
      } else {
        setSelectedStoreSlug(undefined);
      }
    } else if (view === 'merchant') {
      nextPath = '/mi-tienda';
      setSelectedStoreSlug(undefined);
    } else if (view === 'admin') {
      nextPath = '/admin';
      setSelectedStoreSlug(undefined);
    } else {
      nextPath = ROUTE_SEO_MAP[nextTab].path;
    }

    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Inventory stock updater
  const handleUpdateProductStock = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );
  };

  // Add new product
  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const product: Product = {
      ...newProd,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [product, ...prev]);
  };

  // Bulk import products from CSV / JSON
  const handleImportProducts = (
    importedItems: Omit<Product, 'id'>[],
    mergeBySku: boolean = true
  ) => {
    setProducts((prev) => {
      if (!mergeBySku) {
        const created = importedItems.map((item, idx) => ({
          ...item,
          id: `prod-imp-${Date.now()}-${idx}`,
        }));
        return [...created, ...prev];
      }

      const next = [...prev];
      const toPrepend: Product[] = [];
      importedItems.forEach((item, idx) => {
        const cleanSku = item.sku.trim().toLowerCase();
        const existingIdx = cleanSku
          ? next.findIndex((p) => p.sku.trim().toLowerCase() === cleanSku)
          : -1;
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            ...item,
            id: next[existingIdx].id,
          };
        } else {
          toPrepend.push({
            ...item,
            id: `prod-imp-${Date.now()}-${idx}`,
          });
        }
      });
      return [...toPrepend, ...next];
    });
  };

  // Process completed sale from POS
  const handleCompleteSale = (sale: Sale) => {
    setSales((prev) => [sale, ...prev]);

    // Check if any product dropped to critical stock
    const criticalProducts: Product[] = [];
    sale.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        const remaining = Math.max(0, prod.stock - item.quantity);
        if (remaining <= prod.minStock && prod.stock > prod.minStock) {
          criticalProducts.push({ ...prod, stock: remaining });
        }
      }
    });

    if (criticalProducts.length > 0) {
      const emailConfig = getStoredEmailConfig();
      if (emailConfig.isEnabled && emailConfig.notifyOnPOS) {
        recordSimulatedEmailDispatch(
          criticalProducts,
          `Venta procesada en Caja POS #${sale.receiptNumber}`,
          emailConfig
        );
      }
    }

    // Deduct stock for all items
    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = sale.items.find((i) => i.product.id === p.id);
        if (itemSold) {
          return { ...p, stock: Math.max(0, p.stock - itemSold.quantity) };
        }
        return p;
      })
    );

    // If sale is paid immediately (not fiado), record cash movement
    if (sale.paymentMethod !== 'Fiado (Crédito)') {
      const newMov: CashMovement = {
        id: `mov-${Date.now()}`,
        type: 'ingreso',
        category: 'Venta',
        description: `Venta Mostrador #${sale.receiptNumber} (${sale.paymentMethod})`,
        amountUSD: sale.subtotalUSD,
        date: sale.date,
      };
      setMovements((prev) => [newMov, ...prev]);
    } else {
      // If sold on credit (fiado), automatically update or create debtor record
      setDebtors((prev) => {
        const existing = prev.find(
          (d) => d.name.toLowerCase() === sale.customerName.toLowerCase()
        );
        if (existing) {
          return prev.map((d) =>
            d.id === existing.id
              ? {
                  ...d,
                  balanceUSD: d.balanceUSD + sale.subtotalUSD,
                  lastPurchaseDate: sale.date.split(' ')[0],
                  history: [
                    {
                      date: sale.date.split(' ')[0],
                      description: `Compra fiada #${sale.receiptNumber}`,
                      amountUSD: sale.subtotalUSD,
                      type: 'cargo',
                    },
                    ...d.history,
                  ],
                }
              : d
          );
        } else {
          const newDebtor: Debtor = {
            id: `deb-${Date.now()}`,
            name: sale.customerName,
            phone: '584140000000',
            balanceUSD: sale.subtotalUSD,
            lastPurchaseDate: sale.date.split(' ')[0],
            notes: `Cuenta fiada creada desde POS (#${sale.receiptNumber})`,
            history: [
              {
                date: sale.date.split(' ')[0],
                description: `Compra fiada #${sale.receiptNumber}`,
                amountUSD: sale.subtotalUSD,
                type: 'cargo',
              },
            ],
          };
          return [newDebtor, ...prev];
        }
      });
    }
  };

  // Add debtor
  const handleAddDebtor = (debtorData: Omit<Debtor, 'id' | 'history'>) => {
    const newDebtor: Debtor = {
      ...debtorData,
      id: `deb-${Date.now()}`,
      history: [
        {
          date: debtorData.lastPurchaseDate,
          description: 'Apertura de saldo pendiente',
          amountUSD: debtorData.balanceUSD,
          type: 'cargo',
        },
      ],
    };
    setDebtors((prev) => [newDebtor, ...prev]);
  };

  // Record payment / abono on debt
  const handleRecordPayment = (debtorId: string, amountUSD: number, description: string) => {
    const today = new Date().toISOString().split('T')[0];
    let debtorName = '';

    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id === debtorId) {
          debtorName = d.name;
          const newBal = Math.max(0, d.balanceUSD - amountUSD);
          return {
            ...d,
            balanceUSD: newBal,
            history: [
              {
                date: today,
                description: `${description} (-$${amountUSD.toFixed(2)})`,
                amountUSD,
                type: 'abono',
              },
              ...d.history,
            ],
          };
        }
        return d;
      })
    );

    // Record cash entry for the payment received
    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      type: 'ingreso',
      category: 'Venta',
      description: `Abono de deuda: ${debtorName || 'Cliente'} (${description})`,
      amountUSD,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setMovements((prev) => [newMov, ...prev]);
  };

  // Add manual cash movement
  const handleAddMovement = (movData: Omit<CashMovement, 'id' | 'date'>) => {
    const newMov: CashMovement = {
      ...movData,
      id: `mov-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setMovements((prev) => [newMov, ...prev]);
  };

  const handleOpenAppToModule = (
    module?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'
  ) => {
    navigateTo('app', module || appInitialTab);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-amber-400/25 selection:text-amber-300">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => navigateTo(view)}
        exchangeRate={exchangeRate}
        onOpenGitHub={() => setIsGitHubModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        showWarehousePos={canAccessWarehousePos}
      />

      {/* GitHub Connection Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        userEmail="zambranogonzalezcarlossmith@gmail.com"
      />

      {/* Mobile Barcode Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        exchangeRate={exchangeRate}
        onAddToCart={() => {
          setAppInitialTab('pos');
          setCurrentView('app');
          setIsScannerOpen(false);
        }}
        onUpdateStock={(prodId, delta) => {
          handleUpdateProductStock(prodId, delta);
        }}
      />

      {/* Real-time BCV Exchange Rate bar and converter */}
      <LiveRateBar
        rate={exchangeRate}
        onUpdateRate={(newRate) => setExchangeRate(newRate)}
        bcvRate={bcvData.bcv}
        paraleloRate={bcvData.paralelo}
        lastUpdated={bcvData.lastUpdated}
        isLive={bcvData.isLive}
        isLoading={isRateLoading}
        onRefresh={refreshBCVRate}
        activeRateType={bcvData.activeRateType}
        onSelectRateType={(type) => {
          setBcvData((prev) => ({ ...prev, activeRateType: type }));
          if (type === 'bcv') setExchangeRate(bcvData.bcv);
          if (type === 'paralelo') setExchangeRate(bcvData.paralelo);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 md:pb-0">
        {currentView === 'not_found' ? (
          <NotFoundPage
            attemptedPath={attemptedPath}
            onNavigateHome={() => navigateTo('landing')}
            onNavigateModule={(tab) => navigateTo('app', tab)}
          />
        ) : currentView === 'marketplace' ? (
          <MarketplaceDirectory
            exchangeRate={exchangeRate}
            initialStoreSlug={selectedStoreSlug}
            onNavigateMerchant={() => navigateTo('merchant')}
          />
        ) : currentView === 'merchant' ? (
          <MerchantPortal
            exchangeRate={exchangeRate}
            initialReferralCode={capturedReferralCode}
            onClearCapturedReferral={() => {
              setCapturedReferralCode('');
              try {
                localStorage.removeItem('smith_referral_code_v1');
              } catch {
                // ignore storage errors
              }
            }}
            onOpenStorefront={(slug) => navigateTo('marketplace', undefined, `/tienda/${slug}`)}
            onOpenWarehouseApp={() => navigateTo('app', 'inventory')}
          />
        ) : currentView === 'admin' ? (
          <SuperAdminPanel onOpenWarehouseApp={() => navigateTo('app', 'inventory')} />
        ) : currentView === 'landing' ? (
          <div>
            <LandingHero
              onOpenApp={() => handleOpenAppToModule('inventory')}
              onOpenMerchant={() => navigateTo('merchant')}
              onOpenMarketplace={() => navigateTo('marketplace')}
              showWarehousePos={canAccessWarehousePos}
              exchangeRate={exchangeRate}
            />

            <FeatureBento
              onOpenApp={(mod) => handleOpenAppToModule(mod)}
              exchangeRate={exchangeRate}
            />

            <ComparisonSection />

            <TestimonialsSection />

            <ContactSection />
          </div>
        ) : !canAccessWarehousePos ? (
          <section className="max-w-xl mx-auto px-4 py-16">
            <div className="obsidian-surface border-amber-400/30 rounded-2xl p-8 text-center space-y-5 shadow-2xl shadow-black/70">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-amber-400/25 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-50 font-display">
                  {t.warehouse.lockedTitle}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">
                  {t.warehouse.lockedDesc} (
                  <span className="font-mono text-amber-400">{SUPER_ADMIN_EMAIL}</span>)
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => navigateTo('merchant')}
                  className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs transition-colors"
                >
                  {t.warehouse.goMerchant}
                </button>
                <button
                  onClick={() => navigateTo('admin')}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{t.warehouse.goAdmin}</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <WarehouseApp
            products={products}
            debtors={debtors}
            movements={movements}
            sales={sales}
            exchangeRate={exchangeRate}
            initialTab={appInitialTab}
            activeTab={appInitialTab}
            onTabChange={(tab) => navigateTo('app', tab)}
            onUpdateProductStock={handleUpdateProductStock}
            onAddProduct={handleAddProduct}
            onImportProducts={handleImportProducts}
            onCompleteSale={handleCompleteSale}
            onAddDebtor={handleAddDebtor}
            onRecordPayment={handleRecordPayment}
            onAddMovement={handleAddMovement}
            onOpenScanner={() => setIsScannerOpen(true)}
            onBackToLanding={() => navigateTo('landing')}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onOpenApp={(tab) => handleOpenAppToModule(tab || 'inventory')}
        onNavigateView={(view) => navigateTo(view)}
        onTrigger404={() => navigateTo('not_found', undefined, '/404')}
        showWarehousePos={canAccessWarehousePos}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        activeTab={appInitialTab}
        onSelectTab={(tab) => navigateTo('app', tab)}
        onNavigateView={(view) => navigateTo(view)}
        onOpenScanner={() => setIsScannerOpen(true)}
        showWarehousePos={canAccessWarehousePos}
        cartCount={sales.length}
        lowStockCount={products.filter((p) => p.stock <= p.minStock).length}
      />

      {/* Direct WhatsApp Floating Support Button */}
      <a
        href="https://wa.me/584220273766?text=Hola%20Smith%20Bussines%20Solutions,%20deseo%20informaci%C3%B3n%20sobre%20Smith%20Solutions%20E-Commerce"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-40 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 text-white p-3 md:p-3.5 rounded-full shadow-2xl shadow-black/80 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
        title={t.common.waFloatingTitle}
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 text-xs font-semibold hidden sm:inline">
          {t.common.waFloatingLabel}
        </span>
      </a>

      {/* Material Cookie Consent Banner (Kookies) */}
      <CookieBanner />
    </div>
  );
}
