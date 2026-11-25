import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getFreshFirebaseIdToken } from './authService';
import { readManualOfflineFlag } from '../hooks/usePWAInstall';
import { Product, Sale, StockAlertEmailLog, StoreEmailConfig } from '../types';
import { playAlertNotificationSound, triggerMobileVibration } from '../utils/alertNotifications';

const CONFIG_PREFIX = 'smith_store_email_cfg_v1:';
const LOGS_PREFIX = 'smith_store_email_logs_v1:';

export function getDefaultStoreEmailConfig(
  storeId: string,
  ownerUid: string,
  recipientEmail = ''
): StoreEmailConfig {
  return {
    storeId,
    ownerUid,
    provider: 'resend',
    isEnabled: false,
    recipientEmail,
    secondaryEmail: '',
    fromName: '',
    fromEmail: '',
    resendApiKey: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    alertOnCriticalStock: true,
    notifyOnPOS: true,
    notifyOnManualAdjustment: true,
    alertFrequency: 'immediate',
    sendSalesReports: true,
    salesReportFrequency: 'per_sale',
  };
}

export function getLocalStoreEmailConfig(
  storeId: string,
  ownerUid = '',
  fallbackEmail = ''
): StoreEmailConfig {
  const base = getDefaultStoreEmailConfig(storeId, ownerUid, fallbackEmail);
  if (typeof window === 'undefined' || !storeId) return base;
  try {
    const raw = localStorage.getItem(`${CONFIG_PREFIX}${storeId}`);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<StoreEmailConfig>;
    return {
      ...base,
      ...parsed,
      storeId,
      ownerUid: parsed.ownerUid || ownerUid,
      recipientEmail: parsed.recipientEmail || fallbackEmail,
    };
  } catch {
    return base;
  }
}

export function saveLocalStoreEmailConfig(config: StoreEmailConfig): void {
  if (typeof window === 'undefined' || !config.storeId) return;
  try {
    const cleanForLocal: StoreEmailConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${CONFIG_PREFIX}${config.storeId}`, JSON.stringify(cleanForLocal));
  } catch {
    // ignore quota errors
  }
}

export async function fetchStoreEmailConfigFromCloud(
  storeId: string,
  ownerUid: string,
  fallbackEmail = ''
): Promise<StoreEmailConfig> {
  const local = getLocalStoreEmailConfig(storeId, ownerUid, fallbackEmail);
  if (!storeId || !ownerUid) return local;
  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) return local;

  const path = `stores/${storeId}/private/emailConfig`;
  try {
    const snap = await getDoc(doc(db, 'stores', storeId, 'private', 'emailConfig'));
    if (!snap.exists()) return local;
    const data = snap.data() as Partial<StoreEmailConfig>;
    const merged: StoreEmailConfig = {
      ...getDefaultStoreEmailConfig(storeId, ownerUid, fallbackEmail),
      ...data,
      storeId,
      ownerUid: data.ownerUid || ownerUid,
      recipientEmail: data.recipientEmail || fallbackEmail,
    };
    saveLocalStoreEmailConfig(merged);
    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('insufficient')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return local;
  }
}

export async function saveStoreEmailConfig(config: StoreEmailConfig): Promise<void> {
  const cleanRecipient = config.recipientEmail.trim().slice(0, 160);
  if (!cleanRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecipient)) {
    throw new Error('Ingresa un correo electrónico destinatario válido.');
  }

  const normalized: StoreEmailConfig = {
    ...config,
    recipientEmail: cleanRecipient,
    secondaryEmail: config.secondaryEmail?.trim().slice(0, 160) || '',
    fromName: config.fromName?.trim().slice(0, 100) || '',
    fromEmail: config.fromEmail?.trim().slice(0, 160) || '',
    resendApiKey: config.resendApiKey?.trim().slice(0, 300) || '',
    smtpHost: config.smtpHost?.trim().slice(0, 160) || '',
    smtpPort: Math.max(1, Math.min(65535, Number(config.smtpPort) || 587)),
    smtpSecure: Boolean(config.smtpSecure),
    smtpUser: config.smtpUser?.trim().slice(0, 160) || '',
    smtpPass: config.smtpPass ? config.smtpPass.slice(0, 300) : '',
  };

  saveLocalStoreEmailConfig(normalized);

  if (!normalized.storeId || !normalized.ownerUid) return;
  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  const path = `stores/${normalized.storeId}/private/emailConfig`;
  const firestoreDoc: Record<string, unknown> = {
    storeId: normalized.storeId,
    ownerUid: normalized.ownerUid,
    provider: normalized.provider,
    isEnabled: Boolean(normalized.isEnabled),
    recipientEmail: normalized.recipientEmail,
    alertOnCriticalStock: Boolean(normalized.alertOnCriticalStock),
    notifyOnPOS: Boolean(normalized.notifyOnPOS),
    notifyOnManualAdjustment: Boolean(normalized.notifyOnManualAdjustment),
    alertFrequency: normalized.alertFrequency,
    sendSalesReports: Boolean(normalized.sendSalesReports),
    salesReportFrequency: normalized.salesReportFrequency,
    updatedAt: serverTimestamp(),
  };

  if (normalized.secondaryEmail) firestoreDoc.secondaryEmail = normalized.secondaryEmail;
  if (normalized.fromName) firestoreDoc.fromName = normalized.fromName;
  if (normalized.fromEmail) firestoreDoc.fromEmail = normalized.fromEmail;
  if (normalized.resendApiKey) firestoreDoc.resendApiKey = normalized.resendApiKey;
  if (normalized.smtpHost) firestoreDoc.smtpHost = normalized.smtpHost;
  if (normalized.smtpPort) firestoreDoc.smtpPort = normalized.smtpPort;
  if (typeof normalized.smtpSecure === 'boolean') firestoreDoc.smtpSecure = normalized.smtpSecure;
  if (normalized.smtpUser) firestoreDoc.smtpUser = normalized.smtpUser;
  if (normalized.smtpPass) firestoreDoc.smtpPass = normalized.smtpPass;
  if (normalized.lastTestStatus)
    firestoreDoc.lastTestStatus = normalized.lastTestStatus.slice(0, 240);
  if (normalized.lastTestAt) firestoreDoc.lastTestAt = normalized.lastTestAt.slice(0, 60);

  try {
    await setDoc(doc(db, 'stores', normalized.storeId, 'private', 'emailConfig'), firestoreDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getStoreEmailLogs(storeId: string): StockAlertEmailLog[] {
  if (typeof window === 'undefined' || !storeId) return [];
  try {
    const raw = localStorage.getItem(`${LOGS_PREFIX}${storeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StockAlertEmailLog[]) : [];
  } catch {
    return [];
  }
}

