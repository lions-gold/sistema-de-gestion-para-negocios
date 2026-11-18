import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
} from '../firebase';
import { makeSafeDocId, isSuperAdminUser } from './saasService';
import {
  StoreProduct,
  StoreStatus,
  StoreTenant,
  UserPlatformRole,
  VectorBrandConfig,
  VectorCampaign,
  VectorCampaignVariant,
  VectorConsentRecord,
  VectorConsentStatus,
  VectorConversationStat,
  VectorEscalationLevel,
  VectorInfluenceLever,
  VectorLanguage,
  VectorPriority,
  VectorRiskType,
  VectorSuggestedAction,
  VectorSuggestedActionType,
  VectorTicket,
  VectorTriggerDefinition,
} from '../types';
import { VECTOR_GUIDE_MEMORY_SUMMARY } from '../utils/platformGuideExport';

export { VECTOR_GUIDE_MEMORY_SUMMARY };

export const VECTOR_IDENTITY = {
  nameEs: 'Vector',
  nameEn: 'Vector',
  nameZh: '维克托',
  shortZh: '维克',
  fallbackName: 'AXIOM',
  tagline: {
    es: 'La dirección correcta, en el momento exacto',
    en: 'The right direction, at the exact moment',
    zh: '精准方向，恰逢其时',
  },
  shortIntro: {
    es: 'Soy Vector. Preciso, breve y siempre un paso adelante.',
    en: "I'm Vector. Precise, concise, and always one step ahead.",
    zh: '我是维克托（Vector）。精准、简练，始终领先一步。',
  },
  greetings: {
    es: '¡Qué gusto saludarle! Soy Vector, su asesor comercial. Puedo orientarle para comprar en tiendas verificadas o guiarle paso a paso para abrir su tienda propia por 25 dólares al mes. ¿Qué le gustaría hacer hoy?',
    esTu: '¡Qué gusto saludarte! Soy Vector, tu asesor comercial. Puedo orientarte para comprar en tiendas verificadas o guiarte paso a paso para abrir tu tienda propia por 25 dólares al mes. ¿Qué te gustaría hacer hoy?',
    en: "Good day, welcome! I'm Vector, your commercial advisor. I can help you buy from verified stores or guide you step by step to launch your own store for 25 dollars per month. What would you like to do today?",
    zh: '您好，很高兴为您服务！我是商务顾问维克托（Vector）。我可以协助您在认证店铺放心购物，或指导您以每月 25 美元快速开启自己的线上店铺。请问今天想办理哪一项？',
  },
  pronunciation: {
    es: 'vek-tor',
    en: 'vek-ter',
    zh: 'Wéikètuō',
  },
};

export const VECTOR_TRIGGERS: VectorTriggerDefinition[] = [
  {
    id: 1,
    code: 'human_request',
    labelEs: 'El cliente pide hablar con una persona',
    labelEn: 'Customer requests to speak with a human agent',
    labelZh: '客户要求转接人工客服',
    level: 'N1',
    reEscalateTo: 'N2',
    priority: 'media',
    firstContactLabel: '15 min',
    slaMinutes: 15,
    reportMotivo: 'pide_humano',
    requiresAdminReport: true,
  },
  {
    id: 2,
    code: 'formal_complaint',
    labelEs: 'Reclamo o queja formal',
    labelEn: 'Formal complaint or dispute',
    labelZh: '正式投诉或抱怨',
    level: 'N2',
    reEscalateTo: 'N3',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'reclamo',
    requiresAdminReport: true,
  },
  {
    id: 3,
    code: 'public_review_threat',
    labelEs: 'Amenaza de reseña pública o denuncia en redes',
    labelEn: 'Threat of public review or social media escalation',
    labelZh: '威胁发表差评或在社交媒体曝光',
    level: 'N3',
    reEscalateTo: 'N4',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'reclamo',
    requiresAdminReport: true,
  },
  {
    id: 4,
    code: 'billing_error',
    labelEs: 'Error de cobro, cobro duplicado, factura incorrecta',
    labelEn: 'Billing error, duplicate charge, or wrong invoice',
    labelZh: '扣款错误、重复扣款或发票有误',
    level: 'N2',
    reEscalateTo: 'N3',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'cobro',
    requiresAdminReport: true,
  },
  {
    id: 5,
    code: 'payment_rejected_twice',
    labelEs: 'Pago rechazado en 2+ intentos',
    labelEn: 'Payment declined 2+ times',
    labelZh: '付款连续两次或以上被拒',
    level: 'N1',
    reEscalateTo: 'N2',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'cobro',
    requiresAdminReport: true,
  },
  {
    id: 6,
    code: 'lost_or_delayed_order',
    labelEs: 'Pedido perdido o retraso mayor al comprometido',
    labelEn: 'Lost order or delay exceeding SLA promise',
    labelZh: '订单丢失或配送严重超时',
    level: 'N2',
    reEscalateTo: 'N3',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'logistica',
    requiresAdminReport: true,
  },
  {
    id: 7,
    code: 'defective_or_wrong_item',
    labelEs: 'Producto defectuoso o distinto al pedido',
    labelEn: 'Defective or wrong product delivered',
    labelZh: '商品存在瑕疵或发错货',
    level: 'N2',
    reEscalateTo: 'N3',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'logistica',
    requiresAdminReport: false,
  },
  {
    id: 8,
    code: 'refund_amount_dispute',
    labelEs: 'Devolución con disputa de monto',
    labelEn: 'Return with refund amount dispute',
    labelZh: '退货金额争议',
    level: 'N2',
    reEscalateTo: 'N3',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'cobro',
    requiresAdminReport: false,
  },
  {
    id: 9,
    code: 'fraud_or_impersonation',
    labelEs: 'Sospecha de fraude o suplantación',
    labelEn: 'Suspected fraud or impersonation',
    labelZh: '涉嫌欺诈或身份冒充',
    level: 'N4',
    priority: 'critica',
    firstContactLabel: '15 min',
    slaMinutes: 15,
    reportMotivo: 'fraude',
    requiresAdminReport: true,
  },
  {
    id: 10,
    code: 'legal_or_privacy_request',
    labelEs: 'Petición legal o de datos personales',
    labelEn: 'Legal or personal data request',
    labelZh: '法律诉求或个人数据请求',
    level: 'N4',
    priority: 'critica',
    firstContactLabel: '15 min',
    slaMinutes: 15,
    reportMotivo: 'legal',
    requiresAdminReport: true,
  },
  {
    id: 11,
    code: 'three_bot_attempts',
    labelEs: 'Tres intentos del bot sin resolver',
    labelEn: 'Three bot attempts without resolution',
    labelZh: '机器人三次尝试未解决',
    level: 'N1',
    reEscalateTo: 'N2',
    priority: 'media',
    firstContactLabel: '30 min',
    slaMinutes: 30,
    reportMotivo: 'molestia',
    requiresAdminReport: false,
  },
  {
    id: 12,
    code: 'critical_tool_failure',
    labelEs: 'Fallo de herramienta crítica',
    labelEn: 'Critical platform tool failure',
    labelZh: '关键系统工具故障',
    level: 'N4',
    priority: 'alta',
    firstContactLabel: '15 min',
    slaMinutes: 15,
    reportMotivo: 'admin',
    requiresAdminReport: true,
  },
  {
    id: 13,
    code: 'admin_wholesale_api',
    labelEs: 'Consulta de administración, mayorista o API',
    labelEn: 'Administration, wholesale, or API inquiry',
    labelZh: '管理权限、批发合作或 API 咨询',
    level: 'N4',
    priority: 'media',
    firstContactLabel: '4 h',
    slaMinutes: 240,
    reportMotivo: 'admin',
    requiresAdminReport: true,
  },
  {
    id: 14,
    code: 'persistent_frustration',
    labelEs: 'Molestia persistente tras dos intentos',
    labelEn: 'Persistent customer frustration after two attempts',
    labelZh: '两次尝试后客户依然不满',
    level: 'N3',
    reEscalateTo: 'N4',
    priority: 'alta',
    firstContactLabel: '60 min',
    slaMinutes: 60,
    reportMotivo: 'molestia',
    requiresAdminReport: true,
  },
  {
    id: 15,
    code: 'sensitive_health_legal_safety',
    labelEs: 'Tema sensible: salud, legal, seguridad',
    labelEn: 'Sensitive topic: health, legal, safety, discrimination',
    labelZh: '敏感议题：健康、法律、安全或歧视',
    level: 'N4',
    priority: 'critica',
    firstContactLabel: '15 min',
    slaMinutes: 15,
    reportMotivo: 'legal',
    requiresAdminReport: true,
  },
  {
    id: 16,
    code: 'campaign_spam_or_optout',
    labelEs: 'Baja o queja de spam en campañas',
    labelEn: 'Campaign unsubscribe spike or spam complaint',
    labelZh: '营销活动退订或垃圾邮件投诉',
    level: 'N4',
    priority: 'alta',
    firstContactLabel: '4 h',
    slaMinutes: 240,
    reportMotivo: 'admin',
    requiresAdminReport: true,
  },
];

export const VECTOR_LEVER_METADATA: Record<
  VectorInfluenceLever,
  { labelEs: string; labelEn: string; labelZh: string; rule: string }
> = {
  reciprocidad: {
    labelEs: 'Reciprocidad verificable',
    labelEn: 'Verifiable reciprocity',
    labelZh: '可验证互惠',
    rule: 'Solo diagnósticos o datos útiles reales antes de sugerir acción.',
  },
  escasez_real: {
    labelEs: 'Escasez real',
    labelEn: 'Real scarcity',
    labelZh: '真实库存稀缺',
    rule: 'Solo cuando stock real del sistema sea > 0 y <= 5 unidades.',
  },
  urgencia_real: {
    labelEs: 'Urgencia con fecha real',
    labelEn: 'Real-date urgency',
    labelZh: '真实截止日期紧迫感',
    rule: 'Solo con fecha vigente registrada en campaña o promoción.',
  },
  prueba_social: {
    labelEs: 'Prueba social verificada',
    labelEn: 'Verified social proof',
    labelZh: '已验证口碑评分',
    rule: 'Solo cuando exista calificación >= 4.0 con reseñas reales registradas.',
  },
  anclaje: {
    labelEs: 'Anclaje real USD / Bs BCV',
    labelEn: 'Real price & BCV anchor',
    labelZh: '真实双币参考锚定',
    rule: 'Precio verificado del catálogo comparado con tasa oficial BCV en vivo.',
  },
  aversion_perdida: {
    labelEs: 'Aversión a la pérdida real',
    labelEn: 'Verified loss aversion',
    labelZh: '已确认权益保留提醒',
    rule: 'Solo sobre artículos ya guardados en el carrito del cliente (máx 2 avisos).',
  },
  personalizacion: {
    labelEs: 'Personalización con datos dados',
    labelEn: 'Declared personalization',
    labelZh: '基于客户已提供信息的个性化推荐',
    rule: 'Solo con criterios explícitos entregados por el usuario o su cuenta.',
  },
  compromiso_pequeno: {
    labelEs: 'Compromiso pequeño reversible',
    labelEn: 'Small reversible step',
    labelZh: '温和可撤销微承诺',
    rule: 'Paso breve sin presión (ej. añadir al carrito o enviar resumen).',
  },
};

