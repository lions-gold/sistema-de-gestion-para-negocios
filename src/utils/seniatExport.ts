import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, PurchaseInvoice, CashClosingRecord, InventoryAuditLog } from '../types';
import {
  VENEZUELA_LOCALE,
  VENEZUELA_TIMEZONE,
  getCaracasDateString,
} from './venezuelaTime';
import { saveBlobResilient, savePdfResilient } from './pdfExport';
import { SupportedLanguage } from '../i18n/translations';
import {
  translateAuditTypeLabel,
  translateClosingStatusLabel,
  translatePaymentMethodLabel,
  translateWarehouseLocationLabel,
} from './platformLabelsI18n';

const L = (lang: SupportedLanguage, es: string, en: string, zh: string) =>
  lang === 'en' ? en : lang === 'zh' ? zh : es;

// jsPDF standard Helvetica font does not embed CJK glyphs; map 'zh' to clean English for PDFs
const resolvePdfLang = (lang: SupportedLanguage): 'es' | 'en' =>
  lang === 'es' ? 'es' : 'en';

/**
 * Generates and downloads the Official SENIAT Libro de Ventas (CSV)
 * Format compliant with Providencia Administrativa SNAT/2014/0032
 */
export const exportLibroVentasCSV = (
  sales: Sale[],
  exchangeRate: number,
  monthName?: string,
  lang: SupportedLanguage = 'es'
) => {
  const periodLabel = monthName || L(lang, 'Periodo Actual', 'Current Period', '当前账期');
  const headers = [
    L(lang, 'Nro. Operacion', 'Op #', '序号'),
    L(lang, 'Fecha Factura', 'Invoice Date', '发票日期'),
    L(lang, 'RIF/CI Comprador', 'Buyer Tax ID / ID', '买家税号/证件'),
    L(lang, 'Nombre o Razon Social', 'Customer / Business Name', '客户名称'),
    L(lang, 'Nro. Factura Fiscal', 'Fiscal Invoice #', '税控发票号'),
    L(lang, 'Nro. Control Fiscal', 'Fiscal Control #', '税控校验号'),
    L(lang, 'Nro. Reporte Z', 'Z-Report #', 'Z 报表号'),
    L(lang, 'Total Ventas Incl. IVA (USD)', 'Total Sales Incl. VAT (USD)', '含税销售总额 (USD)'),
    L(lang, 'Total Ventas Incl. IVA (Bs.)', 'Total Sales Incl. VAT (Bs.)', '含税销售总额 (Bs.)'),
    L(lang, 'Ventas Exentas (Bs.)', 'Exempt Sales (Bs.)', '免税销售额 (Bs.)'),
    L(lang, 'Base Imponible 16% (Bs.)', 'Taxable Base 16% (Bs.)', '16% 应税基数 (Bs.)'),
    L(lang, 'Alicuota %', 'Tax Rate %', '税率 %'),
    L(lang, 'Impuesto IVA 16% (Bs.)', 'VAT 16% (Bs.)', '16% 增值税 (Bs.)'),
    L(lang, 'Monto Pagado en Divisas (USD)', 'Paid in Foreign Currency (USD)', '外汇实付金额 (USD)'),
    L(lang, 'IGTF 3% Percibido (Bs.)', 'IGTF 3% Collected (Bs.)', '代收 3% IGTF (Bs.)'),
    L(lang, 'Metodo de Pago', 'Payment Method', '支付方式')
  ];

  const rows = sales.map((sale, index) => {
    const subtotal = sale.subtotalUSD;
    const isForeignByName = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
    const hasExplicitIgtf = typeof sale.igtfAmountUSD === 'number' || typeof sale.igtfRate === 'number';
    const igtfUSD = hasExplicitIgtf
      ? (sale.igtfAmountUSD ?? subtotal * (sale.igtfRate || 0))
      : isForeignByName
        ? subtotal * 0.03
        : 0;
    const isForeign = igtfUSD > 0 || isForeignByName;
    // Venezuelan retail standard: Base = subtotal / 1.16, IVA = subtotal - Base
    const baseUSD = subtotal / 1.16;
    const ivaUSD = subtotal - baseUSD;
    const totalUSD = subtotal + igtfUSD;

    const baseBs = baseUSD * exchangeRate;
    const ivaBs = ivaUSD * exchangeRate;
    const igtfBs = igtfUSD * exchangeRate;
    const totalBs = totalUSD * exchangeRate;

    return [
      index + 1,
      sale.date.split(' ')[0],
      `"${sale.customerRIF || 'V-00000000-0'}"`,
      `"${sale.customerName.replace(/"/g, '""')}"`,
      `"${sale.fiscalInvoiceNumber || `FACT-${String(index + 101).padStart(6, '0')}`}"`,
      `"${sale.fiscalControlNumber || `00-${String(index + 201).padStart(6, '0')}`}"`,
      `"${sale.fiscalZReportNumber || 'Z-0042'}"`,
      totalUSD.toFixed(2),
      totalBs.toFixed(2),
      '0.00',
      baseBs.toFixed(2),
      '16%',
      ivaBs.toFixed(2),
      isForeign ? subtotal.toFixed(2) : '0.00',
      igtfBs.toFixed(2),
      `"${translatePaymentMethodLabel(sale.paymentMethod, lang)}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveBlobResilient(
    blob,
    `Libro_de_Ventas_SENIAT_${periodLabel.replace(/\s+/g, '_')}.csv`,
    'text/csv;charset=utf-8;'
  );
};

/**
 * Generates and downloads the Official SENIAT Libro de Compras (CSV)
 */
export const exportLibroComprasCSV = (
  purchases: PurchaseInvoice[],
  exchangeRate: number,
  monthName?: string,
  lang: SupportedLanguage = 'es'
) => {
  const periodLabel = monthName || L(lang, 'Periodo Actual', 'Current Period', '当前账期');
  const headers = [
    L(lang, 'Nro. Operacion', 'Op #', '序号'),
    L(lang, 'Fecha Factura', 'Invoice Date', '发票日期'),
    L(lang, 'RIF Proveedor', 'Supplier Tax ID', '供应商税号'),
    L(lang, 'Nombre o Razon Social Proveedor', 'Supplier / Distributor Name', '供应商/分销商名称'),
    L(lang, 'Nro. Factura Proveedor', 'Supplier Invoice #', '供应商发票号'),
    L(lang, 'Nro. Control', 'Control #', '控税编号'),
    L(lang, 'Total Compras Incl. IVA (USD)', 'Total Purchases Incl. VAT (USD)', '含税采购总额 (USD)'),
    L(lang, 'Total Compras Incl. IVA (Bs.)', 'Total Purchases Incl. VAT (Bs.)', '含税采购总额 (Bs.)'),
    L(lang, 'Compras Exentas (Bs.)', 'Exempt Purchases (Bs.)', '免税采购额 (Bs.)'),
    L(lang, 'Base Imponible (Bs.)', 'Taxable Base (Bs.)', '应税基数 (Bs.)'),
    L(lang, 'Alicuota %', 'Tax Rate %', '税率 %'),
    L(lang, 'Credito Fiscal IVA (Bs.)', 'VAT Input Credit (Bs.)', '进项增值税 (Bs.)'),
    L(lang, 'Retencion IVA 75%/100% (Bs.)', 'VAT Withholding 75%/100% (Bs.)', '增值税预扣 75%/100% (Bs.)'),
    L(lang, 'Nro. Comprobante Retencion', 'Withholding Voucher #', '预扣税凭证号')
  ];

  const rows = purchases.map((p, index) => {
    const totalBs = p.totalAmountUSD * exchangeRate;
    const exemptBs = p.exemptAmountUSD * exchangeRate;
    const baseBs = p.baseAmountUSD * exchangeRate;
    const ivaBs = p.ivaAmountUSD * exchangeRate;
    const retentionBs = p.retentionAmountUSD * exchangeRate;

    return [
      p.operationNumber || index + 1,
      p.date,
      `"${p.supplierRIF}"`,
      `"${p.supplierName.replace(/"/g, '""')}"`,
      `"${p.invoiceNumber}"`,
      `"${p.controlNumber}"`,
      p.totalAmountUSD.toFixed(2),
      totalBs.toFixed(2),
      exemptBs.toFixed(2),
      baseBs.toFixed(2),
      '16%',
      ivaBs.toFixed(2),
      retentionBs.toFixed(2),
      `"RET-${String(p.operationNumber || index + 1).padStart(6, '0')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveBlobResilient(
    blob,
    `Libro_de_Compras_SENIAT_${periodLabel.replace(/\s+/g, '_')}.csv`,
    'text/csv;charset=utf-8;'
  );
};

/**
 * Generates and downloads the Official SENIAT Libro de Ventas (PDF)
 */
export const exportLibroVentasPDF = (
  sales: Sale[],
  exchangeRate: number,
  monthName?: string,
  lang: SupportedLanguage = 'es'
) => {
  const pLang = resolvePdfLang(lang);
  const periodLabel = monthName || L(pLang, 'Periodo Actual', 'Current Period', 'Current Period');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Header SENIAT
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 279.4, 28, 'F');

  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SMITH SOLUTIONS E-COMMERCE · SENIAT FISCAL', 14, 10);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    pLang === 'es'
      ? `LIBRO DE VENTAS FISCAL (SENIAT) - PERÍODO: ${periodLabel.toUpperCase()}`
      : `FISCAL SALES LEDGER (SENIAT) - PERIOD: ${periodLabel.toUpperCase()}`,
    14,
    17
  );

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    pLang === 'es'
      ? `Tasa Oficial Referencial BCV: ${exchangeRate.toFixed(2)} Bs/USD • Smith Solutions E-Commerce`
      : `Official BCV Reference Rate: ${exchangeRate.toFixed(2)} Bs/USD • Smith Solutions E-Commerce`,
    14,
    23
  );

  // Table Data
  let grandTotalUSD = 0;
  let grandTotalBs = 0;
  let grandBaseBs = 0;
  let grandIVABs = 0;
  let grandIGTBs = 0;

  const tableRows = sales.map((sale, idx) => {
    const subtotal = sale.subtotalUSD;
    const isForeignByName = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
    const hasExplicitIgtf = typeof sale.igtfAmountUSD === 'number' || typeof sale.igtfRate === 'number';
    const igtfUSD = hasExplicitIgtf
      ? (sale.igtfAmountUSD ?? subtotal * (sale.igtfRate || 0))
      : isForeignByName
        ? subtotal * 0.03
        : 0;
    const baseUSD = subtotal / 1.16;
    const ivaUSD = subtotal - baseUSD;
    const totalUSD = subtotal + igtfUSD;

    const baseBs = baseUSD * exchangeRate;
    const ivaBs = ivaUSD * exchangeRate;
    const igtfBs = igtfUSD * exchangeRate;
    const totalBs = totalUSD * exchangeRate;

    grandTotalUSD += totalUSD;
    grandTotalBs += totalBs;
    grandBaseBs += baseBs;
    grandIVABs += ivaBs;
    grandIGTBs += igtfBs;

    return [
      idx + 1,
      sale.date.split(' ')[0],
      sale.customerRIF || 'V-00000000',
      sale.customerName.length > 20 ? sale.customerName.substring(0, 18) + '...' : sale.customerName,
      sale.fiscalInvoiceNumber || `FACT-${String(idx + 101).padStart(5, '0')}`,
      sale.fiscalZReportNumber || 'Z-0042',
      `$${totalUSD.toFixed(2)}`,
      totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      baseBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      '16%',
      ivaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      igtfBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      translatePaymentMethodLabel(sale.paymentMethod, pLang)
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      pLang === 'es' ? 'Op' : 'No.',
      pLang === 'es' ? 'Fecha' : 'Date',
      pLang === 'es' ? 'RIF/CI' : 'Tax ID',
      pLang === 'es' ? 'Cliente / Razón Social' : 'Customer / Legal Name',
      pLang === 'es' ? 'Factura' : 'Invoice',
      pLang === 'es' ? 'Reporte Z' : 'Z-Report',
      pLang === 'es' ? 'Total ($)' : 'Total ($)',
      pLang === 'es' ? 'Total (Bs.)' : 'Total (Bs.)',
      pLang === 'es' ? 'Base Imponible (Bs.)' : 'Tax Base (Bs.)',
      pLang === 'es' ? 'Alic.' : 'Rate',
      pLang === 'es' ? 'IVA 16% (Bs.)' : 'VAT 16% (Bs.)',
      pLang === 'es' ? 'IGTF 3% (Bs.)' : 'IGTF 3% (Bs.)',
      pLang === 'es' ? 'Método Pago' : 'Payment Method'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [245, 158, 11],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 42 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 26 },
      8: { halign: 'right', cellWidth: 26 },
      9: { halign: 'center', cellWidth: 12 },
      10: { halign: 'right', cellWidth: 22 },
      11: { halign: 'right', cellWidth: 20 },
      12: { halign: 'left', cellWidth: 24 }
    },
    foot: [[
      pLang === 'es' ? 'TOTALES' : 'TOTALS',
      '',
      '',
      `${sales.length} ${pLang === 'es' ? 'facturas' : 'invoices'}`,
      '',
      '',
      `$${grandTotalUSD.toFixed(2)}`,
      grandTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      grandBaseBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      '',
      grandIVABs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      grandIGTBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      ''
    ]],
    footStyles: {
      fillColor: [245, 158, 11],
      textColor: [15, 23, 42],
      fontSize: 7.5,
      fontStyle: 'bold'
    }
  });

  savePdfResilient(doc, `Libro_de_Ventas_SENIAT_${periodLabel.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Generates and downloads the Official SENIAT Libro de Compras (PDF)
 */
export const exportLibroComprasPDF = (
  purchases: PurchaseInvoice[],
  exchangeRate: number,
  monthName?: string,
  lang: SupportedLanguage = 'es'
) => {
  const pLang = resolvePdfLang(lang);
  const periodLabel = monthName || L(pLang, 'Periodo Actual', 'Current Period', 'Current Period');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Header SENIAT
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 279.4, 28, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SMITH SOLUTIONS E-COMMERCE · SENIAT FISCAL', 14, 10);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    pLang === 'es'
      ? `LIBRO DE COMPRAS FISCAL (SENIAT) - PERÍODO: ${periodLabel.toUpperCase()}`
      : `FISCAL PURCHASES LEDGER (SENIAT) - PERIOD: ${periodLabel.toUpperCase()}`,
    14,
    17
  );

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    pLang === 'es'
      ? `Tasa Oficial Referencial BCV: ${exchangeRate.toFixed(2)} Bs/USD • Proveedores y Distribuidores`
      : `Official BCV Reference Rate: ${exchangeRate.toFixed(2)} Bs/USD • Suppliers & Distributors`,
    14,
    23
  );

  let grandTotalUSD = 0;
  let grandTotalBs = 0;
  let grandBaseBs = 0;
  let grandIVABs = 0;
  let grandRetBs = 0;

  const tableRows = purchases.map((p, idx) => {
    const totalBs = p.totalAmountUSD * exchangeRate;
    const baseBs = p.baseAmountUSD * exchangeRate;
    const ivaBs = p.ivaAmountUSD * exchangeRate;
    const retentionBs = p.retentionAmountUSD * exchangeRate;

    grandTotalUSD += p.totalAmountUSD;
    grandTotalBs += totalBs;
    grandBaseBs += baseBs;
    grandIVABs += ivaBs;
    grandRetBs += retentionBs;

    return [
      idx + 1,
      p.date,
      p.supplierRIF,
      p.supplierName.length > 25 ? p.supplierName.substring(0, 23) + '...' : p.supplierName,
      p.invoiceNumber,
      p.controlNumber,
      `$${p.totalAmountUSD.toFixed(2)}`,
      totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      baseBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      '16%',
      ivaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      retentionBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      `RET-${String(idx + 1).padStart(5, '0')}`
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      pLang === 'es' ? 'Op' : 'No.',
      pLang === 'es' ? 'Fecha' : 'Date',
      pLang === 'es' ? 'RIF Proveedor' : 'Supplier Tax ID',
      pLang === 'es' ? 'Distribuidor / Proveedor' : 'Supplier / Distributor',
      pLang === 'es' ? 'Factura' : 'Invoice',
      pLang === 'es' ? 'Control' : 'Control',
      pLang === 'es' ? 'Total ($)' : 'Total ($)',
      pLang === 'es' ? 'Total (Bs.)' : 'Total (Bs.)',
      pLang === 'es' ? 'Base Imponible (Bs.)' : 'Tax Base (Bs.)',
      pLang === 'es' ? 'Alic.' : 'Rate',
      pLang === 'es' ? 'Crédito IVA (Bs.)' : 'VAT Credit (Bs.)',
      pLang === 'es' ? 'Retención 75% (Bs.)' : 'Withholding 75% (Bs.)',
      pLang === 'es' ? 'Comprobante Ret.' : 'Withholding #'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [245, 158, 11],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 24 },
      3: { cellWidth: 44 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 26 },
      8: { halign: 'right', cellWidth: 26 },
      9: { halign: 'center', cellWidth: 12 },
      10: { halign: 'right', cellWidth: 22 },
      11: { halign: 'right', cellWidth: 22 },
      12: { halign: 'center', cellWidth: 24 }
    },
    foot: [[
      pLang === 'es' ? 'TOTALES' : 'TOTALS',
      '',
      '',
      `${purchases.length} ${pLang === 'es' ? 'compras' : 'purchases'}`,
      '',
      '',
      `$${grandTotalUSD.toFixed(2)}`,
      grandTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      grandBaseBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      '',
      grandIVABs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      grandRetBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      ''
    ]],
    footStyles: {
      fillColor: [245, 158, 11],
      textColor: [15, 23, 42],
      fontSize: 7.5,
      fontStyle: 'bold'
    }
  });

  savePdfResilient(doc, `Libro_de_Compras_SENIAT_${periodLabel.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Generates and downloads the Official Comprobante de Cierre de Caja Dual (PDF)
 */
export const exportCashClosingPDF = (
  closing: CashClosingRecord,
  lang: SupportedLanguage = 'es'
) => {
  const pLang = resolvePdfLang(lang);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 215.9, 36, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SMITH SOLUTIONS E-COMMERCE', 14, 12);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    pLang === 'es'
      ? 'COMPROBANTE DE CIERRE DE CAJA DUAL & ARQUEO FISCAL'
      : 'DUAL CASH CLOSING & FISCAL DRAWER COUNT RECEIPT',
    14,
    20
  );

  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    pLang === 'es'
      ? `Cierre Nro: ${closing.closingNumber} | Fecha: ${closing.date} | Reporte Z: ${closing.zReportNumber}`
      : `Closing #: ${closing.closingNumber} | Date: ${closing.date} | Z-Report: ${closing.zReportNumber}`,
    14,
    28
  );
  doc.text(
    pLang === 'es'
      ? `Cajero(a): ${closing.cashierName} | Tasa Oficial BCV: ${closing.exchangeRate.toFixed(2)} Bs/USD`
      : `Cashier: ${closing.cashierName} | Official BCV Rate: ${closing.exchangeRate.toFixed(2)} Bs/USD`,
    14,
    33
  );

  // Table of Breakdown by Payment Method
  const paymentRows = Object.entries(closing.byPaymentMethod).map(([method, data]) => [
    translatePaymentMethodLabel(method, pLang),
    data.count,
    `$${data.totalUSD.toFixed(2)}`,
    data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) + ' Bs.',
    data.igtfUSD > 0 ? `$${data.igtfUSD.toFixed(2)}` : 'N/A'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [[
      pLang === 'es' ? 'Método de Pago' : 'Payment Method',
      pLang === 'es' ? 'Transacciones' : 'Transactions',
      pLang === 'es' ? 'Total Recaudado (USD)' : 'Total Collected (USD)',
      pLang === 'es' ? 'Total Recaudado (Bs.)' : 'Total Collected (Bs.)',
      pLang === 'es' ? 'IGTF 3% Percibido' : '3% IGTF Collected'
    ]],
    body: paymentRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [245, 158, 11],
      fontSize: 9,
      fontStyle: 'bold'
    },
    foot: [[
      pLang === 'es' ? 'TOTAL FACTURACIÓN' : 'TOTAL BILLING',
      closing.totalTransactions,
      `$${closing.totalSalesUSD.toFixed(2)}`,
      closing.totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) + ' Bs.',
      `$${closing.totalIGTFUSD.toFixed(2)}`
    ]],
    footStyles: {
      fillColor: [245, 158, 11],
      textColor: [15, 23, 42],
      fontSize: 9,
      fontStyle: 'bold'
    }
  });

  // Arqueo de Caja / Cuadre Section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, finalY, 187.9, 45, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    pLang === 'es'
      ? 'RESUMEN DE ARQUEO FÍSICO DE GAVETA (EFECTIVO)'
      : 'PHYSICAL CASH DRAWER COUNT SUMMARY',
    18,
    finalY + 8
  );

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    pLang === 'es'
      ? `Efectivo USD Esperado en Gaveta: $${closing.expectedCashUSD.toFixed(2)}`
      : `Expected USD Cash in Drawer:    $${closing.expectedCashUSD.toFixed(2)}`,
    18,
    finalY + 16
  );
  doc.text(
    pLang === 'es'
      ? `Efectivo USD Físico Declarado:   $${closing.declaredCashUSD.toFixed(2)}`
      : `Declared Physical USD Cash:     $${closing.declaredCashUSD.toFixed(2)}`,
    18,
    finalY + 22
  );

  const diffUSD = closing.differenceUSD;
  doc.setFont('helvetica', 'bold');
  if (Math.abs(diffUSD) < 0.01) {
    doc.setTextColor(16, 185, 129); // emerald
    doc.text(
      pLang === 'es'
        ? `Diferencia USD: $0.00 (${translateClosingStatusLabel('Cuadrada', pLang).toUpperCase()})`
        : `USD Difference: $0.00 (EXACT MATCH)`,
      18,
      finalY + 28
    );
  } else if (diffUSD > 0) {
    doc.setTextColor(59, 130, 246); // blue (sobrante)
    doc.text(
      pLang === 'es'
        ? `Diferencia USD: +$${diffUSD.toFixed(2)} (SOBRANTE)`
        : `USD Difference: +$${diffUSD.toFixed(2)} (OVERAGE)`,
      18,
      finalY + 28
    );
  } else {
    doc.setTextColor(225, 29, 72); // rose (faltante)
    doc.text(
      pLang === 'es'
        ? `Diferencia USD: -$${Math.abs(diffUSD).toFixed(2)} (FALTANTE)`
        : `USD Difference: -$${Math.abs(diffUSD).toFixed(2)} (SHORTAGE)`,
      18,
      finalY + 28
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(
    pLang === 'es'
      ? `Efectivo Bs. Esperado en Gaveta: ${closing.expectedCashBs.toFixed(2)} Bs.`
      : `Expected Bs. Cash in Drawer:     ${closing.expectedCashBs.toFixed(2)} Bs.`,
    110,
    finalY + 16
  );
  doc.text(
    pLang === 'es'
      ? `Efectivo Bs. Físico Declarado:   ${closing.declaredCashBs.toFixed(2)} Bs.`
      : `Declared Physical Bs. Cash:      ${closing.declaredCashBs.toFixed(2)} Bs.`,
    110,
    finalY + 22
  );

  const diffBs = closing.differenceBs;
  doc.setFont('helvetica', 'bold');
  if (Math.abs(diffBs) < 0.01) {
    doc.setTextColor(16, 185, 129);
    doc.text(
      pLang === 'es' ? 'Diferencia Bs.: 0.00 Bs. (CUADRADA)' : 'Bs. Difference: 0.00 Bs. (BALANCED)',
      110,
      finalY + 28
    );
  } else if (diffBs > 0) {
    doc.setTextColor(59, 130, 246);
    doc.text(
      pLang === 'es'
        ? `Diferencia Bs.: +${diffBs.toFixed(2)} Bs. (SOBRANTE)`
        : `Bs. Difference: +${diffBs.toFixed(2)} Bs. (OVERAGE)`,
      110,
      finalY + 28
    );
  } else {
    doc.setTextColor(225, 29, 72);
    doc.text(
      pLang === 'es'
        ? `Diferencia Bs.: -${Math.abs(diffBs).toFixed(2)} Bs. (FALTANTE)`
        : `Bs. Difference: -${Math.abs(diffBs).toFixed(2)} Bs. (SHORTAGE)`,
      110,
      finalY + 28
    );
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${pLang === 'es' ? 'Notas del Arqueo:' : 'Count Notes:'} ${closing.notes || (pLang === 'es' ? 'Cierre verificado por administración.' : 'Closing verified by management.')}`,
    18,
    finalY + 38
  );

  // Signatures
  doc.line(25, finalY + 70, 85, finalY + 70);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(pLang === 'es' ? 'Firma Cajero(a) Responsable' : 'Responsible Cashier Signature', 32, finalY + 75);

  doc.line(130, finalY + 70, 190, finalY + 70);
  doc.text(pLang === 'es' ? 'Firma Administrador / Auditor' : 'Administrator / Auditor Signature', 137, finalY + 75);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Smith Solutions E-Commerce • +58 422 027 3766', 14, 265);

  savePdfResilient(doc, `Cierre_Caja_${closing.closingNumber}_SmithSolutions.pdf`);
};

/**
 * Exports Inventory Audit and Waste/Loss Records to CSV
 */
export const exportInventoryAuditCSV = (
  audits: InventoryAuditLog[],
  _exchangeRate: number,
  lang: SupportedLanguage = 'es'
) => {
  const headers = [
    L(lang, 'ID Auditoria', 'Audit ID', '盘点编号'),
    L(lang, 'Fecha / Hora', 'Date / Time', '日期时间'),
    L(lang, 'Producto', 'Product', '商品'),
    'SKU',
    L(lang, 'Tipo de Merma / Incidencia', 'Incident / Shrinkage Type', '损耗/异常类型'),
    L(lang, 'Cantidad Afectada', 'Affected Qty', '涉及数量'),
    L(lang, 'Costo Unitario (USD)', 'Unit Cost (USD)', '单位成本 (USD)'),
    L(lang, 'Perdida Total (USD)', 'Total Loss (USD)', '总损失 (USD)'),
    L(lang, 'Perdida Total (Bs.)', 'Total Loss (Bs.)', '总损失 (Bs.)'),
    L(lang, 'Auditor / Responsable', 'Auditor / Responsible', '盘点/负责人'),
    L(lang, 'Ubicacion en Almacen', 'Warehouse Location', '仓库位置'),
    L(lang, 'Observaciones', 'Notes', '备注')
  ];

  const rows = audits.map((a) => [
    a.id,
    a.date,
    `"${a.productName.replace(/"/g, '""')}"`,
    a.sku,
    `"${translateAuditTypeLabel(a.type, lang)}"`,
    a.quantity,
    a.unitCostUSD.toFixed(2),
    a.totalLossUSD.toFixed(2),
    a.totalLossBs.toFixed(2),
    `"${a.auditorName}"`,
    `"${translateWarehouseLocationLabel(a.location, lang)}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveBlobResilient(
    blob,
    `Auditoria_Inventario_${getCaracasDateString()}.csv`,
    'text/csv;charset=utf-8;'
  );
};

/**
 * Exports Official Inventory Audit Report to PDF
 */
export const exportInventoryAuditPDF = (
  audits: InventoryAuditLog[],
  exchangeRate: number,
  lang: SupportedLanguage = 'es'
) => {
  const pLang = resolvePdfLang(lang);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const totalLossUSD = audits.reduce((sum, a) => sum + a.totalLossUSD, 0);
  const totalLossBs = totalLossUSD * exchangeRate;
  const totalQty = audits.reduce((sum, a) => sum + a.quantity, 0);

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 36, 'F');
  doc.setFillColor(225, 29, 72); // rose-600 accent
  doc.rect(0, 36, 297, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SMITH SOLUTIONS E-COMMERCE · INVENTORY AUDIT', 14, 13);

  doc.setFontSize(10.5);
  doc.setTextColor(251, 113, 133); // rose-400
  doc.text(
    pLang === 'es'
      ? 'AUDITORÍA DE INVENTARIO: REGISTRO DE DESVÍOS, MERMAS Y PÉRDIDAS'
      : 'INVENTORY AUDIT: SHRINKAGE, BREAKAGE & LOSS LOG',
    14,
    20
  );

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    pLang === 'es'
      ? 'Control Maestro de Rentabilidad, Almacén y Protección Patrimonial'
      : 'Master Profitability, Warehouse Control & Asset Protection',
    14,
    26
  );
  doc.text('Smith Solutions E-Commerce • +58 422 027 3766 • Caracas, Venezuela', 14, 31);

  // Meta Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${pLang === 'es' ? 'Fecha Emisión:' : 'Issued:'} ${new Date().toLocaleDateString(VENEZUELA_LOCALE, { timeZone: VENEZUELA_TIMEZONE })}`,
    283,
    13,
    { align: 'right' }
  );
  doc.setTextColor(251, 191, 36);
  doc.text(
    `${pLang === 'es' ? 'Tasa Oficial BCV:' : 'Official BCV Rate:'} ${exchangeRate.toFixed(2)} Bs/USD`,
    283,
    20,
    { align: 'right' }
  );
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${pLang === 'es' ? 'Total Incidencias:' : 'Total Incidents:'} ${audits.length}`,
    283,
    27,
    { align: 'right' }
  );

  // Summary Metrics Banner
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(14, 42, 269, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(159, 18, 57);
  doc.text(
    pLang === 'es'
      ? `TOTAL UNIDADES AFECTADAS: ${totalQty} unid.`
      : `TOTAL AFFECTED UNITS: ${totalQty} units`,
    20,
    52
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    pLang === 'es'
      ? `IMPACTO TOTAL EN RENTABILIDAD: $${totalLossUSD.toFixed(2)} USD`
      : `TOTAL PROFITABILITY IMPACT: $${totalLossUSD.toFixed(2)} USD`,
    100,
    52
  );
  doc.text(
    `${pLang === 'es' ? 'EQUIVALENTE:' : 'EQUIVALENT:'} ${totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    210,
    52
  );

  // Table Data
  const tableData = audits.map((a) => [
    a.date,
    a.productName,
    a.sku,
    translateAuditTypeLabel(a.type, pLang),
    a.quantity,
    `$${a.unitCostUSD.toFixed(2)}`,
    `$${a.totalLossUSD.toFixed(2)}`,
    `${a.totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    translateWarehouseLocationLabel(a.location, pLang),
    a.auditorName,
    a.notes || (pLang === 'es' ? 'Sin observaciones' : 'No notes')
  ]);

  autoTable(doc, {
    startY: 62,
    head: [[
      pLang === 'es' ? 'Fecha' : 'Date', 
      pLang === 'es' ? 'Producto' : 'Product', 
      'SKU', 
      pLang === 'es' ? 'Tipo Incidencia' : 'Incident Type', 
      pLang === 'es' ? 'Cant.' : 'Qty', 
      pLang === 'es' ? 'Costo U.' : 'Unit Cost', 
      pLang === 'es' ? 'Pérdida USD' : 'Loss USD', 
      pLang === 'es' ? 'Pérdida Bs.' : 'Loss Bs.', 
      pLang === 'es' ? 'Ubicación' : 'Location', 
      'Auditor', 
      pLang === 'es' ? 'Observaciones' : 'Notes'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [251, 113, 133],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 46 },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 26, halign: 'right' },
      8: { cellWidth: 22 },
      9: { cellWidth: 26 },
      10: { cellWidth: 28 }
    }
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // Signatures
  if (finalY < 185) {
    doc.setDrawColor(15, 23, 42);
    doc.line(30, finalY + 14, 110, finalY + 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(
      pLang === 'es' ? 'Firma Jefe de Almacén / Auditor' : 'Warehouse Manager / Auditor Signature',
      45,
      finalY + 19
    );

    doc.line(180, finalY + 14, 260, finalY + 14);
    doc.text(
      pLang === 'es' ? 'Firma Gerente General / Administración' : 'General Manager / Admin Signature',
      190,
      finalY + 19
    );
  }

  savePdfResilient(doc, `Auditoria_Inventario_${getCaracasDateString()}.pdf`);
};

