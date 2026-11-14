import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado en la interfaz.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('AppErrorBoundary captured error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111114] border border-amber-400/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-zinc-50">
              Recuperación automática · Smith Solutions
            </h1>
            <p className="text-xs text-zinc-400 break-words">
              Se detectó un fallo puntual en un módulo ({this.state.message}). Tus datos locales de
              inventario, caja y modo offline permanecen intactos.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recargar plataforma</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
