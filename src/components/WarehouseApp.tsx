import React, { useEffect, useMemo, useState } from 'react';
import {
  Product,
  Debtor,
  CashMovement,
  Sale,
  SalesPaymentMethod,
  StoreTenant,
  StorePaymentMethod,
  StoreProduct,
  InventoryAuditLog,
  ProductBatchTrace,
  PurchaseInvoice,
  CashClosingRecord,
} from '../types';
import { InventoryModule } from './InventoryModule';
import { POSModule, POSCustomPaymentOption } from './POSModule';
import { FiadosModule } from './FiadosModule';
import { CashierModule } from './CashierModule';
import { AnalyticsModule } from './AnalyticsModule';
import { EmailProviderConfigPanel } from './EmailProviderConfigPanel';
import { dispatchStoreEmail, getLocalStoreEmailConfig } from '../services/emailDeliveryService';
import {
  subscribeActiveSalesPaymentMethods,
  subscribePublicStorePaymentMethods,
} from '../services/saasService';
import {
  loadCachedSalesPaymentMethods,
  loadCachedStorePaymentMethods,
  saveCachedSalesPaymentMethods,
  saveCachedStorePaymentMethods,
} from '../services/offlineSyncService';
import {
  Package,
  Receipt,
  BookOpen,
  Coins,
  ArrowLeft,
  Store,
  TrendingUp,
  Camera,
  Server,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  GranularTranslationScopeProvider,
  useSubsectionTranslation,
} from './LanguageSettings';
import {
  BrowserNotificationPermissionState,
  BrowserNotificationPrefs,
  getBrowserNotificationPermission,
  getBrowserNotificationPrefs,
  requestBrowserNotificationPermission,
  sendTestBrowserNotification,
  subscribeBrowserNotificationState,
} from '../services/browserNotificationService';

