import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { User as FirebaseUser } from 'firebase/auth';

export interface SupabaseBackupSession {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  accessToken: string;
  provider: 'supabase_backup';
}

const SUPABASE_STORAGE_KEY = 'smith_supabase_auth_v1';
const BACKUP_MIRROR_DONE_PREFIX = 'smith_sb_synced_uid:';

function getSupabaseEnv(): { url: string; anonKey: string } {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  const url = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
}

export function isSupabaseBackupConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return false;
  return (
    url.startsWith('https://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1')
  );
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (!isSupabaseBackupConfigured()) return null;
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseEnv();
  cachedClient = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: SUPABASE_STORAGE_KEY,
    },
  });
  return cachedClient;
}

function mapSupabaseSession(session: Session | null): SupabaseBackupSession | null {
  if (!session?.user) return null;
  const user = session.user;
  const email = user.email || '';
  if (!email) return null;

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    email.split('@')[0];
  const photoURL =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    '';
  const emailVerified = Boolean(user.email_confirmed_at || meta.email_verified === true);

  return {
    uid: user.id,
    email,
    displayName,
    photoURL,
    emailVerified,
    accessToken: session.access_token,
    provider: 'supabase_backup',
  };
}

function buildSafeOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '/';
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  const rawBase = env.BASE_URL || '/';
  const normalizedBase = rawBase === './' ? '/' : rawBase;
  return new URL(normalizedBase, window.location.origin).toString();
}

export async function signInWithSupabaseGoogleBackup(): Promise<void> {
  const client = getSupabaseAuthClient();
  if (!client) {
    throw new Error(
      'El respaldo de Supabase autohospedado aún no está configurado en las variables de entorno.'
    );
  }

  const redirectTo = buildSafeOAuthRedirectUrl();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'No se pudo iniciar sesión con Supabase.');
  }
}

export async function resolveSupabaseSessionOnMount(): Promise<SupabaseBackupSession | null> {
  const client = getSupabaseAuthClient();
  if (!client) return null;

  try {
    // Only exchange ?code=... if PKCE code verifier is actually stored by Supabase
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hasVerifier = Boolean(localStorage.getItem(`${SUPABASE_STORAGE_KEY}-code-verifier`));
      if (code && hasVerifier) {
        const { data } = await client.auth.exchangeCodeForSession(code);
        params.delete('code');
        params.delete('state');
        const cleanedQuery = params.toString();
        const cleanedUrl =
          window.location.pathname +
          (cleanedQuery ? `?${cleanedQuery}` : '') +
          window.location.hash;
        window.history.replaceState(null, '', cleanedUrl);
        return mapSupabaseSession(data.session);
      }
    }

    const { data } = await client.auth.getSession();
    return mapSupabaseSession(data.session);
  } catch {
    return null;
  }
}

export async function getSupabaseBackupAccessToken(): Promise<string | null> {
  const client = getSupabaseAuthClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function signOutSupabaseBackup(): Promise<void> {
  const client = getSupabaseAuthClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // non-fatal
  }
}

/**
 * Mirrors verified Firebase users to the self-hosted Supabase synced_users table
 * via server endpoint (/api/auth/sync-backup) so SERVICE_ROLE_KEY never touches client code.
 */
export async function mirrorFirebaseUserToBackupServer(user: FirebaseUser | null): Promise<void> {
  if (!user || !user.emailVerified || !user.email) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    if (typeof sessionStorage !== 'undefined') {
      const doneKey = `${BACKUP_MIRROR_DONE_PREFIX}${user.uid}`;
      if (sessionStorage.getItem(doneKey)) return;
      sessionStorage.setItem(doneKey, '1');
    }

    const idToken = await user.getIdToken();
    await fetch('/api/auth/sync-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
      }),
    });
  } catch {
    // Non-blocking background mirror
  }
}
