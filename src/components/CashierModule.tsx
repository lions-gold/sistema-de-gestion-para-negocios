import React, { useState } from 'react';
import { CashMovement } from '../types';
import { 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  Calendar, 
  X,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface CashierModuleProps {
  movements: CashMovement[];
  exchangeRate: number;
  onAddMovement: (movement: Omit<CashMovement, 'id' | 'date'>) => void;
}

export const CashierModule: React.FC<CashierModuleProps> = ({
  movements,
  exchangeRate,
  onAddMovement,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [type, setType] = useState<CashMovement['type']>('gasto');
  const [category, setCategory] = useState<CashMovement['category']>('Inventario');
  const [description, setDescription] = useState('');
  const [amountUSD, setAmountUSD] = useState('');

  const totalIncome = movements
    .filter((m) => m.type === 'ingreso')
    .reduce((acc, m) => acc + m.amountUSD, 0);

  const totalExpenses = movements
    .filter((m) => m.type === 'gasto')
    .reduce((acc, m) => acc + m.amountUSD, 0);

  const netBalance = totalIncome - totalExpenses;

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountUSD);
    if (isNaN(val) || val <= 0 || !description.trim()) return;

    onAddMovement({
      type,
      category,
      description: description.trim(),
      amountUSD: val,
    });

    setDescription('');
    setAmountUSD('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 3 Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Total Ingresos Registrados</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            +${totalIncome.toFixed(2)} USD
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            ≈ {(totalIncome * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Total Gastos Operativos</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
            -${totalExpenses.toFixed(2)} USD
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            ≈ {(totalExpenses * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Balance Neto en Caja</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${netBalance >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            ${netBalance.toFixed(2)} USD
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            ≈ {(netBalance * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-base font-display">
          Libro Diario de Caja Chica y Egresos
        </h3>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Movimiento</span>
        </button>
      </div>

      {/* Movements Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Descripción del Gasto / Ingreso</th>
                <th className="py-3 px-4 text-right">Monto (USD)</th>
                <th className="py-3 px-4 text-right">Monto (Bs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                    {m.date}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs ${
                        m.type === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.type === 'ingreso' ? (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Ingreso
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Gasto
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {m.category}
                  </td>
                  <td className="py-3 px-4 text-white font-medium">
                    {m.description}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                    <span className={m.type === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'}>
                      {m.type === 'ingreso' ? '+' : '-'}${m.amountUSD.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums text-xs">
                    {(m.amountUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Movement */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base font-display">Registrar Movimiento de Caja</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('gasto')}
                  className={`p-2 rounded-lg font-bold transition-colors ${
                    type === 'gasto'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setType('ingreso')}
                  className={`p-2 rounded-lg font-bold transition-colors ${
                    type === 'ingreso'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Registrar Ingreso
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CashMovement['category'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="Inventario">Inventario (Mercancía / Hielo)</option>
                  <option value="Caja Chica">Caja Chica / Insumos</option>
                  <option value="Servicios">Servicios (Luz / Internet / Fletes)</option>
                  <option value="Nómina">Nómina / Pago Personal</option>
                  <option value="Venta">Venta Extraordinaria</option>
                  <option value="Otro">Otro Concepto</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Descripción del Movimiento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de 5 bolsas de hielo para la cava"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Monto en Dólares (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-sm"
                />
                {amountUSD && (
                  <span className="text-[11px] text-amber-400 font-mono mt-1 block">
                    Equivale a {(parseFloat(amountUSD) * exchangeRate).toFixed(2)} Bs.
                  </span>
                )}
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
                  Guardar en Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
