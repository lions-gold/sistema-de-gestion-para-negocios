import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Smartphone, Sparkles } from 'lucide-react';

interface LandingHeroProps {
  onOpenApp: () => void;
  exchangeRate: number;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenApp, exchangeRate }) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-slate-800/80">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Proposition and Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <span>Solución Comercial Especializada</span>
              <span aria-hidden="true">·</span>
              <span>Venezuela 2026</span>
              <span aria-hidden="true">·</span>
              <span>Por Smith Bussines Solutions</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] font-display text-balance">
              El gestor de almacenes y punto de venta definitivo para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                La Taberna Lions Gold
              </span>{' '}
              y comercios exclusivos
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Toma el control absoluto de tu mercancía de licores, cervezas y víveres. Factura en Bolívares y Dólares con tasa oficial o paralela, gestiona clientes fiados con cobranza automatizada por WhatsApp y cuadra tu caja sin errores.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={onOpenApp}
                className="px-6 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] flex items-center gap-2.5 whitespace-nowrap"
              >
                <span>Probar Gestor de Almacén en Vivo</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <a
                href="#inventario"
                className="px-5 py-3.5 text-sm sm:text-base font-medium text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap"
              >
                Explorar Módulos Treinta+
              </a>
            </div>

            {/* Proof & Venezuelan commerce features */}
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-xs sm:text-sm text-slate-400">
              <div className="flex flex-col">
                <span className="font-mono font-bold text-lg text-white tabular-nums">100%</span>
                <span>Adaptado a Venezuela (Bs / USD / Pago Móvil)</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-lg text-amber-400 tabular-nums">0%</span>
                <span>Pérdidas de stock o deudas olvidadas</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-lg text-white tabular-nums">1-Clic</span>
                <span>Cobro automático por WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl shadow-black/80 group">
              <img
                src="/src/assets/images/hero_tavern_warehouse_1793999559722.jpg"
                alt="Almacén de Licores y Taberna Lions Gold"
                referrerPolicy="no-referrer"
                className="w-full h-[380px] sm:h-[440px] object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              {/* Live Overlay Card inside Hero */}
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-slate-900/95 backdrop-blur-md border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Estado del Almacén Central</span>
                  <span className="text-amber-400 font-mono">12 ítems registrados</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800">
                  <span>Tasa activa:</span>
                  <span className="font-mono text-white font-medium">{exchangeRate.toFixed(2)} Bs / USD</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Valor estimado almacén:</span>
                  <span className="font-mono text-amber-300 font-bold">$7,420.00 USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
