import fs from 'fs';
import path from 'path';
import firebaseConfig from '../firebase-applet-config.json';

function getFirebaseApiKey(): string {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;
  if (firebaseConfig && typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey) {
    return firebaseConfig.apiKey;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey || '';
  } catch {
    return '';
  }
}

function getSupabaseServerConfig(): { url: string; serviceRoleKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, serviceRoleKey };
}

export interface VerifiedBearerResult {
  ok: boolean;
  provider?: 'firebase' | 'supabase_backup';
  uid?: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Verifies a Bearer token primarily via Firebase Identity Toolkit, with automatic
 * fallback to self-hosted Supabase GoTrue (/auth/v1/user) if configured on server.
 */
export async function verifyUnifiedBearerToken(
  authHeader?: string
): Promise<VerifiedBearerResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return { ok: false };

  // 1. Primary: Firebase Identity Toolkit lookup
  const firebaseApiKey = getFirebaseApiKey();
  if (firebaseApiKey) {
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
        };
        const user = data.users?.[0];
        if (user && user.emailVerified === true && user.email) {
          return {
            ok: true,
            provider: 'firebase',
            uid: user.localId,
            email: user.email,
            emailVerified: true,
          };
        }
      }
    } catch {
      // fall through to backup check
    }
  }

  // 2. Failover: Self-hosted Supabase GoTrue token verification
  const { url } = getSupabaseServerConfig();
  const anonOrServiceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (url && anonOrServiceKey && (url.startsWith('https://') || url.startsWith('http://localhost'))) {
    try {
      const sbResp = await fetch(`${url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: anonOrServiceKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (sbResp.ok) {
        const sbUser = (await sbResp.json()) as {
          id?: string;
          email?: string;
          email_confirmed_at?: string | null;
          user_metadata?: { email_verified?: boolean };
        };
        const isVerified = Boolean(
          sbUser.email_confirmed_at || sbUser.user_metadata?.email_verified === true
        );
        if (sbUser.id && sbUser.email && isVerified) {
          return {
            ok: true,
            provider: 'supabase_backup',
            uid: sbUser.id,
            email: sbUser.email,
            emailVerified: true,
          };
        }
      }
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}

export interface AuthBackupSyncPayload {
  displayName?: string;
  photoURL?: string;
}

/**
 * Mirrors the verified Firebase user record into self-hosted Supabase Postgres (public.synced_users)
 * using the server-only SUPABASE_SERVICE_ROLE_KEY.
 */
export async function handleAuthBackupSync(
  authHeader: string | undefined,
  body: AuthBackupSyncPayload = {}
): Promise<{
  statusCode: number;
  body: { ok: boolean; synced?: boolean; skipped?: boolean; message: string };
}> {
  const verified = await verifyUnifiedBearerToken(authHeader);
  if (!verified.ok || !verified.email || !verified.uid) {
    return {
      statusCode: 403,
      body: {
        ok: false,
        message: 'Token no autorizado para sincronización de respaldo.',
      },
    };
  }

  const { url, serviceRoleKey } = getSupabaseServerConfig();
  if (!url || !serviceRoleKey) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        skipped: true,
        message: 'Respaldo Supabase servidor no configurado aún (sincronización omitida).',
      },
    };
  }

  try {
    const payload = {
      firebase_uid: verified.provider === 'firebase' ? verified.uid : null,
      supabase_user_id: verified.provider === 'supabase_backup' ? verified.uid : null,
      email: verified.email.toLowerCase(),
      display_name: String(body.displayName || '').slice(0, 140),
      photo_url: String(body.photoURL || '').slice(0, 400),
      email_verified: true,
      primary_provider: verified.provider || 'firebase',
      last_sign_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const resp = await fetch(`${url}/rest/v1/synced_users?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      return {
        statusCode: 502,
        body: {
          ok: false,
          message: `Error sincronizando respaldo Supabase (HTTP ${resp.status}).`,
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        synced: true,
        message: 'Usuario sincronizado en el respaldo Supabase.',
      },
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: {
        ok: false,
        message: err instanceof Error ? err.message : 'Error de red sincronizando respaldo.',
      },
    };
  }
}
