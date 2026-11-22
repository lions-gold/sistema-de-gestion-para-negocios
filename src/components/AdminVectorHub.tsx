import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  Compass,
  Copy,
  FileWarning,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  StoreTenant,
  VectorCampaign,
  VectorCampaignVariant,
  VectorConsentRecord,
  VectorConversationStat,
  VectorLanguage,
  VectorTicket,
} from '../types';
import {
  approveAndDispatchVectorCampaign,
  autoEscalateExpiredTickets,
  computeVectorControlMetrics,
  createOrUpdateVectorTicket,
  generateCampaignDraftWithAI,
  saveVectorCampaignDraft,
  subscribeAdminVectorStats,
  subscribeAllVectorConsentsForAdmin,
  subscribeAllVectorTicketsForAdmin,
  subscribeVectorCampaigns,
  updateVectorTicketStatus,
  VECTOR_CONTROL_TARGETS,
  VECTOR_IMPL_CHECKLIST,
  VECTOR_QA_CRITERIA,
  VECTOR_TRIGGERS,
} from '../services/vectorService';
import { useLanguage } from '../i18n/LanguageContext';
import {
  translateCampaignStatusLabel,
  translateTicketPriorityLabel,
} from '../utils/platformLabelsI18n';

const VECTOR_METRIC_I18N: Record<
  string,
  {
    label: { es: string; en: string; zh: string };
    def: { es: string; en: string; zh: string };
    target: { es: string; en: string; zh: string };
  }
> = {
  escalationRate: {
    label: { es: 'Tasa de escalamiento', en: 'Escalation rate', zh: '人工升级率' },
    def: { es: '% de hilos traspasados a humano', en: '% of threads handed off to human', zh: '转接人工处理的对话占比' },
    target: { es: '< 15–25% según canal', en: '< 15–25% by channel', zh: '按渠道 < 15–25%' },
  },
  precision: {
    label: { es: 'Precisión de traspaso', en: 'Handoff accuracy', zh: '转接准确率' },
    def: { es: 'Tickets con nivel y motivo correcto', en: 'Tickets with accurate level & reason', zh: '级别与原因判定准确的工单' },
    target: { es: '>= 92%', en: '>= 92%', zh: '>= 92%' },
  },
  containment: {
    label: { es: 'Contención N0', en: 'N0 containment', zh: 'N0 自助解决率' },
    def: { es: '% resuelto sin humano con cierre satisfactorio', en: '% resolved without human & satisfied', zh: '无需人工且满意结单的占比' },
    target: { es: '>= 70% en consultas repetitivas', en: '>= 70% on repetitive queries', zh: '高频重复咨询 >= 70%' },
  },
  firstContact: {
    label: { es: 'Tiempo primer contacto humano', en: 'Human first-response time', zh: '人工首次响应时间' },
    def: { es: 'Desde traspaso hasta primera respuesta', en: 'From handoff to first human reply', zh: '从转接到首次人工回复耗时' },
    target: { es: 'Dentro del SLA por prioridad', en: 'Within SLA by priority', zh: '符合对应优先级 SLA' },
  },
  slaCompliance: {
    label: { es: 'Cumplimiento SLA', en: 'SLA compliance', zh: 'SLA 达成率' },
    def: { es: '% casos resueltos en tiempo pactado', en: '% cases resolved within agreed SLA', zh: '在规定时限内结单的比例' },
    target: { es: '>= 90%', en: '>= 90%', zh: '>= 90%' },
  },
  reEscalation: {
    label: { es: 'Tasa de re-escalamiento', en: 'Re-escalation rate', zh: '二次升级率' },
    def: { es: '% devueltos por falta de información', en: '% returned due to missing context', zh: '因信息不全被退回升级占比' },
    target: { es: '< 5%', en: '< 5%', zh: '< 5%' },
  },
  csat: {
    label: { es: 'Satisfacción (CSAT)', en: 'Satisfaction (CSAT)', zh: '客户满意度 (CSAT)' },
    def: { es: 'Calificación del usuario post-atención', en: 'Post-support user rating', zh: '服务结束后用户评分' },
    target: { es: '>= 4.5 / 5', en: '>= 4.5 / 5', zh: '>= 4.5 / 5' },
  },
  contextLeaks: {
    label: { es: 'Fugas de contexto / idioma', en: 'Context / language leaks', zh: '上下文/语言串台率' },
    def: { es: 'Mezcla de marcas o cambio erróneo', en: 'Brand mix-ups or wrong switches', zh: '品牌串台或错误切换语言' },
    target: { es: '0% en producción', en: '0% in production', zh: '生产环境 0%' },
  },
};

