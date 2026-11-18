import jsPDF from 'jspdf';
import { VectorLanguage } from '../types';
import { savePdfResilient } from './pdfExport';

export interface GuideSectionContent {
  code: string;
  title: string;
  subtitle: string;
  steps: Array<{
    heading: string;
    detail: string;
  }>;
  highlights: string[];
}

export interface LanguageGuideEdition {
  lang: VectorLanguage;
  languageName: string;
  documentTitle: string;
  documentSubtitle: string;
  platformTag: string;
  versionLabel: string;
  sections: [GuideSectionContent, GuideSectionContent, GuideSectionContent];
  footerNote: string;
}

export const PLATFORM_GUIDE_TRILINGUAL: Record<VectorLanguage, LanguageGuideEdition> = {
  es: {
    lang: 'es',
    languageName: 'Español',
    documentTitle: 'Guía Oficial Actualizada · Smith Solutions E-Commerce',
    documentSubtitle:
      'Manual práctico para Compradores, Registro y Operación de Tiendas SaaS, y Consultas con Vector',
    platformTag: 'Plataforma Multi-SaaS · Tasa Oficial BCV · PWA iPhone / Mac / Android',
    versionLabel: 'Edición Trilingüe Actualizada 2026 (ES · EN · 中文)',
    sections: [
      {
        code: '01',
        title: 'Cómo un Usuario Compra Productos',
        subtitle: 'Compra verificada sin suscripción, precios USD/Bs (BCV) y factura dual PDF',
        steps: [
          {
            heading: '1. Explora el directorio o entra al enlace directo de la tienda',
            detail:
              'Abre «Comprar · Tiendas» en el menú «Tiendas y Servicios» o accede directo por la URL de la tienda. No necesitas pagar suscripción para navegar ni comprar.',
          },
          {
            heading: '2. Revisa precios en USD y Bolívares a Tasa Oficial BCV',
            detail:
              'La barra superior sincroniza en vivo la tasa oficial del BCV (o tasa personalizada/paralela si el comercio la usa). También puedes cambiar el idioma (Español / English / 简体中文) desde el menú desplegable.',
          },
          {
            heading: '3. Arma tu carrito independiente por tienda',
            detail:
              'Cada comercio mantiene su propio catálogo, stock real, fotografías, calificación por estrellas y carrito aislado para evitar mezclar pedidos entre distintas tiendas.',
          },
          {
            heading: '4. Selecciona método de pago de la tienda y modalidad de entrega',
            detail:
              'Elige entre los métodos de pago habilitados por esa tienda (Pago Móvil, Zelle, Transferencia Bancaria, Efectivo USD/Bs, Binance Pay, etc.; el sistema calcula IGTF 3% si aplica) y escoge Retiro en Tienda, Delivery Local o Envío Nacional (MRW, Zoom, Tealca, Domesa).',
          },
          {
            heading: '5. Inicia sesión con Google, descarga tu Factura Dual y envía por WhatsApp',
            detail:
              'Al confirmar el pedido, autentica tu cuenta Google verificada para registrar la orden de forma segura, descargar la Factura Dual PDF (Original Cliente + Copia Tienda) y enviarla con 1 toque al WhatsApp del comercio.',
          },
        ],
        highlights: [
          'App instalable en iPhone (Safari > Compartir > Añadir a pantalla de inicio), Mac y Android.',
          'Modo Offline automático: si se cae internet, tu carrito y la tasa BCV en caché siguen disponibles.',
        ],
      },
      {
        code: '02',
        title: 'Cómo una Persona Registra y Opera su Tienda ($25/mes)',
        subtitle: 'De cuenta verificada a tienda activa con catálogo CSV/JSON, POS y alertas SMTP',
        steps: [
          {
            heading: 'Paso 1 · Verificación con Google en «Vender · Mi Tienda»',
            detail:
              'Entra a «Vender · Mi Tienda» y pulsa «Continuar con Google». Tu correo Gmail verificado protege la titularidad de tu tienda, pagos e historial de ventas.',
          },
          {
            heading: 'Paso 2 · Completa perfil fiscal, logo y modalidades de entrega',
            detail:
              'Ingresa Nombre de la Tienda, Titular o Razón Social, WhatsApp comercial (+58), RIF (opcional si aún no posees), categoría, logotipo (archivo o enlace), descripción, envíos (Nacional, Delivery Local y Retiro) y código de referido si te invitó otra tienda.',
          },
          {
            heading: 'Paso 3 · Paga la suscripción ($25/mes) con los métodos del Admin',
            detail:
              'En «Suscripción $25/mes» verás los métodos de pago configurados manualmente por el Administrador (cuentas globales o específicas para tu tienda: Transferencia Bancaria, Pago Móvil, Binance Pay, Bybit, etc.) o podrás canjear un Cupón de Referido. Reporta tu referencia o TxHash.',
          },
          {
            heading: 'Paso 4 · Activación, catálogo y herramientas operativas',
            detail:
              'Cuando el Administrador aprueba tu pago, tu tienda aparece en el directorio público con enlace propio (/tienda/tu-slug). Carga productos manualmente o importa un CSV/JSON con fotos y precios.',
          },
          {
            heading: 'Paso 5 · Métodos de cobro propios, Almacén & POS y alertas SMTP',
            detail:
              'Configura tus métodos de pago para tus clientes, activa alertas de stock bajo y ventas vía Resend o servidor SMTP propio (incluye prueba Ping en tiempo real antes de guardar), revisa tu Bandeja Admin y usa Almacén & POS (POS multidivisa, IGTF, lector de cámara, libreta de Fiados y cierre de caja) si está habilitado.',
          },
        ],
        highlights: [
          'Programa de Referidos: comparte tu código único y gana cupones de renovación cuando tus referidos paguen.',
          'Libro de ventas en CSV y PDF + facturación dual automática en cada venta web o directa.',
        ],
      },
      {
        code: '03',
        title: 'Cómo Consultar Dudas y Recibir Soporte',
        subtitle: 'Asistente Vector (维克托) 24/7 en memoria, escalamiento humano y canales oficiales',
        steps: [
          {
            heading: '1. Pregunta al Asistente Vector (botón inferior izquierdo)',
            detail:
              'Vector conoce toda esta guía en memoria y responde en tiempo real en Español, English y 简体中文 (por texto o con Voz HD neuronal). Cambia el perfil entre Comprador y Vendedor según lo que necesites.',
          },
          {
            heading: '2. Usa los accesos rápidos o descarga esta guía',
            detail:
              'Pulsa los botones rápidos dentro de Vector («¿Cómo comprar?», «Guía registrar tienda», «Paso 2», «Paso 3», «Guía PDF») o haz clic en el botón de descarga desde Vector, el menú «Tiendas y Servicios» o el pie de página.',
          },
          {
            heading: '3. Solicita atención humana cuando sea necesario (Protocolo N1–N4)',
            detail:
              'Si tienes un problema de cobro, envío, factura incorrecta, error técnico o simplemente prefieres hablar con una persona, escribe «Quiero hablar con humano». Vector crea un ticket con paquete de traspaso completo y SLA (15 min a 4 h).',
          },
          {
            heading: '4. Gestiona tu privacidad y comunicaciones',
            detail:
              'Desde la barra de Vector puedes elegir recibir ofertas («Sí»), «Solo importante» o detener promociones de inmediato escribiendo «STOP».',
          },
          {
            heading: '5. Contacto directo con Administración y Soporte Oficial',
            detail:
              'Los dueños de tienda también reciben avisos en su «Bandeja Admin». Para soporte técnico, migración de catálogos o activaciones prioritarias: WhatsApp +58 422 027 3766 o correo empresaalhadiqainvest@gmail.com.',
          },
        ],
        highlights: [
          'Vector nunca mezcla datos entre tiendas ni solicita contraseñas, CVV o números completos de tarjeta.',
          'Esta guía descargable funciona 100% offline una vez guardada en tu dispositivo.',
        ],
      },
    ],
    footerNote:
      'Smith Solutions E-Commerce · Desarrollado por Smith Bussines Solutions 2026 · WhatsApp +58 422 027 3766 · empresaalhadiqainvest@gmail.com',
  },

  en: {
    lang: 'en',
    languageName: 'English',
    documentTitle: 'Updated Official Guide · Smith Solutions E-Commerce',
    documentSubtitle:
      'Practical handbook for Buyers, Store Registration & Operations, and Support with Vector',
    platformTag: 'Multi-SaaS Platform · Live Official BCV Rate · PWA iPhone / Mac / Android',
    versionLabel: 'Updated Trilingual Edition 2026 (ES · EN · 中文)',
    sections: [
      {
        code: '01',
        title: 'How a User Buys Products',
        subtitle: 'Verified shopping with zero buyer fees, live USD/Bs (BCV) pricing & dual PDF invoices',
        steps: [
          {
            heading: '1. Browse the store directory or open a direct storefront link',
            detail:
              'Open "Buy · Stores" from the "Stores & Services" menu or visit a merchant link directly. Buyers browse and purchase with zero subscription cost.',
          },
          {
            heading: '2. View live USD and Bolivar prices at the Official BCV rate',
            detail:
              'The top bar automatically syncs the live official BCV exchange rate. You can also switch the interface language anytime between Español, English, and 简体中文 using the language dropdown.',
          },
          {
            heading: '3. Build an isolated shopping cart per store',
            detail:
              'Each verified store keeps its own independent catalog, live stock count, product photos, star ratings, and isolated shopping cart so orders never mix across merchants.',
          },
          {
            heading: '4. Choose store payment methods and delivery options',
            detail:
              'Select from the payment methods configured by that store (Pago Móvil, Zelle, Bank Transfer, USD/Bs Cash, Binance Pay, etc., with transparent 3% IGTF when applicable) and pick Store Pickup, Local Delivery, or National Courier (MRW, Zoom, Tealca, Domesa).',
          },
          {
            heading: '5. Sign in with Google, download Dual PDF Invoice & send via WhatsApp',
            detail:
              'At checkout, sign in with your verified Google account to record your order securely, download the Dual PDF Invoice (Customer Original + Store Copy), and send the order summary to the store WhatsApp in 1 tap.',
          },
        ],
        highlights: [
          'Installable PWA app on iPhone (Safari > Share > Add to Home Screen), Mac, and Android.',
          'Resilient Offline Mode: cached BCV rate and cart backup keep working if connectivity drops.',
        ],
      },
      {
        code: '02',
        title: 'How a Person Registers & Runs a Store ($25/mo)',
        subtitle: 'From verified Google login to active storefront, CSV/JSON catalog, POS & SMTP alerts',
        steps: [
          {
            heading: 'Step 1 · Verified Google Sign-In in "Sell · My Store"',
            detail:
              'Navigate to "Sell · My Store" and click "Continue with Google". Your verified email protects store ownership, subscription records, and sales ledgers.',
          },
          {
            heading: 'Step 2 · Fill out business profile, optional Tax ID (RIF), logo & shipping',
            detail:
              'Provide Store Name, Owner/Legal Name, Business WhatsApp (+58), optional RIF/Tax ID, category, store logo (upload or URL), description, delivery options (National, Local Delivery, Pickup), and an optional referral code.',
          },
          {
            heading: 'Step 3 · Submit $25/mo subscription via Admin manual payment methods',
            detail:
              'Inside "Subscription $25/mo", inspect the manual payment methods configured by the Admin (global or store-specific: Venezuelan banks, Pago Móvil, Binance Pay, Bybit, etc.) or apply a Referral Coupon, then submit your reference / TxHash.',
          },
          {
            heading: 'Step 4 · Store activation & catalog import (manual or CSV/JSON)',
            detail:
              'Once Admin approves your payment, your storefront goes live in the public directory with its own link (/tienda/your-slug). Add products manually or bulk-import CSV/JSON files with images and ratings.',
          },
          {
            heading: 'Step 5 · Customer payment methods, Warehouse & POS & SMTP ping alerts',
            detail:
              'Configure your store payment methods for buyers, enable low-stock & sales email alerts via Resend or custom SMTP (with real-time connection Ping test before saving), check your Admin Inbox, and operate Warehouse & POS (multi-currency POS, 3% IGTF, camera barcode scanner, Credit/Fiados ledger & daily cash closing) when enabled.',
          },
        ],
        highlights: [
          'Referral Program: share your unique code to earn renewal coupons when referred stores activate.',
          'Exportable CSV & PDF sales ledger plus automatic dual invoices for web and direct sales.',
        ],
      },
      {
        code: '03',
        title: 'How to Ask Questions & Get Support',
        subtitle: 'Vector Assistant 24/7 with full guide memory, human escalation SLAs & direct channels',
        steps: [
          {
            heading: '1. Ask Vector anytime (bottom-left floating launcher)',
            detail:
              'Vector holds this complete updated guide in memory and answers in Español, English, or 简体中文 via text or HD neural voice. Toggle between Buyer and Seller profiles inside the chat header.',
          },
          {
            heading: '2. Use Quick Chips or download this PDF Guide',
            detail:
              'Click quick chips inside Vector ("How to buy?", "Store setup guide", "Step 2", "Step 3", "PDF Guide") or download the guide from Vector, the "Stores & Services" menu, or the website footer.',
          },
          {
            heading: '3. Request a human specialist (N1–N4 Escalation Protocol)',
            detail:
              'For billing disputes, delayed shipments, incorrect invoices, critical errors, or direct human assistance, type "I want to talk to a human agent". Vector generates a ticket with full context packet and defined SLA (15 min to 4 h).',
          },
          {
            heading: '4. Control notification & offer preferences',
            detail:
              'Use the consent bar in Vector or type "Yes", "Important only", or "STOP" anytime to immediately pause promotional notifications.',
          },
          {
            heading: '5. Direct Admin & Official Support Contact',
            detail:
              'Merchants also receive official announcements inside their "Admin Inbox". For direct assistance, catalog migration, or priority activations: WhatsApp +58 422 027 3766 or email empresaalhadiqainvest@gmail.com.',
          },
        ],
        highlights: [
          'Strict multi-brand isolation: Vector never mixes catalogs or asks for card numbers, CVV, or passwords.',
          'Keep this trilingual PDF guide saved on your device for instant offline reference.',
        ],
      },
    ],
    footerNote:
      'Smith Solutions E-Commerce · Engineered by Smith Bussines Solutions 2026 · WhatsApp +58 422 027 3766 · empresaalhadiqainvest@gmail.com',
  },

  zh: {
    lang: 'zh',
    languageName: '简体中文',
    documentTitle: '官方最新使用指南 · Smith Solutions E-Commerce',
    documentSubtitle: '买家购物流程、商家开店与日常运营、以及维克托（Vector）智能咨询完整手册',
    platformTag: 'Multi-SaaS 多租户电商平台 · BCV 官方实时汇率 · iPhone / Mac / Android PWA',
    versionLabel: '2026 更新三语完整版（西班牙语 · 英语 · 简体中文）',
    sections: [
      {
        code: '01',
        title: '用户如何购买商品（买家指南）',
        subtitle: '买家免订阅费，实时美元/玻利瓦尔（BCV）折算与双联 PDF 发票保障',
        steps: [
          {
            heading: '1. 浏览已认证店铺目录或直接打开店铺专属链接',
            detail:
              '在顶部「商店与服务」菜单中选择「买家 · 商店」，或通过商家的 /tienda/店铺标识 链接直接进入商城。买家逛店与下单完全免费，无需任何订阅费。',
          },
          {
            heading: '2. 按实时 BCV 官方汇率查看美元与玻利瓦尔双币价格',
            detail:
              '页面顶部汇率栏实时同步 BCV 官方汇率（或商家设定汇率）。您也可以随时通过顶部或底部的语言下拉菜单自由切换 西班牙语 / English / 简体中文。',
          },
          {
            heading: '3. 每家店铺拥有独立隔离的购物车',
            detail:
              '每家已激活店铺都配备独立的商品目录、真实库存数量、高清图片、星级评分以及独立购物车，不同店铺的商品与订单绝不会混淆。',
          },
          {
            heading: '4. 选择店铺支持的付款方式与配送方式',
            detail:
              '在结账时选择该店铺配置的收款方式（如 Pago Móvil、Zelle、银行转账、美元/玻利瓦尔现金、Binance Pay 等；适用时系统自动透明计算 3% IGTF），并选择到店自提、同城配送或全国快递（MRW、Zoom、Tealca、Domesa）。',
          },
          {
            heading: '5. Google 验证登录、下载双联 PDF 发票并发送 WhatsApp 订单',
            detail:
              '提交订单时使用已验证的 Google 账号登录，即可安全记录订单、立即下载双联 PDF 发票（客户联原件 + 店主联存根），并一键将订单详情发给店主 WhatsApp 确认发货。',
          },
        ],
        highlights: [
          '支持安装至 iPhone（Safari > 分享 > 添加到主屏幕）、Mac 与 Android 手机桌面。',
          '离线容错支持：网络短暂中断时，缓存的 BCV 汇率与本地购物车队列仍可正常工作。',
        ],
      },
      {
        code: '02',
        title: '个人如何注册并运营店铺（$25/月 商家指南）',
        subtitle: '4 步极速开店入驻、CSV/JSON 批量导入、收银 POS 与实时 SMTP 邮箱验证',
        steps: [
          {
            heading: '第 1 步 · 在「卖家 · 开店」使用 Google 账号验证身份',
            detail:
              '进入「卖家 · 开店」页面，点击「使用 Google 账号继续」。经过邮箱验证的 Google 账号是保护您店铺所有权、订阅付款及销售账目的安全凭证。',
          },
          {
            heading: '第 2 步 · 填写店铺资料、税号 RIF（可选）、Logo 与物流选项',
            detail:
              '填写店铺名称、注册主体/店主姓名、商业接单 WhatsApp（+58）、税号 RIF（暂无可留空）、行业分类、店铺 Logo（上传图片或网址）、简介、配送模式及推荐码（如有好友店铺推荐）。',
          },
          {
            heading: '第 3 步 · 按管理员手动配置的收款方式支付 $25/月 订阅费',
            detail:
              '在「月度订阅 $25/月」选项卡中查看管理员手动配置的官方及专属收款方式（委内瑞拉银行转账、Pago Móvil、Binance Pay、Bybit 或其他已启用方式），也可勾选已赚取的推荐续费优惠券抵扣。付款后填写流水号或交易哈希（TxHash）提交审核。',
          },
          {
            heading: '第 4 步 · 管理员审核激活与商品上架（支持 CSV / JSON 导入）',
            detail:
              '管理员核实付款后，您的店铺将在公开目录上线并生成专属网址（/tienda/店铺标识）。可逐个添加商品，或一键批量导入包含图片、价格与评分的 CSV/JSON 商品库。',
          },
          {
            heading: '第 5 步 · 配置店铺收款方式、仓库 POS 与实时 SMTP 邮件通知',
            detail:
              '在店铺设置中自定义面向买家的收款方式；启用 Resend 或自有 SMTP 低库存与销售报告邮件提醒（保存前内置实时 Ping 连通性校验测试）；查看「管理员收件箱」；如获开启「仓库与收银 POS」，即可使用双币 POS、IGTF、相机条码扫描、数字赊账本（Fiados）与日结对账。',
          },
        ],
        highlights: [
          '推荐奖励计划：分享店铺专属推荐码，受邀朋友付款激活后您将自动获得续费优惠券。',
          '支持一键导出 CSV 与 PDF 销售台账，每笔线上与线下直售均自动开具双联发票。',
        ],
      },
      {
        code: '03',
        title: '如何咨询疑问与获取官方支持',
        subtitle: '维克托（Vector）内置指南记忆、人工客服 SLA 升级与官方直连通道',
        steps: [
          {
            heading: '1. 随时向维克托（Vector）提问（左下角悬浮按钮）',
            detail:
              '维克托记忆库已完整同步本最新三语指南，支持 简体中文、西班牙语 与 英语 实时文字对话及高清神经网络语音朗读，并可在聊天框顶部切换「买家 / 卖家」角色模式。',
          },
          {
            heading: '2. 点击快捷问题标签或下载本三语指南 PDF',
            detail:
              '点击维克托内的快捷按钮（如「如何下单购买？」「开店注册指南」「下载三语指南 PDF」），或在页面顶部「商店与服务」菜单与页脚直接下载完整离线指南。',
          },
          {
            heading: '3. 一键转接人工专员（N1–N4 严格升级协议）',
            detail:
              '遇到扣款争议、物流延迟、发票错误、系统故障或需要人工跟进时，只需输入「转接人工客服」。维克托将生成包含完整上下文的交接工单并按 SLA 时效（15 分钟至 4 小时）跟进。',
          },
          {
            heading: '4. 随时管理营销通知与隐私偏好',
            detail:
              '可通过对话底部授权栏选择「同意」「仅重要通知」，或随时回复「STOP / 退订」立即停止促销通知。',
          },
          {
            heading: '5. 管理员收件箱与官方客服直连联系方式',
            detail:
              '店主可在控制台「管理员收件箱」接收官方通知与奖励信息。如需目录迁移、商务合作或紧急支持：官方 WhatsApp +58 422 027 3766 · 官方邮箱 empresaalhadiqainvest@gmail.com。',
          },
        ],
        highlights: [
          '严格多品牌隔离：维克托绝不混淆不同店铺信息，也绝不索要银行卡号、CVV 或账户密码。',
          '本 PDF 指南保存至手机或电脑后，支持随时 100% 离线查阅。',
        ],
      },
    ],
    footerNote:
      'Smith Solutions E-Commerce · 由 Smith Bussines Solutions 2026 研发 · WhatsApp +58 422 027 3766 · empresaalhadiqainvest@gmail.com',
  },
};

