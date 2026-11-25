import { SupportedLanguage } from '../i18n/translations';

interface LabelEntry {
  aliases: string[];
  labels: Record<SupportedLanguage, string>;
}

function buildLookup(entries: LabelEntry[]): Map<string, Record<SupportedLanguage, string>> {
  const map = new Map<string, Record<SupportedLanguage, string>>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      map.set(alias.toLowerCase(), entry.labels);
    }
  }
  return map;
}

function lookupLabel(
  lookup: Map<string, Record<SupportedLanguage, string>>,
  rawValue: string | undefined | null,
  lang: SupportedLanguage
): string {
  const cleaned = (rawValue || '').trim();
  if (!cleaned) return '';
  const hit = lookup.get(cleaned.toLowerCase());
  if (hit) return hit[lang] || hit.es;
  return cleaned;
}

// -----------------------------------------------------------------------------
// 1. Payment Methods (Global Admin, Storefront, POS, Direct Sale, Cash Closing)
// -----------------------------------------------------------------------------
const PAYMENT_METHOD_ENTRIES: LabelEntry[] = [
  {
    aliases: ['pago móvil', 'pago movil', 'mobile payment', '移动支付'],
    labels: { es: 'Pago Móvil', en: 'Pago Móvil', zh: 'Pago Móvil 移动转账' },
  },
  {
    aliases: ['pago móvil (bs.)', 'pago movil (bs.)', 'pago móvil (bs)', 'pago movil (bs)'],
    labels: { es: 'Pago Móvil (Bs.)', en: 'Pago Móvil (Bs.)', zh: 'Pago Móvil 移动转账 (Bs.)' },
  },
  {
    aliases: [
      'transferencia bancaria',
      'bank transfer',
      'wire transfer',
      '银行转账',
    ],
    labels: { es: 'Transferencia Bancaria', en: 'Bank Transfer', zh: '银行转账' },
  },
  {
    aliases: ['transferencia banesco', 'banesco transfer', 'banesco 银行转账'],
    labels: { es: 'Transferencia Banesco', en: 'Banesco Transfer', zh: 'Banesco 银行转账' },
  },
  {
    aliases: ['transferencia mercantil', 'mercantil transfer', 'mercantil 银行转账'],
    labels: { es: 'Transferencia Mercantil', en: 'Mercantil Transfer', zh: 'Mercantil 银行转账' },
  },
  {
    aliases: ['efectivo usd', 'cash usd', 'usd cash', '美元现金'],
    labels: { es: 'Efectivo USD', en: 'Cash USD', zh: '美元现金' },
  },
  {
    aliases: ['efectivo bs', 'efectivo bs.', 'cash bs', 'ves cash', '玻利瓦尔现金'],
    labels: { es: 'Efectivo Bs', en: 'Cash Bs', zh: '玻利瓦尔现金' },
  },
  {
    aliases: ['efectivo / otro', 'cash / other', '现金 / 其他'],
    labels: { es: 'Efectivo / Otro', en: 'Cash / Other', zh: '现金 / 其他' },
  },
  {
    aliases: ['punto de venta', 'pos card', 'debit / pos terminal', 'pos 刷卡机'],
    labels: { es: 'Punto de Venta', en: 'POS Terminal', zh: 'POS 刷卡机' },
  },
  {
    aliases: ['tarjeta de débito', 'tarjeta de debito', 'debit card', '借记卡'],
    labels: { es: 'Tarjeta de Débito', en: 'Debit Card', zh: '借记卡' },
  },
  {
    aliases: ['fiado (crédito)', 'fiado (credito)', 'credit / tab', 'credit (fiado)', '赊账 (信用)'],
    labels: { es: 'Fiado (Crédito)', en: 'Credit (Tab)', zh: '赊账 (信用)' },
  },
  {
    aliases: ['binance pay', 'binance pay (usdt)'],
    labels: { es: 'Binance Pay', en: 'Binance Pay', zh: 'Binance Pay (币安支付)' },
  },
  {
    aliases: ['binance pay (qr)', 'binance pay qr', 'binance qr'],
    labels: { es: 'Binance Pay (QR)', en: 'Binance Pay (QR)', zh: 'Binance Pay (扫码支付)' },
  },
  {
    aliases: ['bybit', 'bybit pay'],
    labels: { es: 'Bybit Pay', en: 'Bybit Pay', zh: 'Bybit Pay' },
  },
  {
    aliases: ['bybit pay (qr)', 'bybit pay qr', 'bybit qr'],
    labels: { es: 'Bybit Pay (QR)', en: 'Bybit Pay (QR)', zh: 'Bybit Pay (扫码支付)' },
  },
  {
    aliases: ['zelle'],
    labels: { es: 'Zelle', en: 'Zelle', zh: 'Zelle 转账' },
  },
  {
    aliases: ['zinli'],
    labels: { es: 'Zinli', en: 'Zinli', zh: 'Zinli 钱包' },
  },
  {
    aliases: ['wally', 'wally tech'],
    labels: { es: 'Wally', en: 'Wally', zh: 'Wally 钱包' },
  },
  {
    aliases: ['cashea'],
    labels: { es: 'Cashea', en: 'Cashea', zh: 'Cashea 分期' },
  },
  {
    aliases: ['paypal'],
    labels: { es: 'PayPal', en: 'PayPal', zh: 'PayPal' },
  },
  {
    aliases: ['usdt (trc20)', 'usdt trc20'],
    labels: { es: 'USDT (TRC20)', en: 'USDT (TRC20)', zh: 'USDT (TRC20)' },
  },
  {
    aliases: [
      'coordinado con admin (whatsapp)',
      'coordinated with admin (whatsapp)',
      '与管理员在 whatsapp 确认',
    ],
    labels: {
      es: 'Coordinado con Admin (WhatsApp)',
      en: 'Coordinated with Admin (WhatsApp)',
      zh: '与管理员在 WhatsApp 确认',
    },
  },
  {
    aliases: ['otro', 'other', '其他'],
    labels: { es: 'Otro', en: 'Other', zh: '其他' },
  },
];

