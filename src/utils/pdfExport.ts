import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, StoreCartItem, StoreOrder, StoreOrderItem, StoreTenant } from '../types';
import { SupportedLanguage } from '../i18n/translations';
import {
  translateOrderStatusLabel,
  translatePaymentMethodLabel,
  translateSaleChannelLabel,
  translateSaleStatusLabel,
  translateShippingTypeLabel,
  translateSizeTokenLabel,
  translateUnitLabel,
} from './platformLabelsI18n';
import {
  VENEZUELA_LOCALE,
  VENEZUELA_TIMEZONE,
  getCaracasDateString,
} from './venezuelaTime';

function resolvePdfLang(lang: SupportedLanguage = 'es'): 'es' | 'en' {
  return lang === 'en' || lang === 'zh' ? 'en' : 'es';
}

function pdfText(pdfLang: 'es' | 'en', es: string, en: string): string {
  return pdfLang === 'en' ? en : es;
}

function isIOSStandalonePWA(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const isIOS =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS && nav.standalone === true;
}

/**
 * Triggers resilient file download across PC, Android, iPhone Safari, and iOS Standalone PWA.
 */
export function saveBlobResilient(blob: Blob, filename: string, mimeType: string): void {
  if (isIOSStandalonePWA() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: mimeType });
      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (!navWithShare.canShare || navWithShare.canShare({ files: [file] })) {
        navigator
          .share({ files: [file], title: filename })
          .catch((err: unknown) => {
            if (err instanceof Error && err.name === 'AbortError') return;
            triggerAnchorDownload(blob, filename);
          });
        return;
      }
    } catch {
      // Fallback to standard download
    }
  }
  triggerAnchorDownload(blob, filename);
}

function triggerAnchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Saves jsPDF documents reliably across Desktop, Android, and iPhone Standalone PWA.
 */
export function savePdfResilient(doc: jsPDF, filename: string): void {
  if (isIOSStandalonePWA() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (!navWithShare.canShare || navWithShare.canShare({ files: [file] })) {
        navigator
          .share({ files: [file], title: filename })
          .catch((err: unknown) => {
            if (err instanceof Error && err.name === 'AbortError') return;
            doc.save(filename);
          });
        return;
      }
    } catch {
      // Fall back to doc.save
    }
  }
  doc.save(filename);
}

/**
 * Exports full batch sales report to PDF
 */
