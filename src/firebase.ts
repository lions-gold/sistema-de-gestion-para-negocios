import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { readManualOfflineFlag } from './hooks/usePWAInstall';

export const SUPER_ADMIN_EMAIL = 'empresaalhadiqainvest@gmail.com';

const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env || {};

const envBackedFirebaseConfig = {
  apiKey: viteEnv.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: viteEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: viteEnv.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId:
    viteEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
};

const useSameOriginAuth =
  typeof window !== 'undefined' &&
  viteEnv.VITE_USE_SAME_ORIGIN_AUTH === 'true' &&
  window.location.protocol === 'https:';

const resolvedFirebaseConfig = useSameOriginAuth
  ? { ...envBackedFirebaseConfig, authDomain: window.location.host }
  : envBackedFirebaseConfig;

const app = initializeApp(resolvedFirebaseConfig);

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    resolvedFirebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
}

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      inMemoryPersistence,
    ],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}

try {
  authInstance.useDeviceLanguage();
} catch {
  // ignore in SSR / restricted contexts
}

export const db: Firestore = firestoreInstance;
export const auth: Auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (readManualOfflineFlag() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase working with local offline cache.');
    }
  }
}

testConnection();
export default app;