const PAYMENT_METHOD_LOOKUP = buildLookup(PAYMENT_METHOD_ENTRIES);

export function translatePaymentMethodLabel(
  rawMethod: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(PAYMENT_METHOD_LOOKUP, rawMethod, lang);
}

// -----------------------------------------------------------------------------
// 2. Shipping Types, Delivery Zones, Sale Channels & Order/Sale Statuses
// -----------------------------------------------------------------------------
const SHIPPING_TYPE_LOOKUP = buildLookup([
  {
    aliases: ['envío nacional', 'envio nacional', 'national shipping', '全国快递'],
    labels: { es: 'Envío Nacional', en: 'National Shipping', zh: '全国快递' },
  },
  {
    aliases: ['delivery local', 'local delivery', '同城配送'],
    labels: { es: 'Delivery Local', en: 'Local Delivery', zh: '同城配送' },
  },
  {
    aliases: ['retiro en tienda', 'store pickup', 'in-store pickup', '到店自提'],
    labels: { es: 'Retiro en Tienda', en: 'Store Pickup', zh: '到店自提' },
  },
]);

export function translateShippingTypeLabel(
  rawShipping: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(SHIPPING_TYPE_LOOKUP, rawShipping, lang);
}

const SALE_CHANNEL_LOOKUP = buildLookup([
  {
    aliases: ['carrito web', 'web cart', 'online storefront', '在线商城购物车'],
    labels: { es: 'Carrito Web', en: 'Web Cart', zh: '在线商城购物车' },
  },
  {
    aliases: ['venta directa tienda', 'direct store sale', 'in-store direct sale', '门店直接销售'],
    labels: { es: 'Venta Directa Tienda', en: 'Direct Store Sale', zh: '门店直接销售' },
  },
]);

