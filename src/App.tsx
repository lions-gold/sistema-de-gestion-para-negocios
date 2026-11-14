import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  Debtor,
  CashMovement,
  Sale,
  InventoryAuditLog,
  ProductBatchTrace,
  PurchaseInvoice,
  CashClosingRecord,
  PlatformBillingSettings,
  StoreCartItem,
  StoreProduct,
  StoreTenant,
} from './types';
import { INITIAL_EXCHANGE_RATE } from './data/mockData';
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
import { dispatchStoreEmail, getLocalStoreEmailConfig } from './services/emailDeliveryService';
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
  GoogleAuthFriendlyError,
  importWarehouseProductsBatchInCloud,
  isSuperAdminUser,
  resolveGoogleRedirectOnMount,
  saveStoreWarehouseLedgerInCloud,
  saveWarehouseProductInCloud,
  signInWithGoogleAccount,
  signOutAccount,
  subscribeAllStoresForAdmin,
  subscribeOwnerStoreProducts,
  subscribeOwnerStores,
  subscribePlatformBillingSettings,
  subscribeStoreWarehouseLedgers,
  subscribeStoreWarehouseProducts,
  syncAllWarehouseProductsToStorefront,
  syncWarehouseProductToStorefront,
  updateWarehouseAndLinkedStorefrontStock,
} from './services/saasService';
import {
  mirrorFirebaseUserToBackupServer,
  resolveSupabaseSessionOnMount,
  syncFirebaseAuthLanguage,
} from './services/authService';
import { Lock, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from './i18n/LanguageContext';
import { VectorAssistantWidget } from './components/VectorAssistantWidget';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import {
  getStoreWarehouseState,
  loadCachedBcvRates,
  saveLocalWarehouseState,
  syncPendingOfflineActions,
} from './services/offlineSyncService';

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
  const initialCachedBcv = loadCachedBcvRates();

  const [exchangeRate, setExchangeRate] = useState<number>(
    initialCachedBcv?.bcv || INITIAL_EXCHANGE_RATE
  );
  const [bcvData, setBcvData] = useState<BCVRatesState>(
    initialCachedBcv || {
      bcv: 896.12,
      paralelo: 1024.24,
      lastUpdated: 'Conectando...',
      isLive: true,
      activeRateType: 'bcv',
    }
  );
  const [isRateLoading, setIsRateLoading] = useState(false);

  // Strictly isolated & initially empty per-store Warehouse & POS state
  const [products, setProducts] = useState<Product[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [audits, setAudits] = useState<InventoryAuditLog[]>([]);
  const [traces, setTraces] = useState<ProductBatchTrace[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [closings, setClosings] = useState<CashClosingRecord[]>([]);

  const [warehouseStorefrontProducts, setWarehouseStorefrontProducts] = useState<StoreProduct[]>([]);
  const [isSyncingToStore, setIsSyncingToStore] = useState(false);

  const [appInitialTab, setAppInitialTab] = useState<
    'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'
  >(initialRoute.tab);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Admin-controlled Almacén & POS access state
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [redirectAuthError, setRedirectAuthError] = useState<GoogleAuthFriendlyError | null>(null);
  const [platformBilling, setPlatformBilling] = useState<PlatformBillingSettings>(
    DEFAULT_BILLING_SETTINGS
  );
  const [ownerStores, setOwnerStores] = useState<StoreTenant[]>([]);
  const [adminStores, setAdminStores] = useState<StoreTenant[]>([]);
  const [selectedWarehouseStoreId, setSelectedWarehouseStoreId] = useState<string>('');
  const [activeVectorContext, setActiveVectorContext] = useState<{
    store: StoreTenant | null;
    products: StoreProduct[];
    cart: StoreCartItem[];
    addToCart?: (p: StoreProduct) => void;
    openCart?: () => void;
  }>({
    store: null,
    products: [],
    cart: [],
  });

  const handleMerchantVectorContext = useCallback(
    (ctx: { store: StoreTenant | null; products: StoreProduct[] }) => {
      setActiveVectorContext({
        store: ctx.store,
        products: ctx.products,
        cart: [],
      });
    },
    []
  );
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
    syncFirebaseAuthLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const unsubBilling = subscribePlatformBillingSettings(setPlatformBilling);
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (u) {
        setRedirectAuthError(null);
        mirrorFirebaseUserToBackupServer(u).catch(() => {});
      }
    });
    resolveGoogleRedirectOnMount().then(({ user, error }) => {
      if (user) setAuthUser(user);
      if (error) setRedirectAuthError(error);
    });
    resolveSupabaseSessionOnMount().catch(() => null);
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

  useEffect(() => {
    if (!isSuperAdmin) {
      setAdminStores([]);
      return;
    }
    const unsubAdminStores = subscribeAllStoresForAdmin(setAdminStores);
    return () => unsubAdminStores();
  }, [isSuperAdmin]);

  const availableWarehouseStores = useMemo(() => {
    const map = new Map<string, StoreTenant>();
    ownerStores.forEach((s) => map.set(s.id, s));
    if (isSuperAdmin) {
      adminStores.forEach((s) => {
        if (!map.has(s.id)) map.set(s.id, s);
      });
    }
    return Array.from(map.values());
  }, [ownerStores, adminStores, isSuperAdmin]);

  useEffect(() => {
    if (availableWarehouseStores.length > 0 && !selectedWarehouseStoreId) {
      setSelectedWarehouseStoreId(availableWarehouseStores[0].id);
    }
  }, [availableWarehouseStores, selectedWarehouseStoreId]);

  const activeWarehouseStore = useMemo(
    () =>
      availableWarehouseStores.find((s) => s.id === selectedWarehouseStoreId) ||
      availableWarehouseStores[0] ||
      null,
    [availableWarehouseStores, selectedWarehouseStoreId]
  );

  // Subscribe strictly to the active store's isolated Almacén & POS data (always empty for a new store)
  useEffect(() => {
    if (!activeWarehouseStore || !authUser || !authUser.emailVerified) {
      setProducts([]);
      setDebtors([]);
      setMovements([]);
      setSales([]);
      setAudits([]);
      setTraces([]);
      setPurchases([]);
      setClosings([]);
      setWarehouseStorefrontProducts([]);
      return;
    }

    const storeId = activeWarehouseStore.id;
    const ownerUid = activeWarehouseStore.ownerUid;

    // 1. Instant local per-store hydration (empty arrays for brand-new stores)
    const local = getStoreWarehouseState(storeId, exchangeRate);
    setProducts(local.products);
    setDebtors(local.debtors);
    setMovements(local.movements);
    setSales(local.sales);
    setAudits(local.audits || []);
    setTraces(local.traces || []);
    setPurchases(local.purchases || []);
    setClosings(local.closings || []);

    // 2. Cloud Firestore live listeners scoped to storeId + ownerUid
    const unsubWhProds = subscribeStoreWarehouseProducts(storeId, ownerUid, (cloudProducts) => {
      if (cloudProducts.length > 0) {
        setProducts(cloudProducts);
      }
    });

    const unsubWhLedgers = subscribeStoreWarehouseLedgers(storeId, ownerUid, (cloudLedgers) => {
      if (Array.isArray(cloudLedgers.debtors)) setDebtors(cloudLedgers.debtors);
      if (Array.isArray(cloudLedgers.movements)) setMovements(cloudLedgers.movements);
      if (Array.isArray(cloudLedgers.sales)) setSales(cloudLedgers.sales);
      if (Array.isArray(cloudLedgers.audits)) setAudits(cloudLedgers.audits);
      if (Array.isArray(cloudLedgers.traces)) setTraces(cloudLedgers.traces);
      if (Array.isArray(cloudLedgers.purchases)) setPurchases(cloudLedgers.purchases);
      if (Array.isArray(cloudLedgers.closings)) setClosings(cloudLedgers.closings);
    });

    const unsubSfProds = subscribeOwnerStoreProducts(
      storeId,
      ownerUid,
      setWarehouseStorefrontProducts
    );

    return () => {
      unsubWhProds();
      unsubWhLedgers();
      unsubSfProds();
    };
  }, [activeWarehouseStore?.id, activeWarehouseStore?.ownerUid, authUser?.uid]);

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

  // Persist Warehouse/POS state locally keyed strictly by storeId so offline work never leaks across stores
  useEffect(() => {
    if (!activeWarehouseStore?.id) return;
    saveLocalWarehouseState(
      {
        products,
        debtors,
        movements,
        sales,
        audits,
        traces,
        purchases,
        closings,
        exchangeRate,
      },
      activeWarehouseStore.id
    );
  }, [
    activeWarehouseStore?.id,
    products,
    debtors,
    movements,
    sales,
    audits,
    traces,
    purchases,
    closings,
    exchangeRate,
  ]);

  // Auto-sync queued offline operations whenever network returns or user authenticates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (navigator.onLine && authUser && authUser.emailVerified) {
      syncPendingOfflineActions(authUser).catch(() => {});
    }
    const handleOnline = () => {
      refreshBCVRate();
      if (authUser && authUser.emailVerified) {
        syncPendingOfflineActions(authUser).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authUser]);

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

    if (currentView !== 'marketplace' && currentView !== 'merchant') {
      setActiveVectorContext({ store: null, products: [], cart: [] });
    }
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

    if (typeof window !== 'undefined') {
      const basePrefix = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
      const prefixedPath =
        basePrefix && basePrefix !== '.' ? `${basePrefix}${nextPath === '/' ? '/' : nextPath}` : nextPath;
      if (window.location.pathname !== prefixedPath) {
        window.history.pushState({}, '', prefixedPath);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Inventory stock updater (syncs Warehouse + linked Storefront product)
  const handleUpdateProductStock = (id: string, delta: number) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const nextStock = Math.max(0, target.stock + delta);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: nextStock } : p))
    );
    if (activeWarehouseStore) {
      updateWarehouseAndLinkedStorefrontStock(activeWarehouseStore.id, target, nextStock).catch(
        () => {}
      );
    }
  };

  // Add new product to this store's Almacén (and optionally publish straight to Storefront)
  const handleAddProduct = async (
    newProd: Omit<Product, 'id'>,
    publishToStore: boolean = true
  ) => {
    const product: Product = {
      ...newProd,
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setProducts((prev) => [product, ...prev]);

    if (activeWarehouseStore && authUser) {
      try {
        await saveWarehouseProductInCloud(
          activeWarehouseStore.id,
          activeWarehouseStore.ownerUid,
          product
        );
        if (publishToStore) {
          const sfId = await syncWarehouseProductToStorefront(
            activeWarehouseStore,
            activeWarehouseStore.ownerUid,
            product
          );
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? { ...p, storefrontProductId: sfId } : p))
          );
        }
      } catch (err) {
        console.warn('Error guardando producto de almacén en nube:', err);
      }
    }
  };

  // Bulk import products from CSV / JSON (and optionally sync straight to Storefront)
  const handleImportProducts = async (
    importedItems: Omit<Product, 'id'>[],
    mergeBySku: boolean = true,
    publishToStore: boolean = true
  ) => {
    let computedList: Product[] = [];
    setProducts((prev) => {
      if (!mergeBySku) {
        const created = importedItems.map((item, idx) => ({
          ...item,
          id: `wh-imp-${Date.now()}-${idx}`,
        }));
        computedList = [...created, ...prev];
        return computedList;
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
            id: `wh-imp-${Date.now()}-${idx}`,
          });
        }
      });
      computedList = [...toPrepend, ...next];
      return computedList;
    });

    if (activeWarehouseStore && authUser && computedList.length > 0) {
      try {
        await importWarehouseProductsBatchInCloud(
          activeWarehouseStore.id,
          activeWarehouseStore.ownerUid,
          computedList
        );
        if (publishToStore) {
          const res = await syncAllWarehouseProductsToStorefront(
            activeWarehouseStore,
            activeWarehouseStore.ownerUid,
            computedList,
            warehouseStorefrontProducts
          );
          setProducts(res.updatedWarehouseProducts);
        }
      } catch (err) {
        console.warn('Error sincronizando importación masiva en nube:', err);
      }
    }
  };

  const handlePublishProductToStore = async (prod: Product) => {
    if (!activeWarehouseStore) return;
    const matchedSf =
      warehouseStorefrontProducts.find((sp) => sp.id === prod.storefrontProductId) ||
      (prod.sku
        ? warehouseStorefrontProducts.find(
            (sp) => sp.sku && sp.sku.trim().toLowerCase() === prod.sku.trim().toLowerCase()
          )
        : undefined);
    const sfId = await syncWarehouseProductToStorefront(
      activeWarehouseStore,
      activeWarehouseStore.ownerUid,
      prod,
      matchedSf
    );
    setProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, storefrontProductId: sfId } : p))
    );
  };

  const handleSyncAllToStore = async () => {
    if (!activeWarehouseStore || products.length === 0) return;
    setIsSyncingToStore(true);
    try {
      const res = await syncAllWarehouseProductsToStorefront(
        activeWarehouseStore,
        activeWarehouseStore.ownerUid,
        products,
        warehouseStorefrontProducts
      );
      setProducts(res.updatedWarehouseProducts);
    } finally {
      setIsSyncingToStore(false);
    }
  };

  // Process completed sale from POS
  const handleCompleteSale = (sale: Sale) => {
    const nextSales = [sale, ...sales];
    setSales(nextSales);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'sales',
        nextSales
      ).catch(() => {});
    }

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

    const emailStoreId = activeWarehouseStore?.id || 'default-warehouse';
    const emailStoreName = activeWarehouseStore?.storeName || 'Almacén & POS';
    const storeEmailCfg = getLocalStoreEmailConfig(
      emailStoreId,
      activeWarehouseStore?.ownerUid || '',
      authUser?.email || ''
    );
    const hasRealEmailProvider =
      storeEmailCfg.isEnabled &&
      Boolean(storeEmailCfg.recipientEmail) &&
      ((storeEmailCfg.provider === 'resend' && Boolean(storeEmailCfg.resendApiKey)) ||
        (storeEmailCfg.provider === 'smtp' &&
          Boolean(storeEmailCfg.smtpHost && storeEmailCfg.smtpPass)));

    if (criticalProducts.length > 0) {
      if (hasRealEmailProvider && storeEmailCfg.alertOnCriticalStock && storeEmailCfg.notifyOnPOS) {
        dispatchStoreEmail({
          action: 'stock_alert',
          storeId: emailStoreId,
          storeName: emailStoreName,
          exchangeRate,
          config: storeEmailCfg,
          triggerEvent: `Venta procesada en Caja POS #${sale.receiptNumber}`,
          products: criticalProducts,
        }).catch(() => {});
      } else {
        const emailConfig = getStoredEmailConfig();
        if (emailConfig.isEnabled && emailConfig.notifyOnPOS) {
          recordSimulatedEmailDispatch(
            criticalProducts,
            `Venta procesada en Caja POS #${sale.receiptNumber}`,
            emailConfig
          );
        }
      }
    }

    if (
      hasRealEmailProvider &&
      storeEmailCfg.sendSalesReports &&
      storeEmailCfg.salesReportFrequency === 'per_sale'
    ) {
      dispatchStoreEmail({
        action: 'sales_report',
        storeId: emailStoreId,
        storeName: emailStoreName,
        exchangeRate,
        config: storeEmailCfg,
        triggerEvent: `Venta procesada en Caja POS #${sale.receiptNumber}`,
        sale,
      }).catch(() => {});
    }

    // Deduct stock for all items in Almacén & linked Storefront products
    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = sale.items.find((i) => i.product.id === p.id);
        if (itemSold) {
          const nextStock = Math.max(0, p.stock - itemSold.quantity);
          if (activeWarehouseStore) {
            updateWarehouseAndLinkedStorefrontStock(
              activeWarehouseStore.id,
              p,
              nextStock
            ).catch(() => {});
          }
          return { ...p, stock: nextStock };
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
      const nextMovements = [newMov, ...movements];
      setMovements(nextMovements);
      if (activeWarehouseStore) {
        saveStoreWarehouseLedgerInCloud(
          activeWarehouseStore.id,
          activeWarehouseStore.ownerUid,
          'movements',
          nextMovements
        ).catch(() => {});
      }
    } else {
      // If sold on credit (fiado), automatically update or create debtor record
      const existing = debtors.find(
        (d) => d.name.toLowerCase() === sale.customerName.toLowerCase()
      );
      const nextDebtors = existing
        ? debtors.map((d) =>
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
                      type: 'cargo' as const,
                    },
                    ...d.history,
                  ],
                }
              : d
          )
        : [
            {
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
                  type: 'cargo' as const,
                },
              ],
            },
            ...debtors,
          ];
      setDebtors(nextDebtors);
      if (activeWarehouseStore) {
        saveStoreWarehouseLedgerInCloud(
          activeWarehouseStore.id,
          activeWarehouseStore.ownerUid,
          'debtors',
          nextDebtors
        ).catch(() => {});
      }
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
    const nextDebtors = [newDebtor, ...debtors];
    setDebtors(nextDebtors);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'debtors',
        nextDebtors
      ).catch(() => {});
    }
  };

  // Record payment / abono on debt
  const handleRecordPayment = (debtorId: string, amountUSD: number, description: string) => {
    const today = new Date().toISOString().split('T')[0];
    let debtorName = '';

    const nextDebtors = debtors.map((d) => {
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
              type: 'abono' as const,
            },
            ...d.history,
          ],
        };
      }
      return d;
    });
    setDebtors(nextDebtors);

    // Record cash entry for the payment received
    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      type: 'ingreso',
      category: 'Venta',
      description: `Abono de deuda: ${debtorName || 'Cliente'} (${description})`,
      amountUSD,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    const nextMovements = [newMov, ...movements];
    setMovements(nextMovements);

    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'debtors',
        nextDebtors
      ).catch(() => {});
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'movements',
        nextMovements
      ).catch(() => {});
    }
  };

  // Add manual cash movement
  const handleAddMovement = (movData: Omit<CashMovement, 'id' | 'date'>) => {
    const newMov: CashMovement = {
      ...movData,
      id: `mov-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    const nextMovements = [newMov, ...movements];
    setMovements(nextMovements);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'movements',
        nextMovements
      ).catch(() => {});
    }
  };

  const handleAuditsChange = (nextAudits: InventoryAuditLog[]) => {
    setAudits(nextAudits);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'audits',
        nextAudits
      ).catch(() => {});
    }
  };

  const handleTracesChange = (nextTraces: ProductBatchTrace[]) => {
    setTraces(nextTraces);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'traces',
        nextTraces
      ).catch(() => {});
    }
  };

  const handlePurchasesChange = (nextPurchases: PurchaseInvoice[]) => {
    setPurchases(nextPurchases);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'purchases',
        nextPurchases
      ).catch(() => {});
    }
  };

  const handleClosingsChange = (nextClosings: CashClosingRecord[]) => {
    setClosings(nextClosings);
    if (activeWarehouseStore) {
      saveStoreWarehouseLedgerInCloud(
        activeWarehouseStore.id,
        activeWarehouseStore.ownerUid,
        'closings',
        nextClosings
      ).catch(() => {});
    }
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
        authUser={authUser}
        onSignOut={signOutAccount}
      />

      {redirectAuthError && (
        <div
          role="alert"
          className="bg-red-950/60 border-b border-red-500/40 px-4 py-2.5 text-xs text-red-100"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="font-semibold">{redirectAuthError.message}</span>
              {redirectAuthError.hint && (
                <span className="ml-2 text-red-200/85">{redirectAuthError.hint}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRedirectAuthError(null)}
              className="p-1.5 rounded-lg hover:bg-red-900/50 text-red-200 shrink-0"
              aria-label="Cerrar alerta de sesión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

      {/* Offline Mode & Local Sync Status Banner */}
      <OfflineSyncBanner user={authUser} onRequestLogin={signInWithGoogleAccount} />

      {/* Main Content Area */}
      <main className="flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
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
            onVectorContextChange={setActiveVectorContext}
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
            onOpenWarehouseApp={(storeId) => {
              if (storeId) setSelectedWarehouseStoreId(storeId);
              navigateTo('app', 'inventory');
            }}
            onActiveBrandContext={handleMerchantVectorContext}
          />
        ) : currentView === 'admin' ? (
          <SuperAdminPanel
            onOpenWarehouseApp={(storeId) => {
              if (storeId) setSelectedWarehouseStoreId(storeId);
              navigateTo('app', 'inventory');
            }}
          />
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
            activeStore={activeWarehouseStore}
            availableStores={availableWarehouseStores}
            onSelectStore={(id) => setSelectedWarehouseStoreId(id)}
            storefrontProducts={warehouseStorefrontProducts}
            audits={audits}
            traces={traces}
            purchases={purchases}
            closings={closings}
            onAuditsChange={handleAuditsChange}
            onTracesChange={handleTracesChange}
            onPurchasesChange={handlePurchasesChange}
            onClosingsChange={handleClosingsChange}
            onPublishProductToStore={handlePublishProductToStore}
            onSyncAllToStore={handleSyncAllToStore}
            isSyncingToStore={isSyncingToStore}
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
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 right-3 md:right-5 z-40 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 text-white min-w-[48px] min-h-[48px] p-3 md:p-3.5 rounded-full shadow-2xl shadow-black/80 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
        title={t.common.waFloatingTitle}
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 text-xs font-semibold hidden sm:inline">
          {t.common.waFloatingLabel}
        </span>
      </a>

      {/* Vector Commercial Assistant (ES / EN / 中文, Multi-Brand Isolated) */}
      <VectorAssistantWidget
        user={authUser}
        activeStore={activeVectorContext.store}
        activeProducts={activeVectorContext.products}
        activeCart={activeVectorContext.cart}
        exchangeRate={exchangeRate}
        onAddProductToCart={activeVectorContext.addToCart}
        onOpenCartDrawer={activeVectorContext.openCart}
      />

      {/* Material Cookie Consent Banner (Kookies) */}
      <CookieBanner />
    </div>
  );
}
