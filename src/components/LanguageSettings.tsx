import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Globe, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  SupportedLanguage,
  TranslationDictionary,
} from '../i18n/translations';
import { useLanguage } from '../i18n/LanguageContext';
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateAuditTypeLabel,
  translateCashOrPurchaseCategoryLabel,
  translateClosingStatusLabel,
  translateCommonPaymentInstruction,
  translateOrderStatusLabel,
  translatePaymentMethodLabel,
  translateSaleChannelLabel,
  translateShippingTypeLabel,
  translateSizeTokenLabel,
  translateUnitLabel,
  translateWarehouseLocationLabel,
} from '../utils/platformLabelsI18n';

export type TranslationSection = keyof TranslationDictionary;

export interface GranularTranslationContextValue<
  K extends TranslationSection = TranslationSection,
> {
  lang: SupportedLanguage;
  setLang: (next: SupportedLanguage) => void;
  t: TranslationDictionary;
  common: TranslationDictionary['common'];
  section: TranslationDictionary[K];
  sectionName: K;
  tr: (es: string, en: string, zh: string) => string;
  translateField: <P extends keyof TranslationDictionary[K]>(
    key: P
  ) => TranslationDictionary[K][P];
  labelPaymentMethod: (name: string) => string;
  labelCategory: (category: string) => string;
  labelUnit: (unit: string, plural?: boolean) => string;
  labelPaymentInstruction: (instructions?: string) => string;
  labelClosingStatus: (status: string) => string;
  labelAuditType: (type: string) => string;
  labelWarehouseLocation: (location: string) => string;
  labelCashCategory: (category: string) => string;
  labelShippingType: (type: string) => string;
  labelSaleChannel: (channel: string) => string;
  labelOrderStatus: (status: string) => string;
  labelSizeToken: (size: string) => string;
}

interface GranularScopeInternalValue {
  sectionName: TranslationSection;
}

const GranularTranslationScopeContext =
  createContext<GranularScopeInternalValue>({
    sectionName: 'common',
  });

export interface GranularTranslationScopeProviderProps {
  section: TranslationSection;
  children: React.ReactNode;
}

/**
 * Provides a subsection translation scope (e.g. "warehouse", "merchant", "admin", "marketplace")
 * that stays reactively bound to LanguageProvider without requiring page reloads.
 */
export const GranularTranslationScopeProvider: React.FC<
  GranularTranslationScopeProviderProps
> = ({ section, children }) => {
  // Explicitly subscribe to LanguageProvider so scoped descendants update reactively when lang changes
  useLanguage();

  const scopeValue = useMemo<GranularScopeInternalValue>(
    () => ({ sectionName: section }),
    [section]
  );

  return (
    <GranularTranslationScopeContext.Provider value={scopeValue}>
      {children}
    </GranularTranslationScopeContext.Provider>
  );
};

/**
 * Granular subsection hook exposed by LanguageSettings for child forms, panels, and configuration modals.
 * Directly observes LanguageProvider state updates so UI text re-renders reactively without page reload.
 */
export function useSubsectionTranslation<
  K extends TranslationSection = 'common',
>(explicitSection?: K): GranularTranslationContextValue<K> {
  const { lang, setLang, t, tr } = useLanguage();
  const inheritedScope = useContext(GranularTranslationScopeContext);
  const resolvedSection = (explicitSection ||
    inheritedScope.sectionName ||
    'common') as K;

  const sectionDict = t[resolvedSection];

  const translateField = useCallback(
    <P extends keyof TranslationDictionary[K]>(key: P) => sectionDict[key],
    [sectionDict]
  );

  const labelPaymentMethod = useCallback(
    (name: string) => translatePaymentMethodLabel(name, lang),
    [lang]
  );
  const labelCategory = useCallback(
    (category: string) => translateCategoryLabel(category, lang),
    [lang]
  );
  const labelUnit = useCallback(
    (unit: string, plural?: boolean) => translateUnitLabel(unit, lang, plural),
    [lang]
  );
  const labelPaymentInstruction = useCallback(
    (instructions?: string) =>
      translateCommonPaymentInstruction(instructions, lang),
    [lang]
  );
  const labelClosingStatus = useCallback(
    (status: string) => translateClosingStatusLabel(status, lang),
    [lang]
  );
  const labelAuditType = useCallback(
    (type: string) => translateAuditTypeLabel(type, lang),
    [lang]
  );
  const labelWarehouseLocation = useCallback(
    (location: string) => translateWarehouseLocationLabel(location, lang),
    [lang]
  );
  const labelCashCategory = useCallback(
    (category: string) => translateCashOrPurchaseCategoryLabel(category, lang),
    [lang]
  );
  const labelShippingType = useCallback(
    (type: string) => translateShippingTypeLabel(type, lang),
    [lang]
  );
  const labelSaleChannel = useCallback(
    (channel: string) => translateSaleChannelLabel(channel, lang),
    [lang]
  );
  const labelOrderStatus = useCallback(
    (status: string) => translateOrderStatusLabel(status, lang),
    [lang]
  );
  const labelSizeToken = useCallback(
    (size: string) => translateSizeTokenLabel(size, lang),
    [lang]
  );

  return useMemo<GranularTranslationContextValue<K>>(
    () => ({
      lang,
      setLang,
      t,
      common: t.common,
      section: sectionDict,
      sectionName: resolvedSection,
      tr,
      translateField,
      labelPaymentMethod,
      labelCategory,
      labelUnit,
      labelPaymentInstruction,
      labelClosingStatus,
      labelAuditType,
      labelWarehouseLocation,
      labelCashCategory,
      labelShippingType,
      labelSaleChannel,
      labelOrderStatus,
      labelSizeToken,
    }),
    [
      lang,
      setLang,
      t,
      sectionDict,
      resolvedSection,
      tr,
      translateField,
      labelPaymentMethod,
      labelCategory,
      labelUnit,
      labelPaymentInstruction,
      labelClosingStatus,
      labelAuditType,
      labelWarehouseLocation,
      labelCashCategory,
      labelShippingType,
      labelSaleChannel,
      labelOrderStatus,
      labelSizeToken,
    ]
  );
}

