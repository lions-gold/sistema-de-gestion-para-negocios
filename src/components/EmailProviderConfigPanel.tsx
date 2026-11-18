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
import { useLanguage } from '../i18n/LanguageContext';

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
  const { tr } = useLanguage();
  const trRef = React.useRef(tr);
  trRef.current = tr;
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
      const testRes = await sendTestBrowserNotification(storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与POS'));
      setFeedback({
        type: 'success',
        text: testRes.delivered
          ? tr(
              'Notificaciones del navegador activadas. Recibirás avisos en tiempo real por stock crítico y cierres de caja.',
              'Browser notifications enabled. You will receive real-time alerts for critical stock and cash closings.',
              '浏览器通知已启用。您将收到关键库存与结账的实时提醒。'
            )
          : tr(
              'Permiso concedido. Verifica que el navegador no tenga silenciadas las alertas del sitio.',
              'Permission granted. Make sure your browser has not muted site alerts.',
              '已授予权限。请确认浏览器未静音本站通知。'
            ),
      });
    } else if (perm === 'denied') {
      setFeedback({
        type: 'error',
        text: tr(
          'El navegador bloqueó el permiso de notificaciones. Habilítalo desde el icono de candado en la barra de dirección.',
          'Your browser blocked notification permission. Enable it from the lock icon in the address bar.',
          '浏览器屏蔽了通知权限。请点击地址栏的锁形图标启用通知。'
        ),
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
      const res = await sendTestBrowserNotification(storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与POS'));
      setFeedback({
        type: res.delivered ? 'success' : 'error',
        text: res.delivered
          ? tr(
              `Notificación de prueba enviada (${res.channel === 'service_worker' ? 'Service Worker / Segundo Plano' : 'Notification API'}).`,
              `Test notification sent (${res.channel === 'service_worker' ? 'Service Worker / Background' : 'Notification API'}).`,
              `测试通知已发送（${res.channel === 'service_worker' ? 'Service Worker / 后台' : 'Notification API'}）。`
            )
          : tr(
              `No se pudo mostrar la notificación (${res.reason || 'permiso requerido'}).`,
              `Could not display notification (${res.reason || 'permission required'}).`,
              `无法显示通知（${res.reason || '需要权限'}）。`
            ),
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
    const tFn = trRef.current;

    if (!host && !user && !pass) {
      return null;
    }
    if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !host.includes('.')) {
      return tFn(
        'Ingresa un servidor SMTP válido (ej. smtp.gmail.com o smtp-relay.brevo.com).',
        'Enter a valid SMTP host (e.g. smtp.gmail.com or smtp-relay.brevo.com).',
        '请输入有效的 SMTP 服务器地址（如 smtp.gmail.com 或 smtp-relay.brevo.com）。'
      );
    }
    if (host.toLowerCase() === 'mail.tudominio.com') {
      return tFn(
        'Reemplaza "mail.tudominio.com" por el dominio real de tu servidor de correo.',
        'Replace "mail.tudominio.com" with your real mail server domain.',
        '请将 "mail.tudominio.com" 替换为您真实的邮件服务器域名。'
      );
    }
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return tFn(
        'Puerto SMTP inválido. Usa 465 (SSL/TLS) o 587 (STARTTLS).',
        'Invalid SMTP port. Use 465 (SSL/TLS) or 587 (STARTTLS).',
        '无效的 SMTP 端口。请使用 465 (SSL/TLS) 或 587 (STARTTLS)。'
      );
    }
    if (!user) {
      return tFn(
        'Falta el Usuario SMTP para validar la autenticación.',
        'SMTP username is required to validate authentication.',
        '缺少 SMTP 用户名，无法验证身份。'
      );
    }
    if (!pass) {
      return tFn(
        'Falta la Contraseña o App Password SMTP para autenticar el ping.',
        'SMTP password or App Password is required to authenticate the ping.',
        '缺少 SMTP 密码或应用专用密码，无法验证连接。'
      );
    }
    return null;
  };

  const runSmtpPing = React.useCallback(
    async (targetCfg: StoreEmailConfig, sig: string): Promise<SmtpPingResult> => {
      smtpPingAbortRef.current?.abort();
      const controller = new AbortController();
      smtpPingAbortRef.current = controller;
      const seq = ++smtpPingSeqRef.current;
      const tFn = trRef.current;

      smtpPingMetaRef.current = { status: 'checking', signature: sig };
      setSmtpPingState({
        status: 'checking',
        message: tFn(
          `Haciendo ping SMTP a ${(targetCfg.smtpHost || '').trim()}:${Number(targetCfg.smtpPort || 587)}...`,
          `Pinging SMTP ${(targetCfg.smtpHost || '').trim()}:${Number(targetCfg.smtpPort || 587)}...`,
          `正在测试 SMTP 连接 ${(targetCfg.smtpHost || '').trim()}:${Number(targetCfg.smtpPort || 587)}...`
        ),
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
            message: tFn('Verificación reemplazada por cambios recientes.', 'Verification superseded by recent changes.', '验证已被最新修改取代。'),
          };
        }
        const fallback: SmtpPingResult = {
          ok: false,
          stage: 'network',
          message: tFn('No se pudo completar el ping SMTP.', 'Could not complete SMTP ping.', '无法完成 SMTP 连接测试。'),
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
        message: '',
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
            tr(
              'Completa Servidor SMTP (host), Puerto, Usuario y Contraseña antes de guardar.',
              'Complete SMTP Host, Port, Username, and Password before saving.',
              '保存前请填写 SMTP 主机、端口、用户名和密码。'
            );
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
              text: tr(
                `No se guardaron las credenciales porque falló la prueba de conexión (ping) SMTP: ${pingRes.message}`,
                `Credentials were not saved because the SMTP ping test failed: ${pingRes.message}`,
                `由于 SMTP 连接测试失败，未保存凭据：${pingRes.message}`
              ),
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
          text: tr(
            `Conexión SMTP verificada mediante ping (${verifiedLatency ?? 'OK'} ms) y credenciales guardadas de forma segura para ${storeName}.`,
            `SMTP connection verified via ping (${verifiedLatency ?? 'OK'} ms) and credentials saved securely for ${storeName}.`,
            `已通过 Ping 验证 SMTP 连接（${verifiedLatency ?? 'OK'} ms），并为 ${storeName} 安全保存凭据。`
          ),
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
            ? tr(
                `Configuración SMTP guardada sin verificación remota para ${storeName}.`,
                `SMTP configuration saved without remote check for ${storeName}.`,
                `已为 ${storeName} 保存 SMTP 配置（未进行远程验证）。`
              )
            : tr(
                `Configuración de Resend API guardada de forma segura para ${storeName}.`,
                `Resend API configuration saved securely for ${storeName}.`,
                `已为 ${storeName} 安全保存 Resend API 配置。`
              ),
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : tr('No se pudo guardar la configuración.', 'Could not save configuration.', '无法保存配置。'),
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
        periodLabel: tr(
          `Consolidado POS (${sales.length} tickets)`,
          `POS Summary (${sales.length} tickets)`,
          `POS 汇总（${sales.length} 笔）`
        ),
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
      periodLabel: tr(
        `Pedidos Tienda (${activeOrders.length} órdenes)`,
        `Store Orders (${activeOrders.length} orders)`,
        `店铺订单（${activeOrders.length} 笔）`
      ),
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
        name: `${tr('Factura', 'Invoice', '发票')} ${o.invoiceNumber} · ${o.customerName}`,
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
              ? tr(
                  `Envío manual: ${lowStockProducts.length} producto(s) en stock crítico`,
                  `Manual dispatch: ${lowStockProducts.length} critical stock item(s)`,
                  `手动发送：${lowStockProducts.length} 项库存告急商品`
                )
              : tr(
                  'Envío manual de verificación de inventario',
                  'Manual inventory verification dispatch',
                  '手动库存核验发送'
                )
            : action === 'sales_report'
              ? tr(
                  'Reporte de ventas solicitado desde el panel',
                  'Sales report requested from panel',
                  '从面板请求的销售报告'
                )
              : tr(
                  'Prueba de conexión SMTP / Resend API',
                  'SMTP / Resend API connection test',
                  'SMTP / Resend API 连接测试'
                ),
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
        text: tr(
          'Indica el nombre del método de pago y los datos de cobro para tus clientes.',
          'Enter the payment method name and collection details for your customers.',
          '请输入收款方式名称及客户付款账号信息。'
        ),
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
          tr(
            `Método "${cleanName}" guardado localmente para el POS${storeId === 'default-warehouse' ? ' (vincula una tienda para respaldo en la nube).' : ' (se sincronizará cuando tengas conexión).'}`,
            `Method "${cleanName}" saved locally for POS${storeId === 'default-warehouse' ? ' (link a store for cloud backup).' : ' (will sync when online).'}`,
            `收款方式 “${cleanName}” 已本地保存至 POS${storeId === 'default-warehouse' ? '（绑定店铺即可云端备份）。' : '（联网后自动同步）。'}`
          )
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
          ? tr(`Método "${cleanName}" actualizado y listo en Caja POS.`, `Method "${cleanName}" updated and ready in POS Checkout.`, `收款方式 “${cleanName}” 已更新并可在 POS 使用。`)
          : tr(`Método "${cleanName}" guardado para tus clientes y Caja POS.`, `Method "${cleanName}" saved for your customers and POS Checkout.`, `收款方式 “${cleanName}” 已保存至店铺与 POS。`),
      });
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        saveLocallyFallback(
          tr(`Método "${cleanName}" guardado en caché local del POS sin conexión.`, `Method "${cleanName}" saved in offline POS cache.`, `收款方式 “${cleanName}” 已保存在离线 POS 缓存中。`)
        );
      } else {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : tr('No se pudo guardar el método de pago.', 'Could not save payment method.', '无法保存收款方式。'),
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
        text: nextActive
          ? tr(`Método "${method.name}" activado en el POS y tienda.`, `Method "${method.name}" enabled in POS and store.`, `收款方式 “${method.name}” 已在 POS 与店铺启用。`)
          : tr(`Método "${method.name}" pausado.`, `Method "${method.name}" paused.`, `收款方式 “${method.name}” 已暂停。`),
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : tr('No se pudo cambiar el estado del método.', 'Could not toggle method status.', '无法切换收款方式状态。'),
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
        text: tr(`Método de pago "${method.name}" eliminado.`, `Payment method "${method.name}" deleted.`, `收款方式 “${method.name}” 已删除。`),
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : tr('Error eliminando método de pago.', 'Error deleting payment method.', '删除收款方式时出错。'),
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
      detailsPlaceholder: tr('Correo Zelle: cobros@tutienda.com', 'Zelle email: billing@yourstore.com', 'Zelle 邮箱：billing@yourstore.com'),
      instructions: tr('Colocar el número de factura en el concepto de la transferencia.', 'Include the invoice number in the transfer memo.', '请在转账备注中填写发票编号。'),
    },
    {
      name: 'Pago Móvil',
      currency: 'Bs',
      igtf: false,
      detailsPlaceholder: tr('Banco: Banesco (0134) · C.I/RIF: V-XXXXXXXX · Teléfono: 0414-XXXXXXX', 'Bank: Banesco (0134) · ID/Tax ID: V-XXXXXXXX · Phone: 0414-XXXXXXX', '银行：Banesco (0134) · 证件/税号：V-XXXXXXXX · 电话：0414-XXXXXXX'),
      instructions: tr('Calcular monto a la tasa BCV vigente y mostrar referencia.', 'Calculate amount at current BCV rate and show reference.', '按当前 BCV 汇率计算金额并出示参考号。'),
    },
    {
      name: tr('Transferencia Bancaria', 'Bank Transfer', '银行转账'),
      currency: 'Bs',
      igtf: false,
      detailsPlaceholder: tr('Banesco Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX · RIF: J-XXXXXXXX-X', 'Banesco Checking Account: 0134-XXXX-XX-XXXXXXXXXX · Tax ID: J-XXXXXXXX-X', 'Banesco 支票账户：0134-XXXX-XX-XXXXXXXXXX · 税号：J-XXXXXXXX-X'),
      instructions: tr('Transferencia directa en bolívares; verificar acreditación en caja.', 'Direct transfer in bolivares; verify credit at register.', '玻利瓦尔直接转账；请在收银台核实到账。'),
    },
    {
      name: 'Binance Pay',
      currency: 'USDT',
      igtf: false,
      detailsPlaceholder: tr('Binance Pay ID: XXXXXXXXX · Red USDT TRC20/BEP20', 'Binance Pay ID: XXXXXXXXX · USDT Network TRC20/BEP20', 'Binance Pay ID：XXXXXXXXX · USDT 网络 TRC20/BEP20'),
      instructions: tr('Transferencia en USDT sin comisión bancaria.', 'USDT transfer with zero bank fees.', 'USDT 转账零银行手续费。'),
    },
    {
      name: tr('Efectivo USD', 'Cash USD', '美元现金'),
      currency: 'USD',
      igtf: true,
      detailsPlaceholder: tr('Pago en efectivo divisas USD en caja principal', 'USD foreign currency cash payment at main register', '主收银台美元现金付款'),
      instructions: tr('Verificar denominación y estado de billetes al recibir.', 'Verify bill denominations and condition upon receipt.', '收款时请核验钞票面额与品相。'),
    },
    {
      name: 'Zinli',
      currency: 'USD',
      igtf: true,
      detailsPlaceholder: tr('Correo Zinli: cobros@tutienda.com', 'Zinli email: billing@yourstore.com', 'Zinli 邮箱：billing@yourstore.com'),
      instructions: tr('Transferencia instantánea USD desde billetera Zinli.', 'Instant USD transfer from Zinli wallet.', '通过 Zinli 钱包即时转账美元。'),
    },
  ];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{tr('Configuración de Tienda (Correo, Push y Pagos POS)', 'Store Settings (Email, Push & POS Payments)', '店铺配置（邮件、推送与 POS 收款）')}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {tr('Administra alertas de stock, reportes SMTP/Resend y los métodos de cobro propios para clientes de', 'Manage stock alerts, SMTP/Resend reports, and your own payment methods for customers of', '管理库存预警、SMTP/Resend 报告以及以下店铺的专属客户收款方式：')}{' '}
            <strong className="text-zinc-200">{storeName || tr('tu tienda', 'your store', '您的店铺')}</strong>.
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
            {tr('Credenciales y Alertas', 'Credentials & Alerts', '凭据与预警')}
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
            <span>{tr('Métodos de Pago', 'Payment Methods', '收款方式')} ({storeMethods.length})</span>
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
            <span>{tr('Historial', 'History', '记录')} ({logs.length})</span>
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
                    <span>{tr('Notificaciones del Navegador (Tiempo Real y Segundo Plano)', 'Browser Notifications (Real-Time & Background)', '浏览器通知（实时与后台）')}</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {notifPerm === 'unsupported'
                      ? tr('Este navegador no soporta la API de Notification.', 'This browser does not support the Notification API.', '此浏览器不支持 Notification API。')
                      : notifPerm === 'denied'
                        ? tr('Permiso denegado en el navegador. Actívalo manualmente en la configuración del sitio.', 'Permission denied in browser. Enable it manually in site settings.', '浏览器已拒绝权限，请在站点设置中手动开启。')
                        : notifPerm === 'granted'
                          ? tr('Permiso concedido. Los avisos funcionan incluso con la pestaña minimizada o en segundo plano.', 'Permission granted. Alerts work even when the tab is minimized or in the background.', '已授予权限。即使标签页最小化或在后台运行，仍可接收通知。')
                          : tr('Activa las notificaciones push para enterarte al instante de caídas de stock crítico o cierres de caja Z.', 'Enable push notifications for instant alerts on critical low stock or Z cash closings.', '启用推送通知，即时接收严重低库存或 Z 结账提醒。')}
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
                      <span>{tr('Activar Notificaciones', 'Enable Notifications', '开启通知')}</span>
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
                        <span>{tr('Probar Push', 'Test Push', '测试推送')}</span>
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
                        {notifPrefs.enabled ? tr('Push Activo', 'Push Active', '推送已开启') : tr('Push Pausado', 'Push Paused', '推送已暂停')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {notifPerm === 'granted' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.07] cursor-pointer">
                  <span className="text-zinc-300">{tr('Alertas stock crítico', 'Critical stock alerts', '严重低库存预警')}</span>
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
                  <span className="text-zinc-300">{tr('Cierres de caja Z', 'Z Cash Closings', 'Z 结账通知')}</span>
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
                  <span className="text-zinc-300">{tr('Solo en segundo plano', 'Background only', '仅后台运行')}</span>
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
                      ? tr('Envío Automático de Correos Activo', 'Automatic Email Dispatch Active', '自动邮件发送已开启')
                      : tr('Envío Automático Pausado', 'Automatic Dispatch Paused', '自动发送已暂停')}
                  </span>
                  {isLoadingCloud && (
                    <span className="text-[11px] font-normal text-zinc-400">{tr('Sincronizando...', 'Syncing...', '同步中...')}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  {config.lastTestStatus
                    ? `${tr('Última verificación:', 'Last verification:', '上次验证：')} ${config.lastTestStatus} (${config.lastTestAt || ''})`
                    : tr('Activa el interruptor y guarda tus credenciales para despachar correos automáticamente.', 'Enable the switch and save your credentials to dispatch emails automatically.', '开启开关并保存凭据即可自动发送邮件。')}
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
                {config.isEnabled ? tr('Activo', 'Active', '已启用') : tr('Activar', 'Enable', '启用')}
              </span>
            </label>
          </div>

          {/* Provider Segmented Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-300">
              {tr('Proveedor de Envío de Correos', 'Email Delivery Provider', '邮件发送服务商')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'resend' as EmailProviderType,
                    title: tr('Resend API (Recomendado)', 'Resend API (Recommended)', 'Resend API（推荐）'),
                    desc: tr('Entrega rápida vía HTTPS con API Key (re_...). Ideal para la nube.', 'Fast HTTPS delivery with API Key (re_...). Ideal for cloud.', '通过 HTTPS 与 API 密钥快速投递，云端首选。'),
                    icon: Key,
                  },
                  {
                    id: 'smtp' as EmailProviderType,
                    title: tr('Servidor SMTP Personalizado', 'Custom SMTP Server', '自定义 SMTP 服务器'),
                    desc: tr('Conecta Gmail, Zoho, Brevo o tu propio servidor corporativo.', 'Connect Gmail, Zoho, Brevo, or your corporate server.', '连接 Gmail、Zoho、Brevo 或企业自建服务器。'),
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
                  <span>{tr('Credenciales de Resend API', 'Resend API Credentials', 'Resend API 凭据')}</span>
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
                      placeholder="re_123456789_..."
                      className="w-full pl-3.5 pr-11 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white"
                      aria-label={showSecret ? tr('Ocultar clave', 'Hide key', '隐藏密钥') : tr('Mostrar clave', 'Show key', '显示密钥')}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Correo Remitente (From Email)', 'Sender Email (From)', '发件人邮箱 (From)')}
                  </label>
                  <input
                    type="email"
                    value={config.fromEmail || ''}
                    onChange={(e) => updateField('fromEmail', e.target.value)}
                    placeholder={tr('onboarding@resend.dev o alertas@tudominio.com', 'onboarding@resend.dev or alerts@yourdomain.com', 'onboarding@resend.dev 或 alerts@yourdomain.com')}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    {tr('Si aún no verificas dominio propio en Resend, déjalo vacío para usar onboarding@resend.dev.', 'If you have not verified a custom domain in Resend yet, leave empty to use onboarding@resend.dev.', '如尚未在 Resend 验证自有域名，请留空以使用 onboarding@resend.dev。')}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Nombre Remitente (From Name)', 'Sender Name (From)', '发件人名称 (From Name)')}
                  </label>
                  <input
                    type="text"
                    value={config.fromName || ''}
                    onChange={(e) => updateField('fromName', e.target.value)}
                    placeholder={storeName || tr('Smith Solutions Alertas', 'Smith Solutions Alerts', 'Smith Solutions 预警')}
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
                  <span>{tr('Parámetros de Servidor SMTP', 'SMTP Server Parameters', 'SMTP 服务器参数')}</span>
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
                      {preset.label === 'cPanel / Corporativo SSL'
                        ? tr('cPanel / Corporativo SSL', 'cPanel / Corporate SSL', 'cPanel / 企业 SSL')
                        : preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Servidor SMTP (Host) *', 'SMTP Server (Host) *', 'SMTP 服务器 (Host) *')}</label>
                  <input
                    type="text"
                    value={config.smtpHost || ''}
                    onChange={(e) => updateField('smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Puerto *', 'Port *', '端口 *')}</label>
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
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Usuario SMTP *', 'SMTP Username *', 'SMTP 用户名 *')}</label>
                  <input
                    type="text"
                    value={config.smtpUser || ''}
                    onChange={(e) => updateField('smtpUser', e.target.value)}
                    placeholder={tr('tucorreo@gmail.com', 'youremail@gmail.com', 'youremail@gmail.com')}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Contraseña / App Password *', 'Password / App Password *', '密码 / 应用专用密码 *')}
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
                      aria-label={showSecret ? tr('Ocultar contraseña', 'Hide password', '隐藏密码') : tr('Mostrar contraseña', 'Show password', '显示密码')}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Correo Remitente (Opcional)', 'Sender Email (Optional)', '发件人邮箱（可选）')}
                  </label>
                  <input
                    type="email"
                    value={config.fromEmail || ''}
                    onChange={(e) => updateField('fromEmail', e.target.value)}
                    placeholder={config.smtpUser || tr('alertas@tutienda.com', 'alerts@yourstore.com', 'alerts@yourstore.com')}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Nombre Remitente', 'Sender Name', '发件人名称')}</label>
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
                          ? tr('Validando servidor SMTP en tiempo real', 'Validating SMTP server in real time', '正在实时验证 SMTP 服务器')
                          : smtpPingState.status === 'success' &&
                              smtpPingState.signature === currentSmtpSignature
                            ? tr('Conexión SMTP validada', 'SMTP connection verified', 'SMTP 连接已验证')
                            : smtpPingState.status === 'error'
                              ? tr('Error en prueba de conexión SMTP', 'SMTP connection test error', 'SMTP 连接测试失败')
                              : smtpPingState.status === 'incomplete'
                                ? tr('Validación en tiempo real', 'Real-time validation', '实时验证')
                                : tr('Validador de conexión SMTP (Ping)', 'SMTP connection validator (Ping)', 'SMTP 连接验证器（Ping）')}
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
                        tr('Cada cambio en servidor, puerto o credenciales realiza un ping SMTP automático antes de guardar.', 'Every change in host, port, or credentials triggers an automatic SMTP ping before saving.', '每次修改服务器、端口或凭据都会在保存前自动执行 SMTP Ping。')}
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
                  <span>{tr('Ping SMTP ahora', 'Ping SMTP now', '立即 Ping SMTP')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-zinc-200 block mb-1">
                {tr('Correo Principal Receptor *', 'Primary Recipient Email *', '主要收件人邮箱 *')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="email"
                  value={config.recipientEmail}
                  onChange={(e) => updateField('recipientEmail', e.target.value)}
                  placeholder={tr('dueno@tutienda.com', 'owner@yourstore.com', 'owner@yourstore.com')}
                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-200 block mb-1">
                {tr('Copia Opcional (CC)', 'Optional Copy (CC)', '可选抄送 (CC)')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={config.secondaryEmail || ''}
                  onChange={(e) => updateField('secondaryEmail', e.target.value)}
                  placeholder={tr('administracion@tutienda.com', 'admin@yourstore.com', 'admin@yourstore.com')}
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
                  <span>{tr('Alertas de Stock Crítico', 'Critical Stock Alerts', '临界库存预警')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.alertOnCriticalStock}
                  onChange={(e) => updateField('alertOnCriticalStock', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                  aria-label={tr('Activar alertas de stock crítico', 'Enable critical stock alerts', '启用临界库存预警')}
                />
              </div>

              <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer min-h-[36px]">
                <span>{tr('Notificar cuando una venta POS baje del stock mínimo', 'Notify when a POS sale drops below min stock', '当 POS 销售低于最低库存时通知')}</span>
                <input
                  type="checkbox"
                  checked={config.notifyOnPOS}
                  onChange={(e) => updateField('notifyOnPOS', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer min-h-[36px]">
                <span>{tr('Notificar al ajustar stock manualmente en Almacén', 'Notify on manual Warehouse stock adjustment', '仓库手动调整库存时通知')}</span>
                <input
                  type="checkbox"
                  checked={config.notifyOnManualAdjustment}
                  onChange={(e) => updateField('notifyOnManualAdjustment', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>

              <div className="pt-1">
                <label className="text-[11px] text-zinc-400 block mb-1">{tr('Frecuencia', 'Frequency', '频率')}</label>
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
                    {tr('Inmediata', 'Immediate', '立即')}
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
                    {tr('Resumen Diario', 'Daily Summary', '每日汇总')}
                  </button>
                </div>
              </div>
            </div>

            {/* Sales Reports Card */}
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>{tr('Reportes de Ventas y Rentabilidad', 'Sales & Profitability Reports', '销售与盈利报告')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.sendSalesReports}
                  onChange={(e) => updateField('sendSalesReports', e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                  aria-label={tr('Activar envío de reportes de ventas', 'Enable sales report delivery', '启用销售报告发送')}
                />
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {tr(
                  'Envía automáticamente facturación USD/Bs, desglose de métodos de pago y ganancia estimada a tu correo.',
                  'Automatically sends USD/Bs revenue, payment method breakdown, and estimated profit to your email.',
                  '自动将 USD/Bs 营业额、支付方式明细及预估利润发送到您的邮箱。'
                )}
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-400 block">{tr('Cuándo despachar reportes', 'When to send reports', '何时发送报告')}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'per_sale', label: tr('Cada Venta', 'Every Sale', '每笔销售') },
                      { id: 'daily_closing', label: tr('Cierre Caja', 'Daily Close', '每日结账') },
                      { id: 'manual', label: tr('Solo Manual', 'Manual Only', '仅手动') },
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
                <span>{tr('Stock crítico detectado:', 'Critical stock detected:', '检测到临界库存：')} {lowStockProducts.length}</span>
                <span>{tr('Ventas cargadas:', 'Loaded sales:', '已加载销售：')} {sales.length || orders.length}</span>
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
                <span>{tr('Probar Conexión', 'Test Connection', '测试连接')}</span>
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
                <span>{tr('Enviar Alerta Stock', 'Send Stock Alert', '发送库存预警')}</span>
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
                <span>{tr('Enviar Reporte Ventas', 'Send Sales Report', '发送销售报告')}</span>
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
                  {tr('Guardar sin verificar ping', 'Save without ping check', '跳过 Ping 验证并保存')}
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 min-h-[44px] rounded-xl bg-[#09090b] border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
              >
                {tr('Restablecer', 'Reset', '重置')}
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
                    ? tr('Verificando ping SMTP...', 'Verifying SMTP ping...', '正在验证 SMTP Ping...')
                    : isSaving
                      ? tr('Guardando...', 'Saving...', '正在保存...')
                      : config.provider === 'smtp'
                        ? tr('Verificar y Guardar', 'Verify & Save', '验证并保存')
                        : tr('Guardar Configuración', 'Save Configuration', '保存配置')}
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
                <span>{tr('Métodos de Pago de la Tienda para Clientes y Caja POS', 'Store Payment Methods for Customers & POS', '商店收款方式（供客户与 POS 收银使用）')}</span>
              </h3>
              <p className="text-xs text-zinc-400">
                {tr(
                  'Configura y edita tus cuentas receptoras (Zelle, Pago Móvil, Transferencia, Binance Pay). Se guardan en la subcolección store_payment_methods de tu tienda y aparecen al instante en Caja POS.',
                  'Configure and edit your receiving accounts (Zelle, Pago Móvil, Bank Transfer, Binance Pay). Saved in your store payment collection and synced immediately to POS.',
                  '配置并编辑您的收款账户（Zelle、Pago Móvil、银行转账、Binance Pay）。将保存至商店收款集合并即时同步至 POS。'
                )}
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-zinc-300 shrink-0">
              {tr('Activos:', 'Active:', '启用：')} <strong className="text-emerald-300">{storeMethods.filter((m) => m.isActive).length}</strong>
              <span className="text-zinc-600 mx-1.5">·</span>
              {tr('Total:', 'Total:', '总计：')} <strong className="text-white">{storeMethods.length}</strong>
            </div>
          </div>

          {!isCloudStoreLinked && (
            <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {storeId === 'default-warehouse'
                  ? tr(
                      'Modo Almacén Individual: tus métodos de pago se guardan localmente para el POS. Selecciona una tienda registrada e inicia sesión con Google para sincronizarlos en la nube.',
                      'Standalone Warehouse Mode: your payment methods are saved locally for POS. Select a registered store and sign in with Google to sync them to the cloud.',
                      '独立仓库模式：您的收款方式保存在本地供 POS 使用。选择已注册商店并使用 Google 登录即可云端同步。'
                    )
                  : tr(
                      'Inicia sesión con la cuenta Google dueña de la tienda para sincronizar cambios en la nube.',
                      'Sign in with the store owner Google account to sync changes to the cloud.',
                      '请使用店主 Google 账号登录以将更改同步至云端。'
                    )}
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
                        ? `${tr('Editar:', 'Edit:', '编辑：')} ${editingStoreMethod.name}`
                        : tr('Agregar Método de Cobro', 'Add Payment Method', '添加收款方式')}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {tr('Tus clientes y cajeros verán estos datos al cobrar ventas.', 'Your customers and cashiers will see these details at checkout.', '您的客户和收银员在结账时将看到这些信息。')}
                  </p>
                </div>
                {editingStoreMethod && (
                  <button
                    type="button"
                    onClick={resetStoreMethodForm}
                    className="px-2.5 py-1 rounded-lg bg-[#111114] border border-white/[0.08] text-[11px] text-zinc-300 hover:text-white whitespace-nowrap shrink-0"
                  >
                    {tr('Cancelar', 'Cancel', '取消')}
                  </button>
                )}
              </div>

              {!editingStoreMethod && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">{tr('Plantillas rápidas:', 'Quick templates:', '快速模板：')}</div>
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
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Nombre del Método *', 'Method Name *', '方式名称 *')}</label>
                  <input
                    required
                    type="text"
                    maxLength={80}
                    value={pmName}
                    onChange={(e) => setPmName(e.target.value)}
                    placeholder={tr('Ej: Zelle / Pago Móvil / Transferencia', 'Ex: Zelle / Mobile Pay / Bank Transfer', '例：Zelle / 移动支付 / 银行转账')}
                    className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Moneda *', 'Currency *', '货币 *')}</label>
                  <select
                    value={pmCurrency}
                    onChange={(e) => setPmCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="USD">USD</option>
                    <option value="Bs">Bs.</option>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">{tr('Titular / Beneficiario', 'Account Holder / Beneficiary', '持有人 / 收款人')}</label>
                <input
                  type="text"
                  maxLength={120}
                  value={pmHolder}
                  onChange={(e) => setPmHolder(e.target.value)}
                  placeholder={storeName || tr('Titular de la cuenta', 'Account holder name', '账户持有人')}
                  className="w-full px-3 py-2 min-h-[42px] bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr('Datos de Cobro (Correo, Teléfono, Banco, Cuenta o Wallet) *', 'Payment Details (Email, Phone, Bank, Account or Wallet) *', '收款信息（邮箱、电话、银行、账号或钱包）*') }
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={pmDetails}
                  onChange={(e) => setPmDetails(e.target.value)}
                  placeholder={tr('Ej: 0134 Banesco · V-XXXXXXXX · 0414-XXXXXXX', 'Ex: Bank Account / Email / Wallet ID', '例：银行账号 / 邮箱 / 钱包地址')}
                  className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr('Instrucciones para el Cliente (Opcional)', 'Customer Instructions (Optional)', '客户付款说明（可选）')}
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={pmInstructions}
                  onChange={(e) => setPmInstructions(e.target.value)}
                  placeholder={tr('Ej: Indicar número de factura en el concepto', 'Ex: Include invoice number in payment memo', '例：请在转账备注中注明发票号')}
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
                  <span>{tr('Aplica IGTF 3% Divisas (POS SENIAT)', 'Applies 3% Foreign Currency IGTF Tax (POS)', '适用 3% 外汇交易税 IGTF（POS）')}</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pmActive}
                    onChange={(e) => setPmActive(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span>{tr('Activo para clientes y visible en Caja POS', 'Active for customers & visible in POS', '对客户启用并在 POS 收银台显示')}</span>
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
                    ? tr('Guardando...', 'Saving...', '正在保存...')
                    : editingStoreMethod
                      ? tr('Actualizar Método de Pago', 'Update Payment Method', '更新收款方式')
                      : tr('Guardar Método de Pago', 'Save Payment Method', '保存收款方式')}
                </span>
              </button>
            </form>

            {/* Right Column: Store Configured Payment Methods List */}
            <div className="lg:col-span-7 min-w-0 bg-[#09090b] border border-white/[0.1] rounded-xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {tr('Métodos Guardados', 'Saved Methods', '已保存方式')} ({storeMethods.length})
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {tr('Edita tus datos bancarios o pausa cualquier método cuando lo necesites.', 'Edit your bank details or pause any method whenever needed.', '可随时编辑银行信息或暂停任一收款方式。')}
                  </p>
                </div>

                {storeMethods.length > 2 && (
                  <div className="relative sm:w-56">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pmSearch}
                      onChange={(e) => setPmSearch(e.target.value)}
                      placeholder={tr('Buscar método o cuenta...', 'Search method or account...', '搜索方式或账户...')}
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
                      ? tr('Aún no has configurado métodos de cobro propios para esta tienda', 'You have not configured store payment methods yet', '您尚未为此商店配置专属收款方式')
                      : tr('No hay métodos que coincidan con tu búsqueda', 'No methods match your search', '没有符合搜索条件的收款方式')}
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    {tr(
                      'Usa las plantillas rápidas de Zelle, Pago Móvil o Transferencia para añadir tus datos y verlos al instante en el POS.',
                      'Use the quick templates for Zelle, Pago Móvil, or Transfer to add your details and see them instantly in POS.',
                      '使用 Zelle、Pago Móvil 或转账快速模板添加账户信息，即可立即在 POS 中使用。'
                    )}
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
                            <span>{method.isActive ? tr('Activo en POS', 'Active in POS', 'POS 启用中') : tr('Pausado', 'Paused', '已暂停')}</span>
                          </span>
                        </div>

                        {method.accountHolder && (
                          <div className="text-zinc-400 text-[11px]">
                            {tr('Titular:', 'Holder:', '持有人：')} <span className="text-zinc-200">{method.accountHolder}</span>
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
                          {method.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Enable', '启用')}
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
                          title={tr('Editar método', 'Edit method', '编辑方式')}
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
                              {tr('Confirmar', 'Confirm', '确认')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMethodId(null)}
                              className="px-2 py-1.5 min-h-[36px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                            >
                              {tr('No', 'No', '取消')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMethodId(method.id)}
                            className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                            title={tr('Eliminar método', 'Delete method', '删除方式')}
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
              <h3 className="text-sm font-bold text-white">{tr('Registro de Envíos Reales por Correo', 'Real Email Delivery Log', '真实邮件发送记录')}</h3>
              <p className="text-xs text-zinc-400">
                {tr('Historial de alertas de stock, reportes de ventas y pruebas SMTP/Resend de esta tienda.', 'History of stock alerts, sales reports, and SMTP/Resend tests for this store.', '此商店的库存预警、销售报告及 SMTP/Resend 测试历史记录。')}
              </p>
            </div>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-3 py-2 min-h-[40px] rounded-lg bg-[#09090b] border border-white/[0.08] text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr('Limpiar', 'Clear', '清空')}</span>
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.08] text-center space-y-2">
              <Mail className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-sm font-semibold text-zinc-200">{tr('Sin envíos registrados todavía', 'No emails logged yet', '尚无邮件发送记录')}</p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {tr(
                  'Configura tu clave Resend API o servidor SMTP y pulsa "Probar Conexión" para verificar la entrega en tu bandeja.',
                  'Configure your Resend API key or SMTP server and click "Test Connection" to verify inbox delivery.',
                  '配置您的 Resend API 密钥或 SMTP 服务器并点击“测试连接”以验证收件箱投递。'
                )}
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
                          {isErr ? tr('Error de Envío', 'Delivery Error', '发送失败') : tr('Enviado', 'Sent', '已发送')}
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
