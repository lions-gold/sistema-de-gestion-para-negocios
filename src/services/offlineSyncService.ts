import { User } from 'firebase/auth';
import {
  CashClosingRecord,
  CashMovement,
  Debtor,
  InventoryAuditLog,
  PlatformBillingSettings,
  PlatformPaymentMethod,
  Product,
  ProductBatchTrace,
  PurchaseInvoice,
  Sale,
  SalesPaymentMethod,
  ShippingType,
  StoreCartItem,
  StoreEmailConfig,
  StoreOrder,
  StorePaymentMethod,
  StoreProduct,
  StoreSubscriptionPaymentMethod,
  StoreTenant,
  VectorChatMessage,
  VectorConsentStatus,
  VectorLanguage,
  VectorRiskType,
  VectorTriggerDefinition,
} from '../types';
import { BCVRatesState } from './bcvApi';
import { readManualOfflineFlag } from '../hooks/usePWAInstall';
import { getCaracasDateString } from '../utils/venezuelaTime';
import { saveBlobResilient } from '../utils/pdfExport';
import {
  createStoreOrderInCloud,
  saveStoreProduct,
  saveStoreWarehouseLedgerInCloud,
  saveWarehouseProductInCloud,
  StoreProductInput,
  syncWarehouseProductToStorefront,
  updateWarehouseAndLinkedStorefrontStock,
  WarehouseLedgerKey,
} from './saasService';
import {
  createOrUpdateVectorTicket,
  recordVectorConversationStat,
  upsertVectorConsent,
} from './vectorService';

export type VectorVoicePreset = 'Charon' | 'Fenrir' | 'Kore' | 'Puck' | 'Zephyr';

const IDB_NAME = 'smith_solutions_offline_db';
const IDB_VERSION = 1;
const IDB_STORE = 'kv_store';

const KEYS = {
  warehouseState: 'smith_offline_warehouse_v1',
  storeWarehousePrefix: 'smith_offline_wh_store_',
  bcvRates: 'smith_offline_bcv_v1',
  storesCache: 'smith_offline_stores_v1',
  storeProductsPrefix: 'smith_offline_store_products_',
  ownerStoresPrefix: 'smith_offline_owner_stores_v1_',
  adminStores: 'smith_offline_admin_stores_v1',
  ownerOrdersPrefix: 'smith_offline_owner_orders_v1_',
  storefrontWhPrefix: 'smith_offline_wh_sf_products_v1_',
  platformBilling: 'smith_offline_platform_billing_v1',
  platformPaymentMethods: 'smith_offline_platform_payment_methods_v1',
  salesPaymentMethods: 'smith_offline_sales_payment_methods_v1',
  storePaymentMethodsPrefix: 'smith_offline_store_payment_methods_v1_',
  storeSubscriptionMethodsPrefix: 'smith_offline_store_sub_methods_v1_',
  authSnapshot: 'smith_offline_auth_snapshot_v1',
  selectedStoreId: 'smith_offline_selected_store_v1',
  vectorChats: 'smith_offline_vector_chats_v1',
  vectorVoice: 'smith_vector_voice_preset_v1',
  syncQueue: 'smith_offline_sync_queue_v1',
  leads: 'smith_offline_leads_v1',
  lastSyncAt: 'smith_offline_last_sync_v1',
};

export interface CachedAuthSnapshot {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  cachedAt: string;
}

export interface LocalWarehouseState {
  products: Product[];
  debtors: Debtor[];
  movements: CashMovement[];
  sales: Sale[];
  audits?: InventoryAuditLog[];
  traces?: ProductBatchTrace[];
  purchases?: PurchaseInvoice[];
  closings?: CashClosingRecord[];
  exchangeRate: number;
  updatedAt: string;
}

export function createEmptyWarehouseState(exchangeRate = 916.65): LocalWarehouseState {
  return {
    products: [],
    debtors: [],
    movements: [],
    sales: [],
    audits: [],
    traces: [],
    purchases: [],
    closings: [],
    exchangeRate,
    updatedAt: new Date().toISOString(),
  };
}

export interface OfflineLeadRecord {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  city?: string;
  message: string;
  createdAt: string;
}

export interface OfflineEmailPayload {
  action: 'test' | 'stock_alert' | 'sales_report';
  storeId: string;
  storeName: string;
  exchangeRate: number;
  config: StoreEmailConfig;
  triggerEvent?: string;
  products?: Product[];
  sale?: Sale;
  salesSummary?: {
    periodLabel: string;
    totalOrders: number;
    grossRevenueUSD: number;
    costOfGoodsUSD?: number;
    mermasLossUSD?: number;
    netProfitUSD?: number;
    paymentBreakdown?: Array<{ method: string; count: number; totalUSD: number }>;
    topItems?: Array<{ name: string; quantity: number; revenueUSD: number }>;
  };
}

