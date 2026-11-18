import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Laptop,
  MoreVertical,
  Share,
  Smartphone,
  TabletSmartphone,
  X,
} from 'lucide-react';
import { InstallPlatform, usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer' | 'footer';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { lang } = useLanguage();
  const {
    canInstall,
    isInstalled,
    isSafari,
    isInAppBrowser,
    platform,
    promptInstall,
  } = usePWAInstall();

  const [showGuide, setShowGuide] = useState(false);
  const [selectedTab, setSelectedTab] = useState<InstallPlatform>(
    platform === 'desktop' ? 'android' : platform
  );
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setSelectedTab(platform === 'desktop' ? 'android' : platform);
  }, [platform]);

  // Hide only when already launched inside installed standalone PWA window
  if (isInstalled) return null;

  const labels = {
    es: {
      btn: 'Instalar App',
      btnShort: 'Instalar',
      btnFooter: 'Instalar en iPhone, Mac o Android',
      drawerSub: 'Compatible con iPhone, Mac y Android (Offline)',
      title: 'Instalar Smith Solutions como aplicación nativa',
      modalTitle: 'Instalar App Multiplataforma',
      modalSub: 'Lleva tu almacén, POS y tiendas directo a tu pantalla de inicio o Dock.',
      tabIphone: 'iPhone / iPad',
      tabMac: 'Mac',
      tabAndroid: 'Android / PC',
      nativeInstallBtn: 'Instalar ahora con 1 clic',
      inAppWarning:
        'Estás usando un navegador interno. Copia el enlace y ábrelo en Safari (iPhone/Mac) o Chrome (Android) para instalar.',
      copyUrlBtn: 'Copiar enlace de instalación',
      copiedUrlBtn: 'Enlace copiado',
      iosNote: !isSafari
        ? 'Consejo iOS: Abre esta página en Safari (o toca el botón Compartir ↑ de Chrome/Edge en iPhone).'
        : 'En iPhone y iPad (Safari):',
      iosSteps: [
        'Toca el botón Compartir en la barra inferior o superior de Safari.',
        'Desliza hacia abajo y elige "Agregar a pantalla de inicio" (o "Añadir a pantalla de inicio").',
        'Toca "Agregar" en la esquina superior derecha para abrirla como app nativa con modo offline.',
      ],
      macSafariTitle: 'Safari en Mac (macOS Sonoma o superior)',
      macSafariSteps: [
        'En el menú superior de Mac haz clic en Archivo → "Agregar al Dock..." (o en el botón Compartir de Safari → "Agregar al Dock").',
        'Confirma el nombre "SmithSaaS" y haz clic en Agregar. Quedará en tu Dock y Launchpad.',
      ],
      macChromeTitle: 'Google Chrome / Edge en Mac',
      macChromeSteps: [
        'Pulsa el botón "Instalar ahora con 1 clic" arriba o el icono de descarga en la barra de direcciones.',
        'Haz clic en "Instalar" para abrir la plataforma en su propia ventana independiente.',
      ],
      androidTitle: 'Android / Windows / Chrome',
      androidSteps: [
        'Si aparece arriba, pulsa "Instalar ahora con 1 clic" para instalación directa.',
        'O toca el menú (⋮) de Chrome / Edge y selecciona "Instalar aplicación" o "Agregar a pantalla de inicio".',
        'El icono de Smith Solutions se añadirá automáticamente a tu pantalla principal.',
      ],
      close: 'Entendido',
    },
    en: {
      btn: 'Install App',
      btnShort: 'Install',
      btnFooter: 'Install on iPhone, Mac or Android',
      drawerSub: 'Works on iPhone, Mac & Android (Offline ready)',
      title: 'Install Smith Solutions as a standalone app',
      modalTitle: 'Cross-Platform App Installer',
      modalSub: 'Pin your warehouse, POS & stores directly to your Home Screen or Mac Dock.',
      tabIphone: 'iPhone / iPad',
      tabMac: 'Mac',
      tabAndroid: 'Android / PC',
      nativeInstallBtn: 'Install in 1 Click',
      inAppWarning:
        'You are inside an in-app browser. Copy the link and open it in Safari (iPhone/Mac) or Chrome (Android) to install.',
      copyUrlBtn: 'Copy install link',
      copiedUrlBtn: 'Link copied',
      iosNote: !isSafari
        ? 'iOS tip: Open this page in Safari (or tap Share ↑ in iOS Chrome/Edge).'
        : 'On iPhone & iPad (Safari):',
      iosSteps: [
        'Tap the Share button on Safari’s bottom or top toolbar.',
        'Scroll down and select "Add to Home Screen".',
        'Tap "Add" in the top-right corner to launch it as a native offline-ready app.',
      ],
      macSafariTitle: 'Safari on Mac (macOS Sonoma+)',
      macSafariSteps: [
        'From the Mac menu bar, click File → "Add to Dock..." (or click Share in Safari → "Add to Dock").',
        'Confirm "SmithSaaS" and click Add to launch directly from your Dock.',
      ],
      macChromeTitle: 'Chrome / Edge on Mac',
      macChromeSteps: [
        'Click "Install in 1 Click" above or the install icon in the browser address bar.',
        'Confirm "Install" to run Smith Solutions in a dedicated app window.',
      ],
      androidTitle: 'Android / Windows / Chrome',
      androidSteps: [
        'Tap "Install in 1 Click" above if available for instant installation.',
        'Or open Chrome / Edge menu (⋮) and choose "Install app" or "Add to Home screen".',
        'Smith Solutions will appear on your home screen or desktop.',
      ],
      close: 'Got it',
    },
    zh: {
      btn: '安装应用',
      btnShort: '安装',
      btnFooter: '在 iPhone、Mac 或 Android 上安装',
      drawerSub: '支持 iPhone、Mac 与 Android（离线可用）',
      title: '将 Smith Solutions 安装为独立应用',
      modalTitle: '跨平台应用安装向导',
      modalSub: '将仓库管理、POS 收银与商城固定到主屏幕或 Mac 程序坞。',
      tabIphone: 'iPhone / iPad',
      tabMac: 'Mac',
      tabAndroid: 'Android / 电脑',
      nativeInstallBtn: '一键立即安装',
      inAppWarning: '当前处于内置浏览器中，请复制链接并在 Safari (iPhone/Mac) 或 Chrome (Android) 中打开安装。',
      copyUrlBtn: '复制安装链接',
      copiedUrlBtn: '链接已复制',
      iosNote: !isSafari
        ? 'iOS 提示：建议在 Safari 中打开此页面（或点击顶部/底部的分享图标 ↑）。'
        : '在 iPhone 和 iPad (Safari) 上：',
      iosSteps: [
        '点击 Safari 工具栏上的“分享”图标。',
        '向下滑动并选择“添加到主屏幕”。',
        '点击右上角“添加”，即可像原生离线应用一样使用。',
      ],
      macSafariTitle: 'Mac 上的 Safari（macOS Sonoma 及更新）',
      macSafariSteps: [
        '点击 Mac 顶部菜单栏“文件” → “添加到程序坞…”（或 Safari 分享按钮 → “添加到程序坞”）。',
        '确认名称后点击“添加”，即可在 Dock 栏快速启动。',
      ],
      macChromeTitle: 'Mac 上的 Chrome / Edge',
      macChromeSteps: [
        '点击上方“一键立即安装”或地址栏右侧的安装图标。',
        '确认“安装”，即可在独立应用窗口中运行。',
      ],
      androidTitle: 'Android / Windows / Chrome',
      androidSteps: [
        '若上方显示“一键立即安装”，直接点击即可完成安装。',
        '或点击 Chrome / Edge 右上角菜单 (⋮)，选择“安装应用”或“添加到主屏幕”。',
        '应用图标将自动添加至桌面。',
      ],
      close: '知道了',
    },
  }[lang];

  const handleTriggerClick = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (accepted) return;
    }
    setSelectedTab(platform === 'desktop' ? 'android' : platform);
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleTriggerClick}
          className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-amber-400/12 hover:bg-amber-400/20 active:scale-[0.99] border border-amber-400/35 text-left flex items-center justify-between gap-3 transition-all ${className}`}
        >
          <span className="flex items-center gap-3 min-w-0">
            <Download className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-amber-300 truncate">
                {labels.btn}
              </span>
              <span className="block text-[11px] text-zinc-400 truncate">
                {labels.drawerSub}
              </span>
            </span>
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-bold shrink-0">
            PWA
          </span>
        </button>
      ) : variant === 'footer' ? (
        <button
          type="button"
          onClick={handleTriggerClick}
          title={labels.title}
          className={`inline-flex items-center gap-2 px-3 py-2 min-h-[40px] max-w-full rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/25 hover:border-amber-400/50 text-amber-300 text-xs font-semibold text-left leading-snug transition-colors ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{labels.btnFooter}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleTriggerClick}
          title={labels.title}
          aria-label={labels.btn}
          className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 h-9 sm:h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-white/[0.1] hover:border-amber-400/40 text-zinc-200 hover:text-amber-300 text-xs font-medium transition-all shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden xl:inline">{labels.btn}</span>
          <span className="hidden min-[380px]:inline xl:hidden">{labels.btnShort}</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom"
          role="dialog"
          aria-modal="true"
          aria-label={labels.modalTitle}
        >
          <div className="bg-[#111114] border-t sm:border border-white/[0.12] rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-zinc-50 font-bold text-sm sm:text-base font-display">
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{labels.modalTitle}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{labels.modalSub}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-w-[40px] min-h-[40px] -mr-1.5 -mt-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center shrink-0"
                aria-label={labels.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {canInstall && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await promptInstall();
                  if (ok) setShowGuide(false);
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{labels.nativeInstallBtn}</span>
              </button>
            )}

            {isInAppBrowser && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 text-xs text-amber-200 space-y-2.5">
                <p className="leading-relaxed">{labels.inAppWarning}</p>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.12] text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{labels.copiedUrlBtn}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>{labels.copyUrlBtn}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Platform selector tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#09090b] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSelectedTab('ios')}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  selectedTab === 'ios'
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>{labels.tabIphone}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('mac')}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  selectedTab === 'mac'
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 shrink-0" />
                <span>{labels.tabMac}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('android')}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  selectedTab === 'android'
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <TabletSmartphone className="w-3.5 h-3.5 shrink-0" />
                <span>{labels.tabAndroid}</span>
              </button>
            </div>

            {selectedTab === 'ios' && (
              <div className="space-y-3 text-xs text-zinc-300 bg-[#09090b] border border-white/[0.08] rounded-xl p-4">
                <div className="font-semibold text-amber-300 flex items-center gap-2">
                  <Share className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{labels.iosNote}</span>
                </div>
                <ol className="space-y-2.5 list-decimal pl-4">
                  {labels.iosSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
                {!isInAppBrowser && (
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-200 font-medium flex items-center justify-center gap-2 transition-colors mt-1"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{labels.copiedUrlBtn}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>{labels.copyUrlBtn}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {selectedTab === 'mac' && (
              <div className="space-y-3 text-xs text-zinc-300">
                <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
                  <div className="font-semibold text-amber-300">{labels.macSafariTitle}</div>
                  <ol className="space-y-2 list-decimal pl-4">
                    {labels.macSafariSteps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
                  <div className="font-semibold text-zinc-100">{labels.macChromeTitle}</div>
                  <ol className="space-y-2 list-decimal pl-4">
                    {labels.macChromeSteps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {selectedTab === 'android' && (
              <div className="space-y-2.5 text-xs text-zinc-300 bg-[#09090b] border border-white/[0.08] rounded-xl p-4">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <MoreVertical className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{labels.androidTitle}</span>
                </div>
                <ol className="space-y-2.5 list-decimal pl-4">
                  {labels.androidSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/[0.1] text-zinc-100 font-semibold text-sm transition-colors"
            >
              {labels.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
