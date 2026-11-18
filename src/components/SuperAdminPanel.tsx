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
  Compass,
  Plus,
  Edit3,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { AdminVectorHub } from './AdminVectorHub';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, SUPER_ADMIN_EMAIL } from '../firebase';
import {
  AdminEmailDispatch,
  PlatformBillingSettings,
  PlatformPaymentCurrency,
  PlatformPaymentMethod,
  ReferralCoupon,
  SalesPaymentMethod,
  StoreOwnerClaim,
  StoreReferral,
  StoreStatus,
  StoreSubscriptionPaymentMethod,
  StoreTenant,
  SubscriptionPayment,
} from '../types';
import {
  adminCreateStoreWithOwner,
  adminResolveSubscriptionPayment,
  adminSetGlobalWarehousePos,
  adminSetStoreStatus,
  adminSetStoreWarehousePos,
  adminUpdateStoreAndOwner,
  DEFAULT_BILLING_SETTINGS,
  deletePlatformPaymentMethod,
  deleteSalesPaymentMethod,
  deleteStoreSubscriptionPaymentMethod,
  ensureSuperAdminRecord,
  fetchAllStoresSubscriptionMethodsForAdmin,
  fetchStoreOwnerEmailsForAdmin,
  getPlatformBillingSettings,
  isSuperAdminUser,
  savePlatformBillingSettings,
  savePlatformPaymentMethod,
  saveSalesPaymentMethod,
  saveStoreSubscriptionPaymentMethod,
  sendAdminEmailsToOwners,
  signOutAccount,
  subscribeAdminEmails,
  subscribeAllCouponsForAdmin,
  subscribeAllPaymentsForAdmin,
  subscribeAllPlatformPaymentMethodsForAdmin,
  subscribeAllReferralsForAdmin,
  subscribeAllSalesPaymentMethodsForAdmin,
  subscribeAllStoreOwnerClaimsForAdmin,
  subscribeAllStoresForAdmin,
  subscribeStoreSubscriptionMethodsForAdmin,
  togglePlatformPaymentMethodActive,
  toggleSalesPaymentMethodActive,
  toggleStoreSubscriptionPaymentMethodActive,
} from '../services/saasService';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useLanguage } from '../i18n/LanguageContext';

interface SuperAdminPanelProps {
  onOpenWarehouseApp?: (storeId?: string) => void;
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
  const [customPaymentMethods, setCustomPaymentMethods] = useState<PlatformPaymentMethod[]>([]);
  const [salesPaymentMethods, setSalesPaymentMethods] = useState<SalesPaymentMethod[]>([]);
  const [ownerClaims, setOwnerClaims] = useState<StoreOwnerClaim[]>([]);

