export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  stock: number;
  minStock: number;
  costUSD: number;
  priceUSD: number;
  unit: string;
  barcode: string;
  image?: string;
  description?: string;
  rating?: number;
  turnoverRate?: 'Alta' | 'Media' | 'Baja';
  batchNumber?: string;
  supplier?: string;
  location?: 'Cava Principal' | 'Barra Central' | 'Estantería Premium' | 'Depósito Seco';
  expirationDate?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'Pago Móvil' | 'Efectivo USD' | 'Efectivo Bs' | 'Punto de Venta' | 'Zelle' | 'Fiado (Crédito)';

export interface Sale {
  id: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  customerRIF?: string;
  items: CartItem[];
  subtotalUSD: number;
  subtotalBs: number;
  paymentMethod: PaymentMethod;
  exchangeRate: number;
  status: 'Completada' | 'Pendiente (Fiado)';
  // SENIAT Fiscal & IGTF fields
  baseAmountUSD?: number;
  ivaUSD?: number;
  igtfRate?: number; // 0.03 for foreign currency payments (Efectivo USD, Zelle)
  igtfAmountUSD?: number;
  totalWithIgtfUSD?: number;
  totalWithIgtfBs?: number;
  fiscalInvoiceNumber?: string;
  fiscalControlNumber?: string;
  fiscalZReportNumber?: string;
  fiscalDeviceSerial?: string;
  cashierName?: string;
}

export type FiscalPrinterBrand = 'The Factory HKA' | 'BMC / Bematech' | 'Elepunto / Epson' | 'Aclas';

export interface FiscalPrinterConfig {
  brand: FiscalPrinterBrand;
  model: string;
  serialNumber: string; // e.g. HKA0084920
  connectionType: 'USB / Serial COM' | 'TCP/IP Red' | 'Spooler Fiscal HKA';
  port: string; // e.g. COM1 or 192.168.1.150:8080
  baudRate: number;
  autoPrintInvoice: boolean;
  currentZReport: number;
  currentInvoiceNum: number;
  headerCompany: string;
  headerRIF: string;
  headerAddress: string;
}

export interface PurchaseInvoice {
  id: string;
  operationNumber: number;
  date: string;
  invoiceNumber: string;
  controlNumber: string;
  supplierName: string;
  supplierRIF: string;
  exemptAmountUSD: number;
  baseAmountUSD: number;
  ivaRate: number; // 0.16
  ivaAmountUSD: number;
  totalAmountUSD: number;
  retentionRate: number; // 0.75, 1.00, or 0
  retentionAmountUSD: number;
  category: 'Licores' | 'Cervezas' | 'Insumos / Hielo' | 'Servicios' | 'Otro';
  notes?: string;
}

export interface CashClosingRecord {
  id: string;
  closingNumber: string;
  date: string;
  timestamp: string;
  cashierName: string;
  exchangeRate: number;
  zReportNumber: string;
  byPaymentMethod: {
    [key in PaymentMethod]: {
      count: number;
      totalUSD: number;
      totalBs: number;
      igtfUSD: number;
    };
  };
  totalSalesUSD: number;
  totalSalesBs: number;
  totalBaseUSD: number;
  totalIVAUSD: number;
  totalIGTFUSD: number;
  totalIGTFBs: number;
  declaredCashUSD: number;
  declaredCashBs: number;
  expectedCashUSD: number;
  expectedCashBs: number;
  differenceUSD: number;
  differenceBs: number;
  totalTransactions: number;
  status: 'Cuadrada' | 'Con Diferencia';
  notes?: string;
}

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  balanceUSD: number;
  lastPurchaseDate: string;
  notes: string;
  history: {
    date: string;
    description: string;
    amountUSD: number;
    type: 'cargo' | 'abono';
  }[];
}

export interface CashMovement {
  id: string;
  type: 'ingreso' | 'gasto';
  category: 'Venta' | 'Inventario' | 'Servicios' | 'Caja Chica' | 'Nómina' | 'Otro';
  description: string;
  amountUSD: number;
  date: string;
}

export interface EmailAlertConfig {
  recipientEmail: string;
  secondaryEmail?: string;
  isEnabled: boolean;
  frequency: 'immediate' | 'daily';
  notifyOnPOS: boolean;
  notifyOnManualAdjustment: boolean;
}

export interface StockAlertEmailLog {
  id: string;
  timestamp: string;
  recipientEmail: string;
  subject: string;
  triggerEvent: string;
  products: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minStock: number;
    unit: string;
    costUSD: number;
  }[];
  status: 'Simulado y Enviado';
}

export type InventoryAuditType = 
  | 'Merma por Rotura' 
  | 'Vencimiento' 
  | 'Desvío / Pérdida' 
  | 'Degustación / Cortesía' 
  | 'Ajuste Físico';

export interface InventoryAuditLog {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  type: InventoryAuditType;
  quantity: number;
  unitCostUSD: number;
  totalLossUSD: number;
  totalLossBs: number;
  auditorName: string;
  location: string;
  notes: string;
}

export interface TraceabilityStep {
  stage: 'Recepción Proveedor' | 'Ingreso a Cava' | 'Traslado a Barra' | 'Venta al Consumidor' | 'Auditoría / Merma';
  timestamp: string;
  description: string;
  referenceDoc?: string;
  performedBy: string;
}

