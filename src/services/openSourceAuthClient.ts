export interface OpenSourceSessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
  provider: 'google_opensource';
}

export interface OpenSourceSessionState {
  configured: boolean;
  authenticated: boolean;
  user: OpenSourceSessionUser | null;
}

let cachedStatus: OpenSourceSessionState | null = null;

export async function fetchOpenSourceSessionState(
  forceRefresh = false
): Promise<OpenSourceSessionState> {
  if (typeof window === 'undefined') {
    return { configured: false, authenticated: false, user: null };
  }
  if (cachedStatus && !forceRefresh) {
    return cachedStatus;
  }

  try {
    const resp = await fetch(`${window.location.origin}/api/auth/session`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      return { configured: false, authenticated: false, user: null };
    }
    const data = (await resp.json()) as {
      configured?: boolean;
      authenticated?: boolean;
      user?: OpenSourceSessionUser | null;
    };
    cachedStatus = {
      configured: Boolean(data.configured),
      authenticated: Boolean(data.authenticated && data.user),
      user: data.user || null,
    };
    return cachedStatus;
  } catch {
    return { configured: false, authenticated: false, user: null };
  }
}

export function startOpenSourceGoogleSignIn(): void {
  if (typeof window === 'undefined') return;
  const returnTo = `${window.location.pathname}${window.location.search}` || '/';
  const target = new URL('/api/auth/google', window.location.origin);
  target.searchParams.set('returnTo', returnTo);
  window.location.assign(target.toString());
}

export async function signOutOpenSourceSession(): Promise<void> {
  cachedStatus = null;
  if (typeof window === 'undefined') return;
  try {
    await fetch(`${window.location.origin}/api/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // non-fatal
  }
}

export function consumeOpenSourceAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const err = url.searchParams.get('auth_error');
    if (!err) return null;
    url.searchParams.delete('auth_error');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    return err;
  } catch {
    return null;
  }
}