export function appendStoreEmailLog(storeId: string, log: StockAlertEmailLog): StockAlertEmailLog[] {
  const existing = getStoreEmailLogs(storeId);
  const next = [log, ...existing].slice(0, 50);
  if (typeof window !== 'undefined' && storeId) {
    try {
      localStorage.setItem(`${LOGS_PREFIX}${storeId}`, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }
  return next;
}

export function clearStoreEmailLogs(storeId: string): void {
  if (typeof window !== 'undefined' && storeId) {
    try {
      localStorage.removeItem(`${LOGS_PREFIX}${storeId}`);
    } catch {
      // ignore
    }
  }
}

export interface DispatchStoreEmailParams {
  action: 'test' | 'stock_alert' | 'sales_report';
  storeId: string;
  storeName: string;
  exchangeRate: number;
  config: StoreEmailConfig;
  testRecipientEmail?: string;
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

export async function dispatchStoreEmail(params: DispatchStoreEmailParams): Promise<{
  ok: boolean;
  queuedOffline?: boolean;
  message: string;
  deliveryChannel?: 'smtp' | 'resend';
  latencyMs?: number;
  messageId?: string;
  testedAt?: string;
  recipientEmail?: string;
  stage?: 'syntax' | 'network' | 'auth' | 'api_key' | 'sender' | 'unauthorized';
  log: StockAlertEmailLog;
}> {
  const {
    action,
    storeId,
    storeName,
    exchangeRate,
    config,
    testRecipientEmail,
    triggerEvent,
    products = [],
    sale,
    salesSummary,
  } = params;
  const effectiveRecipientEmail =
    action === 'test' && testRecipientEmail?.trim()
      ? testRecipientEmail.trim()
      : config.recipientEmail;

  const nowStr = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject =
    action === 'test'
      ? `[PRUEBA] Verificación ${config.provider === 'resend' ? 'Resend API' : 'SMTP'} · ${storeName}`
      : action === 'stock_alert'
        ? `[STOCK CRÍTICO] ${storeName} · ${products.length} producto(s)`
        : sale
          ? `[VENTA #${sale.receiptNumber}] ${storeName} · $${(sale.totalWithIgtfUSD || sale.subtotalUSD).toFixed(2)} USD`
          : `[REPORTE VENTAS] ${storeName} · ${salesSummary?.periodLabel || 'Resumen'}`;

  const mappedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    currentStock: p.stock,
    minStock: p.minStock,
    unit: p.unit,
    costUSD: p.costUSD,
  }));

  const buildLog = (
    status: StockAlertEmailLog['status'],
    channel: StockAlertEmailLog['deliveryChannel'],
    errorDetail?: string
  ): StockAlertEmailLog => {
    const entry: StockAlertEmailLog = {
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      recipientEmail: effectiveRecipientEmail,
      subject,
      triggerEvent:
        triggerEvent ||
        (action === 'test'
          ? 'Prueba manual de servidor de correo'
          : action === 'stock_alert'
            ? 'Alerta de stock crítico'
            : 'Reporte de ventas'),
      kind: action,
      deliveryChannel: channel,
      errorDetail,
      products: mappedProducts,
      status,
    };
    appendStoreEmailLog(storeId, entry);
    return entry;
  };

  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const log = buildLog(
      'En Cola Offline',
      'offline_queue',
      'Sin conexión a internet al momento del envío.'
    );
    return {
      ok: false,
      queuedOffline: true,
      message: 'Sin internet: el correo quedó en cola local para reintento al reconectar.',
      log,
    };
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    const log = buildLog(
      'Error de Envío',
      undefined,
      'Inicia sesión con Google verificado para despachar correos reales.'
    );
    return {
      ok: false,
      message: 'Inicia sesión con Google verificado para despachar correos reales.',
      log,
    };
  }

  let idToken = '';
  try {
    idToken = await getFreshFirebaseIdToken(currentUser, false);
  } catch {
    const log = buildLog('Error de Envío', undefined, 'No se pudo obtener token de sesión.');
    return { ok: false, message: 'No se pudo autenticar el envío.', log };
  }

  const reportPayload = sale
    ? {
        periodLabel: `Recibo #${sale.receiptNumber}`,
        totalOrders: 1,
        grossRevenueUSD: sale.totalWithIgtfUSD || sale.subtotalUSD,
        costOfGoodsUSD: sale.items.reduce(
          (acc, it) => acc + (it.product.costUSD || 0) * it.quantity,
          0
        ),
        receiptNumber: sale.receiptNumber,
        customerName: sale.customerName,
        paymentMethod: sale.paymentMethod,
        cashierName: sale.cashierName,
        topItems: sale.items.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          revenueUSD: it.product.priceUSD * it.quantity,
        })),
      }
    : salesSummary;

  const requestBody = JSON.stringify({
    action,
    storeId,
    storeName,
    exchangeRate,
    testRecipientEmail: action === 'test' ? effectiveRecipientEmail : undefined,
    triggerEvent,
    config: {
      provider: config.provider,
      recipientEmail: config.recipientEmail,
      secondaryEmail: config.secondaryEmail,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      resendApiKey: config.resendApiKey,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      smtpPass: config.smtpPass,
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      costUSD: p.costUSD,
    })),
    salesReport: reportPayload,
  });

  try {
    let resp = await fetch('/api/stores/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: requestBody,
    });

    if (resp.status === 401 || resp.status === 403) {
      const refreshedToken = await getFreshFirebaseIdToken(currentUser, true).catch(() => '');
      if (refreshedToken && refreshedToken !== idToken) {
        resp = await fetch('/api/stores/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshedToken}`,
          },
          body: requestBody,
        });
      }
    }

    const rawText = await resp.text();
    let data: {
      ok?: boolean;
      deliveryChannel?: 'smtp' | 'resend';
      latencyMs?: number;
      messageId?: string;
      testedAt?: string;
      recipientEmail?: string;
      stage?: 'syntax' | 'network' | 'auth' | 'api_key' | 'sender' | 'unauthorized';
      message?: string;
      error?: string;
    } = {};
    try {
      if (rawText) {
        data = JSON.parse(rawText);
      }
    } catch {
      data = {};
    }

    if (resp.ok && data.ok) {
      const channel = data.deliveryChannel || config.provider;
      const status = channel === 'smtp' ? 'Enviado (SMTP)' : 'Enviado (Resend)';
      const log = buildLog(status, channel);
      playAlertNotificationSound();
      triggerMobileVibration();
      return {
        ok: true,
        deliveryChannel: channel,
        latencyMs: data.latencyMs,
        messageId: data.messageId,
        testedAt: data.testedAt,
        recipientEmail: data.recipientEmail || effectiveRecipientEmail,
        message: data.message || `Correo enviado vía ${channel.toUpperCase()}.`,
        log,
      };
    }

    const errMsg = data?.message || data?.error || `Error HTTP ${resp.status}`;
    const log = buildLog('Error de Envío', config.provider, errMsg);
    return {
      ok: false,
      deliveryChannel: data.deliveryChannel || config.provider,
      latencyMs: data.latencyMs,
      testedAt: data.testedAt,
      recipientEmail: data.recipientEmail || effectiveRecipientEmail,
      stage: data.stage,
      message: errMsg,
      log,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red enviando correo';
    const log = buildLog('Error de Envío', config.provider, msg);
    return {
      ok: false,
      recipientEmail: effectiveRecipientEmail,
      message: msg,
      log,
    };
  }
}

