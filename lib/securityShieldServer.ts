import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const EPHEMERAL_HMAC_SECRET = crypto.randomBytes(32);

function getHmacKey(): Buffer {
  const configured = process.env.ANTIBOT_HMAC_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return crypto.createHash('sha256').update(configured).digest();
  }
  return EPHEMERAL_HMAC_SECRET;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown').trim();
}

// Known legitimate search engine crawlers & social preview bots (MUST NEVER block SEO/Social previews)
const ALLOWED_GOOD_BOTS_REGEX =
  /(googlebot|google-inspectiontool|adsbot-google|mediapartners-google|bingbot|duckduckbot|applebot|slurp|yandexbot|whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterestbot|petalbot|lighthouse|chrome-lighthouse)/i;

// Known vulnerability scanners, offensive recon tools, and abusive scraper bots
const MALICIOUS_SCANNER_UA_REGEX =
  /(sqlmap|nikto|nessus|masscan|zgrab|nmap|nuclei|acunetix|netsparker|appscan|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|wpscan|joomscan|burp|hydra|medusa|havij|w3af|arachni|vega|skipfish|whatweb|massdns|subfinder|amass|shodan|censys|internetmeasurement|paloalto|expanse|mj12bot|ahrefsbot|semrushbot|dotbot|blexbot|bytespider|ccbot|gptbot|claudebot|anthropic-ai|omgilibot)/i;

// Common automated scripting UAs disallowed from abusing unauthenticated API mutations
const SCRIPTING_UA_REGEX =
  /^(python-requests|python-urllib|aiohttp|scrapy|mechanize|libwww-perl|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|postmanruntime|insomnia|headlesschrome|phantomjs)/i;

// Internet scanner recon probe paths
const SCAN_PROBE_PATH_PATTERNS: RegExp[] = [
  /\/\.env(\.|$)/i,
  /\/\.git(\/|$)/i,
  /\/\.svn(\/|$)/i,
  /\/\.hg(\/|$)/i,
  /\/\.aws(\/|$)/i,
  /\/\.docker(\/|$)/i,
  /\/\.well-known\/(?!apple-app-site-association|assetlinks\.json|acme-challenge|security\.txt)/i,
  /\/(wp-login\.php|wp-admin|wp-content|wp-includes|xmlrpc\.php)/i,
  /\/(phpmyadmin|pma|myadmin|adminer|dbadmin|mysql|sqlmanager)/i,
  /\/(cgi-bin|boaform|solr|struts|hudson|jenkins|manager\/html)/i,
  /\/actuator(\/|$)/i,
  /\/server-(status|info)/i,
  /\/vendor\/phpunit/i,
  /\/eval-stdin\.php/i,
  /\/shell\.php|\/cmd\.php|\/c99\.php|\/r57\.php/i,
  /\/(backup|db|database|dump|site)\.(sql|zip|tar|gz|bak)$/i,
  /\/\.ds_store$/i,
  /\/etc\/passwd/i,
];

// Injection / traversal fuzz payloads in raw URL / query strings
const MALICIOUS_QUERY_PATTERNS: RegExp[] = [
  /\.\.[\\/]/,
  /%2e%2e[%2f%5c]/i,
  /\0|%00/i,
  /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b.*\binformation_schema\b)/i,
  /(<script\b|javascript:|onerror\s*=|onload\s*=)/i,
  /\$\{jndi:(ldap|rmi|dns|iiop):/i,
];

interface RateBucket {
  timestamps: number[];
}

interface ScannerStrikeRecord {
  strikes: number;
  blockedUntil: number;
  lastSeen: number;
}

const rateBuckets = new Map<string, RateBucket>();
const scannerStrikes = new Map<string, ScannerStrikeRecord>();
const usedChallengeNonces = new Map<string, number>();

const PENALTY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes temporary jail for active scanners
const MAX_SCANNER_STRIKES = 4;

