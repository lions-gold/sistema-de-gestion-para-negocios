import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  Compass,
  Save,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import {
  StoreTenant,
  VectorBrandConfig,
  VectorConsentRecord,
  VectorInfluenceLever,
  VectorLanguage,
  VectorTicket,
} from '../types';
import {
  defaultVectorBrandConfig,
  saveVectorBrandConfig,
  subscribeOwnerVectorTickets,
  subscribeUserVectorConsents,
  subscribeVectorBrandConfig,
  updateVectorTicketStatus,
  upsertVectorConsent,
  VECTOR_LEVER_METADATA,
} from '../services/vectorService';
import { useLanguage } from '../i18n/LanguageContext';
import { translateTicketPriorityLabel } from '../utils/platformLabelsI18n';

interface MerchantVectorTabProps {
  user: User;
  store: StoreTenant;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

const LEVER_I18N: Record<
  VectorInfluenceLever,
  {
    label: { es: string; en: string; zh: string };
    rule: { es: string; en: string; zh: string };
  }
> = {
  reciprocidad: {
    label: { es: 'Reciprocidad verificable', en: 'Verifiable reciprocity', zh: '可验证互惠' },
    rule: {
      es: 'Solo diagnósticos o datos útiles reales antes de sugerir acción.',
      en: 'Only verified useful facts or comparisons before suggesting action.',
      zh: '推荐操作前先提供真实诊断或实用数据。',
    },
  },
  escasez_real: {
    label: { es: 'Escasez real', en: 'Real scarcity', zh: '真实库存稀缺' },
    rule: {
      es: 'Solo cuando stock real del sistema sea > 0 y <= 5 unidades.',
      en: 'Only when live inventory is > 0 and <= 5 units.',
      zh: '仅当系统真实库存 > 0 且 <= 5 件时提示。',
    },
  },
  urgencia_real: {
    label: { es: 'Urgencia con fecha real', en: 'Real-date urgency', zh: '真实截止日期紧迫感' },
    rule: {
      es: 'Solo con fecha vigente registrada en campaña o promoción.',
      en: 'Only with an active registered campaign date or dispatch cutoff.',
      zh: '仅结合已登记的有效活动日期或发货截单时间。',
    },
  },
  prueba_social: {
    label: { es: 'Prueba social verificada', en: 'Verified social proof', zh: '已验证口碑评分' },
    rule: {
      es: 'Solo cuando exista calificación >= 4.0 con reseñas reales registradas.',
      en: 'Only when verified store/product ratings >= 4.0 exist.',
      zh: '仅在存在真实评分 >= 4.0 时展示口碑。',
    },
  },
  anclaje: {
    label: { es: 'Anclaje real USD / Bs BCV', en: 'Real price & BCV anchor', zh: '真实双币参考锚定' },
    rule: {
      es: 'Precio verificado del catálogo comparado con tasa oficial BCV en vivo.',
      en: 'Verified catalog USD price paired with live official BCV rate.',
      zh: '基于目录核实美元价与实时 BCV 官方汇率。',
    },
  },
  aversion_perdida: {
    label: { es: 'Aversión a la pérdida real', en: 'Verified loss aversion', zh: '已确认权益保留提醒' },
    rule: {
      es: 'Solo sobre artículos ya guardados en el carrito del cliente (máx 2 avisos).',
      en: 'Only for items already saved in the customer cart (max 2 notices).',
      zh: '仅针对客户购物车内已存商品（最多提醒2次）。',
    },
  },
  personalizacion: {
    label: { es: 'Personalización de preferencias', en: 'Preference personalization', zh: '偏好个性化匹配' },
    rule: {
      es: 'Adapta categoría, entrega o idioma según historial del usuario.',
      en: 'Adapt category, delivery mode, or language to user context.',
      zh: '根据用户记录匹配类别、配送方式与语言。',
    },
  },
  compromiso_pequeno: {
    label: { es: 'Compromiso progresivo simple', en: 'Small progressive step', zh: '渐进式轻量引导' },
    rule: {
      es: 'Ofrece un primer paso claro (ver catálogo o tallas) sin presión.',
      en: 'Offer a clear low-friction first step (browse catalog or sizes) without pressure.',
      zh: '提供清晰无压力的下一步指引（查看目录或尺码）。',
    },
  },
};

export const MerchantVectorTab: React.FC<MerchantVectorTabProps> = ({
  user,
  store,
  onNotify,
  onError,
}) => {
  const { lang, tr } = useLanguage();
  const [config, setConfig] = useState<VectorBrandConfig>(
    defaultVectorBrandConfig(store.id, store.storeName)
  );
  const [tickets, setTickets] = useState<VectorTicket[]>([]);
  const [consents, setConsents] = useState<VectorConsentRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubCfg = subscribeVectorBrandConfig(store.id, store.storeName, setConfig);
    const unsubTkt = subscribeOwnerVectorTickets(user.uid, (list) => {
      setTickets(list.filter((t) => t.storeId === store.id));
    });
    const unsubCons = subscribeUserVectorConsents(user.uid, setConsents);
    return () => {
      unsubCfg();
      unsubTkt();
      unsubCons();
    };
  }, [store.id, store.storeName, user.uid]);

  const merchantConsent = consents.find(
    (c) => c.storeId === store.id && c.scope === 'merchant_campaigns'
  );

  const handleToggleLever = (lever: VectorInfluenceLever) => {
    setConfig((prev) => {
      const exists = prev.palancasActivas.includes(lever);
      return {
        ...prev,
        palancasActivas: exists
          ? prev.palancasActivas.filter((l) => l !== lever)
          : [...prev.palancasActivas, lever],
      };
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveVectorBrandConfig(config);
      onNotify(
        tr(
          `Configuración de Vector guardada para "${store.storeName}".`,
          `Vector configuration saved for "${store.storeName}".`,
          `已保存 "${store.storeName}" 的 Vector 配置。`
        )
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : tr(
              'Error guardando configuración de Vector.',
              'Error saving Vector configuration.',
              '保存 Vector 配置失败。'
            )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCampaignConsent = async (status: 'si' | 'no' | 'solo_importante') => {
    try {
      await upsertVectorConsent({
        user,
        storeId: store.id,
        storeName: store.storeName,
        storeOwnerUid: store.ownerUid,
        scope: 'merchant_campaigns',
        status,
        channel: 'portal',
      });
      onNotify(
        status === 'no'
          ? tr(
              'Opt-out aplicado: esta tienda no recibirá campañas comerciales de Vector.',
              'Opt-out applied: this store will not receive commercial Vector campaigns.',
              '已退订：此店铺将不再接收 Vector 商业推广活动。'
            )
          : tr(
              'Preferencia de campañas comerciales actualizada.',
              'Commercial campaign preference updated.',
              '商业推广偏好设置已更新。'
            )
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : tr(
              'Error actualizando consentimiento.',
              'Error updating consent preference.',
              '更新授权偏好失败。'
            )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign Consent Banner (§4 Opt-In / Opt-Out) */}
      <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{tr('Consentimiento de Campañas Comerciales (Vector §4)', 'Commercial Campaign Consent (Vector §4)', '商业推广授权设置 (Vector §4)')}</span>
          </div>
          <p className="text-xs text-zinc-400">
            {tr(
              'Controla si deseas recibir recomendaciones operativas y campañas aprobadas por el Super Admin para tu tienda.',
              'Control whether you want to receive operational recommendations and Super Admin-approved campaigns for your store.',
              '控制您是否希望接收超级管理员审批的店铺运营建议与商业推广活动。'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['si', 'solo_importante', 'no'] as const).map((status) => {
            const active = (merchantConsent?.status || 'si') === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => handleUpdateCampaignConsent(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? status === 'no'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {status === 'si'
                  ? tr('Sí, recibir', 'Yes, receive', '同意接收')
                  : status === 'solo_importante'
                    ? tr('Solo importantes', 'Important only', '仅接收重要通知')
                    : tr('No recibir (Opt-out)', 'Do not receive (Opt-out)', '拒收（退订）')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 13 Per-Brand Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="p-5 sm:p-6 rounded-xl bg-[#111114] border border-white/[0.08] space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-50 font-display">
                {tr('Configuración Vector por Marca (Sección 13)', 'Per-Brand Vector Configuration (Section 13)', '按品牌配置 Vector（第13节）')}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {tr(
                  `Aislamiento estricto para ${store.storeName}: idioma, tono, SLA real y palancas verificables.`,
                  `Strict brand isolation for ${store.storeName}: language, tone, real SLA, and verifiable levers.`,
                  `${store.storeName} 的严格品牌隔离：语言、语气、真实 SLA 与可验证策略杠杆。`
                )}
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSaving
                ? tr('Guardando...', 'Saving...', '保存中...')
                : tr('Guardar Configuración Vector', 'Save Vector Configuration', '保存 Vector 配置')}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Idioma Principal', 'Primary Language', '主要语言')}</label>
            <select
              value={config.idiomaPrincipal}
              onChange={(e) =>
                setConfig((p) => ({ ...p, idiomaPrincipal: e.target.value as VectorLanguage }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            >
              <option value="es">Español (ES)</option>
              <option value="en">English (EN)</option>
              <option value="zh">简体中文 (ZH)</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Tratamiento en Español', 'Spanish Form of Address', '西班牙语称呼方式')}</label>
            <select
              value={config.tratamientoEs}
              onChange={(e) =>
                setConfig((p) => ({ ...p, tratamientoEs: e.target.value as 'usted' | 'tu' }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            >
              <option value="usted">{tr('Usted (Recomendado alta gama)', 'Formal "Usted" (Recommended)', '尊称 Usted（推荐高端品牌）')}</option>
              <option value="tu">{tr('Tú', 'Informal "Tú"', '亲切称呼 Tú')}</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Emojis Máximos', 'Max Emojis', '最多表情符号数')}</label>
            <select
              value={config.emojiMax}
              onChange={(e) =>
                setConfig((p) => ({ ...p, emojiMax: Number(e.target.value) === 1 ? 1 : 0 }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            >
              <option value={0}>{tr('0 emojis (Por defecto)', '0 emojis (Default)', '0 个表情（默认）')}</option>
              <option value={1}>{tr('1 emoji máximo', '1 emoji max', '最多 1 个表情')}</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Horario y Zona Horaria', 'Hours & Timezone', '营业时间与时区')}</label>
            <input
              type="text"
              value={`${config.horarioAtencion} (${config.zonaHoraria})`}
              onChange={(e) => setConfig((p) => ({ ...p, horarioAtencion: e.target.value }))}
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Política Real de Envíos', 'Real Shipping Policy', '真实配送政策')}</label>
            <textarea
              rows={2}
              value={config.politicaEnvios}
              onChange={(e) => setConfig((p) => ({ ...p, politicaEnvios: e.target.value }))}
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Política Real de Devoluciones', 'Real Return Policy', '真实退换货政策')}</label>
            <textarea
              rows={2}
              value={config.politicaDevoluciones}
              onChange={(e) => setConfig((p) => ({ ...p, politicaDevoluciones: e.target.value }))}
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">{tr('SLA Crítica (min)', 'Critical SLA (min)', '紧急 SLA（分钟）')}</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={config.slaCriticaMin}
              onChange={(e) =>
                setConfig((p) => ({ ...p, slaCriticaMin: Number(e.target.value) || 15 }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('SLA Alta (min)', 'High SLA (min)', '高优先级 SLA（分钟）')}</label>
            <input
              type="number"
              min={1}
              max={2880}
              value={config.slaAltaMin}
              onChange={(e) =>
                setConfig((p) => ({ ...p, slaAltaMin: Number(e.target.value) || 60 }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Intentos Máx. Bot', 'Max Bot Attempts', '机器人最多尝试次数')}</label>
            <input
              type="number"
              min={1}
              max={5}
              value={config.maxIntentosBot}
              onChange={(e) =>
                setConfig((p) => ({ ...p, maxIntentosBot: Number(e.target.value) || 3 }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">{tr('Cola N1 (Marca)', 'N1 Queue (Brand)', 'N1 队列（品牌）')}</label>
            <input
              type="text"
              value={config.nivel1Cola}
              onChange={(e) => setConfig((p) => ({ ...p, nivel1Cola: e.target.value }))}
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            />
          </div>
        </div>

        {/* Influence Levers Selector (§3) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>{tr('Palancas de Influencia Verificables Habilitadas', 'Enabled Verifiable Influence Levers', '已启用的可验证影响策略杠杆')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(VECTOR_LEVER_METADATA) as VectorInfluenceLever[]).map((key) => {
              const checked = config.palancasActivas.includes(key);
              const meta = VECTOR_LEVER_METADATA[key];
              const localized = LEVER_I18N[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleLever(key)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    checked
                      ? 'bg-amber-400/10 border-amber-400/35 text-zinc-100'
                      : 'bg-zinc-950 border-white/[0.06] text-zinc-500'
                  }`}
                >
                  <div className="text-[11px] font-bold flex items-center justify-between">
                    <span>{localized ? localized.label[lang] : meta.labelEs}</span>
                    {checked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">
                    {localized ? localized.rule[lang] : meta.rule}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {/* Store Escalation Tickets Queue (N1-N3) */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#111114] border border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-50">
              {tr(
                `Cola de Tickets Escalados por Vector (${tickets.length})`,
                `Vector Escalated Tickets Queue (${tickets.length})`,
                `Vector 升级工单队列（${tickets.length}）`
              )}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {tr(
                'Casos N1–N3 transferidos con paquete [ESCALAMIENTO] completo para no repetir preguntas al cliente.',
                'N1–N3 cases transferred with complete [ESCALATION] context packet so customers never repeat details.',
                'N1–N3 工单均附带完整上下文交接包，避免客户重复描述问题。'
              )}
            </p>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-6 rounded-lg bg-zinc-950 border border-white/[0.06] text-center text-xs text-zinc-400">
            {tr(
              'No hay casos escalados en esta tienda todavía. Vector está conteniendo las consultas en N0.',
              'No escalated tickets for this store yet. Vector is resolving inquiries at N0.',
              '此店铺暂无升级工单，Vector 正在 N0 级别直接解决咨询。'
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-4 rounded-xl bg-zinc-950 border border-white/[0.08] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-amber-400">{tkt.ticketNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.08] text-zinc-200 font-mono text-[10px]">
                      {tkt.level} · {tr('Prioridad', 'Priority', '优先级')} {translateTicketPriorityLabel(tkt.priority, lang)}
                    </span>
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> SLA {tkt.slaMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={tkt.status}
                      onChange={(e) =>
                        updateVectorTicketStatus(tkt, {
                          status: e.target.value as VectorTicket['status'],
                        })
                      }
                      className="bg-zinc-900 border border-white/[0.1] rounded-lg px-2.5 py-1 text-[11px] text-zinc-200"
                    >
                      <option value="open">{tr('Abierto', 'Open', '待处理')}</option>
                      <option value="in_progress">{tr('En Atención', 'In Progress', '处理中')}</option>
                      <option value="escalated">{tr('Escalado', 'Escalated', '已升级')}</option>
                      <option value="resolved">{tr('Resuelto', 'Resolved', '已解决')}</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-zinc-300">{tkt.summary}</div>
                <div className="p-2.5 rounded-lg bg-[#111114] border border-white/[0.06] text-[10px] font-mono text-zinc-400 break-words">
                  {tkt.handoffPacket}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