export type OfflineQueueItem =
  | {
      id: string;
      type: 'pos_sale';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        ownerUid: string;
        storeName: string;
        sale: Sale;
        stockDeltas: Array<{
          productId: string;
          storefrontProductId?: string;
          quantitySold: number;
          nextStock: number;
        }>;
        cashMovement?: CashMovement;
        debtorSnapshot?: Debtor;
      };
    }
  | {
      id: string;
      type: 'warehouse_product_upsert';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        ownerUid: string;
        product: Product;
        publishToStore: boolean;
        store?: StoreTenant | null;
      };
    }
  | {
      id: string;
      type: 'stock_adjustment';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        product: Product;
        nextStock: number;
        delta: number;
      };
    }
  | {
      id: string;
      type: 'warehouse_ledger_sync';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        ownerUid: string;
        ledgerKey: WarehouseLedgerKey;
        entries: unknown[];
      };
    }
  | {
      id: string;
      type: 'storefront_product_upsert';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        ownerUid: string;
        input: StoreProductInput;
        existingProduct?: StoreProduct;
      };
    }
  | {
      id: string;
      type: 'marketplace_order';
      createdAt: string;
      label: string;
      payload: {
        store: StoreTenant;
        orderInput: {
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
          saleChannel?: 'Carrito Web' | 'Venta Directa Tienda';
        };
        items: StoreCartItem[];
        options?: {
          initialStatus?: 'pending' | 'confirmed' | 'completed';
          deductStockImmediately?: boolean;
        };
      };
    }
  | {
      id: string;
      type: 'email_dispatch';
      createdAt: string;
      label: string;
      payload: OfflineEmailPayload;
    }
  | {
      id: string;
      type: 'vector_consent';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        storeName: string;
        storeOwnerUid: string;
        scope: 'buyer_offers' | 'merchant_campaigns';
        status: 'si' | 'no' | 'solo_importante';
        channel: 'web_chat' | 'whatsapp' | 'email' | 'portal';
      };
    }
  | {
      id: string;
      type: 'vector_ticket';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        storeName: string;
        storeOwnerUid: string;
        channel: 'web_chat' | 'whatsapp' | 'instagram' | 'email';
        language: VectorLanguage;
        trigger: VectorTriggerDefinition;
        summary: string;
        botAttempts: number;
        lastProposal: string;
        offerConsent: VectorConsentStatus;
        risk: VectorRiskType;
        threadId: string;
      };
    }
  | {
      id: string;
      type: 'vector_stat';
      createdAt: string;
      label: string;
      payload: {
        storeId: string;
        storeOwnerUid: string;
        language: VectorLanguage;
        turnsCount: number;
        botAttemptsOnIssue: number;
        containedByBot: boolean;
        escalated: boolean;
        triggerId?: number;
      };
    };

export interface OfflinePendingSaleSummary {
  id: string;
  receiptNumber: string;
  date: string;
  storeName: string;
  customerName: string;
  itemsCount: number;
  itemsSummary: string;
  totalUSD: number;
  paymentMethod: string;
  source: 'POS Almacén' | 'Tienda Online / Directa';
}

export interface OfflineDataSummary {
  totalQueueCount: number;
  pendingSoldProductsCount: number;
  pendingSoldUnitsCount: number;
  pendingSoldUSD: number;
  pendingSalesList: OfflinePendingSaleSummary[];
  pendingInventoryOpsCount: number;
  pendingEmailsCount: number;
  pendingOtherOpsCount: number;
  leadsCount: number;
  cachedStoresCount: number;
  cachedProductsTotalCount: number;
  cachedWarehousesCount: number;
  hasCachedBcv: boolean;
  cachedBcvValue: number | null;
  lastSyncAt: string | null;
  indexedDbReady: boolean;
}

type QueueListener = (queue: OfflineQueueItem[]) => void;
const listeners = new Set<QueueListener>();

// In-memory mirror populated from both localStorage and IndexedDB for instant reads
const memoryCache = new Map<string, unknown>();
let idbAvailable = false;
let idbPromise: Promise<IDBDatabase | null> | null = null;

function openOfflineDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        idbAvailable = true;
        resolve(req.result);
      };
      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllEntries(): Promise<Array<[string, unknown]>> {
  const db = await openOfflineDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const entries: Array<[string, unknown]> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          entries.push([String(cursor.key), cursor.value]);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
      cursorReq.onerror = () => resolve(entries);
    } catch {
      resolve([]);
    }
  });
}

let hydrationDonePromise: Promise<void> | null = null;

/**
 * Restores IndexedDB snapshots into memory and localStorage on boot so data persists
 * cleanly even if catalogs or sales histories exceed localStorage quota.
 */
export function hydrateOfflineStoreFromIDB(): Promise<void> {
  if (hydrationDonePromise) return hydrationDonePromise;
  hydrationDonePromise = (async () => {
    const entries = await idbGetAllEntries();
    if (entries.length === 0) return;

    let queueRestored = false;
    for (const [key, val] of entries) {
      if (!memoryCache.has(key)) {
        memoryCache.set(key, val);
      }
      if (typeof window !== 'undefined') {
        try {
          if (!localStorage.getItem(key) && val !== undefined && val !== null) {
            localStorage.setItem(key, JSON.stringify(val));
            if (key === KEYS.syncQueue || key === KEYS.leads) {
              queueRestored = true;
            }
          }
        } catch {
          // Quota full in localStorage; keep in memoryCache + IDB
        }
      }
    }

    if (queueRestored) {
      notifyQueueListeners();
    }
  })();
  return hydrationDonePromise;
}

