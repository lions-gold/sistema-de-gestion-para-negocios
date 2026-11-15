import { CashClosingRecord, Product } from '../types';
import { playAlertNotificationSound, triggerMobileVibration } from '../utils/alertNotifications';

export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';

export interface BrowserNotificationPrefs {
  enabled: boolean;
  notifyCriticalStock: boolean;
  notifyCashClosing: boolean;
  notifyOnlyWhenBackground: boolean;
}

const PREFS_STORAGE_KEY = 'smith_browser_notifications_v1';
const NOTIFICATION_EVENT_BUS = 'smith:browser-notification-navigate';

export const DEFAULT_BROWSER_NOTIFICATION_PREFS: BrowserNotificationPrefs = {
  enabled: true,
  notifyCriticalStock: true,
  notifyCashClosing: true,
  notifyOnlyWhenBackground: false,
};

// Track recently fired tags to prevent duplicate alerts during local + Firestore snapshot syncs
const recentNotificationTimestamps = new Map<string, number>();
const DEDUP_WINDOW_MS = 25000;

const listeners = new Set<() => void>();

function emitPrefsChanged() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeBrowserNotificationState(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function getBrowserNotificationPrefs(): BrowserNotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_BROWSER_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      return {
        ...DEFAULT_BROWSER_NOTIFICATION_PREFS,
        ...(JSON.parse(raw) as Partial<BrowserNotificationPrefs>),
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_BROWSER_NOTIFICATION_PREFS;
}

export function saveBrowserNotificationPrefs(
  patch: Partial<BrowserNotificationPrefs>
): BrowserNotificationPrefs {
  const next: BrowserNotificationPrefs = {
    ...getBrowserNotificationPrefs(),
    ...patch,
  };
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage errors
  }
  emitPrefsChanged();
  return next;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (!isBrowserNotificationSupported()) return 'unsupported';

  try {
    let result: NotificationPermission;
    // Support both modern Promise-based and legacy Safari callback signature
    const maybePromise = Notification.requestPermission((legacyPerm) => {
      if (legacyPerm === 'granted') {
        saveBrowserNotificationPrefs({ enabled: true });
      }
      emitPrefsChanged();
    });
    if (maybePromise && typeof maybePromise.then === 'function') {
      result = await maybePromise;
    } else {
      result = Notification.permission;
    }

    if (result === 'granted') {
      saveBrowserNotificationPrefs({ enabled: true });
    } else {
      emitPrefsChanged();
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

export function subscribeNotificationNavigation(
  onNavigateTab: (tab: 'inventory' | 'cashier') => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ tab?: 'inventory' | 'cashier' }>).detail;
    if (detail?.tab === 'inventory' || detail?.tab === 'cashier') {
      onNavigateTab(detail.tab);
    }
  };

  const handleSwMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; tab?: string } | undefined;
    if (
      data?.type === 'SMITH_NOTIFICATION_CLICK' &&
      (data.tab === 'inventory' || data.tab === 'cashier')
    ) {
      onNavigateTab(data.tab);
    }
  };

  window.addEventListener(NOTIFICATION_EVENT_BUS, handleCustomEvent);
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
  }

  return () => {
    window.removeEventListener(NOTIFICATION_EVENT_BUS, handleCustomEvent);
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  };
}

function triggerNotificationNavigation(tab: 'inventory' | 'cashier') {
  if (typeof window === 'undefined') return;
  try {
    window.focus();
  } catch {
    // ignore focus restriction
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_BUS, { detail: { tab } }));
}

