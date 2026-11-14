import React, { useState, useEffect } from 'react';
import {
  Cookie,
  ShieldCheck,
  Check,
  X,
  Settings2,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { updateAnalyticsConsent } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';

export interface CookiePreferences {
  essential: boolean;
  preferences: boolean;
  analytics: boolean;
  acceptedAt: string;
}

const STORAGE_KEY = 'smith_solutions_cookie_consent';

export const CookieBanner: React.FC = () => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [preferences, setPreferences] = useState<{
    preferences: boolean;
    analytics: boolean;
  }>({
    preferences: true,
    analytics: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (
    acceptedAll: boolean,
    customPrefs?: { preferences: boolean; analytics: boolean }
  ) => {
    const consentData: CookiePreferences = {
      essential: true,
      preferences: customPrefs ? customPrefs.preferences : acceptedAll,
      analytics: customPrefs ? customPrefs.analytics : acceptedAll,
      acceptedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
    updateAnalyticsConsent(consentData.analytics, consentData.preferences);
    setIsVisible(false);
    setShowConfigModal(false);
  };

  const handleOpenPreferences = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: CookiePreferences = JSON.parse(saved);
        setPreferences({
          preferences: parsed.preferences ?? true,
          analytics: parsed.analytics ?? true,
        });
      } catch {
        // ignore
      }
    }
    setShowConfigModal(true);
  };

  return (
    <>
      {!isVisible && (
        <button
          onClick={handleOpenPreferences}
          className="fixed bottom-20 md:bottom-5 left-4 z-40 bg-[#111114]/90 hover:bg-zinc-900 text-zinc-300 hover:text-amber-400 border border-white/[0.1] p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all flex items-center gap-2 group text-xs font-medium"
          title={t.cookie.btnTitle}
        >
          <Cookie className="w-4 h-4 text-amber-400" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-[11px] font-mono pr-0 group-hover:pr-1">
            Cookies
          </span>
        </button>
      )}

      {isVisible && (
        <aside
          role="region"
          aria-label={t.cookie.badge}
          className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-xl z-50"
        >
          <div className="bg-[#111114]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-5 shadow-2xl shadow-black/90 text-zinc-100 flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-900 text-amber-400 rounded-lg border border-white/[0.08]">
                  <Cookie className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-50 text-sm sm:text-base font-display flex flex-wrap items-center gap-2">
                    <span>Smith Solutions E-Commerce</span>
                    <span className="text-[11px] font-mono text-zinc-400 font-normal">
                      · {t.cookie.badge}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400">{t.cookie.subtitle}</p>
                </div>
              </div>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {!isMinimized && (
              <>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {t.cookie.bodyBefore}{' '}
                  <strong className="text-amber-400">Smith Solutions E-Commerce</strong>{' '}
                  {t.cookie.bodyMid}{' '}
                  <span className="text-zinc-100 font-medium">{t.cookie.bodyRate}</span>{' '}
                  {t.cookie.bodyAfter} <strong className="text-emerald-400">HTTPS</strong>.
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#09090b] p-2.5 rounded-xl border border-white/[0.07] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{t.cookie.httpsLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{t.cookie.localLabel}</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
              <button
                onClick={handleOpenPreferences}
                className="text-xs text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 underline underline-offset-4 py-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{t.cookie.customize}</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => saveConsent(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.1] transition-colors min-h-[38px]"
                >
                  {t.cookie.essentialsOnly}
                </button>
                <button
                  onClick={() => saveConsent(true)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors flex items-center gap-1.5 min-h-[38px]"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t.cookie.acceptAll}</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {showConfigModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#111114] border border-white/[0.12] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-zinc-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-900 text-amber-400 rounded-lg border border-white/[0.08]">
                  <Cookie className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-50 font-display">
                    {t.cookie.modalTitle}
                  </h3>
                  <p className="text-xs text-zinc-400">{t.cookie.modalSubtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">{t.cookie.modalDesc}</p>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-sm text-zinc-100">{t.cookie.cat1Title}</span>
                    <span className="text-emerald-400 font-mono">· {t.cookie.cat1Badge}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{t.cookie.cat1Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="rounded text-amber-400 bg-zinc-900 border-white/[0.15] cursor-not-allowed mt-1"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-sm text-zinc-100">{t.cookie.cat2Title}</span>
                    <span className="text-sky-400 font-mono">· {t.cookie.cat2Badge}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{t.cookie.cat2Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferences}
                  onChange={(e) => setPreferences({ ...preferences, preferences: e.target.checked })}
                  className="rounded text-amber-400 bg-zinc-900 border-white/[0.15] mt-1 cursor-pointer w-4 h-4"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-sm text-zinc-100">{t.cookie.cat3Title}</span>
                    <span className="text-zinc-400 font-mono">· {t.cookie.cat3Badge}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{t.cookie.cat3Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                  className="rounded text-amber-400 bg-zinc-900 border-white/[0.15] mt-1 cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => saveConsent(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-zinc-300 transition-colors"
              >
                {t.cookie.essentialsOnly}
              </button>
              <button
                onClick={() => saveConsent(false, preferences)}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors"
              >
                {t.cookie.savePrefs}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
