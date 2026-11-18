import React, { useState } from 'react';
import {
  Github,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Terminal,
  X,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose, userEmail }) => {
  const { tr } = useLanguage();
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2500);
  };

  const gitCommands = `# 1. ${tr('Sube el proyecto a tu repositorio en GitHub:', 'Push the project to your GitHub repository:', '将项目推送到您的 GitHub 仓库：')}
git remote add origin https://github.com/${tr('TU_USUARIO', 'YOUR_USER', 'YOUR_USER')}/smith-solutions-ecommerce.git
git branch -M main
git push -u origin main

# 2. ${tr('Publicar en GitHub Pages (o deja que GitHub Actions lo haga en cada push):', 'Deploy to GitHub Pages (or let GitHub Actions automate on push):', '部署到 GitHub Pages（或通过 GitHub Actions 自动部署）：')}
npm run deploy:gh

# 3. ${tr('Conectar con Vercel App:', 'Connect with Vercel App:', '连接 Vercel 应用：')}
# ${tr('Importa el repo en vercel.com/new (detecta vercel.json y /api/* automáticamente)', 'Import repo at vercel.com/new (auto-detects vercel.json and /api/*)', '在 vercel.com/new 导入仓库（自动识别 vercel.json 与 /api/*）')}`;

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
                {tr('Conectar GitHub Pages & Vercel App', 'Connect GitHub Pages & Vercel App', '连接 GitHub Pages 与 Vercel')}
              </h3>
              <span className="text-zinc-400 text-xs">
                {tr('Cuenta:', 'Account:', '账号：')} {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/80 transition-colors"
            aria-label={tr('Cerrar', 'Close', '关闭')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Git Status */}
        <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-amber-400" />
              {tr('Estado de Despliegue:', 'Deployment Status:', '部署状态：')}
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {tr('GitHub Pages + Vercel Listos', 'GitHub Pages + Vercel Ready', 'GitHub Pages + Vercel 已就绪')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-400 border-t border-white/[0.08]">
            <div>
              <span>{tr('Rama activa:', 'Active branch:', '当前分支：')}</span>{' '}
              <span className="text-white font-mono font-medium">main</span>
            </div>
            <div>
              <span>{tr('Workflow CI:', 'CI Workflow:', 'CI 工作流：')}</span>{' '}
              <span className="text-white font-mono font-medium">.github/workflows/deploy-pages.yml</span>
            </div>
            <div>
              <span>{tr('Correo Git:', 'Git Email:', 'Git 邮箱：')}</span>{' '}
              <span className="text-white font-mono font-medium truncate block">{userEmail}</span>
            </div>
            <div>
              <span>{tr('Serverless Vercel:', 'Vercel Serverless:', 'Vercel 无服务器函数：')}</span>{' '}
              <span className="text-white font-mono font-medium">vercel.json + /api/*</span>
            </div>
          </div>
        </div>

        {/* Method 1 */}
        <div className="bg-[#09090b]/70 p-4 rounded-xl border border-amber-500/20 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <h4>
              {tr(
                'Método 1: Exportación Directa (Recomendado)',
                'Method 1: Direct Export (Recommended)',
                '方式一：一键直接导出（推荐）'
              )}
            </h4>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {tr(
              `Puedes hacer clic en el botón "Export" o "Push to GitHub" para crear el repositorio automáticamente bajo tu cuenta `,
              `Click "Export" or "Push to GitHub" to create the repository automatically under `,
              `点击顶部工具栏的 "Export" 或 "Push to GitHub" 即可自动在您的账号下创建仓库：`
            )}
            <code className="text-amber-300 font-mono">{userEmail}</code>.
          </p>
        </div>

        {/* Method 2 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
              <Terminal className="w-4 h-4 text-zinc-400" />
              {tr(
                'Método 2: Comandos de Vinculación Remota (CLI)',
                'Method 2: Remote Linking Commands (CLI)',
                '方式二：命令行关联推送 (CLI)'
              )}
            </span>
            <button
              onClick={() => copyToClipboard(gitCommands, 1)}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-medium"
            >
              {copiedStep === 1 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{tr('¡Copiado!', 'Copied!', '已复制！')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{tr('Copiar Comandos', 'Copy Commands', '复制命令')}</span>
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
            <span>{tr('Crear nuevo repositorio en GitHub.com', 'Create new repo on GitHub.com', '前往 GitHub.com 新建仓库')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
          >
            {tr('Entendido', 'Got it', '知道了')}
          </button>
        </div>
      </div>
    </div>
  );
};
