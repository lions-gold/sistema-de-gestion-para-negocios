import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import {
  detectAuthEnvironment,
  fetchOpenSourceSessionState,
  GoogleAuthFriendlyError,
  isSupabaseBackupConfigured,
  mapGoogleAuthError,
  signInWithGoogleRedirectDirect,
  signInWithGoogleResilient,
  signInWithSupabaseGoogleBackup,
  startOpenSourceGoogleSignIn,
} from '../services/authService';

interface GoogleAuthButtonProps {
  label?: string;
  loadingLabel?: string;
  onSuccess?: (user: User) => void;
  onError?: (error: GoogleAuthFriendlyError) => void;
  variant?: 'primary' | 'amber' | 'compact';
  fullWidth?: boolean;
  className?: string;
  showDeviceNotice?: boolean;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12c0 1.94.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  label = 'Continuar con Google',
  loadingLabel = 'Conectando con Google...',
  onSuccess,
  onError,
  variant = 'primary',
  fullWidth = false,
  className = '',
  showDeviceNotice = true,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [authError, setAuthError] = useState<GoogleAuthFriendlyError | null>(null);
  const [openSourceOAuthReady, setOpenSourceOAuthReady] = useState(false);

  const env = useMemo(() => detectAuthEnvironment(), []);

  useEffect(() => {
    let active = true;
    fetchOpenSourceSessionState().then((st) => {
      if (active) setOpenSourceOAuthReady(st.configured);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleClick = () => {
    if (isBusy) return;
    setAuthError(null);
    setIsBusy(true);

    // Invoke synchronously inside click event to preserve iOS/iPadOS/macOS Safari transient gesture
    signInWithGoogleResilient()
      .then((user) => {
        onSuccess?.(user);
      })
      .catch((err) => {
        const friendly = mapGoogleAuthError(err, env);
        if (friendly.code === 'auth/redirect-initiated') {
          return;
        }
        setAuthError(friendly);
        onError?.(friendly);
      })
      .finally(() => {
        setIsBusy(false);
      });
  };

  const handleRedirectFallback = () => {
    if (isBusy) return;
    setAuthError(null);
    setIsBusy(true);
    signInWithGoogleRedirectDirect()
      .catch((err) => {
        const friendly = mapGoogleAuthError(err, env);
        setAuthError(friendly);
        onError?.(friendly);
        setIsBusy(false);
      });
  };

  const handleCopyCurrentUrl = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      // ignore
    }
  };

  const buttonStyles =
    variant === 'amber'
      ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold shadow-lg shadow-amber-500/15'
      : variant === 'compact'
        ? 'bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs px-3.5 py-2 min-h-[42px]'
        : 'bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-sm px-6 py-3.5 min-h-[48px] shadow-xl';

  return (
    <div className={`${fullWidth ? 'w-full' : 'inline-flex flex-col items-center'} space-y-3`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className={`${fullWidth ? 'w-full justify-center' : 'inline-flex justify-center'} items-center gap-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 touch-manipulation select-none ${buttonStyles} ${className}`}
      >
        {isBusy ? (
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <GoogleGIcon className={variant === 'compact' ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0'} />
        )}
        <span>{isBusy ? loadingLabel : label}</span>
      </button>

      {/* Proactive guidance inside WhatsApp / Instagram / Facebook / TikTok built-in browsers */}
      {showDeviceNotice && env.isInAppBrowser && !authError && (
        <div className="w-full max-w-md text-left bg-amber-950/35 border border-amber-500/35 rounded-xl p-3 text-xs text-amber-100 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">
                Estás abriendo desde {env.inAppName || 'una app externa'}
              </p>
              <p className="text-[11px] text-amber-100/80 mt-0.5 leading-relaxed">
                Google bloquea el inicio de sesión en navegadores integrados. Abre este enlace en{' '}
                {env.isIOS ? 'Safari' : 'Chrome'} para acceder sin errores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCurrentUrl}
            className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enlace copiado · Pégalo en {env.isIOS ? 'Safari' : 'Chrome'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copiar enlace para {env.isIOS ? 'Safari' : 'Chrome'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Actionable error panel for blocked popups / Safari / PWA / unauthorized domains */}
      {authError && (
        <div
          role="alert"
          className="w-full max-w-md text-left bg-red-950/40 border border-red-500/35 rounded-xl p-3.5 text-xs text-red-100 space-y-2.5"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">{authError.message}</p>
              {authError.hint && (
                <p className="text-[11px] text-red-200/85 leading-relaxed">{authError.hint}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {authError.canRetryWithRedirect && !env.isInIframe && (
              <button
                type="button"
                onClick={handleRedirectFallback}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Continuar en esta pestaña</span>
              </button>
            )}

            {isSupabaseBackupConfigured() && !env.isInIframe && !env.isInAppBrowser && (
              <button
                type="button"
                onClick={() => {
                  setIsBusy(true);
                  signInWithSupabaseGoogleBackup().catch((sbErr) => {
                    setAuthError(mapGoogleAuthError(sbErr, env));
                    setIsBusy(false);
                  });
                }}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/35 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Usar respaldo Supabase</span>
              </button>
            )}

            {openSourceOAuthReady && !env.isInIframe && !env.isInAppBrowser && (
              <button
                type="button"
                onClick={() => {
                  setIsBusy(true);
                  startOpenSourceGoogleSignIn();
                }}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Acceso Open Source (Google)</span>
              </button>
            )}

            {(authError.requiresExternalBrowser || env.isInIframe) && (
              <button
                type="button"
                onClick={handleCopyCurrentUrl}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.12] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enlace copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
