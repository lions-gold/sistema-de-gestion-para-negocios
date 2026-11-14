import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Key,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  EmailProviderType,
  Product,
  Sale,
  StockAlertEmailLog,
  StoreEmailConfig,
  StoreOrder,
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
} from '../services/emailDeliveryService';

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
  onConfigSaved?: (config: StoreEmailConfig) => void;
  onLogsUpdated?: (logs: StockAlertEmailLog[]) => void;
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
  onConfigSaved,
  onLogsUpdated,
}) => {
  const [subTab, setSubTab] = useState<'config' | 'history'>('config');
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

  useEffect(() => {
    if (!storeId) return;
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const toSave: StoreEmailConfig = {
        ...config,
        storeId,
        ownerUid,
      };
      await saveStoreEmailConfig(toSave);
      setConfig(toSave);
      onConfigSaved?.(toSave);
      setFeedback({
        type: 'success',
        text: `Configuración de ${toSave.provider === 'resend' ? 'Resend API' : 'SMTP personalizado'} guardada de forma segura para ${storeName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setIsSaving(false);
    }
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
    const fresh = getDefaultStoreEmailConfig(storeId, ownerUid, ownerEmail);
    setConfig(fresh);
    setFeedback(null);
  };

  const handleClearLogs = () => {
    clearStoreEmailLogs(storeId);
    setLogs([]);
    onLogsUpdated?.([]);
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Servidor de Correo (SMTP / Resend API)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configura tu proveedor para recibir alertas reales de stock crítico y reportes de ventas de{' '}
            <strong className="text-zinc-200">{storeName || 'tu tienda'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#09090b] p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('config')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'config'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Credenciales y Reglas
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 min-h-[44px] rounded-xl bg-[#09090b] border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
              >
                Restablecer
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
              </button>
            </div>
          </div>
        </form>
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
