import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, SupportedLanguage } from './translations';
import { useLanguage } from './LanguageContext';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  className = '',
}) => {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-zinc-900/90 border border-white/[0.08] rounded-lg p-0.5 ${className}`}
      role="group"
      aria-label={t.header.languageLabel}
      title={t.header.languageLabel}
    >
      {!compact && (
        <Globe className="w-3.5 h-3.5 text-amber-400/90 ml-2 mr-1 shrink-0 hidden sm:block" />
      )}
      {LANGUAGE_OPTIONS.map((opt) => {
        const active = lang === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLang(opt.code as SupportedLanguage)}
            aria-pressed={active}
            title={opt.nativeName}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 min-h-[28px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
              active
                ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
            }`}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
