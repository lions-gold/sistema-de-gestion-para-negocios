import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, PurchaseInvoice, CashClosingRecord, InventoryAuditLog } from '../types';

/**
 * Generates and downloads the Official SENIAT Libro de Ventas (CSV)
 * Format compliant with Providencia Administrativa SNAT/2014/0032
 */
export const exportLibroVentasCSV = (sales: Sale[], exchangeRate: number, monthName: string = 'Noviembre 2026') => {
  const headers = [
    'Nro. Operacion',
    'Fecha Factura',
    'RIF/CI Comprador',
    'Nombre o Razon Social',
    'Nro. Factura Fiscal',
    'Nro. Control Fiscal',
    'Nro. Reporte Z',
    'Total Ventas Incl. IVA (USD)',
    'Total Ventas Incl. IVA (Bs.)',
    'Ventas Exentas (Bs.)',
    'Base Imponible 16% (Bs.)',
    'Alicuota %',
    'Impuesto IVA 16% (Bs.)',
    'Monto Pagado en Divisas (USD)',
    'IGTF 3% Percibido (Bs.)',
    'Metodo de Pago'
  ];

  const rows = sales.map((sale, index) => {
    const isForeign = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
    const subtotal = sale.subtotalUSD;
    // Venezuelan retail standard: Base = subtotal / 1.16, IVA = subtotal - Base
    const baseUSD = subtotal / 1.16;
    const ivaUSD = subtotal - baseUSD;
    const igtfUSD = isForeign ? subtotal * 0.03 : 0;
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
      `"${sale.paymentMethod}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Libro_de_Ventas_SENIAT_${monthName.replace(/\s+/g, '_')}_LionsGold.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generates and downloads the Official SENIAT Libro de Compras (CSV)
 */
export const exportLibroComprasCSV = (purchases: PurchaseInvoice[], exchangeRate: number, monthName: string = 'Noviembre 2026') => {
  const headers = [
    'Nro. Operacion',
    'Fecha Factura',
    'RIF Proveedor',
    'Nombre o Razon Social Proveedor',
    'Nro. Factura Proveedor',
    'Nro. Control',
    'Total Compras Incl. IVA (USD)',
    'Total Compras Incl. IVA (Bs.)',
    'Compras Exentas (Bs.)',
    'Base Imponible (Bs.)',
    'Alicuota %',
    'Credito Fiscal IVA (Bs.)',
    'Retencion IVA 75%/100% (Bs.)',
    'Nro. Comprobante Retencion'
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Libro_de_Compras_SENIAT_${monthName.replace(/\s+/g, '_')}_LionsGold.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generates and downloads the Official SENIAT Libro de Ventas (PDF)
 */
export const exportLibroVentasPDF = (sales: Sale[], exchangeRate: number, monthName: string = 'Noviembre 2026') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Header SENIAT
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 279.4, 28, 'F');

  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LA TABERNA LIONS GOLD C.A. - RIF: J-50129384-7', 14, 10);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`LIBRO DE VENTAS FISCAL (SENIAT) - PERÍODO: ${monthName.toUpperCase()}`, 14, 17);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Tasa Oficial Referencial BCV: ${exchangeRate.toFixed(2)} Bs/USD • Sistema por Smith Bussines Solutions 2026`, 14, 23);

  // Table Data
  let grandTotalUSD = 0;
  let grandTotalBs = 0;
  let grandBaseBs = 0;
  let grandIVABs = 0;
  let grandIGTBs = 0;

  const tableRows = sales.map((sale, idx) => {
    const isForeign = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
    const subtotal = sale.subtotalUSD;
    const baseUSD = subtotal / 1.16;
    const ivaUSD = subtotal - baseUSD;
    const igtfUSD = isForeign ? subtotal * 0.03 : 0;
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
      sale.paymentMethod
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      'Op',
      'Fecha',
      'RIF/CI',
      'Cliente / Razón Social',
      'Factura',
      'Reporte Z',
      'Total ($)',
      'Total (Bs.)',
      'Base Imponible (Bs.)',
      'Alic.',
      'IVA 16% (Bs.)',
      'IGTF 3% (Bs.)',
      'Método Pago'
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
      'TOTALES',
      '',
      '',
      `${sales.length} facturas`,
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

  doc.save(`Libro_de_Ventas_SENIAT_${monthName.replace(/\s+/g, '_')}_LionsGold.pdf`);
};

/**
 * Generates and downloads the Official SENIAT Libro de Compras (PDF)
 */
export const exportLibroComprasPDF = (purchases: PurchaseInvoice[], exchangeRate: number, monthName: string = 'Noviembre 2026') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Header SENIAT
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 279.4, 28, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LA TABERNA LIONS GOLD C.A. - RIF: J-50129384-7', 14, 10);

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`LIBRO DE COMPRAS FISCAL (SENIAT) - PERÍODO: ${monthName.toUpperCase()}`, 14, 17);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Tasa Oficial Referencial BCV: ${exchangeRate.toFixed(2)} Bs/USD • Proveedores y Mayoristas de Licores`, 14, 23);

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
      'Op',
      'Fecha',
      'RIF Proveedor',
      'Distribuidor / Proveedor',
      'Factura',
      'Control',
      'Total ($)',
      'Total (Bs.)',
      'Base Imponible (Bs.)',
      'Alic.',
      'Crédito IVA (Bs.)',
      'Retención 75% (Bs.)',
      'Comprobante Ret.'
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
      'TOTALES',
      '',
      '',
      `${purchases.length} compras`,
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

  doc.save(`Libro_de_Compras_SENIAT_${monthName.replace(/\s+/g, '_')}_LionsGold.pdf`);
};

/**
 * Generates and downloads the Official Comprobante de Cierre de Caja Dual (PDF)
 */
export const exportCashClosingPDF = (closing: CashClosingRecord) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 215.9, 36, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LA TABERNA LIONS GOLD C.A.', 14, 12);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPROBANTE DE CIERRE DE CAJA DUAL & ARQUEO FISCAL', 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Cierre Nro: ${closing.closingNumber} | Fecha: ${closing.date} | Reporte Z: ${closing.zReportNumber}`, 14, 28);
  doc.text(`Cajero(a): ${closing.cashierName} | Tasa Oficial BCV: ${closing.exchangeRate.toFixed(2)} Bs/USD`, 14, 33);

  // Table of Breakdown by Payment Method
  const paymentRows = Object.entries(closing.byPaymentMethod).map(([method, data]) => [
    method,
    data.count,
    `$${data.totalUSD.toFixed(2)}`,
    data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) + ' Bs.',
    data.igtfUSD > 0 ? `$${data.igtfUSD.toFixed(2)}` : 'N/A'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [[
      'Método de Pago',
      'Transacciones',
      'Total Recaudado (USD)',
      'Total Recaudado (Bs.)',
      'IGTF 3% Percibido'
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
      'TOTAL FACTURACIÓN',
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
  doc.text('RESUMEN DE ARQUEO FÍSICO DE GAVETA (EFECTIVO)', 18, finalY + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Efectivo USD Esperado en Gaveta: $${closing.expectedCashUSD.toFixed(2)}`, 18, finalY + 16);
  doc.text(`Efectivo USD Físico Declarado:   $${closing.declaredCashUSD.toFixed(2)}`, 18, finalY + 22);

  const diffUSD = closing.differenceUSD;
  doc.setFont('helvetica', 'bold');
  if (Math.abs(diffUSD) < 0.01) {
    doc.setTextColor(16, 185, 129); // emerald
    doc.text('Diferencia USD: $0.00 (CUADRADA EXACTA)', 18, finalY + 28);
  } else if (diffUSD > 0) {
    doc.setTextColor(59, 130, 246); // blue (sobrante)
    doc.text(`Diferencia USD: +$${diffUSD.toFixed(2)} (SOBRANTE)`, 18, finalY + 28);
  } else {
    doc.setTextColor(225, 29, 72); // rose (faltante)
    doc.text(`Diferencia USD: -$${Math.abs(diffUSD).toFixed(2)} (FALTANTE)`, 18, finalY + 28);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Efectivo Bs. Esperado en Gaveta: ${closing.expectedCashBs.toFixed(2)} Bs.`, 110, finalY + 16);
  doc.text(`Efectivo Bs. Físico Declarado:   ${closing.declaredCashBs.toFixed(2)} Bs.`, 110, finalY + 22);

  const diffBs = closing.differenceBs;
  doc.setFont('helvetica', 'bold');
  if (Math.abs(diffBs) < 0.01) {
    doc.setTextColor(16, 185, 129);
    doc.text('Diferencia Bs.: 0.00 Bs. (CUADRADA)', 110, finalY + 28);
  } else if (diffBs > 0) {
    doc.setTextColor(59, 130, 246);
    doc.text(`Diferencia Bs.: +${diffBs.toFixed(2)} Bs. (SOBRANTE)`, 110, finalY + 28);
  } else {
    doc.setTextColor(225, 29, 72);
    doc.text(`Diferencia Bs.: -${Math.abs(diffBs).toFixed(2)} Bs. (FALTANTE)`, 110, finalY + 28);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`Notas del Arqueo: ${closing.notes || 'Cierre verificado por administración sin observaciones.'}`, 18, finalY + 38);

  // Signatures
  doc.line(25, finalY + 70, 85, finalY + 70);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Firma Cajero(a) Responsable', 32, finalY + 75);

  doc.line(130, finalY + 70, 190, finalY + 70);
  doc.text('Firma Administrador / Auditor', 137, finalY + 75);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Software Smith Solutions E-Commerce • Smith Bussines Solutions 2026 • +58 422 027 3766', 14, 265);

  doc.save(`Cierre_Caja_${closing.closingNumber}_SmithSolutions.pdf`);
};

/**
 * Exports Inventory Audit and Waste/Loss Records to CSV
 */
export const exportInventoryAuditCSV = (audits: InventoryAuditLog[], exchangeRate: number) => {
  const headers = [
    'ID Auditoria',
    'Fecha / Hora',
    'Producto',
    'SKU',
    'Tipo de Merma / Incidencia',
    'Cantidad Afectada',
    'Costo Unitario (USD)',
    'Perdida Total (USD)',
    'Perdida Total (Bs.)',
    'Auditor / Responsable',
    'Ubicacion en Almacen',
    'Observaciones'
  ];

  const rows = audits.map((a) => [
    a.id,
    a.date,
    `"${a.productName.replace(/"/g, '""')}"`,
    a.sku,
    `"${a.type}"`,
    a.quantity,
    a.unitCostUSD.toFixed(2),
    a.totalLossUSD.toFixed(2),
    a.totalLossBs.toFixed(2),
    `"${a.auditorName}"`,
    `"${a.location}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Auditoria_Mermas_LionsGold_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exports Official Inventory Audit Report to PDF
 */
export const exportInventoryAuditPDF = (audits: InventoryAuditLog[], exchangeRate: number) => {
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
  doc.text('LA TABERNA LIONS GOLD C.A. • RIF: J-50129384-7', 14, 13);

  doc.setFontSize(10.5);
  doc.setTextColor(251, 113, 133); // rose-400
  doc.text('AUDITORÍA DE INVENTARIO: REGISTRO DE DESVÍOS, MERMAS Y PÉRDIDAS', 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Control Maestro de Rentabilidad, Roturas en Cava y Protección Patrimonial', 14, 26);
  doc.text('Software por Smith Bussines Solutions 2026 • +58 422 027 3766 • Caracas, Venezuela', 14, 31);

  // Meta Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}`, 283, 13, { align: 'right' });
  doc.setTextColor(251, 191, 36);
  doc.text(`Tasa Oficial BCV: ${exchangeRate.toFixed(2)} Bs/USD`, 283, 20, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Total Incidencias: ${audits.length}`, 283, 27, { align: 'right' });

  // Summary Metrics Banner
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(14, 42, 269, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(159, 18, 57);
  doc.text(`TOTAL UNIDADES AFECTADAS: ${totalQty} unid.`, 20, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`IMPACTO TOTAL EN RENTABILIDAD: $${totalLossUSD.toFixed(2)} USD`, 100, 52);
  doc.text(`EQUIVALENTE: ${totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 210, 52);

  // Table Data
  const tableData = audits.map((a) => [
    a.date,
    a.productName,
    a.sku,
    a.type,
    a.quantity,
    `$${a.unitCostUSD.toFixed(2)}`,
    `$${a.totalLossUSD.toFixed(2)}`,
    `${a.totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`,
    a.location,
    a.auditorName,
    a.notes || 'Sin observaciones'
  ]);

  autoTable(doc, {
    startY: 62,
    head: [[
      'Fecha', 
      'Producto', 
      'SKU', 
      'Tipo Incidencia', 
      'Cant.', 
      'Costo U.', 
      'Pérdida USD', 
      'Pérdida Bs.', 
      'Ubicación', 
      'Auditor', 
      'Observaciones'
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
    doc.text('Firma Jefe de Almacén / Auditor', 45, finalY + 19);

    doc.line(180, finalY + 14, 260, finalY + 14);
    doc.text('Firma Gerente General / Administración', 190, finalY + 19);
  }

  doc.save(`Auditoria_Inventario_LionsGold_${new Date().toISOString().split('T')[0]}.pdf`);
};