export function translateSaleChannelLabel(
  rawChannel: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(SALE_CHANNEL_LOOKUP, rawChannel, lang);
}

const SALE_STATUS_LOOKUP = buildLookup([
  {
    aliases: ['completada', 'completed', '已完成'],
    labels: { es: 'Completada', en: 'Completed', zh: '已完成' },
  },
  {
    aliases: ['pendiente (fiado)', 'pending (credit)', '待结清 (赊账)'],
    labels: { es: 'Pendiente (Fiado)', en: 'Pending (Credit)', zh: '待结清 (赊账)' },
  },
]);

export function translateSaleStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(SALE_STATUS_LOOKUP, rawStatus, lang);
}

const ORDER_STATUS_LOOKUP = buildLookup([
  {
    aliases: ['pending', 'pendiente', '待处理'],
    labels: { es: 'Pendiente', en: 'Pending', zh: '待处理' },
  },
  {
    aliases: ['confirmed', 'confirmado', '已确认'],
    labels: { es: 'Confirmado', en: 'Confirmed', zh: '已确认' },
  },
  {
    aliases: ['shipped', 'enviado', '已发货'],
    labels: { es: 'Enviado', en: 'Shipped', zh: '已发货' },
  },
  {
    aliases: ['delivered', 'entregado', '已送达'],
    labels: { es: 'Entregado', en: 'Delivered', zh: '已送达' },
  },
  {
    aliases: ['cancelled', 'cancelado', '已取消'],
    labels: { es: 'Cancelado', en: 'Cancelled', zh: '已取消' },
  },
]);

export function translateOrderStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(ORDER_STATUS_LOOKUP, rawStatus, lang);
}

const DELIVERY_ZONE_LOOKUP = buildLookup([
  {
    aliases: ['área metropolitana', 'area metropolitana', 'metropolitan area', '大都市区'],
    labels: { es: 'Área Metropolitana', en: 'Metropolitan Area', zh: '同城大都市区' },
  },
  {
    aliases: ['local', '同城'],
    labels: { es: 'Local', en: 'Local', zh: '同城范围' },
  },
]);

export function translateDeliveryZoneLabel(
  rawZone: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(DELIVERY_ZONE_LOOKUP, rawZone, lang);
}

// -----------------------------------------------------------------------------
// 3. Units (Singular + Plural safe for ES/EN/ZH)
// -----------------------------------------------------------------------------
interface UnitEntry {
  aliases: string[];
  singular: Record<SupportedLanguage, string>;
  plural: Record<SupportedLanguage, string>;
}

