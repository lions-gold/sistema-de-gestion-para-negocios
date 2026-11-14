// SEO, Dynamic Meta Tags & Google Analytics 4 / Search Console Tracking Utilities
// Smith Solutions E-Commerce (Material Assemble)

export type AppRouteKey =
  | 'landing'
  | 'inventory'
  | 'pos'
  | 'debtors'
  | 'cashier'
  | 'sales'
  | 'marketplace'
  | 'merchant'
  | 'admin'
  | 'not_found';

export interface RouteSEOConfig {
  path: string;
  title: string;
  description: string;
  keywords: string;
  robots?: string;
}

export const ROUTE_SEO_MAP: Record<AppRouteKey, RouteSEOConfig> = {
  landing: {
    path: '/',
    title: 'Smith Solutions E-Commerce | Plataforma Multi-SaaS, Almacenes y POS en Venezuela',
    description:
      'Plataforma Multi-SaaS Smith Solutions E-Commerce (Material Assemble): crea tu tienda online por $25/mes, gestiona inventarios, POS multidivisa BCV, facturas personalizadas y pedidos por WhatsApp.',
    keywords:
      'Smith Solutions E-Commerce, Multi-SaaS Venezuela, ecommerce Venezuela, punto de venta tasa BCV, control de inventario, Pago Móvil, Binance Pay, Bybit',
  },
  marketplace: {
    path: '/tiendas',
    title: 'Directorio de Tiendas & Catálogos Multi-SaaS | Smith Solutions E-Commerce',
    description:
      'Explora tiendas activas en Smith Solutions E-Commerce, compra con carrito independiente, envío nacional o delivery local, factura personalizada y pedido por WhatsApp.',
    keywords:
      'tiendas online Venezuela, catálogo digital WhatsApp, envío nacional Venezuela, delivery local, carrito ecommerce BCV',
  },
  merchant: {
    path: '/mi-tienda',
    title: 'Portal de Comercio SaaS ($25/mes) | Smith Solutions E-Commerce',
    description:
      'Registra tu tienda con nombre, RIF, logo y razón social, reporta suscripción mensual de $25 (Pago Móvil, Bancos VE, Binance Pay, Bybit), importa/exporta productos y gestiona envíos.',
    keywords:
      'crear tienda online Venezuela, suscripción SaaS $25, importar productos CSV JSON, envíos nacionales delivery local',
  },
  admin: {
    path: '/admin',
    title: 'Panel Super Admin Exclusivo | Smith Solutions E-Commerce',
    description:
      'Consola administrativa exclusiva para activación manual de cuentas SaaS, verificación de pagos ($25/mes) y configuración de cuentas receptoras.',
    keywords: 'admin SaaS, verificación suscripciones, gestión tenants Smith Solutions',
    robots: 'noindex, nofollow',
  },
  inventory: {
    path: '/almacen',
    title: 'Almacén, Auditoría y Trazabilidad | Smith Solutions E-Commerce',
    description:
      'Controla tu inventario en tiempo real con alertas de stock mínimo por correo, auditoría de mermas, trazabilidad de lotes y órdenes de reposición por WhatsApp.',
    keywords:
      'gestión de almacén, control de stock mínimo, auditoría de mermas, trazabilidad inventario, reposición automática, Smith Solutions E-Commerce',
  },
  pos: {
    path: '/pos',
    title: 'Punto de Venta Multidivisa (POS) | Smith Solutions E-Commerce',
    description:
      'Factura en Dólares y Bolívares al instante con tasa BCV, cálculo automático de IVA e IGTF (3%), lector de código de barras e impresión térmica y fiscal.',
    keywords:
      'punto de venta Venezuela, POS multidivisa, cálculo IGTF 3%, impresora fiscal SENIAT, facturación BCV, lector código de barras',
  },
  debtors: {
    path: '/fiados',
    title: 'Libreta de Fiados y Cobranzas WhatsApp | Smith Solutions E-Commerce',
    description:
      'Administra cuentas por cobrar en divisas, registra abonos parciales y envía recordatorios de saldo en Bolívares y Dólares con un clic por WhatsApp.',
    keywords:
      'libreta de fiados digital, cuentas por cobrar USD, cobranza WhatsApp Venezuela, control de crédito clientes',
  },
  cashier: {
    path: '/caja',
    title: 'Cierre de Caja Dual e Impresoras Fiscales | Smith Solutions E-Commerce',
    description:
      'Realiza cierres de caja duales desglosados por Efectivo $, Efectivo Bs, Pago Móvil, Zelle y Punto de Venta. Exporta Libros de Compra y Venta SENIAT.',
    keywords:
      'cierre de caja dual Venezuela, libros de compra y venta IVA, impresora fiscal The Factory HKA, reporte Z SENIAT, declaración IGTF',
  },
  sales: {
    path: '/rentabilidad',
    title: 'Rentabilidad Neta y KPIs de Ventas | Smith Solutions E-Commerce',
    description:
      'Calcula tu ganancia neta diaria deduciendo costos de reposición y mermas. Analiza productos más vendidos, horas pico y rendimiento del equipo de ventas.',
    keywords:
      'rentabilidad neta comercio, KPIs de ventas, productos más vendidos, horas pico bodegón, desempeño cajeros',
  },
  not_found: {
    path: '/404',
    title: 'Error 404 · Página No Encontrada | Smith Solutions E-Commerce',
    description:
      'La ruta solicitada no existe en Smith Solutions E-Commerce. Regresa al catálogo principal o accede al Punto de Venta y Almacén.',
    keywords: 'error 404, página no encontrada, Smith Solutions E-Commerce',
    robots: 'noindex, follow',
  },
};

