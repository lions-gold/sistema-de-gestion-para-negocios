import React from 'react';
import { 
  Package, 
  Receipt, 
  BookOpen, 
  TrendingUp, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight,
  MessageCircle,
  Coins,
  SlidersHorizontal,
  Clock
} from 'lucide-react';

interface FeatureBentoProps {
  onOpenApp: (module?: 'inventory' | 'pos' | 'debtors' | 'cashier') => void;
  exchangeRate: number;
}

export const FeatureBento: React.FC<FeatureBentoProps> = ({ onOpenApp, exchangeRate }) => {
  return (
    <section id="inventario" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="max-w-3xl mb-12 lg:mb-16">
        <div className="text-xs font-semibold text-amber-400 mb-2">
          Arquitectura Comercial Integral
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-display text-balance">
          Todo el poder que hizo famoso a Treinta, perfeccionado para almacenes y tabernas de alta rotación
        </h2>
        <p className="mt-3 text-base text-slate-300 leading-relaxed">
          Diseñado con los flujos de trabajo reales del comerciante venezolano: doble moneda, cobros ágiles, control estricto de mermas y cobranza inteligente.
        </p>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Card 1: Inventario Inteligente (Large 7 cols) */}
        <div className="md:col-span-7 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-slate-400">Módulo 01</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-display">
              Control de Inventario y Almacén en Tiempo Real
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Registra licores finos, cajas completas de cerveza y fardos de víveres. Configura alertas de stock mínimo automático para que nunca te quedes sin productos estrella durante el fin de semana.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 relative group">
            <img
              src="/src/assets/images/inventory_bottles_showcase_1793999560657.jpg"
              alt="Catálogo e inventario de botellas"
              referrerPolicy="no-referrer"
              className="w-full h-48 sm:h-56 object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-4">
              <div className="flex items-center justify-between w-full text-xs">
                <span className="text-white font-medium">Alertas de existencias bajas integradas</span>
                <button
                  onClick={() => onOpenApp('inventory')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center gap-1.5 transition-colors"
                >
                  <span>Probar Inventario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Punto de Venta POS Rápido (5 cols) */}
        <div id="punto-de-venta" className="md:col-span-5 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-slate-400">Módulo 02</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-display">
              Punto de Venta POS Multidivisa
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Cobra en segundos. Conoce exactamente cuánto debe pagar el cliente en Bolívares o Dólares según la tasa del momento. Acepta Pago Móvil, Efectivo USD, Zelle y tarjetas.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 relative group">
            <img
              src="/src/assets/images/pos_retail_cellar_1793999560459.jpg"
              alt="Caja y Punto de Venta"
              referrerPolicy="no-referrer"
              className="w-full h-44 object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300">Emisión de ticket digital</span>
              <button
                onClick={() => onOpenApp('pos')}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>Abrir Caja POS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Libreta de Fiados y Cobros por WhatsApp (Large 6 cols) */}
        <div id="fiados" className="md:col-span-6 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 sm:p-8 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-slate-400">Módulo 03</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 font-display">
            Libreta Digital de Fiados & Deudas
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Dile adiós a los cuadernos rotos o anotaciones perdidas. Anota compras al fiado de tus clientes de confianza, registra abonos parciales y envía recordatorios automáticos por WhatsApp con su saldo exacto en un solo clic.
          </p>

          {/* Interactive Preview of the Debt Reminder */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2 mb-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <MessageCircle className="w-3.5 h-3.5" />
                Mensaje Automático de Cobro (Ejemplo)
              </span>
              <span className="font-mono text-slate-500">WhatsApp</span>
            </div>
            <p className="text-slate-300 italic bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              &quot;Hola Carlos Mendoza, saludos de La Taberna Lions Gold. Te recordamos tu saldo de $145.00 ({((145 * exchangeRate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.). Puedes abonar por Pago Móvil o Zelle. ¡Muchas gracias!&quot;
            </p>
          </div>

          <button
            onClick={() => onOpenApp('debtors')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
          >
            <span>Ver Libreta de Clientes y Cobranza</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Control de Caja Chica y Finanzas (6 cols) */}
        <div className="md:col-span-6 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 sm:p-8 hover:border-amber-500/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-slate-400">Módulo 04</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-display">
              Cuadre Diario de Caja y Gastos Operativos
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Registra pagos a proveedores de hielo, refrescos, bolsas, fletes y servicios. Al final de la jornada conoce tu ganancia neta real y el balance exacto entre ventas en efectivo, Pago Móvil y cuentas por cobrar.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3 text-xs mb-4">
            <div>
              <span className="text-slate-500 block">Ingresos hoy:</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">+$211.00 USD</span>
            </div>
            <div>
              <span className="text-slate-500 block">Gastos hoy:</span>
              <span className="font-mono text-rose-400 font-bold text-sm">-$23.50 USD</span>
            </div>
          </div>

          <button
            onClick={() => onOpenApp('cashier')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
          >
            <span>Examinar Movimientos de Caja</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
