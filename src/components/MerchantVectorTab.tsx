import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  BellOff,
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

interface MerchantVectorTabProps {
  user: User;
  store: StoreTenant;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export const MerchantVectorTab: React.FC<MerchantVectorTabProps> = ({
  user,
  store,
  onNotify,
  onError,
}) => {
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
      onNotify(`Configuración de Vector guardada para "${store.storeName}".`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error guardando configuración de Vector.');
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
          ? 'Opt-out aplicado: esta tienda no recibirá campañas comerciales de Vector.'
          : 'Preferencia de campañas comerciales actualizada.'
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error actualizando consentimiento.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign Consent Banner (§4 Opt-In / Opt-Out) */}
      <div className="p-5 rounded-xl bg-[#111114] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Consentimiento de Campañas Comerciales (Vector §4)</span>
          </div>
          <p className="text-xs text-zinc-400">
            Controla si deseas recibir recomendaciones operativas y campañas aprobadas por el Super Admin para tu tienda.
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
                {status === 'si' ? 'Sí, recibir' : status === 'solo_importante' ? 'Solo importantes' : 'No recibir (Opt-out)'}
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
                Configuración Vector por Marca (Sección 13)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Aislamiento estricto para {store.storeName}: idioma, tono, SLA real y palancas verificables.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Configuración Vector'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">Idioma Principal</label>
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
            <label className="block text-zinc-400 mb-1">Tratamiento en Español</label>
            <select
              value={config.tratamientoEs}
              onChange={(e) =>
                setConfig((p) => ({ ...p, tratamientoEs: e.target.value as 'usted' | 'tu' }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            >
              <option value="usted">Usted (Recomendado alta gama)</option>
              <option value="tu">Tú</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">Emojis Máximos</label>
            <select
              value={config.emojiMax}
              onChange={(e) =>
                setConfig((p) => ({ ...p, emojiMax: Number(e.target.value) === 1 ? 1 : 0 }))
              }
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            >
              <option value={0}>0 emojis (Por defecto)</option>
              <option value={1}>1 emoji máximo</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">Horario y Zona Horaria</label>
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
            <label className="block text-zinc-400 mb-1">Política Real de Envíos</label>
            <textarea
              rows={2}
              value={config.politicaEnvios}
              onChange={(e) => setConfig((p) => ({ ...p, politicaEnvios: e.target.value }))}
              className="w-full bg-zinc-950 border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">Política Real de Devoluciones</label>
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
            <label className="block text-zinc-400 mb-1">SLA Crítica (min)</label>
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
            <label className="block text-zinc-400 mb-1">SLA Alta (min)</label>
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
            <label className="block text-zinc-400 mb-1">Intentos Máx. Bot</label>
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
            <label className="block text-zinc-400 mb-1">Cola N1 (Marca)</label>
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
            <span>Palancas de Influencia Verificables Habilitadas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(VECTOR_LEVER_METADATA) as VectorInfluenceLever[]).map((key) => {
              const checked = config.palancasActivas.includes(key);
              const meta = VECTOR_LEVER_METADATA[key];
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
                    <span>{meta.labelEs}</span>
                    {checked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{meta.rule}</p>
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
              Cola de Tickets Escalados por Vector ({tickets.length})
            </h3>
            <p className="text-[11px] text-zinc-400">
              Casos N1–N3 transferidos con paquete [ESCALAMIENTO] completo para no repetir preguntas al cliente.
            </p>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-6 rounded-lg bg-zinc-950 border border-white/[0.06] text-center text-xs text-zinc-400">
            No hay casos escalados en esta tienda todavía. Vector está conteniendo las consultas en N0.
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
                      {tkt.level} · Prioridad {tkt.priority}
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
                      <option value="open">Abierto</option>
                      <option value="in_progress">En Atención</option>
                      <option value="escalated">Escalado</option>
                      <option value="resolved">Resuelto</option>
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
