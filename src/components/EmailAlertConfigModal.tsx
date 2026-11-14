import React, { useState } from 'react';
import { Product, EmailAlertConfig, StockAlertEmailLog } from '../types';
import { 
  Mail, 
  X, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Bell, 
  Clock, 
  ShieldCheck, 
  ExternalLink, 
  Eye, 
  Trash2, 
  RefreshCw,
  Sparkles,
  Phone,
  Building
} from 'lucide-react';

interface EmailAlertConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EmailAlertConfig;
  onSaveConfig: (newConfig: EmailAlertConfig) => void;
  products: Product[];
  exchangeRate: number;
  emailLogs: StockAlertEmailLog[];
  onTriggerTestEmail: (customEmail?: string) => void;
  onClearLogs: () => void;
}

export const EmailAlertConfigModal: React.FC<EmailAlertConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  products,
  exchangeRate,
  emailLogs,
  onTriggerTestEmail,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'preview' | 'history'>('config');
  const [recipientEmail, setRecipientEmail] = useState(config.recipientEmail);
  const [secondaryEmail, setSecondaryEmail] = useState(config.secondaryEmail || '');
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [frequency, setFrequency] = useState<'immediate' | 'daily'>(config.frequency);
  const [notifyOnPOS, setNotifyOnPOS] = useState(config.notifyOnPOS);
  const [notifyOnManualAdjustment, setNotifyOnManualAdjustment] = useState(config.notifyOnManualAdjustment);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      recipientEmail: recipientEmail.trim() || 'empresaalhadiqainvest@gmail.com',
      secondaryEmail: secondaryEmail.trim() || undefined,
      isEnabled,
      frequency,
      notifyOnPOS,
      notifyOnManualAdjustment,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSimulateClick = () => {
    setIsSimulating(true);
    onTriggerTestEmail(recipientEmail);
    setTimeout(() => {
      setIsSimulating(false);
      setActiveTab('history');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div 
        className="bg-[#111114] border border-amber-500/30 w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-50 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-email-title"
      >
        {/* Header Contract */}
        <div className="bg-[#09090b] px-4 sm:px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-email-title" className="font-bold text-white text-base sm:text-lg font-display flex items-center gap-2">
                Notificaciones por Correo de Stock Crítico
              </h2>
              <p className="text-xs text-zinc-400">
                Configuración de alertas automáticas para reposición en Smith Solutions E-Commerce
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Touch Friendly >= 44px) */}
        <div className="flex items-center border-b border-white/[0.08] bg-[#09090b]/50 px-4 sm:px-6 gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Configuración</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Vista Previa del Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap min-h-[44px] relative ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historial ({emailLogs.length})</span>
            {emailLogs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-zinc-200">
          {/* TAB 1: CONFIGURATION */}
          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Status Alert Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                isEnabled 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                  : 'bg-[#09090b] border-white/[0.08] text-zinc-400'
              }`}>
                <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${isEnabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    {isEnabled ? 'Servicio de Alertas Automáticas Activo' : 'Servicio en Pausa'}
                    {isEnabled && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                        En Línea
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-zinc-300">
                    {isEnabled
                      ? `Se despacharán notificaciones por email a ${recipientEmail || 'la dirección configurada'} cuando cualquier producto alcance o baje de su stock mínimo.`
                      : 'El envío de correos automáticos está pausado temporalmente.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Recipient Email Address Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-200 flex items-center justify-between">
                  <span>Dirección de Correo Principal (Receptor de Alertas) *</span>
                  <span className="text-amber-400 text-[11px] font-mono">Prioritario</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="empresaalhadiqainvest@gmail.com"
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Dirección oficial asociada a la administración de Smith Solutions E-Commerce.
                </p>
              </div>

              {/* Secondary CC Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-200 flex items-center justify-between">
                  <span>Copia Opcional (CC)</span>
                  <span className="text-zinc-500 text-[10px]">Opcional</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={secondaryEmail}
                    onChange={(e) => setSecondaryEmail(e.target.value)}
                    placeholder="zambranogonzalezcarlossmith@gmail.com"
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Trigger Options */}
              <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Disparadores de Alerta Crítica
                </span>

                <label className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[#111114] cursor-pointer min-h-[44px]">
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-zinc-200 block">
                      Al procesar venta en POS (Caja)
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Simula el envío inmediato cuando una venta deja el producto en stock crítico.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyOnPOS}
                    onChange={(e) => setNotifyOnPOS(e.target.checked)}
                    className="w-5 h-5 rounded border-white/[0.1] text-amber-500 focus:ring-amber-500 bg-[#111114]"
                  />
                </label>

                <div className="border-t border-white/[0.08]" />

                <label className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[#111114] cursor-pointer min-h-[44px]">
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-zinc-200 block">
                      Al restar stock manual en Almacén
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Simula el envío cuando el encargado descuenta botellas por merma o traslado.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyOnManualAdjustment}
                    onChange={(e) => setNotifyOnManualAdjustment(e.target.checked)}
                    className="w-5 h-5 rounded border-white/[0.1] text-amber-500 focus:ring-amber-500 bg-[#111114]"
                  />
                </label>
              </div>

              {/* Frecuencia de Alerta */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-200 block">
                  Frecuencia de Despacho
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFrequency('immediate')}
                    className={`p-3 rounded-xl border text-left transition-all min-h-[50px] ${
                      frequency === 'immediate'
                        ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                        : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-xs block">⚡ Inmediato</span>
                    <span className="text-[10px] text-zinc-400">
                      Un correo por cada incidente crítico detectado
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`p-3 rounded-xl border text-left transition-all min-h-[50px] ${
                      frequency === 'daily'
                        ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                        : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-xs block">📅 Resumen Diario</span>
                    <span className="text-[10px] text-zinc-400">
                      Consolidado diario al cierre de caja
                    </span>
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Configuración de alertas por correo guardada y activa correctamente.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSimulateClick}
                  disabled={isSimulating}
                  className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-slate-600 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 min-h-[44px] transition-colors"
                  title="Simular envío de correo con los productos bajos de stock actualmente"
                >
                  <Send className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>{isSimulating ? 'Simulando Envío...' : 'Simular Alerta de Prueba Ahora'}</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 min-h-[44px] transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Preferencias</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: RICH EMAIL PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Maqueta exacta del correo generado por el sistema:</span>
                <span className="font-mono text-amber-400">HTML Responsivo</span>
              </div>

              {/* Mock Email Client Container */}
              <div className="bg-[#09090b] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl text-zinc-200">
                {/* Email Client Header */}
                <div className="bg-[#111114] px-4 py-3 border-b border-white/[0.08] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">De:</span>
                    <span className="text-zinc-200 font-mono">alertas@tabernalionsgold.com (Sistema Automático)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Para:</span>
                    <span className="text-amber-400 font-mono font-bold">{recipientEmail || 'empresaalhadiqainvest@gmail.com'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Asunto:</span>
                    <span className="text-red-400 font-bold">
                      [ALERTA CRÍTICA] Stock Bajo en Smith Solutions E-Commerce ({lowStockProducts.length} productos)
                    </span>
                  </div>
                </div>

                {/* Email Body Template */}
                <div className="p-5 sm:p-6 space-y-5 bg-[#0f172a] text-zinc-100 font-sans text-xs sm:text-sm">
                  {/* Brand Bar */}
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold font-display text-amber-400 tracking-wide">
                        SMITH SOLUTIONS E-COMMERCE
                      </h1>
                      <span className="text-[11px] text-zinc-400 block">
                        E-Commerce, Almacenes & Punto de Venta • Venezuela
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-wider animate-pulse">
                      Alerta Crítica
                    </span>
                  </div>

                  {/* Body Intro */}
                  <div className="space-y-2">
                    <p className="font-semibold text-white">
                      Estimado Administrador,
                    </p>
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      El sistema de monitoreo en tiempo real ha detectado que uno o más productos de alta rotación han alcanzado o descendido por debajo del <strong>stock mínimo de seguridad</strong> establecido en cava:
                    </p>
                  </div>

                  {/* Product Depletion Table */}
                  <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#111114]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#09090b] text-zinc-400 border-b border-white/[0.08]">
                        <tr>
                          <th className="py-2.5 px-3">Producto / Licor</th>
                          <th className="py-2.5 px-3 text-center">Stock Actual</th>
                          <th className="py-2.5 px-3 text-center">Mínimo</th>
                          <th className="py-2.5 px-3 text-right">Reposición Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.07]">
                        {lowStockProducts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-zinc-400 text-xs">
                              Actualmente todos los productos están en niveles óptimos.
                            </td>
                          </tr>
                        ) : (
                          lowStockProducts.map((p) => (
                            <tr key={p.id} className="bg-red-950/20 text-red-100">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-white block">{p.name}</span>
                                <span className="font-mono text-[10px] text-zinc-400">{p.sku}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-mono font-bold text-red-400 text-sm">
                                  {p.stock} {p.unit}s
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-zinc-400">
                                {p.minStock} {p.unit}s
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="font-mono font-bold text-amber-400">
                                  ${(p.costUSD * (p.minStock * 2)).toFixed(2)}
                                </span>
                                <span className="block font-mono text-[10px] text-zinc-400">
                                  ≈ {(p.costUSD * (p.minStock * 2) * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs.
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-[#111114] p-3.5 rounded-xl border border-white/[0.08] space-y-1.5 text-xs">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Acción Recomendada:
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Emitir orden de compra a los distribuidores oficiales de licores para evitar desabastecimiento en mostrador y barra nocturna.
                    </p>
                  </div>

                  {/* Signature Footer */}
                  <div className="border-t border-white/[0.08] pt-4 text-[11px] text-zinc-400 space-y-1">
                    <p className="font-bold text-zinc-200">
                      Smith Bussines Solutions 2026
                    </p>
                    <p>Soporte & Desarrollo Tecnológico: +58 422 027 3766</p>
                    <p>Correo de Operaciones: empresaalhadiqainvest@gmail.com</p>
                    <p className="text-[10px] text-zinc-500 pt-1 font-mono">
                      Tasa oficial BCV aplicada: {exchangeRate.toFixed(2)} Bs / USD
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSimulateClick}
                  disabled={isSimulating}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>Disparar Simulación con estos Datos</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DISPATCH LOG HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Registro de Alertas Despachadas</h3>
                  <span className="text-xs text-zinc-400">
                    Historial de simulaciones de correos emitidas por el sistema
                  </span>
                </div>
                {emailLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearLogs}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 rounded-lg text-xs flex items-center gap-1.5 transition-colors min-h-[44px]"
                    title="Limpiar registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {emailLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 bg-[#09090b]/60 rounded-xl border border-white/[0.08] space-y-2">
                  <Mail className="w-8 h-8 mx-auto text-zinc-500" />
                  <p className="text-sm font-semibold text-zinc-300">No hay alertas registradas aún</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Haz clic en "Simular Alerta de Prueba Ahora" para generar tu primer envío de prueba.
                  </p>
                  <button
                    type="button"
                    onClick={handleSimulateClick}
                    className="mt-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-2 min-h-[44px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Simular Primer Envío</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2.5 transition-all hover:border-white/[0.1]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          <span className="font-bold text-white font-mono">{log.recipientEmail}</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-medium border border-emerald-500/30">
                            {log.status}
                          </span>
                        </div>
                        <span className="text-zinc-400 font-mono text-[11px]">{log.timestamp}</span>
                      </div>

                      <div className="font-semibold text-amber-400 text-xs sm:text-sm">
                        {log.subject}
                      </div>

                      <div className="text-xs text-zinc-400">
                        <span className="text-zinc-500">Causa: </span>
                        <span>{log.triggerEvent}</span>
                      </div>

                      {log.products.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.08] flex flex-wrap gap-1.5">
                          {log.products.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-950/40 border border-red-500/30 text-[11px] text-red-200"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              <strong className="text-white">{p.name}</strong> ({p.currentStock} / {p.minStock} {p.unit}s)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (Sticky on Mobile) */}
        <div className="bg-[#09090b] px-4 sm:px-6 py-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span className="truncate pr-2">
            Desarrollo: <strong className="text-zinc-300">Smith Bussines Solutions 2026</strong>
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
