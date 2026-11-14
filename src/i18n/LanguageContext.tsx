import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  SupportedLanguage,
  TranslationDictionary,
  translations,
} from './translations';

const LANG_STORAGE_KEY = 'smith_solutions_lang_v1';

interface LanguageContextValue {
  lang: SupportedLanguage;
  setLang: (next: SupportedLanguage) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  setLang: () => {},
  t: translations.es,
});

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'es';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'es' || saved === 'en' || saved === 'zh') {
      return saved;
    }
  } catch {
    // ignore storage access issues
  }
  return 'es'; // Español is always the primary default language
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SupportedLanguage>(getInitialLanguage);

  const setLang = (next: SupportedLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    }
  }, [lang]);

  const t: TranslationDictionary = translations[lang] || translations.es;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
