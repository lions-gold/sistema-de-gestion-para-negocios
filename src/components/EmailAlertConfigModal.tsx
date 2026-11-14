import React from 'react';
import {
  Product,
  Sale,
  EmailAlertConfig,
  StockAlertEmailLog,
  StoreEmailConfig,
  StoreTenant,
} from '../types';
import { Mail, X } from 'lucide-react';
import { EmailProviderConfigPanel } from './EmailProviderConfigPanel';

interface EmailAlertConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EmailAlertConfig;
  onSaveConfig: (newConfig: EmailAlertConfig) => void;
  products: Product[];
  sales?: Sale[];
  exchangeRate: number;
  emailLogs: StockAlertEmailLog[];
  onTriggerTestEmail?: (customEmail?: string) => void;
  onClearLogs?: () => void;
  activeStore?: StoreTenant | null;
  onLogsUpdated?: (logs: StockAlertEmailLog[]) => void;
}

export const EmailAlertConfigModal: React.FC<EmailAlertConfigModalProps> = ({
  isOpen,
  onClose,
  onSaveConfig,
  products,
  sales = [],
  exchangeRate,
  activeStore = null,
  onLogsUpdated,
}) => {
  if (!isOpen) return null;

  const storeId = activeStore?.id || 'default-warehouse';
  const ownerUid = activeStore?.ownerUid || '';
  const storeName = activeStore?.storeName || 'Almacén & POS';

  const handleSyncedSave = (storeCfg: StoreEmailConfig) => {
    onSaveConfig({
      recipientEmail: storeCfg.recipientEmail,
      secondaryEmail: storeCfg.secondaryEmail || undefined,
      isEnabled: storeCfg.isEnabled,
      frequency: storeCfg.alertFrequency,
      notifyOnPOS: storeCfg.notifyOnPOS,
      notifyOnManualAdjustment: storeCfg.notifyOnManualAdjustment,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="bg-[#111114] border border-amber-500/30 w-full sm:max-w-3xl max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden safe-area-bottom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-email-title"
      >
        {/* Header */}
        <div className="bg-[#09090b] px-4 sm:px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="modal-email-title"
                className="font-bold text-white text-base sm:text-lg font-display truncate"
              >
                Configuración de Correo (SMTP / Resend)
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Alertas de stock crítico y reportes de ventas · {storeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-zinc-200">
          <EmailProviderConfigPanel
            storeId={storeId}
            ownerUid={ownerUid}
            storeName={storeName}
            exchangeRate={exchangeRate}
            products={products}
            sales={sales}
            compact
            onConfigSaved={handleSyncedSave}
            onLogsUpdated={onLogsUpdated}
          />
        </div>

        {/* Footer */}
        <div className="bg-[#09090b] px-4 sm:px-6 py-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span className="truncate pr-2">
            Smith Solutions E-Commerce · Envío seguro vía servidor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-lg font-medium transition-colors min-h-[44px]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