const UNIT_CATALOG: UnitEntry[] = [
  {
    aliases: ['und', 'u', 'unit', 'units', 'pcs', '件'],
    singular: { es: 'und', en: 'unit', zh: '件' },
    plural: { es: 'unds', en: 'units', zh: '件' },
  },
  {
    aliases: ['unidad', 'unidades'],
    singular: { es: 'Unidad', en: 'Unit', zh: '件' },
    plural: { es: 'Unidades', en: 'Units', zh: '件' },
  },
  {
    aliases: ['prenda', 'prendas', 'garment', 'garments', '件服装'],
    singular: { es: 'Prenda', en: 'Garment', zh: '件' },
    plural: { es: 'Prendas', en: 'Garments', zh: '件' },
  },
  {
    aliases: ['par', 'pares', 'pair', 'pairs', '双'],
    singular: { es: 'Par', en: 'Pair', zh: '双' },
    plural: { es: 'Pares', en: 'Pairs', zh: '双' },
  },
  {
    aliases: ['caja', 'cajas', 'box', 'boxes', 'case', '箱'],
    singular: { es: 'Caja', en: 'Box', zh: '箱' },
    plural: { es: 'Cajas', en: 'Boxes', zh: '箱' },
  },
  {
    aliases: ['paquete', 'paquetes', 'pack', 'packs', 'package', '包'],
    singular: { es: 'Paquete', en: 'Pack', zh: '包' },
    plural: { es: 'Paquetes', en: 'Packs', zh: '包' },
  },
  {
    aliases: ['botella', 'botellas', 'bottle', 'bottles', '瓶'],
    singular: { es: 'Botella', en: 'Bottle', zh: '瓶' },
    plural: { es: 'Botellas', en: 'Bottles', zh: '瓶' },
  },
  {
    aliases: ['lata', 'latas', 'can', 'cans', '罐'],
    singular: { es: 'Lata', en: 'Can', zh: '罐' },
    plural: { es: 'Latas', en: 'Cans', zh: '罐' },
  },
  {
    aliases: ['bolsa', 'bolsas', 'bag', 'bags', '袋'],
    singular: { es: 'Bolsa', en: 'Bag', zh: '袋' },
    plural: { es: 'Bolsas', en: 'Bags', zh: '袋' },
  },
  {
    aliases: ['kg', 'kilogramo', 'kilogramos', '公斤', '千克'],
    singular: { es: 'Kg', en: 'Kg', zh: '公斤' },
    plural: { es: 'Kg', en: 'Kg', zh: '公斤' },
  },
  {
    aliases: ['litro', 'litros', 'liter', 'liters', '升'],
    singular: { es: 'Litro', en: 'Liter', zh: '升' },
    plural: { es: 'Litros', en: 'Liters', zh: '升' },
  },
  {
    aliases: ['docena', 'docenas', 'dozen', '打'],
    singular: { es: 'Docena', en: 'Dozen', zh: '打' },
    plural: { es: 'Docenas', en: 'Dozens', zh: '打' },
  },
  {
    aliases: ['pieza', 'piezas', 'piece', 'pieces', '个'],
    singular: { es: 'Pieza', en: 'Piece', zh: '个' },
    plural: { es: 'Piezas', en: 'Pieces', zh: '个' },
  },
  {
    aliases: ['juego', 'juegos', 'set', 'sets', '套'],
    singular: { es: 'Juego', en: 'Set', zh: '套' },
    plural: { es: 'Juegos', en: 'Sets', zh: '套' },
  },
];

const UNIT_LOOKUP = new Map<string, UnitEntry>();
for (const entry of UNIT_CATALOG) {
  for (const alias of entry.aliases) {
    UNIT_LOOKUP.set(alias.toLowerCase(), entry);
  }
}

export function translateUnitLabel(
  rawUnit: string | undefined | null,
  lang: SupportedLanguage,
  plural = false
): string {
  const cleaned = (rawUnit || '').trim() || 'und';
  const hit = UNIT_LOOKUP.get(cleaned.toLowerCase());
  if (hit) {
    return plural ? hit.plural[lang] || hit.plural.es : hit.singular[lang] || hit.singular.es;
  }
  return cleaned;
}

// -----------------------------------------------------------------------------
// 4. Warehouse Locations, Turnover Rates, Audits & Traceability
// -----------------------------------------------------------------------------
const WAREHOUSE_LOCATION_LOOKUP = buildLookup([
  {
    aliases: ['depósito principal', 'deposito principal', 'main warehouse', '主仓库'],
    labels: { es: 'Depósito Principal', en: 'Main Warehouse', zh: '主仓库' },
  },
  {
    aliases: ['exhibición tienda', 'exhibicion tienda', 'store display', 'shop floor', '门店展区'],
    labels: { es: 'Exhibición Tienda', en: 'Store Display', zh: '门店展区' },
  },
  {
    aliases: ['cava refrigerada', 'cold storage', '冷库'],
    labels: { es: 'Cava Refrigerada', en: 'Cold Storage', zh: '冷库' },
  },
  {
    aliases: ['cava principal', 'main cellar', '主酒窖'],
    labels: { es: 'Cava Principal', en: 'Main Cellar', zh: '主酒窖' },
  },
  {
    aliases: ['depósito seco', 'deposito seco', 'dry storage', '干货仓'],
    labels: { es: 'Depósito Seco', en: 'Dry Storage', zh: '干货仓' },
  },
  {
    aliases: ['barra', 'barra central', 'bar counter', 'main bar', '吧台区'],
    labels: { es: 'Barra Central', en: 'Main Bar', zh: '吧台区' },
  },
  {
    aliases: ['barra vip', 'vip bar', 'vip 吧台'],
    labels: { es: 'Barra VIP', en: 'VIP Bar', zh: 'VIP 吧台' },
  },
  {
    aliases: ['estantería premium', 'estanteria premium', 'premium shelving', '精品货架'],
    labels: { es: 'Estantería Premium', en: 'Premium Shelving', zh: '精品货架' },
  },
]);

