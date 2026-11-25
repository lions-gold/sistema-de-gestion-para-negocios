import { StoreSocialLinks } from '../types';

export type SocialPlatformKey = keyof StoreSocialLinks;

export interface SocialPlatformMeta {
  key: SocialPlatformKey;
  label: string;
  placeholder: string;
  handlePrefixUrl?: string;
  badgeText: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: '@tutienda o https://instagram.com/tutienda',
    handlePrefixUrl: 'https://instagram.com/',
    badgeText: 'IG',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: '@tutienda o https://tiktok.com/@tutienda',
    handlePrefixUrl: 'https://tiktok.com/@',
    badgeText: 'TT',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/tutienda',
    handlePrefixUrl: 'https://facebook.com/',
    badgeText: 'FB',
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    placeholder: '@tutienda o https://x.com/tutienda',
    handlePrefixUrl: 'https://x.com/',
    badgeText: 'X',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@tucanal o https://youtube.com/@tucanal',
    handlePrefixUrl: 'https://youtube.com/@',
    badgeText: 'YT',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    placeholder: '@tucanal o https://t.me/tucanal',
    handlePrefixUrl: 'https://t.me/',
    badgeText: 'TG',
  },
  {
    key: 'website',
    label: 'Sitio Web',
    placeholder: 'https://tutienda.com',
    badgeText: 'WEB',
  },
];

const RESERVED_SUBDOMAIN_SLUGS = new Set([
  'admin',
  'superadmin',
  'api',
  'app',
  'www',
  'mail',
  'ftp',
  'tiendas',
  'tienda',
  'mi-tienda',
  'almacen',
  'inventario',
  'pos',
  'punto-de-venta',
  'fiados',
  'cobranzas',
  'caja',
  'cierre',
  'fiscalidad',
  'rentabilidad',
  'kpis',
  'ventas',
  'inicio',
  'marketplace',
  'catalogo',
  'registro-tienda',
  'suscripcion',
  '404',
  'robots',
  'sitemap',
]);

export function normalizeStoreSubdomainSlug(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function isValidStoreSubdomainSlug(slug: string): {
  valid: boolean;
  reason?: 'length' | 'chars' | 'reserved';
} {
  const clean = (slug || '').trim();
  if (clean.length < 2 || clean.length > 60) {
    return { valid: false, reason: 'length' };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(clean)) {
    return { valid: false, reason: 'chars' };
  }
  if (RESERVED_SUBDOMAIN_SLUGS.has(clean)) {
    return { valid: false, reason: 'reserved' };
  }
  return { valid: true };
}

export function normalizeSocialUrl(
  platform: SocialPlatformKey,
  rawInput: string | undefined | null
): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  // Reject dangerous schemes immediately
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '';
  }

  let candidate = trimmed;
  const meta = SOCIAL_PLATFORMS.find((p) => p.key === platform);

  if (candidate.startsWith('@')) {
    const cleanHandle = candidate.replace(/^@+/, '').replace(/\s+/g, '');
    if (!cleanHandle) return '';
    if (meta?.handlePrefixUrl) {
      candidate = `${meta.handlePrefixUrl}${cleanHandle}`;
    } else {
      return '';
    }
  } else if (!/^https?:\/\//i.test(candidate)) {
    if (
      meta?.handlePrefixUrl &&
      !candidate.includes('.') &&
      !candidate.includes('/')
    ) {
      candidate = `${meta.handlePrefixUrl}${candidate.replace(/\s+/g, '')}`;
    } else {
      candidate = `https://${candidate.replace(/^\/+/, '')}`;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return '';
    }
    return parsed.toString().slice(0, 200);
  } catch {
    return '';
  }
}

