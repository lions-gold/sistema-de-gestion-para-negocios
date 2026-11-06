import React from 'react';
import { Wine, LayoutDashboard, Globe, Github } from 'lucide-react';

interface HeaderProps {
  currentView: 'landing' | 'app';
  setCurrentView: (view: 'landing' | 'app') => void;
  exchangeRate: number;
  onOpenGitHub: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  exchangeRate,
  onOpenGitHub,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-4 sm:px-6 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element in display face, no pills/taglines attached) */}
        <button
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Wine className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display">
            La Taberna Lions Gold
          </span>
        </button>

        {/* Zone 2: 4–5 single-line clean text nav links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-slate-300">
          <a
            href="#inventario"
            onClick={(e) => {
              if (currentView === 'app') {
                e.preventDefault();
                setCurrentView('landing');
                setTimeout(() => {
                  document.getElementById('inventario')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Inventario
          </a>
          <a
            href="#punto-de-venta"
            onClick={(e) => {
              if (currentView === 'app') {
                e.preventDefault();
                setCurrentView('landing');
                setTimeout(() => {
                  document.getElementById('punto-de-venta')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Punto de Venta
          </a>
          <a
            href="#fiados"
            onClick={(e) => {
              if (currentView === 'app') {
                e.preventDefault();
                setCurrentView('landing');
                setTimeout(() => {
                  document.getElementById('fiados')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Libreta de Fiados
          </a>
          <button
            onClick={onOpenGitHub}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </button>
          <a
            href="#contacto"
            onClick={(e) => {
              if (currentView === 'app') {
                e.preventDefault();
                setCurrentView('landing');
                setTimeout(() => {
                  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Contacto & Soporte
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentView(currentView === 'landing' ? 'app' : 'landing')}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm shadow-amber-500/25 transition-all whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            {currentView === 'landing' ? (
              <>
                <LayoutDashboard className="w-4 h-4" />
                <span>Abrir Gestor en Vivo</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                <span>Ver Web Comercial</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