export const VECTOR_GUIDE_MEMORY_SUMMARY = `
[GUÍA OFICIAL ACTUALIZADA DE LA PLATAFORMA — MEMORIA DE VECTOR (ES / EN / 中文)]
1) CÓMO UN USUARIO COMPRA PRODUCTOS / HOW A USER BUYS / 如何购买商品:
- Acceso gratuito para compradores en «Comprar · Tiendas» o enlace /tienda/<slug>.
- Precios duales en vivo USD y Bs. según Tasa Oficial BCV en la barra superior; idioma cambiable en cualquier momento (Español / English / 简体中文) y app PWA instalable en iPhone, Mac y Android.
- Cada tienda tiene su catálogo, stock real, estrellas y carrito aislado.
- Métodos de pago definidos por cada tienda (Pago Móvil, Zelle, Transferencia Bancaria, Efectivo USD/Bs, Binance Pay, etc.; IGTF 3% transparente si aplica) y entrega por Retiro en Tienda, Delivery Local o Envío Nacional (MRW, Zoom, Tealca, Domesa).
- Al confirmar compra: sesión Google verificada, Factura Dual PDF automática (Original Cliente + Copia Tienda) y envío directo por WhatsApp. Funciona incluso en Modo Offline con cola local y caché BCV.

2) CÓMO REGISTRAR Y OPERAR UNA TIENDA ($25 USD/MES) / STORE REGISTRATION / 如何注册与运营店铺:
- Paso 1: Entrar a «Vender · Mi Tienda» e iniciar sesión con Google verificado.
- Paso 2: Completar nombre comercial, titular/razón social, WhatsApp +58, RIF (opcional), categoría, logo, descripción, modalidades de envío y código de referido (opcional).
- Paso 3: Ir a «Suscripción $25/mes», pagar mediante los métodos configurados manualmente por el Admin (globales o asignados específicamente a esa tienda: Bancos VE, Pago Móvil, Binance Pay, Bybit, etc.) o aplicar Cupón de Referido, y reportar referencia / TxHash.
- Paso 4: Al aprobar el Admin, la tienda se activa con URL propia (/tienda/<slug>). Subir productos manualmente o importar CSV/JSON.
- Operación avanzada: Configurar métodos de pago de venta de la tienda, usar Almacén & POS si está habilitado (POS multidivisa, IGTF 3%, cámara lector de barras, Fiados, cierre de caja, SENIAT), configurar alertas por correo con Resend o SMTP propio con prueba Ping en tiempo real antes de guardar, revisar Bandeja Admin y Programa de Referidos.

3) CÓMO CONSULTAR DUDAS / HOW TO ASK DOUBTS & SUPPORT / 如何咨询疑问:
- Vector (维克托) responde 24/7 en ES, EN y 中文 (texto y Voz HD) con acceso completo a esta guía y botón de descarga PDF trilingüe.
- Cambio de perfil en Vector (Comprador / Vendedor) y chips rápidos.
- Escalamiento inmediato a agente humano (16 disparadores N1-N4, SLA 15 min a 4 h) al escribir «Quiero hablar con humano» / «human agent» / «转人工».
- Control de avisos: «Sí», «Solo importante» o «STOP».
- Soporte directo oficial: Bandeja Admin, WhatsApp +58 422 027 3766 y correo empresaalhadiqainvest@gmail.com.
`;