function resolveNotificationIconUrl(): string {
  if (typeof window === 'undefined') return '/pwa-192x192.png';
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${window.location.origin}${base}/pwa-192x192.png`;
}

function isTabInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

function shouldSkipDuplicate(tag: string): boolean {
  const now = Date.now();
  const prev = recentNotificationTimestamps.get(tag);
  if (prev && now - prev < DEDUP_WINDOW_MS) {
    return true;
  }
  recentNotificationTimestamps.set(tag, now);
  if (recentNotificationTimestamps.size > 100) {
    for (const [k, ts] of recentNotificationTimestamps.entries()) {
      if (now - ts > DEDUP_WINDOW_MS * 2) {
        recentNotificationTimestamps.delete(k);
      }
    }
  }
  return false;
}

export interface BrowserNotificationDispatchOptions {
  title: string;
  body: string;
  tag: string;
  tab: 'inventory' | 'cashier';
  requireInteraction?: boolean;
  skipDedup?: boolean;
}

export async function dispatchBrowserNotification(
  opts: BrowserNotificationDispatchOptions
): Promise<{ delivered: boolean; channel?: 'service_worker' | 'window_notification'; reason?: string }> {
  if (!isBrowserNotificationSupported()) {
    return { delivered: false, reason: 'unsupported' };
  }
  if (Notification.permission !== 'granted') {
    return { delivered: false, reason: `permission_${Notification.permission}` };
  }

  const prefs = getBrowserNotificationPrefs();
  if (!prefs.enabled) {
    return { delivered: false, reason: 'disabled_by_user' };
  }
  if (prefs.notifyOnlyWhenBackground && !isTabInBackground()) {
    return { delivered: false, reason: 'foreground_muted' };
  }
  if (!opts.skipDedup && shouldSkipDuplicate(opts.tag)) {
    return { delivered: false, reason: 'deduplicated' };
  }

  const iconUrl = resolveNotificationIconUrl();
  const payloadOptions: NotificationOptions & { renotify?: boolean } = {
    body: opts.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: opts.tag,
    renotify: true,
    requireInteraction: Boolean(opts.requireInteraction),
    data: {
      tab: opts.tab,
      timestamp: Date.now(),
    },
  };

  // Play soft chime + mobile haptic when permissible
  playAlertNotificationSound();
  triggerMobileVibration();

  // Prefer active Service Worker registration so notifications fire reliably even in background/minimized tabs
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 900)),
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(opts.title, payloadOptions);
        return { delivered: true, channel: 'service_worker' };
      }
    } catch {
      // Fallback cleanly to window.Notification
    }
  }

  try {
    const notification = new Notification(opts.title, payloadOptions);
    notification.onclick = () => {
      notification.close();
      triggerNotificationNavigation(opts.tab);
    };
    return { delivered: true, channel: 'window_notification' };
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : 'notification_error',
    };
  }
}

export async function notifyCriticalStockBrowserAlert(params: {
  products: Product[];
  storeId: string;
  storeName: string;
}): Promise<void> {
  const prefs = getBrowserNotificationPrefs();
  if (!prefs.notifyCriticalStock || params.products.length === 0) return;

  const isSingle = params.products.length === 1;
  const first = params.products[0];
  const hasZeroStock = params.products.some((p) => p.stock <= 0);

  const title = isSingle
    ? first.stock <= 0
      ? `Agotado: ${first.name}`
      : `Stock Crítico: ${first.name}`
    : `Alerta Stock Crítico (${params.products.length} productos)`;

  const body = isSingle
    ? `${params.storeName} · Quedan ${first.stock} ${first.unit} (mínimo ${first.minStock}). Toca para reponer.`
    : `${params.storeName}: ${params.products
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stock})`)
        .join(', ')}${params.products.length > 3 ? ` y ${params.products.length - 3} más` : ''}.`;

  const tag = isSingle
    ? `critical-stock-${params.storeId}-${first.id}-${first.stock <= 0 ? 'zero' : 'low'}`
    : `critical-stock-batch-${params.storeId}-${params.products
        .slice(0, 3)
        .map((p) => p.id)
        .join('-')}`;

  await dispatchBrowserNotification({
    title,
    body,
    tag,
    tab: 'inventory',
    requireInteraction: hasZeroStock,
  });
}

export async function notifyCashClosingBrowserAlert(params: {
  closing: CashClosingRecord;
  storeId: string;
  storeName: string;
}): Promise<void> {
  const prefs = getBrowserNotificationPrefs();
  if (!prefs.notifyCashClosing) return;

  const { closing, storeId, storeName } = params;
  const diffLabel =
    Math.abs(closing.differenceUSD) < 0.01
      ? 'Cuadre exacto'
      : closing.differenceUSD > 0
        ? `Sobrante +$${closing.differenceUSD.toFixed(2)}`
        : `Faltante -$${Math.abs(closing.differenceUSD).toFixed(2)}`;

  await dispatchBrowserNotification({
    title: `Cierre de Caja ${closing.closingNumber} · ${closing.zReportNumber}`,
    body: `${storeName} · Ventas: $${closing.totalSalesUSD.toFixed(2)} USD (${closing.totalTransactions} ops) · ${diffLabel}.`,
    tag: `cash-closing-${storeId}-${closing.id}`,
    tab: 'cashier',
    requireInteraction: Math.abs(closing.differenceUSD) >= 1,
  });
}

export async function sendTestBrowserNotification(
  storeName: string
): Promise<{ delivered: boolean; channel?: 'service_worker' | 'window_notification'; reason?: string }> {
  return dispatchBrowserNotification({
    title: `Alertas Activas · ${storeName}`,
    body: 'Recibirás avisos en tiempo real por stock crítico y cierres de caja, incluso con la pestaña en segundo plano.',
    tag: `test-notification-${Date.now()}`,
    tab: 'inventory',
    skipDedup: true,
  });
}
