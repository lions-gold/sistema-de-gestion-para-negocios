import React, { useState, useMemo } from 'react';
import { 
  CashMovement, 
  Sale, 
  PurchaseInvoice, 
  CashClosingRecord, 
  FiscalPrinterConfig, 
  PaymentMethod 
} from '../types';
import { useLanguage } from '../i18n/LanguageContext';
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
import {
  getCaracasDateString,
  getCaracasDateTimeStamp,
  VENEZUELA_LOCALE,
  VENEZUELA_TIMEZONE,
} from '../utils/venezuelaTime';

const formatCaracasClock = () =>
  new Date().toLocaleTimeString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

interface CashierModuleProps {
  movements: CashMovement[];
  exchangeRate: number;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
  sales: Sale[];
  purchases?: PurchaseInvoice[];
  closings?: CashClosingRecord[];
  onPurchasesChange?: (purchases: PurchaseInvoice[]) => void;
  onClosingsChange?: (closings: CashClosingRecord[]) => void;
  onClosingCompleted?: (closing: CashClosingRecord) => void;
}

export const CashierModule: React.FC<CashierModuleProps> = ({
  movements,
  exchangeRate,
  onAddMovement,
  sales,
  purchases: controlledPurchases,
  closings: controlledClosings,
  onPurchasesChange,
  onClosingsChange,
  onClosingCompleted,
}) => {
  const { tr } = useLanguage();
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

  // Purchase Invoices (Libro de Compras) — starts empty per store
  const [localPurchases, setLocalPurchases] = useState<PurchaseInvoice[]>([]);
  const purchases = controlledPurchases ?? localPurchases;
  const setPurchases = (next: PurchaseInvoice[]) => {
    if (onPurchasesChange) {
      onPurchasesChange(next);
    } else {
      setLocalPurchases(next);
    }
  };
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);

  // Cash Closings History — starts empty per store
  const [localClosings, setLocalClosings] = useState<CashClosingRecord[]>([]);
  const closings = controlledClosings ?? localClosings;
  const setClosings = (next: CashClosingRecord[]) => {
    if (onClosingsChange) {
      onClosingsChange(next);
    } else {
      setLocalClosings(next);
    }
  };

  // Arqueo Inputs
  const [declaredUSD, setDeclaredUSD] = useState('');
  const [declaredBs, setDeclaredBs] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSuccessToast, setClosingSuccessToast] = useState<string | null>(null);

  // Terminal / Command Log for Fiscal Printer
  const [fiscalLogs, setFiscalLogs] = useState<string[]>(() => [
    `[${formatCaracasClock()}] ${tr('Impresora fiscal detectada', 'Fiscal printer detected', '检测到税控打印机')}: ${fiscalConfig.brand} (${fiscalConfig.model}) · ${fiscalConfig.port}`,
    `[${formatCaracasClock()}] ${tr('Memoria fiscal activa', 'Active fiscal memory', '已激活税控存储')}: ${fiscalConfig.serialNumber} • Z: Z-${String(fiscalConfig.currentZReport).padStart(4, '0')}`,
    `[${formatCaracasClock()}] ${tr('Protocolo homologado SENIAT: OK • IGTF 3% configurado en alícuota G', 'SENIAT approved protocol: OK • 3% IGTF configured on tier G', 'SENIAT 认证协议：正常 • IGTF 3% 已配置')}`,
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
    const stats: Record<
      string,
      { count: number; totalUSD: number; totalBs: number; igtfUSD: number }
    > = {
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
      const isForeignByName = s.paymentMethod === 'Efectivo USD' || s.paymentMethod === 'Zelle';
      const hasExplicitIgtf = typeof s.igtfAmountUSD === 'number' || typeof s.igtfRate === 'number';
      const igtf = hasExplicitIgtf
        ? (s.igtfAmountUSD ?? s.subtotalUSD * (s.igtfRate || 0))
        : isForeignByName
          ? s.subtotalUSD * 0.03
          : 0;
      const totalUSDWithIgtf = s.subtotalUSD + igtf;
      const totalBsWithIgtf = totalUSDWithIgtf * exchangeRate;

      const baseUSD = s.subtotalUSD / 1.16;
      const ivaUSD = s.subtotalUSD - baseUSD;

      totalSalesUSD += totalUSDWithIgtf;
      totalSalesBs += totalBsWithIgtf;
      totalBaseUSD += baseUSD;
      totalIVAUSD += ivaUSD;
      totalIGTFUSD += igtf;

      const methodKey = (s.paymentMethod || 'Otro').trim() || 'Otro';
      if (!stats[methodKey]) {
        stats[methodKey] = { count: 0, totalUSD: 0, totalBs: 0, igtfUSD: 0 };
      }
      stats[methodKey].count += 1;
      stats[methodKey].totalUSD += totalUSDWithIgtf;
      stats[methodKey].totalBs += totalBsWithIgtf;
      stats[methodKey].igtfUSD += igtf;
    });

    const expectedCashUSD = stats['Efectivo USD']?.totalUSD || 0;
    const expectedCashBs = stats['Efectivo Bs']?.totalBs || 0;

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
      date: getCaracasDateString(),
      timestamp: getCaracasDateTimeStamp(),
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
      notes: closingNotes.trim() || tr('Cierre fiscal de jornada comercial Smith Solutions E-Commerce.', 'Commercial shift fiscal closing — Smith Solutions E-Commerce.', 'Smith Solutions E-Commerce 营业班次税控日结。'),
    };

    // Update fiscal config with new Z number
    const updatedConfig: FiscalPrinterConfig = {
      ...fiscalConfig,
      currentZReport: newZNumber,
    };
    setFiscalConfig(updatedConfig);
    saveStoredFiscalConfig(updatedConfig);

    setClosings([newClosing, ...closings]);
    onClosingCompleted?.(newClosing);
    setFiscalLogs((prev) => [
      `[${formatCaracasClock()}] *** ${tr('REPORTE Z GENERADO', 'Z-REPORT GENERATED', 'Z 报表已生成')}: ${zReportStr} ***`,
      `[${formatCaracasClock()}] ${tr('Total ventas', 'Total sales', '销售总额')}: $${paymentMethodStats.totalSalesUSD.toFixed(2)} (${paymentMethodStats.totalSalesBs.toLocaleString('es-VE')} Bs.)`,
      `[${formatCaracasClock()}] ${tr('IGTF 3% Divisas consolidado', 'Consolidated 3% FX IGTF', '外汇 3% IGTF 汇总')}: $${paymentMethodStats.totalIGTFUSD.toFixed(2)}`,
      `[${formatCaracasClock()}] ${tr('Memoria fiscal grabada con éxito. Cierre Nro', 'Fiscal memory saved. Closing #', '税控存储写入成功，结账编号')} ${nextClosingNum}`,
      ...prev,
    ]);

    setClosingSuccessToast(tr(`Cierre de Caja ${nextClosingNum} y Reporte ${zReportStr} emitidos exitosamente.`, `Cash Closing ${nextClosingNum} and Report ${zReportStr} issued.`, `结账单 ${nextClosingNum} 与 Z 报表 ${zReportStr} 已成功签发。`));
    setTimeout(() => setClosingSuccessToast(null), 5000);
  };

  // Fiscal Printer Test Actions
  const handlePrintReportX = () => {
    const { commandText } = generateReportXCommand(fiscalConfig);
    setFiscalLogs((prev) => [
      `[${formatCaracasClock()}] [${tr('COMANDO ENVIADO', 'COMMAND SENT', '已发送指令')}: ${commandText}] ${tr('Emisión de Reporte X (Lectura Parcial sin corte)', 'Issue Report X (Partial reading)', '签发 X 报表（部分读数）')}`,
      `[${formatCaracasClock()}] ${tr('Ventas acumuladas en jornada', 'Shift accumulated sales', '当班累计销售额')}: $${paymentMethodStats.totalSalesUSD.toFixed(2)} • ${tr('IVA', 'VAT', '增值税')}: $${paymentMethodStats.totalIVAUSD.toFixed(2)} • IGTF: $${paymentMethodStats.totalIGTFUSD.toFixed(2)}`,
      `[${formatCaracasClock()}] ${tr('Memoria de trabajo leída correctamente.', 'Working memory read successfully.', '工作内存读取成功。')}`,
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
      `[${formatCaracasClock()}] ${tr('Configuración de impresora fiscal actualizada', 'Fiscal printer settings updated', '税控打印机设置已更新')}: ${fiscalConfig.brand} (${fiscalConfig.model}) · ${fiscalConfig.port} @ ${fiscalConfig.baudRate}bps`,
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
      date: getCaracasDateString(),
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

  const methodLabel = (method: string) => {
    const map: Record<string, string> = {
      'Efectivo USD': tr('Efectivo USD', 'Cash USD', '美元现金'),
      'Efectivo Bs': tr('Efectivo Bs', 'Cash Bs', '玻利瓦尔现金'),
      'Pago Móvil': tr('Pago Móvil', 'Pago Móvil', '移动支付 Pago Móvil'),
      'Punto de Venta': tr('Punto de Venta', 'POS Card', 'POS 刷卡'),
      'Zelle': 'Zelle',
      'Fiado (Crédito)': tr('Fiado (Crédito)', 'Store Credit', '赊账 (信用)'),
      'Otro': tr('Otro', 'Other', '其他'),
    };
    return map[method] || method;
  };

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
                {tr('Caja, Cierre Dual & Fiscalidad SENIAT', 'Cashier, Dual Closing & SENIAT Tax Compliance', '收银、双币日结与 SENIAT 税务合规')}
              </h2>
              <p className="text-xs text-zinc-400">
                {tr('Arqueo dual por método de pago, IGTF 3%, impresoras fiscales y libros de compra/venta', 'Dual cash count by payment method, 3% IGTF, fiscal printers, and sales/purchase ledgers', '按支付方式双币盘点、3% IGTF、税控打印机及进销项账簿')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto text-xs">
            <span className="text-zinc-400 px-2 hidden sm:inline">{tr('Tasa BCV:', 'BCV Rate:', 'BCV 汇率：')}</span>
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
            <span>{tr('Cierre Dual & Arqueo', 'Dual Closing & Count', '双币日结与盘点')}</span>
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
            <span>{tr('Impresoras Fiscales', 'Fiscal Printers', '税控打印机')}</span>
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
            <span>{tr('Libros Compra/Venta', 'Purchase/Sales Books', '进销项税簿')}</span>
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
            <span>{tr('Caja Chica & Gastos', 'Petty Cash & Expenses', '备用金与支出')}</span>
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
              <span className="text-xs text-zinc-400 block mb-1">{tr('Ventas Totales del Día', 'Total Daily Sales', '当日销售总额')}</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${paymentMethodStats.totalSalesUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {paymentMethodStats.totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('Base Imponible (16%)', 'Taxable Base (16%)', '应税基数 (16%)')}</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                ${paymentMethodStats.totalBaseUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {tr('IVA (16%):', 'VAT (16%):', '增值税 (16%)：')} ${paymentMethodStats.totalIVAUSD.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('IGTF 3% Percibido (Divisas)', '3% IGTF Collected (FX)', '已收 3% 外汇 IGTF')}</span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                ${paymentMethodStats.totalIGTFUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                ≈ {paymentMethodStats.totalIGTFBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('Reporte Fiscal Oficial', 'Official Fiscal Report', '官方税控报表')}</span>
              <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                Z-{String(fiscalConfig.currentZReport).padStart(4, '0')}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {paymentMethodStats.totalTransactions} {tr('transacciones registradas', 'recorded transactions', '笔已登记交易')}
              </span>
            </div>
          </div>

          {/* Exact Breakdown by Payment Method Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#09090b]/70 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  {tr('Desglose Exacto por Método de Pago Recibido', 'Exact Breakdown by Payment Method', '按收款方式精确明细')}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {tr('Separación estricta de ingresos en divisas ($ USD) y moneda nacional (Bs.)', 'Strict separation of foreign currency ($ USD) and local currency (Bs.)', '严格区分外汇美元 ($ USD) 与本币玻利瓦尔 (Bs.) 收入')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/90 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">{tr('Método de Pago', 'Payment Method', '支付方式')}</th>
                    <th className="py-3 px-4 text-center">{tr('Transacciones', 'Transactions', '笔数')}</th>
                    <th className="py-3 px-4 text-right">{tr('Monto Recaudado ($ USD)', 'Collected ($ USD)', '实收金额 ($ USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Contravalor en Bolívares (Bs.)', 'Bs. Equivalent', '折合玻利瓦尔 (Bs.)')}</th>
                    <th className="py-3 px-4 text-right">{tr('IGTF 3% Divisas', '3% FX IGTF', '3% 外汇 IGTF')}</th>
                    <th className="py-3 px-4 text-center">{tr('Destino de Caja', 'Destination', '资金去向')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {Object.entries(paymentMethodStats.byMethod).map(([method, data]) => (
                    <tr key={method} className="hover:bg-zinc-800/80/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          method.includes('USD') || method === 'Zelle' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`} />
                        <span>{methodLabel(method)}</span>
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
                          {method.includes('Efectivo') ? tr('Gaveta Física', 'Cash Drawer', '实体钱箱') : tr('Cuenta Bancaria', 'Bank Account', '银行账户')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#09090b] font-bold border-t border-white/[0.08] text-xs">
                  <tr>
                    <td className="py-3 px-4 text-amber-400 uppercase">{tr('Totales Consolidados', 'Consolidated Totals', '汇总合计')}</td>
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
                    <td className="py-3 px-4 text-center text-zinc-400 text-[11px]">{tr('100% Cuadrado', '100% Balanced', '100% 平账')}</td>
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
                  {tr('Arqueo Físico de Gaveta (Conteo Real en Efectivo)', 'Physical Cash Drawer Count', '钱箱现金实盘核对')}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {tr('Ingresa el efectivo contado físicamente en caja para verificar sobrantes o faltantes', 'Enter physical cash counted to verify overages or shortages', '输入实际清点现金以核对长短款')}
                </span>
              </div>
              <span className="text-xs font-mono text-amber-400">
                {tr('Arqueo Dual USD / Bs.', 'Dual Count USD / Bs.', '双币盘点 USD / Bs.')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* USD Cash Count */}
              <div className="bg-[#09090b] p-4 rounded-xl border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> {tr('Efectivo en Dólares ($ USD)', 'USD Cash ($ USD)', '美元现金 ($ USD)')}
                  </span>
                  <span className="text-zinc-400 font-mono">
                    {tr('Esperado:', 'Expected:', '应有：')} ${paymentMethodStats.expectedCashUSD.toFixed(2)}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{tr('Monto Declarado Contado:', 'Declared Counted Amount:', '申报实盘金额：')}</label>
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
                  <span className="text-zinc-400">{tr('Diferencia:', 'Difference:', '差额：')}</span>
                  <span className={`font-bold ${
                    Math.abs(diffUSD) < 0.01 ? 'text-emerald-400' : diffUSD > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {Math.abs(diffUSD) < 0.01 
                      ? tr('✓ $0.00 (Cuadrado Exacto)', '✓ $0.00 (Exact Match)', '✓ $0.00 (完全平账)') 
                      : diffUSD > 0 
                      ? `+$${diffUSD.toFixed(2)} (${tr('Sobrante', 'Overage', '长款')})` 
                      : `-$${Math.abs(diffUSD).toFixed(2)} (${tr('Faltante', 'Shortage', '短款')})`}
                  </span>
                </div>
              </div>

              {/* Bs. Cash Count */}
              <div className="bg-[#09090b] p-4 rounded-xl border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-4 h-4" /> {tr('Efectivo en Bolívares (Bs.)', 'Bolívares Cash (Bs.)', '玻利瓦尔现金 (Bs.)')}
                  </span>
                  <span className="text-zinc-400 font-mono">
                    {tr('Esperado:', 'Expected:', '应有：')} {paymentMethodStats.expectedCashBs.toFixed(2)} Bs.
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{tr('Monto Declarado Contado:', 'Declared Counted Amount:', '申报实盘金额：')}</label>
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
                  <span className="text-zinc-400">{tr('Diferencia:', 'Difference:', '差额：')}</span>
                  <span className={`font-bold ${
                    Math.abs(diffBs) < 0.01 ? 'text-emerald-400' : diffBs > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {Math.abs(diffBs) < 0.01 
                      ? tr('✓ 0.00 Bs. (Cuadrado Exacto)', '✓ 0.00 Bs. (Exact Match)', '✓ 0.00 Bs. (完全平账)') 
                      : diffBs > 0 
                      ? `+${diffBs.toFixed(2)} Bs. (${tr('Sobrante', 'Overage', '长款')})` 
                      : `-${Math.abs(diffBs).toFixed(2)} Bs. (${tr('Faltante', 'Shortage', '短款')})`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">{tr('Observaciones / Notas del Cierre:', 'Closing Notes / Remarks:', '结账备注：')}</label>
              <input
                type="text"
                placeholder={tr('Ej: Cierre de turno nocturno sin incidentes. Arqueo verificado.', 'E.g.: Night shift closing with no issues. Cash verified.', '例如：夜班无异常结账，钱箱已核验。')}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-xs text-white"
              />
            </div>

            {/* Actions for Closing */}
            <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-400 font-mono">
                {tr('Al ejecutar el cierre se emitirá automáticamente el Reporte Z oficial en la memoria fiscal.', 'Closing cash drawer automatically writes the official Z-Report to fiscal memory.', '执行日结将在税控存储中自动签发官方 Z 报表。')}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReportX}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/[0.1] rounded-xl text-xs font-bold flex items-center gap-2 min-h-[44px]"
                  title={tr('Emitir lectura de comprobación sin corte', 'Issue check reading without closing shift', '签发不清零核对读数')}
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>{tr('Emitir Reporte X', 'Issue Report X', '签发 X 报表')}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePerformCashClosing}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{tr('Realizar Cierre de Caja (Reporte Z)', 'Close Cash Drawer (Z-Report)', '执行收银日结 (Z 报表)')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* History of Past Cash Closings */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#09090b]/70 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="font-bold text-white text-sm font-display">
                {tr('Historial de Cierres de Caja Anteriores', 'Past Cash Closings History', '历史日结记录')} ({closings.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/90 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">{tr('Cierre #', 'Closing #', '结账单号')}</th>
                    <th className="py-3 px-4">{tr('Fecha y Hora', 'Date & Time', '日期时间')}</th>
                    <th className="py-3 px-4">{tr('Reporte Fiscal', 'Fiscal Report', '税控报表')}</th>
                    <th className="py-3 px-4 text-right">{tr('Total ($ USD)', 'Total ($ USD)', '合计 ($ USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Total (Bs.)', 'Total (Bs.)', '合计 (Bs.)')}</th>
                    <th className="py-3 px-4 text-center">{tr('Estado Cuadre', 'Balance Status', '平账状态')}</th>
                    <th className="py-3 px-4 text-center">{tr('Comprobante PDF', 'PDF Receipt', 'PDF 凭证')}</th>
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
                          {c.status === 'Cuadrada' ? tr('Cuadrada', 'Balanced', '已平账') : tr('Con Diferencia', 'Discrepancy', '存在差额')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => exportCashClosingPDF(c)}
                          className="px-2.5 py-1.5 bg-[#09090b] hover:bg-zinc-800/80 border border-white/[0.08] text-amber-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
                          title={tr('Descargar comprobante en PDF', 'Download PDF receipt', '下载 PDF 凭证')}
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
                  {tr('Estado de Homologación Fiscal', 'Fiscal Certification Status', '税控认证状态')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tr('CONECTADA', 'CONNECTED', '已连接')}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">{tr('Marca Activa:', 'Active Brand:', '当前品牌：')}</span>
                  <span className="font-bold text-amber-400">{fiscalConfig.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{tr('Modelo Homologado:', 'Approved Model:', '认证型号：')}</span>
                  <span className="text-white">{fiscalConfig.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{tr('Serial Fiscal (SENIAT):', 'Fiscal Serial (SENIAT):', '税控序列号：')}</span>
                  <span className="font-mono text-emerald-400 font-bold">{fiscalConfig.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{tr('Puerto / Enlace:', 'Port / Link:', '端口 / 连接：')}</span>
                  <span className="font-mono text-white">{fiscalConfig.port} ({fiscalConfig.baudRate} bps)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{tr('Último Reporte Z:', 'Last Z-Report:', '最新 Z 报表：')}</span>
                  <span className="font-mono text-blue-400 font-bold">Z-{String(fiscalConfig.currentZReport).padStart(4, '0')}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  {tr('Papel: OK', 'Paper: OK', '纸张：正常')}
                </div>
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  {tr('Memoria: OK', 'Memory: OK', '存储：正常')}
                </div>
                <div className="p-1.5 bg-[#09090b] rounded border border-white/[0.08] text-emerald-400">
                  {tr('Reloj: OK', 'Clock: OK', '时钟：正常')}
                </div>
              </div>
            </div>

            {/* Supported Venezuelan Brands Grid */}
            <div className="lg:col-span-2 min-w-0 bg-[#111114] border border-white/[0.08] p-4 sm:p-5 rounded-xl space-y-4">
              <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                {tr('Marcas de Impresoras Fiscales Homologadas en Venezuela', 'Certified Fiscal Printer Brands', '委内瑞拉认证税控打印机品牌')}
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
                  <span>{tr('Emitir Reporte X', 'Issue Report X', '签发 X 报表')}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReportZ}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{tr('Emitir Reporte Z (Cierre Fiscal)', 'Issue Z-Report (Fiscal Closing)', '签发 Z 报表（税控日结）')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFiscalSpoolerFile(fiscalLogs.join('\n'), 'Trama_Spooler_HKA.txt')}
                  className="px-4 py-2.5 bg-[#09090b] hover:bg-zinc-800/80 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2 min-h-[44px] ml-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>{tr('Descargar Trama Spooler HKA', 'Download HKA Spooler Log', '下载 HKA 缓冲日志')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Form & Live Command Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Config inputs (5 cols) */}
            <form onSubmit={handleSavePrinterSettings} className="lg:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] p-4 sm:p-5 rounded-xl space-y-4 text-xs">
              <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                {tr('Parámetros de Conexión Fiscal', 'Fiscal Connection Parameters', '税控连接参数')}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">{tr('Puerto Serie / Conexión', 'Serial Port / Connection', '串口 / 连接方式')}</label>
                  <select
                    value={fiscalConfig.port}
                    onChange={(e) => setFiscalConfig({ ...fiscalConfig, port: e.target.value })}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="COM1">{tr('COM1 (Puerto Serie Nativo)', 'COM1 (Native Serial Port)', 'COM1（原生串口）')}</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">{tr('COM3 (Adaptador USB-Serial Prolific/FTDI)', 'COM3 (USB-Serial Prolific/FTDI Adapter)', 'COM3（USB 转串口适配器）')}</option>
                    <option value="COM4">COM4</option>
                    <option value="192.168.1.150:8080">{tr('TCP/IP (Red Local Ethernet 192.168.1.150:8080)', 'TCP/IP (Local Ethernet 192.168.1.150:8080)', 'TCP/IP（局域网 192.168.1.150:8080）')}</option>
                    <option value="SpoolerHKA">Spooler HKA Service (C:\SpoolerHKA\in)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">{tr('Baud Rate (bps)', 'Baud Rate (bps)', '波特率 (bps)')}</label>
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
                    <label className="block text-zinc-300 font-medium mb-1">{tr('Serial Fiscal', 'Fiscal Serial', '税控序列号')}</label>
                    <input
                      type="text"
                      value={fiscalConfig.serialNumber}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, serialNumber: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">{tr('Encabezado Razón Social (Fiscal)', 'Legal Business Header', '税控抬头公司名称')}</label>
                  <input
                    type="text"
                    value={fiscalConfig.headerCompany}
                    onChange={(e) => setFiscalConfig({ ...fiscalConfig, headerCompany: e.target.value })}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">{tr('RIF Fiscal', 'Fiscal Tax ID (RIF)', '税号 RIF')}</label>
                    <input
                      type="text"
                      value={fiscalConfig.headerRIF}
                      onChange={(e) => setFiscalConfig({ ...fiscalConfig, headerRIF: e.target.value })}
                      className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">{tr('Consecutivo Factura', 'Invoice Sequence #', '发票连续编号')}</label>
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
                  <span>{tr('Guardar Parámetros Fiscales', 'Save Fiscal Parameters', '保存税控参数')}</span>
                </button>
              </div>
            </form>

            {/* Live Command Console / Tramas (7 cols) */}
            <div className="lg:col-span-7 min-w-0 bg-[#09090b] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between font-mono text-xs space-y-3 overflow-x-auto">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {tr('Consola de Tramas Fiscales (Spooler Driver)', 'Fiscal Frame Console (Spooler Driver)', '税控指令控制台')}
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
                <span>{tr('Homologado conforme a Providencia SENIAT/00071', 'Compliant with SENIAT Ruling 00071', '符合 SENIAT 00071 号税控法规')}</span>
                <span>Smith Bussines Solutions 2026</span>
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
              <span className="text-xs text-zinc-400 block mb-1">{tr('Débito Fiscal IVA (Ventas)', 'VAT Output Tax (Sales)', '销项增值税 (销售)')}</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${paymentMethodStats.totalIVAUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalDebitoFiscalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('Crédito Fiscal IVA (Compras)', 'VAT Input Credit (Purchases)', '进项增值税 (采购)')}</span>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                ${purchases.reduce((acc, p) => acc + p.ivaAmountUSD, 0).toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalCreditoFiscalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('IGTF 3% Percibido a Enterar', '3% IGTF Payable', '应缴 3% IGTF')}</span>
              <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                ${paymentMethodStats.totalIGTFUSD.toFixed(2)}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {totalIGTFBols.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('Retenciones IVA Aplicadas', 'VAT Withholdings Applied', '已适用增值税预扣')}</span>
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
                  {tr('Libro de Ventas Fiscal (SENIAT)', 'Fiscal Sales Book (SENIAT)', 'SENIAT 税控销售账簿')}
                </h3>
                <span className="text-xs text-zinc-400">
                  {tr('Desglose oficial de facturas con IGTF 3% en divisas', 'Official invoice breakdown with 3% FX IGTF', '含 3% 外汇 IGTF 的官方发票明细')} ({sales.length} {tr('comprobantes emitidos', 'receipts issued', '张已开票据')})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportLibroVentasCSV(sales, exchangeRate)}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/[0.1] min-h-[40px]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>{tr('Exportar Excel/CSV', 'Export Excel/CSV', '导出 Excel/CSV')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportLibroVentasPDF(sales, exchangeRate)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>{tr('Descargar Libro en PDF', 'Download PDF Book', '下载 PDF 账簿')}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#09090b] text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-2.5 px-3">{tr('Op', 'No.', '序号')}</th>
                    <th className="py-2.5 px-3">{tr('Fecha', 'Date', '日期')}</th>
                    <th className="py-2.5 px-3">{tr('RIF/CI', 'Tax ID', '税号/证件')}</th>
                    <th className="py-2.5 px-3">{tr('Cliente', 'Customer', '客户')}</th>
                    <th className="py-2.5 px-3">{tr('Factura', 'Invoice', '发票号')}</th>
                    <th className="py-2.5 px-3">{tr('Reporte Z', 'Z-Report', 'Z 报表')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Total ($)', 'Total ($)', '合计 ($)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Base Imponible (Bs.)', 'Tax Base (Bs.)', '应税基数 (Bs.)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('IVA 16% (Bs.)', 'VAT 16% (Bs.)', '增值税 16% (Bs.)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('IGTF 3% (Bs.)', 'IGTF 3% (Bs.)', 'IGTF 3% (Bs.)')}</th>
                    <th className="py-2.5 px-3">{tr('Método', 'Method', '方式')}</th>
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
                        <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px]">{methodLabel(s.paymentMethod)}</td>
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
                  {tr('Libro de Compras Fiscal - Proveedores', 'Fiscal Purchase Book - Suppliers', '税控采购账簿 - 供应商进项')}
                </h3>
                <span className="text-xs text-zinc-400">
                  {tr('Créditos fiscales por compras a proveedores y distribuidores autorizados', 'VAT input tax credits from suppliers and distributors', '来自供应商与授权分销商的进项税抵扣')} ({purchases.length} {tr('facturas', 'invoices', '张发票')})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm min-h-[40px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{tr('Registrar Factura Compra', 'Log Purchase Invoice', '登记采购发票')}</span>
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
                  <span>{tr('PDF Compras', 'Purchases PDF', '采购 PDF')}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#09090b] text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-2.5 px-3">{tr('Op', 'No.', '序号')}</th>
                    <th className="py-2.5 px-3">{tr('Fecha', 'Date', '日期')}</th>
                    <th className="py-2.5 px-3">{tr('RIF Proveedor', 'Supplier RIF', '供应商税号')}</th>
                    <th className="py-2.5 px-3">{tr('Distribuidor', 'Distributor', '分销商')}</th>
                    <th className="py-2.5 px-3">{tr('Factura #', 'Invoice #', '发票号')}</th>
                    <th className="py-2.5 px-3">{tr('Control #', 'Control #', '控税号')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Total ($ USD)', 'Total ($ USD)', '合计 ($ USD)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Base Imponible (Bs.)', 'Tax Base (Bs.)', '应税基数 (Bs.)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Crédito IVA 16% (Bs.)', 'VAT Credit 16% (Bs.)', '进项税 16% (Bs.)')}</th>
                    <th className="py-2.5 px-3 text-right">{tr('Retención 75% (Bs.)', 'Withholding 75% (Bs.)', '预扣税 75% (Bs.)')}</th>
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
                <span className="text-xs text-zinc-400">{tr('Total Ingresos Registrados', 'Total Recorded Income', '累计登记收入')}</span>
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
                <span className="text-xs text-zinc-400">{tr('Total Gastos Operativos', 'Total Operating Expenses', '累计运营支出')}</span>
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
                <span className="text-xs text-zinc-400">{tr('Balance Neto de Caja Chica', 'Petty Cash Net Balance', '备用金净余额')}</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${(movements.filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amountUSD, 0) - movements.filter(m => m.type === 'gasto').reduce((a, m) => a + m.amountUSD, 0)).toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                {tr('Control de efectivo menudo', 'Petty cash control', '零用现金管控')}
              </span>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base font-display">
              {tr('Libro Diario de Caja Chica y Egresos Menores', 'Daily Petty Cash & Minor Expenses Ledger', '备用金及小额支出日记账')}
            </h3>

            <button
              type="button"
              onClick={() => setShowAddMovementModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{tr('Registrar Movimiento', 'Record Entry', '登记流水')}</span>
            </button>
          </div>

          {/* Movements Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">{tr('Fecha y Hora', 'Date & Time', '日期时间')}</th>
                    <th className="py-3 px-4">{tr('Tipo', 'Type', '类型')}</th>
                    <th className="py-3 px-4">{tr('Categoría', 'Category', '类别')}</th>
                    <th className="py-3 px-4">{tr('Descripción del Gasto / Ingreso', 'Description', '收支说明')}</th>
                    <th className="py-3 px-4 text-right">{tr('Monto (USD)', 'Amount (USD)', '金额 (USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Monto (Bs.)', 'Amount (Bs.)', '金额 (Bs.)')}</th>
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
                          {m.type === 'ingreso' ? `+ ${tr('INGRESO', 'INCOME', '收入')}` : `- ${tr('GASTO', 'EXPENSE', '支出')}`}
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
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-base font-display">{tr('Registrar Factura de Compra (Proveedor)', 'Log Supplier Purchase Invoice', '登记供应商采购发票')}</h3>
              <button onClick={() => setShowAddPurchaseModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-3.5">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">{tr('Nombre o Razón Social del Distribuidor', 'Supplier / Distributor Legal Name', '供应商或分销商名称')}</label>
                <input
                  type="text"
                  required
                  placeholder={tr('Ej: Distribuidora Central C.A.', 'E.g.: Central Distributors Corp.', '例如：中央分销有限公司')}
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">{tr('RIF Proveedor', 'Supplier Tax ID', '供应商税号')}</label>
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
                  <label className="block text-zinc-300 font-medium mb-1">{tr('Categoría', 'Category', '类别')}</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PurchaseInvoice['category'])}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Licores">{tr('Licores', 'Spirits & Liquors', '烈酒与洋酒')}</option>
                    <option value="Cervezas">{tr('Cervezas', 'Beers', '啤酒')}</option>
                    <option value="Insumos / Hielo">{tr('Insumos / Hielo', 'Supplies / Ice', '物料 / 冰块')}</option>
                    <option value="Servicios">{tr('Servicios', 'Services', '服务')}</option>
                    <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">{tr('Nro. Factura Proveedor', 'Supplier Invoice #', '供应商发票号')}</label>
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
                  <label className="block text-zinc-300 font-medium mb-1">{tr('Nro. Control Fiscal', 'Fiscal Control #', '税控编号')}</label>
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
                <label className="block text-zinc-300 font-medium mb-1">{tr('Base Imponible ($ USD)', 'Taxable Base ($ USD)', '应税基数 ($ USD)')}</label>
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
                    <span>{tr('IVA 16%:', 'VAT 16%:', '增值税 16%：')} ${(parseFloat(newBaseUSD) * 0.16).toFixed(2)}</span>
                    <span className="block font-bold text-amber-400">
                      {tr('Total Compra:', 'Purchase Total:', '采购总额：')} ${(parseFloat(newBaseUSD) * 1.16).toFixed(2)} USD (≈ {((parseFloat(newBaseUSD) * 1.16) * exchangeRate).toFixed(2)} Bs.)
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
                  {tr('Cancelar', 'Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {tr('Registrar en Libro', 'Record in Ledger', '记入账簿')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO/INGRESO CAJA CHICA */}
      {showAddMovementModal && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-base font-display">{tr('Registrar Movimiento de Caja Menuda', 'Record Petty Cash Entry', '登记备用金流水')}</h3>
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
                  {tr('Registrar Gasto', 'Log Expense', '登记支出')}
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
                  {tr('Registrar Ingreso', 'Log Income', '登记收入')}
                </button>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">{tr('Categoría', 'Category', '类别')}</label>
                <select
                  value={movementCategory}
                  onChange={(e) => setMovementCategory(e.target.value as CashMovement['category'])}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                >
                  <option value="Inventario">{tr('Inventario (Mercancía / Insumos)', 'Inventory (Merchandise / Supplies)', '库存（商品 / 物料）')}</option>
                  <option value="Caja Chica">{tr('Caja Chica / Insumos / Papel', 'Petty Cash / Supplies / Paper', '备用金 / 耗材 / 纸张')}</option>
                  <option value="Servicios">{tr('Servicios (Luz / Internet / Fletes)', 'Utilities & Services (Power / Internet / Freight)', '服务费用（水电 / 网络 / 运费）')}</option>
                  <option value="Nómina">{tr('Nómina / Pago Personal', 'Payroll / Staff', '薪资 / 员工付款')}</option>
                  <option value="Venta">{tr('Venta Extraordinaria', 'Extraordinary Sale', '额外销售收入')}</option>
                  <option value="Otro">{tr('Otro Concepto', 'Other Concept', '其他项目')}</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">{tr('Descripción', 'Description', '说明')}</label>
                <input
                  type="text"
                  required
                  placeholder={tr('Ej: Compra de insumos operativos del turno', 'E.g.: Purchase of shift operating supplies', '例如：购买当班运营物资')}
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">{tr('Monto en Dólares ($ USD)', 'Amount in USD ($)', '美元金额 ($ USD)')}</label>
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
                    {tr('Equivale a', 'Equals', '折合')} {(parseFloat(movementAmountUSD) * exchangeRate).toFixed(2)} Bs.
                  </span>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddMovementModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                >
                  {tr('Cancelar', 'Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  {tr('Guardar Movimiento', 'Save Entry', '保存流水')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
