import { User } from 'firebase/auth';
import {
  CashClosingRecord,
  CashMovement,
  Debtor,
  InventoryAuditLog,
  Product,
  ProductBatchTrace,
  PurchaseInvoice,
  Sale,
  ShippingType,
  StoreCartItem,
  StoreOrder,
  StoreProduct,
  StoreTenant,
  VectorChatMessage,
  VectorConsentStatus,
  VectorLanguage,
  VectorRiskType,
  VectorTriggerDefinition,
} from '../types';
import { BCVRatesState } from './bcvApi';
import { createStoreOrderInCloud } from './saasService';
import {
  createOrUpdateVectorTicket,
  recordVectorConversationStat,
  upsertVectorConsent,
} from './vectorService';

export type VectorVoicePreset = 'Charon' | 'Fenrir' | 'Kore';

const KEYS = {
  warehouseState: 'smith_offline_warehouse_v1',
  storeWarehousePrefix: 'smith_offline_wh_store_',
  bcvRates: 'smith_offline_bcv_v1',
  storesCache: 'smith_offline_stores_v1',
  storeProductsPrefix: 'smith_offline_store_products_',
  vectorChats: 'smith_offline_vector_chats_v1',
  vectorVoice: 'smith_vector_voice_preset_v1',
  syncQueue: 'smith_offline_sync_queue_v1',
  leads: 'smith_offline_leads_v1',
  lastSyncAt: 'smith_offline_last_sync_v1',
};

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

export function createEmptyWarehouseState(exchangeRate = 896.12): LocalWarehouseState {
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

export type OfflineQueueItem =
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
      };
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

type QueueListener = (queue: OfflineQueueItem[]) => void;
const listeners = new Set<QueueListener>();

function safeReadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors gracefully
  }
}

function notifyQueueListeners(): void {
  const current = getOfflineQueue();
  listeners.forEach((cb) => cb(current));
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

export function getStoreWarehouseState(storeId: string, fallbackRate = 896.12): LocalWarehouseState {
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
  // Cap large data:URLs only if needed; localStorage handles moderate catalogs cleanly
  safeWriteJSON(`${KEYS.storeProductsPrefix}${storeId}`, products);
}

export function loadCachedStoreProducts(storeId: string): StoreProduct[] {
  if (!storeId) return [];
  return safeReadJSON<StoreProduct[]>(`${KEYS.storeProductsPrefix}${storeId}`, []);
}

// -----------------------------------------------------------------------------
// Vector Local Chat Persistence & Voice Preset
// -----------------------------------------------------------------------------

export function loadCachedVectorMessages(): Record<string, VectorChatMessage[]> {
  return safeReadJSON<Record<string, VectorChatMessage[]>>(KEYS.vectorChats, {});
}

export function saveCachedVectorMessages(chats: Record<string, VectorChatMessage[]>): void {
  // Keep latest 40 messages per brand to conserve local quota
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
    if (raw === 'Charon' || raw === 'Fenrir' || raw === 'Kore') return raw;
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
// Local Contact Leads & Sync Queue
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
  safeWriteJSON(KEYS.syncQueue, [...existing, created]);
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
  items: StoreCartItem[]
): StoreOrder {
  return {
    id: `offline-ord-${Date.now()}`,
    storeId: store.id,
    storeOwnerUid: store.ownerUid,
    customerUid: 'offline_local_user',
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
    itemsCount: items.reduce((a, i) => a + i.quantity, 0),
    saleChannel: orderInput.saleChannel || 'Carrito Web',
    status: 'pending',
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
        if (item.type === 'marketplace_order') {
          await createStoreOrderInCloud(
            user,
            item.payload.store,
            item.payload.orderInput,
            item.payload.items
          );
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
      try {
        localStorage.setItem(KEYS.lastSyncAt, new Date().toISOString());
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

export function exportOfflineBackupJSON(): void {
  const backup = {
    exportedAt: new Date().toISOString(),
    warehouse: loadLocalWarehouseState(),
    bcvRates: loadCachedBcvRates(),
    pendingQueue: getOfflineQueue(),
    leads: loadOfflineLeads(),
    storesCachedCount: loadCachedStores().length,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smith_solutions_respaldo_local_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
