import React from 'react';
import { Mail, Phone, ShieldCheck, Cookie, Lock } from 'lucide-react';
import { MaterialAssembleLogo } from './MaterialAssembleLogo';
import { AppMainView } from '../utils/seoAndAnalytics';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

interface FooterProps {
  onOpenApp: (tab?: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales') => void;
  onNavigateView?: (view: AppMainView) => void;
  onTrigger404?: () => void;
  showWarehousePos?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenApp,
  onNavigateView,
  onTrigger404,
  showWarehousePos = false,
}) => {
  const { t } = useLanguage();

  const handleOpenCookieSettings = () => {
    localStorage.removeItem('smith_solutions_cookie_consent');
    window.location.reload();
  };

  return (
    <footer className="bg-[#070709] border-t border-white/[0.08] text-zinc-400 text-xs py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 space-y-4">
            <MaterialAssembleLogo size="md" />
            <p className="text-zinc-400 text-xs leading-relaxed max-w-sm">
              {t.footer.mission}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <Lock className="w-3.5 h-3.5" />
                <span>{t.footer.httpsSecure}</span>
              </span>
              <span aria-hidden="true">·</span>
              <button
                onClick={handleOpenCookieSettings}
                className="hover:text-amber-400 transition-colors flex items-center gap-1 underline underline-offset-4"
              >
                <Cookie className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.footer.cookiePrefs}</span>
              </button>
            </div>

            <div className="pt-1 flex items-center gap-2.5">
              <span className="text-[11px] text-zinc-400 font-medium">
                {t.footer.languageTitle}
              </span>
              <LanguageSwitcher />
            </div>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <span className="text-zinc-100 font-semibold block text-xs tracking-wide font-display">
              {t.footer.ecosystemTitle}
            </span>
            <ul className="space-y-2 text-xs text-zinc-400">
              {onNavigateView && (
                <>
                  <li>
                    <button
                      onClick={() => onNavigateView('marketplace')}
                      className="hover:text-amber-400 transition-colors font-medium text-zinc-200"
                    >
                      {t.footer.linkMarketplace}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigateView('merchant')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkMerchant}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigateView('admin')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkAdmin}
                    </button>
                  </li>
                </>
              )}
              {showWarehousePos && (
                <>
                  <li>
                    <button
                      onClick={() => onOpenApp('inventory')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkInventory}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onOpenApp('pos')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkPos}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onOpenApp('debtors')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkDebtors}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onOpenApp('cashier')}
                      className="hover:text-amber-400 transition-colors"
                    >
                      {t.footer.linkCashier}
                    </button>
                  </li>
                </>
              )}
              <li className="pt-2 flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                <a
                  href={`${import.meta.env.BASE_URL}sitemap.xml`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors underline underline-offset-2"
                >
                  sitemap.xml
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={`${import.meta.env.BASE_URL}robots.txt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors underline underline-offset-2"
                >
                  robots.txt
                </a>
                {onTrigger404 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      onClick={onTrigger404}
                      className="hover:text-amber-400 transition-colors underline underline-offset-2"
                    >
                      Error 404
                    </button>
                  </>
                )}
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3 bg-[#111114] p-5 rounded-xl border border-white/[0.08]">
            <div className="text-zinc-100 font-semibold text-xs flex items-center gap-1.5 font-display">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{t.footer.devCardTitle}</span>
            </div>

            <div className="text-amber-400 font-semibold text-sm">Smith Bussines Solutions 2026</div>

            <div className="space-y-2 text-xs text-zinc-300">
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
                  className="hover:text-emerald-300 transition-colors font-mono tabular-nums"
                >
                  +58 422 027 3766 (Venezuela)
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>{t.footer.rights}</div>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>{t.footer.designedBy}</span>
            <span className="text-amber-400 font-semibold">Smith Bussines Solutions 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
