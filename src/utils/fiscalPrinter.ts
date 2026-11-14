import { Sale, FiscalPrinterBrand, FiscalPrinterConfig } from '../types';

export const DEFAULT_FISCAL_CONFIG: FiscalPrinterConfig = {
  brand: 'The Factory HKA',
  model: 'Bixolon SRP-350 / Dascom DT-230',
  serialNumber: 'HKA0084920',
  connectionType: 'USB / Serial COM',
  port: 'COM1',
  baudRate: 9600,
  autoPrintInvoice: true,
  currentZReport: 42,
  currentInvoiceNum: 86,
  headerCompany: 'SMITH SOLUTIONS E-COMMERCE C.A.',
  headerRIF: 'J-50129384-7',
  headerAddress: 'Av. Las Mercedes, Centro Empresarial Smith, Caracas - Venezuela',
};

const FISCAL_CONFIG_STORAGE_KEY = 'lions_gold_fiscal_printer_config';

export const getStoredFiscalConfig = (): FiscalPrinterConfig => {
  try {
    const raw = localStorage.getItem(FISCAL_CONFIG_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_FISCAL_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error loading fiscal config from localStorage:', e);
  }
  return DEFAULT_FISCAL_CONFIG;
};

export const saveStoredFiscalConfig = (config: FiscalPrinterConfig): void => {
  try {
    localStorage.setItem(FISCAL_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving fiscal config to localStorage:', e);
  }
};

/**
 * Generates The Factory HKA Protocol Command Stream
 * Based on official HKA Fiscal Driver manual for Venezuela
 */
export const generateHKACommandStream = (
  sale: Sale,
  config: FiscalPrinterConfig
): string => {
  const lines: string[] = [];
  const rif = sale.customerRIF || 'V-00000000-0';
  const name = sale.customerName || 'CLIENTE MOSTRADOR';

  // 1. Open Fiscal Invoice: i01 (Factura Normal)
  lines.push(`i01Cliente:${name.substring(0, 30)}`);
  lines.push(`i02RIF/CI:${rif.substring(0, 15)}`);

  // 2. Line Items: d0 (Venta Item alícuota G 16%)
  // Format: d0 + precio (10 digitos con 2 dec) + cantidad (8 digitos con 3 dec) + descripcion
  sale.items.forEach((item) => {
    const priceCents = Math.round(item.product.priceUSD * 100);
    const qtyMilli = Math.round(item.quantity * 1000);
    const priceStr = String(priceCents).padStart(10, '0');
    const qtyStr = String(qtyMilli).padStart(8, '0');
    const desc = item.product.name.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 35);
    lines.push(`d0${priceStr}${qtyStr}${desc}`);
  });

  // 3. Subtotal: 3
  lines.push('3');

  // 4. IGTF 3% Percepción en Divisas (si aplica)
  const isForeignCurrency = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
  const igtfAmount = isForeignCurrency ? Math.round(sale.subtotalUSD * 0.03 * 100) / 100 : 0;
  if (igtfAmount > 0) {
    const igtfCents = Math.round(igtfAmount * 100);
    const igtfStr = String(igtfCents).padStart(10, '0');
    // Command 1P: Percepción IGTF 3%
    lines.push(`1P${igtfStr}00001000IGTF 3% DIVISAS`);
  }

  // 5. Total Payment Form: 201 (Efectivo), 209 (Punto/Tarjeta), 220 (Divisa)
  const totalWithIgtf = Math.round((sale.subtotalUSD + igtfAmount) * 100);
  const paymentAmountStr = String(totalWithIgtf).padStart(12, '0');
  
  if (sale.paymentMethod === 'Efectivo USD') {
    lines.push(`220${paymentAmountStr}`); // 220: Divisas Extranjeras
  } else if (sale.paymentMethod === 'Zelle') {
    lines.push(`221${paymentAmountStr}`); // 221: Transferencia Divisas
  } else if (sale.paymentMethod === 'Pago Móvil') {
    lines.push(`202${paymentAmountStr}`); // 202: Pago Móvil C2P/P2P
  } else if (sale.paymentMethod === 'Punto de Venta') {
    lines.push(`209${paymentAmountStr}`); // 209: Tarjeta Débito/Crédito
  } else {
    lines.push(`201${paymentAmountStr}`); // 201: Efectivo Bolívares
  }

  // 6. Close Fiscal Invoice: 101
  lines.push('101');

  return lines.join('\n');
};

/**
 * Generates BMC / Bematech Protocol Command Stream
 */
export const generateBematechCommandStream = (
  sale: Sale,
  config: FiscalPrinterConfig
): string => {
  const lines: string[] = [];
  const rif = sale.customerRIF || 'V-00000000';
  const name = sale.customerName || 'CLIENTE GENERAL';

  lines.push(`FS_AbreCupomFiscal("${name}","${rif}")`);
  sale.items.forEach((item) => {
    lines.push(`FS_VendeItem("${item.product.sku}","${item.product.name.substring(0, 25)}","T16%",${item.quantity},${item.product.priceUSD.toFixed(2)})`);
  });

  const isForeignCurrency = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
  const igtf = isForeignCurrency ? (sale.subtotalUSD * 0.03).toFixed(2) : '0.00';
  if (parseFloat(igtf) > 0) {
    lines.push(`FS_AplicaAcrescimoDescontoItem(0,"A","%",3.00,"IGTF 3% DIVISAS")`);
  }

  lines.push(`FS_IniciaFechamentoCupom("A","%",0.00)`);
  lines.push(`FS_EfetuaFormaPagamento("${sale.paymentMethod}",${(sale.subtotalUSD + parseFloat(igtf)).toFixed(2)})`);
  lines.push(`FS_TerminaFechamentoCupom("GRACIAS POR SU COMPRA - LA TABERNA LIONS GOLD")`);

  return lines.join('\n');
};

/**
 * Generates Elepunto / Epson Fiscal Driver Protocol Command Stream
 */
export const generateEpsonCommandStream = (
  sale: Sale,
  config: FiscalPrinterConfig
): string => {
  const lines: string[] = [];
  const rif = sale.customerRIF || 'V-00000000';
  const name = sale.customerName || 'CLIENTE';

  lines.push(`@FACTABRE|T|${name}|${rif}|DIRECTA|||||`);
  sale.items.forEach((item) => {
    lines.push(`@FACTITEM|${item.product.name.substring(0, 30)}|${item.quantity}|${item.product.priceUSD.toFixed(2)}|1600|M|0|0|`);
  });

  const isForeignCurrency = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
  const igtf = isForeignCurrency ? (sale.subtotalUSD * 0.03).toFixed(2) : '0.00';
  if (parseFloat(igtf) > 0) {
    lines.push(`@FACTPERCEPCION|IGTF 3% PERCEPCION DIVISAS|${igtf}|`);
  }

  lines.push(`@FACTSUBTOTAL`);
  lines.push(`@FACTPAGO|${sale.paymentMethod}|${(sale.subtotalUSD + parseFloat(igtf)).toFixed(2)}|`);
  lines.push(`@FACTCIERRA`);

  return lines.join('\n');
};

/**
 * Generates Aclas Protocol Command Stream
 */
export const generateAclasCommandStream = (
  sale: Sale,
  config: FiscalPrinterConfig
): string => {
  const lines: string[] = [];
  lines.push(`[ACLAS_OPEN_RECEIPT:NAME=${sale.customerName},RIF=${sale.customerRIF || 'V-00000000'}]`);
  sale.items.forEach((item) => {
    lines.push(`[ACLAS_ITEM:DESC=${item.product.name},QTY=${item.quantity},PRICE=${item.product.priceUSD.toFixed(2)},TAX=16]`);
  });
  const isForeign = sale.paymentMethod === 'Efectivo USD' || sale.paymentMethod === 'Zelle';
  if (isForeign) {
    lines.push(`[ACLAS_SURCHARGE:TYPE=IGTF,RATE=3.0,AMOUNT=${(sale.subtotalUSD * 0.03).toFixed(2)}]`);
  }
  lines.push(`[ACLAS_PAYMENT:METHOD=${sale.paymentMethod},TOTAL=${(sale.subtotalUSD * (isForeign ? 1.03 : 1)).toFixed(2)}]`);
  lines.push(`[ACLAS_CLOSE_RECEIPT]`);
  return lines.join('\n');
};

/**
 * Generates command stream based on configured printer brand
 */
export const generateFiscalCommandStream = (
  sale: Sale,
  config: FiscalPrinterConfig
): string => {
  switch (config.brand) {
    case 'The Factory HKA':
      return generateHKACommandStream(sale, config);
    case 'BMC / Bematech':
      return generateBematechCommandStream(sale, config);
    case 'Elepunto / Epson':
      return generateEpsonCommandStream(sale, config);
    case 'Aclas':
      return generateAclasCommandStream(sale, config);
    default:
      return generateHKACommandStream(sale, config);
  }
};

/**
 * Generates Reporte X (Lectura de memoria sin corte fiscal)
 */
export const generateReportXCommand = (config: FiscalPrinterConfig): { commandText: string; jsonPayload: object } => {
  let commandText = 'I0X'; // Standard HKA Reporte X
  if (config.brand === 'BMC / Bematech') commandText = 'FS_RelatorioGerencial()';
  if (config.brand === 'Elepunto / Epson') commandText = '@REPORTE_X';
  if (config.brand === 'Aclas') commandText = '[ACLAS_REPORT_X]';

  return {
    commandText,
    jsonPayload: {
      action: 'REPORT_X',
      printerSerial: config.serialNumber,
      brand: config.brand,
      timestamp: new Date().toISOString(),
      header: config.headerCompany,
      rif: config.headerRIF,
    },
  };
};

/**
 * Generates Reporte Z (Cierre Diario Oficial SENIAT con corte de memoria fiscal)
 */
export const generateReportZCommand = (
  config: FiscalPrinterConfig,
  currentZ: number
): { commandText: string; jsonPayload: object; newZNumber: number } => {
  let commandText = 'I0Z'; // Standard HKA Reporte Z
  if (config.brand === 'BMC / Bematech') commandText = 'FS_FechamentoDoDia()';
  if (config.brand === 'Elepunto / Epson') commandText = '@REPORTE_Z';
  if (config.brand === 'Aclas') commandText = '[ACLAS_REPORT_Z]';

  const newZNumber = currentZ + 1;

  return {
    commandText,
    newZNumber,
    jsonPayload: {
      action: 'REPORT_Z',
      zReportNumber: `Z-${String(newZNumber).padStart(4, '0')}`,
      printerSerial: config.serialNumber,
      brand: config.brand,
      timestamp: new Date().toISOString(),
      header: config.headerCompany,
      rif: config.headerRIF,
      memoryRecord: 'COMMITTED_TO_FISCAL_MEMORY',
    },
  };
};

/**
 * Download fiscal spooler file for local printing service (Spooler HKA / FiscalDriver)
 */
export const downloadFiscalSpoolerFile = (
  content: string,
  fileName: string = 'FacturaFiscal_LionsGold.txt'
) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
