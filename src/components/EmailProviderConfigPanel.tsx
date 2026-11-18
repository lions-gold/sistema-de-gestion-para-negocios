import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  BrowserNotificationPermissionState,
  BrowserNotificationPrefs,
  getBrowserNotificationPermission,
  getBrowserNotificationPrefs,
  requestBrowserNotificationPermission,
  saveBrowserNotificationPrefs,
  sendTestBrowserNotification,
  subscribeBrowserNotificationState,
} from '../services/browserNotificationService';
import {
  EmailProviderType,
  PlatformPaymentCurrency,
  Product,
  Sale,
  StockAlertEmailLog,
  StoreEmailConfig,
  StoreOrder,
  StorePaymentMethod,
  StoreProduct,
} from '../types';
import {
  clearStoreEmailLogs,
  dispatchStoreEmail,
  fetchStoreEmailConfigFromCloud,
  getDefaultStoreEmailConfig,
  getLocalStoreEmailConfig,
  getStoreEmailLogs,
  saveStoreEmailConfig,
  SmtpPingResult,
  verifySmtpConnection,
} from '../services/emailDeliveryService';
import {
  deleteStorePaymentMethod,
  makeSafeDocId,
  saveStorePaymentMethod,
  subscribeAllStorePaymentMethodsForOwner,
  toggleStorePaymentMethodActive,
} from '../services/saasService';
import {
  isAppEffectivelyOffline,
  isNetworkOrOfflineError,
  loadCachedStorePaymentMethods,
  saveCachedStorePaymentMethods,
} from '../services/offlineSyncService';

interface EmailProviderConfigPanelProps {
  storeId: string;
  ownerUid: string;
  storeName: string;
  ownerEmail?: string;
  exchangeRate: number;
  products?: Product[];
  storeProducts?: StoreProduct[];
  sales?: Sale[];
  orders?: StoreOrder[];
  compact?: boolean;
  initialSubTab?: 'config' | 'payment_methods' | 'history';
  onConfigSaved?: (config: StoreEmailConfig) => void;
  onLogsUpdated?: (logs: StockAlertEmailLog[]) => void;
  onStorePaymentMethodsChange?: (methods: StorePaymentMethod[]) => void;
}

const SMTP_PRESETS = [
  { label: 'Gmail (App Password)', host: 'smtp.gmail.com', port: 465, secure: true },
  { label: 'Brevo / Sendinblue', host: 'smtp-relay.brevo.com', port: 587, secure: false },
  { label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true },
  { label: 'cPanel / Corporativo SSL', host: 'mail.tudominio.com', port: 465, secure: true },
] as const;

