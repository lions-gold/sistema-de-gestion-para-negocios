import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  SupportedLanguage,
  TranslationDictionary,
  translations,
} from './translations';

const GUEST_LANG_STORAGE_KEY = 'smith_solutions_lang_guest_v1';
const getUserLangStorageKey = (uid: string) => `smith_solutions_lang_uid_${uid}`;

function isSupportedLang(val: unknown): val is SupportedLanguage {
  return val === 'es' || val === 'en' || val === 'zh';
}

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

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'es';
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (isSupportedLang(urlLang)) {
      return urlLang;
    }
  } catch {
    // ignore URL parsing errors
  }
  const uid = auth.currentUser?.uid;
  if (uid) {
    const userSaved = readStorageLang(getUserLangStorageKey(uid));
    if (userSaved) return userSaved;
  }
  return readStorageLang(GUEST_LANG_STORAGE_KEY) || 'es';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [lang, setLangState] = useState<SupportedLanguage>(getInitialLanguage);

  // Listen to per-user auth changes so switching accounts on the same browser isolates each user's language
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (u) {
        const userCached = readStorageLang(getUserLangStorageKey(u.uid));
        if (userCached) {
          setLangState(userCached);
        } else {
          setLangState(readStorageLang(GUEST_LANG_STORAGE_KEY) || 'es');
        }
      } else {
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
          if (isSupportedLang(remoteLang)) {
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

  const setLang = useCallback(
    (next: SupportedLanguage) => {
      setLangState(next);
      if (authUser) {
        writeStorageLang(getUserLangStorageKey(authUser.uid), next);
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
        writeStorageLang(GUEST_LANG_STORAGE_KEY, next);
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

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