export interface SmtpPingResult {
  ok: boolean;
  latencyMs?: number;
  authVerified?: boolean;
  stage?: 'syntax' | 'network' | 'auth' | 'unauthorized' | 'offline';
  host?: string;
  port?: number;
  secure?: boolean;
  message: string;
  checkedAt?: string;
}

export async function verifySmtpConnection(
  config: Pick<StoreEmailConfig, 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser' | 'smtpPass'>,
  signal?: AbortSignal
): Promise<SmtpPingResult> {
  const checkedAt = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      ok: false,
      stage: 'offline',
      message: 'Sin conexión a internet: no es posible hacer ping SMTP en este momento.',
      checkedAt,
    };
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return {
      ok: false,
      stage: 'unauthorized',
      message: 'Inicia sesión con Google verificado para validar la conexión SMTP en tiempo real.',
      checkedAt,
    };
  }

  let idToken = '';
  try {
    idToken = await getFreshFirebaseIdToken(currentUser, false);
  } catch {
    return {
      ok: false,
      stage: 'unauthorized',
      message: 'No se pudo autenticar tu sesión para probar el servidor SMTP.',
      checkedAt,
    };
  }

  const body = JSON.stringify({
    smtpHost: (config.smtpHost || '').trim(),
    smtpPort: Number(config.smtpPort || 587),
    smtpSecure: Boolean(config.smtpSecure),
    smtpUser: (config.smtpUser || '').trim(),
    smtpPass: config.smtpPass || '',
  });

  try {
    let resp = await fetch('/api/stores/verify-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body,
      signal,
    });

    if (resp.status === 401 || resp.status === 403) {
      const refreshedToken = await getFreshFirebaseIdToken(currentUser, true).catch(() => '');
      if (refreshedToken && refreshedToken !== idToken) {
        resp = await fetch('/api/stores/verify-smtp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshedToken}`,
          },
          body,
          signal,
        });
      }
    }

    const rawText = await resp.text();
    let data: {
      ok?: boolean;
      latencyMs?: number;
      authVerified?: boolean;
      stage?: SmtpPingResult['stage'];
      host?: string;
      port?: number;
      secure?: boolean;
      message?: string;
      error?: string;
    } = {};
    try {
      if (rawText) {
        data = JSON.parse(rawText);
      }
    } catch {
      data = {};
    }

    return {
      ok: Boolean(resp.ok && data.ok),
      latencyMs: data.latencyMs,
      authVerified: data.authVerified,
      stage: data.stage,
      host: data.host,
      port: data.port,
      secure: data.secure,
      message: data.message || data.error || `Error HTTP ${resp.status}`,
      checkedAt,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return {
      ok: false,
      stage: 'network',
      message: err instanceof Error ? err.message : 'Error de red probando conexión SMTP.',
      checkedAt,
    };
  }
}