// Periodic memory cleanup so long-running servers don't leak bucket entries
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of scannerStrikes.entries()) {
    if (now - rec.lastSeen > 30 * 60 * 1000 && rec.blockedUntil < now) {
      scannerStrikes.delete(key);
    }
  }
  for (const [key, bucket] of rateBuckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 120 * 1000);
    if (bucket.timestamps.length === 0) {
      rateBuckets.delete(key);
    }
  }
  for (const [nonce, exp] of usedChallengeNonces.entries()) {
    if (exp < now) {
      usedChallengeNonces.delete(nonce);
    }
  }
}, 5 * 60 * 1000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

function recordScannerStrike(ip: string): boolean {
  const now = Date.now();
  const prev = scannerStrikes.get(ip) || { strikes: 0, blockedUntil: 0, lastSeen: now };
  const nextStrikes = now - prev.lastSeen > PENALTY_WINDOW_MS ? 1 : prev.strikes + 1;
  const blockedUntil =
    nextStrikes >= MAX_SCANNER_STRIKES ? now + PENALTY_WINDOW_MS : prev.blockedUntil;
  scannerStrikes.set(ip, {
    strikes: nextStrikes,
    blockedUntil,
    lastSeen: now,
  });
  return blockedUntil > now;
}

function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateBuckets.get(bucketKey) || { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((ts) => now - ts < windowMs);

  if (existing.timestamps.length >= limit) {
    const oldest = existing.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(bucketKey, existing);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  existing.timestamps.push(now);
  rateBuckets.set(bucketKey, existing);
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.timestamps.length),
    retryAfterSec: 0,
  };
}

function safeDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

export function applyAntiScanAndBotShield(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const reqPath = req.path || '/';
  const rawUrl = req.originalUrl || req.url || '/';
  const decodedUrl = safeDecode(rawUrl);
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || '').trim();

  // Hardened HTTP Security & Privacy headers on every response
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), payment=(), usb=(), camera=(self)'
  );
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  // Keep API & Admin console completely hidden from search indexers
  if (
    reqPath.startsWith('/api/') ||
    reqPath === '/admin' ||
    reqPath.startsWith('/admin/') ||
    reqPath === '/superadmin'
  ) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  // 1. Check active temporary jail for repeat internet scanners
  const strikeRec = scannerStrikes.get(ip);
  if (strikeRec && strikeRec.blockedUntil > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((strikeRec.blockedUntil - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      ok: false,
      error: 'Demasiadas solicitudes sospechosas. Acceso temporalmente restringido.',
    });
    return;
  }

  // 2. Allow legitimate Search Engine & Social Preview Bots cleanly after checking path hygiene
  const isGoodBot = ALLOWED_GOOD_BOTS_REGEX.test(ua);

  // 3. Block vulnerability / internet recon scanner probes & URL traversal/injection attempts
  const isProbePath = SCAN_PROBE_PATH_PATTERNS.some((re) => re.test(reqPath));
  const isInjectionQuery = MALICIOUS_QUERY_PATTERNS.some(
    (re) => re.test(rawUrl) || re.test(decodedUrl)
  );
  if (isProbePath || isInjectionQuery) {
    const jailed = recordScannerStrike(ip);
    if (jailed) {
      res.setHeader('Retry-After', String(Math.ceil(PENALTY_WINDOW_MS / 1000)));
    }
    res.status(403).type('text/plain').send('Forbidden');
    return;
  }

  // 4. Block known offensive scanners & aggressive scrapers
  if (!isGoodBot && ua && MALICIOUS_SCANNER_UA_REGEX.test(ua)) {
    recordScannerStrike(ip);
    res.status(403).type('text/plain').send('Forbidden');
    return;
  }

  // 5. Block automated scripting tools / empty UAs from hitting state-changing API routes
  const isApiMutation =
    reqPath.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

  if (isApiMutation) {
    const hasAuth = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
    const hasBrowserOrigin = Boolean(req.headers.origin || req.headers.referer);
    if (!ua || (SCRIPTING_UA_REGEX.test(ua) && !hasAuth && !hasBrowserOrigin)) {
      recordScannerStrike(ip);
      res.status(403).json({
        ok: false,
        error: 'Solicitud automatizada bloqueada por protección anti-bot.',
      });
      return;
    }

    // Check optional anti-bot honeypot fields inside JSON body if provided by automated bots
    const body = req.body as Record<string, unknown> | undefined;
    if (
      body &&
      typeof body === 'object' &&
      ((typeof body._hp_field === 'string' && body._hp_field.trim().length > 0) ||
        (typeof body.companyWebsite === 'string' && body.companyWebsite.trim().length > 0))
    ) {
      recordScannerStrike(ip);
      res.status(403).json({
        ok: false,
        error: 'Actividad automatizada detectada.',
      });
      return;
    }
  }

  // 6. Sliding-Window Rate Limiting on API routes
  if (reqPath.startsWith('/api/')) {
    let bucketGroup = 'api_general';
    let limit = 120;
    const windowMs = 60 * 1000;

    if (
      reqPath.startsWith('/api/stores/send-email') ||
      reqPath.startsWith('/api/stores/verify-smtp') ||
      reqPath.startsWith('/api/admin/send-email')
    ) {
      bucketGroup = 'api_email';
      limit = 20;
    } else if (
      reqPath.startsWith('/api/vector/') ||
      reqPath.startsWith('/api/payment-proof/')
    ) {
      bucketGroup = 'api_ai_notify';
      limit = 40;
    } else if (reqPath.startsWith('/api/security/')) {
      bucketGroup = 'api_security';
      limit = 30;
    }

    const rate = checkRateLimit(`${bucketGroup}:${ip}`, limit, windowMs);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: 'Límite de solicitudes excedido. Intenta de nuevo en unos segundos.',
        retryAfterSeconds: rate.retryAfterSec,
      });
      return;
    }
  }

  next();
}

