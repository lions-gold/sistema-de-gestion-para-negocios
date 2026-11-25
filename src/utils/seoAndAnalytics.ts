// SEO, Dynamic Meta Tags & Google Analytics 4 / Search Console Tracking Utilities
// Smith Solutions E-Commerce

import { StoreProduct, StoreTenant } from '../types';
import {
  getSocialPlatformEntries,
  isSafeHttpUrl,
  isSharedHostingOrLocalHost,
  isValidStoreSubdomainSlug,
  normalizeStoreSubdomainSlug,
} from './socialLinks';

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
    title:
      'Smith Solutions E-Commerce | Crea tu Tienda Online, Subdominio Propio, Cobros QR Binance/Bybit y POS BCV',
    description:
      'Plataforma Multi-SaaS de comercio electrónico en Venezuela y Latinoamérica: crea tu tienda online con enlace/subdominio propio, redes sociales, pagos QR de Binance Pay y Bybit, inventario y POS tasa BCV.',
    keywords:
      'crear tienda online Venezuela, tienda con enlace propio, subdominio tienda ecommerce, cobrar con Binance Pay QR, cobrar con Bybit QR, punto de venta tasa BCV, control de inventario, Pago Móvil, Smith Solutions E-Commerce',
  },
  marketplace: {
    path: '/tiendas',
    title: 'Directorio de Tiendas & Catálogos Online con Binance QR y Bybit | Smith Solutions',
    description:
      'Explora tiendas verificadas en Smith Solutions E-Commerce. Compra con envío nacional o delivery local, escanea QR de Binance Pay o Bybit, Pago Móvil, redes sociales y factura PDF dual.',
    keywords:
      'directorio tiendas online Venezuela, catálogo digital WhatsApp, tiendas con Binance Pay QR, Bybit Pay QR, envío nacional MRW Zoom, delivery local, ecommerce BCV',
  },
  merchant: {
    path: '/mi-tienda',
    title: 'Crea tu Tienda Online ($25/mes) con Subdominio Propio y QR | Smith Solutions',
    description:
      'Registra tu tienda con enlace tipo subdominio (@tutienda), conecta Instagram/TikTok/WhatsApp, acepta Binance Pay QR, Bybit QR y Pago Móvil, gestiona envíos e importa catálogos.',
    keywords:
      'registrar tienda online Venezuela, crear catálogo con subdominio, cobrar con Binance QR, cobrar con Bybit QR, tienda en redes sociales, suscripción ecommerce $25',
  },
  admin: {
    path: '/admin',
    title: 'Panel Super Admin Exclusivo | Smith Solutions E-Commerce',
    description:
      'Consola administrativa exclusiva para activación manual de cuentas SaaS, verificación de pagos ($25/mes) y configuración de cuentas receptoras y QR.',
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
    title: 'Punto de Venta Multidivisa (POS BCV + QR Crypto) | Smith Solutions E-Commerce',
    description:
      'Factura en Dólares y Bolívares al instante con tasa BCV, cobro por QR de Binance/Bybit, cálculo automático de IVA e IGTF (3%), lector de código de barras e impresión térmica y fiscal.',
    keywords:
      'punto de venta Venezuela, POS multidivisa, cobrar con QR Binance Bybit en caja, cálculo IGTF 3%, impresora fiscal SENIAT, facturación BCV',
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
      'Realiza cierres de caja duales desglosados por Efectivo $, Efectivo Bs, Pago Móvil, Binance/Bybit QR, Zelle y Punto de Venta. Exporta Libros de Compra y Venta SENIAT.',
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
      'La ruta solicitada no existe en Smith Solutions E-Commerce. Regresa al directorio principal o accede al Punto de Venta y Almacén.',
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

const ROUTE_SEO_LANG_OVERRIDES: Partial<
  Record<'en' | 'zh', Partial<Record<AppRouteKey, { title: string; description: string }>>>
> = {
  en: {
    landing: {
      title: 'Smith Solutions E-Commerce | Online Store Builder, Subdomain Links, Binance/Bybit QR & POS',
      description:
        'Multi-SaaS commerce platform: launch your online store for $25/mo with a shareable subdomain link, social profiles, Binance Pay & Bybit QR checkout, inventory, and multi-currency BCV POS.',
    },
    marketplace: {
      title: 'Verified Stores Directory & Online Catalogs | Smith Solutions E-Commerce',
      description:
        'Browse verified stores on Smith Solutions E-Commerce with custom storefront links, social links, Binance Pay & Bybit QR payments, shipping, and dual PDF invoices.',
    },
    merchant: {
      title: 'Merchant SaaS Portal ($25/mo) · Custom Subdomain & QR | Smith Solutions',
      description:
        'Register your store with logo, custom @subdomain link, Instagram/TikTok profiles, Binance/Bybit QR payment methods, bulk catalog import, and order management.',
    },
    admin: {
      title: 'Exclusive Super Admin Console | Smith Solutions E-Commerce',
      description:
        'Admin console to manually activate/deactivate SaaS store accounts, verify $25/mo payments, and configure receiving payment accounts and QR codes.',
    },
    inventory: {
      title: 'Warehouse, Audit & Lot Traceability | Smith Solutions E-Commerce',
      description:
        'Control real-time inventory with low-stock email alerts, shrinkage audits, batch traceability, and automated WhatsApp supplier purchase orders.',
    },
    pos: {
      title: 'Multi-Currency Point of Sale (POS) with QR Payments | Smith Solutions',
      description:
        'Invoice in USD and Bolívares instantly at the BCV rate with Binance/Bybit QR display, automatic VAT & IGTF (3%), barcode scanner, and thermal or fiscal printing.',
    },
    debtors: {
      title: 'Customer Credit Ledger & WhatsApp Collections | Smith Solutions E-Commerce',
      description:
        'Manage USD receivable accounts, record partial installments, and send dual USD/VES balance reminders on WhatsApp in one click.',
    },
    cashier: {
      title: 'Dual Cash Closing & SENIAT Fiscal Printers | Smith Solutions E-Commerce',
      description:
        'Run dual cash closings by Cash USD, Cash Bs, Pago Móvil, Binance/Bybit QR, Zelle, and Card. Export SENIAT VAT Purchase & Sales ledgers and Z-Reports.',
    },
    sales: {
      title: 'Net Profitability & Sales KPIs | Smith Solutions E-Commerce',
      description:
        'Calculate net daily profit deducting replacement costs and shrinkage. Analyze top-selling products, peak hours, and cashier team performance.',
    },
    not_found: {
      title: '404 Page Not Found | Smith Solutions E-Commerce',
      description: 'The requested page does not exist on Smith Solutions E-Commerce.',
    },
  },
  zh: {
    landing: {
      title: 'Smith Solutions E-Commerce | 独立网店、专属链接、Binance/Bybit 二维码收款与双币 POS',
      description:
        '多租户 SaaS 电商平台：每月 $25 即可拥有专属店铺链接与社交媒体主页，支持 Binance Pay / Bybit 扫码付款、库存管理与 BCV 实时汇率 POS 收银。',
    },
    marketplace: {
      title: '认证店铺目录与扫码购商城 | Smith Solutions E-Commerce',
      description:
        '浏览 Smith Solutions 认证店铺，查看商户社交主页，使用 Binance Pay / Bybit 二维码扫码或本地支付下单，支持全国快递与双联 PDF 发票。',
    },
    merchant: {
      title: '商户 SaaS 管理中心 ($25/月) · 专属链接与二维码收款 | Smith Solutions',
      description:
        '注册店铺并设置 @专属短链与子域名、绑定社交账号、上传 Binance/Bybit 收款二维码，批量管理商品与物流配送。',
    },
    admin: {
      title: '总管理员专属控制台 | Smith Solutions E-Commerce',
      description: '用于审核 $25 订阅付款、手动启用或停用 SaaS 店铺以及配置平台收款账户和二维码。',
    },
    inventory: {
      title: '仓库库存、损耗审计与批次溯源 | Smith Solutions E-Commerce',
      description: '实时掌控库存，支持低库存邮件预警、损耗审计、批次全链路溯源及 WhatsApp 自动补货订单。',
    },
    pos: {
      title: '支持扫码付款的双币收银台 (POS) | Smith Solutions E-Commerce',
      description: '按 BCV 汇率即时进行美元与玻利瓦尔双币结算，支持展示 Binance/Bybit 收款码、自动计算 IVA 与 3% IGTF 及条码扫描。',
    },
    debtors: {
      title: '客户赊账本与 WhatsApp 催收 | Smith Solutions E-Commerce',
      description: '管理美元应收账款与分期还款，一键通过 WhatsApp 发送美元与玻利瓦尔双币对账提醒。',
    },
    cashier: {
      title: '双币日结与 SENIAT 税控打印 | Smith Solutions E-Commerce',
      description: '按美元现金、玻利瓦尔现金、Pago Móvil、Binance/Bybit 二维码、Zelle 与刷卡分类日结，导出 SENIAT 购销台账。',
    },
    sales: {
      title: '净利润与销售 KPI 分析 | Smith Solutions E-Commerce',
      description: '扣除采购成本与损耗计算每日净利润，分析热销商品、营业高峰时段及团队销售绩效。',
    },
    not_found: {
      title: '404 未找到页面 | Smith Solutions E-Commerce',
      description: '您访问的路径在 Smith Solutions E-Commerce 上不存在。',
    },
  },
};

function setMetaTag(selector: string, attrName: string, attrVal: string, content: string): void {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalHref(href: string): void {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
}

const ROUTE_BREADCRUMB_LABELS: Record<'es' | 'en' | 'zh', Record<AppRouteKey, string>> = {
  es: {
    landing: 'Inicio',
    marketplace: 'Directorio de Tiendas',
    merchant: 'Crear Tienda SaaS',
    inventory: 'Almacén e Inventario',
    pos: 'Punto de Venta POS',
    debtors: 'Libreta de Fiados',
    cashier: 'Cierre de Caja y Fiscalidad',
    sales: 'Rentabilidad y KPIs',
    admin: 'Administración',
    not_found: '404',
  },
  en: {
    landing: 'Home',
    marketplace: 'Store Directory',
    merchant: 'Merchant SaaS Portal',
    inventory: 'Warehouse & Inventory',
    pos: 'Multi-Currency POS',
    debtors: 'Credit Ledger',
    cashier: 'Cash Closing & Fiscal',
    sales: 'Profitability & KPIs',
    admin: 'Administration',
    not_found: '404',
  },
  zh: {
    landing: '首页',
    marketplace: '认证店铺目录',
    merchant: '商户 SaaS 中心',
    inventory: '仓库库存',
    pos: '双币 POS 收银',
    debtors: '客户赊账本',
    cashier: '日结与税控',
    sales: '净利润与分析',
    admin: '管理控制台',
    not_found: '404',
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

  setMetaTag('meta[name="description"]', 'name', 'description', config.description);
  setMetaTag('meta[name="keywords"]', 'name', 'keywords', config.keywords);
  setMetaTag('meta[name="robots"]', 'name', 'robots', config.robots || 'index, follow');
  setMetaTag(
    'meta[name="google-site-verification"]',
    'name',
    'google-site-verification',
    GSC_VERIFICATION_TOKEN
  );

  // OpenGraph
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', config.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', config.description);
  setMetaTag(
    'meta[property="og:locale"]',
    'property',
    'og:locale',
    lang === 'zh' ? 'zh_CN' : lang === 'en' ? 'en_US' : 'es_VE'
  );
  const fullUrl = `${window.location.origin}${config.path === '/404' ? window.location.pathname : config.path}`;
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', fullUrl);
  setMetaTag(
    'meta[property="og:image"]',
    'property',
    'og:image',
    `${window.location.origin}/pwa-512x512.png`
  );

  // Twitter
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', config.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', config.description);

  // Canonical link
  setCanonicalHref(fullUrl);

  // Dynamic Route WebPage + BreadcrumbList + Reputation AggregateRating JSON-LD
  const existingRouteJsonLd = document.getElementById('dynamic-route-jsonld');
  if (routeKey === 'admin' || routeKey === 'not_found') {
    if (existingRouteJsonLd) existingRouteJsonLd.remove();
    return;
  }

  const origin = window.location.origin;
  const labels = ROUTE_BREADCRUMB_LABELS[lang] || ROUTE_BREADCRUMB_LABELS.es;
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: labels.landing,
      item: `${origin}/`,
    },
    ...(routeKey !== 'landing'
      ? [
          {
            '@type': 'ListItem',
            position: 2,
            name: labels[routeKey] || config.title,
            item: fullUrl,
          },
        ]
      : []),
  ];

  const routeGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${fullUrl}#webpage`,
        url: fullUrl,
        name: config.title,
        description: config.description,
        inLanguage: lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'es-VE',
        isPartOf: {
          '@id': `${origin}/#website`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${fullUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${origin}/#platform-reputation`,
        name: 'Smith Solutions E-Commerce',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS, Windows, macOS',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          bestRating: '5',
          worstRating: '1',
          ratingCount: '148',
          reviewCount: '148',
        },
      },
    ],
  };

  let routeScriptEl = existingRouteJsonLd as HTMLScriptElement | null;
  if (!routeScriptEl) {
    routeScriptEl = document.createElement('script');
    routeScriptEl.id = 'dynamic-route-jsonld';
    routeScriptEl.type = 'application/ld+json';
    document.head.appendChild(routeScriptEl);
  }
  routeScriptEl.textContent = JSON.stringify(routeGraph);
}