export const GA_MEASUREMENT_ID =
  import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-SM1TH2026EC';

export const GSC_VERIFICATION_TOKEN =
  import.meta.env.VITE_GSC_VERIFICATION || 'SmithSolutionsECommerce-GSC-2026-Verified';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Updates document <title>, meta description, keywords, robots, GSC verification, OpenGraph, Twitter & canonical tags dynamically per route
 */
const ROUTE_SEO_LANG_OVERRIDES: Partial<
  Record<'en' | 'zh', Partial<Record<AppRouteKey, { title: string; description: string }>>>
> = {
  en: {
    landing: {
      title: 'Smith Solutions E-Commerce | Multi-SaaS Commerce, Warehouse & POS Platform',
      description:
        'Smith Solutions E-Commerce (Material Assemble): launch your online store for $25/mo, manage inventory, multi-currency BCV POS, custom dual invoices, and WhatsApp orders.',
    },
    marketplace: {
      title: 'Multi-SaaS Active Stores Directory | Smith Solutions E-Commerce',
      description:
        'Explore verified stores on Smith Solutions E-Commerce with isolated shopping carts, national shipping or local delivery, dual custom invoices, and WhatsApp ordering.',
    },
    merchant: {
      title: 'Merchant SaaS Portal ($25/mo) | Smith Solutions E-Commerce',
      description:
        'Register your store with logo and tax ID, manage your $25/mo subscription, bulk import/export CSV/JSON product catalogs, and track your store sales ledger.',
    },
    admin: {
      title: 'Exclusive Super Admin Console | Smith Solutions E-Commerce',
      description:
        'Admin console to manually activate/deactivate SaaS store accounts, verify $25/mo payments, and configure receiving payment accounts.',
    },
    not_found: {
      title: '404 Page Not Found | Smith Solutions E-Commerce',
      description: 'The requested page does not exist on Smith Solutions E-Commerce.',
    },
  },
  zh: {
    landing: {
      title: 'Smith Solutions E-Commerce | 多租户 SaaS 电商、仓库与双币 POS 平台',
      description:
        'Smith Solutions E-Commerce (Material Assemble)：每月 $25 即可创建独立网店，集成库存管理、BCV 实时汇率 POS、双联定制发票与 WhatsApp 订单协同。',
    },
    marketplace: {
      title: '已激活店铺目录商城 | Smith Solutions E-Commerce',
      description:
        '浏览 Smith Solutions E-Commerce 认证店铺，享独立购物车、全国快递/本地配送、双联 PDF 发票与 WhatsApp 一键下单。',
    },
    merchant: {
      title: '商户 SaaS 管理中心 ($25/月) | Smith Solutions E-Commerce',
      description:
        '注册店铺、上传 Logo 与税号 RIF，管理 $25/月 订阅，批量导入导出商品数据库并查看个性化销售台账。',
    },
    admin: {
      title: '总管理员专属控制台 | Smith Solutions E-Commerce',
      description: '用于审核 $25 订阅付款、手动启用或停用 SaaS 店铺以及配置平台收款账户。',
    },
    not_found: {
      title: '404 未找到页面 | Smith Solutions E-Commerce',
      description: '您访问的路径在 Smith Solutions E-Commerce 上不存在。',
    },
  },
};

