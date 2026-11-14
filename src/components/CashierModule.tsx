import React, { useState, useMemo } from 'react';
import { 
  CashMovement, 
  Sale, 
  PurchaseInvoice, 
  CashClosingRecord, 
  FiscalPrinterConfig, 
  PaymentMethod 
} from '../types';
import { 
  INITIAL_PURCHASE_INVOICES, 
  INITIAL_CASH_CLOSINGS 
} from '../data/mockData';
import { 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  Calendar, 
  X,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  DollarSign,
  Building,
  RefreshCw,
  Sliders,
  Landmark,
  Scale
} from 'lucide-react';
import { 
  DEFAULT_FISCAL_CONFIG, 
  getStoredFiscalConfig, 
  saveStoredFiscalConfig, 
  generateReportXCommand, 
  generateReportZCommand, 
  downloadFiscalSpoolerFile 
} from '../utils/fiscalPrinter';
import { 
  exportLibroVentasCSV, 
  exportLibroVentasPDF, 
  exportLibroComprasCSV, 
  exportLibroComprasPDF, 
  exportCashClosingPDF 
} from '../utils/seniatExport';

interface CashierModuleProps {
  movements: CashMovement[];
  exchangeRate: number;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
  sales: Sale[];
}

export const CashierModule: React.FC<CashierModuleProps> = ({
  movements,
  exchangeRate,
  onAddMovement,
  sales,
}) => {
  const [subTab, setSubTab] = useState<'closing' | 'fiscal_printers' | 'seniat_books' | 'petty_cash'>('closing');

  // Fiscal Printer Config
  const [fiscalConfig, setFiscalConfig] = useState<FiscalPrinterConfig>(getStoredFiscalConfig);
  const [printerStatus, setPrinterStatus] = useState<{
    connected: boolean;
    paperOk: boolean;
    fiscalMemoryOk: boolean;
    clockOk: boolean;
  }>({
    connected: true,
    paperOk: true,
    fiscalMemoryOk: true,
    clockOk: true,
  });

  // Purchase Invoices (Libro de Compras)
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(INITIAL_PURCHASE_INVOICES);
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);

  // Cash Closings History
  const [closings, setClosings] = useState<CashClosingRecord[]>(INITIAL_CASH_CLOSINGS);

  // Arqueo Inputs
  const [declaredUSD, setDeclaredUSD] = useState('');
  const [declaredBs, setDeclaredBs] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSuccessToast, setClosingSuccessToast] = useState<string | null>(null);

  // Terminal / Command Log for Fiscal Printer
  const [fiscalLogs, setFiscalLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Impresora fiscal detectada: ${fiscalConfig.brand} (${fiscalConfig.model}) en ${fiscalConfig.port}`,
    `[${new Date().toLocaleTimeString()}] Memoria fiscal activa: ${fiscalConfig.serialNumber} • Reporte Z actual: Z-${String(fiscalConfig.currentZReport).padStart(4, '0')}`,
    `[${new Date().toLocaleTimeString()}] Protocolo homologado SENIAT: OK • IGTF 3% configurado en alícuota G`,
  ]);

  // Petty Cash Movement Modal
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<CashMovement['type']>('gasto');
  const [movementCategory, setMovementCategory] = useState<CashMovement['category']>('Inventario');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementAmountUSD, setMovementAmountUSD] = useState('');

  // New Purchase Invoice Form
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRIF, setNewSupplierRIF] = useState('J-');
  const [newInvoiceNum, setNewInvoiceNum] = useState('');
  const [newControlNum, setNewControlNum] = useState('00-');
  const [newBaseUSD, setNewBaseUSD] = useState('');
  const [newCategory, setNewCategory] = useState<PurchaseInvoice['category']>('Licores');

  // --- DUAL CASH CLOSING CALCULATIONS ---
  const paymentMethodStats = useMemo(() => {
    const stats: {
      [key in PaymentMethod]: { count: number; totalUSD: number; totalBs: number; igtfUSD: number };
    } = {
      'Efectivo USD': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
      'Efectivo Bs': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
      'Pago Móvil': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
      'Punto de Venta': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
      'Zelle': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
      'Fiado (Crédito)': { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 },
    };

    let totalSalesUSD = 0;
    let totalSalesBs = 0;
    let totalBaseUSD = 0;
    let totalIVAUSD = 0;
    let totalIGTFUSD = 0;

    sales.forEach((s) => {
      const isForeign = s.paymentMethod === 'Efectivo USD' || s.paymentMethod === 'Zelle';
      const igtf = isForeign ? s.subtotalUSD * 0.03 : 0;
      const totalUSDWithIgtf = s.subtotalUSD + igtf;
      const totalBsWithIgtf = totalUSDWithIgtf * exchangeRate;

      const baseUSD = s.subtotalUSD / 1.16;
      const ivaUSD = s.subtotalUSD - baseUSD;

      totalSalesUSD += totalUSDWithIgtf;
      totalSalesBs += totalBsWithIgtf;
      totalBaseUSD += baseUSD;
      totalIVAUSD += ivaUSD;
      totalIGTFUSD += igtf;

      if (stats[s.paymentMethod]) {
        stats[s.paymentMethod].count += 1;
        stats[s.paymentMethod].totalUSD += totalUSDWithIgtf;
        stats[s.paymentMethod].totalBs += totalBsWithIgtf;
        stats[s.paymentMethod].igtfUSD += igtf;
      }
    });

    const expectedCashUSD = stats['Efectivo USD'].totalUSD;
    const expectedCashBs = stats['Efectivo Bs'].totalBs;

    return {
      byMethod: stats,
      totalSalesUSD,
      totalSalesBs,
      totalBaseUSD,
      totalIVAUSD,
      totalIGTFUSD,
      totalIGTFBs: totalIGTFUSD * exchangeRate,
      expectedCashUSD,
      expectedCashBs,
      totalTransactions: sales.length,
    };
  }, [sales, exchangeRate]);

  // Arqueo Calculations
  const declaredCashUSDNum = parseFloat(declaredUSD) || 0;
  const declaredCashBsNum = parseFloat(declaredBs) || 0;
  const diffUSD = declaredCashUSDNum - paymentMethodStats.expectedCashUSD;
  const diffBs = declaredCashBsNum - paymentMethodStats.expectedCashBs;

  // Execute Dual Cash Closing & Report Z
  const handlePerformCashClosing = () => {
    const nextClosingNum = `CIERRE-2026-${String(closings.length + 42).padStart(4, '0')}`;
    const { newZNumber, jsonPayload } = generateReportZCommand(fiscalConfig, fiscalConfig.currentZReport);
    const zReportStr = `Z-${String(newZNumber).padStart(4, '0')}`;

    const newClosing: CashClosingRecord = {
      id: `closing-${Date.now()}`,
      closingNumber: nextClosingNum,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      cashierName: 'Administración Smith Solutions',
      exchangeRate,
      zReportNumber: zReportStr,
      byPaymentMethod: paymentMethodStats.byMethod,
      totalSalesUSD: paymentMethodStats.totalSalesUSD,
      totalSalesBs: paymentMethodStats.totalSalesBs,
      totalBaseUSD: paymentMethodStats.totalBaseUSD,
      totalIVAUSD: paymentMethodStats.totalIVAUSD,
      totalIGTFUSD: paymentMethodStats.totalIGTFUSD,
      totalIGTFBs: paymentMethodStats.totalIGTFBs,
      declaredCashUSD: declaredCashUSDNum || paymentMethodStats.expectedCashUSD,
      declaredCashBs: declaredCashBsNum || paymentMethodStats.expectedCashBs,
      expectedCashUSD: paymentMethodStats.expectedCashUSD,
      expectedCashBs: paymentMethodStats.expectedCashBs,
      differenceUSD: diffUSD,
      differenceBs: diffBs,
      totalTransactions: paymentMethodStats.totalTransactions,
      status: Math.abs(diffUSD) < 0.01 && Math.abs(diffBs) < 0.01 ? 'Cuadrada' : 'Con Diferencia',
      notes: closingNotes.trim() || 'Cierre fiscal de jornada comercial Smith Solutions E-Commerce.',
    };

    // Update fiscal config with new Z number
    const updatedConfig: FiscalPrinterConfig = {
      ...fiscalConfig,
      currentZReport: newZNumber,
    };
    setFiscalConfig(updatedConfig);
    saveStoredFiscalConfig(updatedConfig);

    setClosings([newClosing, ...closings]);
    setFiscalLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] *** REPORTE Z GENERADO: ${zReportStr} ***`,
      `[${new Date().toLocaleTimeString()}] Total ventas: $${paymentMethodStats.totalSalesUSD.toFixed(2)} (${paymentMethodStats.totalSalesBs.toLocaleString('es-VE')} Bs.)`,
      `[${new Date().toLocaleTimeString()}] IGTF 3% Divisas consolidado: $${paymentMethodStats.totalIGTFUSD.toFixed(2)}`,
      `[${new Date().toLocaleTimeString()}] Memoria fiscal grabada con éxito. Cierre Nro ${nextClosingNum}`,
      ...prev,
    ]);

    setClosingSuccessToast(`Cierre de Caja ${nextClosingNum} y Reporte ${zReportStr} emitidos exitosamente.`);
    setTimeout(() => setClosingSuccessToast(null), 5000);
  };

  // Fiscal Printer Test Actions
  const handlePrintReportX = () => {
    const { commandText, jsonPayload } = generateReportXCommand(fiscalConfig);
    setFiscalLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] [COMANDO ENVIADO: ${commandText}] Emisión de Reporte X (Lectura Parcial sin corte)`,
      `[${new Date().toLocaleTimeString()}] Ventas acumuladas en jornada: $${paymentMethodStats.totalSalesUSD.toFixed(2)} • IVA: $${paymentMethodStats.totalIVAUSD.toFixed(2)} • IGTF: $${paymentMethodStats.totalIGTFUSD.toFixed(2)}`,
      `[${new Date().toLocaleTimeString()}] Memoria de trabajo leída correctamente.`,
      ...prev,
    ]);
    downloadFiscalSpoolerFile(commandText, `ReporteX_${fiscalConfig.brand.replace(/\s+/g, '_')}.txt`);
  };

  const handlePrintReportZ = () => {
    handlePerformCashClosing();
  };

  const handleSavePrinterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredFiscalConfig(fiscalConfig);
    setFiscalLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Configuración de impresora fiscal actualizada: ${fiscalConfig.brand} (${fiscalConfig.model}) en ${fiscalConfig.port} @ ${fiscalConfig.baudRate}bps`,
      ...prev,
    ]);
  };

  // Create Purchase Invoice (Libro de Compras)
  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const base = parseFloat(newBaseUSD) || 0;
    if (base <= 0 || !newSupplierName.trim()) return;

    const iva = base * 0.16;
    const total = base + iva;
    const retention = iva * 0.75; // 75% standard retention

    const newPurchase: PurchaseInvoice = {
      id: `pur-${Date.now()}`,
      operationNumber: purchases.length + 1,
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: newInvoiceNum.trim() || `00${Math.floor(100000 + Math.random() * 900000)}`,
      controlNumber: newControlNum.trim() || `00-${Math.floor(100000 + Math.random() * 900000)}`,
      supplierName: newSupplierName.trim(),
      supplierRIF: newSupplierRIF.trim().toUpperCase() || 'J-00000000-0',
      exemptAmountUSD: 0,
      baseAmountUSD: base,
      ivaRate: 0.16,
      ivaAmountUSD: iva,
      totalAmountUSD: total,
      retentionRate: 0.75,
      retentionAmountUSD: retention,
      category: newCategory,
    };

    setPurchases([newPurchase, ...purchases]);
    setNewSupplierName('');
    setNewBaseUSD('');
    setNewInvoiceNum('');
    setShowAddPurchaseModal(false);
  };

  // Petty cash movement
  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(movementAmountUSD);
    if (isNaN(val) || val <= 0 || !movementDescription.trim()) return;

    onAddMovement({
      type: movementType,
      category: movementCategory,
      description: movementDescription.trim(),
      amountUSD: val,
    });

    setMovementDescription('');
    setMovementAmountUSD('');
    setShowAddMovementModal(false);
  };

  // Summary for SENIAT
  const totalDebitoFiscalBs = paymentMethodStats.totalIVAUSD * exchangeRate;
  const totalCreditoFiscalBs = purchases.reduce((acc, p) => acc + p.ivaAmountUSD, 0) * exchangeRate;
  const totalIGTFBols = paymentMethodStats.totalIGTFUSD * exchangeRate;
  const totalRetencionesBs = purchases.reduce((acc, p) => acc + p.retentionAmountUSD, 0) * exchangeRate;
  const saldoIVABs = totalDebitoFiscalBs - totalCreditoFiscalBs;

  return (
    <div className="space-y-6">
      {/* Module Title & Sub-tabs */}
      <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base sm:text-lg font-display flex items-center gap-2">
                Caja, Cierre Dual & Fiscalidad SENIAT
              </h2>
              <p className="text-xs text-zinc-400">
                Arqueo dual por método de pago, IGTF 3%, impresoras fiscales y libros de compra/venta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto text-xs">
            <span className="text-zinc-400 px-2 hidden sm:inline">Tasa BCV:</span>
            <span className="font-mono font-bold text-amber-400 px-2 py-1 bg-[#111114] rounded-lg">
              {exchangeRate.toFixed(2)} Bs / USD
            </span>
          </div>
        </div>

        {/* 4 Segmented Sub-tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setSubTab('closing')}
            className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
              subTab === 'closing'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-[#09090b] text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>Cierre Dual & Arqueo</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('fiscal_printers')}
            className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
              subTab === 'fiscal_printers'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-[#09090b] text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Impresoras Fiscales</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('seniat_books')}
            className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
              subTab === 'seniat_books'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-[#09090b] text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Libros Compra/Venta</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('petty_cash')}
            className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
              subTab === 'petty_cash'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-[#09090b] text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]'
            }`}
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>Caja Chica & Gastos</span>
          </button>
        </div>
      </div>

      {closingSuccessToast && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{closingSuccessToast}</span>
          </div>
          <button onClick={() => setClosingSuccessToast(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: CIERRE DE CAJA DUAL & ARQUEO POR MÉTODO DE PAGO */}
      {/* ========================================================================= */}
      {subTab === 'closing' && (
        <div className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Ventas Totales del Día</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${paymentMethodStats.totalSalesUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {paymentMethodStats.totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Base Imponible (16%)</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                ${paymentMethodStats.totalBaseUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                IVA (16%): ${paymentMethodStats.totalIVAUSD.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">IGTF 3% Percibido (Divisas)</span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                ${paymentMethodStats.totalIGTFUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {paymentMethodStats.totalIGTFBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Reporte Fiscal Oficial</span>
              <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                Z-{String(fiscalConfig.currentZReport).padStart(4, '0')}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {paymentMethodStats.totalTransactions} transacciones registradas
              </span>
            </div>
          </div>

          {/* Exact Breakdown by Payment Method Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#09090b]/70 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  Desglose Exacto por Método de Pago Recibido
                </h3>
                <span className="text-[11px] text-zinc-400">
                  Separación estricta de ingresos en divisas ($ USD) y moneda nacional (Bs.)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/90 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4 text-center">Transacciones</th>
                    <th className="py-3 px-4 text-right">Monto Recaudado ($ USD)</th>
                    <th className="py-3 px-4 text-right">Contravalor en Bolívares (Bs.)</th>
                    <th className="py-3 px-4 text-right">IGTF 3% Divisas</th>
                    <th className="py-3 px-4 text-center">Destino de Caja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {Object.entries(paymentMethodStats.byMethod).map(([method, data]) => (
                    <tr key={method} className="hover:bg-zinc-800/80/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          method.includes('USD') || method === 'Zelle' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`} />
                        <span>{method}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-300">
                        {data.count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                        ${data.totalUSD.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums">
                        {data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 tabular-nums">
                        {data.igtfUSD > 0 ? `+$${data.igtfUSD.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          method === 'Efectivo USD' 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : method === 'Efectivo Bs'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-zinc-900 text-zinc-300 border-white/[0.1]'
                        }`}>
                          {method.includes('Efectivo') ? 'Gaveta Física' : 'Cuenta Bancaria'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#09090b] font-bold border-t border-white/[0.08] text-xs">
                  <tr>
                    <td className="py-3 px-4 text-amber-400 uppercase">Totales Consolidados</td>
                    <td className="py-3 px-4 text-center font-mono text-amber-400">{paymentMethodStats.totalTransactions}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400 text-sm">
                      ${paymentMethodStats.totalSalesUSD.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      {paymentMethodStats.totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      ${paymentMethodStats.totalIGTFUSD.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-400 text-[11px]">100% Cuadrado</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Arqueo de Gaveta Física (Dual Currency Cash Count) */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-400" />
                  Arqueo Físico de Gaveta (Conteo Real en Efectivo)
                </h3>
                <span className="text-[11px] text-zinc-400">
                  Ingresa el efectivo contado físicamente en caja para verificar sobrantes o faltantes
                </span>
              </div>
              <span className="text-xs font-mono text-amber-400">
                Arqueo Dual USD / Bs.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* USD Cash Count */}
              <div className="bg-[#09090b] p-4 rounded-xl border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> Efectivo en Dólares ($ USD)
                  </span>
                  <span className="text-zinc-400 font-mono">
                    Esperado: ${paymentMethodStats.expectedCashUSD.toFixed(2)}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Monto Declarado Contado:</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={paymentMethodStats.expectedCashUSD.toFixed(2)}
                    value={declaredUSD}
                    onChange={(e) => setDeclaredUSD(e.target.value)}
                    className="w-full bg-[#111114] border border-white/[0.08] rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div className="pt-1 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Diferencia:</span>
                  <span className={`font-bold ${
                    Math.abs(diffUSD) < 0.01 ? 'text-emerald-400' : diffUSD > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {Math.abs(diffUSD) < 0.01 
                      ? '✓ $0.00 (Cuadrado Exacto)' 
                      : diffUSD > 0 
                      ? `+$${diffUSD.toFixed(2)} (Sobrante)` 
                      : `-$${Math.abs(diffUSD).toFixed(2)} (Faltante)`}
                  </span>
                </div>
              </div>

              {/* Bs. Cash Count */}
              <div className="bg-[#09090b] p-4 rounded-xl border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-4 h-4" /> Efectivo en Bolívares (Bs.)
                  </span>
                  <span className="text-zinc-400 font-mono">
                    Esperado: {paymentMethodStats.expectedCashBs.toFixed(2)} Bs.
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Monto Declarado Contado:</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={paymentMethodStats.expectedCashBs.toFixed(2)}
                    value={declaredBs}
                    onChange={(e) => setDeclaredBs(e.target.value)}
                    className="w-full bg-[#111114] border border-white/[0.08] rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div className="pt-1 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Diferencia:</span>
                  <span className={`font-bold ${
                    Math.abs(diffBs) < 0.01 ? 'text-emerald-400' : diffBs > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {Math.abs(diffBs) < 0.01 
                      ? '✓ 0.00 Bs. (Cuadrado Exacto)' 
                      : diffBs > 0 
                      ? `+${diffBs.toFixed(2)} Bs. (Sobrante)` 
                      : `-${Math.abs(diffBs).toFixed(2)} Bs. (Faltante)`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">Observaciones / Notas del Cierre:</label>
              <input
                type="text"
                placeholder="Ej: Cierre de turno nocturno sin incidentes. Arqueo verificado."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-xs text-white"
              />
            </div>

            {/* Actions for Closing */}
            <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-400 font-mono">
                Al ejecutar el cierre se emitirá automáticamente el Reporte Z oficial en la memoria fiscal.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReportX}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/[0.1] rounded-xl text-xs font-bold flex items-center gap-2 min-h-[44px]"
                  title="Emitir lectura de comprobación sin corte"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Emitir Reporte X</span>
                </button>

                <button
                  type="button"
                  onClick={handlePerformCashClosing}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Realizar Cierre de Caja (Reporte Z)</span>
                </button>
              </div>
            </div>
          </div>

          {/* History of Past Cash Closings */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#09090b]/70 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="font-bold text-white text-sm font-display">
                Historial de Cierres de Caja Anteriores ({closings.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/90 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Cierre #</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Reporte Fiscal</th>
                    <th className="py-3 px-4 text-right">Total ($ USD)</th>
                    <th className="py-3 px-4 text-right">Total (Bs.)</th>
                    <th className="py-3 px-4 text-center">Estado Cuadre</th>
                    <th className="py-3 px-4 text-center">Comprobante PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {closings.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-800/80/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {c.closingNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400 text-xs">
                        {c.timestamp}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-400 font-bold text-xs">
                        {c.zReportNumber}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                        ${c.totalSalesUSD.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums text-xs">
                        {c.totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          c.status === 'Cuadrada'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => exportCashClosingPDF(c)}
                          className="px-2.5 py-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] text-amber-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
                          title="Descargar comprobante en PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: INTEGRACIÓN CON IMPRESORAS FISCALES VENEZOLANAS */}
      {/* ========================================================================= */}
      {subTab === 'fiscal_printers' && (
        <div className="space-y-6">
          {/* Printer Device Specs & Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status Card */}
            <div className="bg-[#111114] border border-white/[0.08] p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="font-bold text-white text-sm font-display flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Estado de Homologación Fiscal
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CONECTADA
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Marca Activa:</span>
                  <span className="font-bold text-amber-400">{fiscalConfig.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Modelo Homologado:</span>
                  <span className="text-white">{fiscalConfig.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Serial Fiscal (SENIAT):</span>
                  <span className="font-mono text-emerald-400 font-bold">{fiscalConfig.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Puerto / Enlace:</span>
                  <span className="font-mono text-white">{fiscalConfig.port} ({fiscalConfig.baudRate} bps)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Último Reporte Z:</span>
                  <span className="font-mono text-blue-400 font-bold">Z-{String(fiscalConfig.currentZReport).padStart(4, '0')}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  Papel: OK
                </div>
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  Memoria: OK
                </div>
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  Reloj: OK
                </div>
              </div>
            </div>

            {/* Supported Venezuelan Brands Grid */}
            <div className="lg:col-span-2 bg-[#111114] border border-white/[0.08] p-5 rounded-xl space-y-4">
              <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                Marcas de Impresoras Fiscales Homologadas en Venezuela
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setFiscalConfig({ ...fiscalConfig, brand: 'The Factory HKA', model: 'Bixolon SRP-350 / Dascom DT-230' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fiscalConfig.brand === 'The Factory HKA'
                      ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold block text-sm">HKA</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">The Factory HKA</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-1 block">Bixolon / Dascom</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiscalConfig({ ...fiscalConfig, brand: 'BMC / Bematech', model: 'MP-4000 TH FI / MP-2100' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fiscalConfig.brand === 'BMC / Bematech'
                      ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold block text-sm">Bematech</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">BMC Venezuela</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-1 block">MP-4000 TH FI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiscalConfig({ ...fiscalConfig, brand: 'Elepunto / Epson', model: 'TM-T88IV / TM-T88V Fiscal' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fiscalConfig.brand === 'Elepunto / Epson'
                      ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold block text-sm">Epson</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">Elepunto Fiscal</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-1 block">TM-T88 Serie</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiscalConfig({ ...fiscalConfig, brand: 'Aclas', model: 'Aclas PP9 / CR2050' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fiscalConfig.brand === 'Aclas'
                      ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold block text-sm">Aclas</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">Aclas Venezuela</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-1 block">PP9 / CR2050</span>
                </button>
              </div>

              {/* Fiscal Action Triggers */}
              <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintReportX}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-white/[0.1] min-h-[44px]"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Emitir Reporte X</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReportZ}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Emitir Reporte Z (Cierre Fiscal)</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFiscalSpoolerFile(fiscalLogs.join('\n'), 'Trama_Spooler_HKA.txt')}
                  className="px-4 py-2.5 bg-[#09090b] hover:bg-zinc-800/80 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2 min-h-[44px] ml-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Trama Spooler HKA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Form & Live Command Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Config inputs (5 cols) */}
            <form onSubmit={handleSavePrinterSettings} className="lg:col-span-5 bg-[#111114] border border-white/[0.08] p-5 rounded-xl space-y-4 text-xs">
              <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Parámetros de Conexión Fiscal
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Puerto Serie / Conexión</label>
                  <select
                    value={fiscalConfig.port}
                    onChange={(e) => setFiscalConfig({ ...fiscalConfig, port: e.target.value })}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="COM1">COM1 (Puerto Serie Nativo)</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3 (Adaptador USB-Serial Prolific/FTDI)</option>
                    <option value="COM4">COM4</option>
                    <option value="192.168.1.150:8080">TCP/IP (Red Local Ethernet 192.168.1.150:8080)</option>
                    <option value="SpoolerHKA">Spooler HKA Service (C:\SpoolerHKA\in)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Baud Rate (bps)</label>
                    <select
                      value={fiscalConfig.baudRate}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, baudRate: parseInt(e.target.value) })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                    >
                      <option value="9600">9600 bps</option>
                      <option value="19200">19200 bps</option>
                      <option value="38400">38400 bps</option>
                      <option value="115200">115200 bps</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Serial Fiscal</label>
                    <input
                      type="text"
                      value={fiscalConfig.serialNumber}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, serialNumber: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Encabezado Razón Social (Fiscal)</label>
                  <input
                    type="text"
                    value={fiscalConfig.headerCompany}
                    onChange={(e) => setFiscalConfig({ ...fiscalConfig, headerCompany: e.target.value })}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">RIF Fiscal</label>
                    <input
                      type="text"
                      value={fiscalConfig.headerRIF}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, headerRIF: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Consecutivo Factura</label>
                    <input
                      type="number"
                      value={fiscalConfig.currentInvoiceNum}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, currentInvoiceNum: parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Parámetros Fiscales</span>
                </button>
              </div>
            </form>

            {/* Live Command Console / Tramas (7 cols) */}
            <div className="lg:col-span-7 bg-[#09090b] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between font-mono text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Consola de Tramas Fiscales (Spooler Driver)
                </span>
                <span className="text-zinc-500 text-[10px]">ESC/POS Fiscal Protocol</span>
              </div>

              <div className="bg-black/60 p-3 rounded-lg border border-white/[0.06] overflow-y-auto max-h-[260px] space-y-1.5 text-[11px] text-zinc-300">
                {fiscalLogs.map((log, i) => (
                  <div key={i} className="leading-relaxed font-mono">
                    {log}
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1">
                <span>Homologado conforme a Providencia SENIAT/00071</span>
                <span>Desarrollado por Smith Bussines Solutions 2026</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: LIBROS DE COMPRA Y VENTA (SENIAT) */}
      {/* ========================================================================= */}
      {subTab === 'seniat_books' && (
        <div className="space-y-6">
          {/* Fiscal Summary Cards (Débito vs Crédito Fiscal) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Débito Fiscal IVA (Ventas)</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${paymentMethodStats.totalIVAUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalDebitoFiscalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Crédito Fiscal IVA (Compras)</span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                ${purchases.reduce((acc, p) => acc + p.ivaAmountUSD, 0).toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalCreditoFiscalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">IGTF 3% Percibido a Enterar</span>
              <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                ${paymentMethodStats.totalIGTFUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalIGTFBols.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Retenciones IVA Aplicadas</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                ${purchases.reduce((acc, p) => acc + p.retentionAmountUSD, 0).toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalRetencionesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
          </div>

          {/* Libro de Ventas Section */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm space-y-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-bold text-white text-base font-display flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Libro de Ventas Fiscal (SENIAT) - Noviembre 2026
                </h3>
                <span className="text-xs text-zinc-400">
                  Desglose oficial de facturas con IGTF 3% en divisas ({sales.length} comprobantes emitidos)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportLibroVentasCSV(sales, exchangeRate)}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/[0.1] min-h-[40px]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Excel/CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportLibroVentasPDF(sales, exchangeRate)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Libro en PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#09090b] text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-2.5 px-3">Op</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">RIF/CI</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Factura</th>
                    <th className="py-2.5 px-3">Reporte Z</th>
                    <th className="py-2.5 px-3 text-right">Total ($)</th>
                    <th className="py-2.5 px-3 text-right">Base Imponible (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">IVA 16% (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">IGTF 3% (Bs.)</th>
                    <th className="py-2.5 px-3">Método</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {sales.map((s, idx) => {
                    const isForeign = s.paymentMethod === 'Efectivo USD' || s.paymentMethod === 'Zelle';
                    const baseUSD = s.subtotalUSD / 1.16;
                    const ivaUSD = s.subtotalUSD - baseUSD;
                    const igtfUSD = isForeign ? s.subtotalUSD * 0.03 : 0;
                    return (
                      <tr key={s.id} className="hover:bg-zinc-800/80/40 font-mono">
                        <td className="py-2.5 px-3 text-zinc-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{s.date.split(' ')[0]}</td>
                        <td className="py-2.5 px-3 text-white font-semibold">{s.customerRIF || 'V-00000000'}</td>
                        <td className="py-2.5 px-3 text-white font-sans truncate max-w-[140px]">{s.customerName}</td>
                        <td className="py-2.5 px-3 text-amber-400 font-bold">{s.fiscalInvoiceNumber || `FACT-${idx + 101}`}</td>
                        <td className="py-2.5 px-3 text-blue-400">{s.fiscalZReportNumber || 'Z-0042'}</td>
                        <td className="py-2.5 px-3 text-right text-white font-bold">${(s.subtotalUSD + igtfUSD).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">{(baseUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">{(ivaUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">{igtfUSD > 0 ? (igtfUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px]">{s.paymentMethod}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Libro de Compras Section (Distributors) */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm space-y-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-bold text-white text-base font-display flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-400" />
                  Libro de Compras Fiscal - Proveedores de Licores
                </h3>
                <span className="text-xs text-zinc-400">
                  Créditos fiscales por compras a Polar, Santa Teresa, DUSA, Diageo y distribuidores ({purchases.length} facturas)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-[40px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Factura Compra</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportLibroComprasCSV(purchases, exchangeRate)}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/[0.1] min-h-[40px]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportLibroComprasPDF(purchases, exchangeRate)}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/[0.1] min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>PDF Compras</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#09090b] text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-2.5 px-3">Op</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">RIF Proveedor</th>
                    <th className="py-2.5 px-3">Distribuidor</th>
                    <th className="py-2.5 px-3">Factura #</th>
                    <th className="py-2.5 px-3">Control #</th>
                    <th className="py-2.5 px-3 text-right">Total ($ USD)</th>
                    <th className="py-2.5 px-3 text-right">Base Imponible (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">Crédito IVA 16% (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">Retención 75% (Bs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {purchases.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-zinc-800/80/40 font-mono">
                      <td className="py-2.5 px-3 text-zinc-500">{p.operationNumber || idx + 1}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{p.date}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{p.supplierRIF}</td>
                      <td className="py-2.5 px-3 text-white font-sans truncate max-w-[160px]">{p.supplierName}</td>
                      <td className="py-2.5 px-3 text-amber-400">{p.invoiceNumber}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{p.controlNumber}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">${p.totalAmountUSD.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-zinc-300">{(p.baseAmountUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">{(p.ivaAmountUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right text-blue-400">{(p.retentionAmountUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: LIBRO DIARIO DE CAJA CHICA & GASTOS */}
      {/* ========================================================================= */}
      {subTab === 'petty_cash' && (
        <div className="space-y-6">
          {/* 3 Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400">Total Ingresos Registrados</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                +${movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amountUSD, 0).toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {(movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amountUSD, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400">Total Gastos Operativos</span>
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                -${movements.filter(m => m.type === 'gasto').reduce((a, m) => a + m.amountUSD, 0).toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {(movements.filter(m => m.type === 'gasto').reduce((a, m) => a + m.amountUSD, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400">Balance Neto de Caja Chica</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${(movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amountUSD, 0) - movements.filter(m => m.type === 'gasto').reduce((a, m) => a + m.amountUSD, 0)).toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                Control de efectivo menudo
              </span>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base font-display">
              Libro Diario de Caja Chica y Egresos Menores
            </h3>

            <button
              type="button"
              onClick={() => setShowAddMovementModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Movimiento</span>
            </button>
          </div>

          {/* Movements Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Descripción del Gasto / Ingreso</th>
                    <th className="py-3 px-4 text-right">Monto (USD)</th>
                    <th className="py-3 px-4 text-right">Monto (Bs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-800/80/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-400 text-xs">{m.date}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-semibold text-xs ${
                          m.type === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {m.type === 'ingreso' ? '+' : '-'} {m.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{m.category}</td>
                      <td className="py-3 px-4 text-white font-medium">{m.description}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        ${m.amountUSD.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums text-xs">
                        {(m.amountUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR FACTURA DE COMPRA SENIAT */}
      {showAddPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-base font-display">Registrar Factura de Compra (Proveedor)</h3>
              <button onClick={() => setShowAddPurchaseModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-3.5">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Nombre o Razón Social del Distribuidor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cervecería Polar C.A. / Ron Santa Teresa"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">RIF Proveedor</label>
                  <input
                    type="text"
                    required
                    placeholder="J-00000000-0"
                    value={newSupplierRIF}
                    onChange={(e) => setNewSupplierRIF(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PurchaseInvoice['category'])}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Licores">Licores</option>
                    <option value="Cervezas">Cervezas</option>
                    <option value="Insumos / Hielo">Insumos / Hielo</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Nro. Factura Proveedor</label>
                  <input
                    type="text"
                    required
                    placeholder="0018492"
                    value={newInvoiceNum}
                    onChange={(e) => setNewInvoiceNum(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Nro. Control Fiscal</label>
                  <input
                    type="text"
                    placeholder="00-884920"
                    value={newControlNum}
                    onChange={(e) => setNewControlNum(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Base Imponible ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newBaseUSD}
                  onChange={(e) => setNewBaseUSD(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                />
                {newBaseUSD && (
                  <div className="mt-1 text-[11px] text-zinc-400 space-y-0.5">
                    <span>IVA 16%: ${(parseFloat(newBaseUSD) * 0.16).toFixed(2)}</span>
                    <span className="block font-bold text-amber-400">
                      Total Compra: ${(parseFloat(newBaseUSD) * 1.16).toFixed(2)} USD (≈ {((parseFloat(newBaseUSD) * 1.16) * exchangeRate).toFixed(2)} Bs.)
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Registrar en Libro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO/INGRESO CAJA CHICA */}
      {showAddMovementModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-base font-display">Registrar Movimiento de Caja Menuda</h3>
              <button onClick={() => setShowAddMovementModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('gasto')}
                  className={`p-2 rounded-lg font-bold transition-colors ${
                    movementType === 'gasto'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#09090b] text-zinc-400 border border-white/[0.08]'
                  }`}
                >
                  Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('ingreso')}
                  className={`p-2 rounded-lg font-bold transition-colors ${
                    movementType === 'ingreso'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#09090b] text-zinc-400 border border-white/[0.08]'
                  }`}
                >
                  Registrar Ingreso
                </button>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Categoría</label>
                <select
                  value={movementCategory}
                  onChange={(e) => setMovementCategory(e.target.value as CashMovement['category'])}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                >
                  <option value="Inventario">Inventario (Mercancía / Hielo)</option>
                  <option value="Caja Chica">Caja Chica / Insumos / Papel</option>
                  <option value="Servicios">Servicios (Luz / Internet / Fletes)</option>
                  <option value="Nómina">Nómina / Pago Personal</option>
                  <option value="Venta">Venta Extraordinaria</option>
                  <option value="Otro">Otro Concepto</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Bolsas de hielo gourmet para la cava"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Monto en Dólares ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={movementAmountUSD}
                  onChange={(e) => setMovementAmountUSD(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono text-sm"
                />
                {movementAmountUSD && (
                  <span className="text-[11px] text-amber-400 font-mono mt-1 block">
                    Equivale a {(parseFloat(movementAmountUSD) * exchangeRate).toFixed(2)} Bs.
                  </span>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddMovementModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
