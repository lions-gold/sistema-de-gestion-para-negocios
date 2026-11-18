import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CloudOff,
  Download,
  RefreshCw,
  CheckCircle2,
  Database,
  ChevronDown,
  ChevronUp,
  WifiOff,
  Wifi,
  ShoppingBag,
  FileSpreadsheet,
  HardDrive,
  Package,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import {
  exportOfflineBackupJSON,
  exportOfflineSalesCSV,
  getOfflineDataSummary,
  getOfflineQueue,
  OfflineDataSummary,
  OfflineQueueItem,
  subscribeOfflineQueue,
  syncPendingOfflineActions,
} from '../services/offlineSyncService';
import { useLanguage } from '../i18n/LanguageContext';

interface OfflineSyncBannerProps {
  user: User | null;
  onRequestLogin?: () => Promise<unknown>;
  isPanelOpen?: boolean;
  onTogglePanel?: () => void;
  onSynced?: (syncedCount: number) => void;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  user,
  onRequestLogin,
  isPanelOpen = false,
  onTogglePanel,
  onSynced,
}) => {
  const { lang, tr } = useLanguage();
  const { isOnline, isNavigatorOnline, isManualOffline, setManualOffline, wasOffline } =
    useOnlineStatus();
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [summary, setSummary] = useState<OfflineDataSummary>(() => getOfflineDataSummary());
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResultNote, setSyncResultNote] = useState<string | null>(null);

  const isExpanded = isPanelOpen || internalExpanded;

  const refreshSummary = (nextQueue?: OfflineQueueItem[]) => {
    if (nextQueue) setQueue(nextQueue);
    setSummary(getOfflineDataSummary());
  };

  useEffect(() => {
    const unsub = subscribeOfflineQueue((next) => {
      refreshSummary(next);
    });
    const refreshInterval = setInterval(() => {
      setSummary(getOfflineDataSummary());
    }, 5000);
    return () => {
      unsub();
      clearInterval(refreshInterval);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    if (!user || !user.emailVerified) {
      if (onRequestLogin) {
        setIsSyncing(true);
        setSyncResultNote(null);
        try {
          await onRequestLogin();
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : tr(
                  'No se pudo iniciar sesión con Google.',
                  'Could not sign in with Google.',
                  '无法通过 Google 登录。'
                );
          setSyncResultNote(msg);
          setTimeout(() => setSyncResultNote(null), 6500);
        } finally {
          setIsSyncing(false);
        }
      }
      return;
    }
    setIsSyncing(true);
    setSyncResultNote(null);
    try {
      const res = await syncPendingOfflineActions(user);
      refreshSummary();
      if (res.synced > 0) {
        onSynced?.(res.synced);
        setSyncResultNote(
          lang === 'en'
            ? `Synced ${res.synced} local record(s) to cloud.`
            : lang === 'zh'
              ? `已将 ${res.synced} 条本地数据同步至云端。`
              : `${res.synced} operación(es) locales sincronizadas con la nube.`
        );
        setTimeout(() => setSyncResultNote(null), 5000);
      } else if (res.remaining > 0) {
        setSyncResultNote(
          lang === 'en'
            ? `${res.remaining} operation(s) still waiting for stable connection.`
            : lang === 'zh'
              ? `${res.remaining} 条操作仍在等待稳定网络连接。`
              : `${res.remaining} operación(es) aún esperan conexión estable con el servidor.`
        );
        setTimeout(() => setSyncResultNote(null), 5000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleExpand = () => {
    if (onTogglePanel) {
      onTogglePanel();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  // Only hide banner if online, not recovering, zero pending items, no feedback note, and drawer closed
  if (isOnline && !wasOffline && queue.length === 0 && !syncResultNote && !isPanelOpen) {
    return null;
  }

  const copy = {
    es: {
      offlineNoSignal: 'Sin señal de internet · Modo Offline Activo',
      offlineManual: 'Modo Offline Manual Activo · Guardado local priorizado',
      offlineDesc:
        'Productos vendidos, POS, inventario, facturas PDF, caja y catálogos siguen operando localmente.',
      restoredTitle: 'Conexión restablecida',
      readyOnlineTitle: 'Respaldo Offline y Datos Cacheados Disponibles',
      pendingCount: (n: number) => `${n} operación(es) en cola local`,
      soldBadge: (salesCount: number, usd: number) =>
        `${salesCount} venta(s) offline · $${usd.toFixed(2)}`,
      leadsNote: (n: number) => `${n} contacto(s) local(es)`,
      syncNow: 'Sincronizar ahora',
      signInToSync: 'Iniciar sesión Google para sincronizar',
      backupBtn: 'Respaldo JSON',
      exportSalesCsv: 'Exportar Ventas CSV',
      forceOfflineBtn: 'Activar Modo Offline',
      returnOnlineBtn: 'Volver a Red',
      detailsBtn: isExpanded ? 'Ocultar datos' : 'Ver datos locales',
      soldCardTitle: 'Productos Vendidos en Cola',
      opsCardTitle: 'Inventario / Caja / Correos',
      cacheCardTitle: 'Datos Suministrados en Caché',
      storageCardTitle: 'Motor y Última Sincronización',
      recentSalesHeading: 'Ventas y productos vendidos salvaguardados offline',
      noPendingSales:
        'No hay ventas pendientes por sincronizar. Todas las ventas en caché están respaldadas en IndexedDB y LocalStorage.',
    },
    en: {
      offlineNoSignal: 'No internet signal · Offline Mode Active',
      offlineManual: 'Manual Offline Mode Active · Prioritizing local storage',
      offlineDesc:
        'Sold products, POS, inventory, PDF invoices, cash register, and catalogs remain operational locally.',
      restoredTitle: 'Connection restored',
      readyOnlineTitle: 'Offline Backup & Cached Platform Data Ready',
      pendingCount: (n: number) => `${n} operation(s) queued locally`,
      soldBadge: (salesCount: number, usd: number) =>
        `${salesCount} offline sale(s) · $${usd.toFixed(2)}`,
      leadsNote: (n: number) => `${n} local lead(s)`,
      syncNow: 'Sync now',
      signInToSync: 'Sign in with Google to sync',
      backupBtn: 'JSON Backup',
      exportSalesCsv: 'Export Sales CSV',
      forceOfflineBtn: 'Enable Offline Mode',
      returnOnlineBtn: 'Reconnect Online',
      detailsBtn: isExpanded ? 'Hide details' : 'View local data',
      soldCardTitle: 'Queued Sold Products',
      opsCardTitle: 'Inventory / Cash / Emails',
      cacheCardTitle: 'Cached Platform Data',
      storageCardTitle: 'Storage & Last Sync',
      recentSalesHeading: 'Offline safeguarded sales and sold items',
      noPendingSales:
        'No pending sales waiting to sync. Cached platform data is safely stored in IndexedDB & LocalStorage.',
    },
    zh: {
      offlineNoSignal: '无网络信号 · 离线模式已启用',
      offlineManual: '手动离线模式已启用 · 优先本地保存',
      offlineDesc: '已售商品、POS、库存、PDF 发票、收银与目录均可在本地持续运行。',
      restoredTitle: '网络已恢复',
      readyOnlineTitle: '离线备份与本地平台缓存数据已就绪',
      pendingCount: (n: number) => `${n} 条本地操作待同步`,
      soldBadge: (salesCount: number, usd: number) =>
        `${salesCount} 笔离线销售 · $${usd.toFixed(2)}`,
      leadsNote: (n: number) => `${n} 条本地联系记录`,
      syncNow: '立即同步',
      signInToSync: '登录 Google 以同步',
      backupBtn: '导出 JSON 备份',
      exportSalesCsv: '导出销售 CSV',
      forceOfflineBtn: '开启离线模式',
      returnOnlineBtn: '恢复联网',
      detailsBtn: isExpanded ? '收起详情' : '查看本地数据',
      soldCardTitle: '待同步已售商品',
      opsCardTitle: '库存 / 收银 / 邮件队列',
      cacheCardTitle: '本地缓存平台数据',
      storageCardTitle: '存储引擎与上次同步',
      recentSalesHeading: '本地保护的离线销售订单',
      noPendingSales: '暂无待同步销售记录。缓存数据已安全保存于 IndexedDB 与 LocalStorage。',
    },
  }[lang];

  const mainTitle = !isNavigatorOnline
    ? copy.offlineNoSignal
    : isManualOffline
      ? copy.offlineManual
      : syncResultNote || (wasOffline ? copy.restoredTitle : copy.readyOnlineTitle);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b text-xs transition-colors ${
        !isOnline
          ? 'bg-amber-950/65 border-amber-500/35 text-amber-100'
          : queue.length > 0
            ? 'bg-zinc-900/95 border-amber-500/30 text-zinc-100'
            : 'bg-emerald-950/45 border-emerald-500/30 text-emerald-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          {!isOnline ? (
            <CloudOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div className="min-w-0">
            <span className="font-semibold">{mainTitle}</span>
            {!isOnline && (
              <span className="hidden lg:inline text-amber-200/80 ml-2">— {copy.offlineDesc}</span>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 sm:mt-0 sm:inline-flex sm:ml-2.5">
              {summary.pendingSoldProductsCount > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 font-semibold tabular-nums">
                  <ShoppingBag className="w-3 h-3" />
                  {copy.soldBadge(summary.pendingSoldProductsCount, summary.pendingSoldUSD)}
                </span>
              )}
              {(queue.length > 0 || summary.leadsCount > 0) && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-200 tabular-nums">
                  <Database className="w-3 h-3 text-amber-400" />
                  {queue.length > 0
                    ? copy.pendingCount(queue.length)
                    : copy.leadsNote(summary.leadsCount)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {isOnline && queue.length > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 min-h-[38px] rounded-md bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{user && user.emailVerified ? copy.syncNow : copy.signInToSync}</span>
            </button>
          )}

          {isManualOffline ? (
            <button
              type="button"
              onClick={() => setManualOffline(false)}
              disabled={!isNavigatorOnline}
              title={
                isNavigatorOnline
                  ? tr(
                      'Desactivar modo offline manual y sincronizar',
                      'Disable manual offline mode and sync',
                      '关闭手动离线模式并立即同步'
                    )
                  : tr(
                      'Esperando señal de internet',
                      'Waiting for internet connection',
                      '正在等待网络连接'
                    )
              }
              className="px-3 py-1.5 min-h-[38px] rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{copy.returnOnlineBtn}</span>
            </button>
          ) : (
            isNavigatorOnline && (
              <button
                type="button"
                onClick={() => setManualOffline(true)}
                className="px-3 py-1.5 min-h-[38px] rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.12] text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>{copy.forceOfflineBtn}</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleToggleExpand}
            className="px-3 py-1.5 min-h-[38px] rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.12] text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{copy.detailsBtn}</span>
          </button>

          <button
            type="button"
            onClick={exportOfflineBackupJSON}
            className="px-3 py-1.5 min-h-[38px] rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.12] text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{copy.backupBtn}</span>
          </button>
        </div>
      </div>

      {/* Expandable Local Data & Sold Products Inspector */}
      {isExpanded && (
        <div className="border-t border-white/[0.08] bg-[#0d0d10]">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08]">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span>{copy.soldCardTitle}</span>
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-base font-bold text-zinc-50 font-mono tabular-nums">
                  {summary.pendingSoldProductsCount} {tr('ventas', 'sales', '笔销售')} · $
                  {summary.pendingSoldUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                  {summary.pendingSoldUnitsCount}{' '}
                  {tr('unidad(es) vendida(s) en cola local', 'unit(s) queued locally', '件本地待同步商品')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08]">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span>{copy.opsCardTitle}</span>
                  <Package className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-base font-bold text-zinc-50 font-mono tabular-nums">
                  {summary.pendingInventoryOpsCount} {tr('ajuste(s)', 'adj.', '次调整')} ·{' '}
                  {summary.pendingEmailsCount} {tr('email(s)', 'email(s)', '封邮件')}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                  {summary.pendingOtherOpsCount} {tr('evento(s) asistente', 'assistant event(s)', '条助手事件')} ·{' '}
                  {summary.leadsCount} {tr('lead(s)', 'lead(s)', '条线索')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08]">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span>{copy.cacheCardTitle}</span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-base font-bold text-zinc-50 font-mono tabular-nums">
                  {summary.cachedStoresCount} {tr('tiendas', 'stores', '家店铺')} ·{' '}
                  {summary.cachedProductsTotalCount} {tr('prods', 'items', '件商品')}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                  {summary.cachedWarehousesCount} {tr('almacén(es)', 'warehouse(s)', '个仓库')} · BCV:{' '}
                  {summary.cachedBcvValue ? `${summary.cachedBcvValue.toFixed(2)} Bs.` : tr('Base', 'Base', '基准')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08]">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span>{copy.storageCardTitle}</span>
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-zinc-50">
                  {summary.indexedDbReady
                    ? 'IndexedDB + LocalStorage'
                    : tr('LocalStorage Activo', 'LocalStorage Active', 'LocalStorage 已启用')}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                  {summary.lastSyncAt
                    ? new Date(summary.lastSyncAt).toLocaleString(
                        lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'es-VE',
                        {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }
                      )
                    : tr(
                        'Sin sincronización previa en esta sesión',
                        'No sync yet in this session',
                        '本次会话尚未同步'
                      )}
                </div>
              </div>
            </div>

            {/* Queued Sold Products Ledger */}
            <div className="p-3.5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-100">
                  {copy.recentSalesHeading}
                </span>
                <button
                  type="button"
                  onClick={exportOfflineSalesCSV}
                  className="px-3 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copy.exportSalesCsv}</span>
                </button>
              </div>

              {summary.pendingSalesList.length === 0 ? (
                <p className="text-[11px] text-zinc-400">{copy.noPendingSales}</p>
              ) : (
                <div className="divide-y divide-white/[0.06] max-h-52 overflow-y-auto">
                  {summary.pendingSalesList.map((saleItem) => (
                    <div
                      key={saleItem.id}
                      className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-amber-300">
                            #{saleItem.receiptNumber}
                          </span>
                          <span className="text-zinc-200 font-medium truncate">
                            {saleItem.customerName}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            · {saleItem.source} ({saleItem.storeName})
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {saleItem.itemsSummary}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                        <span className="text-[11px] text-zinc-400">{saleItem.paymentMethod}</span>
                        <span className="font-bold text-emerald-400">
                          ${saleItem.totalUSD.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