export function applyRouteMetaTags(
  routeKey: AppRouteKey,
  lang: 'es' | 'en' | 'zh' = 'es'
): void {
  const base = ROUTE_SEO_MAP[routeKey] || ROUTE_SEO_MAP.landing;
  const override = lang !== 'es' ? ROUTE_SEO_LANG_OVERRIDES[lang]?.[routeKey] : undefined;
  const config = override ? { ...base, ...override } : base;

  document.title = config.title;

  const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
    let el = document.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', config.description);
  setMeta('meta[name="keywords"]', 'name', 'keywords', config.keywords);
  setMeta('meta[name="robots"]', 'name', 'robots', config.robots || 'index, follow');
  setMeta(
    'meta[name="google-site-verification"]',
    'name',
    'google-site-verification',
    GSC_VERIFICATION_TOKEN
  );

  // OpenGraph
  setMeta('meta[property="og:title"]', 'property', 'og:title', config.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', config.description);
  const fullUrl = `${window.location.origin}${config.path === '/404' ? window.location.pathname : config.path}`;
  setMeta('meta[property="og:url"]', 'property', 'og:url', fullUrl);

  // Twitter
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', config.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', config.description);

  // Canonical link
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', fullUrl);
}

/**
 * Sends virtual pageview or custom event to Google Analytics 4 (gtag.js)
 */
export function trackAnalyticsPageView(routeKey: AppRouteKey, customPath?: string): void {
  const config = ROUTE_SEO_MAP[routeKey] || ROUTE_SEO_MAP.landing;
  const pagePath = customPath || config.path;

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: config.title,
      page_location: `${window.location.origin}${pagePath}`,
      page_path: pagePath,
      send_to: GA_MEASUREMENT_ID,
    });

    if (routeKey === 'not_found') {
      window.gtag('event', 'page_not_found_404', {
        broken_path: customPath || window.location.pathname,
        referrer: document.referrer || 'direct',
      });
    }
  }
}

/**
 * Updates Google Consent Mode v2 when user accepts/rejects cookies in CookieBanner
 */
export function updateAnalyticsConsent(analyticsGranted: boolean, preferencesGranted: boolean): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      functionality_storage: preferencesGranted ? 'granted' : 'denied',
      personalization_storage: preferencesGranted ? 'granted' : 'denied',
    });
  }
}

export type AppMainView = 'landing' | 'app' | 'marketplace' | 'merchant' | 'admin' | 'not_found';

/**
 * Resolves window.location.pathname into an application view/tab, optional store slug, or 404
 */
export function resolvePathToRoute(pathname: string): {
  is404: boolean;
  view: AppMainView;
  tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  routeKey: AppRouteKey;
  storeSlug?: string;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean.startsWith('/tienda/')) {
    const slug = clean.replace('/tienda/', '').trim();
    if (slug) {
      return {
        is404: false,
        view: 'marketplace',
        tab: 'inventory',
        routeKey: 'marketplace',
        storeSlug: slug,
      };
    }
  }

  switch (clean) {
    case '/':
    case '/inicio':
      return { is404: false, view: 'landing', tab: 'inventory', routeKey: 'landing' };
    case '/tiendas':
    case '/marketplace':
    case '/catalogo':
      return { is404: false, view: 'marketplace', tab: 'inventory', routeKey: 'marketplace' };
    case '/mi-tienda':
    case '/registro-tienda':
    case '/suscripcion':
      return { is404: false, view: 'merchant', tab: 'inventory', routeKey: 'merchant' };
    case '/admin':
    case '/superadmin':
      return { is404: false, view: 'admin', tab: 'inventory', routeKey: 'admin' };
    case '/almacen':
    case '/inventario':
      return { is404: false, view: 'app', tab: 'inventory', routeKey: 'inventory' };
    case '/pos':
    case '/punto-de-venta':
      return { is404: false, view: 'app', tab: 'pos', routeKey: 'pos' };
    case '/fiados':
    case '/cobranzas':
      return { is404: false, view: 'app', tab: 'debtors', routeKey: 'debtors' };
    case '/caja':
    case '/cierre':
    case '/fiscalidad':
      return { is404: false, view: 'app', tab: 'cashier', routeKey: 'cashier' };
    case '/rentabilidad':
    case '/kpis':
    case '/ventas':
      return { is404: false, view: 'app', tab: 'sales', routeKey: 'sales' };
    default:
      return { is404: true, view: 'not_found', tab: 'inventory', routeKey: 'not_found' };
  }
}
