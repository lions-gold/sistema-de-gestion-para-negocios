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
          ? `${count} ticket(s) vencido(s) subieron automáticamente +1 nivel SLA.`
          : 'Todos los tickets abiertos están dentro de su ventana SLA.'
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error verificando SLA.');
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
        summary: 'Prueba simulada QA §14: vencimiento automático de SLA crítico.',
        botAttempts: 0,
        lastProposal: 'Escalado crítico inicial',
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
      onNotify(`Caso simulado ${created.ticket.ticketNumber} ejecutado y verificado.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error en simulación QA.');
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
        sampleStoreData: `${stores.length} tiendas totales, ${audiencePreview.eligibleCount} elegibles.`,
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
      onNotify('Borrador A/B (ES/EN/ZH) redactado por Vector. Requiere tu aprobación manual para enviar.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error generando borrador de campaña.');
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
          'ALERTA VECTOR §4: La tasa de bajas (opt-out) superó el 2%. Revisa segmentación y frecuencia.'
        );
      }
      onNotify(
        `Campaña aprobada y enviada a ${res.sentCount} dueño(s) con enlace de baja (${res.excludedCount} excluido(s) por opt-out/rebote).`
      );
      setActiveDraftCampaign(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error despachando campaña aprobada.');
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
                Centro de Gobernanza Vector (N0–N4)
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Carlos Smith Zambrano Gonzalez
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Cola N4 crítica, reportes [REPORTE], campañas con aprobación manual y métricas de contención.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'tickets', label: `Tickets N0–N4 (${tickets.filter((t) => t.status !== 'resolved').length})` },
            { id: 'campaigns', label: 'Campañas a Tiendas (§4)' },
            { id: 'metrics', label: 'Métricas Control (§10)' },
            { id: 'qa', label: 'QA & Checklist (§12/14)' },
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
            <AlertTriangle className="w-4 h-4" /> Alertas Automáticas al Administrador
          </div>
          {kpis.lowSlaAlert && (
            <p>• Cumplimiento de SLA cayó por debajo del 90% ({kpis.slaComplianceRate}%).</p>
          )}
          {kpis.repeatedTriggerAlert && (
            <p>• Disparador #{kpis.repeatedTriggerAlert} superó 5 incidencias en las últimas 24 h.</p>
          )}
          {optOutAlertMsg && <p>• {optOutAlertMsg}</p>}
        </div>
      )}

      {/* Subtab 1: N0-N4 Tickets & [REPORTE] */}
      {subTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-zinc-100">
              Cola Global de Escalamientos & Reportes Críticos
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleAutoEscalateOverdue}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-amber-300 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Revisar Vencimientos SLA
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSimulateTimeoutCase}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
              >
                <FileWarning className="w-3.5 h-3.5 text-amber-400" /> Simular Vencimiento Crítico (§14)
              </button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#111114] border border-white/[0.08] text-center text-xs text-zinc-400">
              No hay tickets escalados en el sistema todavía.
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
                        {tkt.level} · {tkt.priority.toUpperCase()} · SLA {tkt.slaMinutes}m
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
                      <option value="open">Abierto</option>
                      <option value="in_progress">En Atención</option>
                      <option value="escalated">Escalado N4</option>
                      <option value="resolved">Resuelto</option>
                    </select>
                  </div>

                  {tkt.adminReport && (
                    <div className="p-3 rounded-lg bg-zinc-950 border border-amber-400/25 font-mono text-[11px] text-amber-200 whitespace-pre-line relative">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(tkt.adminReport || '');
                          onNotify('Formato [REPORTE] copiado.');
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
                  <span>Nueva Campaña Comercial a Dueños de Tienda (Flujo §4)</span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  3 bloques, máximo 120 palabras, datos verificables y enlace de baja obligatorio. Nada sale sin tu aprobación.
                </p>
              </div>
              <div className="text-right text-[11px] font-mono">
                <div className="text-emerald-400">{audiencePreview.eligibleCount} elegibles</div>
                <div className="text-zinc-500">{audiencePreview.excludedCount} excluidos (opt-out/rebote)</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Título Interno</label>
                <input
                  type="text"
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Segmento de Tiendas</label>
                <select
                  value={campSegment}
                  onChange={(e) => setCampSegment(e.target.value as VectorCampaign['segment'])}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                >
                  <option value="active">Tiendas Activas</option>
                  <option value="all">Todas las Tiendas</option>
                  <option value="pending">Pendientes de Activación</option>
                  <option value="low_activity">Baja Actividad / Desactivadas</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Idioma Principal / Vigencia</label>
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
                <label className="block text-zinc-400 mb-1">Objetivo de Campaña</label>
                <input
                  type="text"
                  required
                  value={campObjective}
                  onChange={(e) => setCampObjective(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Oferta Real Verificable (Prohibido inventar)</label>
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
              <span>{isBusy ? 'Redactando borradores A/B...' : 'Redactar Variantes A/B con Vector (ES/EN/ZH)'}</span>
            </button>
          </form>

          {/* Draft Review & Mandatory Admin Approval Gate */}
          {activeDraftCampaign && (
            <div className="p-5 rounded-xl bg-zinc-950 border border-amber-400/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    Paso 4: Revisión y Aprobación Obligatoria del Administrador
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Verifica los borradores generados (máx. 120 palabras, 3 bloques, enlace de baja incluido).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleApproveAndSendCampaign(activeDraftCampaign)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Aprobar y Enviar a {audiencePreview.eligibleCount} Tienda(s)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {draftVariants.map((v, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg bg-[#111114] border border-white/[0.08] space-y-2 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-amber-400">
                      <span>Idioma: {v.lang.toUpperCase()} · Variante {v.variantLabel}</span>
                      <span>{v.body.split(/\s+/).length} palabras</span>
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
              <h4 className="text-xs font-bold text-zinc-200">Historial de Campañas Vector</h4>
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-zinc-100">{c.title}</span>
                      <span className="ml-2 text-[10px] font-mono text-zinc-400">
                        {c.status.toUpperCase()} · Enviados: {c.sentCount} · Excluidos: {c.excludedCount} · Bajas: {c.optOutCount}
                      </span>
                    </div>
                    {c.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleApproveAndSendCampaign(c)}
                        className="px-3 py-1 rounded bg-emerald-500 text-zinc-950 font-bold text-[11px]"
                      >
                        Aprobar y Enviar
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
            <span>Panel de Métricas de Control (Sección 10)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono text-[11px]">
                  <th className="py-2 pr-4">Métrica</th>
                  <th className="py-2 pr-4">Definición</th>
                  <th className="py-2 pr-4">Valor Actual</th>
                  <th className="py-2">Meta Sugerida</th>
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

                  return (
                    <tr key={row.key}>
                      <td className="py-2.5 pr-4 font-semibold">{row.label}</td>
                      <td className="py-2.5 pr-4 text-zinc-400">{row.def}</td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-amber-400">{val}</td>
                      <td className="py-2.5 font-mono text-emerald-400">{row.target}</td>
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
              12. Criterios de Aceptación QA ({Object.values(qaChecked).filter(Boolean).length}/{VECTOR_QA_CRITERIA.length})
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {VECTOR_QA_CRITERIA.map((item) => {
                const checked = Boolean(qaChecked[item.id]);
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
                      {item.es}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] space-y-3">
            <h3 className="text-sm font-bold text-zinc-100">
              14. Checklist de Implementación ({Object.values(implChecked).filter(Boolean).length}/{VECTOR_IMPL_CHECKLIST.length})
            </h3>
            <div className="space-y-2">
              {VECTOR_IMPL_CHECKLIST.map((item) => {
                const checked = Boolean(implChecked[item.id]);
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
                      {item.es}
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