interface WarehouseAppProps {
  products: Product[];
  debtors: Debtor[];
  movements: CashMovement[];
  sales: Sale[];
  exchangeRate: number;
  initialTab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  onUpdateProductStock: (id: string, delta: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>, publishToStore?: boolean) => void;
  onImportProducts?: (
    products: Omit<Product, 'id'>[],
    mergeBySku?: boolean,
    publishToStore?: boolean
  ) => void;
  onCompleteSale: (sale: Sale) => void;
  onAddDebtor: (debtor: Omit<Debtor, 'id' | 'history'>) => void;
  onRecordPayment: (debtorId: string, amountUSD: number, description: string) => void;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
  onBackToLanding: () => void;
  onOpenScanner: () => void;
  activeTab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  onTabChange?: (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => void;
  activeStore?: StoreTenant | null;
  availableStores?: StoreTenant[];
  onSelectStore?: (storeId: string) => void;
  storefrontProducts?: StoreProduct[];
  audits?: InventoryAuditLog[];
  traces?: ProductBatchTrace[];
  purchases?: PurchaseInvoice[];
  closings?: CashClosingRecord[];
  onAuditsChange?: (audits: InventoryAuditLog[]) => void;
  onTracesChange?: (traces: ProductBatchTrace[]) => void;
  onPurchasesChange?: (purchases: PurchaseInvoice[]) => void;
  onClosingsChange?: (closings: CashClosingRecord[]) => void;
  onPublishProductToStore?: (product: Product) => Promise<void>;
  onSyncAllToStore?: () => Promise<void>;
  isSyncingToStore?: boolean;
}

export const WarehouseApp: React.FC<WarehouseAppProps> = ({
  products,
  debtors,
  movements,
  sales,
  exchangeRate,
  initialTab = 'inventory',
  onUpdateProductStock,
  onAddProduct,
  onImportProducts,
  onCompleteSale,
  onAddDebtor,
  onRecordPayment,
  onAddMovement,
  onBackToLanding,
  onOpenScanner,
  activeTab: controlledTab,
  onTabChange,
  activeStore = null,
  availableStores = [],
  onSelectStore,
  storefrontProducts = [],
  audits = [],
  traces = [],
  purchases = [],
  closings = [],
  onAuditsChange,
  onTracesChange,
  onPurchasesChange,
  onClosingsChange,
  onPublishProductToStore,
  onSyncAllToStore,
  isSyncingToStore = false,
}) => {
  const { section: warehouseSection, tr } = useSubsectionTranslation('warehouse');
  const [internalTab, setInternalTab] = useState<'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'>(initialTab);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailSubTab, setEmailSubTab] = useState<'config' | 'payment_methods' | 'history'>('config');
  const [notifPerm, setNotifPerm] = useState<BrowserNotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );
  const [notifPrefs, setNotifPrefs] = useState<BrowserNotificationPrefs>(() =>
    getBrowserNotificationPrefs()
  );
  const [salesPaymentMethods, setSalesPaymentMethods] = useState<SalesPaymentMethod[]>(() =>
    loadCachedSalesPaymentMethods()
  );
  const [storePaymentMethods, setStorePaymentMethods] = useState<StorePaymentMethod[]>(() =>
    loadCachedStorePaymentMethods(activeStore?.id || 'default-warehouse')
  );
  const activeTab = controlledTab || internalTab;

  useEffect(() => {
    setShowEmailPanel(false);
  }, [controlledTab]);

  useEffect(() => {
    const unsubGlobal = subscribeActiveSalesPaymentMethods((list) => {
      setSalesPaymentMethods(list);
      saveCachedSalesPaymentMethods(list);
    });
    return () => unsubGlobal();
  }, []);

  useEffect(() => {
    const targetStoreId = activeStore?.id || 'default-warehouse';
    const cached = loadCachedStorePaymentMethods(targetStoreId);
    setStorePaymentMethods(cached);
    if (!activeStore?.id) {
      return;
    }
    const unsubStore = subscribePublicStorePaymentMethods(activeStore.id, (list) => {
      setStorePaymentMethods(list);
      saveCachedStorePaymentMethods(activeStore.id, list);
    });
    return () => unsubStore();
  }, [activeStore?.id]);

  const posCustomPaymentMethods = useMemo<POSCustomPaymentOption[]>(() => {
    const map = new Map<string, POSCustomPaymentOption>();
    // Store's own active configured payment accounts take precedence with their account details
    storePaymentMethods
      .filter((m) => m.isActive)
      .forEach((m) => {
        const key = m.name.trim().toLowerCase();
        if (!key) return;
        map.set(key, {
          name: m.name.trim(),
          currency: m.currency,
          appliesIgtf: Boolean(m.appliesIgtf),
          accountHolder: m.accountHolder,
          accountDetails: m.accountDetails,
          instructions: m.instructions,
          source: 'store',
        });
      });
    // Merge Admin-defined custom sales payment methods not already customized by store
    salesPaymentMethods.forEach((m) => {
      const key = m.name.trim().toLowerCase();
      if (!key || map.has(key)) return;
      map.set(key, {
        name: m.name.trim(),
        currency: m.currency,
        appliesIgtf: Boolean(m.appliesIgtf),
        instructions: m.description,
        source: 'admin',
      });
    });
    return Array.from(map.values());
  }, [storePaymentMethods, salesPaymentMethods]);

  useEffect(() => {
    const syncState = () => {
      setNotifPerm(getBrowserNotificationPermission());
      setNotifPrefs(getBrowserNotificationPrefs());
    };
    syncState();
    return subscribeBrowserNotificationState(syncState);
  }, []);

  const handleHeaderBrowserNotifClick = async () => {
    if (notifPerm === 'default') {
      const result = await requestBrowserNotificationPermission();
      setNotifPerm(result);
      setNotifPrefs(getBrowserNotificationPrefs());
      if (result === 'granted') {
        await sendTestBrowserNotification(
          activeStore?.storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与 POS')
        );
      }
      return;
    }
    setShowEmailPanel(true);
  };

  const handleTabSelect = (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => {
    setShowEmailPanel(false);
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleDailyClosingEmail = (closing: CashClosingRecord) => {
    const storeId = activeStore?.id || 'default-warehouse';
    const storeName =
      activeStore?.storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与 POS');
    const cfg = getLocalStoreEmailConfig(storeId, activeStore?.ownerUid || '');
    const hasProvider =
      cfg.isEnabled &&
      cfg.sendSalesReports &&
      cfg.salesReportFrequency === 'daily_closing' &&
      Boolean(cfg.recipientEmail) &&
      ((cfg.provider === 'resend' && Boolean(cfg.resendApiKey)) ||
        (cfg.provider === 'smtp' && Boolean(cfg.smtpHost && cfg.smtpPass)));

    if (!hasProvider) return;

    dispatchStoreEmail({
      action: 'sales_report',
      storeId,
      storeName,
      exchangeRate,
      config: cfg,
      triggerEvent: `${tr('Cierre de Caja Z', 'Cash Closing Z-Report', '收银日结 Z 报表')} (${closing.closingNumber} · ${closing.zReportNumber})`,
      salesSummary: {
        periodLabel: `${tr('Cierre Diario', 'Daily Closing', '日结')} ${closing.date} (${closing.closingNumber})`,
        totalOrders: closing.totalTransactions,
        grossRevenueUSD: closing.totalSalesUSD,
        paymentBreakdown: Object.entries(closing.byPaymentMethod)
          .filter(([, v]) => v.count > 0)
          .map(([method, v]) => ({
            method,
            count: v.count,
            totalUSD: v.totalUSD,
          })),
      },
    }).catch(() => {});
  };

  const totalSalesUSD = sales.reduce((acc, s) => acc + s.subtotalUSD, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const tabClass = (active: boolean) =>
    `px-3.5 sm:px-4 py-2 min-h-[42px] rounded-lg font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] ${
      active
        ? 'bg-amber-400 text-zinc-950 font-semibold shadow-sm'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
    }`;

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#09090b] text-zinc-100 pb-10 md:pb-16">
      {/* Top App Subheader */}
      <div className="bg-[#111114] border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-3 safe-area-x">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={onBackToLanding}
              className="px-3 py-1.5 min-h-[40px] rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{warehouseSection.backToWeb}</span>
            </button>
            <div className="h-4 w-px bg-white/[0.1] hidden sm:block" />
            <span className="font-semibold text-zinc-100 text-sm font-display flex items-center gap-1.5 min-w-0">
              <Store className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {activeStore ? activeStore.storeName : `${warehouseSection.panelTitle} (${tr('Individual', 'Standalone', '独立模式')})`}
              </span>
            </span>

            {availableStores.length > 1 && onSelectStore && (
              <select
                value={activeStore?.id || ''}
                onChange={(e) => onSelectStore(e.target.value)}
                className="px-3 py-1.5 min-h-[40px] max-w-full rounded-lg bg-[#09090b] border border-amber-500/35 text-xs text-amber-300 font-semibold"
                aria-label={tr('Cambiar almacén por tienda', 'Switch warehouse by store', '按店铺切换仓库')}
              >
                {availableStores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.storeName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {notifPerm !== 'unsupported' && (
              <button
                type="button"
                onClick={handleHeaderBrowserNotifClick}
                className={`px-3 py-1.5 min-h-[40px] rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  notifPerm === 'granted' && notifPrefs.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/20'
                    : notifPerm === 'denied'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15'
                      : 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25'
                }`}
                title={tr(
                  'Notificaciones del navegador para stock crítico y cierres de caja',
                  'Browser notifications for critical stock and cash closings',
                  '用于低库存与日结提醒的浏览器通知'
                )}
              >
                {notifPerm === 'granted' && notifPrefs.enabled ? (
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {notifPerm === 'granted' && notifPrefs.enabled
                    ? tr('Push ON', 'Push ON', '推送已开')
                    : notifPerm === 'denied'
                      ? tr('Push Bloqueado', 'Push Blocked', '推送已拦截')
                      : notifPerm === 'granted'
                        ? tr('Push Pausado', 'Push Paused', '推送已暂停')
                        : tr('Activar Alertas', 'Enable Alerts', '启用通知')}
                </span>
              </button>
            )}
            <span className="text-zinc-400">{warehouseSection.rateLabel}</span>
            <span className="font-mono font-semibold text-amber-400 tabular-nums">
              {exchangeRate.toFixed(2)} Bs / USD
            </span>
            <span className="text-zinc-700" aria-hidden="true">|</span>
            <span className="text-zinc-400">{warehouseSection.salesToday}</span>
            <span className="font-mono font-semibold text-emerald-400 tabular-nums">
              ${totalSalesUSD.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 min-w-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-white/[0.08]">
          <button onClick={() => handleTabSelect('inventory')} className={tabClass(!showEmailPanel && activeTab === 'inventory')}>
            <Package className="w-4 h-4" />
            <span>{warehouseSection.tabInventory}</span>
            {lowStockCount > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full tabular-nums ${
                  !showEmailPanel && activeTab === 'inventory'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}
              >
                {lowStockCount}
              </span>
            )}
          </button>

          <button onClick={() => handleTabSelect('pos')} className={tabClass(!showEmailPanel && activeTab === 'pos')}>
            <Receipt className="w-4 h-4" />
            <span>{warehouseSection.tabPos}</span>
          </button>

          <button onClick={() => handleTabSelect('debtors')} className={tabClass(!showEmailPanel && activeTab === 'debtors')}>
            <BookOpen className="w-4 h-4" />
            <span>{warehouseSection.tabDebtors}</span>
          </button>

          <button onClick={() => handleTabSelect('cashier')} className={tabClass(!showEmailPanel && activeTab === 'cashier')}>
            <Coins className="w-4 h-4" />
            <span>{warehouseSection.tabCashier}</span>
          </button>

          <button onClick={() => handleTabSelect('sales')} className={tabClass(!showEmailPanel && activeTab === 'sales')}>
            <TrendingUp className="w-4 h-4" />
            <span>{warehouseSection.tabSales}</span>
          </button>

          <button
            onClick={() => {
              setEmailSubTab('config');
              setShowEmailPanel(true);
            }}
            className={tabClass(showEmailPanel)}
          >
            <Server className="w-4 h-4" />
            <span>{tr('SMTP / Cobros', 'SMTP / Payments', 'SMTP 与收款')}</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="px-3.5 py-2 min-h-[42px] rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-400/25 transition-colors shrink-0 ml-auto"
            title={tr('Lector de código de barras con cámara', 'Camera barcode scanner', '相机条码扫描')}
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{warehouseSection.scanCamera}</span>
          </button>
        </div>

        {/* Tab Body wrapped in reactive GranularTranslationScopeProvider */}
        <GranularTranslationScopeProvider section="warehouse">
          <div className="pt-6 min-w-0">
          {showEmailPanel ? (
            <EmailProviderConfigPanel
              storeId={activeStore?.id || 'default-warehouse'}
              ownerUid={activeStore?.ownerUid || ''}
              storeName={
                activeStore?.storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与 POS')
              }
              exchangeRate={exchangeRate}
              products={products}
              sales={sales}
              initialSubTab={emailSubTab}
              onStorePaymentMethodsChange={(list) => setStorePaymentMethods(list)}
            />
          ) : (
            <>
              {activeTab === 'inventory' && (
                <InventoryModule
                  products={products}
                  onUpdateProductStock={onUpdateProductStock}
                  onAddProduct={onAddProduct}
                  onImportProducts={onImportProducts}
                  exchangeRate={exchangeRate}
                  onOpenScanner={onOpenScanner}
                  sales={sales}
                  activeStore={activeStore}
                  storefrontProducts={storefrontProducts}
                  audits={audits}
                  traces={traces}
                  onAuditsChange={onAuditsChange}
                  onTracesChange={onTracesChange}
                  onPublishProductToStore={onPublishProductToStore}
                  onSyncAllToStore={onSyncAllToStore}
                  isSyncingToStore={isSyncingToStore}
                />
              )}

              {activeTab === 'pos' && (
                <POSModule
                  products={products}
                  exchangeRate={exchangeRate}
                  onCompleteSale={onCompleteSale}
                  onOpenScanner={onOpenScanner}
                  customPaymentMethods={posCustomPaymentMethods}
                  onOpenPaymentSettings={() => {
                    setEmailSubTab('payment_methods');
                    setShowEmailPanel(true);
                  }}
                />
              )}

              {activeTab === 'debtors' && (
                <FiadosModule
                  debtors={debtors}
                  exchangeRate={exchangeRate}
                  onAddDebtor={onAddDebtor}
                  onRecordPayment={onRecordPayment}
                />
              )}

              {activeTab === 'cashier' && (
                <CashierModule
                  movements={movements}
                  exchangeRate={exchangeRate}
                  onAddMovement={onAddMovement}
                  sales={sales}
                  purchases={purchases}
                  closings={closings}
                  onPurchasesChange={onPurchasesChange}
                  onClosingsChange={onClosingsChange}
                  onClosingCompleted={handleDailyClosingEmail}
                />
              )}

              {activeTab === 'sales' && (
                <AnalyticsModule
                  sales={sales}
                  products={products}
                  exchangeRate={exchangeRate}
                  audits={audits}
                  activeStore={activeStore}
                  onOpenEmailConfig={() => setShowEmailPanel(true)}
                  onGoToPOS={() => handleTabSelect('pos')}
                />
              )}
            </>
          )}
          </div>
        </GranularTranslationScopeProvider>
      </div>
    </div>
  );
};