export interface ProductBatchTrace {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  supplierName: string; // e.g. "Cervecería Polar C.A.", "Ron Santa Teresa C.A.", "DUSA"
  supplierRIF: string; // e.g. "J-00041312-4"
  purchaseInvoiceNumber: string; // e.g. "FC-0049102"
  purchaseControlNumber: string;
  entryDate: string;
  expirationDate?: string;
  initialQuantity: number;
  currentQuantity: number;
  storageLocation: string;
  status: 'En Almacén' | 'En Barra' | 'Agotado' | 'En Cuarentena';
  steps: TraceabilityStep[];
}

// -----------------------------------------------------------------------------
// Multi-SaaS E-Commerce & Subscription Types
// -----------------------------------------------------------------------------

export type StoreStatus = 'pending' | 'active' | 'suspended';

export type SubscriptionPaymentMethod =
  | 'Transferencia Bancaria'
  | 'Pago Móvil'
  | 'Binance Pay'
  | 'Bybit'
  | 'Cupón Referido';

export interface PlatformBillingSettings {
  monthlyPriceUSD: number;
  bankTransfers: string;
  pagoMovil: string;
  binancePay: string;
  bybitPay: string;
  supportWhatsapp: string;
  warehousePosEnabled?: boolean;
  referralRewardUSD?: number;
  updatedAt?: unknown;
}

export interface StoreTenant {
  id: string;
  slug: string;
  ownerUid: string;
  storeName: string;
  registeredOwnerName: string;
  rif?: string;
  logoUrl?: string;
  businessWhatsapp: string;
  category?: string;
  description?: string;
  status: StoreStatus;
  subscriptionPriceUSD: number;
  nationalShippingEnabled: boolean;
  nationalCouriers?: string;
  localDeliveryEnabled: boolean;
  localDeliveryFeeUSD?: number;
  localDeliveryZone?: string;
  pickupEnabled: boolean;
  warehousePosEnabled?: boolean;
  referralCode?: string;
  referredByCode?: string;
  referredByStoreId?: string;
  referredByStoreName?: string;
  referralRewardGranted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StorePrivateAccount {
  storeId: string;
  ownerUid: string;
  ownerEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubscriptionPayment {
  id: string;
  storeId: string;
  storeName: string;
  ownerUid: string;
  ownerEmail: string;
  amountUSD: number;
  paymentMethod: SubscriptionPaymentMethod;
  referenceNumber: string;
  payerInfo?: string;
  notes?: string;
  couponId?: string;
  couponCode?: string;
  discountUSD?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReferralCodeLookup {
  code: string;
  storeId: string;
  storeName: string;
  ownerUid: string;
  createdAt?: unknown;
}

export interface StoreReferral {
  id: string;
  referrerStoreId: string;
  referrerStoreName: string;
  referrerOwnerUid: string;
  referrerCode: string;
  referredStoreId: string;
  referredStoreName: string;
  referredOwnerUid: string;
  status: 'registered' | 'rewarded';
  rewardCouponId?: string;
  rewardCouponCode?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReferralCoupon {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  ownerUid: string;
  discountUSD: number;
  sourceReferralId?: string;
  referredStoreName?: string;
  status: 'available' | 'applied' | 'redeemed';
  appliedPaymentId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type EmailDeliveryChannel = 'smtp' | 'resend' | 'cloud_inbox_mailto';

export interface AdminEmailDispatch {
  id: string;
  mode: 'individual' | 'collective';
  subject: string;
  body: string;
  recipientCount: number;
  recipientEmailsSummary: string;
  targetStoreNames?: string;
  sentByEmail: string;
  deliveryChannel: EmailDeliveryChannel;
  createdAt?: unknown;
}

export interface StoreInboxMessage {
  id: string;
  storeId: string;
  storeOwnerUid: string;
  subject: string;
  body: string;
  senderEmail: string;
  category: 'admin_email' | 'referral_reward' | 'system';
  isRead: boolean;
  createdAt?: unknown;
}

export interface StoreProduct {
  id: string;
  storeId: string;
  ownerUid: string;
  name: string;
  description: string;
  priceUSD: number;
  costUSD?: number;
  rating: number;
  reviewCount?: number;
  imageUrl?: string;
  category?: string;
  sku?: string;
  stock: number;
  minStock?: number;
  unit?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ShippingType = 'Envío Nacional' | 'Delivery Local' | 'Retiro en Tienda';

export interface StoreCartItem {
  product: StoreProduct;
  quantity: number;
}

export interface StoreOrderItem {
  id: string;
  orderId: string;
  storeId: string;
  storeOwnerUid: string;
  customerUid: string;
  productId: string;
  productName: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unitPriceUSD: number;
  unitCostUSD?: number;
  subtotalUSD: number;
}

export interface StoreOrder {
  id: string;
  storeId: string;
  storeOwnerUid: string;
  customerUid: string;
  invoiceNumber: string;
  customerName: string;
  customerRif?: string;
  customerPhone: string;
  customerEmail?: string;
  shippingType: ShippingType;
  shippingDetails?: string;
  shippingFeeUSD: number;
  paymentMethod: string;
  subtotalUSD: number;
  totalUSD: number;
  totalBs: number;
  exchangeRate: number;
  itemsSummary: string;
  itemsCount?: number;
  estimatedCostUSD?: number;
  estimatedProfitUSD?: number;
  stockDeducted?: boolean;
  saleChannel?: 'Carrito Web' | 'Venta Directa Tienda';
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

