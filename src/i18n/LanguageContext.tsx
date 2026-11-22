import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  SupportedLanguage,
  TranslationDictionary,
  translations,
} from './translations';

const GUEST_LANG_STORAGE_KEY = 'smith_solutions_lang_guest_v1';
const LANGUAGE_CHANGE_EVENT = 'smith_language_preference_changed';
const getUserLangStorageKey = (uid: string) => `smith_solutions_lang_uid_${uid}`;

function isSupportedLang(val: unknown): val is SupportedLanguage {
  return val === 'es' || val === 'en' || val === 'zh';
}

export function translateByLang(
  lang: SupportedLanguage,
  es: string,
  en: string,
  zh: string
): string {
  if (lang === 'en') return en;
  if (lang === 'zh') return zh;
  return es;
}

function resolveLangStorageKey(uid?: string | null): string {
  const effectiveUid = uid !== undefined ? uid : auth.currentUser?.uid;
  return effectiveUid ? getUserLangStorageKey(effectiveUid) : GUEST_LANG_STORAGE_KEY;
}

function readStorageLang(key: string): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(key);
    if (isSupportedLang(saved)) return saved;
  } catch {
    // ignore storage access issues
  }
  return null;
}

function writeStorageLang(key: string, next: SupportedLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, next);
  } catch {
    // ignore storage errors
  }
}

function readUrlLangParam(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (isSupportedLang(urlLang)) {
      return urlLang;
    }
  } catch {
    // ignore URL parsing errors
  }
  return null;
}

/**
 * Loads the persisted UI language preference for the given user (or guest session) from localStorage.
 * Falls back safely to Spanish ('es'), preserving the platform default.
 */
export function loadPersistedLanguagePreference(uid?: string | null): SupportedLanguage {
  if (typeof window === 'undefined') return 'es';
  const urlLang = readUrlLangParam();
  if (urlLang) {
    return urlLang;
  }
  const storageKey = resolveLangStorageKey(uid);
  return readStorageLang(storageKey) || 'es';
}

/**
 * Persists the selected UI language preference to localStorage scoped strictly to the active user/guest
 * and notifies any active LanguageProvider instances in the same window to update reactively.
 */
export function persistLanguagePreference(
  next: SupportedLanguage,
  uid?: string | null
): void {
  if (!isSupportedLang(next)) return;
  const storageKey = resolveLangStorageKey(uid);
  writeStorageLang(storageKey, next);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(LANGUAGE_CHANGE_EVENT, {
          detail: { lang: next, storageKey },
        })
      );
    } catch {
      // ignore CustomEvent dispatch errors
    }
  }
}

export function getSavedLanguageClient(): SupportedLanguage {
  return loadPersistedLanguagePreference();
}

interface LanguageContextValue {
  lang: SupportedLanguage;
  setLang: (next: SupportedLanguage) => void;
  t: TranslationDictionary;
  tr: (es: string, en: string, zh: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  setLang: () => {},
  t: translations.es,
  tr: (es: string) => es,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [lang, setLangState] = useState<SupportedLanguage>(() =>
    loadPersistedLanguagePreference()
  );
  const urlOverrideActiveRef = React.useRef<boolean>(readUrlLangParam() !== null);
  const hasExplicitSessionGuestPickRef = React.useRef<boolean>(false);
  const prevAuthUidRef = React.useRef<string | null>(auth.currentUser?.uid || null);

  // Listen to per-user auth changes so switching accounts on the same browser strictly isolates each user's language
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      const prevUid = prevAuthUidRef.current;
      prevAuthUidRef.current = u?.uid || null;
      setAuthUser(u);

      // Preserve explicit ?lang= view parameter until the user manually picks another language
      if (urlOverrideActiveRef.current) {
        return;
      }

      if (u) {
        const userCached = readStorageLang(getUserLangStorageKey(u.uid));
        if (userCached) {
          setLangState(userCached);
        } else if (!prevUid && hasExplicitSessionGuestPickRef.current) {
          // Guest explicitly chose a language right before signing in: carry that choice into their session cleanly
          const guestPick = readStorageLang(GUEST_LANG_STORAGE_KEY) || 'es';
          setLangState(guestPick);
        } else {
          // Fresh authenticated account or account switch without saved preference defaults strictly to Spanish ('es')
          setLangState('es');
        }
      } else {
        // Signed out: isolate back to guest preference or default Spanish ('es')
        setLangState(readStorageLang(GUEST_LANG_STORAGE_KEY) || 'es');
      }
    });
    return () => unsubAuth();
  }, []);

  // Sync ONLY the authenticated verified user's own private preference document (never touches other users)
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) return;
    const prefPath = `userPreferences/${authUser.uid}`;
    const unsubPref = onSnapshot(
      doc(db, 'userPreferences', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          const remoteLang = snap.data()?.language;
          if (isSupportedLang(remoteLang) && !urlOverrideActiveRef.current) {
            setLangState(remoteLang);
            writeStorageLang(getUserLangStorageKey(authUser.uid), remoteLang);
          }
        }
      },
      (err) => {
        console.warn('Language preference listener fallback to local cache:', prefPath, err.message);
      }
    );
    return () => unsubPref();
  }, [authUser]);

  // Cross-tab + same-window reactive sync scoped strictly to THIS active user's storage key
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeStorageKey = resolveLangStorageKey(authUser?.uid || null);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== activeStorageKey) return;
      if (isSupportedLang(event.newValue) && !urlOverrideActiveRef.current) {
        setLangState(event.newValue);
      }
    };

    const handleLocalPreferenceEvent = (event: Event) => {
      const custom = event as CustomEvent<{ lang?: unknown; storageKey?: string }>;
      if (
        custom.detail?.storageKey === activeStorageKey &&
        isSupportedLang(custom.detail?.lang)
      ) {
        urlOverrideActiveRef.current = false;
        setLangState(custom.detail.lang);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLocalPreferenceEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLocalPreferenceEvent);
    };
  }, [authUser]);

  const setLang = useCallback(
    (next: SupportedLanguage) => {
      if (!isSupportedLang(next)) return;
      urlOverrideActiveRef.current = false;
      setLangState(next);

      // Clear ?lang= param if present so subsequent manual switching stays respected
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('lang')) {
            url.searchParams.delete('lang');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        } catch {
          // ignore history errors
        }
      }

      if (authUser) {
        persistLanguagePreference(next, authUser.uid);
        if (authUser.emailVerified && (typeof navigator === 'undefined' || navigator.onLine)) {
          setDoc(doc(db, 'userPreferences', authUser.uid), {
            uid: authUser.uid,
            language: next,
            updatedAt: serverTimestamp(),
          }).catch((err) => {
            console.warn('Language preference cloud sync deferred (offline/network):', err);
          });
        }
      } else {
        hasExplicitSessionGuestPickRef.current = true;
        persistLanguagePreference(next, null);
      }
    },
    [authUser]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    }
  }, [lang]);

  const t: TranslationDictionary = translations[lang] || translations.es;

  const tr = useCallback(
    (es: string, en: string, zh: string) => translateByLang(lang, es, en, zh),
    [lang]
  );

  const contextValue = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t, tr }),
    [lang, setLang, t, tr]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