export const VECTOR_QA_CRITERIA: Array<{ id: string; es: string; en: string; zh: string }> = [
  {
    id: 'qa_01',
    es: 'Responde correctamente en español, inglés y chino, y cambia de idioma al pedirlo.',
    en: 'Responds accurately in Spanish, English, and Chinese, switching immediately on request.',
    zh: '准确使用西班牙语、英语和中文回复，并在要求时立即切换。',
  },
  {
    id: 'qa_02',
    es: 'Nunca otorga privilegios si alguien dice ser el admin sin verificación técnica.',
    en: 'Never grants admin privileges when someone claims admin identity without technical verification.',
    zh: '未经技术验证，绝不向声称管理员的用户授予任何权限。',
  },
  {
    id: 'qa_03',
    es: 'Con admin verificado, ejecuta campañas solo tras su aprobación del borrador.',
    en: 'With verified Admin, dispatches campaigns only after manual draft approval.',
    zh: '经管理员验证后，仅在草稿获手动批准后才发送营销活动。',
  },
  {
    id: 'qa_04',
    es: 'Todo envío masivo incluye enlace de baja y excluye bajas y rebotes.',
    en: 'Every broadcast includes an unsubscribe link and excludes opt-outs and hard bounces.',
    zh: '所有群发均附带退订链接，并自动排除退订与硬退信。',
  },
  {
    id: 'qa_05',
    es: 'Ninguna palanca de influencia aparece sin dato de respaldo en el sistema.',
    en: 'Zero influence levers activate without verified backing system data.',
    zh: '无系统真实数据支撑时，绝不启用任何影响力策略。',
  },
  {
    id: 'qa_06',
    es: 'Ante un «no» o «STOP», cesa toda comunicación comercial de inmediato.',
    en: 'On «no» or «STOP», halts all commercial messaging immediately and persistently.',
    zh: '收到“no”或“STOP”后立即并永久停止营销沟通。',
  },
  {
    id: 'qa_07',
    es: 'No mezcla datos entre marcas (aislamiento estricto multi-marca).',
    en: 'Never mixes catalogs, prices, or policies across brands.',
    zh: '严格品牌隔离，绝不混用不同店铺的商品、价格或政策。',
  },
  {
    id: 'qa_08',
    es: 'Reportes al admin con formato exacto ([REPORTE]) y dentro del SLA.',
    en: 'Sends Admin [REPORTE] alerts in exact format within SLA.',
    zh: '按标准格式在 SLA 时限内向管理员发送 [REPORTE] 报告。',
  },
  {
    id: 'qa_09',
    es: 'No solicita ni repite datos de tarjeta, CVV ni contraseñas.',
    en: 'Never requests or repeats card numbers, CVV, or passwords.',
    zh: '绝不索要或复述银行卡号、CVV 或密码。',
  },
  {
    id: 'qa_10',
    es: 'Registro completo de conversaciones y envíos para auditoría.',
    en: 'Complete audit log for conversations, escalations, and campaigns.',
    zh: '完整记录对话、升级与活动发送以供审计。',
  },
  {
    id: 'qa_11',
    es: 'Escala con el nivel, la prioridad y el SLA correctos según la tabla de 16 disparadores.',
    en: 'Escalates with exact level, priority, and SLA from the 16-trigger matrix.',
    zh: '依据 16 项触发规则表准确匹配升级级别、优先级与 SLA。',
  },
  {
    id: 'qa_12',
    es: 'Avisa al cliente antes de transferir y no cierra sin confirmar canal y plazo.',
    en: 'Notifies the customer before transfer and confirms channel & timeframe.',
    zh: '转接前告知客户，并在确认渠道与时效后结束机器人阶段。',
  },
  {
    id: 'qa_13',
    es: 'Genera el paquete de traspaso completo, marcando «no disponible» lo que falte.',
    en: 'Generates complete handoff packet, marking missing fields as «no disponible».',
    zh: '生成完整交接工单包，缺失字段标注为 «no disponible»，不得省略。',
  },
  {
    id: 'qa_14',
    es: 'No duplica tickets ya abiertos: los actualiza.',
    en: 'Never duplicates open tickets for the same store/issue; updates them.',
    zh: '不重复创建已开启的工单，而是直接更新。',
  },
  {
    id: 'qa_15',
    es: 'Transfiere de inmediato cuando el cliente pide un humano, sin retenerlo.',
    en: 'Transfers immediately when a customer asks for a human agent.',
    zh: '当客户要求转人工时立即转接，不加挽留。',
  },
  {
    id: 'qa_16',
    es: 'Sube un nivel automáticamente si un caso crítico vence su SLA.',
    en: 'Auto-escalates +1 level when a critical case exceeds its SLA.',
    zh: '关键工单超过 SLA 时自动升级一级。',
  },
  {
    id: 'qa_17',
    es: 'No ofrece promociones ni reabre la venta con un caso abierto.',
    en: 'Does not push promotions or reopen sales while a complaint ticket is open.',
    zh: '工单未关闭期间不推销优惠或重启销售。',
  },
  {
    id: 'qa_18',
    es: 'Contención mayor al 70% y precisión de escalamiento mayor al 85%.',
    en: 'Bot containment > 70% and escalation precision > 85%.',
    zh: '机器人自主解决率 > 70%，升级准确率 > 85%。',
  },
];

export const VECTOR_IMPL_CHECKLIST: Array<{ id: string; es: string; en: string; zh: string }> = [
  {
    id: 'impl_01',
    es: 'Crear los 5 niveles (N0-N4) y sus colas en el sistema de tickets.',
    en: 'Configure 5 escalation tiers (N0-N4) and support queues.',
    zh: '在工单系统中创建 5 个层级与对应队列。',
  },
  {
    id: 'impl_02',
    es: 'Cargar los 16 disparadores como reglas de clasificación.',
    en: 'Load all 16 triggers as deterministic classification rules.',
    zh: '加载 16 项触发条件作为分类规则。',
  },
  {
    id: 'impl_03',
    es: 'Configurar plantillas de mensaje en español, inglés y chino.',
    en: 'Configure ES, EN, and ZH escalation and campaign templates.',
    zh: '配置西班牙语、英语和中文消息模板。',
  },
  {
    id: 'impl_04',
    es: 'Validar que el paquete de traspaso se complete con todos los campos.',
    en: 'Verify handoff packet always renders all required fields.',
    zh: '验证交接数据包包含全部必填字段。',
  },
  {
    id: 'impl_05',
    es: 'Definir SLA por marca y horarios reales.',
    en: 'Define real SLA windows and operating hours per brand.',
    zh: '按品牌设置真实 SLA 时效与营业时间。',
  },
  {
    id: 'impl_06',
    es: 'Probar el escalamiento por vencimiento con un caso simulado.',
    en: 'Test timeout auto-escalation using a simulated overdue case.',
    zh: '通过模拟超时案例测试自动升级。',
  },
  {
    id: 'impl_07',
    es: 'Verificar que el admin reciba alertas por canal privado.',
    en: 'Verify verified Admin receives private channel alerts.',
    zh: '确认管理员通过私密通道接收警报。',
  },
  {
    id: 'impl_08',
    es: 'Medir contención y precisión durante las primeras dos semanas.',
    en: 'Monitor containment & escalation precision continuously.',
    zh: '持续监测机器人解决率与升级准确率。',
  },
  {
    id: 'impl_09',
    es: 'Revisar semanalmente los motivos más frecuentes para mejorar la base de conocimiento.',
    en: 'Review top weekly triggers to improve store knowledge base.',
    zh: '每周复盘高频原因以优化知识库。',
  },
];

export const VECTOR_CONTROL_TARGETS = [
  { key: 'escalationRate', label: 'Tasa de escalamiento', def: 'Casos escalados / conversaciones', target: '15–25%' },
  { key: 'precision', label: 'Precisión de escalamiento', def: 'Casos que sí requerían humano / escalados', target: '> 85%' },
  { key: 'containment', label: 'Contención', def: 'Casos resueltos por Vector sin escalar', target: '> 70%' },
  { key: 'firstContact', label: 'Tiempo al primer contacto', def: 'Ticket abierto -> respuesta humana', target: 'Según SLA' },
  { key: 'slaCompliance', label: 'Cumplimiento de SLA', def: 'Casos atendidos dentro del plazo', target: '> 95%' },
  { key: 'reEscalation', label: 'Re-escalamiento', def: 'Casos que subieron de nivel', target: '< 10%' },
  { key: 'csat', label: 'Satisfacción post-traspaso', def: 'CSAT del caso escalado', target: '> 4.2 / 5' },
  { key: 'contextLeaks', label: 'Fugas de contexto', def: 'Humano que repite preguntas ya respondidas', target: '< 5%' },
];

export function defaultVectorBrandConfig(
  storeId = 'platform',
  brandName = 'Smith Solutions E-Commerce'
): VectorBrandConfig {
  return {
    storeId,
    brandName,
    idiomaPrincipal: 'es',
    tratamientoEs: 'usted',
    tratamientoZh: '您',
    emojiMax: 0,
    politicaEnvios: 'Envío nacional (MRW/Zoom/Tealca), Delivery local o Retiro en tienda según configuración de marca.',
    politicaDevoluciones: 'Cambios o reclamos dentro de las primeras 48 horas con factura dual y empaque original.',
    slaHumano: '24 h hábiles',
    horarioAtencion: 'L-S 08:00-18:00',
    zonaHoraria: 'UTC-4',
    slaCriticaMin: 15,
    slaAltaMin: 60,
    slaMediaMin: 240,
    nivel1Cola: `Soporte ${brandName}`,
    nivel2Cobros: 'Equipo de Cobranzas y Pagos',
    nivel2Logistica: 'Equipo de Despacho y Logística',
    nivel3Supervisor: 'Supervisor de Atención al Cliente',
    nivel4Admin: 'Carlos Smith Zambrano Gonzalez',
    autoEscalarPorVencimiento: true,
    maxIntentosBot: 3,
    canalOfertas: 'ambos',
    frecuenciaMaximaSemanal: 2,
    palancasActivas: ['reciprocidad', 'escasez_real', 'prueba_social', 'anclaje'],
  };
}

export function detectLanguageFromText(text: string, fallback: VectorLanguage = 'es'): VectorLanguage {
  const lower = text.toLowerCase();
  if (/en\s+español|habla\s+español|switch\s+to\s+spanish|espanol/i.test(lower)) return 'es';
  if (/in\s+english|speak\s+english|switch\s+to\s+english|habla\s+inglés|ingles/i.test(lower)) return 'en';
  if (/中文|普通话|汉语|chinese|mandarin|chino/i.test(lower)) return 'zh';

  // Detect Chinese Hanzi characters
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';

  // Heuristic English vs Spanish detection
  const englishHits = (lower.match(/\b(hello|hi|good morning|price|how much|order|shipping|refund|human|agent|help|please|thanks|payment|discount|buy|store|cart)\b/g) || []).length;
  const spanishHits = (lower.match(/\b(hola|buenos|precio|cuanto|cuánto|pedido|envío|envio|devolución|humano|persona|ayuda|gracias|pago|descuento|comprar|tienda|carrito|factura)\b/g) || []).length;
  if (englishHits > spanishHits && englishHits >= 1) return 'en';
  if (spanishHits >= 1) return 'es';

  // If user writes clearly in another unsupported script (Cyrillic, Arabic, Japanese Kana/Korean Hangul)
  if (/[\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\uac00-\ud7af]/.test(text)) {
    return 'en';
  }
  return fallback;
}

export function isUnsupportedForeignScript(text: string): boolean {
  return /[\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

const PRIORITY_RANK: Record<VectorPriority, number> = {
  media: 1,
  alta: 2,
  critica: 3,
};

const LEVEL_RANK: Record<VectorEscalationLevel, number> = {
  N0: 0,
  N1: 1,
  N2: 2,
  N3: 3,
  N4: 4,
};

export function detectEscalationTrigger(
  text: string,
  botAttemptsOnIssue: number
): { trigger: VectorTriggerDefinition; risk: VectorRiskType } | null {
  const lower = text.toLowerCase();
  const matched: Array<{ trigger: VectorTriggerDefinition; risk: VectorRiskType }> = [];

  if (/(fraude|estafa|suplantaci|rob[oó]|phishing|hack|fraud|scam|impersonat|欺诈|诈骗|冒充)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[8], risk: 'fraude' }); // #9
  }
  if (/(demanda|abogado|indecopi|sundde|saren|legal|gdpr|datos personales|privacidad|lawsuit|attorney|lawyer|legal request|律师|法律|起诉|隐私数据)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[9], risk: 'legal' }); // #10
  }
  if (/(intoxic|alergia|peligro|lesión|salud|discriminaci|racis|amenaza física|health|safety|discrimination|过敏|安全事故|歧视|健康风险)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[14], risk: 'reputacional' }); // #15
  }
  if (/(reseña pública|redes sociales|escrache|instagram|tiktok|funar|public review|twitter|complaint online|社交媒体曝光|差评威胁)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[2], risk: 'reputacional' }); // #3
  }
  if (/(doble cobro|cobraron doble|cobro duplicado|error de cobro|factura incorrecta|mal facturado|duplicate charge|billing error|wrong invoice|重复扣款|扣款错误|发票错误)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[3], risk: 'reembolso' }); // #4
  }
  if (/(rechazad[oa].*(2|dos|varias)|dos veces rechazado|rejected twice|declined twice|两次被拒|付款失败两次)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[4], risk: 'ninguno' }); // #5
  }
  if (/(pedido perdido|no lleg[oó]|retraso|extraviado|lost order|package missing|delayed|丢件|未收到|严重延迟)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[5], risk: 'reputacional' }); // #6
  }
  if (/(defectuoso|roto|dañado|equivocado|distinto al pedido|defective|broken|wrong item|破损|发错货|质量问题)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[6], risk: 'reembolso' }); // #7
  }
  if (/(devoluci[oó]n.*monto|disputa.*reembolso|no me devolvieron completo|refund dispute|partial refund|退款金额争议)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[7], risk: 'reembolso' }); // #8
  }
  if (/(reclamo|queja formal|inaceptable|p[eé]simo servicio|formal complaint|terrible service|正式投诉|非常差)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[1], risk: 'reputacional' }); // #2
  }
  if (/(spam|dejen de enviar|baja masiva|muchos correos|unsubscribe complaint|垃圾邮件|停止群发)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[15], risk: 'reputacional' }); // #16
  }
  if (/(error del sistema|caída crítica|no carga checkout|no sirve pagar|system down|critical bug|系统崩溃|工具故障)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[11], risk: 'reputacional' }); // #12
  }
  if (/(mayorista|socio|alianza|api\b|administraci[oó]n|franquicia|wholesale|partnership|api access|批发|合作|API接口)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[12], risk: 'ninguno' }); // #13
  }
  if (/(hablar con.*(persona|humano|alguien|asesor|agente|operador)|p[aá]same con|quiero un humano|talk to a human|real person|human agent|speak to someone|转人工|找客服|真人)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[0], risk: 'ninguno' }); // #1
  }
  if (botAttemptsOnIssue >= 2 && /(no sirve|sigue igual|otra vez|molest|harto|frustrated|still broken|还是不行|烦人)/i.test(lower)) {
    matched.push({ trigger: VECTOR_TRIGGERS[13], risk: 'reputacional' }); // #14
  }
  if (botAttemptsOnIssue >= 3) {
    matched.push({ trigger: VECTOR_TRIGGERS[10], risk: 'ninguno' }); // #11
  }

  if (matched.length === 0) return null;

  // Tie-breaker from PDF Section 6: always pick highest priority, then highest level
  matched.sort((a, b) => {
    const pDiff = PRIORITY_RANK[b.trigger.priority] - PRIORITY_RANK[a.trigger.priority];
    if (pDiff !== 0) return pDiff;
    return LEVEL_RANK[b.trigger.level] - LEVEL_RANK[a.trigger.level];
  });
  return matched[0];
}

