import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, SUPER_ADMIN_EMAIL } from '../firebase';
import {
  isSupabaseBackupConfigured,
  mirrorFirebaseUserToBackupServer,
  resolveSupabaseSessionOnMount,
  signInWithSupabaseGoogleBackup,
  signOutSupabaseBackup,
  SupabaseBackupSession,
} from './supabaseAuthClient';
import {
  consumeOpenSourceAuthErrorFromUrl,
  fetchOpenSourceSessionState,
  type OpenSourceSessionState,
  type OpenSourceSessionUser,
  signOutOpenSourceSession,
  startOpenSourceGoogleSignIn,
} from './openSourceAuthClient';

export {
  consumeOpenSourceAuthErrorFromUrl,
  fetchOpenSourceSessionState,
  isSupabaseBackupConfigured,
  mirrorFirebaseUserToBackupServer,
  type OpenSourceSessionState,
  type OpenSourceSessionUser,
  resolveSupabaseSessionOnMount,
  signInWithSupabaseGoogleBackup,
  startOpenSourceGoogleSignIn,
  type SupabaseBackupSession,
};

export interface AuthEnvironmentInfo {
  isIOS: boolean;
  isMac: boolean;
  isAndroid: boolean;
  isMobileOrTablet: boolean;
  isSafari: boolean;
  isStandalonePWA: boolean;
  isInIframe: boolean;
  isInAppBrowser: boolean;
  inAppName: string | null;
}

export class GoogleAuthFriendlyError extends Error {
  code: string;
  hint?: string;
  canRetryWithRedirect: boolean;
  requiresExternalBrowser: boolean;

  constructor(params: {
    code: string;
    message: string;
    hint?: string;
    canRetryWithRedirect?: boolean;
    requiresExternalBrowser?: boolean;
  }) {
    super(params.message);
    this.name = 'GoogleAuthFriendlyError';
    this.code = params.code;
    this.hint = params.hint;
    this.canRetryWithRedirect = Boolean(params.canRetryWithRedirect);
    this.requiresExternalBrowser = Boolean(params.requiresExternalBrowser);
  }
}

const REDIRECT_PENDING_KEY = 'smith_google_redirect_pending_v1';

export function detectAuthEnvironment(): AuthEnvironmentInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isMac: false,
      isAndroid: false,
      isMobileOrTablet: false,
      isSafari: false,
      isStandalonePWA: false,
      isInIframe: false,
      isInAppBrowser: false,
      inAppName: null,
    };
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // Modern iPadOS reports Macintosh in UA with maxTouchPoints > 1
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && maxTouchPoints > 1) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);

  const isMac = !isIOS && (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platform));
  const isAndroid = /Android/i.test(ua);
  const isMobileOrTablet = isIOS || isAndroid || /Mobile|Tablet|Silk|Kindle/i.test(ua);

  const isSafari =
    /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(ua) ||
    (isIOS && !/CriOS|FxiOS|EdgiOS/i.test(ua));

  const isStandalonePWA =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as { standalone?: boolean }).standalone === true;

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  // Google blocks OAuth inside social/messaging in-app browsers (403 disallowed_useragent)
  let inAppName: string | null = null;
  if (/FBAN|FBAV/i.test(ua)) inAppName = 'Facebook';
  else if (/Instagram/i.test(ua)) inAppName = 'Instagram';
  else if (/WhatsApp/i.test(ua)) inAppName = 'WhatsApp';
  else if (/BytedanceWebview|TikTok/i.test(ua)) inAppName = 'TikTok';
  else if (/Messenger/i.test(ua)) inAppName = 'Messenger';
  else if (/\bwv\b/i.test(ua) && isAndroid) inAppName = 'WebView móvil';

  return {
    isIOS,
    isMac,
    isAndroid,
    isMobileOrTablet,
    isSafari,
    isStandalonePWA,
    isInIframe,
    isInAppBrowser: Boolean(inAppName),
    inAppName,
  };
}

