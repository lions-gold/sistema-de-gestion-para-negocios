import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { CloudOff, Download, RefreshCw, CheckCircle2, Database } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import {
  exportOfflineBackupJSON,
  getOfflineQueue,
  loadOfflineLeads,
  OfflineQueueItem,
  subscribeOfflineQueue,
  syncPendingOfflineActions,
} from '../services/offlineSyncService';
import { useLanguage } from '../i18n/LanguageContext';

interface OfflineSyncBannerProps {
  user: User | null;
  onRequestLogin?: () => Promise<unknown>;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  user,
  onRequestLogin,
}) => {
  const { lang } = useLanguage();
  const { isOnline, wasOffline } = useOnlineStatus();
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [leadsCount, setLeadsCount] = useState<number>(() => loadOfflineLeads().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResultNote, setSyncResultNote] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeOfflineQueue((next) => {
      setQueue(next);
      setLeadsCount(loadOfflineLeads().length);
    });
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    if (!user || !user.emailVerified) {
      if (onRequestLogin) {
        await onRequestLogin();
      }
      return;
    }
    setIsSyncing(true);
    setSyncResultNote(null);
    try {
      const res = await syncPendingOfflineActions(user);
      if (res.synced > 0) {
        setSyncResultNote(
          lang === 'en'
            ? `Synced ${res.synced} local record(s) to cloud.`
            : lang === 'zh'
              ? `已将 ${res.synced} 条本地数据同步至云端。`
              : `${res.synced} registro(s) locales sincronizados con la nube.`
        );
        setTimeout(() => setSyncResultNote(null), 5000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Only show banner when offline, recovering connection, or holding pending local records
  if (isOnline && !wasOffline && queue.length === 0 && !syncResultNote) {
    return null;
  }

  const copy = {
    es: {
      offlineTitle: 'Modo Offline Activo · Trabajo y recopilación local',
      offlineDesc:
        'Almacén, POS, facturación PDF y carrito siguen funcionando sin internet. Todo se guarda en tu dispositivo y se sincroniza al volver la conexión.',
      restoredTitle: 'Conexión restablecida',
      pendingCount: (n: number) => `${n} operación(es) guardada(s) en cola local`,
      leadsNote: (n: number) => `${n} contacto(s) local(es)`,
      syncNow: 'Sincronizar ahora',
      signInToSync: 'Iniciar sesión Google para sincronizar',
      backupBtn: 'Respaldo JSON',
    },
    en: {
      offlineTitle: 'Offline Mode Active · Local capture & POS ready',
      offlineDesc:
        'Warehouse, POS, PDF invoices, and store carts continue working offline. Data is stored locally and auto-syncs on reconnect.',
      restoredTitle: 'Connection restored',
      pendingCount: (n: number) => `${n} operation(s) queued locally`,
      leadsNote: (n: number) => `${n} local lead(s)`,
      syncNow: 'Sync now',
      signInToSync: 'Sign in with Google to sync',
      backupBtn: 'JSON Backup',
    },
    zh: {
      offlineTitle: '离线模式已启用 · 本地记录正常运行',
      offlineDesc:
        '仓库、POS、PDF 发票与购物车在断网时仍可继续工作，所有数据将保存在本地并在恢复网络后自动同步。',
      restoredTitle: '网络已恢复',
      pendingCount: (n: number) => `${n} 条本地操作待同步`,
      leadsNote: (n: number) => `${n} 条本地联系记录`,
      syncNow: '立即同步',
      signInToSync: '登录 Google 以同步',
      backupBtn: '导出 JSON 备份',
    },
  }[lang];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-3 sm:px-6 lg:px-8 py-2 text-xs transition-colors ${
        !isOnline
          ? 'bg-amber-950/60 border-amber-500/35 text-amber-100'
          : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-100'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          {!isOnline ? (
            <CloudOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div className="min-w-0">
            <span className="font-semibold">
              {!isOnline ? copy.offlineTitle : syncResultNote || copy.restoredTitle}
            </span>
            {!isOnline && (
              <span className="hidden md:inline text-amber-200/80 ml-2">
                — {copy.offlineDesc}
              </span>
            )}
            {(queue.length > 0 || leadsCount > 0) && (
              <span className="ml-2 inline-flex items-center gap-1 font-mono text-[11px] text-zinc-200">
                <Database className="w-3 h-3 text-amber-400" />
                {queue.length > 0 ? copy.pendingCount(queue.length) : copy.leadsNote(leadsCount)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
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
    </div>
  );
};