export const useScopedTranslation = useSubsectionTranslation;

export interface LanguageSettingsProps {
  variant?: 'panel' | 'compact';
  className?: string;
  onLanguageChange?: (next: SupportedLanguage) => void;
}

export const LanguageSettings: React.FC<LanguageSettingsProps> = ({
  variant = 'panel',
  className = '',
  onLanguageChange,
}) => {
  const { lang, setLang, tr } = useLanguage();
  const [justSavedLang, setJustSavedLang] = useState<SupportedLanguage | null>(
    null
  );
  const savedBannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedBannerTimerRef.current !== null) {
        window.clearTimeout(savedBannerTimerRef.current);
      }
    };
  }, []);

  const handleSelectLanguage = (code: SupportedLanguage) => {
    setLang(code);
    setJustSavedLang(code);
    onLanguageChange?.(code);
    if (savedBannerTimerRef.current !== null) {
      window.clearTimeout(savedBannerTimerRef.current);
    }
    savedBannerTimerRef.current = window.setTimeout(() => {
      setJustSavedLang((prev) => (prev === code ? null : prev));
      savedBannerTimerRef.current = null;
    }, 2200);
  };

  const getLanguageDescription = (code: SupportedLanguage): string => {
    if (code === 'es') {
      return tr(
        'Idioma predeterminado de la plataforma',
        'Default platform language',
        '平台默认语言'
      );
    }
    if (code === 'en') {
      return tr(
        'Interfaz completa y reportes en inglés',
        'Full interface & reports in English',
        '完整英文界面与报表导出'
      );
    }
    return tr(
      'Interfaz completa en chino simplificado',
      'Full interface in Simplified Chinese',
      '完整简体中文操作界面'
    );
  };

  if (variant === 'compact') {
    return (
      <div
        className={`bg-[#111114] border border-white/[0.08] rounded-xl p-3.5 space-y-2.5 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Globe className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {tr('Idioma de la Interfaz', 'Interface Language', '界面语言偏好')}
            </span>
          </div>
          {justSavedLang && (
            <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{tr('Guardado', 'Saved', '已保存')}</span>
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={tr('Seleccionar idioma', 'Select language', '选择界面语言')}
          className="grid grid-cols-3 gap-2"
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = lang === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleSelectLanguage(opt.code)}
                className={`min-h-[40px] px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  active
                    ? 'bg-amber-400/15 border-amber-400/60 text-amber-300'
                    : 'bg-[#09090b] border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18]'
                }`}
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    active
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {opt.shortLabel}
                </span>
                <span className="truncate">{opt.nativeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={tr(
        'Configuración de Idioma',
        'Language Settings',
        '界面语言设置'
      )}
      className={`bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-white font-display">
              {tr(
                'Preferencia de Idioma de la Interfaz',
                'Interface Language Preference',
                '界面语言设置'
              )}
            </h3>
            {justSavedLang && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                <Check className="w-3 h-3" />
                <span>
                  {tr(
                    'Preferencia guardada',
                    'Preference saved',
                    '已保存偏好'
                  )}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            {tr(
              'Elige el idioma en el que deseas visualizar todos los menús, configuraciones, tablas y reportes descargables. Tu preferencia se guarda automáticamente en este navegador.',
              'Choose the language used across menus, configuration panels, tables, and downloadable reports. Your preference is saved automatically in this browser.',
              '选择界面所有菜单、配置表单、数据表格与导出报表的显示语言。您的选择将自动保存在本地浏览器中并即时生效。'
            )}
          </p>
        </div>

        {lang !== 'es' && (
          <button
            type="button"
            onClick={() => handleSelectLanguage('es')}
            className="self-start px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/40 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {tr(
                'Restaurar Español',
                'Reset to Spanish',
                '恢复默认西班牙语'
              )}
            </span>
          </button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={tr(
          'Opciones de idioma disponibles',
          'Available language options',
          '可选界面语言'
        )}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {LANGUAGE_OPTIONS.map((opt) => {
          const active = lang === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelectLanguage(opt.code)}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                active
                  ? 'bg-amber-500/[0.1] border-amber-400/60 shadow-sm shadow-amber-500/10'
                  : 'bg-[#09090b] border-white/[0.08] hover:border-white/[0.2] hover:bg-zinc-900/60'
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide shrink-0 ${
                      active
                        ? 'bg-amber-400 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {opt.shortLabel}
                  </span>
                  <span
                    className={`text-sm font-bold truncate ${
                      active ? 'text-amber-300' : 'text-white'
                    }`}
                  >
                    {opt.nativeName}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {getLanguageDescription(opt.code)}
                </p>
              </div>

              <span
                aria-hidden="true"
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                  active
                    ? 'bg-amber-400 border-amber-400 text-zinc-950'
                    : 'border-white/[0.15] bg-transparent'
                }`}
              >
                {active && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          {tr(
            'Aislamiento por sesión: el idioma predeterminado sigue siendo Español y tu cambio no afecta la vista de otros usuarios.',
            'Session isolated: the platform default remains Spanish and your selection never affects other users’ view.',
            '会话级独立保存：平台默认语言保持为西班牙语，您的切换不会影响其他并发用户。'
          )}
        </span>
      </div>
    </section>
  );
};

export default LanguageSettings;