export function translateWarehouseLocationLabel(
  rawLoc: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(WAREHOUSE_LOCATION_LOOKUP, rawLoc, lang);
}

const TURNOVER_RATE_LOOKUP = buildLookup([
  {
    aliases: ['alta', 'high', '高周转'],
    labels: { es: 'Alta', en: 'High', zh: '高周转' },
  },
  {
    aliases: ['media', 'medium', '中周转'],
    labels: { es: 'Media', en: 'Medium', zh: '中周转' },
  },
  {
    aliases: ['baja', 'low', '低周转'],
    labels: { es: 'Baja', en: 'Low', zh: '低周转' },
  },
]);

export function translateTurnoverRateLabel(
  rawRate: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(TURNOVER_RATE_LOOKUP, rawRate, lang);
}

const AUDIT_TYPE_LOOKUP = buildLookup([
  {
    aliases: ['merma por rotura', 'breakage shrinkage', '破损损耗'],
    labels: { es: 'Merma por Rotura', en: 'Breakage Shrinkage', zh: '破损损耗' },
  },
  {
    aliases: ['vencimiento', 'expiration', '过期损耗'],
    labels: { es: 'Vencimiento', en: 'Expiration', zh: '过期损耗' },
  },
  {
    aliases: ['desvío / pérdida', 'desvio / perdida', 'diversion / loss', '遗失/异常流失'],
    labels: { es: 'Desvío / Pérdida', en: 'Diversion / Loss', zh: '遗失 / 异常流失' },
  },
  {
    aliases: ['degustación / cortesía', 'degustacion / cortesia', 'tasting / courtesy', '试饮 / 赠品招待'],
    labels: { es: 'Degustación / Cortesía', en: 'Tasting / Courtesy', zh: '试饮 / 赠品招待' },
  },
  {
    aliases: ['ajuste físico', 'ajuste fisico', 'physical adjustment', '实物盘点调整'],
    labels: { es: 'Ajuste Físico', en: 'Physical Adjustment', zh: '实物盘点调整' },
  },
]);

export function translateAuditTypeLabel(
  rawType: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(AUDIT_TYPE_LOOKUP, rawType, lang);
}

const TRACE_STAGE_LOOKUP = buildLookup([
  {
    aliases: ['recepción proveedor', 'recepcion proveedor', 'supplier receiving', '供应商收货'],
    labels: { es: 'Recepción Proveedor', en: 'Supplier Receiving', zh: '供应商收货' },
  },
  {
    aliases: ['ingreso a cava', 'cellar intake', '入库上架'],
    labels: { es: 'Ingreso a Cava', en: 'Cellar / Storage Intake', zh: '入库上架' },
  },
  {
    aliases: ['traslado a barra', 'transfer to bar', '调拨至前台'],
    labels: { es: 'Traslado a Barra', en: 'Transfer to Floor / Bar', zh: '调拨至前台' },
  },
  {
    aliases: ['venta al consumidor', 'consumer sale', '终端销售出库'],
    labels: { es: 'Venta al Consumidor', en: 'Consumer Sale', zh: '终端销售出库' },
  },
  {
    aliases: ['auditoría / merma', 'auditoria / merma', 'audit / shrinkage', '审计 / 损耗核销'],
    labels: { es: 'Auditoría / Merma', en: 'Audit / Shrinkage', zh: '审计 / 损耗核销' },
  },
]);

