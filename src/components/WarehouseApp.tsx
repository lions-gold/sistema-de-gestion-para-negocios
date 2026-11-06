import React, { useState } from 'react';
import { Product, Debtor, CashMovement, Sale } from '../types';
import { InventoryModule } from './InventoryModule';
import { POSModule } from './POSModule';
import { FiadosModule } from './FiadosModule';
import { CashierModule } from './CashierModule';
import { 
  Package, 
  Receipt, 
  BookOpen, 
  Coins, 
  ArrowLeft, 
  History, 
  Store,
  DollarSign,
  TrendingUp,
  Download
} from 'lucide-react';

interface WarehouseAppProps {
  products: Product[];
  debtors: Debtor[];
  movements: CashMovement[];
  sales: Sale[];
  exchangeRate: number;
  initialTab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  onUpdateProductStock: (id: string, delta: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onCompleteSale: (sale: Sale) => void;
  onAddDebtor: (debtor: Omit<Debtor, 'id' | 'history'>) => void;
  onRecordPayment: (debtorId: string, amountUSD: number, description: string) => void;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
  onBackToLanding: () => void;
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
  onCompleteSale,
  onAddDebtor,
  onRecordPayment,
  onAddMovement,
  onBackToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales'>(initialTab);

  const totalSalesUSD = sales.reduce((acc, s) => acc + s.subtotalUSD, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top App Subheader */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Web</span>
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <span className="font-bold text-white text-sm font-display flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-400" />
              Panel Operativo: La Taberna Lions Gold
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Tasa:</span>
            <span className="font-mono font-bold text-amber-400 tabular-nums">
              {exchangeRate.toFixed(2)} Bs / USD
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Ventas Hoy:</span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              ${totalSalesUSD.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'inventory'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Almacén e Inventario</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'pos'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Punto de Venta (POS)</span>
          </button>

          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'debtors'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Libreta de Fiados (WhatsApp)</span>
          </button>

          <button
            onClick={() => setActiveTab('cashier')}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'cashier'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Caja Chica & Gastos</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'sales'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Ventas ({sales.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="pt-6">
          {activeTab === 'inventory' && (
            <InventoryModule
              products={products}
              onUpdateProductStock={onUpdateProductStock}
              onAddProduct={onAddProduct}
              exchangeRate={exchangeRate}
            />
          )}

          {activeTab === 'pos' && (
            <POSModule
              products={products}
              exchangeRate={exchangeRate}
              onCompleteSale={onCompleteSale}
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
            />
          )}

          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base font-display">
                    Registro de Comprobantes de Venta
                  </h3>
                  <span className="text-xs text-slate-400">
                    Historial de órdenes emitidas en La Taberna Lions Gold
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Facturación acumulada</span>
                  <span className="font-mono font-bold text-amber-400 text-lg tabular-nums">
                    ${totalSalesUSD.toFixed(2)} USD
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Recibo #</th>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Productos</th>
                        <th className="py-3 px-4">Método</th>
                        <th className="py-3 px-4 text-right">Total (USD)</th>
                        <th className="py-3 px-4 text-right">Total (Bs.)</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {sale.receiptNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                            {sale.date}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">
                            {sale.customerName}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {sale.items.map((it) => `${it.quantity}x ${it.product.name}`).join(', ')}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {sale.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                            ${sale.subtotalUSD.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums text-xs">
                            {sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {sale.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
