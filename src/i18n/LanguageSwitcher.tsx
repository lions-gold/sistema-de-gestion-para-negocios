import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, SupportedLanguage } from './translations';
import { useLanguage } from './LanguageContext';

interface LanguageSwitcherProps {
  compact?: boolean;
  placement?: 'down' | 'up';
  align?: 'left' | 'right';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  placement = 'down',
  align,
  className = '',
}) => {
  const { lang, setLang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === lang) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    setLang(code);
    setIsOpen(false);
  };

  const resolvedAlign = align ?? (placement === 'up' ? 'left' : 'right');
  const alignClass = resolvedAlign === 'left' ? 'left-0' : 'right-0';
  const menuPositionClass =
    placement === 'up'
      ? `bottom-full mb-1.5 ${alignClass}`
      : `top-full mt-1.5 ${alignClass}`;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t.header.languageLabel}: ${currentOption.nativeName}`}
        title={`${t.header.languageLabel}: ${currentOption.nativeName}`}
        className={`inline-flex items-center justify-between gap-1.5 rounded-lg border text-xs font-medium transition-colors duration-150 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
          compact
            ? 'px-2.5 h-9 sm:h-10'
            : 'px-3 h-10'
        } ${
          isOpen
            ? 'bg-zinc-800 border-amber-400/40 text-amber-300'
            : 'bg-zinc-900 hover:bg-zinc-800 border-white/[0.1] text-zinc-200 hover:text-white'
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold tracking-wide">
          {compact ? currentOption.shortLabel : currentOption.nativeName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-amber-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t.header.languageLabel}
          className={`absolute ${menuPositionClass} z-[70] min-w-[176px] rounded-xl bg-[#111114] border border-white/[0.12] shadow-2xl shadow-black/75 p-1.5 backdrop-blur-xl`}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {t.header.languageLabel}
          </div>
          <div className="space-y-0.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = lang === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSelect(opt.code)}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                    active
                      ? 'bg-amber-400/15 text-amber-300 font-semibold'
                      : 'text-zinc-200 hover:text-white hover:bg-white/[0.06] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center justify-center w-7 py-0.5 rounded text-[10px] font-bold tracking-wide shrink-0 ${
                        active
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {opt.shortLabel}
                    </span>
                    <span className="truncate">{opt.nativeName}</span>
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