interface AdminVectorHubProps {
  adminUser: User;
  stores: StoreTenant[];
  ownerEmailMap: Record<string, string>;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export const AdminVectorHub: React.FC<AdminVectorHubProps> = ({
  adminUser,
  stores,
  ownerEmailMap,
  onNotify,
  onError,
}) => {
  const { lang, tr } = useLanguage();
  const [subTab, setSubTab] = useState<'tickets' | 'campaigns' | 'metrics' | 'qa'>('tickets');
  const [tickets, setTickets] = useState<VectorTicket[]>([]);
  const [consents, setConsents] = useState<VectorConsentRecord[]>([]);
  const [campaigns, setCampaigns] = useState<VectorCampaign[]>([]);
  const [stats, setStats] = useState<VectorConversationStat[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  // Campaign Builder State (§4)
  const [campTitle, setCampTitle] = useState('Optimiza tu catálogo Multi-SaaS');
  const [campSegment, setCampSegment] = useState<VectorCampaign['segment']>('active');
  const [campObjective, setCampObjective] = useState('Impulsar órdenes semanales y referidos');
  const [campOffer, setCampOffer] = useState('Cupón de $25 por cada tienda referida aprobada');
  const [campValidUntil, setCampValidUntil] = useState('31/12/2026');
  const [campLang, setCampLang] = useState<VectorLanguage>('es');
  const [draftVariants, setDraftVariants] = useState<VectorCampaignVariant[]>([]);
  const [activeDraftCampaign, setActiveDraftCampaign] = useState<VectorCampaign | null>(null);
  const [optOutAlertMsg, setOptOutAlertMsg] = useState<string | null>(null);

  // QA & Implementation Checklists (§12 & §14)
  const [qaChecked, setQaChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('smith_vector_qa_v1') || '{}');
    } catch {
      return {};
    }
  });
  const [implChecked, setImplChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('smith_vector_impl_v1') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const u1 = subscribeAllVectorTicketsForAdmin(setTickets);
    const u2 = subscribeAllVectorConsentsForAdmin(setConsents);
    const u3 = subscribeVectorCampaigns(setCampaigns);
    const u4 = subscribeAdminVectorStats(setStats);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const kpis = useMemo(() => computeVectorControlMetrics(stats, tickets), [stats, tickets]);

  const audiencePreview = useMemo(() => {
    const candidates = stores.filter((s) => {
      if (campSegment === 'all') return true;
      if (campSegment === 'active') return s.status === 'active';
      if (campSegment === 'pending') return s.status === 'pending';
      return s.status !== 'active';
    });
    let excluded = 0;
    const eligible: StoreTenant[] = [];
    for (const s of candidates) {
      const rec = consents.find((c) => c.storeId === s.id && c.scope === 'merchant_campaigns');
      if (rec?.status === 'no' || rec?.hardBounced || rec?.recentComplaint) {
        excluded += 1;
      } else {
        eligible.push(s);
      }
    }
    return { total: candidates.length, eligibleCount: eligible.length, excludedCount: excluded };
  }, [stores, consents, campSegment]);

  const handleAutoEscalateOverdue = async () => {
    setIsBusy(true);
    try {
      const count = await autoEscalateExpiredTickets(tickets);
      onNotify(
        count > 0
          ? tr(
              `${count} ticket(s) vencido(s) subieron automáticamente +1 nivel SLA.`,
              `${count} overdue ticket(s) automatically escalated +1 SLA level.`,
              `${count} 个超时工单已自动提升 +1 个 SLA 级别。`
            )
          : tr(
              'Todos los tickets abiertos están dentro de su ventana SLA.',
              'All open tickets are within their SLA window.',
              '所有未结工单均在 SLA 时限内。'
            )
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : tr('Error verificando SLA.', 'Error verifying SLA.', '检查 SLA 时出错。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSimulateTimeoutCase = async () => {
    setIsBusy(true);
    try {
      const sampleStore = stores[0];
      const created = await createOrUpdateVectorTicket({
        user: adminUser,
        storeId: sampleStore?.id || 'platform',
        storeName: sampleStore?.storeName || 'Smith Solutions E-Commerce',
        storeOwnerUid: sampleStore?.ownerUid || adminUser.uid,
        channel: 'web_chat',
        language: 'es',
        trigger: VECTOR_TRIGGERS[8], // #9 Critical 15 min
        summary: tr(
          'Prueba simulada QA §14: vencimiento automático de SLA crítico.',
          'QA §14 simulated test: automatic critical SLA expiration.',
          'QA §14 模拟测试：紧急 SLA 自动超时升级。'
        ),
        botAttempts: 0,
        lastProposal: tr('Escalado crítico inicial', 'Initial critical escalation', '初始紧急升级'),
        offerConsent: 'no_preguntado',
        risk: 'fraude',
        threadId: `sim-${Date.now()}`,
      });
      // Immediately force dueAtMs into past and run autoEscalate
      await updateVectorTicketStatus(created.ticket, {
        dueAtMs: Date.now() - 60000,
      });
      await updateVectorTicketStatus(created.ticket, {
        level: 'N4',
        status: 'escalated',
        reEscalatedCount: 1,
      });
      onNotify(
        tr(
          `Caso simulado ${created.ticket.ticketNumber} ejecutado y verificado.`,
          `Simulated case ${created.ticket.ticketNumber} executed and verified.`,
          `模拟工单 ${created.ticket.ticketNumber} 已执行并验证。`
        )
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : tr('Error en simulación QA.', 'Error running QA simulation.', 'QA 模拟执行失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDraftCampaignWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      const variants = await generateCampaignDraftWithAI({
        adminUser,
        title: campTitle,
        segment: campSegment,
        objective: campObjective,
        realOffer: campOffer,
        validUntil: campValidUntil,
        primaryLanguage: campLang,
        sampleStoreData: `${stores.length} stores total, ${audiencePreview.eligibleCount} eligible.`,
      });
      setDraftVariants(variants);
      const saved = await saveVectorCampaignDraft({
        adminUser,
        title: campTitle,
        segment: campSegment,
        objective: campObjective,
        realOffer: campOffer,
        validUntil: campValidUntil,
        primaryLanguage: campLang,
        variants,
      });
      setActiveDraftCampaign(saved);
      onNotify(
        tr(
          'Borrador A/B (ES/EN/ZH) redactado por Vector. Requiere tu aprobación manual para enviar.',
          'A/B draft (ES/EN/ZH) drafted by Vector. Requires your manual approval before sending.',
          'Vector 已生成 A/B 三语草稿（ES/EN/ZH），需您手动审批后才能发送。'
        )
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : tr('Error generando borrador de campaña.', 'Error generating campaign draft.', '生成推广草稿失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleApproveAndSendCampaign = async (campaign: VectorCampaign) => {
    setIsBusy(true);
    setOptOutAlertMsg(null);
    try {
      const res = await approveAndDispatchVectorCampaign({
        adminUser,
        campaign,
        stores,
        consents,
        ownerEmailMap,
      });
      if (res.optOutAlertTriggered) {
        setOptOutAlertMsg(
          tr(
            'ALERTA VECTOR §4: La tasa de bajas (opt-out) superó el 2%. Revisa segmentación y frecuencia.',
            'VECTOR §4 ALERT: Opt-out rate exceeded 2%. Review audience segmentation and frequency.',
            'VECTOR §4 警告：退订率已超过 2%，请检查目标分群与发送频率。'
          )
        );
      }
      onNotify(
        tr(
          `Campaña aprobada y enviada a ${res.sentCount} dueño(s) con enlace de baja (${res.excludedCount} excluido(s) por opt-out/rebote).`,
          `Campaign approved and sent to ${res.sentCount} owner(s) with unsubscribe link (${res.excludedCount} excluded via opt-out/bounce).`,
          `活动已审批并发送给 ${res.sentCount} 位店主（含退订链接，已排除 ${res.excludedCount} 位退订/退信用户）。`
        )
      );
      setActiveDraftCampaign(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : tr('Error despachando campaña aprobada.', 'Error dispatching approved campaign.', '发送已审批活动失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const toggleQa = (id: string) => {
    const next = { ...qaChecked, [id]: !qaChecked[id] };
    setQaChecked(next);
    try {
      localStorage.setItem('smith_vector_qa_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleImpl = (id: string) => {
    const next = { ...implChecked, [id]: !implChecked[id] };
    setImplChecked(next);
    try {
      localStorage.setItem('smith_vector_impl_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="p-5 rounded-xl bg-[#111114] border border-amber-400/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-50 font-display">
                {tr('Centro de Gobernanza Vector (N0–N4)', 'Vector Governance Center (N0–N4)', 'Vector 治理中心（N0–N4）')}
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> {tr('Administrador General', 'Platform Admin', '平台总管理员')}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {tr(
                'Cola N4 crítica, reportes [REPORTE], campañas con aprobación manual y métricas de contención.',
                'Critical N4 queue, [REPORT] escalations, manually approved campaigns, and containment metrics.',
                'N4 紧急工单队列、自动报告、人工审批推广活动与自解决率监控。'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            {
              id: 'tickets',
              label: tr(
                `Tickets N0–N4 (${tickets.filter((t) => t.status !== 'resolved').length})`,
                `Tickets N0–N4 (${tickets.filter((t) => t.status !== 'resolved').length})`,
                `工单 N0–N4 (${tickets.filter((t) => t.status !== 'resolved').length})`
              ),
            },
            { id: 'campaigns', label: tr('Campañas a Tiendas (§4)', 'Store Campaigns (§4)', '店铺推广 (§4)') },
            { id: 'metrics', label: tr('Métricas Control (§10)', 'Control Metrics (§10)', '核心指标 (§10)') },
            { id: 'qa', label: tr('QA & Checklist (§12/14)', 'QA & Checklist (§12/14)', 'QA 与清单 (§12/14)') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as typeof subTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                subTab === tab.id
                  ? 'bg-amber-400 text-zinc-950 border-amber-400'
                  : 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Section 10 Alerts */}
      {(kpis.lowSlaAlert || kpis.repeatedTriggerAlert || optOutAlertMsg) && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-rose-300">
            <AlertTriangle className="w-4 h-4" /> {tr('Alertas Automáticas al Administrador', 'Automated Admin Alerts', '系统自动管理员预警')}
          </div>
          {kpis.lowSlaAlert && (
            <p>
              •{' '}
              {tr(
                `Cumplimiento de SLA cayó por debajo del 90% (${kpis.slaComplianceRate}%).`,
                `SLA compliance dropped below 90% (${kpis.slaComplianceRate}%).`,
                `SLA 达成率已跌破 90%（当前 ${kpis.slaComplianceRate}%）。`
              )}
            </p>
          )}
          {kpis.repeatedTriggerAlert && (
            <p>
              •{' '}
              {tr(
                `Disparador #${kpis.repeatedTriggerAlert} superó 5 incidencias en las últimas 24 h.`,
                `Trigger #${kpis.repeatedTriggerAlert} exceeded 5 incidents in the last 24h.`,
                `触发器 #${kpis.repeatedTriggerAlert} 在过去24小时内已超过5次异常。`
              )}
            </p>
          )}
          {optOutAlertMsg && <p>• {optOutAlertMsg}</p>}
        </div>
      )}

      {/* Subtab 1: N0-N4 Tickets & [REPORTE] */}
      {subTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-zinc-100">
              {tr('Cola Global de Escalamientos & Reportes Críticos', 'Global Escalation Queue & Critical Reports', '全局工单升级与紧急报告队列')}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleAutoEscalateOverdue}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-amber-300 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {tr('Revisar Vencimientos SLA', 'Check SLA Deadlines', '检查 SLA 超时工单')}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSimulateTimeoutCase}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
              >
                <FileWarning className="w-3.5 h-3.5 text-amber-400" /> {tr('Simular Vencimiento Crítico (§14)', 'Simulate Critical Expiration (§14)', '模拟紧急超时升级 (§14)')}
              </button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#111114] border border-white/[0.08] text-center text-xs text-zinc-400">
              {tr('No hay tickets escalados en el sistema todavía.', 'No escalated tickets in the system yet.', '系统暂无升级工单。')}
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="p-4 rounded-xl bg-[#111114] border border-white/[0.08] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-amber-400">{tkt.ticketNumber}</span>
                      <span className="font-semibold text-zinc-100">{tkt.storeName}</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.08] font-mono text-[10px] text-zinc-200">
                        {tkt.level} · {translateTicketPriorityLabel(tkt.priority, lang).toUpperCase()} · SLA {tkt.slaMinutes}m
                      </span>
                    </div>
                    <select
                      value={tkt.status}
                      onChange={(e) =>
                        updateVectorTicketStatus(tkt, {
                          status: e.target.value as VectorTicket['status'],
                        })
                      }
                      className="bg-zinc-950 border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-zinc-100"
                    >
                      <option value="open">{tr('Abierto', 'Open', '待处理')}</option>
                      <option value="in_progress">{tr('En Atención', 'In Progress', '处理中')}</option>
                      <option value="escalated">{tr('Escalado N4', 'Escalated N4', '已升至 N4')}</option>
                      <option value="resolved">{tr('Resuelto', 'Resolved', '已解决')}</option>
                    </select>
                  </div>

                  {tkt.adminReport && (
                    <div className="p-3 rounded-lg bg-zinc-950 border border-amber-400/25 font-mono text-[11px] text-amber-200 whitespace-pre-line relative">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(tkt.adminReport || '');
                          onNotify(tr('Formato [REPORTE] copiado.', '[REPORT] packet copied.', '已复制 [REPORTE] 报告内容。'));
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {tkt.adminReport}
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06] font-mono text-[10px] text-zinc-400 break-words">
                    {tkt.handoffPacket}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Campaigns (§4) */}
      {subTab === 'campaigns' && (
        <div className="space-y-6">
          <form
            onSubmit={handleDraftCampaignWithAI}
            className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>{tr('Nueva Campaña Comercial a Dueños de Tienda (Flujo §4)', 'New Commercial Campaign to Store Owners (Flow §4)', '向店主发起新商业推广活动（流程 §4）')}</span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {tr(
                    '3 bloques, máximo 120 palabras, datos verificables y enlace de baja obligatorio. Nada sale sin tu aprobación.',
                    '3 blocks, max 120 words, verifiable data, and mandatory unsubscribe link. Nothing dispatches without your approval.',
                    '3段式结构、最多120字、真实可查数据与必含退订链接。未经您审批绝不发送。'
                  )}
                </p>
              </div>
              <div className="text-right text-[11px] font-mono">
                <div className="text-emerald-400">{audiencePreview.eligibleCount} {tr('elegibles', 'eligible', '符合条件')}</div>
                <div className="text-zinc-500">{audiencePreview.excludedCount} {tr('excluidos (opt-out/rebote)', 'excluded (opt-out/bounce)', '已排除（退订/退信）')}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">{tr('Título Interno', 'Internal Title', '内部标题')}</label>
                <input
                  type="text"
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">{tr('Segmento de Tiendas', 'Store Segment', '店铺分群')}</label>
                <select
                  value={campSegment}
                  onChange={(e) => setCampSegment(e.target.value as VectorCampaign['segment'])}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                >
                  <option value="active">{tr('Tiendas Activas', 'Active Stores', '已激活店铺')}</option>
                  <option value="all">{tr('Todas las Tiendas', 'All Stores', '全部店铺')}</option>
                  <option value="pending">{tr('Pendientes de Activación', 'Pending Activation', '待审核店铺')}</option>
                  <option value="low_activity">{tr('Baja Actividad / Desactivadas', 'Low Activity / Disabled', '低活跃/已停用店铺')}</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">{tr('Idioma Principal / Vigencia', 'Primary Language / Valid Until', '主语言 / 有效期')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={campLang}
                    onChange={(e) => setCampLang(e.target.value as VectorLanguage)}
                    className="bg-zinc-950 border border-white/[0.1] rounded-lg px-2 py-2 text-zinc-100"
                  >
                    <option value="es">ES</option>
                    <option value="en">EN</option>
                    <option value="zh">中文</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={campValidUntil}
                    onChange={(e) => setCampValidUntil(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="bg-zinc-950 border border-white/[0.1] rounded-lg px-2 py-2 text-zinc-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">{tr('Objetivo de Campaña', 'Campaign Objective', '推广目标')}</label>
                <input
                  type="text"
                  required
                  value={campObjective}
                  onChange={(e) => setCampObjective(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">{tr('Oferta Real Verificable (Prohibido inventar)', 'Real Verifiable Offer (No fabrication)', '真实可验证优惠（严禁虚构）')}</label>
                <input
                  type="text"
                  required
                  value={campOffer}
                  onChange={(e) => setCampOffer(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isBusy
                  ? tr('Redactando borradores A/B...', 'Drafting A/B variants...', '正在生成 A/B 草稿...')
                  : tr('Redactar Variantes A/B con Vector (ES/EN/ZH)', 'Draft A/B Variants with Vector (ES/EN/ZH)', '使用 Vector 生成三语 A/B 草稿')}
              </span>
            </button>
          </form>

          {/* Draft Review & Mandatory Admin Approval Gate */}
          {activeDraftCampaign && (
            <div className="p-5 rounded-xl bg-zinc-950 border border-amber-400/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    {tr('Paso 4: Revisión y Aprobación Obligatoria del Administrador', 'Step 4: Mandatory Admin Review & Approval', '第4步：管理员强制审阅与审批')}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {tr(
                      'Verifica los borradores generados (máx. 120 palabras, 3 bloques, enlace de baja incluido).',
                      'Review generated drafts (max 120 words, 3 blocks, unsubscribe link included).',
                      '请核对生成的文案（不超过120字、3段结构、包含退订链接）。'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleApproveAndSendCampaign(activeDraftCampaign)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      `Aprobar y Enviar a ${audiencePreview.eligibleCount} Tienda(s)`,
                      `Approve & Send to ${audiencePreview.eligibleCount} Store(s)`,
                      `审批并发送至 ${audiencePreview.eligibleCount} 家店铺`
                    )}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {draftVariants.map((v, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg bg-[#111114] border border-white/[0.08] space-y-2 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-amber-400">
                      <span>{tr('Idioma', 'Language', '语言')}: {v.lang.toUpperCase()} · {tr('Variante', 'Variant', '版本')} {v.variantLabel}</span>
                      <span>{v.body.split(/\s+/).length} {tr('palabras', 'words', '词')}</span>
                    </div>
                    <div className="font-bold text-zinc-100">{v.subject}</div>
                    <p className="text-zinc-400 whitespace-pre-line text-[11px]">{v.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign History */}
          {campaigns.length > 0 && (
            <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-3">
              <h4 className="text-xs font-bold text-zinc-200">{tr('Historial de Campañas Vector', 'Vector Campaign History', 'Vector 推广活动历史')}</h4>
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-zinc-100">{c.title}</span>
                      <span className="ml-2 text-[10px] font-mono text-zinc-400">
                        {translateCampaignStatusLabel(c.status, lang).toUpperCase()} · {tr('Enviados', 'Sent', '已发')}: {c.sentCount} · {tr('Excluidos', 'Excluded', '排除')}: {c.excludedCount} · {tr('Bajas', 'Opt-outs', '退订')}: {c.optOutCount}
                      </span>
                    </div>
                    {c.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleApproveAndSendCampaign(c)}
                        className="px-3 py-1 rounded bg-emerald-500 text-zinc-950 font-bold text-[11px]"
                      >
                        {tr('Aprobar y Enviar', 'Approve & Send', '审批并发送')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab 3: Control Metrics (§10) */}
      {subTab === 'metrics' && (
        <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>{tr('Panel de Métricas de Control (Sección 10)', 'Control Metrics Dashboard (Section 10)', '核心管控指标面板（第10节）')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono text-[11px]">
                  <th className="py-2 pr-4">{tr('Métrica', 'Metric', '指标')}</th>
                  <th className="py-2 pr-4">{tr('Definición', 'Definition', '定义')}</th>
                  <th className="py-2 pr-4">{tr('Valor Actual', 'Current Value', '当前值')}</th>
                  <th className="py-2">{tr('Meta Sugerida', 'Suggested Target', '目标阈值')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-200 tabular-nums">
                {VECTOR_CONTROL_TARGETS.map((row) => {
                  let val = '—';
                  if (row.key === 'escalationRate') val = `${kpis.escalationRate}%`;
                  if (row.key === 'precision') val = `${kpis.precisionRate}%`;
                  if (row.key === 'containment') val = `${kpis.containmentRate}%`;
                  if (row.key === 'firstContact') val = '15–60 min';
                  if (row.key === 'slaCompliance') val = `${kpis.slaComplianceRate}%`;
                  if (row.key === 'reEscalation') val = `${kpis.reEscalationRate}%`;
                  if (row.key === 'csat') val = `${kpis.avgCsat} / 5`;
                  if (row.key === 'contextLeaks') val = `${kpis.contextLeakRate}%`;

                  const localizedMetric = VECTOR_METRIC_I18N[row.key];

                  return (
                    <tr key={row.key}>
                      <td className="py-2.5 pr-4 font-semibold">
                        {localizedMetric ? localizedMetric.label[lang] : row.label}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400">
                        {localizedMetric ? localizedMetric.def[lang] : row.def}
                      </td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-amber-400">{val}</td>
                      <td className="py-2.5 font-mono text-emerald-400">
                        {localizedMetric ? localizedMetric.target[lang] : row.target}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 4: QA Criteria (§12) & Implementation Checklist (§14) */}
      {subTab === 'qa' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-3">
            <h3 className="text-sm font-bold text-zinc-100">
              {tr(
                `12. Criterios de Aceptación QA (${Object.values(qaChecked).filter(Boolean).length}/${VECTOR_QA_CRITERIA.length})`,
                `12. QA Acceptance Criteria (${Object.values(qaChecked).filter(Boolean).length}/${VECTOR_QA_CRITERIA.length})`,
                `12. QA 验收标准 (${Object.values(qaChecked).filter(Boolean).length}/${VECTOR_QA_CRITERIA.length})`
              )}
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {VECTOR_QA_CRITERIA.map((item) => {
                const checked = Boolean(qaChecked[item.id]);
                const text = item[lang] || item.es;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleQa(item.id)}
                    className="w-full p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06] flex items-start gap-2.5 text-left text-xs hover:border-amber-400/30"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    )}
                    <span className={checked ? 'text-zinc-300 line-through opacity-75' : 'text-zinc-200'}>
                      {text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-3">
            <h3 className="text-sm font-bold text-zinc-100">
              {tr(
                `14. Checklist de Implementación (${Object.values(implChecked).filter(Boolean).length}/${VECTOR_IMPL_CHECKLIST.length})`,
                `14. Implementation Checklist (${Object.values(implChecked).filter(Boolean).length}/${VECTOR_IMPL_CHECKLIST.length})`,
                `14. 实施检查清单 (${Object.values(implChecked).filter(Boolean).length}/${VECTOR_IMPL_CHECKLIST.length})`
              )}
            </h3>
            <div className="space-y-2">
              {VECTOR_IMPL_CHECKLIST.map((item) => {
                const checked = Boolean(implChecked[item.id]);
                const text = item[lang] || item.es;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleImpl(item.id)}
                    className="w-full p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06] flex items-start gap-2.5 text-left text-xs hover:border-amber-400/30"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    )}
                    <span className={checked ? 'text-zinc-300 line-through opacity-75' : 'text-zinc-200'}>
                      {text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
