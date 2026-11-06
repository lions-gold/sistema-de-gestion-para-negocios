import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  return (
    <section id="comparativa" className="py-16 lg:py-24 border-t border-slate-800/80 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="text-xs font-semibold text-amber-400 mb-2">
            Ventajas Operativas
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-display text-balance">
            Por qué La Taberna Lions Gold es superior a cuadernos de papel y sistemas genéricos
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            Diseñado exclusivamente para el ritmo acelerado de tabernas, bodegones, licorerías y depósitos en Venezuela.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-4 px-5">Funcionalidad</th>
                  <th className="py-4 px-4 text-center text-slate-400">Cuaderno / Excel</th>
                  <th className="py-4 px-4 text-center text-slate-400">Software Genérico</th>
                  <th className="py-4 px-5 text-center text-amber-400 bg-amber-500/10 border-x border-amber-500/20 font-bold">
                    La Taberna Lions Gold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">
                    Doble moneda en vivo (Bs. y USD con Tasa BCV/Paralelo)
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Manual</td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Rígido</td>
                  <td className="py-3.5 px-5 text-center text-emerald-400 bg-amber-500/5 border-x border-amber-500/20 font-semibold">
                    Automático al instante
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">
                    Libreta de Fiados con cobranza en 1 clic por WhatsApp
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Hojas rotas</td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">No tiene</td>
                  <td className="py-3.5 px-5 text-center text-emerald-400 bg-amber-500/5 border-x border-amber-500/20 font-semibold">
                    Integrado con mensaje listo
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">
                    Alertas de stock mínimo para licores y cerveza
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Olvidos</td>
                  <td className="py-3.5 px-4 text-center text-slate-400 font-mono">Complejo</td>
                  <td className="py-3.5 px-5 text-center text-emerald-400 bg-amber-500/5 border-x border-amber-500/20 font-semibold">
                    Alertas en pantalla
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">
                    Comprobante digital para enviar al cliente por WhatsApp
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Imposible</td>
                  <td className="py-3.5 px-4 text-center text-slate-400 font-mono">Solo papel</td>
                  <td className="py-3.5 px-5 text-center text-emerald-400 bg-amber-500/5 border-x border-amber-500/20 font-semibold">
                    1 toque a WhatsApp
                  </td>
                </tr>

                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">
                    Soporte directo en Venezuela y desarrollo personalizado
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-500 font-mono">N/A</td>
                  <td className="py-3.5 px-4 text-center text-rose-400 font-mono">Soporte extranjero</td>
                  <td className="py-3.5 px-5 text-center text-amber-300 bg-amber-500/5 border-x border-amber-500/20 font-semibold">
                    Smith Bussines Solutions 2026
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