  const [activeTab, setActiveTab] = useState<
    | 'stores'
    | 'payments'
    | 'emails'
    | 'referrals'
    | 'vector'
    | 'sub_methods'
    | 'billing'
    | 'sales_methods'
  >('stores');
  const [subMethodFilter, setSubMethodFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [subMethodSearch, setSubMethodSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<'all' | StoreStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Manual Store + Owner Creation / Edit Modal State
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [editingStoreTarget, setEditingStoreTarget] = useState<StoreTenant | null>(null);
  const [manualOwnerName, setManualOwnerName] = useState('');
  const [manualOwnerEmail, setManualOwnerEmail] = useState('');
  const [manualWhatsapp, setManualWhatsapp] = useState('+58 ');
  const [manualStoreName, setManualStoreName] = useState('');
  const [manualRif, setManualRif] = useState('');
  const [manualCategory, setManualCategory] = useState('Comercio General');
  const [manualStatus, setManualStatus] = useState<StoreStatus>('active');
  const [manualWarehousePos, setManualWarehousePos] = useState(true);
  const [manualNationalShipping, setManualNationalShipping] = useState(true);
  const [manualLocalDelivery, setManualLocalDelivery] = useState(true);
  const [manualPickupEnabled, setManualPickupEnabled] = useState(true);

  // Manual Subscription Payment Method Form State
  const [editingMethodTarget, setEditingMethodTarget] = useState<PlatformPaymentMethod | null>(null);
  const [pmName, setPmName] = useState('');
  const [pmCurrency, setPmCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [pmHolder, setPmHolder] = useState('');
  const [pmDetails, setPmDetails] = useState('');
  const [pmInstructions, setPmInstructions] = useState('');
  const [pmActive, setPmActive] = useState(true);
  const [confirmDeleteMethodId, setConfirmDeleteMethodId] = useState<string | null>(null);

  // Per-Registered-Store Subscription Payment Methods State
  const [subMethodsScope, setSubMethodsScope] = useState<'global' | 'per_store'>('global');
  const [storeSubMethodsMap, setStoreSubMethodsMap] = useState<
    Record<string, StoreSubscriptionPaymentMethod[]>
  >({});
  const [selectedSubStoreId, setSelectedSubStoreId] = useState<string>('');
  const [showStoreSubMethodsModal, setShowStoreSubMethodsModal] = useState(false);
  const [editingStoreSubTarget, setEditingStoreSubTarget] =
    useState<StoreSubscriptionPaymentMethod | null>(null);
  const [ssPmName, setSsPmName] = useState('');
  const [ssPmCurrency, setSsPmCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [ssPmHolder, setSsPmHolder] = useState('');
  const [ssPmDetails, setSsPmDetails] = useState('');
  const [ssPmInstructions, setSsPmInstructions] = useState('');
  const [ssPmActive, setSsPmActive] = useState(true);
  const [confirmDeleteStoreSubId, setConfirmDeleteStoreSubId] = useState<string | null>(null);

  // Admin Custom Sales Payment Methods Form State (for Store Owners recording sales)
  const [editingSalesMethodTarget, setEditingSalesMethodTarget] = useState<SalesPaymentMethod | null>(null);
  const [spName, setSpName] = useState('');
  const [spCurrency, setSpCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [spAppliesIgtf, setSpAppliesIgtf] = useState(true);
  const [spDescription, setSpDescription] = useState('');
  const [spActive, setSpActive] = useState(true);
  const [confirmDeleteSalesMethodId, setConfirmDeleteSalesMethodId] = useState<string | null>(null);

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
      setCustomPaymentMethods([]);
      setSalesPaymentMethods([]);
      setOwnerClaims([]);
      setStoreSubMethodsMap({});
      return;
    }

    getPlatformBillingSettings().then(setBilling);
    const unsubStores = subscribeAllStoresForAdmin(setStores);
    const unsubPayments = subscribeAllPaymentsForAdmin(setPayments);
    const unsubEmails = subscribeAdminEmails(setAdminEmails);
    const unsubReferrals = subscribeAllReferralsForAdmin(setReferrals);
    const unsubCoupons = subscribeAllCouponsForAdmin(setCoupons);
    const unsubCustomMethods = subscribeAllPlatformPaymentMethodsForAdmin(setCustomPaymentMethods);
    const unsubSalesMethods = subscribeAllSalesPaymentMethodsForAdmin(setSalesPaymentMethods);
    const unsubClaims = subscribeAllStoreOwnerClaimsForAdmin(setOwnerClaims);
    return () => {
      unsubStores();
      unsubPayments();
      unsubEmails();
      unsubReferrals();
      unsubCoupons();
      unsubCustomMethods();
      unsubSalesMethods();
      unsubClaims();
    };
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    if (!isAuthorizedAdmin || stores.length === 0) return;
    fetchStoreOwnerEmailsForAdmin(stores, payments).then(setOwnerEmailMap);
    fetchAllStoresSubscriptionMethodsForAdmin(stores).then(setStoreSubMethodsMap);
    if (!selectedIndividualStoreId && stores[0]) {
      setSelectedIndividualStoreId(stores[0].id);
    }
    if (!selectedSubStoreId && stores[0]) {
      setSelectedSubStoreId(stores[0].id);
    }
  }, [isAuthorizedAdmin, stores, payments, selectedIndividualStoreId, selectedSubStoreId]);

  useEffect(() => {
    if (!isAuthorizedAdmin || !selectedSubStoreId) return;
    const unsub = subscribeStoreSubscriptionMethodsForAdmin(selectedSubStoreId, (list) => {
      setStoreSubMethodsMap((prev) => ({
        ...prev,
        [selectedSubStoreId]: list,
      }));
    });
    return () => unsub();
  }, [isAuthorizedAdmin, selectedSubStoreId]);

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

  const resetPaymentMethodForm = () => {
    setEditingMethodTarget(null);
    setPmName('');
    setPmCurrency('USD');
    setPmHolder('');
    setPmDetails('');
    setPmInstructions('');
    setPmActive(true);
  };

  const handleSaveManualPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await savePlatformPaymentMethod(
        {
          id: editingMethodTarget?.id,
          name: pmName,
          currency: pmCurrency,
          accountHolder: pmHolder,
          accountDetails: pmDetails,
          instructions: pmInstructions,
          isActive: pmActive,
        },
        editingMethodTarget || undefined
      );
      showNotice(
        editingMethodTarget
          ? `Método de pago "${pmName}" actualizado en platform_billing.`
          : `Método de pago "${pmName}" guardado en platform_billing. Ya está disponible en el flujo de compra de suscripción.`
      );
      resetPaymentMethodForm();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error guardando método de pago.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleTogglePaymentMethodActive = async (method: PlatformPaymentMethod) => {
    setIsBusy(true);
    try {
      await togglePlatformPaymentMethodActive(method, !method.isActive);
      showNotice(`Método "${method.name}" ${!method.isActive ? 'activado' : 'pausado'}.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error cambiando estado del método.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeletePaymentMethod = async (method: PlatformPaymentMethod) => {
    setIsBusy(true);
    try {
      await deletePlatformPaymentMethod(method.id);
      setConfirmDeleteMethodId(null);
      if (editingMethodTarget?.id === method.id) {
        resetPaymentMethodForm();
      }
      showNotice(`Método de cobro de suscripción "${method.name}" eliminado.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error eliminando método.');
    } finally {
      setIsBusy(false);
    }
  };

  const resetStoreSubMethodForm = () => {
    setEditingStoreSubTarget(null);
    setSsPmName('');
    setSsPmCurrency('USD');
    setSsPmHolder('');
    setSsPmDetails('');
    setSsPmInstructions('');
    setSsPmActive(true);
  };

  const openStoreSubscriptionModal = (store: StoreTenant) => {
    setSelectedSubStoreId(store.id);
    resetStoreSubMethodForm();
    setConfirmDeleteStoreSubId(null);
    setShowStoreSubMethodsModal(true);
  };

  const handleSaveStoreSubMethod = async (e: React.FormEvent, targetStore: StoreTenant) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await saveStoreSubscriptionPaymentMethod(
        targetStore,
        {
          id: editingStoreSubTarget?.id,
          name: ssPmName,
          currency: ssPmCurrency,
          accountHolder: ssPmHolder,
          accountDetails: ssPmDetails,
          instructions: ssPmInstructions,
          isActive: ssPmActive,
        },
        editingStoreSubTarget || undefined
      );
      showNotice(
        editingStoreSubTarget
          ? `Método "${ssPmName}" actualizado para cobrar suscripción a "${targetStore.storeName}".`
          : `Método "${ssPmName}" asignado manualmente a "${targetStore.storeName}" para cobrar su suscripción.`
      );
      resetStoreSubMethodForm();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Error guardando método de suscripción para la tienda.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleStoreSubMethodActive = async (
    targetStore: StoreTenant,
    method: StoreSubscriptionPaymentMethod
  ) => {
    setIsBusy(true);
    try {
      await toggleStoreSubscriptionPaymentMethodActive(targetStore, method, !method.isActive);
      showNotice(
        `Método "${method.name}" (${targetStore.storeName}) ${!method.isActive ? 'activado' : 'pausado'}.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error cambiando estado del método.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteStoreSubMethod = async (
    targetStore: StoreTenant,
    method: StoreSubscriptionPaymentMethod
  ) => {
    setIsBusy(true);
    try {
      await deleteStoreSubscriptionPaymentMethod(targetStore.id, method.id);
      setConfirmDeleteStoreSubId(null);
      if (editingStoreSubTarget?.id === method.id) {
        resetStoreSubMethodForm();
      }
      showNotice(`Método "${method.name}" eliminado de "${targetStore.storeName}".`);
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Error eliminando método de suscripción de la tienda.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const resetSalesMethodForm = () => {
    setEditingSalesMethodTarget(null);
    setSpName('');
    setSpCurrency('USD');
    setSpAppliesIgtf(true);
    setSpDescription('');
    setSpActive(true);
  };

  const handleSaveSalesPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await saveSalesPaymentMethod(
        {
          id: editingSalesMethodTarget?.id,
          name: spName,
          currency: spCurrency,
          appliesIgtf: spAppliesIgtf,
          description: spDescription,
          isActive: spActive,
        },
        editingSalesMethodTarget || undefined
      );
      showNotice(
        editingSalesMethodTarget
          ? `Método para ventas "${spName}" actualizado correctamente.`
          : `Método para ventas "${spName}" guardado. Ya aparece disponible para los dueños de tiendas al registrar ventas.`
      );
      resetSalesMethodForm();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error guardando método para ventas.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleSalesMethodActive = async (method: SalesPaymentMethod) => {
    setIsBusy(true);
    try {
      await toggleSalesPaymentMethodActive(method, !method.isActive);
      showNotice(
        `Método de venta "${method.name}" ${!method.isActive ? 'activado' : 'pausado'} para tiendas.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error actualizando estado.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSalesMethod = async (method: SalesPaymentMethod) => {
    setIsBusy(true);
    try {
      await deleteSalesPaymentMethod(method.id);
      setConfirmDeleteSalesMethodId(null);
      if (editingSalesMethodTarget?.id === method.id) {
        resetSalesMethodForm();
      }
      showNotice(`Método para ventas "${method.name}" eliminado.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Error eliminando método para ventas.');
    } finally {
      setIsBusy(false);
    }
  };

  const openCreateManualOwnerModal = () => {
    setEditingStoreTarget(null);
    setManualOwnerName('');
    setManualOwnerEmail('');
    setManualWhatsapp('+58 ');
    setManualStoreName('');
    setManualRif('');
    setManualCategory('Comercio General');
    setManualStatus('active');
    setManualWarehousePos(true);
    setManualNationalShipping(true);
    setManualLocalDelivery(true);
    setManualPickupEnabled(true);
    setShowOwnerModal(true);
  };

  const openEditManualOwnerModal = (store: StoreTenant) => {
    setEditingStoreTarget(store);
    setManualOwnerName(store.registeredOwnerName);
    setManualOwnerEmail(ownerEmailMap[store.id] || '');
    setManualWhatsapp(store.businessWhatsapp || '+58 ');
    setManualStoreName(store.storeName);
    setManualRif(store.rif || '');
    setManualCategory(store.category || 'Comercio General');
    setManualStatus(store.status);
    setManualWarehousePos(Boolean(store.warehousePosEnabled));
    setManualNationalShipping(store.nationalShippingEnabled);
    setManualLocalDelivery(store.localDeliveryEnabled);
    setManualPickupEnabled(store.pickupEnabled);
    setShowOwnerModal(true);
  };

  const handleSubmitManualStoreOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsBusy(true);
    try {
      if (editingStoreTarget) {
        const claim = ownerClaims.find((c) => c.storeId === editingStoreTarget.id) || null;
        await adminUpdateStoreAndOwner(
          editingStoreTarget,
          {
            registeredOwnerName: manualOwnerName,
            ownerEmail: manualOwnerEmail,
            businessWhatsapp: manualWhatsapp,
            storeName: manualStoreName,
            rif: manualRif,
            category: manualCategory,
          },
          claim
        );
        setOwnerEmailMap((prev) => ({
          ...prev,
          [editingStoreTarget.id]: manualOwnerEmail.trim().toLowerCase(),
        }));
        showNotice(
          `Datos del dueño "${manualOwnerName}" y tienda "${manualStoreName}" actualizados correctamente.`
        );
      } else {
        const { store } = await adminCreateStoreWithOwner(user, {
          registeredOwnerName: manualOwnerName,
          ownerEmail: manualOwnerEmail,
          businessWhatsapp: manualWhatsapp,
          storeName: manualStoreName,
          rif: manualRif,
          category: manualCategory,
          status: manualStatus,
          warehousePosEnabled: manualWarehousePos,
          nationalShippingEnabled: manualNationalShipping,
          localDeliveryEnabled: manualLocalDelivery,
          pickupEnabled: manualPickupEnabled,
        });
        setOwnerEmailMap((prev) => ({
          ...prev,
          [store.id]: manualOwnerEmail.trim().toLowerCase(),
        }));
        showNotice(
          `Dueño "${manualOwnerName}" (${manualOwnerEmail.trim().toLowerCase()}) y tienda "${store.storeName}" registrados manualmente. Al iniciar sesión con ese correo Google heredará el control total.`
        );
      }
      setShowOwnerModal(false);
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Error guardando persona dueña y tienda.'
      );
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
          <GoogleAuthButton
            label={`${t.admin.gateBtn} (${SUPER_ADMIN_EMAIL})`}
            variant="primary"
            fullWidth
          />
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
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-3">
              <GoogleAuthButton
                label={t.admin.switchGoogle}
                variant="amber"
                showDeviceNotice={false}
              />
              <button
                onClick={() => signOutAccount()}
                className="px-4 py-2.5 min-h-[48px] rounded-xl bg-[#111114] border border-white/[0.1] text-zinc-300 text-xs"
              >
                {t.admin.closeSession}
              </button>
            </div>
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
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 w-full min-w-0">
      {/* Top Admin Header */}
      <div className="bg-[#111114]/95 border border-amber-500/35 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-white font-display">
              {t.admin.panelTitle}
            </h1>
            <p className="text-xs text-zinc-400 break-words">
              {t.admin.verifiedSession}{' '}
              <span className="font-mono text-emerald-300 break-all">{user.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto md:justify-end">
          <button
            disabled={isBusy}
            onClick={handleToggleGlobalWarehousePos}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-colors min-h-[40px] whitespace-nowrap ${
              billing.warehousePosEnabled
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-[#09090b] border-white/[0.1] text-zinc-300 hover:border-amber-500/40'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>{billing.warehousePosEnabled ? t.admin.whGlobalOn : t.admin.whGlobalOff}</span>
          </button>

          {onOpenWarehouseApp && (
            <button
              onClick={() => onOpenWarehouseApp(stores[0]?.id)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>{t.admin.openWhAdmin}</span>
            </button>
          )}

          <button
            onClick={() => signOutAccount()}
            className="px-4 py-2 rounded-xl bg-[#09090b] border border-white/[0.1] hover:border-red-500/40 text-xs text-zinc-300 flex items-center justify-center gap-2 min-h-[40px] whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
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
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/[0.08] pb-3">
        <button
          onClick={() => setActiveTab('stores')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'stores'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span>
            {t.admin.tabStores} ({stores.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>
            {t.admin.tabPayments} ({pendingPaymentsCount})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sub_methods')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'sub_methods'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Métodos Suscripción ({customPaymentMethods.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'billing'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Cobro Suscripción (${billing.monthlyPriceUSD})</span>
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'emails'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Mail className="w-4 h-4 shrink-0" />
          <span>{t.admin.tabEmails}</span>
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'referrals'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Gift className="w-4 h-4 shrink-0" />
          <span>
            {t.admin.tabReferrals} ({referrals.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('vector')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'vector'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>Centro Vector</span>
        </button>
        <button
          onClick={() => setActiveTab('sales_methods')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'sales_methods'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Métodos Pago Ventas ({salesPaymentMethods.length})</span>
        </button>
      </div>

      {/* ADMIN TAB 1: MANUAL ACCOUNT ACTIVATION & MANUAL STORE OWNERS */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 justify-between lg:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.admin.searchPlaceholder}
                className="w-full pl-9 pr-4 py-2.5 min-h-[42px] bg-[#111114] border border-white/[0.08] rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(['all', 'pending', 'active', 'suspended'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStoreFilter(st)}
                  className={`px-3 py-2 min-h-[40px] rounded-lg font-semibold whitespace-nowrap ${
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

              <button
                type="button"
                onClick={openCreateManualOwnerModal}
                className="px-4 py-2 min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Registrar Dueño y Tienda</span>
              </button>
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
              {t.admin.noStores}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStores.map((store) => {
                const pendingClaim = ownerClaims.find(
                  (c) => c.storeId === store.id && c.status === 'pending_claim'
                );
                return (
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
                          {pendingClaim && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300">
                              Por vincular Google
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {t.merchant.ownerPrefix}: {store.registeredOwnerName} · RIF:{' '}
                          {store.rif || t.merchant.noRif} · WhatsApp: {store.businessWhatsapp}
                          {ownerEmailMap[store.id] ? ` · ${ownerEmailMap[store.id]}` : ''}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono flex flex-wrap gap-2">
                          <span>
                            /tienda/{store.slug} · ${store.subscriptionPriceUSD}/mo
                          </span>
                          <span
                            className={
                              (storeSubMethodsMap[store.id] || []).filter((m) => m.isActive).length > 0
                                ? 'text-emerald-300 font-semibold'
                                : 'text-zinc-400'
                            }
                          >
                            ·{' '}
                            {(storeSubMethodsMap[store.id] || []).length > 0
                              ? `Cobro Suscripción: ${(storeSubMethodsMap[store.id] || []).filter((m) => m.isActive).length}/${(storeSubMethodsMap[store.id] || []).length} asignados`
                              : 'Cobro Suscripción: Global'}
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
                        onClick={() => openStoreSubscriptionModal(store)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] border whitespace-nowrap ${
                          (storeSubMethodsMap[store.id] || []).length > 0
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                            : 'bg-[#09090b] border-white/[0.1] hover:border-amber-400 text-zinc-200'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          Cobro Suscripción
                          {(storeSubMethodsMap[store.id] || []).length > 0
                            ? ` (${(storeSubMethodsMap[store.id] || []).length})`
                            : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditManualOwnerModal(store)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] bg-[#09090b] border border-white/[0.1] hover:border-amber-400 text-zinc-200 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Editar Dueño</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('individual');
                          setSelectedIndividualStoreId(store.id);
                          setActiveTab('emails');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] bg-[#09090b] border border-white/[0.1] hover:border-amber-400 text-amber-300 whitespace-nowrap"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{t.admin.emailQuickBtn}</span>
                      </button>

                      <button
                        disabled={isBusy}
                        onClick={() => handleToggleStoreWarehousePos(store)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] border whitespace-nowrap ${
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
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.admin.activateAccount}</span>
                        </button>
                      )}
                      {store.status !== 'suspended' && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleToggleStoreStatus(store, 'suspended')}
                          className="px-4 py-2 rounded-xl bg-red-600/85 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
                        >
                          <Power className="w-4 h-4" />
                          <span>{t.admin.deactivateAccount}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual Store Owner Creation / Editing Modal */}
          {showOwnerModal && (
            <div
              className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom"
              onClick={() => setShowOwnerModal(false)}
            >
              <form
                onSubmit={handleSubmitManualStoreOwner}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111114] border-t sm:border border-amber-500/35 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto"
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-display">
                        {editingStoreTarget
                          ? `Editar Dueño y Tienda · ${editingStoreTarget.storeName}`
                          : 'Registrar Dueño de Tienda Manualmente'}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        {editingStoreTarget
                          ? 'Actualiza los datos personales de contacto del propietario y su negocio.'
                          : 'Crea la tienda y asigna el correo Google de la persona dueña para que herede su panel al iniciar sesión.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOwnerModal(false)}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center"
                    aria-label="Cerrar modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      Nombre Completo del Dueño *
                    </label>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={manualOwnerName}
                      onChange={(e) => setManualOwnerName(e.target.value)}
                      placeholder="Ej: María Gabriela Rodríguez"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      Correo Google del Dueño *
                    </label>
                    <input
                      required
                      type="email"
                      maxLength={160}
                      value={manualOwnerEmail}
                      onChange={(e) => setManualOwnerEmail(e.target.value)}
                      placeholder="dueno@gmail.com"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      Nombre de la Tienda *
                    </label>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={manualStoreName}
                      onChange={(e) => setManualStoreName(e.target.value)}
                      placeholder="Ej: Bodegón Los Palos Grandes"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      WhatsApp Comercial *
                    </label>
                    <input
                      required
                      type="tel"
                      maxLength={25}
                      value={manualWhatsapp}
                      onChange={(e) => setManualWhatsapp(e.target.value)}
                      placeholder="+58 414 1234567"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">RIF / Cédula (Opcional)</label>
                    <input
                      type="text"
                      maxLength={30}
                      value={manualRif}
                      onChange={(e) => setManualRif(e.target.value)}
                      placeholder="J-50123456-7"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">Categoría</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder="Bodegón, Tecnología, Alimentos..."
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                {!editingStoreTarget && (
                  <div className="space-y-3 border-t border-white/[0.08] pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">Estado Inicial</label>
                        <select
                          value={manualStatus}
                          onChange={(e) => setManualStatus(e.target.value as StoreStatus)}
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        >
                          <option value="active">Activa (Visible en Directorio)</option>
                          <option value="pending">Pendiente de Pago ($25/mes)</option>
                          <option value="suspended">Suspendida</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <label className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl bg-[#09090b] border border-white/[0.1] flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={manualWarehousePos}
                            onChange={(e) => setManualWarehousePos(e.target.checked)}
                            className="accent-amber-500"
                          />
                          <span>Activar Almacén & POS para esta tienda</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <label className="px-3 py-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualNationalShipping}
                          onChange={(e) => setManualNationalShipping(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Envío Nacional</span>
                      </label>
                      <label className="px-3 py-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualLocalDelivery}
                          onChange={(e) => setManualLocalDelivery(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Delivery Local</span>
                      </label>
                      <label className="px-3 py-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualPickupEnabled}
                          onChange={(e) => setManualPickupEnabled(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Retiro en Tienda</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowOwnerModal(false)}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#09090b] border border-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {editingStoreTarget
                        ? 'Guardar Cambios del Dueño'
                        : 'Crear Dueño y Tienda'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ADMIN TAB 2: SUBSCRIPTION PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Métodos de Cobro Activos para Suscripción (${billing.monthlyPriceUSD}/mes)</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {customPaymentMethods.filter((m) => m.isActive).length === 0 ? (
                  <span className="text-amber-300">
                    Aún no has agregado métodos manuales en «Métodos Suscripción». Agrégalos para que los dueños de tienda los seleccionen al pagar.
                  </span>
                ) : (
                  customPaymentMethods
                    .filter((m) => m.isActive)
                    .map((m) => (
                      <span
                        key={`pay-banner-${m.id}`}
                        className="px-2 py-0.5 rounded-md bg-[#09090b] border border-emerald-500/35 text-emerald-300 font-semibold"
                      >
                        {m.name} ({m.currency})
                      </span>
                    ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('sub_methods')}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Configurar Métodos de Pago Manuales</span>
            </button>
          </div>

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
                    {pay.ownerWhatsapp ? ` · WhatsApp: ${pay.ownerWhatsapp}` : ''}
                  </div>
                  {pay.couponCode && (
                    <div className="text-emerald-300 font-mono">
                      🎟 Cupón: {pay.couponCode} (-${pay.discountUSD ?? 0} USD)
                    </div>
                  )}
                  {pay.payerInfo && <div className="text-zinc-400">{pay.payerInfo}</div>}
                  {pay.notes && <div className="text-zinc-400">{pay.notes}</div>}
                  {pay.proofImageUrl && (
                    <div className="pt-1.5 flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPreviewProofUrl(pay.proofImageUrl || null)}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-amber-500/35 hover:border-amber-400 text-amber-300 font-semibold text-[11px]"
                      >
                        <img
                          src={pay.proofImageUrl}
                          alt="Captura de pago"
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span>Ver Captura Adjunta</span>
                      </button>
                    </div>
                  )}
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

          {previewProofUrl && (
            <div
              className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom"
              onClick={() => setPreviewProofUrl(null)}
            >
              <div
                className="bg-[#111114] border-t sm:border border-amber-500/40 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3 max-h-[92dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Captura del Comprobante</span>
                  <button
                    type="button"
                    onClick={() => setPreviewProofUrl(null)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white text-xs font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
                <img
                  src={previewProofUrl}
                  alt="Captura de pago completa"
                  className="w-full max-h-[70dvh] object-contain rounded-xl bg-[#09090b]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADMIN TAB 3: INDIVIDUAL & COLLECTIVE EMAILS TO STORE OWNERS */}
      {activeTab === 'emails' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSendAdminEmails}
            className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5"
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
          <div className="lg:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
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

      {/* ADMIN TAB: DEDICATED SUBSCRIPTION PAYMENT METHODS PANEL */}
      {activeTab === 'sub_methods' && (() => {
        const activeSubCount = customPaymentMethods.filter((m) => m.isActive).length;
        const pausedSubCount = customPaymentMethods.length - activeSubCount;
        const q = subMethodSearch.trim().toLowerCase();
        const filteredSubMethods = customPaymentMethods.filter((m) => {
          const matchesFilter =
            subMethodFilter === 'all' ||
            (subMethodFilter === 'active' ? m.isActive : !m.isActive);
          const matchesSearch =
            !q ||
            m.name.toLowerCase().includes(q) ||
            m.accountHolder.toLowerCase().includes(q) ||
            m.accountDetails.toLowerCase().includes(q) ||
            m.currency.toLowerCase().includes(q);
          return matchesFilter && matchesSearch;
        });

        const subscriptionPresets: Array<{
          name: string;
          currency: PlatformPaymentCurrency;
          detailsPlaceholder: string;
          instructions: string;
        }> = [
          {
            name: 'Pago Móvil',
            currency: 'Bs',
            detailsPlaceholder: 'Banco: Banesco (0134) · Cédula/RIF: J-XXXXXXXX-X · Teléfono: 04XX-XXXXXXX',
            instructions: 'Calcular monto al cambio oficial BCV del día y adjuntar captura o últimos 6 dígitos.',
          },
          {
            name: 'Transferencia Banesco',
            currency: 'Bs',
            detailsPlaceholder: 'Banesco · Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX · RIF: J-XXXXXXXX-X',
            instructions: 'Indicar nombre de la tienda en el concepto y enviar número de referencia.',
          },
          {
            name: 'Binance Pay',
            currency: 'USDT',
            detailsPlaceholder: 'Binance Pay ID: XXXXXXXXX · Correo: pagos@tudominio.com · Red USDT BEP20/TRC20',
            instructions: `Enviar exactamente $${billing.monthlyPriceUSD} USDT netos e indicar Order ID o correo Binance.`,
          },
          {
            name: 'Zelle',
            currency: 'USD',
            detailsPlaceholder: 'Correo Zelle: pagos@tuempresa.com',
            instructions: 'Colocar únicamente el nombre de tu tienda en el memo/concepto de Zelle.',
          },
          {
            name: 'Zinli',
            currency: 'USD',
            detailsPlaceholder: 'Correo Zinli: pagos@tuempresa.com',
            instructions: 'Enviar comprobante con correo emisor y código de transacción.',
          },
          {
            name: 'Bybit Pay',
            currency: 'USDT',
            detailsPlaceholder: 'Bybit UID: XXXXXXXX · Correo interno sin comisión',
            instructions: 'Transferencia interna instantánea en USDT y reportar UID emisor.',
          },
          {
            name: 'Wally',
            currency: 'USD',
            detailsPlaceholder: 'Usuario / Teléfono Wally: +58 4XX-XXXXXXX',
            instructions: 'Adjuntar captura del pago completado.',
          },
          {
            name: 'PayPal',
            currency: 'USD',
            detailsPlaceholder: 'Correo PayPal: pagos@tuempresa.com',
            instructions: 'Cubrir comisión PayPal para acreditar el monto neto de la mensualidad.',
          },
          {
            name: 'Efectivo USD',
            currency: 'USD',
            detailsPlaceholder: 'Pago presencial en taquilla / oficina autorizada',
            instructions: 'Coordinar entrega previa vía WhatsApp oficial para emitir recibo.',
          },
        ];

        const presetPlaceholderSet = new Set(subscriptionPresets.map((p) => p.detailsPlaceholder));
        const applyPresetDetails = (prev: string, nextPlaceholder: string) =>
          !prev.trim() || presetPlaceholderSet.has(prev.trim()) ? nextPlaceholder : prev;

        const selectedSubStore =
          stores.find((s) => s.id === selectedSubStoreId) || stores[0] || null;
        const selectedStoreSubMethods = selectedSubStore
          ? storeSubMethodsMap[selectedSubStore.id] || []
          : [];
        const totalPerStoreMethodsCount = Object.values(storeSubMethodsMap).reduce(
          (sum, arr) => sum + arr.length,
          0
        );

        return (
          <div className="space-y-6">
            {/* Sub-scope Switcher: Global vs Per-Registered-Store */}
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubMethodsScope('global')}
                  className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                    subMethodsScope === 'global'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-[#09090b] border border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Métodos Globales ({customPaymentMethods.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubMethodsScope('per_store')}
                  className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                    subMethodsScope === 'per_store'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-[#09090b] border border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  <Store className="w-4 h-4 shrink-0" />
                  <span>Por Tienda Registrada ({totalPerStoreMethodsCount})</span>
                </button>
              </div>
              <span className="text-[11px] text-zinc-400 px-2">
                {subMethodsScope === 'global'
                  ? 'Aplican a todas las tiendas en el flujo de suscripción'
                  : 'Asigna cuentas o billeteras exclusivas para cobrar a cada tienda'}
              </span>
            </div>

            {subMethodsScope === 'per_store' ? (
              <div className="space-y-6">
                {/* Store Selector Card */}
                <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                      <Store className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>Cobro Manual de Suscripción por Cada Tienda Registrada</span>
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-2xl">
                      Selecciona una tienda registrada y configura de forma manual los métodos de pago específicos para cobrar su suscripción mensual (${billing.monthlyPriceUSD}/mes). La tienda los verá prioritariamente en su portal de suscripción.
                    </p>
                  </div>

                  {stores.length > 0 && (
                    <div className="min-w-[260px]">
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Tienda Registrada Seleccionada *
                      </label>
                      <select
                        value={selectedSubStore?.id || ''}
                        onChange={(e) => {
                          setSelectedSubStoreId(e.target.value);
                          resetStoreSubMethodForm();
                          setConfirmDeleteStoreSubId(null);
                        }}
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-amber-500/40 rounded-xl text-xs text-white font-semibold"
                      >
                        {stores.map((s) => {
                          const cnt = (storeSubMethodsMap[s.id] || []).length;
                          return (
                            <option key={s.id} value={s.id}>
                              {s.storeName} — {s.registeredOwnerName} ({cnt} método{cnt === 1 ? '' : 's'})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {!selectedSubStore ? (
                  <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
                    No hay tiendas registradas todavía para asignar métodos de cobro de suscripción.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <form
                      onSubmit={(e) => handleSaveStoreSubMethod(e, selectedSubStore)}
                      className="lg:col-span-5 min-w-0 bg-[#111114] border border-amber-500/25 rounded-2xl p-5 sm:p-6 space-y-4 h-fit"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                            <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              {editingStoreSubTarget
                                ? `Editar Método (${selectedSubStore.storeName})`
                                : `Añadir Método para "${selectedSubStore.storeName}"`}
                            </span>
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Dueño: {selectedSubStore.registeredOwnerName}
                            {ownerEmailMap[selectedSubStore.id]
                              ? ` · ${ownerEmailMap[selectedSubStore.id]}`
                              : ''}
                          </p>
                        </div>
                        {editingStoreSubTarget && (
                          <button
                            type="button"
                            onClick={resetStoreSubMethodForm}
                            className="text-xs text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.08] shrink-0"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>

                      {!editingStoreSubTarget && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-zinc-400">Plantillas rápidas:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {subscriptionPresets.map((preset) => (
                              <button
                                key={`sub-store-${preset.name}`}
                                type="button"
                                onClick={() => {
                                  setSsPmName(preset.name);
                                  setSsPmCurrency(preset.currency);
                                  setSsPmDetails((prev) =>
                                    applyPresetDetails(prev, preset.detailsPlaceholder)
                                  );
                                  setSsPmInstructions(preset.instructions);
                                  setSsPmActive(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-[11px] text-zinc-200 font-medium transition-colors whitespace-nowrap"
                              >
                                + {preset.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-xs text-zinc-300 block mb-1">
                            Nombre del Método *
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={80}
                            value={ssPmName}
                            onChange={(e) => setSsPmName(e.target.value)}
                            placeholder="Ej: Zelle / Pago Móvil / Binance Pay"
                            className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-300 block mb-1">Moneda *</label>
                          <select
                            value={ssPmCurrency}
                            onChange={(e) =>
                              setSsPmCurrency(e.target.value as PlatformPaymentCurrency)
                            }
                            className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                          >
                            <option value="USD">USD</option>
                            <option value="USDT">USDT</option>
                            <option value="Bs">Bs.</option>
                            <option value="EUR">EUR</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          Titular / Beneficiario
                        </label>
                        <input
                          type="text"
                          maxLength={120}
                          value={ssPmHolder}
                          onChange={(e) => setSsPmHolder(e.target.value)}
                          placeholder="Ej: Inversiones Alhadiqa Invest C.A."
                          className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          Datos de Cobro Asignados a esta Tienda *
                        </label>
                        <textarea
                          required
                          rows={3}
                          maxLength={300}
                          value={ssPmDetails}
                          onChange={(e) => setSsPmDetails(e.target.value)}
                          placeholder="Cuenta bancaria, teléfono Pago Móvil, correo Zelle o Binance Pay ID"
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          Instrucciones para esta Tienda (Opcional)
                        </label>
                        <input
                          type="text"
                          maxLength={400}
                          value={ssPmInstructions}
                          onChange={(e) => setSsPmInstructions(e.target.value)}
                          placeholder="Ej: Enviar captura o número de referencia al pagar mensualidad"
                          className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        />
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={ssPmActive}
                          onChange={(e) => setSsPmActive(e.target.checked)}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>Activo para cobrar la suscripción de esta tienda</span>
                      </label>

                      <button
                        type="submit"
                        disabled={isBusy}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>
                          {editingStoreSubTarget
                            ? 'Actualizar Método de esta Tienda'
                            : 'Guardar Método para esta Tienda'}
                        </span>
                      </button>
                    </form>

                    <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                      <div className="border-b border-white/[0.08] pb-3.5">
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Métodos Asignados a "{selectedSubStore.storeName}" (
                          {selectedStoreSubMethods.length})
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Estos métodos se guardan en Firestore por tienda y aparecen automáticamente en su checkout de suscripción.
                        </p>
                      </div>

                      {selectedStoreSubMethods.length === 0 ? (
                        <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-2">
                          <CreditCard className="w-8 h-8 text-zinc-600 mx-auto" />
                          <p className="text-xs font-semibold text-zinc-300">
                            "{selectedSubStore.storeName}" aún usa únicamente los métodos globales
                          </p>
                          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                            Usa el formulario a la izquierda para asignarle métodos de cobro manuales exclusivos para su suscripción.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedStoreSubMethods.map((method) => (
                            <div
                              key={method.id}
                              className="p-4 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                            >
                              <div className="space-y-1.5 text-xs min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-white text-sm">
                                    {method.name}
                                  </span>
                                  <span className="text-zinc-500" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-amber-300 font-mono text-[11px] font-bold">
                                    {method.currency}
                                  </span>
                                  <span className="text-zinc-500" aria-hidden="true">
                                    ·
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                      method.isActive ? 'text-emerald-300' : 'text-zinc-400'
                                    }`}
                                  >
                                    {method.isActive ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5" />
                                    )}
                                    <span>{method.isActive ? 'Activo' : 'Pausado'}</span>
                                  </span>
                                </div>
                                {method.accountHolder && (
                                  <div className="text-zinc-400">
                                    Titular:{' '}
                                    <span className="text-zinc-200">{method.accountHolder}</span>
                                  </div>
                                )}
                                <div className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                                  {method.accountDetails}
                                </div>
                                {method.instructions && (
                                  <div className="text-zinc-400 text-[11px]">
                                    {method.instructions}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleToggleStoreSubMethodActive(selectedSubStore, method)
                                  }
                                  className={`px-3 py-2 min-h-[38px] rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                                    method.isActive
                                      ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                                      : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                                  }`}
                                >
                                  {method.isActive ? 'Pausar' : 'Activar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStoreSubTarget(method);
                                    setSsPmName(method.name);
                                    setSsPmCurrency(method.currency);
                                    setSsPmHolder(method.accountHolder);
                                    setSsPmDetails(method.accountDetails);
                                    setSsPmInstructions(method.instructions || '');
                                    setSsPmActive(method.isActive);
                                  }}
                                  className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                                  title="Editar método"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {confirmDeleteStoreSubId === method.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleDeleteStoreSubMethod(selectedSubStore, method)
                                      }
                                      className="px-2.5 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteStoreSubId(null)}
                                      className="px-2 py-2 min-h-[38px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteStoreSubId(method.id)}
                                    className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                                    title="Eliminar método"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
            {/* Panel Header with Quantitative Counters */}
            <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Métodos de Pago para que los Clientes Compren la Suscripción</span>
                </h2>
                <p className="text-xs text-zinc-400 max-w-3xl">
                  Agrega, edita, activa o elimina las cuentas y billeteras aceptadas (Binance, Zelle, Transferencia, Pago Móvil, Zinli, Bybit, PayPal, etc.). Se guardan en tiempo real en la colección <span className="font-mono text-amber-300">platform_billing</span> de Firestore para mostrarse al instante en el flujo de compra de suscripción (${billing.monthlyPriceUSD}/mes).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
                <div className="px-3.5 py-2 rounded-xl bg-[#09090b] border border-white/[0.08] font-mono tabular-nums">
                  <span className="text-zinc-400">Activos:</span>{' '}
                  <strong className="text-emerald-300">{activeSubCount}</strong>
                  <span className="text-zinc-600 mx-1.5">·</span>
                  <span className="text-zinc-400">Pausados:</span>{' '}
                  <strong className="text-zinc-200">{pausedSubCount}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/40 text-xs font-semibold text-amber-300 whitespace-nowrap"
                >
                  Precio (${billing.monthlyPriceUSD}/mes) y WhatsApp
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Form: Add / Edit Subscription Payment Method */}
              <form
                onSubmit={handleSaveManualPaymentMethod}
                className="lg:col-span-5 min-w-0 bg-[#111114] border border-amber-500/25 rounded-2xl p-5 sm:p-6 space-y-4 h-fit"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {editingMethodTarget
                          ? `Editar Método: ${editingMethodTarget.name}`
                          : 'Añadir Método de Pago para Suscripción'}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Los clientes verán estos datos y podrán seleccionarlos al pagar su plan mensual.
                    </p>
                  </div>
                  {editingMethodTarget && (
                    <button
                      type="button"
                      onClick={resetPaymentMethodForm}
                      className="text-xs text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.08] whitespace-nowrap shrink-0"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {!editingMethodTarget && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-zinc-400">Plantillas rápidas (1 clic para rellenar):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {subscriptionPresets.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setPmName(preset.name);
                            setPmCurrency(preset.currency);
                            setPmDetails((prev) =>
                              applyPresetDetails(prev, preset.detailsPlaceholder)
                            );
                            setPmInstructions(preset.instructions);
                            setPmActive(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-[11px] text-zinc-200 font-medium transition-colors whitespace-nowrap"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-zinc-300 block mb-1">Nombre del Método *</label>
                    <input
                      required
                      type="text"
                      maxLength={80}
                      value={pmName}
                      onChange={(e) => setPmName(e.target.value)}
                      placeholder="Ej: Pago Móvil Banesco / Zelle / Binance Pay"
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">Moneda *</label>
                    <select
                      value={pmCurrency}
                      onChange={(e) => setPmCurrency(e.target.value as PlatformPaymentCurrency)}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="USDT">USDT</option>
                      <option value="Bs">Bs.</option>
                      <option value="EUR">EUR</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Titular / Beneficiario</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={pmHolder}
                    onChange={(e) => setPmHolder(e.target.value)}
                    placeholder="Ej: Inversiones Alhadiqa Invest C.A."
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    Datos de Cobro para el Cliente (Cuenta, Teléfono, Correo o Wallet) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={300}
                    value={pmDetails}
                    onChange={(e) => setPmDetails(e.target.value)}
                    placeholder="Ej: 0134 Banesco · V-XX.XXX.XXX · 0414-XXXXXXX"
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    Instrucciones de Compra (Opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={400}
                    value={pmInstructions}
                    onChange={(e) => setPmInstructions(e.target.value)}
                    placeholder="Ej: Indicar nombre de tienda y reportar referencia o captura"
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={pmActive}
                    onChange={(e) => setPmActive(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>Visible y disponible para que los clientes compren la suscripción</span>
                </label>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 text-center"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingMethodTarget
                      ? 'Actualizar Método de Suscripción'
                      : 'Guardar Método de Suscripción'}
                  </span>
                </button>
              </form>

              {/* Right Column: Search, Filter & Methods List */}
              <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-display">
                      Métodos Configurados para Compra de Suscripción ({customPaymentMethods.length})
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Cada método activo se muestra automáticamente en el checkout de suscripción de los clientes.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#09090b] border border-white/[0.08] rounded-lg text-[11px] shrink-0">
                    {([
                      { id: 'all', label: 'Todos' },
                      { id: 'active', label: 'Activos' },
                      { id: 'paused', label: 'Pausados' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSubMethodFilter(opt.id)}
                        className={`px-2.5 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
                          subMethodFilter === opt.id
                            ? 'bg-amber-500 text-zinc-950'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {customPaymentMethods.length > 2 && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={subMethodSearch}
                      onChange={(e) => setSubMethodSearch(e.target.value)}
                      placeholder="Buscar por método, moneda, titular o cuenta..."
                      className="w-full pl-9 pr-4 py-2 min-h-[40px] bg-[#09090b] border border-white/[0.08] rounded-xl text-xs text-white"
                    />
                  </div>
                )}

                {filteredSubMethods.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-2">
                    <CreditCard className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">
                      {customPaymentMethods.length === 0
                        ? 'Aún no has agregado métodos de pago personalizados para la suscripción'
                        : 'No hay métodos que coincidan con tu búsqueda o filtro'}
                    </p>
                    <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                      Usa el formulario y las plantillas rápidas a la izquierda para registrar Pago Móvil, Binance Pay, Zelle, Zinli o transferencia bancaria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSubMethods.map((method) => (
                      <div
                        key={method.id}
                        className="p-4 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 text-xs min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-sm">{method.name}</span>
                            <span className="text-zinc-500" aria-hidden="true">·</span>
                            <span className="text-amber-300 font-mono text-[11px] font-bold">
                              {method.currency}
                            </span>
                            <span className="text-zinc-500" aria-hidden="true">·</span>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                method.isActive ? 'text-emerald-300' : 'text-zinc-400'
                              }`}
                            >
                              {method.isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>{method.isActive ? 'Activo para clientes' : 'Pausado'}</span>
                            </span>
                          </div>
                          {method.accountHolder && (
                            <div className="text-zinc-400">
                              Titular: <span className="text-zinc-200">{method.accountHolder}</span>
                            </div>
                          )}
                          <div className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                            {method.accountDetails}
                          </div>
                          {method.instructions && (
                            <div className="text-zinc-400 text-[11px]">{method.instructions}</div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTogglePaymentMethodActive(method)}
                            className={`px-3 py-2 min-h-[38px] rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                              method.isActive
                                ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                                : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                            }`}
                          >
                            {method.isActive ? 'Pausar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMethodTarget(method);
                              setPmName(method.name);
                              setPmCurrency(method.currency);
                              setPmHolder(method.accountHolder);
                              setPmDetails(method.accountDetails);
                              setPmInstructions(method.instructions || '');
                              setPmActive(method.isActive);
                            }}
                            className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                            title="Editar método"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteMethodId === method.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeletePaymentMethod(method)}
                                className="px-2.5 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMethodId(null)}
                                className="px-2 py-2 min-h-[38px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMethodId(method.id)}
                              className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                              title="Eliminar método"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ADMIN TAB 5: PLATFORM SUBSCRIPTION BILLING SETTINGS (PRICE, SUPPORT WHATSAPP & BASE ACCOUNTS) */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>Parámetros de Suscripción SaaS (${billing.monthlyPriceUSD}/mes)</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Define el precio mensual, bono por referido y WhatsApp de soporte. Los métodos de pago manuales configurados en{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('sub_methods')}
                  className="text-amber-300 underline hover:text-amber-200 font-semibold"
                >
                  Métodos Suscripción ({customPaymentMethods.length})
                </button>{' '}
                se muestran directamente a los dueños de tienda para pagar su suscripción.
              </p>
              {customPaymentMethods.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {customPaymentMethods.map((m) => (
                    <span
                      key={`billing-summary-${m.id}`}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        m.isActive
                          ? 'bg-emerald-950/40 border-emerald-500/35 text-emerald-300'
                          : 'bg-[#09090b] border-white/[0.08] text-zinc-400'
                      }`}
                    >
                      {m.name} ({m.currency}) {m.isActive ? '' : '· Pausado'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('sub_methods')}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Configurar Métodos Manuales ({customPaymentMethods.length})</span>
              </button>
            </div>
          </div>

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
        </div>
      )}

      {/* ADMIN TAB 6: CUSTOM PAYMENT METHODS FOR STORE SALES REGISTRATION */}
      {activeTab === 'sales_methods' && (
        <div className="space-y-6">
          <div className="bg-[#111114] border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span>Métodos de Pago Personalizados para Registro de Ventas de Tiendas</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Agrega, edita o elimina opciones globales (ej: Binance Pay, Zinli, Transferencia Banesco, Zelle, Wally, Cashea) para que los dueños de tiendas las seleccionen automáticamente en Caja POS y en Ventas Directas. Cada dueño además configura manualmente sus propios datos de cobro desde su portal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveSalesPaymentMethod}
              className="lg:col-span-5 min-w-0 bg-[#111114] border border-amber-500/25 rounded-2xl p-5 sm:p-6 space-y-4 h-fit"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {editingSalesMethodTarget
                        ? `Editar Método: ${editingSalesMethodTarget.name}`
                        : 'Agregar Método de Pago para Ventas'}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Define el nombre, moneda y si aplica IGTF 3% divisas para las ventas de los comercios.
                  </p>
                </div>
                {editingSalesMethodTarget && (
                  <button
                    type="button"
                    onClick={resetSalesMethodForm}
                    className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-[#09090b]"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {!editingSalesMethodTarget && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">Plantillas rápidas:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Binance Pay', currency: 'USDT' as PlatformPaymentCurrency, igtf: false, desc: 'Pago cripto en USDT sin comisión bancaria' },
                      { name: 'Zinli', currency: 'USD' as PlatformPaymentCurrency, igtf: true, desc: 'Billetera digital USD prepagada' },
                      { name: 'Transferencia Banesco', currency: 'Bs' as PlatformPaymentCurrency, igtf: false, desc: 'Transferencia bancaria nacional en Bolívares' },
                      { name: 'Zelle', currency: 'USD' as PlatformPaymentCurrency, igtf: true, desc: 'Transferencia instantánea en USD' },
                      { name: 'Wally', currency: 'USD' as PlatformPaymentCurrency, igtf: true, desc: 'Billetera digital USD Banesco Panamá' },
                      { name: 'Cashea', currency: 'USD' as PlatformPaymentCurrency, igtf: false, desc: 'Compra ahora y paga en cuotas' },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setSpName(preset.name);
                          setSpCurrency(preset.currency);
                          setSpAppliesIgtf(preset.igtf);
                          setSpDescription(preset.desc);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-[11px] text-zinc-200 font-medium transition-colors"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-300 block mb-1">Nombre del Método *</label>
                  <input
                    required
                    type="text"
                    maxLength={80}
                    value={spName}
                    onChange={(e) => setSpName(e.target.value)}
                    placeholder="Ej: Binance Pay / Zinli / Transferencia Banesco"
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Moneda *</label>
                  <select
                    value={spCurrency}
                    onChange={(e) => setSpCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="USDT">USDT</option>
                    <option value="Bs">Bs.</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  Descripción / Nota Operativa (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={spDescription}
                  onChange={(e) => setSpDescription(e.target.value)}
                  placeholder="Ej: Acepta USDT TRC20 / correo de billetera o transferencia directa"
                  className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spAppliesIgtf}
                    onChange={(e) => setSpAppliesIgtf(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>Aplica IGTF 3% Divisas (SENIAT) por defecto en POS</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spActive}
                    onChange={(e) => setSpActive(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span>Habilitado como opción para que las tiendas registren ventas</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 text-center"
              >
                <Save className="w-4 h-4" />
                <span>
                  {editingSalesMethodTarget
                    ? 'Actualizar Método de Venta'
                    : 'Agregar Método de Venta'}
                </span>
              </button>
            </form>

            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    Catálogo de Métodos Personalizados para Ventas ({salesPaymentMethods.length})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Todos los métodos activos aparecen automáticamente al registrar ventas en POS y en Ventas Directas de cada tienda.
                  </p>
                </div>
              </div>

              {salesPaymentMethods.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                  <Wallet className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    No has agregado métodos personalizados para ventas aún
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Usa el formulario o las plantillas rápidas a la izquierda (Binance Pay, Zinli, Transferencia Banesco, Zelle).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {salesPaymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="p-4 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">{method.name}</span>
                          <span className="text-amber-300 font-mono text-[11px] font-bold">
                            {method.currency}
                          </span>
                          {method.appliesIgtf && (
                            <span className="text-sky-300 font-mono text-[11px]">
                              · IGTF 3%
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              method.isActive
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {method.isActive ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                        {method.description && (
                          <div className="text-zinc-400 text-[11px]">{method.description}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleSalesMethodActive(method)}
                          className={`px-3 py-2 min-h-[38px] rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                            method.isActive
                              ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                              : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                          }`}
                        >
                          {method.isActive ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSalesMethodTarget(method);
                            setSpName(method.name);
                            setSpCurrency(method.currency);
                            setSpAppliesIgtf(Boolean(method.appliesIgtf));
                            setSpDescription(method.description || '');
                            setSpActive(method.isActive);
                          }}
                          className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                          title="Editar método"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteSalesMethodId === method.id ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteSalesMethod(method)}
                            className="px-2.5 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSalesMethodId(method.id)}
                            className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                            title="Eliminar método"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vector' && user && (
        <AdminVectorHub
          adminUser={user}
          stores={stores}
          ownerEmailMap={ownerEmailMap}
          onNotify={showNotice}
          onError={setErrorNotice}
        />
      )}

      {/* Per-Store Subscription Payment Methods Modal */}
      {showStoreSubMethodsModal && (() => {
        const modalStore = stores.find((s) => s.id === selectedSubStoreId);
        if (!modalStore) return null;
        const modalMethods = storeSubMethodsMap[modalStore.id] || [];
        const modalPresets: Array<{
          name: string;
          currency: PlatformPaymentCurrency;
          detailsPlaceholder: string;
          instructions: string;
        }> = [
          {
            name: 'Pago Móvil',
            currency: 'Bs',
            detailsPlaceholder: 'Banco: Banesco (0134) · RIF/CI · Teléfono: 04XX-XXXXXXX',
            instructions: 'Calcular al cambio oficial BCV del día e indicar referencia.',
          },
          {
            name: 'Transferencia Banesco',
            currency: 'Bs',
            detailsPlaceholder: 'Banesco · Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX',
            instructions: 'Colocar el nombre de la tienda en el concepto.',
          },
          {
            name: 'Binance Pay',
            currency: 'USDT',
            detailsPlaceholder: 'Binance Pay ID / Correo USDT (BEP20/TRC20)',
            instructions: 'Reportar Order ID o correo Binance al finalizar.',
          },
          {
            name: 'Zelle',
            currency: 'USD',
            detailsPlaceholder: 'Correo Zelle asignado a esta tienda',
            instructions: 'Indicar nombre de tu tienda en el concepto del Zelle.',
          },
          {
            name: 'Zinli',
            currency: 'USD',
            detailsPlaceholder: 'Correo Zinli receptor',
            instructions: 'Adjuntar comprobante de transacción.',
          },
          {
            name: 'Efectivo USD',
            currency: 'USD',
            detailsPlaceholder: 'Cobro presencial autorizado',
            instructions: 'Coordinar entrega previa por WhatsApp.',
          },
        ];

        return (
          <div
            className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom"
            onClick={() => setShowStoreSubMethodsModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111114] border-t sm:border border-amber-500/35 rounded-t-3xl sm:rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white font-display truncate">
                      Cobro de Suscripción · {modalStore.storeName}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">
                      Dueño: {modalStore.registeredOwnerName}
                      {ownerEmailMap[modalStore.id] ? ` · ${ownerEmailMap[modalStore.id]}` : ''} · ${modalStore.subscriptionPriceUSD}/mes
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoreSubMethodsModal(false)}
                  className="min-h-[40px] min-w-[40px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center shrink-0"
                  aria-label="Cerrar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <form
                  onSubmit={(e) => handleSaveStoreSubMethod(e, modalStore)}
                  className="lg:col-span-5 min-w-0 bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-3.5 h-fit"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {editingStoreSubTarget
                          ? `Editar: ${editingStoreSubTarget.name}`
                          : 'Agregar Método Manual'}
                      </span>
                    </h4>
                    {editingStoreSubTarget && (
                      <button
                        type="button"
                        onClick={resetStoreSubMethodForm}
                        className="text-[11px] text-zinc-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {!editingStoreSubTarget && (() => {
                    const modalPresetDetails = new Set(
                      modalPresets.map((p) => p.detailsPlaceholder)
                    );
                    return (
                    <div className="flex flex-wrap gap-1.5">
                      {modalPresets.map((preset) => (
                        <button
                          key={`modal-preset-${preset.name}`}
                          type="button"
                          onClick={() => {
                            setSsPmName(preset.name);
                            setSsPmCurrency(preset.currency);
                            setSsPmDetails((prev) =>
                              !prev.trim() || modalPresetDetails.has(prev.trim())
                                ? preset.detailsPlaceholder
                                : prev
                            );
                            setSsPmInstructions(preset.instructions);
                            setSsPmActive(true);
                          }}
                          className="px-2 py-1 rounded-md bg-[#111114] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-[11px] text-zinc-200 whitespace-nowrap"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                    );
                  })()}

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2">
                      <label className="text-[11px] text-zinc-300 block mb-1">Método *</label>
                      <input
                        required
                        type="text"
                        maxLength={80}
                        value={ssPmName}
                        onChange={(e) => setSsPmName(e.target.value)}
                        placeholder="Zelle / Pago Móvil / Binance"
                        className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">Moneda *</label>
                      <select
                        value={ssPmCurrency}
                        onChange={(e) =>
                          setSsPmCurrency(e.target.value as PlatformPaymentCurrency)
                        }
                        className="w-full px-2.5 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                      >
                        <option value="USD">USD</option>
                        <option value="USDT">USDT</option>
                        <option value="Bs">Bs.</option>
                        <option value="EUR">EUR</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      Titular / Beneficiario
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={ssPmHolder}
                      onChange={(e) => setSsPmHolder(e.target.value)}
                      placeholder="Nombre o razón social receptora"
                      className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      Datos de Cobro *
                    </label>
                    <textarea
                      required
                      rows={3}
                      maxLength={300}
                      value={ssPmDetails}
                      onChange={(e) => setSsPmDetails(e.target.value)}
                      placeholder="Cuenta, teléfono, correo Zelle o Binance Pay ID"
                      className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      Instrucciones (Opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={400}
                      value={ssPmInstructions}
                      onChange={(e) => setSsPmInstructions(e.target.value)}
                      placeholder="Indicar referencia o concepto al pagar"
                      className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ssPmActive}
                      onChange={(e) => setSsPmActive(e.target.checked)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>Activo para esta tienda</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {editingStoreSubTarget ? 'Actualizar Método' : 'Guardar Método para Tienda'}
                    </span>
                  </button>
                </form>

                <div className="lg:col-span-7 min-w-0 space-y-3">
                  <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                    <span>
                      Métodos configurados para esta tienda ({modalMethods.length})
                    </span>
                    <span className="text-[11px] font-normal text-zinc-400">
                      Sincronizado con Firestore
                    </span>
                  </div>

                  {modalMethods.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                      <CreditCard className="w-7 h-7 text-zinc-600 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-300">
                        Sin métodos exclusivos asignados todavía
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Agrega manualmente un método a la izquierda para cobrar la suscripción específicamente a {modalStore.storeName}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {modalMethods.map((method) => (
                        <div
                          key={`modal-item-${method.id}`}
                          className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                        >
                          <div className="space-y-1 text-xs min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white">{method.name}</span>
                              <span className="text-zinc-500" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-[11px] text-amber-300 font-bold">
                                {method.currency}
                              </span>
                              <span className="text-zinc-500" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  method.isActive ? 'text-emerald-300' : 'text-zinc-400'
                                }`}
                              >
                                {method.isActive ? 'Activo' : 'Pausado'}
                              </span>
                            </div>
                            {method.accountHolder && (
                              <div className="text-zinc-400 text-[11px]">
                                Titular: <span className="text-zinc-200">{method.accountHolder}</span>
                              </div>
                            )}
                            <div className="text-zinc-200 font-mono text-[11px] whitespace-pre-line">
                              {method.accountDetails}
                            </div>
                            {method.instructions && (
                              <div className="text-zinc-400 text-[11px]">{method.instructions}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleToggleStoreSubMethodActive(modalStore, method)
                              }
                              className={`px-2.5 py-1.5 min-h-[34px] rounded-lg text-[11px] font-bold border ${
                                method.isActive
                                  ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                                  : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                              }`}
                            >
                              {method.isActive ? 'Pausar' : 'Activar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStoreSubTarget(method);
                                setSsPmName(method.name);
                                setSsPmCurrency(method.currency);
                                setSsPmHolder(method.accountHolder);
                                setSsPmDetails(method.accountDetails);
                                setSsPmInstructions(method.instructions || '');
                                setSsPmActive(method.isActive);
                              }}
                              className="p-1.5 min-h-[34px] min-w-[34px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteStoreSubId === method.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleDeleteStoreSubMethod(modalStore, method)
                                  }
                                  className="px-2 py-1.5 min-h-[34px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStoreSubId(null)}
                                  className="px-2 py-1.5 min-h-[34px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 text-[11px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteStoreSubId(method.id)}
                                className="p-1.5 min-h-[34px] min-w-[34px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};