export interface AntiBotChallengePayload {
  token: string;
  question: string;
  expiresAt: number;
}

export function issueAntiBotChallenge(): AntiBotChallengePayload {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a + b;
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 10 * 60 * 1000;

  const dataStr = `${nonce}.${answer}.${issuedAt}.${expiresAt}`;
  const sig = crypto
    .createHmac('sha256', getHmacKey())
    .update(dataStr)
    .digest('base64url');

  const payloadEncoded = Buffer.from(dataStr, 'utf8').toString('base64url');
  return {
    token: `${payloadEncoded}.${sig}`,
    question: `${a} + ${b}`,
    expiresAt,
  };
}

export function verifyAntiBotChallenge(
  token: string,
  submittedAnswer: string | number
): { valid: boolean; reason?: string } {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'Token de verificación inválido.' };
  }
  const [payloadEncoded, sig] = token.split('.');
  if (!payloadEncoded || !sig) {
    return { valid: false, reason: 'Formato de verificación inválido.' };
  }

  let dataStr = '';
  try {
    dataStr = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'Token ilegible.' };
  }

  const expectedSig = crypto
    .createHmac('sha256', getHmacKey())
    .update(dataStr)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'Firma de seguridad inválida.' };
  }

  const parts = dataStr.split('.');
  if (parts.length !== 4) {
    return { valid: false, reason: 'Estructura de reto inválida.' };
  }

  const [nonce, expectedAnswerStr, , expiresAtStr] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, reason: 'El reto de seguridad expiró. Genera uno nuevo.' };
  }

  if (usedChallengeNonces.has(nonce)) {
    return { valid: false, reason: 'Este reto ya fue utilizado.' };
  }

  const numericSubmitted = Number(String(submittedAnswer).trim());
  if (!Number.isFinite(numericSubmitted) || numericSubmitted !== Number(expectedAnswerStr)) {
    return { valid: false, reason: 'Respuesta de verificación humana incorrecta.' };
  }

  usedChallengeNonces.set(nonce, expiresAt);
  return { valid: true };
}