export function translateTraceStageLabel(
  rawStage: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(TRACE_STAGE_LOOKUP, rawStage, lang);
}

const TRACE_STATUS_LOOKUP = buildLookup([
  {
    aliases: ['en almacén', 'en almacen', 'in warehouse', '在库'],
    labels: { es: 'En Almacén', en: 'In Warehouse', zh: '在库中' },
  },
  {
    aliases: ['en barra', 'at bar / floor', '已上架展示'],
    labels: { es: 'En Barra', en: 'On Floor / Bar', zh: '已上架前台' },
  },
  {
    aliases: ['agotado', 'depleted', 'sold out', '已售罄'],
    labels: { es: 'Agotado', en: 'Depleted', zh: '已售罄' },
  },
  {
    aliases: ['en cuarentena', 'quarantined', '隔离待检'],
    labels: { es: 'En Cuarentena', en: 'Quarantined', zh: '隔离待检' },
  },
]);

export function translateTraceStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(TRACE_STATUS_LOOKUP, rawStatus, lang);
}

// -----------------------------------------------------------------------------
// 5. Cashier, Purchases, Closing Status, Support Tickets & Size Tokens
// -----------------------------------------------------------------------------
const CASH_AND_PURCHASE_CATEGORY_LOOKUP = buildLookup([
  { aliases: ['venta', 'sale', '销售收入'], labels: { es: 'Venta', en: 'Sale', zh: '销售收入' } },
  { aliases: ['inventario', 'inventory', '库存采购'], labels: { es: 'Inventario', en: 'Inventory', zh: '库存采购' } },
  { aliases: ['servicios', 'services', '服务费用'], labels: { es: 'Servicios', en: 'Services', zh: '服务费用' } },
  { aliases: ['caja chica', 'petty cash', '备用金支出'], labels: { es: 'Caja Chica', en: 'Petty Cash', zh: '备用金' } },
  { aliases: ['nómina', 'nomina', 'payroll', '员工薪资'], labels: { es: 'Nómina', en: 'Payroll', zh: '员工薪资' } },
  { aliases: ['licores', 'spirits', '酒水类'], labels: { es: 'Licores', en: 'Spirits', zh: '酒水类' } },
  { aliases: ['víveres', 'viveres', 'groceries', '食品杂货'], labels: { es: 'Víveres', en: 'Groceries', zh: '食品杂货' } },
  { aliases: ['refrigerados', 'chilled goods', '冷藏品'], labels: { es: 'Refrigerados', en: 'Chilled Goods', zh: '冷藏品' } },
  { aliases: ['insumos', 'supplies', '耗材物料'], labels: { es: 'Insumos', en: 'Supplies', zh: '耗材物料' } },
  { aliases: ['insumos / hielo', 'supplies / ice', '物料 / 冰块'], labels: { es: 'Insumos / Hielo', en: 'Supplies / Ice', zh: '物料 / 冰块' } },
  { aliases: ['cervezas', 'beers', '啤酒'], labels: { es: 'Cervezas', en: 'Beers', zh: '啤酒' } },
  { aliases: ['otros', 'otro', 'other', '其他'], labels: { es: 'Otros', en: 'Other', zh: '其他' } },
  { aliases: ['general', '通用'], labels: { es: 'General', en: 'General', zh: '通用' } },
]);

export function translateCashOrPurchaseCategoryLabel(
  rawCategory: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(CASH_AND_PURCHASE_CATEGORY_LOOKUP, rawCategory, lang);
}

const CLOSING_STATUS_LOOKUP = buildLookup([
  { aliases: ['cuadrado', 'cuadrada', 'balanced', '平账'], labels: { es: 'Cuadrada', en: 'Balanced', zh: '平账' } },
  { aliases: ['con diferencia', 'with difference', '存在差异'], labels: { es: 'Con Diferencia', en: 'With Difference', zh: '存在差异' } },
  { aliases: ['sobrante', 'overage', '长款'], labels: { es: 'Sobrante', en: 'Overage', zh: '长款' } },
  { aliases: ['faltante', 'shortage', '短款'], labels: { es: 'Faltante', en: 'Shortage', zh: '短款' } },
]);