export function buildEscalationHandoffPacket(params: {
  ticketNumber: string;
  brandName: string;
  customerName?: string;
  requesterUid?: string;
  customerContact?: string;
  channel: string;
  language: VectorLanguage;
  triggerLabel: string;
  level: VectorEscalationLevel;
  priority: VectorPriority;
  summary: string;
  botAttempts: number;
  lastProposal?: string;
  orderRef?: string;
  evidence?: string;
  requiredHumanAction: string;
  clientCommitment: string;
  offerConsent: VectorConsentStatus;
  risk: VectorRiskType;
  threadId: string;
}): string {
  const val = (v?: string | number | null) =>
    v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : 'no disponible';

  return [
    `[ESCALAMIENTO] Ticket: ${val(params.ticketNumber)}`,
    `Marca/Tienda: ${val(params.brandName)}`,
    `Cliente: ${val(params.customerName)} (ID: ${val(params.requesterUid)}, Contacto: ${val(params.customerContact)})`,
    `Canal e idioma: ${val(params.channel)} · ${params.language}`,
    `Motivo (disparador): ${val(params.triggerLabel)}`,
    `Nivel y prioridad: ${params.level} · Prioridad ${params.priority}`,
    `Resumen: ${val(params.summary)}`,
    `Intentos del bot y última propuesta: ${params.botAttempts} intento(s) · ${val(params.lastProposal)}`,
    `Pedido o referencia: ${val(params.orderRef)}`,
    `Evidencia: ${val(params.evidence)}`,
    `Acción requerida del humano: ${val(params.requiredHumanAction)}`,
    `Compromiso dado al cliente: ${val(params.clientCommitment)}`,
    `Consentimiento de ofertas: ${params.offerConsent}`,
    `Riesgo: ${params.risk}`,
    `Enlace al hilo: ${val(params.threadId)}`,
  ].join(' · ');
}

export function buildAdminReportText(params: {
  brandName: string;
  customerLabel: string;
  channel: string;
  motivo: VectorTriggerDefinition['reportMotivo'];
  priority: 'alta' | 'media' | 'baja';
  summary: string;
  orderRef?: string;
  requiredAction: string;
  offerConsent: VectorConsentStatus;
}): string {
  const consentMap: Record<VectorConsentStatus, string> = {
    si: 'sí',
    no: 'no',
    solo_importante: 'solo importante',
    no_preguntado: 'no preguntado',
  };
  return [
    `[REPORTE] Marca: ${params.brandName} | Cliente: ${params.customerLabel || 'no disponible'} | Canal: ${params.channel}`,
    `Motivo: ${params.motivo}`,
    `Prioridad: ${params.priority}`,
    `Resumen: ${params.summary}`,
    `Pedido/Referencia: ${params.orderRef || 'no disponible'}`,
    `Acción solicitada: ${params.requiredAction}`,
    `Consentimiento de ofertas: ${consentMap[params.offerConsent]}`,
    `Hora: ${new Date().toISOString()} UTC`,
  ].join('\n');
}

export function buildCustomerEscalationNotice(params: {
  language: VectorLanguage;
  trigger: VectorTriggerDefinition;
  level: VectorEscalationLevel;
  channel: string;
  slaLabel: string;
  existingTicketNumber?: string;
  existingArea?: string;
  isOutsideHours?: boolean;
  openDayTime?: string;
}): string {
  const { language, trigger, level, channel, slaLabel, existingTicketNumber, existingArea, isOutsideHours, openDayTime } =
    params;

  // 7.6 Existing ticket
  if (existingTicketNumber) {
    if (language === 'en') {
      return `You already have an open case for this: ${existingTicketNumber}. I have updated it with your latest message and it remains with ${existingArea || level}. Our team will contact you within ${slaLabel}.`;
    }
    if (language === 'zh') {
      return `您已有该事项的处理工单：${existingTicketNumber}。我已将您的最新消息补充至工单，现由 ${existingArea || level} 专员跟进，会在 ${slaLabel} 内联系您。`;
    }
    return `Ya tienes un caso abierto sobre esto: ${existingTicketNumber}. Lo actualicé con tu último mensaje y sigue con ${existingArea || level}. Te contactan en ${slaLabel}.`;
  }

  // 7.4 Explicit human request — verbatim shortest form with nothing added
  if (trigger.id === 1) {
    if (language === 'en') {
      return `Understood. I am transferring you to a specialist now. Estimated wait time: ${slaLabel}.`;
    }
    if (language === 'zh') {
      return `好的，现在为您转接人工专员。预计等待时间：${slaLabel}。`;
    }
    return `Entendido. Te paso con una persona ahora. El tiempo de espera estimado es ${slaLabel}.`;
  }

  // 7.5 Outside business hours
  if (isOutsideHours && trigger.priority !== 'critica') {
    const reopen = openDayTime || 'próximo horario hábil 08:00';
    if (language === 'en') {
      return `We are currently outside operating hours. I have logged your case and our team will contact you starting ${reopen}. If this is urgent and affects a payment, reply URGENT to prioritize it.`;
    }
    if (language === 'zh') {
      return `目前为非工作时间。我已为您登记工单，团队将在 ${reopen} 起第一时间联系您。如涉及紧急付款问题，请回复 URGENT 标记加急。`;
    }
    return `Ahora es fuera de horario de atención. Dejé el caso registrado y te escriben a partir de ${reopen}. Si es urgente y afecta un pago, responde URGENTE y lo marco como prioritario.`;
  }

  // 7.3 Critical / N4
  if (trigger.priority === 'critica' || level === 'N4') {
    if (language === 'en') {
      return `This requires the platform administrator. It's logged as critical and you'll be contacted on ${channel} within ${slaLabel}. For your security, please don't share passwords or card details here.`;
    }
    if (language === 'zh') {
      return `该问题需要平台管理员审核。已记录为紧急工单，我们会在 ${slaLabel} 内通过 ${channel} 联系您。为保障安全，请勿在此提供密码或银行卡信息。`;
    }
    return `Este caso requiere revisión del administrador de la plataforma. Quedó registrado como prioridad crítica y se te contactará por ${channel} en ${slaLabel}. Por seguridad, no compartas contraseñas ni datos de tarjeta por este medio.`;
  }

  // 7.2 Formal complaint / N3
  if (level === 'N3' || trigger.id === 2 || trigger.id === 14) {
    if (language === 'en') {
      return `You are right to raise this, and it is being escalated to a supervisor as high priority. They will contact you within ${slaLabel}. You will not need to explain everything again.`;
    }
    if (language === 'zh') {
      return `您反馈的情况非常重要，现已作为高优先级工单转交客服主管处理，会在 ${slaLabel} 内联系您，您无需重复说明情况。`;
    }
    return `Tiene razón en reclamar, y esto pasa a un supervisor. Registré el caso como prioridad alta y te contactan en ${slaLabel}. No vas a tener que explicarlo de nuevo.`;
  }

  // 7.1 Standard handoff (N1 / N2)
  if (language === 'en') {
    return `A specialist can resolve this faster. I've opened a case with everything we discussed; they'll contact you on ${channel} within ${slaLabel}. Is there anything else I can move forward meanwhile?`;
  }
  if (language === 'zh') {
    return `这个问题由我们的专员处理会更高效。我已将对话内容完整记录为工单，专员会在 ${slaLabel} 内通过 ${channel} 联系您。还有什么我可以先为您处理的吗？`;
  }
  return `Ese punto lo resuelve mejor una persona del equipo. Ya dejé el caso abierto con todo lo que conversamos y te escriben por ${channel} en ${slaLabel}. Mientras tanto, ¿hay algo más en lo que pueda avanzar?`;
}

export function evaluateVerifiableLevers(params: {
  products: StoreProduct[];
  allowedLevers: VectorInfluenceLever[];
  cartCount: number;
  cartRemindersSent: number;
}): { leversUsed: VectorInfluenceLever[]; evidence: string[] } {
  const leversUsed: VectorInfluenceLever[] = [];
  const evidence: string[] = [];
  const allowed = new Set(params.allowedLevers);

  const scarce = params.products.find((p) => p.isActive && p.stock > 0 && p.stock <= 5);
  if (allowed.has('escasez_real') && scarce) {
    leversUsed.push('escasez_real');
    evidence.push(`${scarce.name}: ${scarce.stock} uds disponibles en inventario`);
  }

  const topRated = params.products.find(
    (p) => p.isActive && p.rating >= 4 && (p.reviewCount || 0) > 0
  );
  if (allowed.has('prueba_social') && topRated) {
    leversUsed.push('prueba_social');
    evidence.push(
      `${topRated.name}: ${topRated.rating.toFixed(1)} de 5 en ${topRated.reviewCount} reseñas verificadas`
    );
  }

  if (allowed.has('anclaje') && params.products.length > 0) {
    leversUsed.push('anclaje');
    evidence.push('Precios verificados del catálogo activo en USD y equivalente BCV en vivo');
  }

  if (allowed.has('aversion_perdida') && params.cartCount > 0 && params.cartRemindersSent < 2) {
    leversUsed.push('aversion_perdida');
    evidence.push(`Carrito guardado activo con ${params.cartCount} producto(s)`);
  }

  if (allowed.has('reciprocidad')) {
    leversUsed.push('reciprocidad');
    evidence.push('Resumen objetivo del catálogo y cálculo BCV incluido sin compromiso');
  }

  return { leversUsed, evidence };
}

export interface DeterministicVectorReply {
  reply: string;
  detectedLanguage: VectorLanguage;
  leversUsed: VectorInfluenceLever[];
  leverEvidence: string[];
  recommendedProductIds: string[];
  suggestedActions?: VectorSuggestedAction[];
  consentIntent: 'si' | 'no' | 'solo_importante' | 'none';
  triggerId: number;
  blockedSecurityNotice?: boolean;
}

export function buildVectorSuggestedAction(
  lang: VectorLanguage,
  actionType?: 'none' | VectorSuggestedActionType
): VectorSuggestedAction[] {
  if (!actionType || actionType === 'none') return [];
  if (actionType === 'prompt_google_auth') {
    return [
      {
        type: 'prompt_google_auth',
        label:
          lang === 'zh'
            ? '使用 Google 账号登录'
            : lang === 'en'
              ? 'Sign in with Google'
              : 'Continuar con Google',
      },
      {
        type: 'navigate_merchant',
        label:
          lang === 'zh'
            ? '前往卖家开店中心'
            : lang === 'en'
              ? 'Go to Seller Store Portal'
              : 'Ir a Registrar Mi Tienda',
      },
    ];
  }
  if (actionType === 'navigate_merchant') {
    return [
      {
        type: 'navigate_merchant',
        label:
          lang === 'zh'
            ? '前往「卖家 · 我的店铺」'
            : lang === 'en'
              ? 'Open Sell · My Store'
              : 'Ir a Vender · Mi Tienda',
      },
    ];
  }
  if (actionType === 'download_guide') {
    return [
      {
        type: 'download_guide',
        label:
          lang === 'zh'
            ? '下载三语指南 PDF (西/英/中)'
            : lang === 'en'
              ? 'Download Guide PDF (ES / EN / 中文)'
              : 'Descargar Guía PDF (ES / EN / 中文)',
      },
    ];
  }
  return [
    {
      type: 'navigate_marketplace',
      label:
        lang === 'zh'
          ? '前往「买家 · 店铺目录」'
          : lang === 'en'
            ? 'Browse Buy · Stores'
            : 'Ir a Comprar · Tiendas',
    },
  ];
}

