import React, { useState } from 'react';
import { 
  Github, 
  Check, 
  Copy, 
  ExternalLink, 
  GitBranch, 
  Terminal,
  X,
  Sparkles
} from 'lucide-react';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose, userEmail }) => {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2500);
  };

  const gitCommands = `# 1. Sube el proyecto a tu repositorio en GitHub:
git remote add origin https://github.com/TU_USUARIO/smith-solutions-ecommerce.git
git branch -M main
git push -u origin main

# 2. Publicar en GitHub Pages (o deja que GitHub Actions lo haga en cada push):
npm run deploy:gh

# 3. Conectar con Vercel App:
# Importa el repo en vercel.com/new (detecta vercel.json y /api/* automáticamente)`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-xs text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-display">
                Conectar GitHub Pages & Vercel App
              </h3>
              <span className="text-zinc-400 text-xs">
                Cuenta: {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Git Status */}
        <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-amber-400" />
              Estado de Despliegue:
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              GitHub Pages + Vercel Listos
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-400 border-t border-white/[0.08]">
            <div>
              <span>Rama activa:</span>{' '}
              <span className="text-white font-mono font-medium">main</span>
            </div>
            <div>
              <span>Workflow CI:</span>{' '}
              <span className="text-white font-mono font-medium">.github/workflows/deploy-pages.yml</span>
            </div>
            <div>
              <span>Correo Git:</span>{' '}
              <span className="text-white font-mono font-medium truncate block">{userEmail}</span>
            </div>
            <div>
              <span>Serverless Vercel:</span>{' '}
              <span className="text-white font-mono font-medium">vercel.json + /api/*</span>
            </div>
          </div>
        </div>

        {/* Method 1: AI Studio Export Button */}
        <div className="bg-[#09090b]/70 p-4 rounded-xl border border-amber-500/20 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <h4>Método 1: Exportación Directa de AI Studio (Recomendado)</h4>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Google AI Studio cuenta con vinculación directa con GitHub. Puedes hacer clic en el botón <strong>&quot;Export&quot;</strong> o <strong>&quot;Push to GitHub&quot;</strong> en la barra superior de AI Studio para crear el repositorio automáticamente bajo tu cuenta <code className="text-amber-300 font-mono">{userEmail}</code>.
          </p>
        </div>

        {/* Method 2: Manual Git Remote Push */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
              <Terminal className="w-4 h-4 text-zinc-400" />
              Método 2: Comandos de Vinculación Remota (CLI)
            </span>
            <button
              onClick={() => copyToClipboard(gitCommands, 1)}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-medium"
            >
              {copiedStep === 1 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Comandos</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-[#09090b] rounded-lg border border-white/[0.08] text-[11px] font-mono text-amber-300/90 overflow-x-auto">
            {gitCommands}
          </pre>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.08]">
          <a
            href="https://github.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 underline underline-offset-4"
          >
            <span>Crear nuevo repositorio en GitHub.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