export function translateClosingStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(CLOSING_STATUS_LOOKUP, rawStatus, lang);
}

const TICKET_PRIORITY_LOOKUP = buildLookup([
  { aliases: ['critica', 'crítica', 'critical', '紧急'], labels: { es: 'Crítica', en: 'Critical', zh: '紧急' } },
  { aliases: ['alta', 'high', '高'], labels: { es: 'Alta', en: 'High', zh: '高' } },
  { aliases: ['media', 'medium', '中'], labels: { es: 'Media', en: 'Medium', zh: '中' } },
  { aliases: ['baja', 'low', '低'], labels: { es: 'Baja', en: 'Low', zh: '低' } },
]);

export function translateTicketPriorityLabel(
  rawPriority: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(TICKET_PRIORITY_LOOKUP, rawPriority, lang);
}

const TICKET_STATUS_LOOKUP = buildLookup([
  { aliases: ['open', 'abierto', '待处理'], labels: { es: 'Abierto', en: 'Open', zh: '待处理' } },
  { aliases: ['in_progress', 'en progreso', 'en revisión', '处理中'], labels: { es: 'En Proceso', en: 'In Progress', zh: '处理中' } },
  { aliases: ['escalated', 'escalado', '已升级'], labels: { es: 'Escalado', en: 'Escalated', zh: '已升级' } },
  { aliases: ['resolved', 'resuelto', '已解决'], labels: { es: 'Resuelto', en: 'Resolved', zh: '已解决' } },
]);

export function translateTicketStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(TICKET_STATUS_LOOKUP, rawStatus, lang);
}

const CAMPAIGN_STATUS_LOOKUP = buildLookup([
  { aliases: ['draft', 'borrador', '草稿'], labels: { es: 'Borrador', en: 'Draft', zh: '草稿' } },
  { aliases: ['sent', 'enviada', 'enviado', '已发送'], labels: { es: 'Enviada', en: 'Sent', zh: '已发送' } },
  { aliases: ['scheduled', 'programada', '已排期'], labels: { es: 'Programada', en: 'Scheduled', zh: '已排期' } },
]);

export function translateCampaignStatusLabel(
  rawStatus: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(CAMPAIGN_STATUS_LOOKUP, rawStatus, lang);
}

const SIZE_TOKEN_LOOKUP = buildLookup([
  { aliases: ['única', 'unica', 'one size', '均码'], labels: { es: 'Única', en: 'One Size', zh: '均码' } },
  { aliases: ['ajustable', 'adjustable', '可调节'], labels: { es: 'Ajustable', en: 'Adjustable', zh: '可调节' } },
]);

export function translateSizeTokenLabel(
  rawSize: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(SIZE_TOKEN_LOOKUP, rawSize, lang);
}