export const EmailProviderConfigPanel: React.FC<EmailProviderConfigPanelProps> = ({
  storeId,
  ownerUid,
  storeName,
  ownerEmail = '',
  exchangeRate,
  products = [],
  storeProducts = [],
  sales = [],
  orders = [],
  compact = false,
  initialSubTab = 'config',
  onConfigSaved,
  onLogsUpdated,
  onStorePaymentMethodsChange,
}) => {
  const [subTab, setSubTab] = useState<'config' | 'payment_methods' | 'history'>(initialSubTab);
  const [config, setConfig] = useState<StoreEmailConfig>(() =>
    getLocalStoreEmailConfig(storeId, ownerUid, ownerEmail)
  );
  const [logs, setLogs] = useState<StockAlertEmailLog[]>(() => getStoreEmailLogs(storeId));
  const [showSecret, setShowSecret] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<'test' | 'stock_alert' | 'sales_report' | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [notifPerm, setNotifPerm] = useState<BrowserNotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );
  const [notifPrefs, setNotifPrefs] = useState<BrowserNotificationPrefs>(() =>
    getBrowserNotificationPrefs()
  );
  const [isTestingPush, setIsTestingPush] = useState(false);

  // Real-time SMTP connection ping & pre-save credential validation
  const [smtpPingState, setSmtpPingState] = useState<{
    status: 'idle' | 'incomplete' | 'checking' | 'success' | 'error';
    message: string;
    latencyMs?: number;
    checkedAt?: string;
    signature: string;
    stage?: SmtpPingResult['stage'];
  }>({
    status: 'idle',
    message: '',
    signature: '',
  });
  const [isVerifyingBeforeSave, setIsVerifyingBeforeSave] = useState(false);
  const [allowSaveBypassAfterPingFail, setAllowSaveBypassAfterPingFail] = useState(false);
  const smtpPingSeqRef = React.useRef(0);
  const smtpPingAbortRef = React.useRef<AbortController | null>(null);
  const smtpPingMetaRef = React.useRef<{ status: string; signature: string }>({
    status: 'idle',
    signature: '',
  });

  // Per-store customer payment methods state (subcollection: store_payment_methods)
  const [storeMethods, setStoreMethods] = useState<StorePaymentMethod[]>(() =>
    loadCachedStorePaymentMethods(storeId)
  );
  const [editingStoreMethod, setEditingStoreMethod] = useState<StorePaymentMethod | null>(null);
  const [pmName, setPmName] = useState('');
  const [pmCurrency, setPmCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [pmHolder, setPmHolder] = useState('');
  const [pmDetails, setPmDetails] = useState('');
  const [pmInstructions, setPmInstructions] = useState('');
  const [pmAppliesIgtf, setPmAppliesIgtf] = useState(false);
  const [pmActive, setPmActive] = useState(true);
  const [pmSearch, setPmSearch] = useState('');
  const [isSavingMethod, setIsSavingMethod] = useState(false);
  const [confirmDeleteMethodId, setConfirmDeleteMethodId] = useState<string | null>(null);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const effectiveCloudOwnerUid = ownerUid || auth.currentUser?.uid || '';
  const isCloudStoreLinked = Boolean(
    storeId &&
      storeId !== 'default-warehouse' &&
      effectiveCloudOwnerUid &&
      auth.currentUser?.emailVerified
  );

  const onStorePaymentMethodsChangeRef = React.useRef(onStorePaymentMethodsChange);
  onStorePaymentMethodsChangeRef.current = onStorePaymentMethodsChange;

  useEffect(() => {
    if (!storeId) return;
    const cached = loadCachedStorePaymentMethods(storeId);
    setStoreMethods(cached);
    onStorePaymentMethodsChangeRef.current?.(cached);

    if (!isCloudStoreLinked || isAppEffectivelyOffline()) return;

    const unsub = subscribeAllStorePaymentMethodsForOwner(
      storeId,
      effectiveCloudOwnerUid,
      (list) => {
        setStoreMethods(list);
        saveCachedStorePaymentMethods(storeId, list);
        onStorePaymentMethodsChangeRef.current?.(list);
      }
    );
    return () => unsub();
  }, [storeId, effectiveCloudOwnerUid, isCloudStoreLinked]);

  useEffect(() => {
    const syncPush = () => {
      setNotifPerm(getBrowserNotificationPermission());
      setNotifPrefs(getBrowserNotificationPrefs());
    };
    syncPush();
    return subscribeBrowserNotificationState(syncPush);
  }, []);

  const handleRequestBrowserPush = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPerm(perm);
    setNotifPrefs(getBrowserNotificationPrefs());
    if (perm === 'granted') {
      const testRes = await sendTestBrowserNotification(storeName || 'Almacén & POS');
      setFeedback({
        type: 'success',
        text: testRes.delivered
          ? 'Notificaciones del navegador activadas. Recibirás avisos en tiempo real por stock crítico y cierres de caja.'
          : 'Permiso concedido. Verifica que el navegador no tenga silenciadas las alertas del sitio.',
      });
    } else if (perm === 'denied') {
      setFeedback({
        type: 'error',
        text: 'El navegador bloqueó el permiso de notificaciones. Habilítalo desde el icono de candado en la barra de dirección.',
      });
    }
  };

  const handleTestBrowserPush = async () => {
    setIsTestingPush(true);
    try {
      if (notifPerm === 'default') {
        await handleRequestBrowserPush();
        return;
      }
      const res = await sendTestBrowserNotification(storeName || 'Almacén & POS');
      setFeedback({
        type: res.delivered ? 'success' : 'error',
        text: res.delivered
          ? `Notificación de prueba enviada (${res.channel === 'service_worker' ? 'Service Worker / Segundo Plano' : 'Notification API'}).`
          : `No se pudo mostrar la notificación (${res.reason || 'permiso requerido'}).`,
      });
    } finally {
      setIsTestingPush(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;
    smtpPingMetaRef.current = { status: 'idle', signature: '' };
    setConfig(getLocalStoreEmailConfig(storeId, ownerUid, ownerEmail));
    setLogs(getStoreEmailLogs(storeId));

    let cancelled = false;
    setIsLoadingCloud(true);
    fetchStoreEmailConfigFromCloud(storeId, ownerUid, ownerEmail)
      .then((cloudCfg) => {
        if (!cancelled) {
          setConfig(cloudCfg);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCloud(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, ownerUid, ownerEmail]);

  const updateField = <K extends keyof StoreEmailConfig>(key: K, value: StoreEmailConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const mergedProducts: Product[] =
    products.length > 0
      ? products
      : storeProducts.map((sp) => ({
          id: sp.id,
          name: sp.name,
          category: sp.category || 'General',
          sku: sp.sku || sp.id.slice(0, 8),
          stock: sp.stock,
          minStock: sp.minStock ?? 5,
          costUSD: sp.costUSD ?? 0,
          priceUSD: sp.priceUSD,
          unit: sp.unit || 'und',
          barcode: '',
        }));

  const lowStockProducts = mergedProducts.filter((p) => p.stock <= (p.minStock ?? 5));

  const buildSmtpSignature = (cfg: StoreEmailConfig) =>
    `${(cfg.smtpHost || '').trim().toLowerCase()}|${Number(cfg.smtpPort || 587)}|${Boolean(
      cfg.smtpSecure
    )}|${(cfg.smtpUser || '').trim()}|${cfg.smtpPass || ''}`;

  const currentSmtpSignature = buildSmtpSignature(config);

  const getSmtpSyntaxIssue = (cfg: StoreEmailConfig): string | null => {
    const host = (cfg.smtpHost || '').trim();
    const port = Number(cfg.smtpPort || 0);
    const user = (cfg.smtpUser || '').trim();
    const pass = cfg.smtpPass || '';

    if (!host && !user && !pass) {
      return null;
    }
    if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !host.includes('.')) {
      return 'Ingresa un servidor SMTP válido (ej. smtp.gmail.com o smtp-relay.brevo.com).';
    }
    if (host.toLowerCase() === 'mail.tudominio.com') {
      return 'Reemplaza "mail.tudominio.com" por el dominio real de tu servidor de correo.';
    }
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return 'Puerto SMTP inválido. Usa 465 (SSL/TLS) o 587 (STARTTLS).';
    }
    if (!user) {
      return 'Falta el Usuario SMTP para validar la autenticación.';
    }
    if (!pass) {
      return 'Falta la Contraseña o App Password SMTP para autenticar el ping.';
    }
    return null;
  };

  const runSmtpPing = React.useCallback(
    async (targetCfg: StoreEmailConfig, sig: string): Promise<SmtpPingResult> => {
      smtpPingAbortRef.current?.abort();
      const controller = new AbortController();
      smtpPingAbortRef.current = controller;
      const seq = ++smtpPingSeqRef.current;

      smtpPingMetaRef.current = { status: 'checking', signature: sig };
      setSmtpPingState({
        status: 'checking',
        message: `Haciendo ping SMTP a ${(targetCfg.smtpHost || '').trim()}:${Number(
          targetCfg.smtpPort || 587
        )}...`,
        signature: sig,
      });

      try {
        const res = await verifySmtpConnection(targetCfg, controller.signal);
        if (seq !== smtpPingSeqRef.current) {
          return res;
        }
        const nextStatus = res.ok ? 'success' : 'error';
        smtpPingMetaRef.current = { status: nextStatus, signature: sig };
        setSmtpPingState({
          status: nextStatus,
          message: res.message,
          latencyMs: res.latencyMs,
          checkedAt: res.checkedAt,
          signature: sig,
          stage: res.stage,
        });
        if (res.ok) {
          setAllowSaveBypassAfterPingFail(false);
        }
        return res;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return {
            ok: false,
            stage: 'network',
            message: 'Verificación reemplazada por cambios recientes.',
          };
        }
        const fallback: SmtpPingResult = {
          ok: false,
          stage: 'network',
          message: 'No se pudo completar el ping SMTP.',
        };
        if (seq === smtpPingSeqRef.current) {
          smtpPingMetaRef.current = { status: 'error', signature: sig };
          setSmtpPingState({
            status: 'error',
            message: fallback.message,
            signature: sig,
            stage: 'network',
          });
        }
        return fallback;
      }
    },
    []
  );

  // Live debounced real-time SMTP validator while typing credentials
  useEffect(() => {
    if (subTab !== 'config' || config.provider !== 'smtp') {
      smtpPingAbortRef.current?.abort();
      return;
    }

    setAllowSaveBypassAfterPingFail(false);

    const host = (config.smtpHost || '').trim();
    const user = (config.smtpUser || '').trim();
    const pass = config.smtpPass || '';

    if (!host && !user && !pass) {
      smtpPingAbortRef.current?.abort();
      smtpPingMetaRef.current = { status: 'idle', signature: currentSmtpSignature };
      setSmtpPingState({
        status: 'idle',
        message:
          'Completa host, puerto, usuario y contraseña SMTP para validar la conexión automáticamente.',
        signature: currentSmtpSignature,
      });
      return;
    }

    const syntaxIssue = getSmtpSyntaxIssue(config);
    if (syntaxIssue) {
      smtpPingAbortRef.current?.abort();
      smtpPingMetaRef.current = { status: 'incomplete', signature: currentSmtpSignature };
      setSmtpPingState({
        status: 'incomplete',
        message: syntaxIssue,
        signature: currentSmtpSignature,
        stage: 'syntax',
      });
      return;
    }

    if (
      smtpPingMetaRef.current.signature === currentSmtpSignature &&
      (smtpPingMetaRef.current.status === 'success' ||
        smtpPingMetaRef.current.status === 'checking')
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      runSmtpPing(config, currentSmtpSignature);
    }, 850);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    subTab,
    config.provider,
    config.smtpHost,
    config.smtpPort,
    config.smtpSecure,
    config.smtpUser,
    config.smtpPass,
    currentSmtpSignature,
    runSmtpPing,
  ]);

  useEffect(() => {
    return () => {
      smtpPingAbortRef.current?.abort();
    };
  }, []);

  const persistEmailConfig = async (bypassPingCheck = false) => {
    setIsSaving(true);
    setFeedback(null);
    setAllowSaveBypassAfterPingFail(false);

    try {
      let toSave: StoreEmailConfig = {
        ...config,
        storeId,
        ownerUid,
      };

      if (toSave.provider === 'smtp' && !bypassPingCheck) {
        const syntaxIssue = getSmtpSyntaxIssue(toSave);
        const host = (toSave.smtpHost || '').trim();
        const user = (toSave.smtpUser || '').trim();
        const pass = toSave.smtpPass || '';

        if (!host || !user || !pass || syntaxIssue) {
          const msg =
            syntaxIssue ||
            'Completa Servidor SMTP (host), Puerto, Usuario y Contraseña antes de guardar.';
          smtpPingMetaRef.current = { status: 'error', signature: currentSmtpSignature };
          setSmtpPingState({
            status: 'error',
            message: msg,
            signature: currentSmtpSignature,
            stage: 'syntax',
          });
          setFeedback({ type: 'error', text: msg });
          return;
        }

        let verifiedLatency = smtpPingState.latencyMs;
        if (smtpPingState.status !== 'success' || smtpPingState.signature !== currentSmtpSignature) {
          setIsVerifyingBeforeSave(true);
          const pingRes = await runSmtpPing(toSave, currentSmtpSignature);
          setIsVerifyingBeforeSave(false);

          if (!pingRes.ok) {
            setAllowSaveBypassAfterPingFail(
              pingRes.stage === 'offline' || pingRes.stage === 'network'
            );
            setFeedback({
              type: 'error',
              text: `No se guardaron las credenciales porque falló la prueba de conexión (ping) SMTP: ${pingRes.message}`,
            });
            return;
          }
          verifiedLatency = pingRes.latencyMs;
        }

        toSave = {
          ...toSave,
          lastTestStatus: `Ping SMTP OK (${verifiedLatency ?? '--'} ms)`,
          lastTestAt: new Date().toLocaleString('es-VE'),
        };

        await saveStoreEmailConfig(toSave);
        setConfig(toSave);
        onConfigSaved?.(toSave);
        setFeedback({
          type: 'success',
          text: `Conexión SMTP verificada mediante ping (${
            verifiedLatency ?? 'OK'
          } ms) y credenciales guardadas de forma segura para ${storeName}.`,
        });
        return;
      }

      await saveStoreEmailConfig(toSave);
      setConfig(toSave);
      onConfigSaved?.(toSave);
      setFeedback({
        type: 'success',
        text:
          toSave.provider === 'smtp'
            ? `Configuración SMTP guardada sin verificación remota para ${storeName}.`
            : `Configuración de Resend API guardada de forma segura para ${storeName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setIsVerifyingBeforeSave(false);
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistEmailConfig(false);
  };

  const buildSalesSummaryPayload = () => {
    if (sales.length > 0) {
      let grossRevenueUSD = 0;
      let costOfGoodsUSD = 0;
      const pmMap = new Map<string, { count: number; totalUSD: number }>();
      const itemMap = new Map<string, { quantity: number; revenueUSD: number }>();

      sales.forEach((s) => {
        const total = s.totalWithIgtfUSD || s.subtotalUSD;
        grossRevenueUSD += total;
        const pmPrev = pmMap.get(s.paymentMethod) || { count: 0, totalUSD: 0 };
        pmMap.set(s.paymentMethod, {
          count: pmPrev.count + 1,
          totalUSD: pmPrev.totalUSD + total,
        });
        s.items.forEach((it) => {
          costOfGoodsUSD += (it.product.costUSD || 0) * it.quantity;
          const prevIt = itemMap.get(it.product.name) || { quantity: 0, revenueUSD: 0 };
          itemMap.set(it.product.name, {
            quantity: prevIt.quantity + it.quantity,
            revenueUSD: prevIt.revenueUSD + it.product.priceUSD * it.quantity,
          });
        });
      });

      const netProfitUSD = Math.max(0, grossRevenueUSD - costOfGoodsUSD);
      return {
        periodLabel: `Consolidado POS (${sales.length} tickets)`,
        totalOrders: sales.length,
        grossRevenueUSD,
        costOfGoodsUSD,
        netProfitUSD,
        paymentBreakdown: Array.from(pmMap.entries()).map(([method, v]) => ({
          method,
          count: v.count,
          totalUSD: v.totalUSD,
        })),
        topItems: Array.from(itemMap.entries())
          .map(([name, v]) => ({ name, quantity: v.quantity, revenueUSD: v.revenueUSD }))
          .sort((a, b) => b.revenueUSD - a.revenueUSD)
          .slice(0, 8),
      };
    }

    // Fallback to SaaS StoreOrders when called from MerchantPortal
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    let grossRevenueUSD = 0;
    let costOfGoodsUSD = 0;
    const pmMap = new Map<string, { count: number; totalUSD: number }>();

    activeOrders.forEach((o) => {
      grossRevenueUSD += o.totalUSD || 0;
      costOfGoodsUSD += o.estimatedCostUSD || 0;
      const pmPrev = pmMap.get(o.paymentMethod) || { count: 0, totalUSD: 0 };
      pmMap.set(o.paymentMethod, {
        count: pmPrev.count + 1,
        totalUSD: pmPrev.totalUSD + (o.totalUSD || 0),
      });
    });

    return {
      periodLabel: `Pedidos Tienda (${activeOrders.length} órdenes)`,
      totalOrders: activeOrders.length,
      grossRevenueUSD,
      costOfGoodsUSD,
      netProfitUSD: Math.max(0, grossRevenueUSD - costOfGoodsUSD),
      paymentBreakdown: Array.from(pmMap.entries()).map(([method, v]) => ({
        method,
        count: v.count,
        totalUSD: v.totalUSD,
      })),
      topItems: activeOrders.slice(0, 6).map((o) => ({
        name: `Factura ${o.invoiceNumber} · ${o.customerName}`,
        quantity: o.itemsCount || 1,
        revenueUSD: o.totalUSD || 0,
      })),
    };
  };

  const handleDispatch = async (action: 'test' | 'stock_alert' | 'sales_report') => {
    setBusyAction(action);
    setFeedback(null);
    try {
      const targetProducts =
        action === 'stock_alert'
          ? lowStockProducts.length > 0
            ? lowStockProducts
            : mergedProducts.slice(0, 5)
          : [];

      const res = await dispatchStoreEmail({
        action,
        storeId,
        storeName,
        exchangeRate,
        config: {
          ...config,
          storeId,
          ownerUid,
        },
        triggerEvent:
          action === 'stock_alert'
            ? lowStockProducts.length > 0
              ? `Envío manual: ${lowStockProducts.length} producto(s) en stock crítico`
              : 'Envío manual de verificación de inventario'
            : action === 'sales_report'
              ? 'Reporte de ventas solicitado desde el panel'
              : 'Prueba de conexión SMTP / Resend API',
        products: targetProducts,
        salesSummary: action === 'sales_report' ? buildSalesSummaryPayload() : undefined,
      });

      const updatedLogs = getStoreEmailLogs(storeId);
      setLogs(updatedLogs);
      onLogsUpdated?.(updatedLogs);

      if (action === 'test') {
        const stamped: StoreEmailConfig = {
          ...config,
          storeId,
          ownerUid,
          lastTestStatus: res.ok ? `OK · ${res.deliveryChannel?.toUpperCase()}` : res.message,
          lastTestAt: new Date().toLocaleString('es-VE'),
        };
        setConfig(stamped);
        saveStoreEmailConfig(stamped).catch(() => {});
      }

      setFeedback({
        type: res.ok ? 'success' : 'error',
        text: res.message,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = () => {
    smtpPingAbortRef.current?.abort();
    const fresh = getDefaultStoreEmailConfig(storeId, ownerUid, ownerEmail);
    setConfig(fresh);
    setFeedback(null);
    setAllowSaveBypassAfterPingFail(false);
    setSmtpPingState({
      status: 'idle',
      message: '',
      signature: '',
    });
  };

  const handleClearLogs = () => {
    clearStoreEmailLogs(storeId);
    setLogs([]);
    onLogsUpdated?.([]);
  };

  const resetStoreMethodForm = () => {
    setEditingStoreMethod(null);
    setPmName('');
    setPmCurrency('USD');
    setPmHolder('');
    setPmDetails('');
    setPmInstructions('');
    setPmAppliesIgtf(false);
    setPmActive(true);
  };

  const syncLocalStoreMethods = (nextList: StorePaymentMethod[]) => {
    const sorted = [...nextList].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    setStoreMethods(sorted);
    saveCachedStorePaymentMethods(storeId, sorted);
    onStorePaymentMethodsChangeRef.current?.(sorted);
  };

  const handleSaveStoreMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = pmName.trim().slice(0, 80);
    const cleanDetails = pmDetails.trim().slice(0, 300);
    if (cleanName.length < 2 || cleanDetails.length < 2) {
      setFeedback({
        type: 'error',
        text: 'Indica el nombre del método de pago y los datos de cobro para tus clientes.',
      });
      return;
    }

    setIsSavingMethod(true);
    setFeedback(null);
    const saveLocallyFallback = (offlineNote: string) => {
      const nowIso = new Date().toISOString();
      const localRecord: StorePaymentMethod = {
        id: editingStoreMethod?.id || makeSafeDocId('stpm'),
        storeId,
        ownerUid: effectiveCloudOwnerUid || 'local-owner',
        name: cleanName,
        currency: pmCurrency,
        accountHolder: pmHolder.trim().slice(0, 120),
        accountDetails: cleanDetails,
        instructions: pmInstructions.trim().slice(0, 400) || undefined,
        appliesIgtf: pmAppliesIgtf,
        isActive: pmActive,
        createdAt: editingStoreMethod?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const nextList = editingStoreMethod
        ? storeMethods.map((m) => (m.id === localRecord.id ? localRecord : m))
        : [...storeMethods, localRecord];
      syncLocalStoreMethods(nextList);
      resetStoreMethodForm();
      setFeedback({ type: 'success', text: offlineNote });
    };

    try {
      if (!isCloudStoreLinked || isAppEffectivelyOffline()) {
        saveLocallyFallback(
          `Método "${cleanName}" guardado localmente para el POS${
            storeId === 'default-warehouse'
              ? ' (vincula una tienda SaaS para respaldo en Firestore).'
              : ' (se sincronizará cuando tengas conexión).'
          }`
        );
        return;
      }

      const saved = await saveStorePaymentMethod(
        storeId,
        effectiveCloudOwnerUid,
        {
          id: editingStoreMethod?.id,
          name: cleanName,
          currency: pmCurrency,
          accountHolder: pmHolder,
          accountDetails: cleanDetails,
          instructions: pmInstructions,
          appliesIgtf: pmAppliesIgtf,
          isActive: pmActive,
        },
        editingStoreMethod || undefined
      );
      const nextList = editingStoreMethod
        ? storeMethods.map((m) => (m.id === saved.id ? saved : m))
        : [...storeMethods.filter((m) => m.id !== saved.id), saved];
      syncLocalStoreMethods(nextList);
      resetStoreMethodForm();
      setFeedback({
        type: 'success',
        text: editingStoreMethod
          ? `Método "${cleanName}" actualizado en store_payment_methods y listo en Caja POS.`
          : `Método "${cleanName}" guardado en store_payment_methods para tus clientes y Caja POS.`,
      });
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        saveLocallyFallback(
          `Método "${cleanName}" guardado en caché local del POS sin conexión.`
        );
      } else {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'No se pudo guardar el método de pago.',
        });
      }
    } finally {
      setIsSavingMethod(false);
    }
  };

  const handleToggleStoreMethod = async (method: StorePaymentMethod) => {
    const nextActive = !method.isActive;
    setIsSavingMethod(true);
    setFeedback(null);
    try {
      if (isCloudStoreLinked && !isAppEffectivelyOffline()) {
        await toggleStorePaymentMethodActive(storeId, method, nextActive);
      }
      const nextList = storeMethods.map((m) =>
        m.id === method.id ? { ...m, isActive: nextActive, updatedAt: new Date().toISOString() } : m
      );
      syncLocalStoreMethods(nextList);
      setFeedback({
        type: 'success',
        text: `Método "${method.name}" ${nextActive ? 'activado en el POS y tienda' : 'pausado'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo cambiar el estado del método.',
      });
    } finally {
      setIsSavingMethod(false);
    }
  };

  const handleDeleteStoreMethod = async (method: StorePaymentMethod) => {
    setIsSavingMethod(true);
    setFeedback(null);
    try {
      if (isCloudStoreLinked && !isAppEffectivelyOffline()) {
        await deleteStorePaymentMethod(storeId, method.id);
      }
      setConfirmDeleteMethodId(null);
      if (editingStoreMethod?.id === method.id) {
        resetStoreMethodForm();
      }
      syncLocalStoreMethods(storeMethods.filter((m) => m.id !== method.id));
      setFeedback({
        type: 'success',
        text: `Método de pago "${method.name}" eliminado.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error eliminando método de pago.',
      });
    } finally {
      setIsSavingMethod(false);
    }
  };

  const filteredStoreMethods = storeMethods.filter((m) => {
    const q = pmSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.currency.toLowerCase().includes(q) ||
      m.accountHolder.toLowerCase().includes(q) ||
      m.accountDetails.toLowerCase().includes(q)
    );
  });

  const STORE_PAYMENT_PRESETS: Array<{
    name: string;
    currency: PlatformPaymentCurrency;
    igtf: boolean;
    detailsPlaceholder: string;
    instructions: string;
  }> = [
    {
      name: 'Zelle',
      currency: 'USD',
      igtf: true,
      detailsPlaceholder: 'Correo Zelle: cobros@tutienda.com',
      instructions: 'Colocar el número de factura en el concepto de la transferencia.',
    },
    {
      name: 'Pago Móvil',
      currency: 'Bs',
      igtf: false,
      detailsPlaceholder: 'Banco: Banesco (0134) · C.I/RIF: V-XXXXXXXX · Teléfono: 0414-XXXXXXX',
      instructions: 'Calcular monto a la tasa BCV vigente y mostrar referencia.',
    },
    {
      name: 'Transferencia Bancaria',
      currency: 'Bs',
      igtf: false,
      detailsPlaceholder: 'Banesco Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX · RIF: J-XXXXXXXX-X',
      instructions: 'Transferencia directa en bolívares; verificar acreditación en caja.',
    },
    {
      name: 'Binance Pay',
      currency: 'USDT',
      igtf: false,
      detailsPlaceholder: 'Binance Pay ID: XXXXXXXXX · Red USDT TRC20/BEP20',
      instructions: 'Transferencia en USDT sin comisión bancaria.',
    },
    {
      name: 'Efectivo USD',
      currency: 'USD',
      igtf: true,
      detailsPlaceholder: 'Pago en efectivo divisas USD en caja principal',
      instructions: 'Verificar denominación y estado de billetes al recibir.',
    },
    {
      name: 'Zinli',
      currency: 'USD',
      igtf: true,
      detailsPlaceholder: 'Correo Zinli: cobros@tutienda.com',
      instructions: 'Transferencia instantánea USD desde billetera Zinli.',
    },
  ];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Configuración de Tienda (Correo, Push y Pagos POS)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Administra alertas de stock, reportes SMTP/Resend y los métodos de cobro propios para clientes de{' '}
            <strong className="text-zinc-200">{storeName || 'tu tienda'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] self-start lg:self-auto overflow-x-auto max-w-full no-scrollbar">
          <button
            type="button"
            onClick={() => setSubTab('config')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'config'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Credenciales y Alertas
          </button>
          <button
            type="button"
            onClick={() => setSubTab('payment_methods')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              subTab === 'payment_methods'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Métodos de Pago ({storeMethods.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              subTab === 'history'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historial ({logs.length})</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/50 border-red-500/40 text-red-200'
          }`}
          role="status"
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{feedback.text}</span>
        </div>
      )}

      {subTab === 'config' ? (
        <div className="space-y-5">
          {/* Real-Time Browser Push Notifications (Foreground & Background) */}
          <div className="p-4 rounded-xl bg-[#09090b] border border-white/[0.1] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    notifPerm === 'granted' && notifPrefs.enabled
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                      : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                  }`}
                >
                  {notifPerm === 'granted' && notifPrefs.enabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                    <span>Notificaciones del Navegador (Tiempo Real y Segundo Plano)</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {notifPerm === 'unsupported'
                      ? 'Este navegador no soporta la API de Notification.'
                      : notifPerm === 'denied'
                        ? 'Permiso denegado en el navegador. Actívalo manualmente en la configuración del sitio.'
                        : notifPerm === 'granted'
                          ? 'Permiso concedido. Los avisos funcionan incluso con la pestaña minimizada o en segundo plano.'
                          : 'Activa las notificaciones push para enterarte al instante de caídas de stock crítico o cierres de caja Z.'}
                  </p>
                </div>
              </div>

              {notifPerm !== 'unsupported' && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {notifPerm !== 'granted' ? (
                    <button
                      type="button"
                      onClick={handleRequestBrowserPush}
                      className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Activar Notificaciones</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleTestBrowserPush}
                        disabled={isTestingPush}
                        className="px-3 py-2 min-h-[40px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-amber-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Probar Push</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveBrowserNotificationPrefs({ enabled: !notifPrefs.enabled })
                        }
                        className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                          notifPrefs.enabled
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300 border border-white/[0.1]'
                        }`}
                      >
                        {notifPrefs.enabled ? 'Push Activo' : 'Push Pausado'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {notifPerm === 'granted' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.07] cursor-pointer">
                  <span className="text-zinc-300">Alertas stock crítico</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.notifyCriticalStock}
                    onChange={(e) =>
                      saveBrowserNotificationPrefs({ notifyCriticalStock: e.target.checked })
                    }
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.07] cursor-pointer">
                  <span className="text-zinc-300">Cierres de caja Z</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.notifyCashClosing}
                    onChange={(e) =>
                      saveBrowserNotificationPrefs({ notifyCashClosing: e.target.checked })
                    }
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.07] cursor-pointer">
                  <span className="text-zinc-300">Solo en segundo plano</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.notifyOnlyWhenBackground}
                    onChange={(e) =>
                      saveBrowserNotificationPrefs({ notifyOnlyWhenBackground: e.target.checked })
                    }
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
          {/* Master Enable Toggle + Last Test Summary */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              config.isEnabled
                ? 'bg-emerald-950/25 border-emerald-500/35'
                : 'bg-[#09090b] border-white/[0.08]'
            }`}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  config.isEnabled ? 'text-emerald-400' : 'text-zinc-500'
                }`}
              />
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                  <span>
                    {config.isEnabled
                      ? 'Envío Automático de Correos Activo'
                      : 'Envío Automático Pausado'}
                  </span>
                  {isLoadingCloud && (
                    <span className="text-[11px] font-normal text-zinc-400">Sincronizando...</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  {config.lastTestStatus
                    ? `Última verificación: ${config.lastTestStatus} (${config.lastTestAt || ''})`
                    : 'Activa el interruptor y guarda tus credenciales para despachar correos automáticamente.'}
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px] shrink-0">
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={(e) => updateField('isEnabled', e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded"
              />
              <span className="text-xs font-semibold text-zinc-200">
                {config.isEnabled ? 'Activo' : 'Activar'}
              </span>
            </label>
          </div>

          {/* Provider Segmented Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-300">
              Proveedor de Envío de Correos
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'resend' as EmailProviderType,
                    title: 'Resend API (Recomendado)',
                    desc: 'Entrega rápida vía HTTPS con API Key (re_...). Ideal para la nube.',
                    icon: Key,
                  },
                  {
                    id: 'smtp' as EmailProviderType,
                    title: 'Servidor SMTP Personalizado',
                    desc: 'Conecta Gmail, Zoho, Brevo o tu propio servidor corporativo.',
                    icon: Server,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = config.provider === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateField('provider', item.id)}
                    className={`p-3.5 rounded-xl border text-left transition-colors min-h-[56px] flex items-start gap-3 ${
                      active
                        ? 'bg-amber-500/10 border-amber-400 text-white'
                        : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        active ? 'text-amber-400' : 'text-zinc-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs sm:text-sm font-bold">{item.title}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider Credentials Section */}
          {config.provider === 'resend' ? (
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Key className="w-4 h-4" />
                  <span>Credenciales de Resend API</span>
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">HTTPS · api.resend.com</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-300 block mb-1">
                    Resend API Key *
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={config.resendApiKey || ''}
                      onChange={(e) => updateField('resendApiKey', e.target.value)}
                      placeholder="re_123456789_TuClaveSecretaResend"
                      className="w-full pl-3.5 pr-11 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white"
                      aria-label={showSecret ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    Correo Remitente (From Email)
                  </label>
                  <input
                    type="email"
                    value={config.fromEmail || ''}
                    onChange={(e) => updateField('fromEmail', e.target.value)}
                    placeholder="onboarding@resend.dev o alertas@tudominio.com"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Si aún no verificas dominio propio en Resend, déjalo vacío para usar onboarding@resend.dev.
                  </span>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    Nombre Remitente (From Name)
                  </label>
                  <input
                    type="text"
                    value={config.fromName || ''}
                    onChange={(e) => updateField('fromName', e.target.value)}
                    placeholder={storeName || 'Smith Solutions Alertas'}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  <span>Parámetros de Servidor SMTP</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SMTP_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setConfig((prev) => ({
                          ...prev,
                          smtpHost: preset.host,
                          smtpPort: preset.port,
                          smtpSecure: preset.secure,
                        }));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#111114] hover:bg-zinc-800 border border-white/[0.08] text-[11px] text-zinc-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">Servidor SMTP (Host) *</label>
                  <input
                    type="text"
                    value={config.smtpHost || ''}
                    onChange={(e) => updateField('smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs text-zinc-300 block mb-1">Puerto *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    value={config.smtpPort ?? 587}
                    onChange={(e) => {
                      const p = Number(e.target.value) || 587;
                      updateField('smtpPort', p);
                      if (p === 465) updateField('smtpSecure', true);
                    }}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono tabular-nums text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-3 flex items-end">
                  <label className="w-full px-3 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl flex items-center justify-between gap-2 cursor-pointer text-xs text-zinc-200">
                    <span>SSL / TLS (465)</span>
                    <input
                      type="checkbox"
                      checked={Boolean(config.smtpSecure)}
                      onChange={(e) => updateField('smtpSecure', e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                  </label>
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">Usuario SMTP *</label>
                  <input
                    type="text"
                    value={config.smtpUser || ''}
                    onChange={(e) => updateField('smtpUser', e.target.value)}
                    placeholder="tucorreo@gmail.com"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">
                    Contraseña / App Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={config.smtpPass || ''}
                      onChange={(e) => updateField('smtpPass', e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full pl-3.5 pr-11 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white"
                      aria-label={showSecret ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">
                    Correo Remitente (Opcional)
                  </label>
                  <input
                    type="email"
                    value={config.fromEmail || ''}
                    onChange={(e) => updateField('fromEmail', e.target.value)}
                    placeholder={config.smtpUser || 'alertas@tutienda.com'}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">Nombre Remitente</label>
                  <input
                    type="text"
                    value={config.fromName || ''}
                    onChange={(e) => updateField('fromName', e.target.value)}
                    placeholder={storeName || 'Smith Solutions'}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Real-Time SMTP Connection Ping Validator Status Box */}
              <div
                aria-live="polite"
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  smtpPingState.status === 'success' && smtpPingState.signature === currentSmtpSignature
                    ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-100'
                    : smtpPingState.status === 'error'
                      ? 'bg-red-950/35 border-red-500/40 text-red-100'
                      : smtpPingState.status === 'checking'
                        ? 'bg-amber-950/25 border-amber-400/40 text-amber-100'
                        : smtpPingState.status === 'incomplete'
                          ? 'bg-zinc-900/90 border-amber-400/25 text-zinc-200'
                          : 'bg-[#111114] border-white/[0.08] text-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {smtpPingState.status === 'checking' ? (
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />
                  ) : smtpPingState.status === 'success' &&
                    smtpPingState.signature === currentSmtpSignature ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : smtpPingState.status === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : smtpPingState.status === 'incomplete' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Activity className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  )}

                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        {smtpPingState.status === 'checking'
                          ? 'Validando servidor SMTP en tiempo real'
                          : smtpPingState.status === 'success' &&
                              smtpPingState.signature === currentSmtpSignature
                            ? 'Conexión SMTP validada'
                            : smtpPingState.status === 'error'
                              ? 'Error en prueba de conexión SMTP'
                              : smtpPingState.status === 'incomplete'
                                ? 'Validación en tiempo real'
                                : 'Validador de conexión SMTP (Ping)'}
                      </span>
                      {typeof smtpPingState.latencyMs === 'number' &&
                        smtpPingState.status === 'success' && (
                          <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
                            · {smtpPingState.latencyMs} ms
                          </span>
                        )}
                      {smtpPingState.checkedAt && smtpPingState.status !== 'checking' && (
                        <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                          · {smtpPingState.checkedAt}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90 break-words">
                      {smtpPingState.message ||
                        'Cada cambio en servidor, puerto o credenciales realiza un ping SMTP automático antes de guardar.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    smtpPingState.status === 'checking' ||
                    isSaving ||
                    Boolean(getSmtpSyntaxIssue(config)) ||
                    !(config.smtpHost || '').trim()
                  }
                  onClick={() => runSmtpPing(config, currentSmtpSignature)}
                  className="px-3 py-2 min-h-[38px] rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.12] hover:border-amber-400/40 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap disabled:opacity-45 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Ping SMTP ahora</span>
                </button>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-zinc-200 block mb-1">
                Correo Principal Receptor *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="email"
                  value={config.recipientEmail}
                  onChange={(e) => updateField('recipientEmail', e.target.value)}
                  placeholder="dueno@tutienda.com"
                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-200 block mb-1">
                Copia Opcional (CC)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={config.secondaryEmail || ''}
                  onChange={(e) => updateField('secondaryEmail', e.target.value)}
                  placeholder="administracion@tutienda.com"
                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Notification Triggers: Critical Stock + Sales Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stock Alerts Card */}
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Alertas de Stock Crítico</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.alertOnCriticalStock}
                  onChange={(e) => updateField('alertOnCriticalStock', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                  aria-label="Activar alertas de stock crítico"
                />
              </div>

              <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer min-h-[36px]">
                <span>Notificar cuando una venta POS baje del stock mínimo</span>
                <input
                  type="checkbox"
                  checked={config.notifyOnPOS}
                  onChange={(e) => updateField('notifyOnPOS', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer min-h-[36px]">
                <span>Notificar al ajustar stock manualmente en Almacén</span>
                <input
                  type="checkbox"
                  checked={config.notifyOnManualAdjustment}
                  onChange={(e) => updateField('notifyOnManualAdjustment', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>

              <div className="pt-1">
                <label className="text-[11px] text-zinc-400 block mb-1">Frecuencia</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('alertFrequency', 'immediate')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      config.alertFrequency === 'immediate'
                        ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                        : 'bg-[#111114] border-white/[0.08] text-zinc-400'
                    }`}
                  >
                    Inmediata
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('alertFrequency', 'daily')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      config.alertFrequency === 'daily'
                        ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                        : 'bg-[#111114] border-white/[0.08] text-zinc-400'
                    }`}
                  >
                    Resumen Diario
                  </button>
                </div>
              </div>
            </div>

            {/* Sales Reports Card */}
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Reportes de Ventas y Rentabilidad</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.sendSalesReports}
                  onChange={(e) => updateField('sendSalesReports', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                  aria-label="Activar envío de reportes de ventas"
                />
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Envía automáticamente facturación USD/Bs, desglose de métodos de pago y ganancia estimada a tu correo.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-400 block">Cuándo despachar reportes</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'per_sale', label: 'Cada Venta' },
                      { id: 'daily_closing', label: 'Cierre Caja' },
                      { id: 'manual', label: 'Solo Manual' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField('salesReportFrequency', opt.id)}
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                        config.salesReportFrequency === opt.id
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                          : 'bg-[#111114] border-white/[0.08] text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums">
                <span>Stock crítico detectado: {lowStockProducts.length}</span>
                <span>Ventas cargadas: {sales.length || orders.length}</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDispatch('test')}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-amber-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {busyAction === 'test' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Probar Conexión</span>
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDispatch('stock_alert')}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {busyAction === 'stock_alert' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Enviar Alerta Stock</span>
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDispatch('sales_report')}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {busyAction === 'sales_report' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Enviar Reporte Ventas</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allowSaveBypassAfterPingFail && config.provider === 'smtp' && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => persistEmailConfig(true)}
                  className="px-3 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-xs text-amber-300 font-semibold disabled:opacity-50"
                >
                  Guardar sin verificar ping
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 min-h-[44px] rounded-xl bg-[#09090b] border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
              >
                Restablecer
              </button>
              <button
                type="submit"
                disabled={isSaving || isVerifyingBeforeSave}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isVerifyingBeforeSave ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>
                  {isVerifyingBeforeSave
                    ? 'Verificando ping SMTP...'
                    : isSaving
                      ? 'Guardando...'
                      : config.provider === 'smtp'
                        ? 'Verificar y Guardar'
                        : 'Guardar Configuración'}
                </span>
              </button>
            </div>
          </div>
        </form>
        </div>
      ) : subTab === 'payment_methods' ? (
        <div className="space-y-5">
          {/* Store Payment Methods Info Header */}
          <div className="p-4 rounded-xl bg-[#09090b] border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Métodos de Pago de la Tienda para Clientes y Caja POS</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Configura y edita tus cuentas receptoras (Zelle, Pago Móvil, Transferencia, Binance Pay). Se guardan en la subcolección <span className="font-mono text-amber-300">store_payment_methods</span> de tu tienda y aparecen al instante en Caja POS.
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-zinc-300 shrink-0">
              Activos: <strong className="text-emerald-300">{storeMethods.filter((m) => m.isActive).length}</strong>
              <span className="text-zinc-600 mx-1.5">·</span>
              Total: <strong className="text-white">{storeMethods.length}</strong>
            </div>
          </div>

          {!isCloudStoreLinked && (
            <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {storeId === 'default-warehouse'
                  ? 'Modo Almacén Individual: tus métodos de pago se guardan localmente para el POS. Selecciona una tienda registrada e inicia sesión con Google para sincronizarlos con store_payment_methods en Firestore.'
                  : 'Inicia sesión con la cuenta Google dueña de la tienda para sincronizar cambios con Firestore (store_payment_methods).'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Form: Add / Edit Store Payment Method */}
            <form
              onSubmit={handleSaveStoreMethod}
              className="lg:col-span-5 min-w-0 bg-[#09090b] border border-white/[0.1] rounded-xl p-4 space-y-3.5 h-fit"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {editingStoreMethod
                        ? `Editar: ${editingStoreMethod.name}`
                        : 'Agregar Método de Cobro'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Tus clientes y cajeros verán estos datos al cobrar ventas.
                  </p>
                </div>
                {editingStoreMethod && (
                  <button
                    type="button"
                    onClick={resetStoreMethodForm}
                    className="px-2.5 py-1 rounded-lg bg-[#111114] border border-white/[0.08] text-[11px] text-zinc-300 hover:text-white whitespace-nowrap shrink-0"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {!editingStoreMethod && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">Plantillas rápidas:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STORE_PAYMENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setPmName(preset.name);
                          setPmCurrency(preset.currency);
                          setPmAppliesIgtf(preset.igtf);
                          setPmDetails((prev) => (prev.trim() ? prev : preset.detailsPlaceholder));
                          setPmInstructions(preset.instructions);
                          setPmActive(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#111114] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/40 text-[11px] text-zinc-200 font-medium transition-colors whitespace-nowrap"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-300 block mb-1">Nombre del Método *</label>
                  <input
                    required
                    type="text"
                    maxLength={80}
                    value={pmName}
                    onChange={(e) => setPmName(e.target.value)}
                    placeholder="Ej: Zelle / Pago Móvil / Transferencia"
                    className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Moneda *</label>
                  <select
                    value={pmCurrency}
                    onChange={(e) => setPmCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="USD">USD</option>
                    <option value="Bs">Bs.</option>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">Titular / Beneficiario</label>
                <input
                  type="text"
                  maxLength={120}
                  value={pmHolder}
                  onChange={(e) => setPmHolder(e.target.value)}
                  placeholder={storeName || 'Titular de la cuenta'}
                  className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  Datos de Cobro (Correo, Teléfono, Banco, Cuenta o Wallet) *
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={pmDetails}
                  onChange={(e) => setPmDetails(e.target.value)}
                  placeholder="Ej: 0134 Banesco · V-XXXXXXXX · 0414-XXXXXXX"
                  className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  Instrucciones para el Cliente (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={pmInstructions}
                  onChange={(e) => setPmInstructions(e.target.value)}
                  placeholder="Ej: Indicar número de factura en el concepto"
                  className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pmAppliesIgtf}
                    onChange={(e) => setPmAppliesIgtf(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span>Aplica IGTF 3% Divisas (POS SENIAT)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pmActive}
                    onChange={(e) => setPmActive(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span>Activo para clientes y visible en Caja POS</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSavingMethod}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSavingMethod
                    ? 'Guardando...'
                    : editingStoreMethod
                      ? 'Actualizar Método de Pago'
                      : 'Guardar Método de Pago'}
                </span>
              </button>
            </form>

            {/* Right Column: Store Configured Payment Methods List */}
            <div className="lg:col-span-7 min-w-0 bg-[#09090b] border border-white/[0.1] rounded-xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Métodos Guardados ({storeMethods.length})
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Edita tus datos bancarios o pausa cualquier método cuando lo necesites.
                  </p>
                </div>

                {storeMethods.length > 2 && (
                  <div className="relative sm:w-56">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pmSearch}
                      onChange={(e) => setPmSearch(e.target.value)}
                      placeholder="Buscar método o cuenta..."
                      className="w-full pl-8 pr-3 py-1.5 min-h-[36px] bg-[#111114] border border-white/[0.08] rounded-lg text-xs text-white"
                    />
                  </div>
                )}
              </div>

              {filteredStoreMethods.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#111114] border border-white/[0.06] text-center space-y-2">
                  <Wallet className="w-7 h-7 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    {storeMethods.length === 0
                      ? 'Aún no has configurado métodos de cobro propios para esta tienda'
                      : 'No hay métodos que coincidan con tu búsqueda'}
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    Usa las plantillas rápidas de Zelle, Pago Móvil o Transferencia para añadir tus datos y verlos al instante en el POS.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5">
                  {filteredStoreMethods.map((method) => (
                    <div
                      key={method.id}
                      className="p-3.5 rounded-xl bg-[#111114] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">{method.name}</span>
                          <span className="text-zinc-500" aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] font-bold text-amber-300">
                            {method.currency}
                          </span>
                          {method.appliesIgtf && (
                            <>
                              <span className="text-zinc-500" aria-hidden="true">·</span>
                              <span className="text-[11px] text-amber-200 font-mono">IGTF 3%</span>
                            </>
                          )}
                          <span className="text-zinc-500" aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              method.isActive ? 'text-emerald-300' : 'text-zinc-400'
                            }`}
                          >
                            {method.isActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{method.isActive ? 'Activo en POS' : 'Pausado'}</span>
                          </span>
                        </div>

                        {method.accountHolder && (
                          <div className="text-zinc-400 text-[11px]">
                            Titular: <span className="text-zinc-200">{method.accountHolder}</span>
                          </div>
                        )}
                        <div className="text-zinc-200 font-mono text-[11px] whitespace-pre-line">
                          {method.accountDetails}
                        </div>
                        {method.instructions && (
                          <div className="text-zinc-400 text-[11px]">{method.instructions}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isSavingMethod}
                          onClick={() => handleToggleStoreMethod(method)}
                          className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                            method.isActive
                              ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                              : 'bg-[#09090b] border-white/[0.1] text-zinc-300'
                          }`}
                        >
                          {method.isActive ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStoreMethod(method);
                            setPmName(method.name);
                            setPmCurrency(method.currency);
                            setPmHolder(method.accountHolder || '');
                            setPmDetails(method.accountDetails);
                            setPmInstructions(method.instructions || '');
                            setPmAppliesIgtf(Boolean(method.appliesIgtf));
                            setPmActive(method.isActive);
                          }}
                          className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                          title="Editar método"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteMethodId === method.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isSavingMethod}
                              onClick={() => handleDeleteStoreMethod(method)}
                              className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMethodId(null)}
                              className="px-2 py-1.5 min-h-[36px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMethodId(method.id)}
                            className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                            title="Eliminar método"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Registro de Envíos Reales por Correo</h3>
              <p className="text-xs text-zinc-400">
                Historial de alertas de stock, reportes de ventas y pruebas SMTP/Resend de esta tienda.
              </p>
            </div>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-3 py-2 min-h-[40px] rounded-lg bg-[#09090b] border border-white/[0.08] text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.08] text-center space-y-2">
              <Mail className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-sm font-semibold text-zinc-200">Sin envíos registrados todavía</p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Configura tu clave Resend API o servidor SMTP y pulsa "Probar Conexión" para verificar la entrega en tu bandeja.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {logs.map((log) => {
                const isErr = log.status === 'Error de Envío';
                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] space-y-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-white">{log.recipientEmail}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isErr
                              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                        {log.timestamp}
                      </span>
                    </div>
                    <div className="font-semibold text-amber-300">{log.subject}</div>
                    <div className="text-zinc-400">{log.triggerEvent}</div>
                    {log.errorDetail && (
                      <div className="text-red-300 bg-red-950/30 border border-red-500/25 rounded-lg p-2">
                        {log.errorDetail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
