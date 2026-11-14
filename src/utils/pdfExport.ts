import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, StoreCartItem, StoreOrder, StoreOrderItem, StoreTenant } from '../types';

/**
 * Exports full batch sales report to PDF
 */
export function exportSalesReportPDF(sales: Sale[], exchangeRate: number): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('es-VE', {
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
  doc.text('E-Commerce, Almacenes & Punto de Venta Multidivisa', 14, 21);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(8.5);
  doc.text(`Software por Smith Bussines Solutions 2026 | +58 422 027 3766`, 14, 27);
  doc.text(`Correo: empresaalhadiqainvest@gmail.com | Venezuela`, 14, 32);

  // Date and Rate in top right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Fecha: ${dateFormatted} - ${timeFormatted}`, 196, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text(`Tasa BCV Aplicada: ${exchangeRate.toFixed(2)} Bs/USD`, 196, 23, { align: 'right' });

  doc.setTextColor(148, 163, 184);
  doc.text(`Total Órdenes: ${sales.length}`, 196, 30, { align: 'right' });

  // Summary Metrics Cards Area
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 46, 182, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('REPORTE GENERAL DE FACTURACIÓN Y VENTAS REGISTRADAS', 18, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Facturado USD: $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, 18, 61);

  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Total en Bolívares: ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 110, 61);

  // Table Body using autoTable
  const tableData = sales.map((sale) => [
    sale.receiptNumber,
    sale.date,
    sale.customerName,
    sale.items.map((i) => `${i.quantity}x ${i.product.name}`).join('\n'),
    sale.paymentMethod,
    `$${sale.subtotalUSD.toFixed(2)}`,
    `${sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['Recibo #', 'Fecha', 'Cliente', 'Productos Vendidos', 'Método', 'Total USD', 'Total Bs.']],
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
      ['TOTAL GENERAL', '', '', `${sales.length} órdenes`, '', `$${totalUSD.toFixed(2)}`, `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`]
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
      `Página ${i} de ${pageCount} · Documento emitido por Smith Solutions E-Commerce · Por Smith Bussines Solutions 2026`,
      105,
      290,
      { align: 'center' }
    );
  }

  const filename = `reporte_ventas_smith_solutions_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Exports a single commercial receipt / invoice to PDF
 */
export function exportSingleReceiptPDF(sale: Sale): void {
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
  doc.text('COMPROBANTE DE VENTA OFICIAL', 12, 19);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.text('E-Commerce & Punto de Venta | Smith Bussines Solutions 2026', 12, 25);

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
  doc.text(`Tasa: ${sale.exchangeRate.toFixed(2)} Bs/USD`, 136, 25, { align: 'right' });

  // Customer Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 38, 124, 18, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE:', 16, 44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sale.customerName, 32, 44);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('RIF / CI:', 80, 44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(sale.customerRIF || 'V-00000000-0', 94, 44);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('MÉTODO:', 16, 51);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(sale.paymentMethod, 32, 51);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ESTADO:', 80, 51);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(sale.status, 94, 51);

  // Items Table
  const itemsRows = sale.items.map((i) => [
    i.product.name,
    `${i.quantity} ${i.product.unit || 'und'}`,
    `$${i.product.priceUSD.toFixed(2)}`,
    `$${(i.quantity * i.product.priceUSD).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['Descripción del Producto', 'Cant.', 'Precio', 'Subtotal']],
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
    doc.text('Base Imponible (16%):', 72, finalY + 6);
    doc.text(`$${(sale.baseAmountUSD || (sale.subtotalUSD / 1.16)).toFixed(2)}`, 132, finalY + 6, { align: 'right' });

    doc.text('IVA 16%:', 72, finalY + 11);
    doc.text(`$${(sale.ivaUSD || (sale.subtotalUSD - sale.subtotalUSD / 1.16)).toFixed(2)}`, 132, finalY + 11, { align: 'right' });

    doc.setTextColor(217, 119, 6);
    doc.text('IGTF 3% Divisas:', 72, finalY + 16);
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
    doc.text('TOTAL BOLÍVARES:', 72, finalY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 132, finalY + 16, { align: 'right' });
  }

  // Thank you and footer note
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text('¡Gracias por su preferencia en Smith Solutions E-Commerce!', 74, finalY + 34, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Desarrollado con excelencia por Smith Bussines Solutions 2026', 74, finalY + 39, { align: 'center' });
  doc.text('Contacto: empresaalhadiqainvest@gmail.com | +58 422 027 3766', 74, finalY + 43, { align: 'center' });

  doc.save(`recibo_${sale.receiptNumber}.pdf`);
}

/**
 * Triggers thermal ticket / browser printer for a sale receipt
 */
export function printReceiptTicket(sale: Sale): void {
  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) {
    window.print();
    return;
  }

  const itemsHtml = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 4px 0; text-align: left;">${item.quantity}x ${item.product.name}</td>
        <td style="padding: 4px 0; text-align: right; font-weight: bold;">$${(item.quantity * item.product.priceUSD).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo ${sale.receiptNumber}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            margin: 0;
            padding: 12px;
            color: #000;
            max-width: 320px;
            margin: 0 auto;
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
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SMITH SOLUTIONS E-COMMERCE</div>
          <div class="subtitle">RIF: J-50129384-7 • Caracas, Venezuela</div>
          <div class="subtitle">Recibo: ${sale.receiptNumber}</div>
          ${sale.fiscalInvoiceNumber ? `<div class="subtitle" style="font-weight: bold; color: #b45309;">FACTURA FISCAL: ${sale.fiscalInvoiceNumber}</div>` : ''}
          <div class="subtitle">Fecha: ${sale.date}</div>
          <div class="subtitle">Cliente: ${sale.customerName}</div>
          <div class="subtitle">RIF / C.I.: ${sale.customerRIF || 'V-00000000-0'}</div>
          <div class="subtitle">Método: ${sale.paymentMethod}</div>
        </div>

        <table>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div style="font-size: 10px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Base Imponible (16%):</span>
            <span>$${(sale.baseAmountUSD || (sale.subtotalUSD / 1.16)).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>IVA Débito (16%):</span>
            <span>$${(sale.ivaUSD || (sale.subtotalUSD - sale.subtotalUSD / 1.16)).toFixed(2)}</span>
          </div>
          ${sale.igtfAmountUSD && sale.igtfAmountUSD > 0 ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold; color: #b45309;">
            <span>+ IGTF (3% Divisas):</span>
            <span>+$${sale.igtfAmountUSD.toFixed(2)} USD</span>
          </div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="total-row">
          <span>TOTAL FINAL USD:</span>
          <span>$${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)}</span>
        </div>
        <div class="total-row" style="font-size: 11px;">
          <span>TOTAL BOLÍVARES:</span>
          <span>${(sale.totalWithIgtfBs || sale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</span>
        </div>
        <div style="font-size: 10px; text-align: center; color: #555;">
          Tasa Oficial BCV: ${sale.exchangeRate.toFixed(2)} Bs/USD
        </div>

        <div class="footer">
          <div>¡Gracias por su compra!</div>
          <div style="margin-top: 4px;">Smith Bussines Solutions 2026</div>
          <div>empresaalhadiqainvest@gmail.com</div>
          <div>+58 422 027 3766</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
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
  items: Array<StoreCartItem | StoreOrderItem>
): NormalizedInvoiceLine[] {
  return items.map((entry) => {
    if ('product' in entry) {
      return {
        name: entry.product.name,
        sku: entry.product.sku || '-',
        unit: entry.product.unit || 'und',
        quantity: entry.quantity,
        unitPriceUSD: entry.product.priceUSD,
        unitCostUSD: entry.product.costUSD || 0,
        subtotalUSD: Number((entry.quantity * entry.product.priceUSD).toFixed(2)),
      };
    }
    return {
      name: entry.productName,
      sku: entry.sku || '-',
      unit: entry.unit || 'und',
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
  role: 'cliente' | 'dueno'
): void {
  const isOwnerCopy = role === 'dueno';

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
  doc.text(`Titular / Razón Social: ${store.registeredOwnerName}`, textOffsetX, 22);

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8.5);
  doc.text(
    `RIF: ${store.rif && store.rif.trim() ? store.rif : 'Sin RIF registrado'}  ·  WhatsApp: ${store.businessWhatsapp}`,
    textOffsetX,
    28
  );
  doc.setTextColor(isOwnerCopy ? 110 : 148, isOwnerCopy ? 231 : 163, isOwnerCopy ? 183 : 184);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isOwnerCopy
      ? 'COPIA COMERCIO · DUEÑO DE TIENDA (CONTROL INTERNO DE VENTA)'
      : 'ORIGINAL · FACTURA PARA EL CLIENTE (COMPROBANTE OFICIAL)',
    textOffsetX,
    36
  );

  // Invoice Metadata Top Right
  const nowStr = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`FACTURA #${order.invoiceNumber}`, 196, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Fecha: ${nowStr}`, 196, 22, { align: 'right' });
  doc.setTextColor(251, 191, 36);
  doc.text(`Tasa BCV: ${order.exchangeRate.toFixed(2)} Bs/USD`, 196, 28, { align: 'right' });
  doc.setTextColor(isOwnerCopy ? 110 : 251, isOwnerCopy ? 231 : 191, isOwnerCopy ? 183 : 36);
  doc.setFont('helvetica', 'bold');
  doc.text(isOwnerCopy ? 'COPIA DUEÑO' : 'COPIA CLIENTE', 196, 36, { align: 'right' });

  // Buyer & Shipping Information Cards
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 52, 90, 36, 2, 2, 'FD');
  doc.roundedRect(108, 52, 88, 36, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DATOS DEL COMPRADOR (CLIENTE)', 18, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Nombre / Razón: ${order.customerName}`, 18, 65);
  doc.text(`C.I. / RIF: ${order.customerRif || 'No especificado'}`, 18, 71);
  doc.text(`Teléfono / WhatsApp: ${order.customerPhone}`, 18, 77);
  if (order.customerEmail) {
    doc.text(`Correo: ${order.customerEmail}`, 18, 83);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(isOwnerCopy ? 'LOGÍSTICA, PAGO Y REGISTRO DE VENTA' : 'MODALIDAD DE ENTREGA Y PAGO', 112, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Entrega: ${order.shippingType}`, 112, 65);
  doc.text(`Pago: ${order.paymentMethod} (${order.saleChannel || 'Carrito Web'})`, 112, 71);
  const shippingText = order.shippingDetails
    ? doc.splitTextToSize(`Destino: ${order.shippingDetails}`, 80)
    : ['Destino: Coordinado con la tienda'];
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
    head: [['Producto / Descripción', 'SKU', 'Cant.', 'P. Unit', 'Subtotal USD', 'Subtotal Bs.']],
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
    doc.text('RESUMEN INTERNO DUEÑO DE TIENDA', 18, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`ID Orden Sistema: ${order.id}`, 18, finalY + 13);
    doc.text(`Estado Actual: ${order.status.toUpperCase()} · Stock: ${order.stockDeducted ? 'Descontado' : 'Por confirmar'}`, 18, finalY + 19);
    doc.text(`Costo Reposición Est.: $${computedCost.toFixed(2)} USD`, 18, finalY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(`Ganancia Neta Est. Productos: $${computedProfit.toFixed(2)} USD`, 18, finalY + 31);
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, 96, 36, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('GARANTÍA Y ATENCIÓN AL CLIENTE', 18, finalY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Comercio Emisor: ${store.storeName}`, 18, finalY + 14);
    doc.text(`Titular: ${store.registeredOwnerName}`, 18, finalY + 20);
    doc.text(`WhatsApp Soporte Tienda: ${store.businessWhatsapp}`, 18, finalY + 26);
    doc.text('Conserve esta factura original como respaldo de compra.', 18, finalY + 32);
  }

  // Right Financial Totals Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(116, finalY, 80, 36, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Productos:', 120, finalY + 8);
  doc.text(`$${order.subtotalUSD.toFixed(2)} USD`, 192, finalY + 8, { align: 'right' });

  doc.text(`Envío (${order.shippingType}):`, 120, finalY + 15);
  doc.text(`$${order.shippingFeeUSD.toFixed(2)} USD`, 192, finalY + 15, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL FACTURA:', 120, finalY + 23);
  doc.setTextColor(isOwnerCopy ? 4 : 180, isOwnerCopy ? 120 : 83, isOwnerCopy ? 87 : 9);
  doc.text(`$${order.totalUSD.toFixed(2)} USD`, 192, finalY + 23, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Equivalente Bs.: ${order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
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
    doc.text('Firma / Sello Despacho Tienda', 55, finalY + 57, { align: 'center' });
    doc.text('Firma Recepción / Guía Courier', 155, finalY + 57, { align: 'center' });
  }

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${isOwnerCopy ? 'COPIA DUEÑO DE TIENDA' : 'ORIGINAL CLIENTE'} · ${store.storeName} · Plataforma Multi-SaaS Smith Solutions E-Commerce`,
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
  mode: 'cliente' | 'dueno' | 'dual' = 'dual'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const normalizedLines = normalizeInvoiceLines(items);

  if (mode === 'cliente') {
    renderStoreInvoicePage(doc, store, order, normalizedLines, 'cliente');
    doc.save(`factura_cliente_${store.slug}_${order.invoiceNumber}.pdf`);
    return;
  }

  if (mode === 'dueno') {
    renderStoreInvoicePage(doc, store, order, normalizedLines, 'dueno');
    doc.save(`factura_dueno_${store.slug}_${order.invoiceNumber}.pdf`);
    return;
  }

  // Dual mode: Page 1 Original Cliente + Page 2 Copia Dueño de Tienda
  renderStoreInvoicePage(doc, store, order, normalizedLines, 'cliente');
  doc.addPage('a4', 'portrait');
  renderStoreInvoicePage(doc, store, order, normalizedLines, 'dueno');
  doc.save(`facturas_cliente_y_dueno_${store.slug}_${order.invoiceNumber}.pdf`);
}

/**
 * Exports personalized per-store Sales Ledger PDF for the Store Owner.
 */
export function exportStoreSalesLedgerPDF(
  store: StoreTenant,
  orders: StoreOrder[],
  exchangeRate: number
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-VE', {
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
  doc.text(`LIBRO DE VENTAS · ${store.storeName.toUpperCase()}`, offsetX, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36);
  doc.text(
    `Titular: ${store.registeredOwnerName} · RIF: ${store.rif || 'Sin RIF'}`,
    offsetX,
    22
  );

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`WhatsApp Comercial: ${store.businessWhatsapp}`, offsetX, 29);

  doc.setTextColor(255, 255, 255);
  doc.text(`Fecha: ${dateFormatted}`, 196, 15, { align: 'right' });
  doc.setTextColor(110, 231, 183);
  doc.text(`Tasa BCV: ${exchangeRate.toFixed(2)} Bs/USD`, 196, 22, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`Órdenes Válidas: ${activeOrders.length}`, 196, 29, { align: 'right' });

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 48, 182, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`RESUMEN PERSONALIZADO DE VENTAS DE ${store.storeName.toUpperCase()}`, 18, 54);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Facturado: $${totalUSD.toFixed(2)} USD`, 18, 63);
  doc.setTextColor(4, 120, 87);
  doc.text(`Ganancia Productos Est.: $${totalProfitUSD.toFixed(2)} USD`, 78, 63);
  doc.setTextColor(180, 83, 9);
  doc.text(
    `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    192,
    63,
    { align: 'right' }
  );

  const tableData = orders.map((o) => [
    o.invoiceNumber,
    o.saleChannel || 'Carrito Web',
    o.customerName,
    o.itemsSummary,
    o.shippingType,
    o.status.toUpperCase(),
    `$${o.totalUSD.toFixed(2)}`,
    `${o.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
  ]);

  autoTable(doc, {
    startY: 74,
    head: [['Factura #', 'Canal', 'Cliente', 'Detalle Productos', 'Entrega', 'Estado', 'Total USD', 'Total Bs.']],
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

  doc.save(`libro_ventas_${store.slug}_${now.toISOString().split('T')[0]}.pdf`);
}