// -----------------------------------------------------------------------------
// High-DPI Canvas-Backed Trilingual A4 PDF Renderer
// Guarantees crisp UTF-8 rendering for Español, English & 简体中文 without mojibake
// -----------------------------------------------------------------------------

const CJK_CHAR_RE = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
const FONT_FAMILY =
  '"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "WenQuanYi Micro Hei", system-ui, -apple-system, sans-serif';

interface WrappedToken {
  lines: string[];
}

function wrapTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): WrappedToken {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }

    // Split into tokens preserving spaces for Latin words and single chars for CJK
    const chars = Array.from(para);
    const tokens: string[] = [];
    let buffer = '';

    for (const ch of chars) {
      if (CJK_CHAR_RE.test(ch)) {
        if (buffer) {
          tokens.push(buffer);
          buffer = '';
        }
        tokens.push(ch);
      } else if (ch === ' ') {
        if (buffer) {
          tokens.push(buffer);
          buffer = '';
        }
        tokens.push(' ');
      } else {
        buffer += ch;
      }
    }
    if (buffer) tokens.push(buffer);

    let currentLine = '';
    for (const tok of tokens) {
      if (currentLine === '' && tok === ' ') continue;
      const candidate = currentLine + tok;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine.trim()) {
          lines.push(currentLine.trimEnd());
          currentLine = tok === ' ' ? '' : tok;
        } else {
          // Single long token exceeds maxWidth — hard wrap char by char
          let sub = '';
          for (const c of Array.from(tok)) {
            if (ctx.measureText(sub + c).width <= maxWidth) {
              sub += c;
            } else {
              if (sub) lines.push(sub);
              sub = c;
            }
          }
          currentLine = sub;
        }
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
  }

  return { lines };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function createA4CanvasPage(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
} {
  // Logical A4 at 1.75x scale -> 1240 x 1754 px (fast, crystal-clear text)
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto gráfico para generar la guía PDF.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx, width, height };
}