function resolveStoreOnboardingOrRoleGuidance(params: {
  text: string;
  lang: VectorLanguage;
  userRole?: UserPlatformRole;
  isAuthenticated?: boolean;
  hasOwnedStore?: boolean;
  ownedStoreStatus?: StoreStatus;
  ownedStoreName?: string;
}): DeterministicVectorReply | null {
  const { text, lang, userRole, isAuthenticated, hasOwnedStore, ownedStoreStatus, ownedStoreName } =
    params;

  const asksFullGuideOrDoubts =
    /(gu[ií]a|manual|descargar.*gu[ií]a|consultar.*duda|tengo.*duda|soporte|ayuda|preguntas|guide|handbook|download.*guide|support|faq|help me|ask.*question|指南|手册|下载指南|教程|咨询|疑问)/i.test(
      text
    );

  const asksHowToBuy =
    /(c[oó]mo\s*comprar|como\s*comprar|comprar\s*productos|proceso\s*de\s*compra|carrito|factura\s*dual|m[eé]todos?\s*de\s*pago|how\s*to\s*buy|how\s*do\s*i\s*buy|checkout|payment\s*methods?|怎么买|如何购买|怎么下单|购物流程)/i.test(
      text
    );

  const asksRoleDifference =
    /(comprador.*vendedor|vendedor.*comprador|diferencia|como funciona|cómo funciona|soy comprador|modo comprador|ver tiendas|buyer.*seller|seller.*buyer|how does it work|difference|买家.*卖家|区别)/i.test(
      text
    );

  const asksStep1 = /(paso\s*1|step\s*1|google|cuenta google|requisito|iniciar sesion|iniciar sesión|第\s*1\s*步)/i.test(
    text
  );
  const asksStep2 =
    /(paso\s*2|step\s*2|formulario|rif\b|logo|whatsapp comercial|datos fiscales|envio nacional|delivery local|第\s*2\s*步)/i.test(
      text
    );
  const asksStep3 =
    /(paso\s*3|step\s*3|suscripci[oó]n|\$?25|mensualidad|pago m[oó]vil|binance|bybit|comprobante|referencia|cup[oó]n|第\s*3\s*步)/i.test(
      text
    );
  const asksStep4 =
    /(paso\s*4|step\s*4|activar tienda|activaci[oó]n|subir productos|importar csv|csv|json|cat[aá]logo|smtp|almac[eé]n|第\s*4\s*步)/i.test(
      text
    );

  const asksStoreRegistration =
    /(registrar|registro|crear.*tienda|abrir.*tienda|mi tienda|quiero vender|soy vendedor|como vendo|cómo vendo|vendedor|comerciante|emprender|planes|precio.*tienda|cuanto cuesta.*tienda|cuánto cuesta.*tienda|register.*store|open.*store|create.*store|sell here|become a seller|merchant onboarding|注册店铺|开店|我要开店|卖家)/i.test(
      text
    );

  if (asksHowToBuy && !asksStoreRegistration && !asksStep1 && !asksStep2 && !asksStep3 && !asksStep4) {
    const reply =
      lang === 'zh'
        ? '买家购物仅需 4 步（全程免订阅费）：\n1. 在「买家 · 店铺目录」选择已认证店铺，查看实时 BCV 汇率折算的美元与玻利瓦尔价格。\n2. 将商品加入该店铺独立购物车，并选择到店自提、同城配送或全国快递（MRW/Zoom/Tealca）。\n3. 选择该店铺配置的付款方式（如 Pago Móvil、Zelle、银行转账、Binance Pay 等）。\n4. 使用已验证 Google 账号确认订单，立即下载双联 PDF 发票（客户联 + 店主联）并通过 WhatsApp 一键发送给店主。\n您现在想逛店铺下单，还是下载三语完整指南？'
        : lang === 'en'
          ? 'Buying products as a customer takes 4 easy steps (zero subscription fee):\n1. Open Buy · Stores to browse verified storefronts with live USD and Bolivar prices at the Official BCV rate.\n2. Add items to that store’s isolated cart and pick Store Pickup, Local Delivery, or National Courier (MRW, Zoom, Tealca).\n3. Choose any payment method enabled by the store (Pago Móvil, Zelle, Bank Transfer, Cash, Binance Pay, etc.).\n4. Sign in with verified Google at checkout to issue your Dual PDF Invoice (Customer + Store copy) and dispatch your order via WhatsApp in 1 tap.\nWould you like to browse active stores now or download the trilingual PDF guide?'
          : 'Comprar productos en la plataforma es gratuito y toma 4 pasos:\n1. Entre a «Comprar · Tiendas» o al enlace directo de la tienda para ver precios reales en USD y Bolívares a Tasa Oficial BCV en vivo.\n2. Agregue productos al carrito independiente de esa tienda y elija Retiro en Tienda, Delivery Local o Envío Nacional (MRW, Zoom, Tealca).\n3. Seleccione uno de los métodos de pago habilitados por esa tienda (Pago Móvil, Zelle, Transferencia, Efectivo o Binance Pay).\n4. Inicie sesión con Google verificado al finalizar para descargar su Factura Dual PDF (Cliente + Tienda) y enviar la orden por WhatsApp al dueño.\n¿Desea explorar las tiendas activas ahora o descargar la guía trilingüe en PDF?';

    return {
      reply,
      detectedLanguage: lang,
      leversUsed: ['reciprocidad'],
      leverEvidence: ['Guía actualizada de compra verificada en memoria de Vector'],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(lang, 'navigate_marketplace'),
        ...buildVectorSuggestedAction(lang, 'download_guide'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksFullGuideOrDoubts && !asksStoreRegistration && !asksStep1 && !asksStep2 && !asksStep3 && !asksStep4) {
    const reply =
      lang === 'zh'
        ? '维克托已完整收录最新平台指南，您可以通过以下方式随时咨询或查阅：\n• 即时答疑：直接输入关于购物（BCV 汇率/发票）、开店注册（$25/月/SMTP/POS）或订单的问题，支持 简体中文、西班牙语与英语语音及文字。\n• 人工转接：输入「转接人工客服」即可按 SLA 时效升级给专员或总管理员。\n• 官方直连：WhatsApp +58 422 027 3766 或邮箱 empresaalhadiqainvest@gmail.com。\n点击下方按钮可立即下载 西/英/中 三语离线 PDF 指南，请问您想先了解哪部分？'
        : lang === 'en'
          ? 'I have the full updated guide loaded in memory, and you have three ways to resolve any doubt:\n• Ask Vector 24/7: Ask in Español, English, or 简体中文 about buying products, store registration ($25/mo, manual payment methods, SMTP ping, POS), or switch Buyer/Seller modes above.\n• Human Support: Type "I want to talk to a human agent" anytime to trigger an escalation ticket with SLA tracking.\n• Direct Official Support: WhatsApp +58 422 027 3766 or email empresaalhadiqainvest@gmail.com.\nUse the button below to download the trilingual PDF guide (ES / EN / 中文). Which topic can I clarify first?'
          : 'Tengo toda la guía actualizada en memoria y cuentas con 3 vías rápidas para resolver dudas:\n• Consultar a Vector 24/7: Pregunte por texto o Voz HD en Español, English o 中文 sobre cómo comprar, registrar su tienda ($25/mes, métodos manuales, SMTP con ping, POS) o cambie su perfil Comprador/Vendedor.\n• Escalamiento Humano: Escriba «Quiero hablar con humano» para abrir un ticket formal con SLA de respuesta.\n• Soporte Oficial Directo: Bandeja Admin, WhatsApp +58 422 027 3766 y correo empresaalhadiqainvest@gmail.com.\nPulsa el botón de abajo para descargar la Guía Completa PDF (ES / EN / 中文). ¿Qué tema deseas consultar primero?';

    return {
      reply,
      detectedLanguage: lang,
      leversUsed: ['reciprocidad'],
      leverEvidence: ['Guía trilingüe actualizada en memoria de Vector (ES/EN/ZH)'],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(lang, 'download_guide'),
        ...buildVectorSuggestedAction(lang, 'navigate_marketplace'),
        ...buildVectorSuggestedAction(lang, 'navigate_merchant'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksRoleDifference && !asksStoreRegistration) {
    const reply =
      lang === 'zh'
        ? '平台明确区分两种角色：\n• 买家模式（免费）：无需订阅，直接浏览已认证店铺，按 BCV 汇率以美元或玻利瓦尔下单，获取双联 PDF 发票。\n• 卖家模式（$25/月）：在「卖家 · 我的店铺」用 Google 账号注册品牌、RIF、Logo 与商品库，支持自定义收款方式、POS 与邮件通知。\n下一步：选择您要进入的空间或下载完整三语指南。'
        : lang === 'en'
          ? 'The platform clearly separates both roles:\n• Buyer Mode (Free): Browse verified stores, pay with live BCV dual-currency totals, download dual PDF invoices, and order via WhatsApp with zero subscription fee.\n• Seller Mode ($25/mo): Register your own store with tax ID (RIF), logo, CSV/JSON catalog, store payment methods, POS & SMTP alerts inside Sell · My Store.\nNext step: choose whether to browse stores, register your store, or download the trilingual guide.'
          : 'La plataforma separa ambos perfiles con claridad:\n• Compradores (Sin costo): Exploran tiendas activas en «Comprar · Tiendas», calculan USD/Bs a tasa BCV, eligen métodos de pago de la tienda, descargan factura dual PDF y envían su pedido por WhatsApp.\n• Vendedores / Comercios ($25/mes): Crean su tienda propia en «Vender · Mi Tienda» con RIF (opcional), logo, envíos, métodos de cobro propios, alertas SMTP con prueba Ping y catálogo importable.\nSiguiente paso: elija su espacio o descargue la guía trilingüe en PDF.';

    return {
      reply,
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(lang, 'navigate_marketplace'),
        ...buildVectorSuggestedAction(lang, 'navigate_merchant'),
        ...buildVectorSuggestedAction(lang, 'download_guide'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksStep1) {
    const authDoneText = isAuthenticated
      ? lang === 'zh'
        ? '您已完成 Google 账号验证，可以直接进入第 2 步填写店铺资料。'
        : lang === 'en'
          ? 'Your Google account is already verified. You can move straight to Step 2 and fill in your store profile.'
          : 'Su sesión de Google ya está verificada; puede pasar directo al Paso 2 para completar el formulario de tienda.'
      : lang === 'zh'
        ? '第 1 步（身份验证）：点击「使用 Google 账号继续」完成邮箱验证，这是您管理店铺与收款的唯一安全身份凭证。'
        : lang === 'en'
          ? 'Step 1 (Verified Identity): Click "Continue with Google" inside Sell · My Store. Your verified Google email secures store ownership and payouts.'
          : 'Paso 1 (Identidad Google): Ingrese a «Vender · Mi Tienda» y pulse «Continuar con Google». Su correo verificado protege la propiedad de su tienda y sus registros.';
    return {
      reply:
        lang === 'zh'
          ? `${authDoneText}\n下一步：进入「卖家 · 我的店铺」确认或填写店铺名称与 WhatsApp。`
          : lang === 'en'
            ? `${authDoneText}\nNext step: open Sell · My Store to start your storefront form.`
            : `${authDoneText}\nSiguiente paso: abra «Vender · Mi Tienda» para completar los datos de su comercio.`,
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: buildVectorSuggestedAction(
        lang,
        isAuthenticated ? 'navigate_merchant' : 'prompt_google_auth'
      ),
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksStep2) {
    return {
      reply:
        lang === 'zh'
          ? '第 2 步（店铺资料与配送设置）：\n• 必填项：店铺名称、注册主体/店主姓名、接单 WhatsApp（+58）。\n• 选填项：税号 RIF（暂无可留空）、行业分类、店铺 Logo（上传图片或粘贴链接）、推荐码。\n• 配送选项：勾选全国快递（MRW/Zoom/Tealca）、同城配送或到店自提。\n下一步：在注册表单提交后进入 $25/月 订阅付款页面。'
          : lang === 'en'
            ? 'Step 2 (Store Profile & Shipping):\n• Required: Store name, Legal Owner / Company name, and Business WhatsApp (+58).\n• Optional: Tax ID / RIF (can be left blank), Category, Store Logo upload/URL, and referral code.\n• Delivery: Enable National Courier, Local Delivery, and/or Store Pickup.\nNext step: submit the form in Sell · My Store to proceed to billing.'
            : 'Paso 2 (Datos de Tienda, RIF y Envíos):\n• Obligatorios: Nombre de la Tienda, Titular / Razón Social y WhatsApp comercial (+58).\n• Opcionales: RIF (puede dejarlo vacío si aún no posee), Categoría, Logo (subir archivo o URL) y código de referido.\n• Logística: Active Envío Nacional (MRW/Zoom/Tealca), Delivery Local y/o Retiro en Tienda.\nSiguiente paso: envíe el formulario en «Vender · Mi Tienda» para pasar al pago.',
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: buildVectorSuggestedAction(lang, 'navigate_merchant'),
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksStep3) {
    return {
      reply:
        lang === 'zh'
          ? '第 3 步（$25/月 订阅付款与凭证提交）：\n• 在店铺控制台「月度订阅 $25/月」查看管理员手动配置的官方及专属收款账号（委内瑞拉银行转账、Pago Móvil、Binance Pay、Bybit 等）。\n• 如有推荐优惠券可勾选抵扣；付款后填写流水号或交易哈希（TxHash）并提交凭证。\n下一步：前往订阅页核对收款信息并提交付款报告。'
          : lang === 'en'
            ? 'Step 3 ($25/mo Subscription & Payment Report):\n• Open the "Subscription $25/mo" tab in Sell · My Store to view manual payment methods configured by Admin (global or store-specific: Bank Transfers, Pago Móvil, Binance Pay, Bybit, etc.).\n• Apply a referral coupon if available, complete the transfer, and submit your Reference / TxHash.\nNext step: report your receipt in Sell · My Store.'
            : 'Paso 3 (Suscripción $25/mes y Reporte de Pago):\n• En la pestaña «Suscripción $25/mes» verá los métodos de pago configurados manualmente por el Admin (globales y específicos para su tienda: Bancos VE, Pago Móvil, Binance Pay, Bybit, etc., con conversión Bs. a tasa BCV).\n• Si tiene un cupón de referido puede aplicarlo; tras pagar, registre el número de referencia / TxHash.\nSiguiente paso: entre a «Vender · Mi Tienda» para reportar su comprobante.',
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(lang, 'navigate_merchant'),
        ...buildVectorSuggestedAction(lang, 'download_guide'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksStep4) {
    return {
      reply:
        lang === 'zh'
          ? '第 4 步（店铺激活、商品目录、POS 与 SMTP 警报）：\n• 管理员核实付款后，店铺即自动展示在公共目录，并拥有独立链接 /tienda/店铺标识。\n• 在「商品与数据库导入导出」添加商品或批量导入 CSV/JSON；还可自定义买家收款方式、配置支持实时 Ping 校验的 SMTP/Resend 邮件预警，或使用已开启的仓库与 POS 模块。\n下一步：打开您的店铺控制台上传商品并配置工具。'
          : lang === 'en'
            ? 'Step 4 (Activation, Catalog, POS & SMTP Alerts):\n• Once Admin approves your payment, your storefront goes live in the Active Stores Directory with your own /tienda/slug link.\n• Upload products manually or import CSV/JSON, configure store payment methods for buyers, enable stock/sales alerts via Resend or custom SMTP (with real-time Ping validator), and run Warehouse & POS if enabled.\nNext step: open Sell · My Store to manage your catalog or download the guide.'
            : 'Paso 4 (Activación, Catálogo, POS y Correo SMTP):\n• Al aprobar el pago, el Admin activa su tienda con enlace propio (/tienda/su-slug). Cargue productos manualmente o vía CSV/JSON.\n• Configure sus métodos de pago propios para compradores, active alertas de stock/ventas por Resend o SMTP (con validador Ping en tiempo real antes de guardar) y use Almacén & POS si está habilitado.\nSiguiente paso: abra «Vender · Mi Tienda» o descargue la guía trilingüe en PDF.',
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(lang, 'navigate_merchant'),
        ...buildVectorSuggestedAction(lang, 'download_guide'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (asksStoreRegistration || (userRole === 'seller' && text.length > 0)) {
    const statusHintEs = !isAuthenticated
      ? 'Estado actual: aún no ha iniciado sesión con Google (Paso 1 pendiente).'
      : !hasOwnedStore
        ? 'Estado actual: sesión Google verificada; listo para completar el formulario (Paso 2).'
        : ownedStoreStatus === 'pending'
          ? `Estado actual: su tienda «${ownedStoreName || 'registrada'}» está pendiente de activación; solo falta reportar o esperar aprobación del pago $25 (Paso 3).`
          : ownedStoreStatus === 'active'
            ? `Estado actual: su tienda «${ownedStoreName || 'activa'}» ya está activa (Paso 4). Puede gestionar catálogo y órdenes.`
            : `Estado actual: tienda «${ownedStoreName || 'en revisión'}» requiere revisar suscripción en el panel.`;

    const statusHintEn = !isAuthenticated
      ? 'Current status: Google sign-in pending (Step 1).'
      : !hasOwnedStore
        ? 'Current status: Google verified; ready to fill out the Store Registration form (Step 2).'
        : ownedStoreStatus === 'pending'
          ? `Current status: "${ownedStoreName || 'your store'}" is pending activation; submit or await approval of your $25 payment (Step 3).`
          : ownedStoreStatus === 'active'
            ? `Current status: "${ownedStoreName || 'your store'}" is already active (Step 4). You can publish products and manage orders.`
            : `Current status: check billing tab for "${ownedStoreName || 'your store'}".`;

    const statusHintZh = !isAuthenticated
      ? '当前进度：尚未完成 Google 账号登录（待完成第 1 步）。'
      : !hasOwnedStore
        ? '当前进度：已完成 Google 验证，可直接填写开店注册表（第 2 步）。'
        : ownedStoreStatus === 'pending'
          ? `当前进度：店铺「${ownedStoreName || '已登记'}」处于待激活状态，请提交或等待 $25 订阅审核（第 3 步）。`
          : ownedStoreStatus === 'active'
            ? `当前进度：店铺「${ownedStoreName || '已激活'}」已上线（第 4 步），可随时上架商品与接单。`
            : `当前进度：请在店铺订阅页核对店铺状态。`;

    const reply =
      lang === 'zh'
        ? `注册并激活店铺仅需 4 步（$25/月）：\n1. Google 验证登录（保障店主身份安全）。\n2. 填写店名、店主名、+58 WhatsApp、RIF（可选）、Logo 与配送方式。\n3. 通过委内瑞拉银行转账、Pago Móvil、Binance Pay 或 Bybit 提交 $25 付款凭证。\n4. 审核激活后上传或 CSV 导入商品，即刻在商城接单。\n${statusHintZh}\n下一步：点击下方按钮前往开店，或回复「第1步」~「第4步」查看细节。`
        : lang === 'en'
          ? `Registering and launching your store takes 4 steps ($25/mo):\n1. Sign in with verified Google in Sell · My Store.\n2. Enter Store Name, Owner, +58 WhatsApp, optional RIF, Logo, and Shipping options.\n3. Submit your $25 receipt via VE Banks, Pago Móvil, Binance Pay, or Bybit.\n4. Once activated, add or import CSV/JSON products and start selling.\n${statusHintEn}\nNext step: click below to open your registration form, or ask about "Step 1" to "Step 4".`
          : `Registrar y activar su tienda en Smith Solutions E-Commerce consta de 4 pasos ($25/mes):\n1. Cuenta Google verificada en «Vender · Mi Tienda».\n2. Datos de tienda: Nombre, Titular, WhatsApp (+58), RIF opcional, Logo y modalidades de envío.\n3. Reporte de pago $25/mes por Bancos VE, Pago Móvil, Binance Pay o Bybit.\n4. Activación por Admin y carga manual o CSV/JSON de productos.\n${statusHintEs}\nSiguiente paso: pulse el botón de abajo para ir directo al registro, o escriba «Paso 1», «Paso 2», «Paso 3» o «Paso 4» para detalle exacto.`;

    return {
      reply,
      detectedLanguage: lang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: [
        ...buildVectorSuggestedAction(
          lang,
          !isAuthenticated ? 'prompt_google_auth' : 'navigate_merchant'
        ),
        ...buildVectorSuggestedAction(lang, 'download_guide'),
      ],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  return null;
}

export function runVectorDeterministicFallback(params: {
  message: string;
  currentLanguage: VectorLanguage;
  brandConfig: VectorBrandConfig;
  products: StoreProduct[];
  exchangeRate: number;
  cartCount: number;
  cartRemindersSent: number;
  isVerifiedAdmin: boolean;
  botAttemptsOnIssue: number;
  hasOpenTicket: boolean;
  offerConsent: VectorConsentStatus;
  voiceMode?: boolean;
  userRole?: UserPlatformRole;
  isAuthenticated?: boolean;
  hasOwnedStore?: boolean;
  ownedStoreStatus?: StoreStatus;
  ownedStoreName?: string;
}): DeterministicVectorReply {
  const text = params.message.trim();
  const detectedLang = detectLanguageFromText(text, params.currentLanguage);
  const storeName = params.brandConfig.brandName || 'Smith Solutions E-Commerce';

  // Rule 0: Unsupported script fallback -> respond English offering ES / ZH
  if (isUnsupportedForeignScript(text)) {
    return {
      reply:
        'Good morning. I assist you here in English and can also switch immediately to Español or 中文 (Mandarin). Which language do you prefer?',
      detectedLanguage: 'en',
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  // Rule 1: Unverified Admin impersonation check (§1 Jerarquía)
  const claimsAdmin =
    /carlos\s+smith|zambrano\s+gonzalez|soy\s+el\s+admin|i\s+am\s+the\s+admin|我是管理员/i.test(text);
  if (claimsAdmin && !params.isVerifiedAdmin) {
    return {
      reply:
        detectedLang === 'en'
          ? 'I need to validate your access through the secure Admin channel before continuing.'
          : detectedLang === 'zh'
            ? '在继续之前，我需要通过安全的管理员验证通道核实您的访问权限。'
            : 'Necesito validar tu acceso por el canal seguro antes de continuar.',
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 9,
      blockedSecurityNotice: true,
    };
  }

  // Rule 2: Card number / CVV / Password security guard (§1 Seguridad)
  if (/\b(?:\d[ -]*?){13,16}\b|\bcvv\b|\bmi contraseña\b|\bmy password\b/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? 'For your security, do not enter card numbers, CVV, or passwords in chat. Please complete payments directly through the verified checkout window.'
          : detectedLang === 'zh'
            ? '为保障您的账户安全，请勿在对话中输入银行卡号、CVV 或密码。请直接使用安全结账页面完成支付。'
            : 'Por seguridad, no compartas números de tarjeta, CVV ni contraseñas por este medio. Utiliza directamente la pasarela de pago en pantalla.',
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
      blockedSecurityNotice: true,
    };
  }

  // Rule 3: Opt-out or Offer consent capture (§1 Función 3)
  if (/^(no|stop|baja|no ofertas|退订|不需要)$/i.test(text) || /dejar de recibir ofertas|unsubscribe|stop promotions/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? 'Understood. I have stopped commercial notifications for this brand persistently. Let me know if you only need order support.'
          : detectedLang === 'zh'
            ? '明白。我已立即停止该品牌的优惠通知推送，并持久化保存您的偏好。如需订单协助请随时告知。'
            : 'Entendido. Detuve de inmediato las notificaciones comerciales para esta marca. Indíqueme si necesita asistencia con algún pedido.',
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'no',
      triggerId: 0,
    };
  }
  if (/solo importante|important only|仅重要通知/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? 'Preference saved: important notices only for this brand. How would you like to proceed?'
          : detectedLang === 'zh'
            ? '已保存偏好：仅接收该品牌的重要通知。请问接下来需要我帮您处理什么？'
            : 'Preferencia registrada: solo avisos importantes de esta marca. ¿En qué más puedo asistirle?',
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'solo_importante',
      triggerId: 0,
    };
  }

  // Rule 4: Who are you? (§15.2)
  if (/quién eres|quien eres|who are you|你是谁/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? `I am Vector, the platform commercial assistant. In this conversation I work exclusively with ${storeName}. How may I assist you?`
          : detectedLang === 'zh'
            ? `我是平台商务助手维克托（Vector）。在本对话中仅为您提供 ${storeName} 的专属服务。请问需要协助什么？`
            : `Soy Vector, el asistente comercial de la plataforma. En esta conversación trabajo exclusivamente con la marca ${storeName}. ¿Qué consulta desea resolver?`,
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  // Rule 5: Check 16 escalation triggers (§6)
  const triggerHit = detectEscalationTrigger(text, params.botAttemptsOnIssue);
  if (triggerHit) {
    return {
      reply: buildCustomerEscalationNotice({
        language: detectedLang,
        trigger: triggerHit.trigger,
        level: triggerHit.trigger.level,
        channel: 'Chat Web / Correo',
        slaLabel: triggerHit.trigger.firstContactLabel,
      }),
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: triggerHit.trigger.id,
    };
  }

  // Rule 6: Do not promote or reopen sales if ticket is open (§9)
  if (params.hasOpenTicket) {
    return {
      reply:
        detectedLang === 'en'
          ? `Your case for ${storeName} remains open with our team. I have noted your update and will not introduce promotions while it is being resolved. Do you have an order reference to attach?`
          : detectedLang === 'zh'
            ? `您在 ${storeName} 的工单仍在处理中，我已记录您的补充说明（处理期间不会推送优惠）。是否需要补充订单编号？`
            : `Tu caso en ${storeName} sigue abierto con nuestro equipo. Registré este mensaje sin reactivar ventas ni promociones mientras se resuelve. ¿Deseas adjuntar un número de orden?`,
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  // Rule 7: Policies (Shipping / Returns)
  if (/(envío|envio|delivery|retiro|despacho|shipping|freight|运费|配送|物流)/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? `${storeName} shipping policy: ${params.brandConfig.politicaEnvios}\nOperating hours: ${params.brandConfig.horarioAtencion} (${params.brandConfig.zonaHoraria}).\nWould you like me to recommend available items ready for dispatch?`
          : detectedLang === 'zh'
            ? `${storeName} 配送政策：${params.brandConfig.politicaEnvios}\n营业时间：${params.brandConfig.horarioAtencion}（${params.brandConfig.zonaHoraria}）。\n需要我为您筛选可立即发货的现货商品吗？`
            : `Política de envíos de ${storeName}:\n• ${params.brandConfig.politicaEnvios}\n• Horario: ${params.brandConfig.horarioAtencion} (${params.brandConfig.zonaHoraria}).\n¿Deseas revisar algún producto del catálogo para calcular su envío?`,
      detectedLanguage: detectedLang,
      leversUsed: ['reciprocidad'],
      leverEvidence: [`Política verificada de ${storeName}`],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  if (/(devoluci[oó]n|garant[ií]a|cambio|return|warranty|退货|保修)/i.test(text)) {
    return {
      reply:
        detectedLang === 'en'
          ? `${storeName} returns policy: ${params.brandConfig.politicaDevoluciones}\nHuman SLA: ${params.brandConfig.slaHumano}.\nIf you already have an invoice number, share it so I can check or escalate accurately.`
          : detectedLang === 'zh'
            ? `${storeName} 退换政策：${params.brandConfig.politicaDevoluciones}\n人工响应时效：${params.brandConfig.slaHumano}。\n如您有订单号，请提供以便准确核查或转接。`
            : `Política de devoluciones y garantía de ${storeName}:\n• ${params.brandConfig.politicaDevoluciones}\n• SLA de atención humana: ${params.brandConfig.slaHumano}.\nSi tienes un número de factura, compártelo para registrarlo.`,
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  // Rule 7.4: Consultative Value & Quick Sale Flow (for general business/entrepreneurs)
  const isGeneralPlatformScope = params.brandConfig.storeId === 'platform';
  if (
    isGeneralPlatformScope &&
    /(para qu[eé] sirve|qu[eé] hace|beneficio|ventaja|c[oó]mo hago una venta|como hago una venta|c[oó]mo vender un producto|what does this do|how do i make a sale|有什么用|怎么收银|如何销售)/i.test(
      text
    )
  ) {
    const asksSale = /(venta|vender un producto|cobrar|caja|make a sale|收银)/i.test(text);
    const reply = asksSale
      ? detectedLang === 'zh'
        ? '操作非常快捷！只需进入销售模块挑选客户选购的商品，选择现金或转账支付方式并确认，系统就会自动累计营收并扣减库存。您目前是已经上架商品，还是我们先从创建第一件商品开始？'
        : detectedLang === 'en'
          ? 'It is super fast! Simply open the sales section, pick the items your customer wants, choose cash or transfer, and confirm. The system adds the payment to your register and deducts stock automatically. Do you already have products loaded, or shall we start there?'
          : '¡Es súper rápido! Solo entra a la sección de ventas, elige los artículos que lleva su cliente, selecciona el método de pago en efectivo o transferencia y confirma. El sistema suma el dinero a su caja y descuenta el inventario automáticamente. ¿Ya tiene productos cargados o empezamos por ahí?'
      : detectedLang === 'zh'
        ? '很高兴为您介绍！这套系统能为您节省大量人工对账时间，帮您实时掌控库存变化、在几秒内完成开单收银，并自动核算每日美元与玻利瓦尔收益。您想让我为您演示如何在两分钟内注册店铺吗？'
        : detectedLang === 'en'
          ? 'Great question! This platform saves you hours every day by tracking exact inventory levels, closing sales in seconds with live BCV conversion, and calculating daily profit without manual math. Would you like me to walk you through registering your store in under two minutes?'
          : '¡Qué gusto saludarle! Este sistema le ahorra muchísimo tiempo, porque le permite controlar exactamente qué se vende más para evitar pérdidas de mercancía, registrar ventas en segundos a tasa BCV y conocer su ganancia diaria sin hacer cuentas manuales. ¿Le gustaría que le explique cómo registrar su tienda en menos de dos minutos?';

    return {
      reply,
      detectedLanguage: detectedLang,
      leversUsed: ['reciprocidad'],
      leverEvidence: ['Guía consultiva de beneficios y flujo de venta'],
      recommendedProductIds: [],
      suggestedActions: buildVectorSuggestedAction(detectedLang, 'navigate_merchant'),
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  // Rule 7.5: Guided Store Registration, How to Buy, Guide & Doubt Resolution
  const onboardingOrRoleHit = resolveStoreOnboardingOrRoleGuidance({
    text,
    lang: detectedLang,
    userRole: params.userRole,
    isAuthenticated: params.isAuthenticated,
    hasOwnedStore: params.hasOwnedStore,
    ownedStoreStatus: params.ownedStoreStatus,
    ownedStoreName: params.ownedStoreName,
  });
  if (
    onboardingOrRoleHit &&
    (isGeneralPlatformScope ||
      /registrar|crear.*tienda|abrir.*tienda|comprador.*vendedor|paso\s*[1-4]|c[oó]mo\s*comprar|como\s*comprar|gu[ií]a|manual|ayuda|duda|register.*store|how\s*to\s*buy|guide|help|step\s*[1-4]|注册|开店|怎么买|指南|手册|第\s*[1-4]\s*步/i.test(
        text
      ))
  ) {
    return onboardingOrRoleHit;
  }

  // Rule 8: Store catalog lookup & verifiable influence levers (§3)
  const activeCatalog = params.products.filter((p) => p.isActive && p.stock > 0);
  if (activeCatalog.length === 0) {
    if (isGeneralPlatformScope) {
      if (params.userRole === 'seller') {
        const sellerGuide = resolveStoreOnboardingOrRoleGuidance({
          text: 'registrar tienda',
          lang: detectedLang,
          userRole: 'seller',
          isAuthenticated: params.isAuthenticated,
          hasOwnedStore: params.hasOwnedStore,
          ownedStoreStatus: params.ownedStoreStatus,
          ownedStoreName: params.ownedStoreName,
        });
        if (sellerGuide) return sellerGuide;
      }
      return {
        reply:
          detectedLang === 'en'
            ? 'You are in platform view. To shop, open "Buy · Stores" and pick an active store. To open your own store ($25/mo), switch to Seller mode or ask me for the registration guide.'
            : detectedLang === 'zh'
              ? '当前位于平台主页视图。如需购物请进入「买家 · 店铺目录」选择门店；如需开店（$25/月），请切换卖家模式或向我咨询开店步骤。'
              : 'Está en la vista general de la plataforma. Para comprar, entre a «Comprar · Tiendas» y elija una tienda activa. Si desea vender y abrir su propia tienda ($25/mes), pregúnteme por los pasos de registro.',
        detectedLanguage: detectedLang,
        leversUsed: [],
        leverEvidence: [],
        recommendedProductIds: [],
        suggestedActions: [
          ...buildVectorSuggestedAction(detectedLang, 'navigate_marketplace'),
          ...buildVectorSuggestedAction(detectedLang, 'navigate_merchant'),
        ],
        consentIntent: 'none',
        triggerId: 0,
      };
    }

    return {
      reply:
        detectedLang === 'en'
          ? `I do not have published in-stock items for ${storeName} right now. You can browse other active stores in Buy · Stores or open your own storefront in Sell · My Store.`
          : detectedLang === 'zh'
            ? `${storeName} 目前暂无可查询的在售库存商品信息。您可以前往活跃店铺目录查看其他门店，或创建自己的店铺。`
            : `En este momento no tengo productos activos con stock cargados para ${storeName}. Puede explorar otras tiendas activas en «Comprar · Tiendas» o registrar su propia tienda en «Vender · Mi Tienda».`,
      detectedLanguage: detectedLang,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      suggestedActions: buildVectorSuggestedAction(detectedLang, 'navigate_marketplace'),
      consentIntent: 'none',
      triggerId: 0,
    };
  }

  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const budgetMatch = text.match(/\$?\s*(\d+(?:[.,]\d+)?)/);
  const maxBudget = budgetMatch ? parseFloat(budgetMatch[1].replace(',', '.')) : null;

  let candidates = activeCatalog.filter((p) => {
    const hay = `${p.name} ${p.description} ${p.category || ''}`.toLowerCase();
    const matchesKeyword = tokens.some((t) => hay.includes(t));
    const matchesBudget = maxBudget !== null ? p.priceUSD <= maxBudget * 1.15 : true;
    return matchesKeyword && matchesBudget;
  });

  if (candidates.length === 0 && maxBudget !== null) {
    candidates = activeCatalog.filter((p) => p.priceUSD <= maxBudget * 1.2);
  }
  if (candidates.length === 0) {
    candidates = [...activeCatalog].sort((a, b) => b.rating - a.rating);
  }

  const top3 = candidates.slice(0, 3);
  const leverEval = evaluateVerifiableLevers({
    products: top3,
    allowedLevers: params.brandConfig.palancasActivas,
    cartCount: params.cartCount,
    cartRemindersSent: params.cartRemindersSent,
  });

  const lines = top3.map((p) => {
    const bs = (p.priceUSD * (params.exchangeRate || 1)).toFixed(2);
    const stockTag =
      p.stock <= 5
        ? detectedLang === 'en'
          ? ` (${p.stock} left in stock)`
          : detectedLang === 'zh'
            ? `（仅剩 ${p.stock} 件）`
            : ` (quedan ${p.stock} uds en inventario)`
        : '';
    const ratingTag =
      p.reviewCount && p.reviewCount > 0
        ? ` · ${p.rating.toFixed(1)}/5 (${p.reviewCount})`
        : '';
    return `• ${p.name}: $${p.priceUSD.toFixed(2)} USD (${bs} Bs.)${stockTag}${ratingTag}`;
  });

  const cartLine =
    params.cartCount > 0 && params.cartRemindersSent < 2 && params.offerConsent !== 'no'
      ? detectedLang === 'en'
        ? `\nYour cart currently holds ${params.cartCount} item(s) ready for dual-invoice checkout.`
        : detectedLang === 'zh'
          ? `\n您的购物车中还有 ${params.cartCount} 件商品待结账，可随时生成双份发票。`
          : `\nTienes ${params.cartCount} producto(s) guardados en tu carrito listos para facturar.`
      : '';

  const reply =
    detectedLang === 'en'
      ? `Verified options in ${storeName} (BCV rate ${params.exchangeRate.toFixed(2)} Bs/USD):\n${lines.join('\n')}${cartLine}\nWhich item would you like me to add to your cart?`
      : detectedLang === 'zh'
        ? `${storeName} 当前可核实商品（参考汇率 ${params.exchangeRate.toFixed(2)} Bs/USD）：\n${lines.join('\n')}${cartLine}\n需要我将哪一款加入购物车？`
        : `Opciones verificadas en ${storeName} (tasa ${params.exchangeRate.toFixed(2)} Bs/USD):\n${lines.join('\n')}${cartLine}\n¿Cuál deseas agregar directamente al carrito?`;

  return {
    reply,
    detectedLanguage: detectedLang,
    leversUsed: leverEval.leversUsed,
    leverEvidence: leverEval.evidence,
    recommendedProductIds: top3.map((p) => p.id),
    consentIntent: 'none',
    triggerId: 0,
  };
}

// -----------------------------------------------------------------------------
// Firestore Reads & Writes for Vector (Strictly adhering to handleFirestoreError)
// -----------------------------------------------------------------------------

export async function getVectorBrandConfig(
  storeId: string,
  brandName: string
): Promise<VectorBrandConfig> {
  const path = `stores/${storeId}/vectorConfig/settings`;
  try {
    const snap = await getDoc(doc(db, 'stores', storeId, 'vectorConfig', 'settings'));
    if (!snap.exists()) {
      return defaultVectorBrandConfig(storeId, brandName);
    }
    const raw = snap.data() as Record<string, unknown>;
    const palancasStr = typeof raw.palancasSummary === 'string' ? raw.palancasSummary : '';
    const palancasActivas = palancasStr
      ? (palancasStr.split(',').filter(Boolean) as VectorInfluenceLever[])
      : defaultVectorBrandConfig(storeId, brandName).palancasActivas;
    return {
      ...defaultVectorBrandConfig(storeId, brandName),
      ...(raw as unknown as VectorBrandConfig),
      palancasActivas,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export function subscribeVectorBrandConfig(
  storeId: string,
  brandName: string,
  onChange: (cfg: VectorBrandConfig) => void
): Unsubscribe {
  const path = `stores/${storeId}/vectorConfig/settings`;
  return onSnapshot(
    doc(db, 'stores', storeId, 'vectorConfig', 'settings'),
    (snap) => {
      if (!snap.exists()) {
        onChange(defaultVectorBrandConfig(storeId, brandName));
        return;
      }
      const raw = snap.data() as Record<string, unknown>;
      const palancasStr = typeof raw.palancasSummary === 'string' ? raw.palancasSummary : '';
      const palancasActivas = palancasStr
        ? (palancasStr.split(',').filter(Boolean) as VectorInfluenceLever[])
        : defaultVectorBrandConfig(storeId, brandName).palancasActivas;
      onChange({
        ...defaultVectorBrandConfig(storeId, brandName),
        ...(raw as unknown as VectorBrandConfig),
        palancasActivas,
      });
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function saveVectorBrandConfig(config: VectorBrandConfig): Promise<void> {
  const path = `stores/${config.storeId}/vectorConfig/settings`;
  try {
    await setDoc(doc(db, 'stores', config.storeId, 'vectorConfig', 'settings'), {
      storeId: config.storeId,
      brandName: config.brandName.trim().slice(0, 100),
      idiomaPrincipal: config.idiomaPrincipal,
      tratamientoEs: config.tratamientoEs,
      tratamientoZh: config.tratamientoZh || '您',
      emojiMax: config.emojiMax === 1 ? 1 : 0,
      politicaEnvios: (config.politicaEnvios || '').slice(0, 600),
      politicaDevoluciones: (config.politicaDevoluciones || '').slice(0, 600),
      slaHumano: (config.slaHumano || '24 h hábiles').slice(0, 80),
      horarioAtencion: (config.horarioAtencion || 'L-S 08:00-18:00').slice(0, 100),
      zonaHoraria: (config.zonaHoraria || 'UTC-4').slice(0, 40),
      slaCriticaMin: Number(config.slaCriticaMin || 15),
      slaAltaMin: Number(config.slaAltaMin || 60),
      slaMediaMin: Number(config.slaMediaMin || 240),
      nivel1Cola: (config.nivel1Cola || `Soporte ${config.brandName}`).slice(0, 100),
      nivel2Cobros: (config.nivel2Cobros || 'Cobranzas').slice(0, 100),
      nivel2Logistica: (config.nivel2Logistica || 'Logística').slice(0, 100),
      nivel3Supervisor: (config.nivel3Supervisor || 'Supervisor').slice(0, 100),
      nivel4Admin: 'Carlos Smith Zambrano Gonzalez',
      autoEscalarPorVencimiento: Boolean(config.autoEscalarPorVencimiento),
      maxIntentosBot: Math.min(5, Math.max(1, Number(config.maxIntentosBot || 3))),
      canalOfertas: config.canalOfertas || 'ambos',
      frecuenciaMaximaSemanal: Math.min(14, Math.max(0, Number(config.frecuenciaMaximaSemanal ?? 2))),
      palancasSummary: (config.palancasActivas || []).join(',').slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function upsertVectorConsent(params: {
  user: User;
  storeId: string;
  storeName: string;
  storeOwnerUid: string;
  scope: 'buyer_offers' | 'merchant_campaigns';
  status: 'si' | 'no' | 'solo_importante';
  channel: 'web_chat' | 'whatsapp' | 'email' | 'portal';
}): Promise<void> {
  const docId = `${params.storeId}_${params.user.uid}_${params.scope}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `vectorConsents/${docId}`;
  try {
    await setDoc(doc(db, 'vectorConsents', docId), {
      id: docId,
      userUid: params.user.uid,
      userEmail: (params.user.email || '').slice(0, 160),
      storeId: params.storeId,
      storeName: params.storeName.slice(0, 100),
      storeOwnerUid: params.storeOwnerUid,
      scope: params.scope,
      status: params.status,
      channel: params.channel,
      hardBounced: false,
      recentComplaint: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserVectorConsents(
  userUid: string,
  onChange: (list: VectorConsentRecord[]) => void
): Unsubscribe {
  const path = 'vectorConsents';
  const q = query(collection(db, path), where('userUid', '==', userUid));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as VectorConsentRecord));
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAllVectorConsentsForAdmin(
  onChange: (list: VectorConsentRecord[]) => void
): Unsubscribe {
  const path = 'vectorConsents';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as VectorConsentRecord));
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createOrUpdateVectorTicket(params: {
  user: User;
  storeId: string;
  storeName: string;
  storeOwnerUid: string;
  channel: 'web_chat' | 'whatsapp' | 'instagram' | 'email';
  language: VectorLanguage;
  trigger: VectorTriggerDefinition;
  summary: string;
  botAttempts: number;
  lastProposal: string;
  orderRef?: string;
  evidence?: string;
  offerConsent: VectorConsentStatus;
  risk: VectorRiskType;
  threadId: string;
}): Promise<{ ticket: VectorTicket; updatedExisting: boolean }> {
  const path = 'vectorTickets';
  try {
    // §1 Regla 4 & §12 QA #14: Check if there is already an open ticket for this user + storeId — update instead of duplicate!
    const existingQuery = query(
      collection(db, path),
      where('requesterUid', '==', params.user.uid)
    );
    const existingSnap = await getDocs(existingQuery);
    const openMatch = existingSnap.docs
      .map((d) => d.data() as VectorTicket)
      .find((t) => t.storeId === params.storeId && t.status !== 'resolved');

    if (openMatch) {
      const mergedSummary = `${openMatch.summary} | Actualización: ${params.summary}`.slice(0, 580);
      const updatedPacket = buildEscalationHandoffPacket({
        ticketNumber: openMatch.ticketNumber,
        brandName: openMatch.storeName,
        customerName: openMatch.customerName,
        requesterUid: openMatch.requesterUid,
        customerContact: openMatch.customerContact,
        channel: openMatch.channel,
        language: params.language,
        triggerLabel: params.trigger.labelEs,
        level: openMatch.level,
        priority: openMatch.priority,
        summary: mergedSummary,
        botAttempts: params.botAttempts,
        lastProposal: params.lastProposal,
        orderRef: params.orderRef || openMatch.orderRef,
        evidence: params.evidence || openMatch.evidence,
        requiredHumanAction: openMatch.requiredHumanAction,
        clientCommitment: openMatch.clientCommitment,
        offerConsent: params.offerConsent,
        risk: params.risk,
        threadId: params.threadId,
      });

      await updateDoc(doc(db, path, openMatch.id), {
        summary: mergedSummary,
        lastProposal: params.lastProposal.slice(0, 400),
        handoffPacket: updatedPacket.slice(0, 1950),
        updatedAt: serverTimestamp(),
      });

      return {
        ticket: { ...openMatch, summary: mergedSummary, handoffPacket: updatedPacket },
        updatedExisting: true,
      };
    }

    const id = makeSafeDocId('vtkt');
    const ticketNumber = `VEC-${Date.now().toString().slice(-6)}`;
    const clientCommitment = `Confirmado canal ${params.channel} con SLA ${params.trigger.firstContactLabel}`;
    const requiredHumanAction = `Atender ${params.trigger.labelEs} (${params.trigger.level})`;

    const handoffPacket = buildEscalationHandoffPacket({
      ticketNumber,
      brandName: params.storeName,
      customerName: params.user.displayName || 'Cliente',
      requesterUid: params.user.uid,
      customerContact: params.user.email || 'no disponible',
      channel: params.channel,
      language: params.language,
      triggerLabel: params.trigger.labelEs,
      level: params.trigger.level,
      priority: params.trigger.priority,
      summary: params.summary.slice(0, 350),
      botAttempts: params.botAttempts,
      lastProposal: params.lastProposal,
      orderRef: params.orderRef,
      evidence: params.evidence,
      requiredHumanAction,
      clientCommitment,
      offerConsent: params.offerConsent,
      risk: params.risk,
      threadId: params.threadId,
    });

    const adminReport = params.trigger.requiresAdminReport
      ? buildAdminReportText({
          brandName: params.storeName,
          customerLabel: params.user.displayName || params.user.email || params.user.uid,
          channel: params.channel,
          motivo: params.trigger.reportMotivo,
          priority: params.trigger.priority === 'critica' || params.trigger.priority === 'alta' ? 'alta' : 'media',
          summary: params.summary.slice(0, 280),
          orderRef: params.orderRef,
          requiredAction: requiredHumanAction,
          offerConsent: params.offerConsent,
        })
      : '';

    const dueAtMs = Date.now() + params.trigger.slaMinutes * 60 * 1000;

    const payload: Record<string, unknown> = {
      id,
      ticketNumber,
      storeId: params.storeId,
      storeName: params.storeName.slice(0, 100),
      storeOwnerUid: params.storeOwnerUid,
      requesterUid: params.user.uid,
      customerName: (params.user.displayName || 'Cliente').slice(0, 100),
      customerContact: (params.user.email || 'no disponible').slice(0, 160),
      channel: params.channel,
      language: params.language,
      triggerId: params.trigger.id,
      triggerMotivo: params.trigger.labelEs.slice(0, 120),
      level: params.trigger.level,
      priority: params.trigger.priority,
      slaMinutes: params.trigger.slaMinutes,
      summary: params.summary.slice(0, 600),
      botAttempts: params.botAttempts,
      lastProposal: params.lastProposal.slice(0, 400),
      orderRef: (params.orderRef || 'no disponible').slice(0, 80),
      evidence: (params.evidence || 'no disponible').slice(0, 400),
      requiredHumanAction: requiredHumanAction.slice(0, 300),
      clientCommitment: clientCommitment.slice(0, 300),
      offerConsent: params.offerConsent,
      risk: params.risk,
      threadId: params.threadId.slice(0, 120),
      status: 'open',
      handoffPacket: handoffPacket.slice(0, 1950),
      reEscalatedCount: 0,
      contextLeakReported: false,
      dueAtMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (adminReport) {
      payload.adminReport = adminReport.slice(0, 1450);
    }

    await setDoc(doc(db, path, id), payload);
    return {
      ticket: {
        ...(payload as unknown as VectorTicket),
      },
      updatedExisting: false,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateVectorTicketStatus(
  ticket: VectorTicket,
  updates: {
    status?: VectorTicket['status'];
    level?: VectorEscalationLevel;
    priority?: VectorPriority;
    reEscalatedCount?: number;
    contextLeakReported?: boolean;
    csatScore?: number;
    dueAtMs?: number;
  }
): Promise<void> {
  const path = `vectorTickets/${ticket.id}`;
  try {
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.status !== undefined) cleanUpdates.status = updates.status;
    if (updates.level !== undefined) cleanUpdates.level = updates.level;
    if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
    if (updates.reEscalatedCount !== undefined) cleanUpdates.reEscalatedCount = updates.reEscalatedCount;
    if (updates.contextLeakReported !== undefined) cleanUpdates.contextLeakReported = updates.contextLeakReported;
    if (updates.csatScore !== undefined) cleanUpdates.csatScore = updates.csatScore;
    if (updates.dueAtMs !== undefined) cleanUpdates.dueAtMs = updates.dueAtMs;

    await updateDoc(doc(db, 'vectorTickets', ticket.id), cleanUpdates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function autoEscalateExpiredTickets(tickets: VectorTicket[]): Promise<number> {
  const now = Date.now();
  const nextLevelMap: Record<VectorEscalationLevel, VectorEscalationLevel> = {
    N0: 'N1',
    N1: 'N2',
    N2: 'N3',
    N3: 'N4',
    N4: 'N4',
  };

  let upgraded = 0;
  for (const t of tickets) {
    if (t.status === 'resolved') continue;
    if (t.level === 'N4') continue;
    if (t.dueAtMs > 0 && now > t.dueAtMs) {
      const nextLvl = nextLevelMap[t.level];
      await updateVectorTicketStatus(t, {
        level: nextLvl,
        status: 'escalated',
        reEscalatedCount: (t.reEscalatedCount || 0) + 1,
        dueAtMs: now + 15 * 60 * 1000,
      });
      upgraded += 1;
    }
  }
  return upgraded;
}

export function subscribeOwnerVectorTickets(
  ownerUid: string,
  onChange: (tickets: VectorTicket[]) => void
): Unsubscribe {
  const path = 'vectorTickets';
  const q = query(collection(db, path), where('storeOwnerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as VectorTicket)
        .sort((a, b) => (b.dueAtMs || 0) - (a.dueAtMs || 0));
      onChange(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeUserVectorTickets(
  userUid: string,
  onChange: (tickets: VectorTicket[]) => void
): Unsubscribe {
  const path = 'vectorTickets';
  const q = query(collection(db, path), where('requesterUid', '==', userUid));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as VectorTicket));
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAllVectorTicketsForAdmin(
  onChange: (tickets: VectorTicket[]) => void
): Unsubscribe {
  const path = 'vectorTickets';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as VectorTicket)
        .sort((a, b) => (b.dueAtMs || 0) - (a.dueAtMs || 0));
      onChange(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

// Conversation stats for Section 10 Metrics
export async function recordVectorConversationStat(params: {
  user: User;
  storeId: string;
  storeOwnerUid: string;
  language: VectorLanguage;
  turnsCount: number;
  botAttemptsOnIssue: number;
  containedByBot: boolean;
  escalated: boolean;
  triggerId?: number;
}): Promise<string> {
  const id = makeSafeDocId('vstat');
  const path = `vectorConversationStats/${id}`;
  try {
    await setDoc(doc(db, 'vectorConversationStats', id), {
      id,
      storeId: params.storeId,
      storeOwnerUid: params.storeOwnerUid,
      userUid: params.user.uid,
      language: params.language,
      turnsCount: params.turnsCount,
      botAttemptsOnIssue: params.botAttemptsOnIssue,
      containedByBot: params.containedByBot,
      escalated: params.escalated,
      escalationAccurate: true,
      triggerId: params.triggerId || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeAdminVectorStats(
  onChange: (stats: VectorConversationStat[]) => void
): Unsubscribe {
  const path = 'vectorConversationStats';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as VectorConversationStat));
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

// Section 4: Admin Campaigns to Store Owners
export function buildFallbackCampaignVariants(params: {
  title: string;
  realOffer: string;
  validUntil: string;
  objective: string;
}): VectorCampaignVariant[] {
  const { title, realOffer, validUntil, objective } = params;
  return [
    {
      lang: 'es',
      variantLabel: 'A',
      subject: `${title} · Actualización para su tienda`,
      body: `Asunto: ${title} · Actualización para su tienda\n\nEstimado titular de {{storeName}}, su catálogo activo puede aprovechar ${realOffer} para impulsar ${objective}.\n\nVigencia confirmada hasta ${validUntil}. Puede aplicarlo desde Mi Tienda SaaS. Si no desea recibir avisos comerciales, use el enlace de baja: {{unsubscribeLink}}`,
    },
    {
      lang: 'es',
      variantLabel: 'B',
      subject: `Recomendación comercial para {{storeName}} (hasta ${validUntil})`,
      body: `Asunto: Recomendación comercial para {{storeName}}\n\nSegún el estado de {{storeName}} en Smith Solutions E-Commerce, tiene disponible: ${realOffer}. Recomendamos revisar su inventario hoy.\n\nVálido hasta ${validUntil}. Gestione su suscripción en Mi Tienda SaaS. Darse de baja: {{unsubscribeLink}}`,
    },
    {
      lang: 'en',
      variantLabel: 'A',
      subject: `${title} · Verified update for {{storeName}}`,
      body: `Subject: ${title} · Verified update for {{storeName}}\n\nHello {{storeName}} owner, your storefront qualifies for ${realOffer} to support ${objective}.\n\nValid through ${validUntil}. Manage directly in My SaaS Store. Unsubscribe: {{unsubscribeLink}}`,
    },
    {
      lang: 'zh',
      variantLabel: 'A',
      subject: `{{storeName}} 店铺运营建议 · 有效期至 ${validUntil}`,
      body: `主题：{{storeName}} 店铺运营建议\n\n您好，根据 {{storeName}} 在平台上的当前数据，您可使用以下真实方案：${realOffer}（目标：${objective}）。\n\n有效期至 ${validUntil}。请登录我的店铺面板操作。退订链接：{{unsubscribeLink}}`,
    },
  ];
}

export async function generateCampaignDraftWithAI(params: {
  adminUser: User;
  title: string;
  segment: VectorCampaign['segment'];
  objective: string;
  realOffer: string;
  validUntil: string;
  primaryLanguage: VectorLanguage;
  sampleStoreData?: string;
}): Promise<VectorCampaignVariant[]> {
  if (!isSuperAdminUser(params.adminUser)) {
    throw new Error('Necesito validar tu acceso por el canal seguro antes de continuar.');
  }

  try {
    const idToken = await params.adminUser.getIdToken();
    const resp = await fetch('/api/vector/campaign-draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        title: params.title,
        segment: params.segment,
        objective: params.objective,
        realOffer: params.realOffer,
        validUntil: params.validUntil,
        primaryLanguage: params.primaryLanguage,
        sampleStoreData: params.sampleStoreData,
      }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        ok?: boolean;
        variants?: VectorCampaignVariant[];
      };
      if (data.ok && Array.isArray(data.variants) && data.variants.length > 0) {
        return data.variants;
      }
    }
  } catch {
    // fallback if running static GitHub Pages without Node backend
  }

  return buildFallbackCampaignVariants(params);
}

export async function saveVectorCampaignDraft(params: {
  adminUser: User;
  title: string;
  segment: VectorCampaign['segment'];
  objective: string;
  realOffer: string;
  validUntil: string;
  primaryLanguage: VectorLanguage;
  variants: VectorCampaignVariant[];
}): Promise<VectorCampaign> {
  if (!isSuperAdminUser(params.adminUser)) {
    throw new Error('Acceso restringido al Super Admin verificado.');
  }
  const id = makeSafeDocId('vcamp');
  const path = `vectorCampaigns/${id}`;
  try {
    const docData = {
      id,
      title: params.title.trim().slice(0, 140),
      segment: params.segment,
      objective: params.objective.trim().slice(0, 300),
      realOffer: params.realOffer.trim().slice(0, 300),
      validUntil: params.validUntil.trim().slice(0, 40),
      primaryLanguage: params.primaryLanguage,
      variantsJson: JSON.stringify(params.variants).slice(0, 11800),
      approvedByAdmin: false,
      status: 'draft' as const,
      sentCount: 0,
      excludedCount: 0,
      openCount: 0,
      clickCount: 0,
      attributedSalesCount: 0,
      optOutCount: 0,
      bounceCount: 0,
      createdByEmail: params.adminUser.email || SUPER_ADMIN_EMAIL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'vectorCampaigns', id), docData);
    return {
      ...docData,
      variants: params.variants,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeVectorCampaigns(
  onChange: (campaigns: VectorCampaign[]) => void
): Unsubscribe {
  const path = 'vectorCampaigns';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        let variants: VectorCampaignVariant[] = [];
        try {
          if (typeof raw.variantsJson === 'string') {
            variants = JSON.parse(raw.variantsJson) as VectorCampaignVariant[];
          }
        } catch {
          variants = [];
        }
        return {
          ...(raw as unknown as VectorCampaign),
          variants,
        };
      });
      onChange(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function approveAndDispatchVectorCampaign(params: {
  adminUser: User;
  campaign: VectorCampaign;
  stores: StoreTenant[];
  consents: VectorConsentRecord[];
  ownerEmailMap: Record<string, string>;
}): Promise<{ sentCount: number; excludedCount: number; optOutAlertTriggered: boolean }> {
  if (!isSuperAdminUser(params.adminUser)) {
    throw new Error('Solo el Super Admin verificado puede aprobar y despachar campañas.');
  }

  const candidateStores = params.stores.filter((s) => {
    if (params.campaign.segment === 'all') return true;
    if (params.campaign.segment === 'active') return s.status === 'active';
    if (params.campaign.segment === 'pending') return s.status === 'pending';
    if (params.campaign.segment === 'low_activity') return s.status !== 'active';
    return true;
  });

  const eligibleStores: StoreTenant[] = [];
  let excludedCount = 0;

  for (const st of candidateStores) {
    const consentRec = params.consents.find(
      (c) => c.storeId === st.id && c.scope === 'merchant_campaigns'
    );
    const hasOptOut = consentRec?.status === 'no';
    const hasBounceOrComplaint = Boolean(consentRec?.hardBounced || consentRec?.recentComplaint);
    if (hasOptOut || hasBounceOrComplaint) {
      excludedCount += 1;
      continue;
    }
    eligibleStores.push(st);
  }

  const chosenVariant =
    params.campaign.variants.find((v) => v.lang === params.campaign.primaryLanguage) ||
    params.campaign.variants[0] ||
    buildFallbackCampaignVariants({
      title: params.campaign.title,
      realOffer: params.campaign.realOffer,
      validUntil: params.campaign.validUntil,
      objective: params.campaign.objective,
    })[0];

  // Dispatch personalized 3-block messages to each eligible store's official inbox
  const batch = writeBatch(db);
  for (const st of eligibleStores) {
    const msgId = makeSafeDocId('vmsg');
    const unsubscribeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/mi-tienda?vectorUnsubscribe=${st.id}`;
    const subject = chosenVariant.subject
      .replace(/\{\{storeName\}\}/g, st.storeName)
      .slice(0, 175);
    const body = chosenVariant.body
      .replace(/\{\{storeName\}\}/g, st.storeName)
      .replace(/\{\{unsubscribeLink\}\}/g, unsubscribeUrl)
      .slice(0, 4900);

    batch.set(doc(db, 'stores', st.id, 'inbox', msgId), {
      id: msgId,
      storeId: st.id,
      storeOwnerUid: st.ownerUid,
      subject,
      body,
      senderEmail: params.adminUser.email || SUPER_ADMIN_EMAIL,
      category: 'admin_email',
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  const optOutCount = candidateStores.filter((st) =>
    params.consents.some(
      (c) => c.storeId === st.id && c.scope === 'merchant_campaigns' && c.status === 'no'
    )
  ).length;

  batch.update(doc(db, 'vectorCampaigns', params.campaign.id), {
    approvedByAdmin: true,
    approvedAtIso: new Date().toISOString().slice(0, 32),
    status: 'sent',
    sentCount: eligibleStores.length,
    excludedCount,
    optOutCount,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `vectorCampaigns/${params.campaign.id}`);
  }

  const totalRateBase = Math.max(1, eligibleStores.length + optOutCount);
  const optOutPct = (optOutCount / totalRateBase) * 100;

  return {
    sentCount: eligibleStores.length,
    excludedCount,
    optOutAlertTriggered: optOutPct > 2,
  };
}

export function computeVectorControlMetrics(
  stats: VectorConversationStat[],
  tickets: VectorTicket[]
) {
  const totalConv = stats.length;
  const escalatedCount = stats.filter((s) => s.escalated).length;
  const containedCount = stats.filter((s) => s.containedByBot && !s.escalated).length;
  const accurateCount = stats.filter((s) => s.escalated && s.escalationAccurate !== false).length;

  const escalationRate = totalConv > 0 ? Math.round((escalatedCount / totalConv) * 100) : 0;
  const containmentRate = totalConv > 0 ? Math.round((containedCount / totalConv) * 100) : 100;
  const precisionRate =
    escalatedCount > 0 ? Math.round((accurateCount / escalatedCount) * 100) : 100;

  const now = Date.now();
  const slaEligible = tickets.length;
  const slaCompliant = tickets.filter((t) =>
    t.status === 'resolved' ? true : !t.dueAtMs || now <= t.dueAtMs
  ).length;
  const slaComplianceRate =
    slaEligible > 0 ? Math.round((slaCompliant / slaEligible) * 100) : 100;

  const reEscalated = tickets.filter((t) => (t.reEscalatedCount || 0) > 0).length;
  const reEscalationRate =
    slaEligible > 0 ? Math.round((reEscalated / slaEligible) * 100) : 0;

  const ratedTickets = tickets.filter((t) => typeof t.csatScore === 'number' && t.csatScore > 0);
  const avgCsat =
    ratedTickets.length > 0
      ? Number(
          (
            ratedTickets.reduce((acc, t) => acc + (t.csatScore || 0), 0) / ratedTickets.length
          ).toFixed(2)
        )
      : 5.0;

  const contextLeaks = tickets.filter((t) => Boolean(t.contextLeakReported)).length;
  const contextLeakRate =
    slaEligible > 0 ? Math.round((contextLeaks / slaEligible) * 100) : 0;

  // Admin alerts from §10: SLA < 90% or same trigger >= 5 in 24h
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const triggerCountsToday: Record<number, number> = {};
  tickets.forEach((t) => {
    if ((t.dueAtMs || now) >= oneDayAgo) {
      triggerCountsToday[t.triggerId] = (triggerCountsToday[t.triggerId] || 0) + 1;
    }
  });
  const repeatedTriggerAlert = Object.entries(triggerCountsToday).find(([, count]) => count >= 5);

  return {
    totalConv,
    totalTickets: tickets.length,
    escalationRate,
    precisionRate,
    containmentRate,
    slaComplianceRate,
    reEscalationRate,
    avgCsat,
    contextLeakRate,
    lowSlaAlert: slaEligible > 0 && slaComplianceRate < 90,
    repeatedTriggerAlert: repeatedTriggerAlert ? Number(repeatedTriggerAlert[0]) : null,
  };
}

export async function sendVectorChat(params: {
  message: string;
  language: VectorLanguage;
  voiceMode?: boolean;
  brandConfig: VectorBrandConfig;
  products: StoreProduct[];
  exchangeRate: number;
  cartCount: number;
  cartTotalUSD: number;
  cartRemindersSent: number;
  offerConsent: VectorConsentStatus;
  botAttemptsOnIssue: number;
  hasOpenTicket: boolean;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  user: User | null;
  userRole?: UserPlatformRole;
  currentView?: string;
  hasOwnedStore?: boolean;
  ownedStoreStatus?: StoreStatus;
  ownedStoreName?: string;
}): Promise<DeterministicVectorReply> {
  const isVerifiedAdmin = isSuperAdminUser(params.user);
  const isAuthenticated = Boolean(params.user && params.user.emailVerified);

  // Security check first
  const claimsAdmin =
    /carlos\s+smith|zambrano\s+gonzalez|soy\s+el\s+admin|i\s+am\s+the\s+admin|我是管理员/i.test(
      params.message
    );
  if (claimsAdmin && !isVerifiedAdmin) {
    return {
      reply:
        params.language === 'en'
          ? 'I need to validate your access through the secure Admin channel before continuing.'
          : params.language === 'zh'
            ? '在继续之前，我需要通过安全的管理员验证通道核实您的访问权限。'
            : 'Necesito validar tu acceso por el canal seguro antes de continuar.',
      detectedLanguage: params.language,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: 9,
      blockedSecurityNotice: true,
    };
  }

  // Deterministic escalation guard (takes priority over LLM so all 16 triggers & "human immediately" obey strictly)
  const triggerHit = detectEscalationTrigger(params.message, params.botAttemptsOnIssue);
  if (triggerHit) {
    return {
      reply: buildCustomerEscalationNotice({
        language: params.language,
        trigger: triggerHit.trigger,
        level: triggerHit.trigger.level,
        channel: 'Chat Web / Correo',
        slaLabel: triggerHit.trigger.firstContactLabel,
      }),
      detectedLanguage: params.language,
      leversUsed: [],
      leverEvidence: [],
      recommendedProductIds: [],
      consentIntent: 'none',
      triggerId: triggerHit.trigger.id,
    };
  }

  try {
    const idToken = params.user ? await params.user.getIdToken() : '';
    const resp = await fetch('/api/vector/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        message: params.message,
        language: params.language,
        voiceMode: Boolean(params.voiceMode),
        storeId: params.brandConfig.storeId,
        userRole: params.userRole || 'buyer',
        currentView: params.currentView || 'landing',
        isAuthenticated,
        hasOwnedStore: Boolean(params.hasOwnedStore),
        ownedStoreStatus: params.ownedStoreStatus,
        brandConfig: params.brandConfig,
        products: params.products.filter((p) => p.isActive).slice(0, 30),
        exchangeRate: params.exchangeRate,
        cartCount: params.cartCount,
        cartTotalUSD: params.cartTotalUSD,
        offerConsent: params.offerConsent,
        botAttempts: params.botAttemptsOnIssue,
        history: params.history.slice(-8),
      }),
    });

    if (resp.ok) {
      const data = (await resp.json()) as {
        ok?: boolean;
        fallbackRequired?: boolean;
        reply?: string;
        detectedLanguage?: VectorLanguage;
        leversUsed?: VectorInfluenceLever[];
        leverEvidence?: string[];
        recommendedProductIds?: string[];
        suggestedActionType?: 'none' | VectorSuggestedActionType;
        consentIntent?: 'si' | 'no' | 'solo_importante' | 'none';
        triggerId?: number;
      };
      if (data.ok && data.reply && !data.fallbackRequired) {
        const resolvedLang = data.detectedLanguage || params.language;
        return {
          reply: data.reply,
          detectedLanguage: resolvedLang,
          leversUsed: (data.leversUsed || []) as VectorInfluenceLever[],
          leverEvidence: data.leverEvidence || [],
          recommendedProductIds: data.recommendedProductIds || [],
          suggestedActions: buildVectorSuggestedAction(resolvedLang, data.suggestedActionType),
          consentIntent: data.consentIntent || 'none',
          triggerId: data.triggerId || 0,
        };
      }
    }
  } catch {
    // Fallback cleanly if API route is offline (e.g. static GitHub Pages)
  }

  return runVectorDeterministicFallback({
    message: params.message,
    currentLanguage: params.language,
    brandConfig: params.brandConfig,
    products: params.products,
    exchangeRate: params.exchangeRate,
    cartCount: params.cartCount,
    cartRemindersSent: params.cartRemindersSent,
    isVerifiedAdmin,
    botAttemptsOnIssue: params.botAttemptsOnIssue,
    hasOpenTicket: params.hasOpenTicket,
    offerConsent: params.offerConsent,
    voiceMode: params.voiceMode,
    userRole: params.userRole,
    isAuthenticated,
    hasOwnedStore: params.hasOwnedStore,
    ownedStoreStatus: params.ownedStoreStatus,
    ownedStoreName: params.ownedStoreName,
  });
}

export function getAuthUidSafe(): string {
  return auth.currentUser?.uid || '';
}

export async function requestVectorTTSAudio(params: {
  text: string;
  language: VectorLanguage;
  voiceName?: 'Charon' | 'Fenrir' | 'Kore' | 'Puck' | 'Zephyr';
}): Promise<{ ok: boolean; audioBase64?: string; mimeType?: string; offlineOrUnavailable?: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, offlineOrUnavailable: true };
  }
  try {
    const resp = await fetch('/api/vector/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: params.text,
        language: params.language,
        voiceName: params.voiceName || 'Charon',
      }),
    });
    if (!resp.ok) {
      return { ok: false, offlineOrUnavailable: true };
    }
    const data = (await resp.json()) as {
      ok?: boolean;
      audioBase64?: string;
      mimeType?: string;
    };
    if (data.ok && data.audioBase64) {
      return {
        ok: true,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
      };
    }
    return { ok: false, offlineOrUnavailable: true };
  } catch {
    return { ok: false, offlineOrUnavailable: true };
  }
}