export function exportSalesReportPDF(
  sales: Sale[],
  exchangeRate: number,
  lang: SupportedLanguage = 'es'
): void {
  const pdfLang = resolvePdfLang(lang);
  const tPdf = (es: string, en: string) => pdfText(pdfLang, es, en);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalUSD = sales.reduce((acc, s) => acc + s.subtotalUSD, 0);
  const totalBs = sales.reduce((acc, s) => acc + s.subtotalBs, 0);

  // Brand Header Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Gold accent bar
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(0, 38, 210, 2, 'F');

  // Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SMITH SOLUTIONS E-COMMERCE', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(217, 119, 6);
  doc.text(
    tPdf(
      'E-Commerce, Almacenes & Punto de Venta Multidivisa',
      'E-Commerce, Warehouses & Multi-Currency POS'
    ),
    14,
    21
  );

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(8.5);
  doc.text(
    tPdf(
      'Software por Smith Bussines Solutions 2026 | +58 422 027 3766',
      'Software by Smith Bussines Solutions 2026 | +58 422 027 3766'
    ),
    14,
    27
  );
  doc.text(
    tPdf(
      'Correo: empresaalhadiqainvest@gmail.com | Venezuela',
      'Email: empresaalhadiqainvest@gmail.com | Venezuela'
    ),
    14,
    32
  );

  // Date and Rate in top right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${tPdf('Fecha', 'Date')}: ${dateFormatted} - ${timeFormatted}`, 196, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text(`${tPdf('Tasa BCV Aplicada', 'Applied BCV Rate')}: ${exchangeRate.toFixed(2)} Bs/USD`, 196, 23, { align: 'right' });

  doc.setTextColor(148, 163, 184);
  doc.text(`${tPdf('Total Órdenes', 'Total Orders')}: ${sales.length}`, 196, 30, { align: 'right' });

  // Summary Metrics Cards Area
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 46, 182, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    tPdf(
      'REPORTE GENERAL DE FACTURACIÓN Y VENTAS REGISTRADAS',
      'GENERAL BILLING & RECORDED SALES REPORT'
    ),
    18,
    52
  );

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${tPdf('Total Facturado USD', 'Total Billed USD')}: $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    18,
    61
  );

  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(
    `${tPdf('Total en Bolívares', 'Total in Bs.')}: ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    110,
    61
  );

  // Table Body using autoTable
  const tableData = sales.map((sale) => [
    sale.receiptNumber,
    sale.date,
    sale.customerName,
    sale.items
      .map(
        (i) =>
          `${i.quantity}x ${i.product.name}${
            i.selectedSize
              ? ` [${tPdf('Talla', 'Size')}: ${translateSizeTokenLabel(i.selectedSize, pdfLang)}]`
              : ''
          }`
      )
      .join('\n'),
    translatePaymentMethodLabel(sale.paymentMethod, pdfLang),
    `$${sale.subtotalUSD.toFixed(2)}`,
    `${sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
  ]);

  autoTable(doc, {
    startY: 72,
    head: [
      [
        tPdf('Recibo #', 'Receipt #'),
        tPdf('Fecha', 'Date'),
        tPdf('Cliente', 'Customer'),
        tPdf('Productos Vendidos', 'Items Sold'),
        tPdf('Método', 'Method'),
        'Total USD',
        'Total Bs.',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [251, 191, 36], // amber-400
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 24, fontSize: 7.5 },
      2: { cellWidth: 28, fontSize: 8 },
      3: { cellWidth: 46, fontSize: 7.5 },
      4: { cellWidth: 20, fontSize: 7.5 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
      6: { halign: 'right', fontSize: 7.5, cellWidth: 20 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    foot: [
      [
        tPdf('TOTAL GENERAL', 'GRAND TOTAL'),
        '',
        '',
        `${sales.length} ${tPdf('órdenes', 'orders')}`,
        '',
        `$${totalUSD.toFixed(2)}`,
        `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
  });

  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      tPdf(
        `Página ${i} de ${pageCount} · Documento emitido por Smith Solutions E-Commerce · Por Smith Bussines Solutions 2026`,
        `Page ${i} of ${pageCount} · Issued by Smith Solutions E-Commerce · By Smith Bussines Solutions 2026`
      ),
      105,
      290,
      { align: 'center' }
    );
  }

  const filename = `reporte_ventas_smith_solutions_${getCaracasDateString(now)}.pdf`;
  savePdfResilient(doc, filename);
}

/**
 * Exports a single commercial receipt / invoice to PDF
 */
export function exportSingleReceiptPDF(
  sale: Sale,
  lang: SupportedLanguage = 'es'
): void {
  const pdfLang = resolvePdfLang(lang);
  const tPdf = (es: string, en: string) => pdfText(pdfLang, es, en);
  // A5 format for compact, elegant commercial invoice/receipt
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 148, 32, 'F');

  // Gold accent line
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 32, 148, 1.5, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SMITH SOLUTIONS E-COMMERCE', 12, 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(251, 191, 36);
  doc.text(tPdf('COMPROBANTE DE VENTA OFICIAL', 'OFFICIAL SALES RECEIPT'), 12, 19);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.text(
    tPdf(
      'E-Commerce & Punto de Venta | Smith Bussines Solutions 2026',
      'E-Commerce & POS | Smith Bussines Solutions 2026'
    ),
    12,
    25
  );

  // Receipt Number & Date top right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(sale.receiptNumber, 136, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(sale.date, 136, 19, { align: 'right' });

  doc.setTextColor(251, 191, 36);
  doc.text(`${tPdf('Tasa', 'Rate')}: ${sale.exchangeRate.toFixed(2)} Bs/USD`, 136, 25, { align: 'right' });

  // Customer Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 38, 124, 18, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(tPdf('CLIENTE:', 'CUSTOMER:'), 16, 44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sale.customerName, 34, 44);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tPdf('RIF / CI:', 'TAX ID:'), 80, 44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(sale.customerRIF || 'V-00000000-0', 94, 44);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tPdf('MÉTODO:', 'METHOD:'), 16, 51);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(translatePaymentMethodLabel(sale.paymentMethod, pdfLang), 34, 51);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tPdf('ESTADO:', 'STATUS:'), 80, 51);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(translateSaleStatusLabel(sale.status, pdfLang), 94, 51);

  // Items Table
  const itemsRows = sale.items.map((i) => [
    `${i.product.name}${
      i.selectedSize
        ? ` (${tPdf('Talla', 'Size')}: ${translateSizeTokenLabel(i.selectedSize, pdfLang)})`
        : ''
    }`,
    `${i.quantity} ${translateUnitLabel(i.product.unit || 'und', pdfLang, i.quantity > 1)}`,
    `$${i.product.priceUSD.toFixed(2)}`,
    `$${(i.quantity * i.product.priceUSD).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 60,
    head: [
      [
        tPdf('Descripción del Producto', 'Product Description'),
        tPdf('Cant.', 'Qty'),
        tPdf('Precio', 'Price'),
        'Subtotal',
      ],
    ],
    body: itemsRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [251, 191, 36],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 64, fontSize: 8 },
      1: { cellWidth: 20, halign: 'center', fontSize: 8 },
      2: { cellWidth: 20, halign: 'right', fontSize: 8 },
      3: { cellWidth: 20, halign: 'right', fontStyle: 'bold', fontSize: 8 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Calculate position after table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  const hasIgtf = Boolean(sale.igtfAmountUSD && sale.igtfAmountUSD > 0);
  const totalBoxHeight = hasIgtf ? 30 : 22;

  // Totals Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(68, finalY, 68, totalBoxHeight, 2, 2, 'FD');

  if (hasIgtf) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(tPdf('Base Imponible (16%):', 'Taxable Base (16%):'), 72, finalY + 6);
    doc.text(`$${(sale.baseAmountUSD || (sale.subtotalUSD / 1.16)).toFixed(2)}`, 132, finalY + 6, { align: 'right' });

    doc.text(tPdf('IVA 16%:', 'VAT 16%:'), 72, finalY + 11);
    doc.text(`$${(sale.ivaUSD || (sale.subtotalUSD - sale.subtotalUSD / 1.16)).toFixed(2)}`, 132, finalY + 11, { align: 'right' });

    doc.setTextColor(217, 119, 6);
    doc.text(tPdf('IGTF 3% Divisas:', '3% FX IGTF:'), 72, finalY + 16);
    doc.text(`+$${(sale.igtfAmountUSD || 0).toFixed(2)}`, 132, finalY + 16, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL USD:', 72, finalY + 22);
    doc.setFontSize(10.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`$${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)}`, 132, finalY + 22, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL BS:', 72, finalY + 27);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(sale.totalWithIgtfBs || sale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 132, finalY + 27, { align: 'right' });
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL USD:', 72, finalY + 8);
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    doc.text(`$${sale.subtotalUSD.toFixed(2)}`, 132, finalY + 8, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(tPdf('TOTAL BOLÍVARES:', 'TOTAL BS:'), 72, finalY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 132, finalY + 16, { align: 'right' });
  }

  // Thank you and footer note
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    tPdf(
      '¡Gracias por su preferencia en Smith Solutions E-Commerce!',
      'Thank you for shopping with Smith Solutions E-Commerce!'
    ),
    74,
    finalY + 34,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    tPdf(
      'Desarrollado con excelencia por Smith Bussines Solutions 2026',
      'Built with excellence by Smith Bussines Solutions 2026'
    ),
    74,
    finalY + 39,
    { align: 'center' }
  );
  doc.text(
    tPdf(
      'Contacto: empresaalhadiqainvest@gmail.com | +58 422 027 3766',
      'Contact: empresaalhadiqainvest@gmail.com | +58 422 027 3766'
    ),
    74,
    finalY + 43,
    { align: 'center' }
  );

  savePdfResilient(doc, `recibo_${sale.receiptNumber}.pdf`);
}

/**
 * Triggers thermal ticket / browser printer for a sale receipt using a hidden iframe
 * (prevents iPhone Safari / PWA & browser popup blockers from blocking ticket printing).
 */
export function printReceiptTicket(
  sale: Sale,
  lang: SupportedLanguage = 'es'
): void {
  const trPrint = (es: string, en: string, zh: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : es;
  const sizeLabel = trPrint('Talla', 'Size', '尺码');
  const itemsHtml = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 4px 0; text-align: left;">${item.quantity}x ${item.product.name}${
          item.selectedSize
            ? ` [${sizeLabel}: ${translateSizeTokenLabel(item.selectedSize, lang)}]`
            : ''
        }</td>
        <td style="padding: 4px 0; text-align: right; font-weight: bold;">$${(item.quantity * item.product.priceUSD).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const htmlLang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'es';
  const translatedMethod = translatePaymentMethodLabel(sale.paymentMethod, lang);
  const html = `
    <!DOCTYPE html>
    <html lang="${htmlLang}">
      <head>
        <meta charset="UTF-8" />
        <title>${trPrint('Recibo', 'Receipt', '收据')} ${sale.receiptNumber}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            margin: 0 auto;
            padding: 12px;
            color: #000;
            background: #fff;
            max-width: 320px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .title {
            font-size: 15px;
            font-weight: bold;
          }
          .subtitle {
            font-size: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 13px;
            margin: 4px 0;
          }
          .footer {
            text-align: center;
            font-size: 9px;
            margin-top: 12px;
            padding-top: 6px;
            border-top: 1px dashed #000;
          }
          @media print {
            @page { margin: 4mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SMITH SOLUTIONS E-COMMERCE</div>
          <div class="subtitle">RIF: J-50129384-7 • Caracas, Venezuela</div>
          <div class="subtitle">${trPrint('Recibo', 'Receipt', '收据')}: ${sale.receiptNumber}</div>
          ${sale.fiscalInvoiceNumber ? `<div class="subtitle" style="font-weight: bold; color: #b45309;">${trPrint('FACTURA FISCAL', 'FISCAL INVOICE', '税控发票')}: ${sale.fiscalInvoiceNumber}</div>` : ''}
          <div class="subtitle">${trPrint('Fecha', 'Date', '日期')}: ${sale.date}</div>
          <div class="subtitle">${trPrint('Cliente', 'Customer', '客户')}: ${sale.customerName}</div>
          <div class="subtitle">${trPrint('RIF / C.I.', 'Tax ID', '税号/证件')}: ${sale.customerRIF || 'V-00000000-0'}</div>
          <div class="subtitle">${trPrint('Método', 'Method', '支付方式')}: ${translatedMethod}</div>
        </div>

        <table>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div style="font-size: 10px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between;">
            <span>${trPrint('Base Imponible (16%)', 'Taxable Base (16%)', '应税基数 (16%)')}:</span>
            <span>$${(sale.baseAmountUSD || (sale.subtotalUSD / 1.16)).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>${trPrint('IVA Débito (16%)', 'Fiscal VAT (16%)', '销项增值税 (16%)')}:</span>
            <span>$${(sale.ivaUSD || (sale.subtotalUSD - sale.subtotalUSD / 1.16)).toFixed(2)}</span>
          </div>
          ${sale.igtfAmountUSD && sale.igtfAmountUSD > 0 ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold; color: #b45309;">
            <span>${trPrint('+ IGTF (3% Divisas)', '+ IGTF (3% FX)', '+ 外汇税 IGTF (3%)')}:</span>
            <span>+$${sale.igtfAmountUSD.toFixed(2)} USD</span>
          </div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="total-row">
          <span>${trPrint('TOTAL FINAL USD', 'FINAL TOTAL USD', '美元总计')}:</span>
          <span>$${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)}</span>
        </div>
        <div class="total-row" style="font-size: 11px;">
          <span>${trPrint('TOTAL BOLÍVARES', 'TOTAL BS', '玻利瓦尔总计')}:</span>
          <span>${(sale.totalWithIgtfBs || sale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</span>
        </div>
        <div style="font-size: 10px; text-align: center; color: #555;">
          ${trPrint('Tasa Oficial BCV', 'Official BCV Rate', 'BCV 官方汇率')}: ${sale.exchangeRate.toFixed(2)} Bs/USD
        </div>

        <div class="footer">
          <div>${trPrint('¡Gracias por su compra!', 'Thank you for your purchase!', '感谢您的惠顾！')}</div>
          <div style="margin-top: 4px;">Smith Bussines Solutions 2026</div>
          <div>empresaalhadiqainvest@gmail.com</div>
          <div>+58 422 027 3766</div>
        </div>
      </body>
    </html>
  `;

  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  try {
    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      cleanup();
      window.print();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      } finally {
        cleanup();
      }
    }, 180);
  } catch {
    cleanup();
    window.print();
  }
}

interface NormalizedInvoiceLine {
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPriceUSD: number;
  unitCostUSD: number;
  subtotalUSD: number;
}

function normalizeInvoiceLines(
  items: Array<StoreCartItem | StoreOrderItem>,
  pdfLang: 'es' | 'en' = 'es'
): NormalizedInvoiceLine[] {
  const sizeWord = pdfLang === 'en' ? 'Size' : 'Talla';
  return items.map((entry) => {
    if ('product' in entry) {
      return {
        name: `${entry.product.name}${
          entry.selectedSize
            ? ` [${sizeWord}: ${translateSizeTokenLabel(entry.selectedSize, pdfLang)}]`
            : ''
        }`,
        sku: entry.product.sku || '-',
        unit: translateUnitLabel(entry.product.unit || 'und', pdfLang, entry.quantity > 1),
        quantity: entry.quantity,
        unitPriceUSD: entry.product.priceUSD,
        unitCostUSD: entry.product.costUSD || 0,
        subtotalUSD: Number((entry.quantity * entry.product.priceUSD).toFixed(2)),
      };
    }
    return {
      name: `${entry.productName}${
        entry.selectedSize
          ? ` [${sizeWord}: ${translateSizeTokenLabel(entry.selectedSize, pdfLang)}]`
          : ''
      }`,
      sku: entry.sku || '-',
      unit: translateUnitLabel(entry.unit || 'und', pdfLang, entry.quantity > 1),
      quantity: entry.quantity,
      unitPriceUSD: entry.unitPriceUSD,
      unitCostUSD: entry.unitCostUSD || 0,
      subtotalUSD: entry.subtotalUSD,
    };
  });
}

function renderStoreInvoicePage(
  doc: jsPDF,
  store: StoreTenant,
  order: StoreOrder,
  lines: NormalizedInvoiceLine[],
  role: 'cliente' | 'dueno',
  pdfLang: 'es' | 'en' = 'es'
): void {
  const isOwnerCopy = role === 'dueno';
  const tPdf = (es: string, en: string) => pdfText(pdfLang, es, en);

  // Top Header Band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 44, 'F');
  doc.setFillColor(isOwnerCopy ? 16 : 217, isOwnerCopy ? 185 : 119, isOwnerCopy ? 129 : 6);
  doc.rect(0, 44, 210, 2.5, 'F');

  let textOffsetX = 14;
  if (store.logoUrl && store.logoUrl.startsWith('data:image/')) {
    try {
      const format = store.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 7, 28, 28, 3, 3, 'F');
      doc.addImage(store.logoUrl, format, 15, 8, 26, 26);
      textOffsetX = 48;
    } catch {
      textOffsetX = 14;
    }
  }

  // Store Account Data (Seller)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text(store.storeName.toUpperCase(), textOffsetX, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(251, 191, 36);
  doc.text(
    `${tPdf('Titular / Razón Social', 'Owner / Legal Name')}: ${store.registeredOwnerName}`,
    textOffsetX,
    22
  );

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8.5);
  doc.text(
    `${tPdf('RIF', 'Tax ID')}: ${
      store.rif && store.rif.trim() ? store.rif : tPdf('Sin RIF registrado', 'No Tax ID on file')
    }  ·  WhatsApp: ${store.businessWhatsapp}`,
    textOffsetX,
    28
  );
  doc.setTextColor(isOwnerCopy ? 110 : 148, isOwnerCopy ? 231 : 163, isOwnerCopy ? 183 : 184);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isOwnerCopy
      ? tPdf(
          'COPIA COMERCIO · DUEÑO DE TIENDA (CONTROL INTERNO DE VENTA)',
          'MERCHANT COPY · STORE OWNER (INTERNAL SALES CONTROL)'
        )
      : tPdf(
          'ORIGINAL · FACTURA PARA EL CLIENTE (COMPROBANTE OFICIAL)',
          'ORIGINAL · CUSTOMER INVOICE (OFFICIAL RECEIPT)'
        ),
    textOffsetX,
    36
  );

  // Invoice Metadata Top Right
  const nowStr = new Date().toLocaleDateString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${tPdf('FACTURA', 'INVOICE')} #${order.invoiceNumber}`, 196, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`${tPdf('Fecha', 'Date')}: ${nowStr}`, 196, 22, { align: 'right' });
  doc.setTextColor(251, 191, 36);
  doc.text(`${tPdf('Tasa BCV', 'BCV Rate')}: ${order.exchangeRate.toFixed(2)} Bs/USD`, 196, 28, {
    align: 'right',
  });
  doc.setTextColor(isOwnerCopy ? 110 : 251, isOwnerCopy ? 231 : 191, isOwnerCopy ? 183 : 36);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isOwnerCopy ? tPdf('COPIA DUEÑO', 'OWNER COPY') : tPdf('COPIA CLIENTE', 'CUSTOMER COPY'),
    196,
    36,
    { align: 'right' }
  );

  // Buyer & Shipping Information Cards
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 52, 90, 36, 2, 2, 'FD');
  doc.roundedRect(108, 52, 88, 36, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(tPdf('DATOS DEL COMPRADOR (CLIENTE)', 'BUYER DETAILS (CUSTOMER)'), 18, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`${tPdf('Nombre / Razón', 'Name / Company')}: ${order.customerName}`, 18, 65);
  doc.text(
    `${tPdf('C.I. / RIF', 'ID / Tax ID')}: ${order.customerRif || tPdf('No especificado', 'Not specified')}`,
    18,
    71
  );
  doc.text(`${tPdf('Teléfono / WhatsApp', 'Phone / WhatsApp')}: ${order.customerPhone}`, 18, 77);
  if (order.customerEmail) {
    doc.text(`${tPdf('Correo', 'Email')}: ${order.customerEmail}`, 18, 83);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    isOwnerCopy
      ? tPdf('LOGÍSTICA, PAGO Y REGISTRO DE VENTA', 'LOGISTICS, PAYMENT & SALE LOG')
      : tPdf('MODALIDAD DE ENTREGA Y PAGO', 'DELIVERY & PAYMENT DETAILS'),
    112,
    58
  );

  const translatedShipping = translateShippingTypeLabel(order.shippingType, pdfLang);
  const translatedPay = translatePaymentMethodLabel(order.paymentMethod, pdfLang);
  const translatedChannel = translateSaleChannelLabel(order.saleChannel || 'Carrito Web', pdfLang);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`${tPdf('Entrega', 'Delivery')}: ${translatedShipping}`, 112, 65);
  doc.text(`${tPdf('Pago', 'Payment')}: ${translatedPay} (${translatedChannel})`, 112, 71);
  const shippingText = order.shippingDetails
    ? doc.splitTextToSize(`${tPdf('Destino', 'Destination')}: ${order.shippingDetails}`, 80)
    : [tPdf('Destino: Coordinado con la tienda', 'Destination: Coordinated with store')];
  doc.text(shippingText.slice(0, 2), 112, 77);

  // Items Table
  const rows = lines.map((line) => [
    line.name,
    line.sku,
    `${line.quantity} ${line.unit}`,
    `$${line.unitPriceUSD.toFixed(2)}`,
    `$${line.subtotalUSD.toFixed(2)}`,
    `${(line.subtotalUSD * order.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
  ]);

  autoTable(doc, {
    startY: 94,
    head: [
      [
        tPdf('Producto / Descripción', 'Product / Description'),
        'SKU',
        tPdf('Cant.', 'Qty'),
        tPdf('P. Unit', 'Unit Price'),
        'Subtotal USD',
        'Subtotal Bs.',
      ],
    ],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: isOwnerCopy ? [110, 231, 183] : [251, 191, 36],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 22, fontSize: 7.5 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 26, halign: 'right', fontSize: 7.5 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Owner Copy Left Control Card (Cost, Net Profit, Stock & Dispatch Control)
  if (isOwnerCopy) {
    const computedCost =
      order.estimatedCostUSD ??
      Number(lines.reduce((acc, l) => acc + l.unitCostUSD * l.quantity, 0).toFixed(2));
    const computedProfit =
      order.estimatedProfitUSD ?? Number((order.subtotalUSD - computedCost).toFixed(2));

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, finalY, 96, 36, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(
      tPdf('RESUMEN INTERNO DUEÑO DE TIENDA', 'INTERNAL STORE OWNER SUMMARY'),
      18,
      finalY + 7
    );

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${tPdf('ID Orden Sistema', 'System Order ID')}: ${order.id}`, 18, finalY + 13);
    doc.text(
      `${tPdf('Estado Actual', 'Current Status')}: ${translateOrderStatusLabel(
        order.status,
        pdfLang
      ).toUpperCase()} · Stock: ${
        order.stockDeducted ? tPdf('Descontado', 'Deducted') : tPdf('Por confirmar', 'Pending')
      }`,
      18,
      finalY + 19
    );
    doc.text(
      `${tPdf('Costo Reposición Est.', 'Est. Restock Cost')}: $${computedCost.toFixed(2)} USD`,
      18,
      finalY + 25
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(
      `${tPdf('Ganancia Neta Est. Productos', 'Est. Net Product Profit')}: $${computedProfit.toFixed(2)} USD`,
      18,
      finalY + 31
    );
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, 96, 36, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(tPdf('GARANTÍA Y ATENCIÓN AL CLIENTE', 'WARRANTY & CUSTOMER SUPPORT'), 18, finalY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${tPdf('Comercio Emisor', 'Issuing Store')}: ${store.storeName}`, 18, finalY + 14);
    doc.text(`${tPdf('Titular', 'Owner')}: ${store.registeredOwnerName}`, 18, finalY + 20);
    doc.text(
      `${tPdf('WhatsApp Soporte Tienda', 'Store Support WhatsApp')}: ${store.businessWhatsapp}`,
      18,
      finalY + 26
    );
    doc.text(
      tPdf(
        'Conserve esta factura original como respaldo de compra.',
        'Keep this original invoice as your purchase receipt.'
      ),
      18,
      finalY + 32
    );
  }

  // Right Financial Totals Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(116, finalY, 80, 36, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(tPdf('Subtotal Productos:', 'Items Subtotal:'), 120, finalY + 8);
  doc.text(`$${order.subtotalUSD.toFixed(2)} USD`, 192, finalY + 8, { align: 'right' });

  doc.text(`${tPdf('Envío', 'Shipping')} (${translatedShipping}):`, 120, finalY + 15);
  doc.text(`$${order.shippingFeeUSD.toFixed(2)} USD`, 192, finalY + 15, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tPdf('TOTAL FACTURA:', 'INVOICE TOTAL:'), 120, finalY + 23);
  doc.setTextColor(isOwnerCopy ? 4 : 180, isOwnerCopy ? 120 : 83, isOwnerCopy ? 87 : 9);
  doc.text(`$${order.totalUSD.toFixed(2)} USD`, 192, finalY + 23, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${tPdf('Equivalente Bs.', 'Bs. Equivalent')}: ${order.totalBs.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
    })} Bs.`,
    192,
    finalY + 31,
    { align: 'right' }
  );

  if (isOwnerCopy) {
    doc.setDrawColor(203, 213, 225);
    doc.line(20, finalY + 52, 90, finalY + 52);
    doc.line(120, finalY + 52, 190, finalY + 52);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tPdf('Firma / Sello Despacho Tienda', 'Store Dispatch Stamp / Signature'), 55, finalY + 57, {
      align: 'center',
    });
    doc.text(tPdf('Firma Recepción / Guía Courier', 'Courier Tracking / Receiver Sign'), 155, finalY + 57, {
      align: 'center',
    });
  }

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${
      isOwnerCopy ? tPdf('COPIA DUEÑO DE TIENDA', 'STORE OWNER COPY') : tPdf('ORIGINAL CLIENTE', 'CUSTOMER ORIGINAL')
    } · ${store.storeName} · ${tPdf('Plataforma Multi-SaaS', 'Multi-SaaS Platform')} Smith Solutions E-Commerce`,
    105,
    285,
    { align: 'center' }
  );
}

/**
 * Exports personalized Storefront Order Invoice PDF in Customer copy, Store Owner copy, or Dual (2-page) format.
 */
export function exportStoreOrderInvoicePDF(
  store: StoreTenant,
  order: StoreOrder,
  items: Array<StoreCartItem | StoreOrderItem>,
  mode: 'cliente' | 'dueno' | 'dual' = 'dual',
  lang: SupportedLanguage = 'es'
): void {
  const pdfLang = resolvePdfLang(lang);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const normalizedLines = normalizeInvoiceLines(items, pdfLang);

  if (mode === 'cliente') {
    renderStoreInvoicePage(doc, store, order, normalizedLines, 'cliente', pdfLang);
    savePdfResilient(doc, `factura_cliente_${store.slug}_${order.invoiceNumber}.pdf`);
    return;
  }

  if (mode === 'dueno') {
    renderStoreInvoicePage(doc, store, order, normalizedLines, 'dueno', pdfLang);
    savePdfResilient(doc, `factura_dueno_${store.slug}_${order.invoiceNumber}.pdf`);
    return;
  }

  // Dual mode: Page 1 Original Cliente + Page 2 Copia Dueño de Tienda
  renderStoreInvoicePage(doc, store, order, normalizedLines, 'cliente', pdfLang);
  doc.addPage('a4', 'portrait');
  renderStoreInvoicePage(doc, store, order, normalizedLines, 'dueno', pdfLang);
  savePdfResilient(doc, `facturas_cliente_y_dueno_${store.slug}_${order.invoiceNumber}.pdf`);
}

/**
 * Exports personalized per-store Sales Ledger PDF for the Store Owner.
 */
export function exportStoreSalesLedgerPDF(
  store: StoreTenant,
  orders: StoreOrder[],
  exchangeRate: number,
  lang: SupportedLanguage = 'es'
): void {
  const pdfLang = resolvePdfLang(lang);
  const tPdf = (es: string, en: string) => pdfText(pdfLang, es, en);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString(VENEZUELA_LOCALE, {
    timeZone: VENEZUELA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalUSD = activeOrders.reduce((acc, o) => acc + o.totalUSD, 0);
  const totalBs = activeOrders.reduce((acc, o) => acc + o.totalBs, 0);
  const totalProfitUSD = activeOrders.reduce(
    (acc, o) => acc + (o.estimatedProfitUSD ?? o.subtotalUSD),
    0
  );

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 40, 210, 2, 'F');

  let offsetX = 14;
  if (store.logoUrl && store.logoUrl.startsWith('data:image/')) {
    try {
      const format = store.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 7, 25, 25, 2, 2, 'F');
      doc.addImage(store.logoUrl, format, 15, 8, 23, 23);
      offsetX = 44;
    } catch {
      offsetX = 14;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${tPdf('LIBRO DE VENTAS', 'SALES LEDGER')} · ${store.storeName.toUpperCase()}`, offsetX, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36);
  doc.text(
    `${tPdf('Titular', 'Owner')}: ${store.registeredOwnerName} · ${tPdf('RIF', 'Tax ID')}: ${
      store.rif || tPdf('Sin RIF', 'None')
    }`,
    offsetX,
    22
  );

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`${tPdf('WhatsApp Comercial', 'Business WhatsApp')}: ${store.businessWhatsapp}`, offsetX, 29);

  doc.setTextColor(255, 255, 255);
  doc.text(`${tPdf('Fecha', 'Date')}: ${dateFormatted}`, 196, 15, { align: 'right' });
  doc.setTextColor(110, 231, 183);
  doc.text(`${tPdf('Tasa BCV', 'BCV Rate')}: ${exchangeRate.toFixed(2)} Bs/USD`, 196, 22, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`${tPdf('Órdenes Válidas', 'Valid Orders')}: ${activeOrders.length}`, 196, 29, { align: 'right' });

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 48, 182, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${tPdf('RESUMEN PERSONALIZADO DE VENTAS DE', 'CUSTOM SALES SUMMARY FOR')} ${store.storeName.toUpperCase()}`,
    18,
    54
  );

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${tPdf('Facturado', 'Billed')}: $${totalUSD.toFixed(2)} USD`, 18, 63);
  doc.setTextColor(4, 120, 87);
  doc.text(`${tPdf('Ganancia Productos Est.', 'Est. Product Profit')}: $${totalProfitUSD.toFixed(2)} USD`, 78, 63);
  doc.setTextColor(180, 83, 9);
  doc.text(
    `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    192,
    63,
    { align: 'right' }
  );

  const tableData = orders.map((o) => [
    o.invoiceNumber,
    translateSaleChannelLabel(o.saleChannel || 'Carrito Web', pdfLang),
    o.customerName,
    o.itemsSummary,
    translateShippingTypeLabel(o.shippingType, pdfLang),
    translateOrderStatusLabel(o.status, pdfLang).toUpperCase(),
    `$${o.totalUSD.toFixed(2)}`,
    `${o.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
  ]);

  autoTable(doc, {
    startY: 74,
    head: [
      [
        tPdf('Factura #', 'Invoice #'),
        tPdf('Canal', 'Channel'),
        tPdf('Cliente', 'Customer'),
        tPdf('Detalle Productos', 'Items Summary'),
        tPdf('Entrega', 'Delivery'),
        tPdf('Estado', 'Status'),
        'Total USD',
        'Total Bs.',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [251, 191, 36],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', fontSize: 7 },
      1: { cellWidth: 20, fontSize: 7 },
      2: { cellWidth: 25, fontSize: 7 },
      3: { cellWidth: 44, fontSize: 6.8 },
      4: { cellWidth: 20, fontSize: 7 },
      5: { cellWidth: 16, fontSize: 6.8 },
      6: { cellWidth: 16, halign: 'right', fontStyle: 'bold', fontSize: 7.5 },
      7: { cellWidth: 19, halign: 'right', fontSize: 7 },
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  savePdfResilient(doc, `libro_ventas_${store.slug}_${getCaracasDateString(now)}.pdf`);
}