// -----------------------------------------------------------------------------
// 6. Default Placeholder / Unconfigured Billing Labels & Instructions
// -----------------------------------------------------------------------------
const UNCONFIGURED_BILLING_LOOKUP = buildLookup([
  {
    aliases: [
      'por configurar por el administrador (empresaalhadiqainvest@gmail.com). solicita los datos bancarios actualizados por whatsapp o espera la carga oficial.',
    ],
    labels: {
      es: 'Por configurar por el Administrador (empresaalhadiqainvest@gmail.com). Solicita los datos bancarios actualizados por WhatsApp o espera la carga oficial.',
      en: 'Pending configuration by Administrator (empresaalhadiqainvest@gmail.com). Request updated bank details via WhatsApp or wait for official update.',
      zh: '待平台管理员配置 (empresaalhadiqainvest@gmail.com)。请通过 WhatsApp 索取最新银行收款信息或等待官方更新。',
    },
  },
  {
    aliases: ['por configurar por el administrador en el panel admin.'],
    labels: {
      es: 'Por configurar por el Administrador en el Panel Admin.',
      en: 'Pending configuration by the Administrator in the Admin Panel.',
      zh: '待平台管理员在后台配置 Pago Móvil 信息。',
    },
  },
  {
    aliases: ['por configurar (binance pay id / correo usdt trc20).'],
    labels: {
      es: 'Por configurar (Binance Pay ID / Correo USDT TRC20).',
      en: 'Pending configuration (Binance Pay ID / USDT TRC20 Email).',
      zh: '待管理员配置 (Binance Pay ID / USDT TRC20 钱包)。',
    },
  },
  {
    aliases: ['por configurar (bybit uid / correo interno sin comisión).'],
    labels: {
      es: 'Por configurar (Bybit UID / Correo interno sin comisión).',
      en: 'Pending configuration (Bybit UID / Fee-free internal email).',
      zh: '待管理员配置 (Bybit UID / 免手续费内部邮箱)。',
    },
  },
]);

export function translateUnconfiguredBillingText(
  rawText: string | undefined | null,
  lang: SupportedLanguage
): string {
  const cleaned = (rawText || '').trim();
  if (!cleaned) return '';
  const hit = UNCONFIGURED_BILLING_LOOKUP.get(cleaned.toLowerCase());
  if (hit) return hit[lang] || hit.es;
  return cleaned;
}

const KNOWN_INSTRUCTION_LOOKUP = buildLookup([
  {
    aliases: [
      'transferencia bancaria nacional (pago mismo día / verificación con comprobante)',
      'national bank transfer (same-day / receipt verification)',
    ],
    labels: {
      es: 'Transferencia bancaria nacional (pago mismo día / verificación con comprobante)',
      en: 'National bank transfer (same-day / receipt verification)',
      zh: '本国银行转账（当日到账 / 凭回执核验）',
    },
  },
  {
    aliases: [
      'envía captura y número de referencia al whatsapp',
      'send screenshot and reference number via whatsapp',
      '请通过 whatsapp 发送转账截图及流水参考号',
    ],
    labels: {
      es: 'Envía captura y número de referencia al WhatsApp',
      en: 'Send screenshot and reference number via WhatsApp',
      zh: '请通过 WhatsApp 发送转账截图及流水参考号',
    },
  },
  {
    aliases: [
      'indicar billetes de baja o alta denominación al repartidor',
      'inform courier of bill denominations',
      '请告知配送员所需零钱或大额美金面额',
    ],
    labels: {
      es: 'Indicar billetes de baja o alta denominación al repartidor',
      en: 'Inform courier of bill denominations',
      zh: '请告知配送员所需现金面额以便找零',
    },
  },
  {
    aliases: [
      'transferencia directa en usd vía zelle o crypto pay sin comisiones',
      'direct usd transfer via zelle or crypto pay with zero fees',
      '通过 zelle 或加密货币免手续费直接美元转账',
    ],
    labels: {
      es: 'Transferencia directa en USD vía Zelle o Crypto Pay sin comisiones',
      en: 'Direct USD transfer via Zelle or Crypto Pay with zero fees',
      zh: '通过 Zelle 或加密货币零手续费直接支付美元',
    },
  },
  {
    aliases: [
      'pago por transferencia en moneda nacional al cambio bcv del día',
      'local currency transfer at daily bcv official rate',
      '按当日 bcv 官方汇率以本币转账支付',
    ],
    labels: {
      es: 'Pago por transferencia en moneda nacional al cambio BCV del día',
      en: 'Local currency transfer at daily BCV official rate',
      zh: '按当日 BCV 官方汇率使用本币转账',
    },
  },
]);

export function translateCommonPaymentInstruction(
  rawText: string | undefined | null,
  lang: SupportedLanguage
): string {
  return lookupLabel(KNOWN_INSTRUCTION_LOOKUP, rawText, lang);
}