function getCurrentAuthLanguage(): 'es' | 'en' | 'zh' {
  if (typeof document !== 'undefined') {
    const docLang = (document.documentElement.lang || '').toLowerCase();
    if (docLang.startsWith('zh')) return 'zh';
    if (docLang.startsWith('en')) return 'en';
    if (docLang.startsWith('es')) return 'es';
  }
  if (typeof window === 'undefined') return 'es';
  try {
    const raw =
      localStorage.getItem('smith_solutions_lang_guest_v1') ||
      localStorage.getItem('smith_solutions_lang');
    if (raw === 'en' || raw === 'zh' || raw === 'es') return raw;
  } catch {
    // ignore storage errors
  }
  return 'es';
}

export function syncFirebaseAuthLanguage(lang: 'es' | 'en' | 'zh') {
  try {
    auth.languageCode = lang === 'zh' ? 'zh-CN' : lang;
  } catch {
    // ignore
  }
}

async function syncAdminBootstrapIfMatch(user: User): Promise<void> {
  if (
    user &&
    user.emailVerified &&
    user.email &&
    user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  ) {
    try {
      const ref = doc(db, 'admins', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email,
          role: 'superadmin',
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // non-fatal during auth completion
    }
  }
}

export function mapGoogleAuthError(
  error: unknown,
  env: AuthEnvironmentInfo = detectAuthEnvironment()
): GoogleAuthFriendlyError {
  if (error instanceof GoogleAuthFriendlyError) return error;

  const lang = getCurrentAuthLanguage();
  const rawCode =
    (error as { code?: string })?.code ||
    (error instanceof Error && error.message.includes('auth/')
      ? error.message.match(/auth\/[a-z0-9-]+/i)?.[0]
      : '') ||
    'unknown';
  const rawMessage = error instanceof Error ? error.message : String(error || '');

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new GoogleAuthFriendlyError({
      code: 'auth/offline',
      message:
        lang === 'en'
          ? 'No internet connection. Reconnect Wi-Fi or mobile data to sign in with Google.'
          : lang === 'zh'
            ? '当前无网络连接。请连接 Wi-Fi 或移动数据后使用 Google 登录。'
            : 'Sin conexión a internet. Conecta tu Wi-Fi o datos móviles para iniciar sesión con Google.',
    });
  }

  if (
    rawCode === 'auth/disallowed-useragent' ||
    rawMessage.toLowerCase().includes('disallowed_useragent') ||
    env.isInAppBrowser
  ) {
    const appLabel = env.inAppName || 'esta aplicación';
    return new GoogleAuthFriendlyError({
      code: 'auth/disallowed-useragent',
      requiresExternalBrowser: true,
      message:
        lang === 'en'
          ? `Google restricts sign-in inside ${appLabel}'s built-in browser.`
          : lang === 'zh'
            ? `Google 不支持在 ${appLabel} 内置浏览器中登录。`
            : `Google restringe el acceso dentro del navegador integrado de ${appLabel}.`,
      hint:
        lang === 'en'
          ? 'Copy the link and open it directly in Safari (iPhone/iPad/Mac) or Chrome (Android).'
          : lang === 'zh'
            ? '请复制链接并在 Safari（iPhone/iPad/Mac）或 Chrome（Android）中打开。'
            : env.isIOS || env.isMac
              ? 'Copia el enlace o toca el menú compartir y selecciona "Abrir en Safari".'
              : 'Copia el enlace o toca los tres puntos arriba y selecciona "Abrir en Chrome".',
    });
  }

  if (
    rawCode === 'auth/popup-blocked' ||
    rawCode === 'auth/operation-not-supported-in-this-environment'
  ) {
    const hint = env.isIOS
      ? 'En iPhone/iPad: Ajustes → Safari → desactiva "Bloquear ventanas" o usa el botón de redirección.'
      : env.isMac && env.isSafari
        ? 'En Mac Safari: menú Safari → Ajustes → Sitios web → Ventanas emergentes → Permitir.'
        : 'Permite las ventanas emergentes para este sitio en tu navegador e inténtalo nuevamente.';
    return new GoogleAuthFriendlyError({
      code: rawCode,
      canRetryWithRedirect: !env.isInIframe,
      message:
        lang === 'en'
          ? 'Your browser blocked the Google sign-in window.'
          : lang === 'zh'
            ? '您的浏览器阻止了 Google 登录弹窗。'
            : 'El navegador bloqueó la ventana de inicio de sesión de Google.',
      hint,
    });
  }

  if (rawCode === 'auth/popup-closed-by-user') {
    return new GoogleAuthFriendlyError({
      code: rawCode,
      canRetryWithRedirect: !env.isInIframe,
      message:
        lang === 'en'
          ? 'Sign-in window was closed before completing Google login.'
          : lang === 'zh'
            ? '在完成 Google 登录前关闭了登录窗口。'
            : 'Se cerró la ventana de Google antes de completar el acceso.',
      hint: env.isSafari
        ? 'Si Safari cerró la ventana automáticamente, intenta con "Continuar en esta pestaña" o revisa el bloqueador de ventanas emergentes.'
        : 'Toca el botón nuevamente y selecciona tu cuenta de Google para continuar.',
    });
  }

  if (rawCode === 'auth/cancelled-popup-request') {
    return new GoogleAuthFriendlyError({
      code: rawCode,
      message:
        lang === 'en'
          ? 'A Google sign-in window is already open. Complete it or try again.'
          : lang === 'zh'
            ? '已有正在进行的登录请求，请完成或重试。'
            : 'Ya hay una ventana de Google en curso. Completa el acceso o intenta de nuevo.',
    });
  }

  if (rawCode === 'auth/unauthorized-domain') {
    const originHost =
      typeof window !== 'undefined' ? window.location.hostname : 'sistema-de-gestion-para-negocios.vercel.app';
    return new GoogleAuthFriendlyError({
      code: rawCode,
      message:
        lang === 'en'
          ? 'This domain is not yet authorized in Firebase Authentication.'
          : lang === 'zh'
            ? '当前域名尚未在 Firebase 身份验证中授权。'
            : 'Este dominio aún no está autorizado en Firebase Authentication.',
      hint: `Agrega "${originHost}" en Firebase Console → Authentication → Settings → Authorized domains, o usa el acceso alternativo Open Source / Supabase.`,
    });
  }

  if (rawCode === 'auth/network-request-failed' || rawCode === 'auth/timeout') {
    return new GoogleAuthFriendlyError({
      code: rawCode,
      message:
        lang === 'en'
          ? 'Network timeout while connecting to Google.'
          : lang === 'zh'
            ? '连接 Google 服务器超时，请检查网络后重试。'
            : 'Error de red al conectar con Google.',
      hint: 'Verifica tu conexión a internet o desactiva VPN/bloqueadores estrictos e intenta de nuevo.',
    });
  }

  if (rawCode === 'auth/user-disabled') {
    return new GoogleAuthFriendlyError({
      code: rawCode,
      message: 'Esta cuenta de Google fue suspendida por el administrador.',
    });
  }

  return new GoogleAuthFriendlyError({
    code: rawCode,
    canRetryWithRedirect: !env.isInIframe,
    message:
      lang === 'en'
        ? 'Could not complete Google sign-in.'
        : lang === 'zh'
          ? '无法完成 Google 登录，请重试。'
          : 'No se pudo completar el inicio de sesión con Google.',
    hint: rawMessage || 'Intenta nuevamente o prueba abrir en Safari / Chrome.',
  });
}