export function isSafeHttpUrl(url: string | undefined | null): url is string {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeSocialLinksMap(
  raw?: Partial<Record<SocialPlatformKey, string>> | null
): StoreSocialLinks | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: StoreSocialLinks = {};
  let hasAny = false;
  for (const meta of SOCIAL_PLATFORMS) {
    const val = normalizeSocialUrl(meta.key, raw[meta.key]);
    if (val) {
      out[meta.key] = val;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

export function getSocialPlatformEntries(
  socialLinks?: StoreSocialLinks | null
): Array<{ meta: SocialPlatformMeta; url: string; displayHandle: string }> {
  if (!socialLinks) return [];
  const entries: Array<{ meta: SocialPlatformMeta; url: string; displayHandle: string }> = [];
  for (const meta of SOCIAL_PLATFORMS) {
    const url = socialLinks[meta.key];
    if (!isSafeHttpUrl(url)) continue;
    let displayHandle = meta.label;
    try {
      const parsed = new URL(url);
      const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, '');
      displayHandle = pathPart ? `${meta.label}: ${pathPart}` : parsed.hostname.replace(/^www\./, '');
    } catch {
      // keep default
    }
    entries.push({ meta, url, displayHandle });
  }
  return entries;
}

export function isSharedHostingOrLocalHost(hostname: string): boolean {
  const host = (hostname || '').toLowerCase().split(':')[0];
  return (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    host.endsWith('.run.app') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.github.io')
  );
}

export function getRootPlatformHost(hostname?: string): string {
  const rawHost =
    hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '') ||
    'smithsolutions.shop';
  const cleanHost = rawHost.toLowerCase().split(':')[0].replace(/^www\./, '');
  if (isSharedHostingOrLocalHost(cleanHost)) {
    return cleanHost || 'smithsolutions.shop';
  }
  const parts = cleanHost.split('.').filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(-2).join('.');
  }
  return cleanHost;
}

export function getStoreSubdomainDisplay(slug: string, hostname?: string): string {
  const cleanSlug = normalizeStoreSubdomainSlug(slug) || 'mi-tienda';
  const host = (
    hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '') ||
    'smithsolutions.shop'
  )
    .toLowerCase()
    .split(':')[0]
    .replace(/^www\./, '');
  if (isSharedHostingOrLocalHost(host)) {
    return `${host}/@${cleanSlug}`;
  }
  const root = getRootPlatformHost(host);
  return `${cleanSlug}.${root}`;
}

export interface StoreUrlBundle {
  slug: string;
  canonicalUrl: string;
  alternateUrl: string;
  queryUrl: string;
  subdomainDisplay: string;
  wildcardCustomPattern: string;
  isWildcardTlsSupported: boolean;
  isHttpsCertified: boolean;
}

export function getStoreUrlBundle(
  slug: string,
  customOrigin?: string
): StoreUrlBundle {
  const cleanSlug = normalizeStoreSubdomainSlug(slug) || 'mi-tienda';
  const origin = (
    customOrigin ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-hdtyonewfttsukmm6b3ynl-909389987801.us-east1.run.app')
  ).replace(/\/+$/, '');

  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    hostname = '';
  }

  const sharedHost = isSharedHostingOrLocalHost(hostname);
  const rootDomain = getRootPlatformHost(hostname);
  const canonicalUrl = `${origin}/@${cleanSlug}`;
  const pathAliasUrl = `${origin}/tienda/${cleanSlug}`;
  const queryUrl = `${origin}/?tienda=${cleanSlug}`;
  const wildcardCustomPattern = `${cleanSlug}.${rootDomain}`;
  const alternateUrl = sharedHost ? pathAliasUrl : `https://${wildcardCustomPattern}`;

  return {
    slug: cleanSlug,
    canonicalUrl,
    alternateUrl,
    queryUrl,
    subdomainDisplay: sharedHost ? `${hostname || rootDomain}/@${cleanSlug}` : wildcardCustomPattern,
    wildcardCustomPattern,
    isWildcardTlsSupported: !sharedHost,
    isHttpsCertified: origin.startsWith('https://') || !sharedHost,
  };
}

export function getStoreShareUrl(
  slug: string,
  mode: 'live_at' | 'live_tienda' | 'subdomain_preview' = 'live_at',
  customOrigin?: string
): string {
  const bundle = getStoreUrlBundle(slug, customOrigin);

  if (mode === 'subdomain_preview') {
    // Only emit https://slug.domain when wildcard DNS/SSL is supported;
    // on Cloud Run / shared hosts always emit a TLS-certified storefront URL.
    return bundle.alternateUrl;
  }

  if (mode === 'live_tienda') {
    return `${bundle.canonicalUrl.replace(`/@${bundle.slug}`, '')}/tienda/${bundle.slug}`;
  }

  return bundle.canonicalUrl;
}

export function buildSocialShareIntents(storeUrl: string, storeName: string) {
  const encodedUrl = encodeURIComponent(storeUrl);
  const msgEs = encodeURIComponent(`Explora el catálogo oficial de ${storeName} en línea: ${storeUrl}`);
  return {
    whatsapp: `https://wa.me/?text=${msgEs}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `Visita la tienda oficial ${storeName}`
    )}&url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(
      `Catálogo de ${storeName}`
    )}`,
  };
}