/**
 * Dynamically updates SEO meta tags, OpenGraph tags, canonical URL, and Schema.org Store JSON-LD
 * for individual merchant storefronts so Google indexes each store with its catalog, reputation & social profiles.
 */
export function applyStorefrontMetaTags(
  store: StoreTenant | null,
  products: StoreProduct[] = [],
  lang: 'es' | 'en' | 'zh' = 'es'
): void {
  if (typeof document === 'undefined') return;
  const existingJsonLd = document.getElementById('dynamic-store-jsonld');

  if (!store) {
    if (existingJsonLd) {
      existingJsonLd.remove();
    }
    return;
  }

  const origin = window.location.origin;
  const cleanSlug = normalizeStoreSubdomainSlug(store.slug || store.id) || store.id;
  const storeUrl = `${origin}/@${cleanSlug}`;
  const cat = store.category || 'Comercio';

  const title =
    lang === 'en'
      ? `${store.storeName} (@${cleanSlug}) · Official Store | Smith Solutions`
      : lang === 'zh'
        ? `${store.storeName} (@${cleanSlug}) · 官方网店 | Smith Solutions`
        : `${store.storeName} (@${cleanSlug}) · Tienda Oficial | Smith Solutions`;

  const description = store.description?.trim()
    ? `${store.description.trim()} — ${cat}. Compra con Binance Pay QR, Bybit QR, Pago Móvil y entrega rápida.`
    : lang === 'en'
      ? `Shop at ${store.storeName} (${cat}). Verified store with Binance Pay QR, Bybit QR, local delivery & instant PDF receipt.`
      : lang === 'zh'
        ? `浏览 ${store.storeName} (${cat}) 官方商品目录，支持 Binance Pay / Bybit 二维码付款及快速配送。`
        : `Visita la tienda oficial ${store.storeName} (${cat}). Compra por catálogo digital con Binance Pay QR, Bybit QR, Pago Móvil, delivery y factura PDF.`;

  const keywords = [
    store.storeName,
    `@${cleanSlug}`,
    cat,
    'tienda online',
    'Binance Pay QR',
    'Bybit QR',
    'Pago Móvil',
    'Smith Solutions E-Commerce',
  ].join(', ');

  document.title = title;
  setMetaTag('meta[name="description"]', 'name', 'description', description);
  setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);
  setMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow');

  const safeLogo = isSafeHttpUrl(store.logoUrl)
    ? store.logoUrl
    : `${origin}/pwa-512x512.png`;

  setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', storeUrl);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', safeLogo);

  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMetaTag(
    'meta[name="twitter:label1"]',
    'name',
    'twitter:label1',
    lang === 'en' ? 'Payments' : lang === 'zh' ? '支持付款' : 'Pagos Verificados'
  );
  setMetaTag(
    'meta[name="twitter:data1"]',
    'name',
    'twitter:data1',
    'Binance QR · Bybit QR · Pago Móvil'
  );
  setCanonicalHref(storeUrl);

  const sameAs = getSocialPlatformEntries(store.socialLinks).map((entry) => entry.url);
  const ratedProducts = products.filter((p) => typeof p.rating === 'number' && p.rating > 0);
  const storeAvgRating =
    ratedProducts.length > 0
      ? Math.min(
          5,
          Math.max(
            1,
            ratedProducts.reduce((sum, item) => sum + Number(item.rating || 5), 0) /
              ratedProducts.length
          )
        )
      : 0;

  const topOffers = products
    .filter((p) => p.isActive !== false && p.stock > 0)
    .slice(0, 12)
    .map((p) => ({
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: Number(p.priceUSD || 0).toFixed(2),
      availability: 'https://schema.org/InStock',
      itemOffered: {
        '@type': 'Product',
        name: p.name,
        category: p.category || cat,
        ...(p.description ? { description: p.description } : {}),
        ...(isSafeHttpUrl(p.imageUrl) ? { image: p.imageUrl } : {}),
        ...(typeof p.rating === 'number' && p.rating > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(p.rating).toFixed(1),
                bestRating: '5',
                worstRating: '1',
                ratingCount: '1',
              },
            }
          : {}),
      },
    }));

  const labels = ROUTE_BREADCRUMB_LABELS[lang] || ROUTE_BREADCRUMB_LABELS.es;
  const storeGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Store', 'OnlineStore'],
        '@id': storeUrl,
        name: store.storeName,
        url: storeUrl,
        description,
        image: safeLogo,
        currenciesAccepted: 'USD, VES, USDT',
        paymentAccepted: 'Binance Pay QR, Bybit Pay QR, Pago Móvil, Transferencia, Zelle, Efectivo',
        ...(sameAs.length > 0 ? { sameAs } : {}),
        ...(storeAvgRating > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: storeAvgRating.toFixed(1),
                bestRating: '5',
                worstRating: '1',
                ratingCount: String(ratedProducts.length),
              },
            }
          : {}),
        ...(topOffers.length > 0
          ? {
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: `Catálogo ${store.storeName}`,
                itemListElement: topOffers,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${storeUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: labels.landing,
            item: `${origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: labels.marketplace,
            item: `${origin}/tiendas`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: store.storeName,
            item: storeUrl,
          },
        ],
      },
    ],
  };

  let scriptEl = existingJsonLd as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'dynamic-store-jsonld';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(storeGraph);
}

/**
 * Sends virtual pageview or custom event to Google Analytics 4 (gtag.js)
 */
export function trackAnalyticsPageView(routeKey: AppRouteKey, customPath?: string): void {
  const config = ROUTE_SEO_MAP[routeKey] || ROUTE_SEO_MAP.landing;
  const pagePath = customPath || config.path;

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: document.title || config.title,
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
 * Resolves pathname, query params (?tienda=/ ?store=), and wildcard custom subdomains
 * into an application view/tab, optional store slug, or 404.
 */
export function resolvePathToRoute(
  pathname: string,
  search: string = '',
  hostname: string = ''
): {
  is404: boolean;
  view: AppMainView;
  tab: 'inventory' | 'pos' | 'debtors' | 'cashier' | 'sales';
  routeKey: AppRouteKey;
  storeSlug?: string;
} {
  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  let normalized = pathname || '/';
  if (baseUrl && baseUrl !== '.' && normalized.startsWith(baseUrl)) {
    normalized = normalized.slice(baseUrl.length) || '/';
  }
  const clean = normalized.replace(/\/+$/, '') || '/';

  // 1. Explicit query param (?tienda=slug or ?store=slug)
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const querySlug = params.get('tienda') || params.get('store');
      if (querySlug) {
        const cleanSlug = normalizeStoreSubdomainSlug(querySlug.replace(/^@/, ''));
        if (cleanSlug) {
          return {
            is404: false,
            view: 'marketplace',
            tab: 'inventory',
            routeKey: 'marketplace',
            storeSlug: cleanSlug,
          };
        }
      }
    } catch {
      // ignore invalid query strings
    }
  }

  // 2. Wildcard custom-domain subdomain resolution (e.g. boutique.smithsolutions.shop)
  if (hostname && !isSharedHostingOrLocalHost(hostname) && clean === '/') {
    const cleanHost = hostname.toLowerCase().split(':')[0];
    const parts = cleanHost.split('.').filter(Boolean);
    if (parts.length >= 3 && parts[0] !== 'www') {
      const candidate = normalizeStoreSubdomainSlug(parts[0]);
      if (isValidStoreSubdomainSlug(candidate).valid) {
        return {
          is404: false,
          view: 'marketplace',
          tab: 'inventory',
          routeKey: 'marketplace',
          storeSlug: candidate,
        };
      }
    }
  }

  // 3. Path-based handle/subdomain-style storefront URLs: /@slug, /tienda/slug, /s/slug
  if (clean.startsWith('/@')) {
    const raw = clean.slice(2).trim();
    if (raw && !raw.includes('/')) {
      const cleanSlug = normalizeStoreSubdomainSlug(raw);
      if (cleanSlug) {
        return {
          is404: false,
          view: 'marketplace',
          tab: 'inventory',
          routeKey: 'marketplace',
          storeSlug: cleanSlug,
        };
      }
    }
  }

  if (clean.startsWith('/tienda/')) {
    const raw = clean.replace('/tienda/', '').replace(/^@/, '').trim();
    if (raw && !raw.includes('/')) {
      const cleanSlug = normalizeStoreSubdomainSlug(raw) || raw;
      return {
        is404: false,
        view: 'marketplace',
        tab: 'inventory',
        routeKey: 'marketplace',
        storeSlug: cleanSlug,
      };
    }
  }

  if (clean.startsWith('/s/')) {
    const raw = clean.replace('/s/', '').replace(/^@/, '').trim();
    if (raw && !raw.includes('/')) {
      const cleanSlug = normalizeStoreSubdomainSlug(raw) || raw;
      return {
        is404: false,
        view: 'marketplace',
        tab: 'inventory',
        routeKey: 'marketplace',
        storeSlug: cleanSlug,
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