function renderEditionPagesToCanvases(edition: LanguageGuideEdition): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  const marginX = 68;
  const maxContentW = 1240 - marginX * 2;
  const footerReservedH = 74;
  const maxY = 1754 - footerReservedH;

  let pageObj = createA4CanvasPage();
  let { canvas, ctx } = pageObj;
  let y = 0;

  const paintHeaderBand = (isContinuation: boolean) => {
    const headerH = isContinuation ? 104 : 184;
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 1240, headerH);

    // Amber accent stripe
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, headerH, 1240, 6);

    // Language badge on top right
    drawRoundedRect(ctx, 1240 - marginX - 156, 26, 156, 34, 8, '#1c1917', '#f59e0b', 1.5);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(edition.languageName.toUpperCase(), 1240 - marginX - 78, 49);
    ctx.textAlign = 'left';

    if (isContinuation) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 22px ${FONT_FAMILY}`;
      ctx.fillText(edition.documentTitle, marginX, 48);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = `500 15px ${FONT_FAMILY}`;
      ctx.fillText(edition.platformTag, marginX, 78);
      y = headerH + 34;
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = `700 15px ${FONT_FAMILY}`;
      ctx.fillText(edition.versionLabel, marginX, 44);

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 30px ${FONT_FAMILY}`;
      ctx.fillText(edition.documentTitle, marginX, 88);

      ctx.fillStyle = '#d4d4d8';
      ctx.font = `400 18px ${FONT_FAMILY}`;
      const subWrap = wrapTextToWidth(ctx, edition.documentSubtitle, maxContentW - 40);
      let sy = 122;
      for (const l of subWrap.lines.slice(0, 2)) {
        ctx.fillText(l, marginX, sy);
        sy += 24;
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 14px ${FONT_FAMILY}`;
      ctx.fillText(edition.platformTag, marginX, 170);
      y = headerH + 38;
    }
  };

  const paintFooterOnCanvas = (targetCanvas: HTMLCanvasElement, pageNumLabel: string) => {
    const fCtx = targetCanvas.getContext('2d');
    if (!fCtx) return;
    fCtx.strokeStyle = '#e2e8f0';
    fCtx.lineWidth = 1.5;
    fCtx.beginPath();
    fCtx.moveTo(marginX, 1754 - 58);
    fCtx.lineTo(1240 - marginX, 1754 - 58);
    fCtx.stroke();

    fCtx.fillStyle = '#64748b';
    fCtx.font = `500 13px ${FONT_FAMILY}`;
    fCtx.textAlign = 'left';
    fCtx.fillText(edition.footerNote, marginX, 1754 - 30);

    fCtx.fillStyle = '#0f172a';
    fCtx.font = `700 13px ${FONT_FAMILY}`;
    fCtx.textAlign = 'right';
    fCtx.fillText(pageNumLabel, 1240 - marginX, 1754 - 30);
    fCtx.textAlign = 'left';
  };

  const startNewPage = () => {
    pages.push(canvas);
    pageObj = createA4CanvasPage();
    canvas = pageObj.canvas;
    ctx = pageObj.ctx;
    paintHeaderBand(true);
  };

  const ensureSpace = (neededH: number) => {
    if (y + neededH > maxY) {
      startNewPage();
    }
  };

  paintHeaderBand(false);

  for (const section of edition.sections) {
    // Measure section header + first step so header never strands alone
    ctx.font = `700 22px ${FONT_FAMILY}`;
    const titleWrap = wrapTextToWidth(ctx, section.title, maxContentW - 90);
    ctx.font = `500 15px ${FONT_FAMILY}`;
    const subWrap = wrapTextToWidth(ctx, section.subtitle, maxContentW - 90);
    const sectionHeaderH = Math.max(76, 26 + titleWrap.lines.length * 28 + subWrap.lines.length * 22 + 12);

    ensureSpace(sectionHeaderH + 130);

    // Section Banner Card
    drawRoundedRect(ctx, marginX, y, maxContentW, sectionHeaderH, 12, '#f8fafc', '#e2e8f0', 1.5);
    drawRoundedRect(ctx, marginX + 16, y + 16, 48, 44, 10, '#f59e0b');
    ctx.fillStyle = '#09090b';
    ctx.font = `800 20px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(section.code, marginX + 40, y + 45);
    ctx.textAlign = 'left';

    let ty = y + 36;
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 22px ${FONT_FAMILY}`;
    for (const l of titleWrap.lines) {
      ctx.fillText(l, marginX + 80, ty);
      ty += 28;
    }

    ctx.fillStyle = '#b45309';
    ctx.font = `600 15px ${FONT_FAMILY}`;
    for (const l of subWrap.lines) {
      ctx.fillText(l, marginX + 80, ty);
      ty += 22;
    }

    y += sectionHeaderH + 18;

    // Steps inside section
    for (const step of section.steps) {
      ctx.font = `700 16px ${FONT_FAMILY}`;
      const headWrap = wrapTextToWidth(ctx, step.heading, maxContentW - 36);
      ctx.font = `400 15px ${FONT_FAMILY}`;
      const detWrap = wrapTextToWidth(ctx, step.detail, maxContentW - 36);

      const cardH = 18 + headWrap.lines.length * 22 + 6 + detWrap.lines.length * 22 + 16;
      ensureSpace(cardH + 12);

      drawRoundedRect(ctx, marginX, y, maxContentW, cardH, 10, '#ffffff', '#e2e8f0', 1.2);
      // Left gold indicator bar
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(marginX, y + 10, 5, cardH - 20);

      let cy = y + 30;
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 16px ${FONT_FAMILY}`;
      for (const l of headWrap.lines) {
        ctx.fillText(l, marginX + 20, cy);
        cy += 22;
      }

      cy += 4;
      ctx.fillStyle = '#334155';
      ctx.font = `400 15px ${FONT_FAMILY}`;
      for (const l of detWrap.lines) {
        ctx.fillText(l, marginX + 20, cy);
        cy += 22;
      }

      y += cardH + 12;
    }

    // Highlights Callout Box
    const highlightLines: string[] = [];
    ctx.font = `600 14px ${FONT_FAMILY}`;
    for (const h of section.highlights) {
      const wrapped = wrapTextToWidth(ctx, `• ${h}`, maxContentW - 40);
      highlightLines.push(...wrapped.lines);
    }
    const calloutH = 22 + highlightLines.length * 21 + 14;
    ensureSpace(calloutH + 22);

    drawRoundedRect(ctx, marginX, y, maxContentW, calloutH, 10, '#fffbeb', '#fcd34d', 1.4);
    let hy = y + 28;
    ctx.fillStyle = '#78350f';
    ctx.font = `600 14px ${FONT_FAMILY}`;
    for (const l of highlightLines) {
      ctx.fillText(l, marginX + 20, hy);
      hy += 21;
    }
    y += calloutH + 26;
  }

  pages.push(canvas);
  pages.forEach((c, idx) => {
    paintFooterOnCanvas(c, `${edition.languageName} · ${idx + 1}/${pages.length}`);
  });

  return pages;
}

/**
 * Generates and downloads the updated Platform Guide PDF in all 3 languages (ES, EN, 中文)
 * or a single selected language edition, with crisp UTF-8 CJK + Latin typography.
 */
export function downloadTrilingualPlatformGuidePDF(mode: 'all' | VectorLanguage = 'all'): void {
  const editions: LanguageGuideEdition[] =
    mode === 'all'
      ? [PLATFORM_GUIDE_TRILINGUAL.es, PLATFORM_GUIDE_TRILINGUAL.en, PLATFORM_GUIDE_TRILINGUAL.zh]
      : [PLATFORM_GUIDE_TRILINGUAL[mode]];

  const allCanvases: HTMLCanvasElement[] = [];
  for (const ed of editions) {
    const rendered = renderEditionPagesToCanvases(ed);
    allCanvases.push(...rendered);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  allCanvases.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const filename =
    mode === 'all'
      ? 'Guia_Actualizada_Smith_Solutions_ES_EN_ZH.pdf'
      : `Guia_Smith_Solutions_${mode.toUpperCase()}.pdf`;

  savePdfResilient(doc, filename);
}
