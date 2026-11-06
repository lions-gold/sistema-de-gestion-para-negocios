import React, { useState } from 'react';
import { Debtor } from '../types';
import { 
  BookOpen, 
  MessageCircle, 
  Plus, 
  DollarSign, 
  Phone, 
  Search, 
  Calendar, 
  Check, 
  X,
  History,
  AlertCircle
} from 'lucide-react';

interface FiadosModuleProps {
  debtors: Debtor[];
  exchangeRate: number;
  onAddDebtor: (debtor: Omit<Debtor, 'id' | 'history'>) => void;
  onRecordPayment: (debtorId: string, amountUSD: number, description: string) => void;
}

export const FiadosModule: React.FC<FiadosModuleProps> = ({
  debtors,
  exchangeRate,
  onAddDebtor,
  onRecordPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebtorForPayment, setSelectedDebtorForPayment] = useState<Debtor | null>(null);
  const [paymentAmountUSD, setPaymentAmountUSD] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('Abono en efectivo en barra');
  const [historyModalDebtor, setHistoryModalDebtor] = useState<Debtor | null>(null);

  // New debtor form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('58414');
  const [newBalance, setNewBalance] = useState('45.00');
  const [newNotes, setNewNotes] = useState('');

  const filteredDebtors = debtors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm)
  );

  const totalOwedUSD = debtors.reduce((acc, d) => acc + d.balanceUSD, 0);
  const totalOwedBs = totalOwedUSD * exchangeRate;

  const handleCreateDebtor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddDebtor({
      name: newName.trim(),
      phone: newPhone.replace(/\D/g, ''),
      balanceUSD: parseFloat(newBalance) || 0,
      lastPurchaseDate: new Date().toISOString().split('T')[0],
      notes: newNotes.trim() || 'Cliente de confianza',
    });

    setNewName('');
    setNewNotes('');
    setShowAddModal(false);
  };

  const handleApplyPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtorForPayment) return;
    const amount = parseFloat(paymentAmountUSD);
    if (isNaN(amount) || amount <= 0) return;

    onRecordPayment(selectedDebtorForPayment.id, amount, paymentDesc);
    setSelectedDebtorForPayment(null);
    setPaymentAmountUSD('');
  };

  const generateWhatsAppLink = (debtor: Debtor) => {
    const amountBs = debtor.balanceUSD * exchangeRate;
    const msg = `*LA TABERNA LIONS GOLD*%0AEstimado/a *${debtor.name}*, reciba un cordial saludo.%0A%0ALe contactamos para recordarle su saldo pendiente de *$${debtor.balanceUSD.toFixed(2)} USD* (equivalente a *${amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.* a la tasa oficial del día).%0A%0A*Métodos disponibles:*%0A• Pago Móvil%0A• Efectivo (USD / Bs.)%0A• Zelle / Punto de Venta en local%0A%0AQuedamos a su entera disposición. ¡Muchas gracias!%0A_Smith Bussines Solutions 2026_`;
    const cleanPhone = debtor.phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Total Cuentas por Cobrar</span>
          <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
            ${totalOwedUSD.toFixed(2)} USD
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            ≈ {totalOwedBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Clientes Deudores</span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {debtors.length} <span className="text-xs font-normal text-slate-400">personas registradas</span>
          </div>
          <span className="text-xs text-slate-500">
            Libreta digital 100% sincronizada
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Cobranza Automatizada</span>
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Recordatorios WhatsApp</span>
          </div>
          <span className="text-xs text-slate-500 block mt-1">
            Notificaciones preformateadas en 1 clic
          </span>
        </div>
      </div>

      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre de cliente o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Anotar Nuevo Fiado</span>
        </button>
      </div>

      {/* Debtors List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDebtors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm bg-slate-900/60 rounded-xl border border-slate-800">
            No hay clientes con saldos pendientes con ese filtro.
          </div>
        ) : (
          filteredDebtors.map((debtor) => {
            const amountBs = debtor.balanceUSD * exchangeRate;
            return (
              <div
                key={debtor.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-4 flex flex-col justify-between transition-colors space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm line-clamp-1">
                      {debtor.name}
                    </h4>
                    <span className="font-mono text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <Phone className="w-3 h-3 text-slate-500" />
                      +{debtor.phone}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 italic mb-3">
                    &quot;{debtor.notes}&quot;
                  </p>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Saldo Pendiente</span>
                      <span className="font-mono font-bold text-lg text-rose-400 tabular-nums">
                        ${debtor.balanceUSD.toFixed(2)} USD
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Último movimiento:</span>
                    <span className="font-mono">{debtor.lastPurchaseDate}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={generateWhatsAppLink(debtor)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Enviar recordatorio automático por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Cobrar</span>
                    </a>

                    <button
                      onClick={() => setSelectedDebtorForPayment(debtor)}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-medium text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5 shrink-0" />
                      <span>Abonar</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setHistoryModalDebtor(debtor)}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1 py-1"
                  >
                    <History className="w-3 h-3" />
                    <span>Ver historial de cuentas</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment / Abono Modal */}
      {selectedDebtorForPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base font-display">Registrar Abono</h3>
                <span className="text-slate-400 text-xs">{selectedDebtorForPayment.name}</span>
              </div>
              <button
                onClick={() => setSelectedDebtorForPayment(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between">
              <span className="text-slate-400">Deuda actual:</span>
              <span className="font-mono font-bold text-rose-400">${selectedDebtorForPayment.balanceUSD.toFixed(2)} USD</span>
            </div>

            <form onSubmit={handleApplyPayment} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Monto del Abono (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmountUSD}
                  onChange={(e) => setPaymentAmountUSD(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                {paymentAmountUSD && (
                  <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                    Equivale a {(parseFloat(paymentAmountUSD) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Detalle / Método del Abono</label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Ej: Pago Móvil Banesco / Efectivo en barra"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDebtorForPayment(null)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Debtor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base font-display">Anotar Cuenta Fiada en Libreta</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDebtor} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre Completo o Negocio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Rafael Peña (Taller Mecánico)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">WhatsApp / Celular (Venezuela)</label>
                  <input
                    type="text"
                    required
                    placeholder="584141234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Monto Inicial Fiado (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Observaciones / Concepto de Compra</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ej: Llevó 2 cajas de Polar y 1 botella de ron Cacique"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Guardar en Libreta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalDebtor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="font-bold text-white text-sm font-display">Historial de Cuenta</h3>
                <span className="text-amber-400">{historyModalDebtor.name}</span>
              </div>
              <button
                onClick={() => setHistoryModalDebtor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {historyModalDebtor.history.map((h, i) => (
                <div
                  key={i}
                  className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between"
                >
                  <div>
                    <span className="text-slate-300 font-medium block">{h.description}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{h.date}</span>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      h.type === 'cargo' ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {h.type === 'cargo' ? '+' : '-'}${h.amountUSD.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setHistoryModalDebtor(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
