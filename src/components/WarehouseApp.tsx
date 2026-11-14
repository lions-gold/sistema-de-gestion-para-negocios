import React, { useState } from 'react';
import {
  Product,
  Debtor,
  CashMovement,
  Sale,
  StoreTenant,
  StoreProduct,
  InventoryAuditLog,
  ProductBatchTrace,
  PurchaseInvoice,
  CashClosingRecord,
} from '../types';
import { InventoryModule } from './InventoryModule';
import { POSModule } from './POSModule';
import { FiadosModule } from './FiadosModule';
import { CashierModule } from './CashierModule';
import { AnalyticsModule } from './AnalyticsModule';
import {
  Package,
  Receipt,
  BookOpen,
  Coins,
  ArrowLeft,
  Store,
  TrendingUp,
  Camera
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { t } = useLanguage();
  const [internalTab, setInternalTab] = useState<'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'>(initialTab);
  const activeTab = controlledTab || internalTab;

  const handleTabSelect = (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 pb-10 md:pb-16">
      {/* Top App Subheader */}
      <div className="bg-[#111114] border-b border-white/[0.08] px-3 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              onClick={onBackToLanding}
              className="px-3 py-1.5 min-h-[40px] rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.warehouse.backToWeb}</span>
            </button>
            <div className="h-4 w-px bg-white/[0.1] hidden sm:block" />
            <span className="font-semibold text-zinc-100 text-sm font-display flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {activeStore ? activeStore.storeName : `${t.warehouse.panelTitle} (Individual)`}
              </span>
            </span>

            {availableStores.length > 1 && onSelectStore && (
              <select
                value={activeStore?.id || ''}
                onChange={(e) => onSelectStore(e.target.value)}
                className="px-3 py-1.5 min-h-[40px] rounded-lg bg-[#09090b] border border-amber-500/35 text-xs text-amber-300 font-semibold"
                aria-label="Cambiar almacén por tienda"
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
            <span className="text-zinc-400">{t.warehouse.rateLabel}</span>
            <span className="font-mono font-semibold text-amber-400 tabular-nums">
              {exchangeRate.toFixed(2)} Bs / USD
            </span>
            <span className="text-zinc-700" aria-hidden="true">|</span>
            <span className="text-zinc-400">{t.warehouse.salesToday}</span>
            <span className="font-mono font-semibold text-emerald-400 tabular-nums">
              ${totalSalesUSD.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 border-b border-white/[0.08]">
          <button onClick={() => handleTabSelect('inventory')} className={tabClass(activeTab === 'inventory')}>
            <Package className="w-4 h-4" />
            <span>{t.warehouse.tabInventory}</span>
            {lowStockCount > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full tabular-nums ${
                  activeTab === 'inventory'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}
              >
                {lowStockCount}
              </span>
            )}
          </button>

          <button onClick={() => handleTabSelect('pos')} className={tabClass(activeTab === 'pos')}>
            <Receipt className="w-4 h-4" />
            <span>{t.warehouse.tabPos}</span>
          </button>

          <button onClick={() => handleTabSelect('debtors')} className={tabClass(activeTab === 'debtors')}>
            <BookOpen className="w-4 h-4" />
            <span>{t.warehouse.tabDebtors}</span>
          </button>

          <button onClick={() => handleTabSelect('cashier')} className={tabClass(activeTab === 'cashier')}>
            <Coins className="w-4 h-4" />
            <span>{t.warehouse.tabCashier}</span>
          </button>

          <button onClick={() => handleTabSelect('sales')} className={tabClass(activeTab === 'sales')}>
            <TrendingUp className="w-4 h-4" />
            <span>{t.warehouse.tabSales}</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="px-3.5 py-2 min-h-[42px] rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-400/25 transition-colors shrink-0 ml-auto"
            title={t.header.scannerTitle}
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{t.warehouse.scanCamera}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="pt-6">
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
            />
          )}

          {activeTab === 'sales' && (
            <AnalyticsModule
              sales={sales}
              products={products}
              exchangeRate={exchangeRate}
              audits={audits}
            />
          )}
        </div>
      </div>
    </div>
  );
};
