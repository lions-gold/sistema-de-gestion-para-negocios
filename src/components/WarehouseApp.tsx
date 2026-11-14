import React, { useState } from 'react';
import { Product, Debtor, CashMovement, Sale } from '../types';
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
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onImportProducts?: (products: Omit<Product, 'id'>[], mergeBySku?: boolean) => void;
  onCompleteSale: (sale: Sale) => void;
  onAddDebtor: (debtor: Omit<Debtor, 'id' | 'history'>) => void;
  onRecordPayment: (debtorId: string, amountUSD: number, description: string) => void;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
  onBackToLanding: () => void;
  onOpenScanner: () => void;
  activeTab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  onTabChange?: (tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => void;
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
    `px-4 py-2 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
      active
        ? 'bg-amber-400 text-zinc-950 font-semibold shadow-sm'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
    }`;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 pb-24 md:pb-16">
      {/* Top App Subheader */}
      <div className="bg-[#111114] border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.warehouse.backToWeb}</span>
            </button>
            <div className="h-4 w-px bg-white/[0.1]" />
            <span className="font-semibold text-zinc-100 text-sm font-display flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-400" />
              {t.warehouse.panelTitle}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-white/[0.08]">
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
            className="px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-400/25 transition-colors shrink-0 ml-auto"
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
            />
          )}

          {activeTab === 'sales' && (
            <AnalyticsModule
              sales={sales}
              products={products}
              exchangeRate={exchangeRate}
            />
          )}
        </div>
      </div>
    </div>
  );
};