if (typeof window !== 'undefined') {
  openOfflineDB().then(() => hydrateOfflineStoreFromIDB());
}

function stripLargeImagesForLocalStorage(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripLargeImagesForLocalStorage(item));
  }
  const obj = value as Record<string, unknown>;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (
      (k === 'image' || k === 'imageUrl' || k === 'logoUrl' || k === 'proofImageUrl') &&
      typeof v === 'string' &&
      v.startsWith('data:image/') &&
      v.length > 8000
    ) {
      clone[k] = '';
    } else if (v && typeof v === 'object') {
      clone[k] = stripLargeImagesForLocalStorage(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

function safeReadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  if (memoryCache.has(key)) {
    const mem = memoryCache.get(key);
    if (mem !== undefined) return mem as T;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  memoryCache.set(key, value);
  idbSet(key, value).catch(() => {});
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Fallback: strip bulky inline dataURLs for localStorage while IndexedDB keeps full payload
    try {
      const compact = stripLargeImagesForLocalStorage(value);
      localStorage.setItem(key, JSON.stringify(compact));
    } catch {
      // IndexedDB still holds the authoritative copy
    }
  }
}

function safeRemoveKey(key: string): void {
  if (typeof window === 'undefined') return;
  memoryCache.delete(key);
  idbDelete(key).catch(() => {});
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function notifyQueueListeners(): void {
  const current = getOfflineQueue();
  listeners.forEach((cb) => cb(current));
}

// -----------------------------------------------------------------------------
// Connectivity & Network Error Detection
// -----------------------------------------------------------------------------

export function isAppEffectivelyOffline(): boolean {
  if (readManualOfflineFlag()) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return false;
}

export function isNetworkOrOfflineError(err: unknown): boolean {
  if (isAppEffectivelyOffline()) return true;
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('err_internet_disconnected')
  );
}

// -----------------------------------------------------------------------------
// Generalized Platform Caches (Auth Snapshot, Billing, Stores, Orders, Catalogs)
// -----------------------------------------------------------------------------

export function saveCachedAuthSnapshot(snapshot: CachedAuthSnapshot): void {
  safeWriteJSON(KEYS.authSnapshot, snapshot);
}

export function loadCachedAuthSnapshot(): CachedAuthSnapshot | null {
  return safeReadJSON<CachedAuthSnapshot | null>(KEYS.authSnapshot, null);
}

export function clearCachedAuthSnapshot(): void {
  safeRemoveKey(KEYS.authSnapshot);
  safeRemoveKey(KEYS.selectedStoreId);
  safeRemoveKey(KEYS.adminStores);
}

export function saveCachedPlatformBilling(settings: PlatformBillingSettings): void {
  safeWriteJSON(KEYS.platformBilling, settings);
}

export function loadCachedPlatformBilling(): PlatformBillingSettings | null {
  return safeReadJSON<PlatformBillingSettings | null>(KEYS.platformBilling, null);
}

export function saveCachedOwnerStores(ownerUid: string, stores: StoreTenant[]): void {
  if (!ownerUid) return;
  safeWriteJSON(`${KEYS.ownerStoresPrefix}${ownerUid}`, stores);
}

export function loadCachedOwnerStores(ownerUid: string): StoreTenant[] {
  if (!ownerUid) return [];
  return safeReadJSON<StoreTenant[]>(`${KEYS.ownerStoresPrefix}${ownerUid}`, []);
}

export function saveCachedAdminStores(stores: StoreTenant[]): void {
  safeWriteJSON(KEYS.adminStores, stores);
}

export function loadCachedAdminStores(): StoreTenant[] {
  return safeReadJSON<StoreTenant[]>(KEYS.adminStores, []);
}

export function saveSelectedWarehouseStoreId(storeId: string): void {
  if (!storeId) return;
  safeWriteJSON(KEYS.selectedStoreId, storeId);
}

export function loadSelectedWarehouseStoreId(): string {
  return safeReadJSON<string>(KEYS.selectedStoreId, '');
}

export function saveCachedOwnerStoreOrders(storeId: string, orders: StoreOrder[]): void {
  if (!storeId) return;
  safeWriteJSON(`${KEYS.ownerOrdersPrefix}${storeId}`, orders.slice(0, 250));
}

export function loadCachedOwnerStoreOrders(storeId: string): StoreOrder[] {
  if (!storeId) return [];
  return safeReadJSON<StoreOrder[]>(`${KEYS.ownerOrdersPrefix}${storeId}`, []);
}

export function saveCachedStorefrontWarehouseProducts(
  storeId: string,
  products: StoreProduct[]
): void {
  if (!storeId) return;
  safeWriteJSON(`${KEYS.storefrontWhPrefix}${storeId}`, products);
}

export function loadCachedStorefrontWarehouseProducts(storeId: string): StoreProduct[] {
  if (!storeId) return [];
  return safeReadJSON<StoreProduct[]>(`${KEYS.storefrontWhPrefix}${storeId}`, []);
}

// -----------------------------------------------------------------------------
// Warehouse / POS Local Persistence (Strictly Isolated Per Store)
// -----------------------------------------------------------------------------

export function loadLocalWarehouseState(storeId?: string): LocalWarehouseState | null {
  if (storeId) {
    return safeReadJSON<LocalWarehouseState | null>(
      `${KEYS.storeWarehousePrefix}${storeId}_v2`,
      null
    );
  }
  return safeReadJSON<LocalWarehouseState | null>(KEYS.warehouseState, null);
}

export function saveLocalWarehouseState(
  state: Omit<LocalWarehouseState, 'updatedAt'>,
  storeId?: string
): void {
  const payload = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  if (storeId) {
    safeWriteJSON(`${KEYS.storeWarehousePrefix}${storeId}_v2`, payload);
    return;
  }
  safeWriteJSON(KEYS.warehouseState, payload);
}

export function getStoreWarehouseState(storeId: string, fallbackRate = 916.65): LocalWarehouseState {
  const existing = loadLocalWarehouseState(storeId);
  if (existing) {
    return {
      ...createEmptyWarehouseState(fallbackRate),
      ...existing,
      products: Array.isArray(existing.products) ? existing.products : [],
      debtors: Array.isArray(existing.debtors) ? existing.debtors : [],
      movements: Array.isArray(existing.movements) ? existing.movements : [],
      sales: Array.isArray(existing.sales) ? existing.sales : [],
      audits: Array.isArray(existing.audits) ? existing.audits : [],
      traces: Array.isArray(existing.traces) ? existing.traces : [],
      purchases: Array.isArray(existing.purchases) ? existing.purchases : [],
      closings: Array.isArray(existing.closings) ? existing.closings : [],
    };
  }
  return createEmptyWarehouseState(fallbackRate);
}

// -----------------------------------------------------------------------------
// BCV Rate Offline Cache
// -----------------------------------------------------------------------------

export function loadCachedBcvRates(): BCVRatesState | null {
  return safeReadJSON<BCVRatesState | null>(KEYS.bcvRates, null);
}

export function saveCachedBcvRates(rates: BCVRatesState): void {
  safeWriteJSON(KEYS.bcvRates, rates);
}

// -----------------------------------------------------------------------------
// Active Stores & Catalog Offline Cache
// -----------------------------------------------------------------------------

export function saveCachedStores(stores: StoreTenant[]): void {
  safeWriteJSON(KEYS.storesCache, stores);
}

export function loadCachedStores(): StoreTenant[] {
  return safeReadJSON<StoreTenant[]>(KEYS.storesCache, []);
}

export function saveCachedStoreProducts(storeId: string, products: StoreProduct[]): void {
  if (!storeId) return;
  safeWriteJSON(`${KEYS.storeProductsPrefix}${storeId}`, products);
}

export function loadCachedStoreProducts(storeId: string): StoreProduct[] {
  if (!storeId) return [];
  return safeReadJSON<StoreProduct[]>(`${KEYS.storeProductsPrefix}${storeId}`, []);
}

export function saveCachedPlatformPaymentMethods(methods: PlatformPaymentMethod[]): void {
  safeWriteJSON(KEYS.platformPaymentMethods, methods);
}

export function loadCachedPlatformPaymentMethods(): PlatformPaymentMethod[] {
  return safeReadJSON<PlatformPaymentMethod[]>(KEYS.platformPaymentMethods, []);
}

export function saveCachedSalesPaymentMethods(methods: SalesPaymentMethod[]): void {
  safeWriteJSON(KEYS.salesPaymentMethods, methods);
}

export function loadCachedSalesPaymentMethods(): SalesPaymentMethod[] {
  return safeReadJSON<SalesPaymentMethod[]>(KEYS.salesPaymentMethods, []);
}

export function saveCachedStorePaymentMethods(storeId: string, methods: StorePaymentMethod[]): void {
  if (!storeId) return;
  safeWriteJSON(`${KEYS.storePaymentMethodsPrefix}${storeId}`, methods);
}

export function loadCachedStorePaymentMethods(storeId: string): StorePaymentMethod[] {
  if (!storeId) return [];
  return safeReadJSON<StorePaymentMethod[]>(`${KEYS.storePaymentMethodsPrefix}${storeId}`, []);
}

export function saveCachedStoreSubscriptionMethods(
  storeId: string,
  methods: StoreSubscriptionPaymentMethod[]
): void {
  if (!storeId) return;
  safeWriteJSON(`${KEYS.storeSubscriptionMethodsPrefix}${storeId}`, methods);
}

export function loadCachedStoreSubscriptionMethods(
  storeId: string
): StoreSubscriptionPaymentMethod[] {
  if (!storeId) return [];
  return safeReadJSON<StoreSubscriptionPaymentMethod[]>(
    `${KEYS.storeSubscriptionMethodsPrefix}${storeId}`,
    []
  );
}

/**
 * Updates cached public StoreProduct stock locally after an offline checkout or direct sale.
 */
export function applyOfflineOrderStockToCache(
  storeId: string,
  items: StoreCartItem[]
): StoreProduct[] {
  if (!storeId || items.length === 0) return loadCachedStoreProducts(storeId);
  const current = loadCachedStoreProducts(storeId);
  if (current.length === 0) return current;

  const updated = current.map((p) => {
    const sold = items.find((i) => i.product.id === p.id);
    if (!sold) return p;
    return {
      ...p,
      stock: Math.max(0, (Number(p.stock) || 0) - sold.quantity),
      updatedAt: new Date().toISOString(),
    };
  });
  saveCachedStoreProducts(storeId, updated);
  return updated;
}

// -----------------------------------------------------------------------------
// Vector Local Chat Persistence & Voice Preset
// -----------------------------------------------------------------------------

export function loadCachedVectorMessages(): Record<string, VectorChatMessage[]> {
  return safeReadJSON<Record<string, VectorChatMessage[]>>(KEYS.vectorChats, {});
}

export function saveCachedVectorMessages(chats: Record<string, VectorChatMessage[]>): void {
  const trimmed: Record<string, VectorChatMessage[]> = {};
  Object.entries(chats).forEach(([k, arr]) => {
    trimmed[k] = arr.slice(-40);
  });
  safeWriteJSON(KEYS.vectorChats, trimmed);
}

export function loadVectorVoicePreset(): VectorVoicePreset {
  if (typeof window === 'undefined') return 'Charon';
  try {
    const raw = localStorage.getItem(KEYS.vectorVoice);
    if (
      raw === 'Charon' ||
      raw === 'Fenrir' ||
      raw === 'Kore' ||
      raw === 'Puck' ||
      raw === 'Zephyr'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'Charon';
}

export function saveVectorVoicePreset(preset: VectorVoicePreset): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS.vectorVoice, preset);
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Local Contact Leads & Generalized Sync Queue
// -----------------------------------------------------------------------------

export function saveOfflineLead(lead: Omit<OfflineLeadRecord, 'id' | 'createdAt'>): OfflineLeadRecord {
  const existing = safeReadJSON<OfflineLeadRecord[]>(KEYS.leads, []);
  const record: OfflineLeadRecord = {
    ...lead,
    id: `lead-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  safeWriteJSON(KEYS.leads, [record, ...existing].slice(0, 100));
  notifyQueueListeners();
  return record;
}

export function loadOfflineLeads(): OfflineLeadRecord[] {
  return safeReadJSON<OfflineLeadRecord[]>(KEYS.leads, []);
}

export function getOfflineQueue(): OfflineQueueItem[] {
  return safeReadJSON<OfflineQueueItem[]>(KEYS.syncQueue, []);
}

export function subscribeOfflineQueue(cb: QueueListener): () => void {
  listeners.add(cb);
  cb(getOfflineQueue());
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.syncQueue || e.key === KEYS.leads) {
      cb(getOfflineQueue());
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

export function queueOfflineMutation(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>): OfflineQueueItem {
  const existing = getOfflineQueue();
  const created = {
    ...item,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  } as OfflineQueueItem;

  // Deduplicate ledger snapshots per (storeId, ledgerKey) to keep queue compact and latest-wins
  let filtered = existing;
  if (created.type === 'warehouse_ledger_sync') {
    filtered = existing.filter(
      (q) =>
        !(
          q.type === 'warehouse_ledger_sync' &&
          q.payload.storeId === created.payload.storeId &&
          q.payload.ledgerKey === created.payload.ledgerKey
        )
    );
  } else if (created.type === 'pos_sale') {
    // Prevent duplicate queuing of the exact same receipt/sale id
    filtered = existing.filter(
      (q) => !(q.type === 'pos_sale' && q.payload.sale.id === created.payload.sale.id)
    );
  } else if (created.type === 'stock_adjustment') {
    filtered = existing.filter(
      (q) =>
        !(
          q.type === 'stock_adjustment' &&
          q.payload.storeId === created.payload.storeId &&
          q.payload.product.id === created.payload.product.id
        )
    );
  }

  safeWriteJSON(KEYS.syncQueue, [...filtered, created]);
  notifyQueueListeners();
  return created;
}

export function removeOfflineQueueItem(id: string): void {
  const remaining = getOfflineQueue().filter((item) => item.id !== id);
  safeWriteJSON(KEYS.syncQueue, remaining);
  notifyQueueListeners();
}

export function getLastSyncTimestamp(): string | null {
  if (typeof window === 'undefined') return null;
  const mem = memoryCache.get(KEYS.lastSyncAt);
  if (typeof mem === 'string') return mem;
  try {
    return localStorage.getItem(KEYS.lastSyncAt);
  } catch {
    return null;
  }
}

export function createLocalOfflineOrderSnapshot(
  store: StoreTenant,
  orderInput: {
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
    saleChannel?: 'Carrito Web' | 'Venta Directa Tienda';
  },
  items: StoreCartItem[],
  customerUid = 'offline_local_user',
  status: StoreOrder['status'] = 'pending'
): StoreOrder {
  const itemsCount = items.reduce((a, i) => a + i.quantity, 0);
  const estimatedCostUSD = Number(
    items.reduce((acc, it) => acc + (it.product.costUSD || 0) * it.quantity, 0).toFixed(2)
  );
  const estimatedProfitUSD = Number(
    (Math.max(0, Number(orderInput.subtotalUSD) || 0) - estimatedCostUSD).toFixed(2)
  );

  return {
    id: `offline-ord-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    storeId: store.id,
    storeOwnerUid: store.ownerUid,
    customerUid,
    invoiceNumber: orderInput.invoiceNumber,
    customerName: orderInput.customerName,
    customerRif: orderInput.customerRif,
    customerPhone: orderInput.customerPhone,
    customerEmail: orderInput.customerEmail,
    shippingType: orderInput.shippingType,
    shippingDetails: orderInput.shippingDetails,
    shippingFeeUSD: orderInput.shippingFeeUSD,
    paymentMethod: orderInput.paymentMethod,
    subtotalUSD: orderInput.subtotalUSD,
    totalUSD: orderInput.totalUSD,
    totalBs: orderInput.totalBs,
    exchangeRate: orderInput.exchangeRate,
    itemsSummary: orderInput.itemsSummary,
    itemsCount,
    estimatedCostUSD,
    estimatedProfitUSD,
    stockDeducted: status === 'completed',
    saleChannel: orderInput.saleChannel || 'Carrito Web',
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

let isSyncRunning = false;

export async function syncPendingOfflineActions(user: User | null): Promise<{
  synced: number;
  remaining: number;
  requiresAuth: boolean;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0, requiresAuth: false };
  }
  if (isAppEffectivelyOffline()) {
    return { synced: 0, remaining: queue.length, requiresAuth: false };
  }
  if (!user || !user.emailVerified) {
    return { synced: 0, remaining: queue.length, requiresAuth: true };
  }
  if (isSyncRunning) {
    return { synced: 0, remaining: queue.length, requiresAuth: false };
  }

  isSyncRunning = true;
  let synced = 0;
  const failedItems: OfflineQueueItem[] = [];

  try {
    for (const item of queue) {
      try {
        if (item.type === 'pos_sale') {
          const { storeId, ownerUid, sale, stockDeltas, cashMovement, debtorSnapshot } =
            item.payload;
          const localWh = getStoreWarehouseState(storeId);
          // Merge sold receipt idempotently into store's warehouse sales ledger
          const mergedSales = localWh.sales.some((s) => s.id === sale.id)
            ? localWh.sales
            : [sale, ...localWh.sales];
          await saveStoreWarehouseLedgerInCloud(storeId, ownerUid, 'sales', mergedSales);

          if (cashMovement) {
            const mergedMovs = localWh.movements.some((m) => m.id === cashMovement.id)
              ? localWh.movements
              : [cashMovement, ...localWh.movements];
            await saveStoreWarehouseLedgerInCloud(storeId, ownerUid, 'movements', mergedMovs);
          }

          if (debtorSnapshot) {
            const mergedDebtors = localWh.debtors.some((d) => d.id === debtorSnapshot.id)
              ? localWh.debtors.map((d) => (d.id === debtorSnapshot.id ? debtorSnapshot : d))
              : [debtorSnapshot, ...localWh.debtors];
            await saveStoreWarehouseLedgerInCloud(storeId, ownerUid, 'debtors', mergedDebtors);
          }

          // Replay stock deductions against Warehouse & linked Storefront products
          for (const delta of stockDeltas) {
            const matchedProduct =
              localWh.products.find((p) => p.id === delta.productId) ||
              ({
                id: delta.productId,
                storefrontProductId: delta.storefrontProductId,
              } as Product);
            await updateWarehouseAndLinkedStorefrontStock(
              storeId,
              matchedProduct,
              matchedProduct.stock !== undefined ? matchedProduct.stock : delta.nextStock
            );
          }
          synced += 1;
        } else if (item.type === 'warehouse_product_upsert') {
          const { storeId, ownerUid, product, publishToStore, store } = item.payload;
          await saveWarehouseProductInCloud(storeId, ownerUid, product);
          if (publishToStore && store) {
            await syncWarehouseProductToStorefront(store, ownerUid, product);
          }
          synced += 1;
        } else if (item.type === 'stock_adjustment') {
          const { storeId, product, nextStock } = item.payload;
          await updateWarehouseAndLinkedStorefrontStock(storeId, product, nextStock);
          synced += 1;
        } else if (item.type === 'warehouse_ledger_sync') {
          const { storeId, ownerUid, ledgerKey, entries } = item.payload;
          await saveStoreWarehouseLedgerInCloud(storeId, ownerUid, ledgerKey, entries);
          synced += 1;
        } else if (item.type === 'storefront_product_upsert') {
          const { storeId, ownerUid, input, existingProduct } = item.payload;
          await saveStoreProduct(storeId, ownerUid, input, existingProduct);
          synced += 1;
        } else if (item.type === 'marketplace_order') {
          await createStoreOrderInCloud(
            user,
            item.payload.store,
            item.payload.orderInput,
            item.payload.items,
            item.payload.options
          );
          synced += 1;
        } else if (item.type === 'email_dispatch') {
          const { dispatchStoreEmail } = await import('./emailDeliveryService');
          const res = await dispatchStoreEmail(item.payload);
          if (!res.ok) {
            throw new Error(res.message || 'No se pudo enviar el correo en cola');
          }
          synced += 1;
        } else if (item.type === 'vector_consent') {
          await upsertVectorConsent({
            user,
            ...item.payload,
          });
          synced += 1;
        } else if (item.type === 'vector_ticket') {
          await createOrUpdateVectorTicket({
            user,
            ...item.payload,
          });
          synced += 1;
        } else if (item.type === 'vector_stat') {
          await recordVectorConversationStat({
            user,
            ...item.payload,
          });
          synced += 1;
        }
      } catch (err) {
        console.warn(`Error sincronizando elemento offline (${item.type}):`, err);
        failedItems.push(item);
      }
    }

    safeWriteJSON(KEYS.syncQueue, failedItems);
    if (synced > 0 && typeof window !== 'undefined') {
      const nowIso = new Date().toISOString();
      memoryCache.set(KEYS.lastSyncAt, nowIso);
      idbSet(KEYS.lastSyncAt, nowIso).catch(() => {});
      try {
        localStorage.setItem(KEYS.lastSyncAt, nowIso);
      } catch {
        // ignore
      }
    }
    notifyQueueListeners();
    return { synced, remaining: failedItems.length, requiresAuth: false };
  } finally {
    isSyncRunning = false;
  }
}

export function getAllCachedStoreWarehouseStates(): Record<string, LocalWarehouseState> {
  const result: Record<string, LocalWarehouseState> = {};
  for (const [k, val] of memoryCache.entries()) {
    if (k.startsWith(KEYS.storeWarehousePrefix) && val && typeof val === 'object') {
      const cleanId = k.replace(KEYS.storeWarehousePrefix, '').replace(/_v2$/, '');
      result[cleanId] = val as LocalWarehouseState;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEYS.storeWarehousePrefix)) {
          const cleanId = key.replace(KEYS.storeWarehousePrefix, '').replace(/_v2$/, '');
          if (!result[cleanId]) {
            const parsed = loadLocalWarehouseState(cleanId);
            if (parsed) result[cleanId] = parsed;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return result;
}

export function getAllCachedStoreCatalogs(): Record<string, StoreProduct[]> {
  const result: Record<string, StoreProduct[]> = {};
  for (const [k, val] of memoryCache.entries()) {
    if (k.startsWith(KEYS.storeProductsPrefix) && Array.isArray(val)) {
      const cleanId = k.replace(KEYS.storeProductsPrefix, '');
      result[cleanId] = val as StoreProduct[];
    }
  }
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEYS.storeProductsPrefix)) {
          const cleanId = key.replace(KEYS.storeProductsPrefix, '');
          if (!result[cleanId]) {
            const parsed = loadCachedStoreProducts(cleanId);
            if (parsed.length > 0) result[cleanId] = parsed;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return result;
}

export function getOfflineDataSummary(): OfflineDataSummary {
  const queue = getOfflineQueue();
  const pendingSalesList: OfflinePendingSaleSummary[] = [];
  let pendingSoldUnitsCount = 0;
  let pendingSoldUSD = 0;
  let pendingInventoryOpsCount = 0;
  let pendingEmailsCount = 0;
  let pendingOtherOpsCount = 0;

  queue.forEach((item) => {
    if (item.type === 'pos_sale') {
      const { sale, storeName } = item.payload;
      const units = sale.items.reduce((acc, it) => acc + it.quantity, 0);
      const amountUSD = Number(sale.totalWithIgtfUSD || sale.subtotalUSD || 0);
      pendingSoldUnitsCount += units;
      pendingSoldUSD += amountUSD;
      pendingSalesList.push({
        id: item.id,
        receiptNumber: sale.receiptNumber,
        date: sale.date,
        storeName: storeName || 'Almacén & POS',
        customerName: sale.customerName,
        itemsCount: units,
        itemsSummary: sale.items
          .map((i) => `${i.quantity}x ${i.product.name}`)
          .join(', '),
        totalUSD: amountUSD,
        paymentMethod: sale.paymentMethod,
        source: 'POS Almacén',
      });
    } else if (item.type === 'marketplace_order') {
      const { store, orderInput, items } = item.payload;
      const units = items.reduce((acc, it) => acc + it.quantity, 0);
      pendingSoldUnitsCount += units;
      pendingSoldUSD += Number(orderInput.totalUSD || 0);
      pendingSalesList.push({
        id: item.id,
        receiptNumber: orderInput.invoiceNumber,
        date: item.createdAt.replace('T', ' ').slice(0, 16),
        storeName: store.storeName,
        customerName: orderInput.customerName,
        itemsCount: units,
        itemsSummary: orderInput.itemsSummary,
        totalUSD: Number(orderInput.totalUSD || 0),
        paymentMethod: orderInput.paymentMethod,
        source: 'Tienda Online / Directa',
      });
    } else if (
      item.type === 'stock_adjustment' ||
      item.type === 'warehouse_product_upsert' ||
      item.type === 'warehouse_ledger_sync' ||
      item.type === 'storefront_product_upsert'
    ) {
      pendingInventoryOpsCount += 1;
    } else if (item.type === 'email_dispatch') {
      pendingEmailsCount += 1;
    } else {
      pendingOtherOpsCount += 1;
    }
  });

  const cachedStores = loadCachedStores();
  const catalogs = getAllCachedStoreCatalogs();
  const warehouses = getAllCachedStoreWarehouseStates();
  const bcv = loadCachedBcvRates();

  let cachedProductsTotalCount = Object.values(catalogs).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  Object.values(warehouses).forEach((wh) => {
    cachedProductsTotalCount += wh.products.length;
  });

  return {
    totalQueueCount: queue.length,
    pendingSoldProductsCount: pendingSalesList.length,
    pendingSoldUnitsCount,
    pendingSoldUSD: Number(pendingSoldUSD.toFixed(2)),
    pendingSalesList: pendingSalesList.reverse(),
    pendingInventoryOpsCount,
    pendingEmailsCount,
    pendingOtherOpsCount,
    leadsCount: loadOfflineLeads().length,
    cachedStoresCount: cachedStores.length,
    cachedProductsTotalCount,
    cachedWarehousesCount: Object.keys(warehouses).length,
    hasCachedBcv: Boolean(bcv && bcv.bcv > 0),
    cachedBcvValue: bcv?.bcv ?? null,
    lastSyncAt: getLastSyncTimestamp(),
    indexedDbReady: idbAvailable,
  };
}

export function exportOfflineSalesCSV(): void {
  const summary = getOfflineDataSummary();
  const warehouses = getAllCachedStoreWarehouseStates();

  const headers = [
    'origen',
    'estado_sincronizacion',
    'tienda',
    'recibo_o_factura',
    'fecha',
    'cliente',
    'unidades',
    'productos_vendidos',
    'metodo_pago',
    'total_usd',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows: string[] = [];

  summary.pendingSalesList.forEach((s) => {
    rows.push(
      [
        esc(s.source),
        esc('Pendiente por Sincronizar'),
        esc(s.storeName),
        esc(s.receiptNumber),
        esc(s.date),
        esc(s.customerName),
        esc(s.itemsCount),
        esc(s.itemsSummary),
        esc(s.paymentMethod),
        esc(s.totalUSD.toFixed(2)),
      ].join(',')
    );
  });

  Object.entries(warehouses).forEach(([storeId, wh]) => {
    wh.sales.forEach((sale) => {
      if (summary.pendingSalesList.some((p) => p.receiptNumber === sale.receiptNumber)) return;
      const units = sale.items.reduce((acc, it) => acc + it.quantity, 0);
      const itemsText = sale.items.map((i) => `${i.quantity}x ${i.product.name}`).join(' | ');
      rows.push(
        [
          esc('Almacén Local Cacheado'),
          esc('Guardado Localmente'),
          esc(storeId),
          esc(sale.receiptNumber),
          esc(sale.date),
          esc(sale.customerName),
          esc(units),
          esc(itemsText),
          esc(sale.paymentMethod),
          esc((sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)),
        ].join(',')
      );
    });
  });

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveBlobResilient(
    blob,
    `smith_ventas_offline_${getCaracasDateString()}.csv`,
    'text/csv;charset=utf-8'
  );
}

export function exportOfflineBackupJSON(): void {
  const backup = {
    exportedAt: new Date().toISOString(),
    platform: 'Smith Solutions E-Commerce Offline Backup',
    offlineModeManual: readManualOfflineFlag(),
    authSnapshot: loadCachedAuthSnapshot(),
    platformBilling: loadCachedPlatformBilling(),
    bcvRates: loadCachedBcvRates(),
    stores: loadCachedStores(),
    storeCatalogs: getAllCachedStoreCatalogs(),
    warehousesByStore: getAllCachedStoreWarehouseStates(),
    legacyWarehouse: loadLocalWarehouseState(),
    pendingQueue: getOfflineQueue(),
    leads: loadOfflineLeads(),
    lastSyncAt: getLastSyncTimestamp(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  saveBlobResilient(
    blob,
    `smith_solutions_respaldo_offline_${getCaracasDateString()}.json`,
    'application/json'
  );
}
