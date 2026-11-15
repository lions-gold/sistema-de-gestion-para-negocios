import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export interface OpenSourceAuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
  provider: 'google_opensource';
  issuedAt: number;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = 'smith_os_session';
const OAUTH_STATE_COOKIE_NAME = 'smith_os_oauth_tx';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const OAUTH_TX_TTL_SECONDS = 60 * 10; // 10 minutes

function getAuthSecret(): string {
  return (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '').trim();
}

function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    ''
  ).trim();
  return { clientId, clientSecret };
}

export function isOpenSourceOAuthConfigured(): boolean {
  const secret = getAuthSecret();
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  return Boolean(secret.length >= 16 && clientId && clientSecret);
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payloadObj: object, secret: string): string {
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedToken<T>(token: string, secret: string): T | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return JSON.parse(base64UrlDecode(payload)) as T;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function resolveRequestOrigin(req: IncomingMessage): string {
  const explicitAuthUrl = (process.env.AUTH_URL || '').trim().replace(/\/+$/, '');
  const forwardedHost =
    (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
    req.headers.host ||
    '';
  const forwardedProto =
    (typeof req.headers['x-forwarded-proto'] === 'string' && req.headers['x-forwarded-proto']) ||
    (forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1') ? 'http' : 'https');

  if (forwardedHost) {
    return `${forwardedProto.split(',')[0].trim()}://${forwardedHost.split(',')[0].trim()}`;
  }
  if (explicitAuthUrl) return explicitAuthUrl;
  return 'http://localhost:3000';
}

function isSecureCookieRequest(req: IncomingMessage): boolean {
  const origin = resolveRequestOrigin(req);
  return origin.startsWith('https://');
}

function buildCookieString(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite || 'Lax'}`,
  ];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res: ServerResponse, cookieValue: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieValue]);
  }
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function deriveDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(`smith-tenant:${seed}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function syncOpenSourceTenantToSupabaseIfConfigured(user: OpenSourceAuthUser): Promise<void> {
  const sbUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!sbUrl || !serviceRoleKey) return;

  try {
    await fetch(`${sbUrl}/rest/v1/synced_users?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email: user.email.toLowerCase(),
        display_name: user.name.slice(0, 140),
        photo_url: user.picture.slice(0, 400),
        email_verified: user.emailVerified,
        primary_provider: 'google_opensource',
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    await fetch(`${sbUrl}/rest/v1/tenants?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: user.tenantId,
        owner_email: user.email.toLowerCase(),
        store_name: `Tienda de ${user.name || user.email.split('@')[0]}`,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Non-blocking optional Postgres sync
  }
}

interface OAuthTxPayload {
  state: string;
  codeVerifier: string;
  returnTo: string;
  exp: number;
}

export function handleOpenSourceGoogleStart(req: IncomingMessage, res: ServerResponse): void {
  const origin = resolveRequestOrigin(req);
  if (!isOpenSourceOAuthConfigured()) {
    sendRedirect(
      res,
      `${origin}/?auth_error=${encodeURIComponent(
        'Faltan variables AUTH_SECRET, GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el servidor.'
      )}`
    );
    return;
  }

  const secret = getAuthSecret();
  const { clientId } = getGoogleOAuthCredentials();
  const reqUrl = new URL(req.url || '/api/auth/google', origin);
  const rawReturnTo = reqUrl.searchParams.get('returnTo') || '/';
  const safeReturnTo =
    rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';

  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const txToken = signPayload(
    {
      state,
      codeVerifier,
      returnTo: safeReturnTo,
      exp: Math.floor(Date.now() / 1000) + OAUTH_TX_TTL_SECONDS,
    } satisfies OAuthTxPayload,
    secret
  );

  const secure = isSecureCookieRequest(req);
  appendSetCookie(
    res,
    buildCookieString(OAUTH_STATE_COOKIE_NAME, txToken, {
      maxAge: OAUTH_TX_TTL_SECONDS,
      secure,
      httpOnly: true,
      sameSite: 'Lax',
    })
  );

  const redirectUri = `${origin}/api/auth/callback/google`;
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
  googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  sendRedirect(res, googleAuthUrl.toString());
}

export async function handleOpenSourceGoogleCallback(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const origin = resolveRequestOrigin(req);
  const secure = isSecureCookieRequest(req);
  const clearTxCookie = () =>
    appendSetCookie(
      res,
      buildCookieString(OAUTH_STATE_COOKIE_NAME, '', {
        maxAge: 0,
        secure,
        httpOnly: true,
        sameSite: 'Lax',
      })
    );

  if (!isOpenSourceOAuthConfigured()) {
    clearTxCookie();
    sendRedirect(
      res,
      `${origin}/?auth_error=${encodeURIComponent('Servidor OAuth Open Source no configurado.')}`
    );
    return;
  }

  const secret = getAuthSecret();
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  const reqUrl = new URL(req.url || '/api/auth/callback/google', origin);
  const oauthError = reqUrl.searchParams.get('error');
  const code = reqUrl.searchParams.get('code') || '';
  const state = reqUrl.searchParams.get('state') || '';

  if (oauthError || !code || !state) {
    clearTxCookie();
    sendRedirect(
      res,
      `${origin}/?auth_error=${encodeURIComponent(
        oauthError ? `Acceso cancelado o rechazado por Google (${oauthError}).` : 'Parámetros OAuth inválidos.'
      )}`
    );
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const txCookie = cookies[OAUTH_STATE_COOKIE_NAME];
  const tx = verifySignedToken<OAuthTxPayload>(txCookie || '', secret);
  clearTxCookie();

  if (
    !tx ||
    tx.state !== state ||
    tx.exp < Math.floor(Date.now() / 1000)
  ) {
    sendRedirect(
      res,
      `${origin}/?auth_error=${encodeURIComponent('La sesión de verificación OAuth expiró. Intenta nuevamente.')}`
    );
    return;
  }

  try {
    const redirectUri = `${origin}/api/auth/callback/google`;
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: tx.codeVerifier,
      }).toString(),
    });

    if (!tokenResp.ok) {
      sendRedirect(
        res,
        `${origin}/?auth_error=${encodeURIComponent('No se pudo validar el código de autorización con Google.')}`
      );
      return;
    }

    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      sendRedirect(
        res,
        `${origin}/?auth_error=${encodeURIComponent('Google no devolvió un token de acceso válido.')}`
      );
      return;
    }

    const userInfoResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResp.ok) {
      sendRedirect(
        res,
        `${origin}/?auth_error=${encodeURIComponent('No se pudo obtener el perfil verificado de Google.')}`
      );
      return;
    }

    const profile = (await userInfoResp.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email || !profile.email_verified) {
      sendRedirect(
        res,
        `${origin}/?auth_error=${encodeURIComponent('La cuenta de Google requiere correo verificado.')}`
      );
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const sessionUser: OpenSourceAuthUser = {
      id: deriveDeterministicUuid(`user:${profile.email.toLowerCase()}`),
      tenantId: deriveDeterministicUuid(`tenant:${profile.email.toLowerCase()}`),
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture || '',
      emailVerified: true,
      provider: 'google_opensource',
      issuedAt: nowSec,
      expiresAt: nowSec + SESSION_TTL_SECONDS,
    };

    const sessionToken = signPayload(sessionUser, secret);
    appendSetCookie(
      res,
      buildCookieString(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: SESSION_TTL_SECONDS,
        secure,
        httpOnly: true,
        sameSite: 'Lax',
      })
    );

    await syncOpenSourceTenantToSupabaseIfConfigured(sessionUser);

    const safeReturnTo =
      tx.returnTo && tx.returnTo.startsWith('/') && !tx.returnTo.startsWith('//')
        ? tx.returnTo
        : '/';
    sendRedirect(res, `${origin}${safeReturnTo}`);
  } catch {
    sendRedirect(
      res,
      `${origin}/?auth_error=${encodeURIComponent('Error de red al completar el inicio de sesión Open Source.')}`
    );
  }
}

export function readOpenSourceSession(req: IncomingMessage): OpenSourceAuthUser | null {
  const secret = getAuthSecret();
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const parsed = verifySignedToken<OpenSourceAuthUser>(token, secret);
  if (!parsed || parsed.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return parsed;
}

export function handleOpenSourceSession(req: IncomingMessage, res: ServerResponse): void {
  const configured = isOpenSourceOAuthConfigured();
  const user = readOpenSourceSession(req);
  sendJson(res, 200, {
    ok: true,
    configured,
    authenticated: Boolean(user),
    user,
  });
}

export function handleOpenSourceLogout(req: IncomingMessage, res: ServerResponse): void {
  const secure = isSecureCookieRequest(req);
  appendSetCookie(
    res,
    buildCookieString(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      secure,
      httpOnly: true,
      sameSite: 'Lax',
    })
  );
  sendJson(res, 200, { ok: true, authenticated: false });
}
