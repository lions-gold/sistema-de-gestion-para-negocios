import React from 'react';
import { Wine, Mail, Phone, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onOpenApp: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenApp }) => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & mission */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                <Wine className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-bold text-white text-base font-display">
                Gestor de Almacenes La Taberna Lions Gold
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Plataforma tecnológica de gestión de stock, punto de venta y cobranza de deudas en Bolívares y Dólares. La alternativa prémium para bodegones, tabernas y comercios en Venezuela.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-2">
            <span className="text-white font-semibold block text-xs tracking-wider uppercase">
              Módulos del Sistema
            </span>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  onClick={onOpenApp}
                  className="hover:text-amber-400 transition-colors"
                >
                  Control de Almacén e Inventario
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenApp}
                  className="hover:text-amber-400 transition-colors"
                >
                  Punto de Venta POS Multidivisa
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenApp}
                  className="hover:text-amber-400 transition-colors"
                >
                  Libreta de Fiados con WhatsApp
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenApp}
                  className="hover:text-amber-400 transition-colors"
                >
                  Caja Chica y Gastos Operativos
                </button>
              </li>
            </ul>
          </div>

          {/* Programmer signature and contact details */}
          <div className="md:col-span-4 space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <div className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Firma y Desarrollo de Software</span>
            </div>
            
            <div className="text-amber-300 font-bold text-sm">
              Smith Bussines Solutions 2026
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <a
                  href="mailto:empresaalhadiqainvest@gmail.com"
                  className="hover:text-white transition-colors truncate"
                >
                  empresaalhadiqainvest@gmail.com
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <a
                  href="https://wa.me/584220273766"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-300 transition-colors font-mono"
                >
                  +58 422 027 3766 (Venezuela)
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2026 Gestor de Almacenes La Taberna Lions Gold. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Programado y diseñado por</span>
            <span className="text-amber-400 font-semibold">Smith Bussines Solutions 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