// Single-flight lock prevents mobile double-taps from triggering auth/cancelled-popup-request
let activeSignInPromise: Promise<User> | null = null;

export interface SignInOptions {
  /** Use 'redirect' only when running top-level outside iframes (mobile PWA/Safari fallback) */
  preferRedirect?: boolean;
  /** Automatically fall back to signInWithRedirect if popup is blocked on top-level mobile/Safari */
  allowRedirectFallback?: boolean;
}

/**
 * Unified, cross-device Google Sign-In & Registration:
 * - Preserves synchronous user gesture for Safari (iPhone, iPad, Mac).
 * - Deduplicates rapid double-taps on mobile touchscreens.
 * - Falls back cleanly to top-level redirect when popup is blocked on mobile/PWA/Safari.
 */
export async function signInWithGoogleResilient(options: SignInOptions = {}): Promise<User> {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  const env = detectAuthEnvironment();
  syncFirebaseAuthLanguage(getCurrentAuthLanguage());

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw mapGoogleAuthError(new Error('offline'), env);
  }

  if (env.isInAppBrowser) {
    throw mapGoogleAuthError({ code: 'auth/disallowed-useragent' }, env);
  }

  const { preferRedirect = false, allowRedirectFallback = !env.isInIframe } = options;

  // Important: Call signInWithPopup or signInWithRedirect SYNCHRONOUSLY before any await
  // so iOS/iPadOS/macOS Safari preserves the user tap gesture!
  const run = async (): Promise<User> => {
    if (preferRedirect && !env.isInIframe) {
      try {
        sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
      } catch {
        // ignore sessionStorage error
      }
      await signInWithRedirect(auth, googleProvider);
      // Browser navigates away; return a pending error guard in case execution continues briefly
      throw new GoogleAuthFriendlyError({
        code: 'auth/redirect-initiated',
        message: 'Redirigiendo a Google...',
      });
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncAdminBootstrapIfMatch(result.user);
      mirrorFirebaseUserToBackupServer(result.user).catch(() => {});
      return result.user;
    } catch (popupErr) {
      const code = (popupErr as { code?: string })?.code || '';

      // Automatic failover switch: if Firebase Auth service/network is unreachable and self-hosted Supabase is configured
      const isFirebaseServiceFailure =
        code === 'auth/network-request-failed' ||
        code === 'auth/internal-error' ||
        code === 'auth/timeout' ||
        code === 'auth/too-many-requests';

      if (
        isFirebaseServiceFailure &&
        isSupabaseBackupConfigured() &&
        !env.isInIframe &&
        !env.isInAppBrowser
      ) {
        await signInWithSupabaseGoogleBackup();
        throw new GoogleAuthFriendlyError({
          code: 'auth/redirect-initiated',
          message: 'Conmutando a respaldo Supabase...',
        });
      }

      const shouldFallbackToRedirect =
        allowRedirectFallback &&
        !env.isInIframe &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          (env.isStandalonePWA && (code === 'auth/internal-error' || code === 'auth/popup-closed-by-user')));

      if (shouldFallbackToRedirect) {
        try {
          sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        await signInWithRedirect(auth, googleProvider);
        throw new GoogleAuthFriendlyError({
          code: 'auth/redirect-initiated',
          message: 'Redirigiendo a Google para completar tu acceso...',
        });
      }

      throw mapGoogleAuthError(popupErr, env);
    }
  };

  activeSignInPromise = run().finally(() => {
    activeSignInPromise = null;
  });

  return activeSignInPromise;
}

