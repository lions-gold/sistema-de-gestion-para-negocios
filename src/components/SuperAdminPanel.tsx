import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Store,
  CreditCard,
  Settings,
  CheckCircle2,
  XCircle,
  Power,
  LogOut,
  Search,
  Lock,
  Save,
  Package,
  Mail,
  Send,
  Gift,
  Users,
  ExternalLink,
  Ticket,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, SUPER_ADMIN_EMAIL } from '../firebase';
import {
  AdminEmailDispatch,
  PlatformBillingSettings,
  ReferralCoupon,
  StoreReferral,
  StoreStatus,
  StoreTenant,
  SubscriptionPayment,
} from '../types';
import {
  adminResolveSubscriptionPayment,
  adminSetGlobalWarehousePos,
  adminSetStoreStatus,
  adminSetStoreWarehousePos,
  DEFAULT_BILLING_SETTINGS,
  ensureSuperAdminRecord,
  fetchStoreOwnerEmailsForAdmin,
  getPlatformBillingSettings,
  isSuperAdminUser,
  savePlatformBillingSettings,
  sendAdminEmailsToOwners,
  signInWithGoogleAccount,
  signOutAccount,
  subscribeAdminEmails,
  subscribeAllCouponsForAdmin,
  subscribeAllPaymentsForAdmin,
  subscribeAllReferralsForAdmin,
  subscribeAllStoresForAdmin,
} from '../services/saasService';
import { useLanguage } from '../i18n/LanguageContext';

