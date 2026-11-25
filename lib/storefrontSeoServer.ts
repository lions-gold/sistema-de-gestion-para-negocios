import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseServerCfg {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
}

let cachedFirebaseCfg: FirebaseServerCfg | null = null;

function getFirebaseServerCfg(): FirebaseServerCfg {
  if (cachedFirebaseCfg) return cachedFirebaseCfg;
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    cachedFirebaseCfg = JSON.parse(raw) as FirebaseServerCfg;
  } catch {
    cachedFirebaseCfg = {};
  }
  return cachedFirebaseCfg;
}

export interface ResolvedPublicStore {
  id: string;
  slug: string;
  storeName: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  status: string;
}

interface StoreCacheEntry {
  store: ResolvedPublicStore | null;
  expiresAt: number;
}

const storeResolveCache = new Map<string, StoreCacheEntry>();
let activeStoreListCache: { stores: ResolvedPublicStore[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function normalizeSlugServer(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function isSharedHostingOrLocalHostServer(hostname: string): boolean {
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

const RESERVED_PATHS = new Set([
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

export function extractStoreSlugFromRequest(
  pathname: string,
  query: Record<string, unknown>,
  hostname: string
): string | null {
  const queryCandidate =
    typeof query?.tienda === 'string'
      ? query.tienda
      : typeof query?.store === 'string'
        ? query.store
        : '';
  if (queryCandidate) {
    const clean = normalizeSlugServer(queryCandidate.replace(/^@+/, ''));
    if (clean && clean.length >= 2 && !RESERVED_PATHS.has(clean)) {
      return clean;
    }
  }

  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  if (cleanPath.startsWith('/@')) {
    const seg = cleanPath.slice(2).trim();
    if (seg && !seg.includes('/')) {
      const clean = normalizeSlugServer(seg);
      if (clean && clean.length >= 2) return clean;
    }
  }

  if (cleanPath.startsWith('/tienda/')) {
    const seg = cleanPath.slice('/tienda/'.length).replace(/^@+/, '').trim();
    if (seg && !seg.includes('/')) {
      const clean = normalizeSlugServer(seg);
      if (clean && clean.length >= 2) return clean;
    }
  }

  if (cleanPath.startsWith('/s/')) {
    const seg = cleanPath.slice('/s/'.length).replace(/^@+/, '').trim();
    if (seg && !seg.includes('/')) {
      const clean = normalizeSlugServer(seg);
      if (clean && clean.length >= 2) return clean;
    }
  }

  // Wildcard custom domain subdomain (e.g. boutique.midominio.com)
  if (hostname && !isSharedHostingOrLocalHostServer(hostname) && cleanPath === '/') {
    const cleanHost = hostname.toLowerCase().split(':')[0];
    const parts = cleanHost.split('.').filter(Boolean);
    if (parts.length >= 3 && parts[0] !== 'www') {
      const clean = normalizeSlugServer(parts[0]);
      if (clean && clean.length >= 2 && !RESERVED_PATHS.has(clean)) {
        return clean;
      }
    }
  }

  return null;
}

function decodeFirestoreFields(fields?: Record<string, Record<string, unknown>>): ResolvedPublicStore | null {
  if (!fields) return null;
  const str = (key: string): string => {
    const v = fields[key]?.stringValue;
    return typeof v === 'string' ? v : '';
  };
  const status = str('status');
  const slug = str('slug');
  const storeName = str('storeName');
  if (!slug || !storeName || status !== 'active') return null;
  return {
    id: str('id') || slug,
    slug,
    storeName,
    category: str('category') || undefined,
    description: str('description') || undefined,
    logoUrl: str('logoUrl') || undefined,
    status,
  };
}

export async function resolveActiveStoreServer(
  slugOrId: string
): Promise<ResolvedPublicStore | null> {
  const clean = normalizeSlugServer((slugOrId || '').replace(/^@+/, ''));
  if (!clean) return null;

  const cached = storeResolveCache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.store;
  }

  const { projectId, firestoreDatabaseId, apiKey } = getFirebaseServerCfg();
  if (!projectId) return null;
  const dbId = firestoreDatabaseId || '(default)';

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents:runQuery${
      apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''
    }`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'stores' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'active' },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'slug' },
                    op: 'EQUAL',
                    value: { stringValue: clean },
                  },
                },
              ],
            },
          },
          limit: 1,
        },
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!resp.ok) {
      return null;
    }

    const rows = (await resp.json()) as Array<{
      document?: { name?: string; fields?: Record<string, Record<string, unknown>> };
    }>;

    const docItem = rows.find((r) => r.document?.fields);
    const parsed = decodeFirestoreFields(docItem?.document?.fields);
    storeResolveCache.set(clean, {
      store: parsed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return parsed;
  } catch {
    return null;
  }
}

export async function listActiveStoresForSitemap(): Promise<ResolvedPublicStore[]> {
  if (activeStoreListCache && activeStoreListCache.expiresAt > Date.now()) {
    return activeStoreListCache.stores;
  }

  const { projectId, firestoreDatabaseId, apiKey } = getFirebaseServerCfg();
  if (!projectId) return [];
  const dbId = firestoreDatabaseId || '(default)';

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents:runQuery${
      apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''
    }`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'stores' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'active' },
            },
          },
          limit: 100,
        },
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!resp.ok) return [];

    const rows = (await resp.json()) as Array<{
      document?: { fields?: Record<string, Record<string, unknown>> };
    }>;

    const list: ResolvedPublicStore[] = [];
    for (const r of rows) {
      const store = decodeFirestoreFields(r.document?.fields);
      if (store) {
        list.push(store);
        storeResolveCache.set(normalizeSlugServer(store.slug), {
          store,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
    }

    activeStoreListCache = {
      stores: list,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return list;
  } catch {
    return [];
  }
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function injectStorefrontSeoIntoHtml(
  html: string,
  store: ResolvedPublicStore,
  baseOrigin: string
): string {
  const cleanSlug = normalizeSlugServer(store.slug) || store.id;
  const canonicalUrl = `${baseOrigin}/@${cleanSlug}`;
  const title = `${store.storeName} (@${cleanSlug}) · Tienda Oficial | Smith Solutions`;
  const desc = store.description?.trim()
    ? `${store.description.trim()} — ${store.category || 'Tienda Verificada'}. Compra con Binance Pay QR, Bybit QR y Pago Móvil.`
    : `Visita ${store.storeName} (@${cleanSlug}) en Smith Solutions E-Commerce. Catálogo oficial con Binance Pay QR, Bybit QR, Pago Móvil y entrega rápida.`;
  const image =
    store.logoUrl && /^https?:\/\//i.test(store.logoUrl)
      ? store.logoUrl
      : `${baseOrigin}/pwa-512x512.png`;

  const eTitle = escapeHtmlAttr(title);
  const eDesc = escapeHtmlAttr(desc);
  const eUrl = escapeHtmlAttr(canonicalUrl);
  const eImg = escapeHtmlAttr(image);

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${eTitle}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${eDesc}" />`
  );
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${eTitle}" />`
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${eDesc}" />`
  );
  out = out.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${eUrl}" />`
  );
  out = out.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${eImg}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${eTitle}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${eDesc}" />`
  );
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${eUrl}" />`
  );
  return out;
}