export async function signInWithGoogleRedirectDirect(): Promise<void> {
  const env = detectAuthEnvironment();
  if (env.isInIframe) {
    throw new GoogleAuthFriendlyError({
      code: 'auth/iframe-redirect-unsupported',
      message: 'Abre la página en una pestaña independiente para usar redirección directa.',
      hint: 'Toca "Copiar enlace" y ábrelo en Safari o Chrome.',
    });
  }
  syncFirebaseAuthLanguage(getCurrentAuthLanguage());
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Call once on application mount to finalize any returning mobile/tablet/Safari Google redirect login.
 */
export async function resolveGoogleRedirectOnMount(): Promise<{
  user: User | null;
  error: GoogleAuthFriendlyError | null;
}> {
  let wasPending = false;
  try {
    wasPending = Boolean(sessionStorage.getItem(REDIRECT_PENDING_KEY));
    if (wasPending) {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    }
  } catch {
    wasPending = false;
  }

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await syncAdminBootstrapIfMatch(result.user);
      mirrorFirebaseUserToBackupServer(result.user).catch(() => {});
      return { user: result.user, error: null };
    }
    return { user: auth.currentUser, error: null };
  } catch (err) {
    if (wasPending) {
      return { user: null, error: mapGoogleAuthError(err) };
    }
    return { user: auth.currentUser, error: null };
  }
}

export async function getFreshFirebaseIdToken(
  user: User,
  forceRefresh = false
): Promise<string> {
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return user.getIdToken(true);
  }
}

export async function signOutGoogleResilient(): Promise<void> {
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    // ignore
  }
  await Promise.allSettled([
    signOut(auth),
    signOutSupabaseBackup(),
    signOutOpenSourceSession(),
  ]);
}