interface SuperAdminPanelProps {
  onOpenWarehouseApp?: () => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onOpenWarehouseApp }) => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [stores, setStores] = useState<StoreTenant[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [billing, setBilling] = useState<PlatformBillingSettings>(DEFAULT_BILLING_SETTINGS);
  const [adminEmails, setAdminEmails] = useState<AdminEmailDispatch[]>([]);
  const [referrals, setReferrals] = useState<StoreReferral[]>([]);
  const [coupons, setCoupons] = useState<ReferralCoupon[]>([]);
  const [ownerEmailMap, setOwnerEmailMap] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<
    'stores' | 'payments' | 'emails' | 'referrals' | 'billing'
  >('stores');
  const [storeFilter, setStoreFilter] = useState<'all' | StoreStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Email Composer State
  const [emailMode, setEmailMode] = useState<'individual' | 'collective'>('individual');
  const [selectedIndividualStoreId, setSelectedIndividualStoreId] = useState<string>('');
  const [collectiveGroup, setCollectiveGroup] = useState<
    'all' | 'active' | 'pending' | 'suspended' | 'custom'
  >('all');
  const [customStoreIds, setCustomStoreIds] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const isAuthorizedAdmin = isSuperAdminUser(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && isSuperAdminUser(u)) {
        try {
          await ensureSuperAdminRecord(u);
        } catch (err) {
          console.error('Error asegurando registro admin:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      setStores([]);
      setPayments([]);
      setAdminEmails([]);
      setReferrals([]);
      setCoupons([]);
      return;
    }

    getPlatformBillingSettings().then(setBilling);
    const unsubStores = subscribeAllStoresForAdmin(setStores);
    const unsubPayments = subscribeAllPaymentsForAdmin(setPayments);
    const unsubEmails = subscribeAdminEmails(setAdminEmails);
    const unsubReferrals = subscribeAllReferralsForAdmin(setReferrals);
    const unsubCoupons = subscribeAllCouponsForAdmin(setCoupons);
    return () => {
      unsubStores();
      unsubPayments();
      unsubEmails();
      unsubReferrals();
      unsubCoupons();
    };
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    if (!isAuthorizedAdmin || stores.length === 0) return;
    fetchStoreOwnerEmailsForAdmin(stores, payments).then(setOwnerEmailMap);
    if (!selectedIndividualStoreId && stores[0]) {
      setSelectedIndividualStoreId(stores[0].id);
    }
  }, [isAuthorizedAdmin, stores, payments, selectedIndividualStoreId]);

  const showNotice = (msg: string) => {
    setErrorNotice(null);
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleToggleStoreStatus = async (store: StoreTenant, nextStatus: StoreStatus) => {
    setIsBusy(true);
    try {
      await adminSetStoreStatus(store, nextStatus);
      showNotice(
        `Cuenta "${store.storeName}" actualizada manualmente a: ${
          nextStatus === 'active' ? 'ACTIVA' : 'DESACTIVADA'
        }.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error cambiando estado de tienda.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleGlobalWarehousePos = async () => {
    const nextVal = !Boolean(billing.warehousePosEnabled);
    setIsBusy(true);
    try {
      await adminSetGlobalWarehousePos(nextVal, billing);
      setBilling((prev) => ({ ...prev, warehousePosEnabled: nextVal }));
      showNotice(
        `Módulo Almacén & POS global ${
          nextVal ? 'ACTIVADO' : 'DESACTIVADO'
        } por el Administrador.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error cambiando estado de Almacén & POS.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleStoreWarehousePos = async (store: StoreTenant) => {
    const nextVal = !Boolean(store.warehousePosEnabled);
    setIsBusy(true);
    try {
      await adminSetStoreWarehousePos(store, nextVal);
      showNotice(
        `Almacén & POS ${nextVal ? 'ACTIVADO' : 'DESACTIVADO'} exclusivamente para "${
          store.storeName
        }".`
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Error cambiando Almacén & POS de la tienda.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handlePaymentAction = async (
    payment: SubscriptionPayment,
    nextStatus: 'approved' | 'rejected',
    activateStore: boolean
  ) => {
    setIsBusy(true);
    try {
      const result = await adminResolveSubscriptionPayment(payment, nextStatus, activateStore);
      const couponNote = result?.couponIssuedCode
        ? ` · 🎁 Cupón de referido ${result.couponIssuedCode} otorgado automáticamente a "${result.referrerStoreName}"!`
        : '';
      showNotice(
        nextStatus === 'approved'
          ? `Pago #${payment.referenceNumber} aprobado${activateStore ? ' y tienda activada' : ''}${couponNote}.`
          : `Pago #${payment.referenceNumber} marcado como rechazado.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error actualizando pago.');
    } finally {
      setIsBusy(false);
    }
  };

  const resolvedEmailTargets = (() => {
    if (emailMode === 'individual') {
      const st = stores.find((s) => s.id === selectedIndividualStoreId);
      return st ? [{ store: st, email: ownerEmailMap[st.id] }] : [];
    }
    const list =
      collectiveGroup === 'all'
        ? stores
        : collectiveGroup === 'custom'
          ? stores.filter((s) => customStoreIds.includes(s.id))
          : stores.filter((s) => s.status === collectiveGroup);
    return list.map((s) => ({ store: s, email: ownerEmailMap[s.id] }));
  })();

  const handleToggleCustomStoreId = (storeId: string) => {
    setCustomStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSendAdminEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || resolvedEmailTargets.length === 0) return;
    setIsSendingEmail(true);
    try {
      const res = await sendAdminEmailsToOwners({
        adminUser: user,
        mode: emailMode,
        targets: resolvedEmailTargets,
        subject: emailSubject,
        body: emailBody,
      });
      showNotice(
        `Correo enviado a ${res.sentCount} tienda(s) [${res.deliveryChannel.toUpperCase()}]. ${res.message}`
      );
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error enviando correos.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const buildMailtoHref = () => {
    const emails = Array.from(
      new Set(
        resolvedEmailTargets
          .map((item) => item.email)
          .filter((em): em is string => Boolean(em && em.includes('@')))
      )
    );
    const subj = encodeURIComponent(emailSubject || 'Comunicado Smith Solutions E-Commerce');
    const body = encodeURIComponent(emailBody || '');
    if (emails.length <= 1) {
      return `mailto:${emails[0] || ''}?subject=${subj}&body=${body}`;
    }
    return `mailto:${SUPER_ADMIN_EMAIL}?bcc=${encodeURIComponent(emails.join(','))}&subject=${subj}&body=${body}`;
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await savePlatformBillingSettings(billing);
      showNotice(
        'Cuentas receptoras (Bancos Venezuela, Pago Móvil, Binance Pay, Bybit) y recompensa por referidos guardadas en Firestore.'
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error guardando cuentas.');
    } finally {
      setIsBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Exclusive Admin Google Sign-In Gate
  // ---------------------------------------------------------------------------
  if (!user) {
    return (
      <section className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-[#111114]/95 border border-amber-500/35 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-white font-display">
              {t.admin.gateTitle}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300">
              {t.admin.gateDesc}{' '}
              <span className="font-mono text-amber-300">{SUPER_ADMIN_EMAIL}</span>
            </p>
          </div>
          <button
            onClick={() => signInWithGoogleAccount()}
            className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-100 text-zinc-950 font-bold text-sm shadow-lg min-h-[48px]"
          >
            {t.admin.gateBtn} ({SUPER_ADMIN_EMAIL})
          </button>
        </div>
      </section>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <section className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-red-950/30 border border-red-500/40 rounded-2xl p-8 text-center space-y-5">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white font-display">{t.admin.restrictedTitle}</h1>
            <p className="text-xs sm:text-sm text-zinc-300">
              {t.admin.restrictedDesc} (<span className="font-mono text-white">{user.email}</span> /{' '}
              <span className="font-mono text-amber-300">{SUPER_ADMIN_EMAIL}</span>)
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => signInWithGoogleAccount()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
            >
              {t.admin.switchGoogle}
            </button>
            <button
              onClick={() => signOutAccount()}
              className="px-4 py-2.5 rounded-xl bg-[#111114] border border-white/[0.1] text-zinc-300 text-xs"
            >
              {t.admin.closeSession}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const activeCount = stores.filter((s) => s.status === 'active').length;
  const pendingStoresCount = stores.filter((s) => s.status === 'pending').length;
  const suspendedCount = stores.filter((s) => s.status === 'suspended').length;
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;

  const filteredStores = stores.filter((s) => {
    const matchesStatus = storeFilter === 'all' || s.status === storeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      s.storeName.toLowerCase().includes(q) ||
      s.registeredOwnerName.toLowerCase().includes(q) ||
      (s.rif || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Header */}
      <div className="bg-[#111114]/95 border border-amber-500/35 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white font-display">
              {t.admin.panelTitle}
            </h1>
            <p className="text-xs text-zinc-400">
              {t.admin.verifiedSession}{' '}
              <span className="font-mono text-emerald-300">{user.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            disabled={isBusy}
            onClick={handleToggleGlobalWarehousePos}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors min-h-[40px] ${
              billing.warehousePosEnabled
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-[#09090b] border-white/[0.1] text-zinc-300 hover:border-amber-500/40'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{billing.warehousePosEnabled ? t.admin.whGlobalOn : t.admin.whGlobalOff}</span>
          </button>

          {onOpenWarehouseApp && (
            <button
              onClick={onOpenWarehouseApp}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            >
              <Package className="w-4 h-4" />
              <span>{t.admin.openWhAdmin}</span>
            </button>
          )}

          <button
            onClick={() => signOutAccount()}
            className="px-4 py-2 rounded-xl bg-[#09090b] border border-white/[0.1] hover:border-red-500/40 text-xs text-zinc-300 flex items-center gap-2 min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.admin.signOutAdmin}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4">
          <div className="text-[11px] text-zinc-400">{t.admin.kpiTotalStores}</div>
          <div className="text-2xl font-extrabold text-white font-mono tabular-nums mt-1">
            {stores.length}
          </div>
        </div>
        <div className="bg-[#111114] border border-emerald-500/30 rounded-xl p-4">
          <div className="text-[11px] text-emerald-400">{t.admin.kpiActiveStores}</div>
          <div className="text-2xl font-extrabold text-emerald-300 font-mono tabular-nums mt-1">
            {activeCount}
          </div>
        </div>
        <div className="bg-[#111114] border border-amber-500/30 rounded-xl p-4">
          <div className="text-[11px] text-amber-400">{t.admin.kpiPendingSuspended}</div>
          <div className="text-2xl font-extrabold text-amber-300 font-mono tabular-nums mt-1">
            {pendingStoresCount + suspendedCount}
          </div>
        </div>
        <div className="bg-[#111114] border border-sky-500/30 rounded-xl p-4">
          <div className="text-[11px] text-sky-400">{t.admin.kpiPendingPayments}</div>
          <div className="text-2xl font-extrabold text-sky-300 font-mono tabular-nums mt-1">
            {pendingPaymentsCount}
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200">
          {statusNotice}
        </div>
      )}
      {errorNotice && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs sm:text-sm text-red-200">
          {errorNotice}
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        <button
          onClick={() => setActiveTab('stores')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'stores'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>
            {t.admin.tabStores} ({stores.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {t.admin.tabPayments} ({pendingPaymentsCount})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'emails'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>{t.admin.tabEmails}</span>
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'referrals'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>
            {t.admin.tabReferrals} ({referrals.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'billing'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{t.admin.tabBilling}</span>
        </button>
      </div>

      {/* ADMIN TAB 1: MANUAL ACCOUNT ACTIVATION */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.admin.searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 bg-[#111114] border border-white/[0.08] rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {(['all', 'pending', 'active', 'suspended'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStoreFilter(st)}
                  className={`px-3 py-2 rounded-lg font-semibold ${
                    storeFilter === st
                      ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                      : 'bg-[#111114] border border-white/[0.08] text-zinc-400'
                  }`}
                >
                  {st === 'all'
                    ? t.admin.filterAll
                    : st === 'pending'
                      ? t.admin.filterPending
                      : st === 'active'
                        ? t.admin.filterActive
                        : t.admin.filterSuspended}
                </button>
              ))}
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
              {t.admin.noStores}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#09090b] border border-white/[0.1] overflow-hidden shrink-0 flex items-center justify-center">
                      {store.logoUrl ? (
                        <img
                          src={store.logoUrl}
                          alt={store.storeName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-6 h-6 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{store.storeName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            store.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : store.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {store.status === 'active'
                            ? t.common.active
                            : store.status === 'pending'
                              ? t.common.pending
                              : t.common.suspended}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            store.warehousePosEnabled
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-zinc-900 text-zinc-400'
                          }`}
                        >
                          {store.warehousePosEnabled ? t.admin.whBadgeActive : t.admin.whBadgeLocked}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        {t.merchant.ownerPrefix}: {store.registeredOwnerName} · RIF:{' '}
                        {store.rif || t.merchant.noRif} · WhatsApp: {store.businessWhatsapp}
                        {ownerEmailMap[store.id] ? ` · 📧 ${ownerEmailMap[store.id]}` : ''}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono flex flex-wrap gap-2">
                        <span>
                          /tienda/{store.slug} · ${store.subscriptionPriceUSD}/mo
                        </span>
                        {store.referralCode && (
                          <span className="text-amber-300/90">Ref: {store.referralCode}</span>
                        )}
                        {store.referredByStoreName && (
                          <span className="text-emerald-300/90">
                            Invitada por: {store.referredByStoreName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('individual');
                        setSelectedIndividualStoreId(store.id);
                        setActiveTab('emails');
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] bg-[#09090b] border border-white/[0.1] hover:border-amber-400 text-amber-300"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{t.admin.emailQuickBtn}</span>
                    </button>

                    <button
                      disabled={isBusy}
                      onClick={() => handleToggleStoreWarehousePos(store)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] border ${
                        store.warehousePosEnabled
                          ? 'bg-sky-950/60 border-sky-500/40 text-sky-300 hover:bg-sky-900/60'
                          : 'bg-[#09090b] border-white/[0.1] text-zinc-300 hover:border-amber-500/40'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>
                        {store.warehousePosEnabled
                          ? t.admin.whDeactivateBtn
                          : t.admin.whActivateBtn}
                      </span>
                    </button>

                    {store.status !== 'active' && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleToggleStoreStatus(store, 'active')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.admin.activateAccount}</span>
                      </button>
                    )}
                    {store.status !== 'suspended' && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleToggleStoreStatus(store, 'suspended')}
                        className="px-4 py-2 rounded-xl bg-red-600/85 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Power className="w-4 h-4" />
                        <span>{t.admin.deactivateAccount}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN TAB 2: SUBSCRIPTION PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
              {t.admin.noPayments}
            </div>
          ) : (
            payments.map((pay) => (
              <div
                key={pay.id}
                className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-sm">{pay.storeName}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold">
                      ${pay.amountUSD} USD · {pay.paymentMethod}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        pay.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : pay.status === 'rejected'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {pay.status === 'approved'
                        ? t.common.approved
                        : pay.status === 'rejected'
                          ? t.common.rejected
                          : t.common.toVerify}
                    </span>
                  </div>
                  <div className="text-zinc-300">
                    Ref / TxID: <strong className="font-mono text-white">{pay.referenceNumber}</strong> ·{' '}
                    {pay.ownerEmail}
                  </div>
                  {pay.couponCode && (
                    <div className="text-emerald-300 font-mono">
                      🎟 Cupón: {pay.couponCode} (-${pay.discountUSD ?? 0} USD)
                    </div>
                  )}
                  {pay.payerInfo && <div className="text-zinc-400">{pay.payerInfo}</div>}
                  {pay.notes && <div className="text-zinc-400">{pay.notes}</div>}
                </div>

                {pay.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      disabled={isBusy}
                      onClick={() => handlePaymentAction(pay, 'approved', true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold min-h-[40px]"
                    >
                      {t.admin.approveAndActivate}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => handlePaymentAction(pay, 'approved', false)}
                      className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold min-h-[40px]"
                    >
                      {t.admin.approveOnly}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => handlePaymentAction(pay, 'rejected', false)}
                      className="px-3 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold min-h-[40px]"
                    >
                      {t.admin.reject}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ADMIN TAB 3: INDIVIDUAL & COLLECTIVE EMAILS TO STORE OWNERS */}
      {activeTab === 'emails' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSendAdminEmails}
            className="lg:col-span-7 bg-[#111114] border border-white/[0.08] rounded-2xl p-6 space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                <span>{t.admin.emailsTitle}</span>
              </h2>
              <p className="text-xs text-zinc-400">{t.admin.emailsDesc}</p>
            </div>

            {/* Individual vs Collective Switch */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setEmailMode('individual')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  emailMode === 'individual'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#09090b] border-white/[0.08] text-zinc-400'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{t.admin.emailModeIndividual}</span>
              </button>
              <button
                type="button"
                onClick={() => setEmailMode('collective')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  emailMode === 'collective'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-[#09090b] border-white/[0.08] text-zinc-400'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t.admin.emailModeCollective}</span>
              </button>
            </div>

            {emailMode === 'individual' ? (
              <div>
                <label className="text-xs text-zinc-300 block mb-1.5">
                  {t.admin.emailSelectStore}
                </label>
                <select
                  value={selectedIndividualStoreId}
                  onChange={(e) => setSelectedIndividualStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName} — {s.registeredOwnerName}{' '}
                      {ownerEmailMap[s.id] ? `(${ownerEmailMap[s.id]})` : '(Bandeja Tienda)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-300 block mb-1.5">
                    {t.admin.emailCollectiveFilter}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', t.admin.emailFilterAll],
                        ['active', t.admin.emailFilterActive],
                        ['pending', t.admin.emailFilterPending],
                        ['suspended', t.admin.emailFilterSuspended],
                        ['custom', t.admin.emailFilterCustom],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCollectiveGroup(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          collectiveGroup === key
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-[#09090b] border-white/[0.08] text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {collectiveGroup === 'custom' && (
                  <div className="max-h-44 overflow-y-auto bg-[#09090b] border border-white/[0.08] rounded-xl p-3 space-y-2">
                    {stores.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={customStoreIds.includes(s.id)}
                          onChange={() => handleToggleCustomStoreId(s.id)}
                          className="accent-amber-500"
                        />
                        <span className="font-semibold">{s.storeName}</span>
                        <span className="text-zinc-400">
                          ({ownerEmailMap[s.id] || s.registeredOwnerName})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-300">
                {t.admin.emailRecipientsCount}{' '}
                <strong className="text-amber-300 font-mono">
                  {resolvedEmailTargets.length}
                </strong>
              </span>
              <span className="text-[11px] text-zinc-400 truncate max-w-md">
                {resolvedEmailTargets
                  .map((r) => r.email || r.store.storeName)
                  .slice(0, 4)
                  .join(', ')}
                {resolvedEmailTargets.length > 4 ? '...' : ''}
              </span>
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.emailSubjectLabel}
              </label>
              <input
                required
                type="text"
                maxLength={180}
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={t.admin.emailSubjectPlaceholder}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.emailBodyLabel}
              </label>
              <textarea
                required
                rows={5}
                maxLength={5000}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder={t.admin.emailBodyPlaceholder}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSendingEmail || resolvedEmailTargets.length === 0}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 min-h-[44px]"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingEmail ? t.admin.emailSending : t.admin.emailSendBtn}</span>
              </button>

              {resolvedEmailTargets.some((r) => Boolean(r.email)) && (
                <a
                  href={buildMailtoHref()}
                  className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.admin.emailOpenClientBtn}</span>
                </a>
              )}
            </div>
          </form>

          {/* Sent Email History */}
          <div className="lg:col-span-5 bg-[#111114] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white font-display">
              {t.admin.emailHistoryTitle} ({adminEmails.length})
            </h3>
            {adminEmails.length === 0 ? (
              <p className="text-xs text-zinc-400">{t.admin.emailHistoryEmpty}</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {adminEmails.map((em) => (
                  <div
                    key={em.id}
                    className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] space-y-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          em.mode === 'collective'
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {em.mode === 'collective' ? 'Colectivo' : 'Individual'} · {em.recipientCount}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                        {em.deliveryChannel}
                      </span>
                    </div>
                    <div className="font-bold text-white">{em.subject}</div>
                    <p className="text-zinc-300 line-clamp-3 whitespace-pre-line">{em.body}</p>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {em.targetStoreNames || em.recipientEmailsSummary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN TAB 4: GLOBAL REFERRALS & RENEWAL COUPONS */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="bg-[#111114] border border-amber-500/25 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>{t.admin.referralsAdminTitle}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">{t.admin.referralsAdminDesc}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-mono">
              <div className="px-3 py-2 rounded-xl bg-[#09090b] border border-white/[0.08]">
                Referidos: <strong className="text-white">{referrals.length}</strong>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#09090b] border border-emerald-500/30">
                Cupones Activos:{' '}
                <strong className="text-emerald-300">
                  {coupons.filter((c) => c.status === 'available').length}
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">{t.admin.referralsListTitle}</h3>
              {referrals.length === 0 ? (
                <p className="text-xs text-zinc-400">{t.admin.noReferralsAdmin}</p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {referrals.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">
                          {r.referrerStoreName} ➔ {r.referredStoreName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'rewarded'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {r.status === 'rewarded'
                            ? t.merchant.refStatusRewarded
                            : t.merchant.refStatusRegistered}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Código usado: {r.referrerCode}
                        {r.rewardCouponCode ? ` · Cupón: ${r.rewardCouponCode}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-400" />
                <span>{t.admin.couponsListTitle}</span>
              </h3>
              {coupons.length === 0 ? (
                <p className="text-xs text-zinc-400">{t.admin.noCouponsAdmin}</p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] text-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-mono font-bold text-amber-300">
                          {c.code} (-${c.discountUSD} USD)
                        </div>
                        <div className="text-zinc-300">{c.storeName}</div>
                        {c.referredStoreName && (
                          <div className="text-[11px] text-zinc-400">
                            Por referir a: {c.referredStoreName}
                          </div>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'available'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : c.status === 'applied'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        {c.status === 'available'
                          ? t.merchant.couponStatusAvailable
                          : c.status === 'applied'
                            ? t.merchant.couponStatusApplied
                            : t.merchant.couponStatusRedeemed}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN TAB 5: PLATFORM BILLING RECEIVING ACCOUNTS */}
      {activeTab === 'billing' && (
        <form
          onSubmit={handleSaveBilling}
          className="bg-[#111114] border border-white/[0.08] rounded-2xl p-6 space-y-5"
        >
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white font-display">
              {t.admin.billingTitle}
            </h2>
            <p className="text-xs text-zinc-400">{t.admin.billingDesc}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.monthlyCostLabel}
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={billing.monthlyPriceUSD}
                onChange={(e) =>
                  setBilling({ ...billing, monthlyPriceUSD: Number(e.target.value) || 25 })
                }
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.referralRewardLabel}
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={billing.referralRewardUSD ?? 25}
                onChange={(e) =>
                  setBilling({
                    ...billing,
                    referralRewardUSD: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.supportWaLabel}
              </label>
              <input
                type="text"
                value={billing.supportWhatsapp}
                onChange={(e) => setBilling({ ...billing, supportWhatsapp: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.bankTransfersLabel}
              </label>
              <textarea
                rows={3}
                value={billing.bankTransfers}
                onChange={(e) => setBilling({ ...billing, bankTransfers: e.target.value })}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.pagoMovilLabel}
              </label>
              <textarea
                rows={3}
                value={billing.pagoMovil}
                onChange={(e) => setBilling({ ...billing, pagoMovil: e.target.value })}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.binanceLabel}
              </label>
              <textarea
                rows={2}
                value={billing.binancePay}
                onChange={(e) => setBilling({ ...billing, binancePay: e.target.value })}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.admin.bybitLabel}
              </label>
              <textarea
                rows={2}
                value={billing.bybitPay}
                onChange={(e) => setBilling({ ...billing, bybitPay: e.target.value })}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{t.admin.saveBillingBtn}</span>
          </button>
        </form>
      )}
    </section>
  );
};
