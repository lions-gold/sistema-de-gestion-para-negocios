import React, { useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

export const PWAInstallButton: React.FC = () => {
  const { lang } = useLanguage();
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;
  if (!canInstall && !isIOS) return null;

  const labels = {
    es: {
      btn: 'Instalar App',
      btnShort: 'App',
      title: 'Instalar Smith Solutions como aplicación offline',
      iosTitle: 'Instalar en iPhone / iPad',
      iosStep1: 'Abre esta página en Safari y toca el botón Compartir',
      iosStep2: 'Desliza y selecciona "Agregar a pantalla de inicio"',
      iosStep3: 'Toca "Agregar" para usarla como App nativa sin internet',
      close: 'Entendido',
    },
    en: {
      btn: 'Install App',
      btnShort: 'App',
      title: 'Install Smith Solutions for offline use',
      iosTitle: 'Install on iPhone / iPad',
      iosStep1: 'Open in Safari and tap the Share button',
      iosStep2: 'Scroll down and select "Add to Home Screen"',
      iosStep3: 'Tap "Add" to launch it like a native offline app',
      close: 'Got it',
    },
    zh: {
      btn: '安装应用',
      btnShort: '应用',
      title: '安装 Smith Solutions 离线应用',
      iosTitle: '在 iPhone / iPad 上安装',
      iosStep1: '在 Safari 浏览器中点击底部的“分享”图标',
      iosStep2: '向下滑动并选择“添加到主屏幕”',
      iosStep3: '点击“添加”，即可像原生离线应用一样使用',
      close: '知道了',
    },
  }[lang];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInstall) {
            promptInstall();
          } else if (isIOS) {
            setShowIOSGuide(true);
          }
        }}
        title={labels.title}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-white/[0.1] text-zinc-200 hover:text-amber-300 text-xs font-medium transition-all shrink-0 min-h-[40px] sm:min-h-[36px]"
      >
        <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="hidden sm:inline">{labels.btn}</span>
        <span className="sm:hidden">{labels.btnShort}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#111114] border-t sm:border border-white/[0.12] rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-zinc-50 font-bold text-sm">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span>{labels.iosTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center"
                aria-label={labels.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="text-sm sm:text-xs text-zinc-300 space-y-3 list-decimal pl-5">
              <li className="leading-relaxed">
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  <span>{labels.iosStep1}</span>
                  <Share className="w-4 h-4 text-amber-400 shrink-0" />
                </span>
              </li>
              <li className="leading-relaxed">{labels.iosStep2}</li>
              <li className="leading-relaxed">{labels.iosStep3}</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[48px] py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-bold text-sm"
            >
              {labels.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
