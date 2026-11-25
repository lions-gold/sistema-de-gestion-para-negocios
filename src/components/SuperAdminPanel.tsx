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
  Video,
  Play,
} from 'lucide-react';
import { AdminVectorHub } from './AdminVectorHub';
import { LanguageSettings } from './LanguageSettings';
import { QrUploadField, QrZoomModal } from './QrCodeModalAndField';
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
  GuideVideoAudience,
  GuideVideoLanguage,
  PlatformGuideVideo,
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
  subscribeAllPlatformGuideVideosForAdmin,
  savePlatformGuideVideo,
  togglePlatformGuideVideoActive,
  deletePlatformGuideVideo,
} from '../services/saasService';
import {
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  extractYouTubeVideoId,
} from '../utils/youtube';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useLanguage } from '../i18n/LanguageContext';
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateCommonPaymentInstruction,
  translatePaymentMethodLabel,
  translateUnconfiguredBillingText,
} from '../utils/platformLabelsI18n';

interface SuperAdminPanelProps {
  onOpenWarehouseApp?: (storeId?: string) => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onOpenWarehouseApp }) => {
  const { lang, t, tr } = useLanguage();
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
  const [guideVideos, setGuideVideos] = useState<PlatformGuideVideo[]>([]);

  const [activeTab, setActiveTab] = useState<
    | 'stores'
    | 'payments'
    | 'emails'
    | 'referrals'
    | 'vector'
    | 'sub_methods'
    | 'billing'
    | 'sales_methods'
    | 'videos'
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
  const [pmQrImageUrl, setPmQrImageUrl] = useState('');
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
  const [ssPmQrImageUrl, setSsPmQrImageUrl] = useState('');
  const [ssPmActive, setSsPmActive] = useState(true);
  const [confirmDeleteStoreSubId, setConfirmDeleteStoreSubId] = useState<string | null>(null);
  const [zoomQrState, setZoomQrState] = useState<{
    qrUrl: string;
    title: string;
    subtitle?: string;
    accountDetails?: string;
  } | null>(null);

  // Admin Custom Sales Payment Methods Form State (for Store Owners recording sales)
  const [editingSalesMethodTarget, setEditingSalesMethodTarget] = useState<SalesPaymentMethod | null>(null);
  const [spName, setSpName] = useState('');
  const [spCurrency, setSpCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [spAppliesIgtf, setSpAppliesIgtf] = useState(true);
  const [spDescription, setSpDescription] = useState('');
  const [spActive, setSpActive] = useState(true);
  const [confirmDeleteSalesMethodId, setConfirmDeleteSalesMethodId] = useState<string | null>(null);

  // Admin YouTube Guide Videos Form State
  const [editingVideoTarget, setEditingVideoTarget] = useState<PlatformGuideVideo | null>(null);
  const [vidTitle, setVidTitle] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidDescription, setVidDescription] = useState('');
  const [vidAudience, setVidAudience] = useState<GuideVideoAudience>('all');
  const [vidLanguage, setVidLanguage] = useState<GuideVideoLanguage>('es');
  const [vidSortOrder, setVidSortOrder] = useState<number>(1);
  const [vidActive, setVidActive] = useState(true);
  const [confirmDeleteVideoId, setConfirmDeleteVideoId] = useState<string | null>(null);
  const [previewAdminVideoId, setPreviewAdminVideoId] = useState<string | null>(null);

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
      setGuideVideos([]);
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
    const unsubGuideVideos = subscribeAllPlatformGuideVideosForAdmin(setGuideVideos);
    return () => {
      unsubStores();
      unsubPayments();
      unsubEmails();
      unsubReferrals();
      unsubCoupons();
      unsubCustomMethods();
      unsubSalesMethods();
      unsubClaims();
      unsubGuideVideos();
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
        tr(
          `Cuenta "${store.storeName}" actualizada manualmente a: ${nextStatus === 'active' ? 'ACTIVA' : 'DESACTIVADA'}.`,
          `Account "${store.storeName}" manually updated to: ${nextStatus === 'active' ? 'ACTIVE' : 'SUSPENDED'}.`,
          `账户 "${store.storeName}" 已手动更新为：${nextStatus === 'active' ? '已激活' : '已停用'}。`
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error cambiando estado de tienda.', 'Error changing store status.', '更改商店状态失败。'));
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
        tr(
          `Módulo Almacén & POS global ${nextVal ? 'ACTIVADO' : 'DESACTIVADO'} por el Administrador.`,
          `Global Warehouse & POS module ${nextVal ? 'ENABLED' : 'DISABLED'} by Administrator.`,
          `全局仓库与 POS 模块已被管理员${nextVal ? '启用' : '停用'}。`
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error cambiando estado de Almacén & POS.', 'Error changing Warehouse & POS state.', '更改仓库与 POS 状态失败。'));
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
        tr(
          `Almacén & POS ${nextVal ? 'ACTIVADO' : 'DESACTIVADO'} exclusivamente para "${store.storeName}".`,
          `Warehouse & POS ${nextVal ? 'ENABLED' : 'DISABLED'} exclusively for "${store.storeName}".`,
          `已专为 "${store.storeName}" ${nextVal ? '启用' : '停用'}仓库与 POS。`
        )
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : tr('Error cambiando Almacén & POS de la tienda.', 'Error changing store Warehouse & POS state.', '更改商店仓库与 POS 状态失败。')
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
        ? tr(
            ` · 🎁 Cupón de referido ${result.couponIssuedCode} otorgado automáticamente a "${result.referrerStoreName}"!`,
            ` · 🎁 Referral coupon ${result.couponIssuedCode} automatically issued to "${result.referrerStoreName}"!`,
            ` · 🎁 推荐优惠券 ${result.couponIssuedCode} 已自动发放给 "${result.referrerStoreName}"！`
          )
        : '';
      showNotice(
        nextStatus === 'approved'
          ? tr(
              `Pago #${payment.referenceNumber} aprobado${activateStore ? ' y tienda activada' : ''}${couponNote}.`,
              `Payment #${payment.referenceNumber} approved${activateStore ? ' and store activated' : ''}${couponNote}.`,
              `付款 #${payment.referenceNumber} 已批准${activateStore ? '且商店已激活' : ''}${couponNote}。`
            )
          : tr(
              `Pago #${payment.referenceNumber} marcado como rechazado.`,
              `Payment #${payment.referenceNumber} marked as rejected.`,
              `付款 #${payment.referenceNumber} 已标记为拒绝。`
            )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error actualizando pago.', 'Error updating payment.', '更新付款失败。'));
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
        tr(
          `Correo enviado a ${res.sentCount} tienda(s) [${res.deliveryChannel.toUpperCase()}]. ${res.message}`,
          `Email sent to ${res.sentCount} store(s) [${res.deliveryChannel.toUpperCase()}]. ${res.message}`,
          `邮件已发送至 ${res.sentCount} 家商店 [${res.deliveryChannel.toUpperCase()}]。${res.message}`
        )
      );
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error enviando correos.', 'Error sending emails.', '发送邮件失败。'));
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
    const subj = encodeURIComponent(emailSubject || tr('Comunicado Smith Solutions E-Commerce', 'Smith Solutions E-Commerce Notice', 'Smith Solutions 电子商务通知'));
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
        tr(
          'Cuentas receptoras (Bancos Venezuela, Pago Móvil, Binance Pay, Bybit) y recompensa por referidos guardadas en Firestore.',
          'Receiving accounts (Local Banks, Mobile Pay, Binance Pay, Bybit) and referral rewards saved to Firestore.',
          '收款账户（本地银行、移动支付、Binance Pay、Bybit）及推荐奖励已保存至 Firestore。'
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error guardando cuentas.', 'Error saving billing accounts.', '保存收款账户失败。'));
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
    setPmQrImageUrl('');
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
          qrImageUrl: pmQrImageUrl,
          isActive: pmActive,
        },
        editingMethodTarget || undefined
      );
      showNotice(
        editingMethodTarget
          ? tr(`Método de pago "${pmName}" actualizado en la plataforma.`, `Payment method "${pmName}" updated on platform.`, `平台收款方式 "${pmName}" 已更新。`)
          : tr(`Método de pago "${pmName}" guardado. Ya está disponible en el flujo de compra de suscripción.`, `Payment method "${pmName}" saved. Now available in subscription checkout.`, `收款方式 "${pmName}" 已保存，现已在订阅付款流程中可用。`)
      );
      resetPaymentMethodForm();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error guardando método de pago.', 'Error saving payment method.', '保存收款方式失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleTogglePaymentMethodActive = async (method: PlatformPaymentMethod) => {
    setIsBusy(true);
    try {
      await togglePlatformPaymentMethodActive(method, !method.isActive);
      showNotice(
        tr(
          `Método "${method.name}" ${!method.isActive ? 'activado' : 'pausado'}.`,
          `Method "${method.name}" ${!method.isActive ? 'activated' : 'paused'}.`,
          `收款方式 "${method.name}" 已${!method.isActive ? '启用' : '暂停'}。`
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error cambiando estado del método.', 'Error changing method status.', '更改方式状态失败。'));
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
      showNotice(tr(`Método de cobro de suscripción "${method.name}" eliminado.`, `Subscription payment method "${method.name}" deleted.`, `订阅收款方式 "${method.name}" 已删除。`));
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error eliminando método.', 'Error deleting method.', '删除收款方式失败。'));
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
    setSsPmQrImageUrl('');
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
          qrImageUrl: ssPmQrImageUrl,
          isActive: ssPmActive,
        },
        editingStoreSubTarget || undefined
      );
      showNotice(
        editingStoreSubTarget
          ? tr(`Método "${ssPmName}" actualizado para cobrar suscripción a "${targetStore.storeName}".`, `Method "${ssPmName}" updated for billing "${targetStore.storeName}".`, `已更新 "${targetStore.storeName}" 的订阅收款方式 "${ssPmName}"。`)
          : tr(`Método "${ssPmName}" asignado manualmente a "${targetStore.storeName}" para cobrar su suscripción.`, `Method "${ssPmName}" manually assigned to "${targetStore.storeName}" for subscription billing.`, `已手动为 "${targetStore.storeName}" 分配订阅收款方式 "${ssPmName}"。`)
      );
      resetStoreSubMethodForm();
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : tr('Error guardando método de suscripción para la tienda.', 'Error saving subscription method for store.', '保存商店订阅方式失败。')
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
        tr(
          `Método "${method.name}" (${targetStore.storeName}) ${!method.isActive ? 'activado' : 'pausado'}.`,
          `Method "${method.name}" (${targetStore.storeName}) ${!method.isActive ? 'activated' : 'paused'}.`,
          `方式 "${method.name}"（${targetStore.storeName}）已${!method.isActive ? '启用' : '暂停'}。`
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error cambiando estado del método.', 'Error changing method status.', '更改方式状态失败。'));
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
      showNotice(tr(`Método "${method.name}" eliminado de "${targetStore.storeName}".`, `Method "${method.name}" deleted from "${targetStore.storeName}".`, `已从 "${targetStore.storeName}" 删除方式 "${method.name}"。`));
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : tr('Error eliminando método de suscripción de la tienda.', 'Error deleting store subscription method.', '删除商店订阅方式失败。')
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
          ? tr(`Método para ventas "${spName}" actualizado correctamente.`, `Sales method "${spName}" updated successfully.`, `销售收款方式 "${spName}" 更新成功。`)
          : tr(`Método para ventas "${spName}" guardado. Ya aparece disponible para los dueños de tiendas al registrar ventas.`, `Sales method "${spName}" saved. Now available to store owners when recording sales.`, `销售收款方式 "${spName}" 已保存，店主记录销售时现已可选。`)
      );
      resetSalesMethodForm();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error guardando método para ventas.', 'Error saving sales method.', '保存销售方式失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleSalesMethodActive = async (method: SalesPaymentMethod) => {
    setIsBusy(true);
    try {
      await toggleSalesPaymentMethodActive(method, !method.isActive);
      showNotice(
        tr(
          `Método de venta "${method.name}" ${!method.isActive ? 'activado' : 'pausado'} para tiendas.`,
          `Sales method "${method.name}" ${!method.isActive ? 'activated' : 'paused'} for stores.`,
          `商店销售方式 "${method.name}" 已${!method.isActive ? '启用' : '暂停'}。`
        )
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error actualizando estado.', 'Error updating status.', '更新状态失败。'));
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
      showNotice(tr(`Método para ventas "${method.name}" eliminado.`, `Sales method "${method.name}" deleted.`, `销售方式 "${method.name}" 已删除。`));
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : tr('Error eliminando método para ventas.', 'Error deleting sales method.', '删除销售方式失败。'));
    } finally {
      setIsBusy(false);
    }
  };

  const resetVideoForm = () => {
    setEditingVideoTarget(null);
    setVidTitle('');
    setVidUrl('');
    setVidDescription('');
    setVidAudience('all');
    setVidLanguage('es');
    setVidSortOrder(guideVideos.length + 1);
    setVidActive(true);
    setPreviewAdminVideoId(null);
  };

  const handleSaveGuideVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const extracted = extractYouTubeVideoId(vidUrl);
    if (!extracted) {
      setErrorNotice(
        tr(
          'Enlace o ID de YouTube inválido. Pega una URL válida (ej. https://www.youtube.com/watch?v=..., https://youtu.be/... o el ID de 11 caracteres).',
          'Invalid YouTube link or ID. Paste a valid YouTube URL (watch?v=..., youtu.be/..., shorts/...) or 11-char ID.',
          'YouTube 链接或 ID 无效，请粘贴有效的 YouTube 视频链接或 11 位视频 ID。'
        )
      );
      return;
    }

    setIsBusy(true);
    setErrorNotice(null);
    try {
      await savePlatformGuideVideo(user, {
        id: editingVideoTarget?.id,
        title: vidTitle,
        description: vidDescription,
        youtubeUrl: vidUrl,
        audience: vidAudience,
        language: vidLanguage,
        sortOrder: vidSortOrder,
        isActive: vidActive,
        existingCreatedAt: editingVideoTarget?.createdAt,
      });
      showNotice(
        editingVideoTarget
          ? tr(
              `Video guía "${vidTitle}" actualizado correctamente.`,
              `Guide video "${vidTitle}" updated successfully.`,
              `视频教程“${vidTitle}”更新成功。`
            )
          : tr(
              `Video guía "${vidTitle}" agregado y publicado para los usuarios.`,
              `Guide video "${vidTitle}" added and published to users.`,
              `视频教程“${vidTitle}”已添加并向用户发布。`
            )
      );
      resetVideoForm();
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : tr('Error guardando video de YouTube.', 'Error saving YouTube video.', '保存 YouTube 视频失败。')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleGuideVideoActive = async (video: PlatformGuideVideo) => {
    setIsBusy(true);
    try {
      await togglePlatformGuideVideoActive(video);
      showNotice(
        tr(
          `Video "${video.title}" ${!video.isActive ? 'activado y visible' : 'pausado'}.`,
          `Video "${video.title}" ${!video.isActive ? 'activated and visible' : 'paused'}.`,
          `视频“${video.title}”已${!video.isActive ? '启用并对用户可见' : '暂停'}。`
        )
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : tr('Error cambiando visibilidad del video.', 'Error changing video visibility.', '更新视频显示状态失败。')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteGuideVideo = async (video: PlatformGuideVideo) => {
    setIsBusy(true);
    try {
      await deletePlatformGuideVideo(video.id);
      setConfirmDeleteVideoId(null);
      if (editingVideoTarget?.id === video.id) {
        resetVideoForm();
      }
      if (previewAdminVideoId === video.youtubeId) {
        setPreviewAdminVideoId(null);
      }
      showNotice(
        tr(
          `Video guía "${video.title}" eliminado.`,
          `Guide video "${video.title}" deleted.`,
          `视频教程“${video.title}”已删除。`
        )
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : tr('Error eliminando video guía.', 'Error deleting guide video.', '删除视频教程失败。')
      );
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
    setManualCategory(tr('Comercio General', 'General Retail', '综合零售'));
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
          tr(
            `Datos del dueño "${manualOwnerName}" y tienda "${manualStoreName}" actualizados correctamente.`,
            `Owner "${manualOwnerName}" and store "${manualStoreName}" updated successfully.`,
            `店主 "${manualOwnerName}" 和商店 "${manualStoreName}" 信息更新成功。`
          )
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
          tr(
            `Dueño "${manualOwnerName}" (${manualOwnerEmail.trim().toLowerCase()}) y tienda "${store.storeName}" registrados manualmente. Al iniciar sesión con ese correo Google heredará el control total.`,
            `Owner "${manualOwnerName}" (${manualOwnerEmail.trim().toLowerCase()}) and store "${store.storeName}" registered manually. Signing in with that Google email will grant full control.`,
            `已手动登记店主 "${manualOwnerName}"（${manualOwnerEmail.trim().toLowerCase()}）和商店 "${store.storeName}"。使用该 Google 邮箱登录即可获得完全控制权。`
          )
        );
      }
      setShowOwnerModal(false);
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : tr('Error guardando persona dueña y tienda.', 'Error saving store owner and store.', '保存店主与商店信息失败。')
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
          <span>{tr('Métodos Suscripción', 'Sub. Methods', '订阅方式')} ({customPaymentMethods.length})</span>
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
          <span>{tr('Cobro Suscripción', 'Sub. Billing', '订阅计费')} (${billing.monthlyPriceUSD})</span>
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
          <span>{tr('Centro Vector', 'Vector Hub', 'Vector 中心')}</span>
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
          <span>{tr('Métodos Pago Ventas', 'Sales Methods', '销售收款方式')} ({salesPaymentMethods.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            activeTab === 'videos'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#111114] border border-white/[0.08] text-zinc-300'
          }`}
        >
          <Video className="w-4 h-4 shrink-0" />
          <span>{tr('Videos Guía', 'Video Guides', '视频指南')} ({guideVideos.length})</span>
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
                <span>{tr('Registrar Dueño y Tienda', 'Register Owner & Store', '登记店主与商店')}</span>
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
                              {tr('Por vincular Google', 'Pending Google Link', '待绑定 Google')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {t.merchant.ownerPrefix}: {store.registeredOwnerName} · RIF:{' '}
                          {store.rif || t.merchant.noRif} · WhatsApp: {store.businessWhatsapp}
                          {store.category ? ` · ${translateCategoryLabel(store.category, lang)}` : ''}
                          {ownerEmailMap[store.id] ? ` · ${ownerEmailMap[store.id]}` : ''}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono flex flex-wrap gap-2">
                          <span>
                            /tienda/{store.slug} · ${store.subscriptionPriceUSD}{tr('/mes', '/mo', '/月')}
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
                              ? tr(
                                  `Cobro Suscripción: ${(storeSubMethodsMap[store.id] || []).filter((m) => m.isActive).length}/${(storeSubMethodsMap[store.id] || []).length} asignados`,
                                  `Sub. Billing: ${(storeSubMethodsMap[store.id] || []).filter((m) => m.isActive).length}/${(storeSubMethodsMap[store.id] || []).length} assigned`,
                                  `订阅收款：已分配 ${(storeSubMethodsMap[store.id] || []).filter((m) => m.isActive).length}/${(storeSubMethodsMap[store.id] || []).length}`
                                )
                              : tr('Cobro Suscripción: Global', 'Sub. Billing: Global', '订阅收款：全局')}
                          </span>
                          {store.referralCode && (
                            <span className="text-amber-300/90">Ref: {store.referralCode}</span>
                          )}
                          {store.referredByStoreName && (
                            <span className="text-emerald-300/90">
                              {tr('Invitada por:', 'Invited by:', '邀请方：')} {store.referredByStoreName}
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
                          {tr('Cobro Suscripción', 'Sub. Billing', '订阅收款')}
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
                        <span>{tr('Editar Dueño', 'Edit Owner', '编辑店主')}</span>
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
                          ? `${tr('Editar Dueño y Tienda', 'Edit Owner & Store', '编辑店主与商店')} · ${editingStoreTarget.storeName}`
                          : tr('Registrar Dueño de Tienda Manualmente', 'Manually Register Store Owner', '手动登记店主')}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        {editingStoreTarget
                          ? tr('Actualiza los datos personales de contacto del propietario y su negocio.', 'Update owner contact details and business info.', '更新店主个人联系信息及商店资料。')
                          : tr('Crea la tienda y asigna el correo Google de la persona dueña para que herede su panel al iniciar sesión.', 'Create the store and assign the owner Google email so they inherit their dashboard on sign-in.', '创建商店并指定店主的 Google 邮箱，登录后即可继承管理面板。')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOwnerModal(false)}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center"
                    aria-label={tr('Cerrar modal', 'Close modal', '关闭弹窗')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Nombre Completo del Dueño *', 'Owner Full Name *', '店主姓名 *')}
                    </label>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={manualOwnerName}
                      onChange={(e) => setManualOwnerName(e.target.value)}
                      placeholder={tr('Ej: María Gabriela Rodríguez', 'Ex: Maria Rodriguez', '例：张三 / Maria Rodriguez')}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Correo Google del Dueño *', 'Owner Google Email *', '店主 Google 邮箱 *')}
                    </label>
                    <input
                      required
                      type="email"
                      maxLength={160}
                      value={manualOwnerEmail}
                      onChange={(e) => setManualOwnerEmail(e.target.value)}
                      placeholder={tr('dueno@gmail.com', 'owner@gmail.com', 'owner@gmail.com')}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Nombre de la Tienda *', 'Store Name *', '商店名称 *')}
                    </label>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={manualStoreName}
                      onChange={(e) => setManualStoreName(e.target.value)}
                      placeholder={tr('Ej: Bodegón Los Palos Grandes', 'Ex: Central Market Store', '例：中央精品商店')}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('WhatsApp Comercial *', 'Business WhatsApp *', '商业 WhatsApp *')}
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
                    <label className="text-xs text-zinc-300 block mb-1">{tr('RIF / Cédula (Opcional)', 'Tax ID / RIF (Optional)', '税号 / 身份证（可选）')}</label>
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
                    <label className="text-xs text-zinc-300 block mb-1">{tr('Categoría', 'Category', '类别')}</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder={tr('Bodegón, Tecnología, Alimentos...', 'Grocery, Tech, Food...', '商超、数码、食品...')}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                {!editingStoreTarget && (
                  <div className="space-y-3 border-t border-white/[0.08] pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">{tr('Estado Inicial', 'Initial Status', '初始状态')}</label>
                        <select
                          value={manualStatus}
                          onChange={(e) => setManualStatus(e.target.value as StoreStatus)}
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        >
                          <option value="active">{tr('Activa (Visible en Directorio)', 'Active (Visible in Directory)', '已激活（目录可见）')}</option>
                          <option value="pending">{tr('Pendiente de Pago ($25/mes)', 'Pending Payment ($25/mo)', '待付款（$25/月）')}</option>
                          <option value="suspended">{tr('Suspendida', 'Suspended', '已停用')}</option>
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
                          <span>{tr('Activar Almacén & POS para esta tienda', 'Enable Warehouse & POS for this store', '为此商店启用仓库与 POS')}</span>
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
                        <span>{tr('Envío Nacional', 'National Shipping', '全国配送')}</span>
                      </label>
                      <label className="px-3 py-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualLocalDelivery}
                          onChange={(e) => setManualLocalDelivery(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>{tr('Delivery Local', 'Local Delivery', '同城配送')}</span>
                      </label>
                      <label className="px-3 py-2.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualPickupEnabled}
                          onChange={(e) => setManualPickupEnabled(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>{tr('Retiro en Tienda', 'Store Pickup', '门店自提')}</span>
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
                        ? tr('Guardar Cambios del Dueño', 'Save Owner Changes', '保存店主更改')
                        : tr('Crear Dueño y Tienda', 'Create Owner & Store', '创建店主与商店')}
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
                <span>{tr('Métodos de Cobro Activos para Suscripción', 'Active Subscription Billing Methods', '启用的订阅收款方式')} (${billing.monthlyPriceUSD}/{tr('mes', 'mo', '月')})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {customPaymentMethods.filter((m) => m.isActive).length === 0 ? (
                  <span className="text-amber-300">
                    {tr(
                      'Aún no has agregado métodos manuales en «Métodos Suscripción». Agrégalos para que los dueños de tienda los seleccionen al pagar.',
                      'No manual methods added yet in "Sub. Methods". Add them so store owners can select them when paying.',
                      '尚未在“订阅方式”中添加手动收款方式。请添加以便店主付款时选择。'
                    )}
                  </span>
                ) : (
                  customPaymentMethods
                    .filter((m) => m.isActive)
                    .map((m) => (
                      <span
                        key={`pay-banner-${m.id}`}
                        className="px-2 py-0.5 rounded-md bg-[#09090b] border border-emerald-500/35 text-emerald-300 font-semibold"
                      >
                        {translatePaymentMethodLabel(m.name, lang)} ({m.currency})
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
              <span>{tr('Configurar Métodos de Pago Manuales', 'Configure Manual Payment Methods', '配置手动收款方式')}</span>
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
                      ${pay.amountUSD} USD · {translatePaymentMethodLabel(pay.paymentMethod, lang)}
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
                      🎟 {tr('Cupón:', 'Coupon:', '优惠券:')} {pay.couponCode} (-${pay.discountUSD ?? 0} USD)
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
                          alt={tr('Captura de pago', 'Payment screenshot', '付款截图')}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span>{tr('Ver Captura Adjunta', 'View Attached Proof', '查看付款凭证')}</span>
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
                  <span className="text-sm font-bold text-white">{tr('Captura del Comprobante', 'Payment Receipt Screenshot', '付款凭证截图')}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewProofUrl(null)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white text-xs font-semibold"
                  >
                    {tr('Cerrar', 'Close', '关闭')}
                  </button>
                </div>
                <img
                  src={previewProofUrl}
                  alt={tr('Captura de pago completa', 'Full payment screenshot', '完整付款截图')}
                  referrerPolicy="no-referrer"
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
                      {ownerEmailMap[s.id] ? `(${ownerEmailMap[s.id]})` : tr('(Bandeja Tienda)', '(Store Inbox)', '(店铺收件箱)')}
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
                        {em.mode === 'collective' ? tr('Colectivo', 'Collective', '群发') : tr('Individual', 'Individual', '单独')} · {em.recipientCount}
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
                {tr('Referidos:', 'Referrals:', '推荐数:')} <strong className="text-white">{referrals.length}</strong>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#09090b] border border-emerald-500/30">
                {tr('Cupones Activos:', 'Active Coupons:', '有效优惠券:')}{' '}
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
                        {tr('Código usado:', 'Code used:', '使用推荐码:')} {r.referrerCode}
                        {r.rewardCouponCode ? ` · ${tr('Cupón:', 'Coupon:', '优惠券:')} ${r.rewardCouponCode}` : ''}
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
                            {tr('Por referir a:', 'For referring:', '推荐奖励来源:')} {c.referredStoreName}
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
            detailsPlaceholder: tr(
              'Banco: Banesco (0134) · Cédula/RIF: J-XXXXXXXX-X · Teléfono: 04XX-XXXXXXX',
              'Bank: Banesco (0134) · ID/RIF: J-XXXXXXXX-X · Phone: 04XX-XXXXXXX',
              '银行: Banesco (0134) · 证件/税号: J-XXXXXXXX-X · 电话: 04XX-XXXXXXX'
            ),
            instructions: tr(
              'Calcular monto al cambio oficial BCV del día y adjuntar captura o últimos 6 dígitos.',
              'Calculate amount at the official daily BCV rate and attach screenshot or last 6 digits.',
              '按当日 BCV 官方汇率计算金额，并附上截图或后6位参考号。'
            ),
          },
          {
            name: tr('Transferencia Banesco', 'Banesco Transfer', 'Banesco 银行转账'),
            currency: 'Bs',
            detailsPlaceholder: tr(
              'Banesco · Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX · RIF: J-XXXXXXXX-X',
              'Banesco · Checking Account: 0134-XXXX-XX-XXXXXXXXXX · RIF: J-XXXXXXXX-X',
              'Banesco · 支票账户: 0134-XXXX-XX-XXXXXXXXXX · 税号: J-XXXXXXXX-X'
            ),
            instructions: tr(
              'Indicar nombre de la tienda en el concepto y enviar número de referencia.',
              'Include your store name in the memo and submit the reference number.',
              '请在备注中填写店铺名称并发送转账参考号。'
            ),
          },
          {
            name: 'Binance Pay (QR)',
            currency: 'USDT',
            detailsPlaceholder: tr(
              'Binance Pay ID: XXXXXXXXX · Correo: pagos@tudominio.com · Escanear QR',
              'Binance Pay ID: XXXXXXXXX · Email: payments@yourdomain.com · Scan QR',
              'Binance Pay ID: XXXXXXXXX · 邮箱: payments@yourdomain.com · 扫码付款'
            ),
            instructions: tr(
              `Escanea el QR oficial de Binance Pay, envía $${billing.monthlyPriceUSD} USDT netos e indica Order ID.`,
              `Scan the official Binance Pay QR, send exact $${billing.monthlyPriceUSD} net USDT, and enter Order ID.`,
              `请扫描官方 Binance Pay 二维码并全额支付 $${billing.monthlyPriceUSD} USDT，同时填报订单号。`
            ),
          },
          {
            name: 'Zelle',
            currency: 'USD',
            detailsPlaceholder: tr('Correo Zelle: pagos@tuempresa.com', 'Zelle Email: payments@yourcompany.com', 'Zelle 邮箱: payments@yourcompany.com'),
            instructions: tr(
              'Colocar únicamente el nombre de tu tienda en el memo/concepto de Zelle.',
              'Put only your store name in the Zelle memo field.',
              '请仅在 Zelle 备注栏填写您的店铺名称。'
            ),
          },
          {
            name: 'Zinli',
            currency: 'USD',
            detailsPlaceholder: tr('Correo Zinli: pagos@tuempresa.com', 'Zinli Email: payments@yourcompany.com', 'Zinli 邮箱: payments@yourcompany.com'),
            instructions: tr(
              'Enviar comprobante con correo emisor y código de transacción.',
              'Submit receipt with sender email and transaction code.',
              '请提交包含发送方邮箱与交易码的凭证。'
            ),
          },
          {
            name: 'Bybit Pay (QR)',
            currency: 'USDT',
            detailsPlaceholder: tr('Bybit UID: XXXXXXXX · Correo interno · Escanear QR', 'Bybit UID: XXXXXXXX · Fee-free email · Scan QR', 'Bybit UID: XXXXXXXX · 免手续费邮箱 · 扫码付款'),
            instructions: tr(
              'Escanea el código QR desde la app de Bybit o envía por transferencia interna USDT sin comisión.',
              'Scan the QR code in the Bybit app or send a zero-fee internal USDT transfer.',
              '请在 Bybit App 中扫码或进行免手续费 USDT 内部转账。'
            ),
          },
          {
            name: 'Wally',
            currency: 'USD',
            detailsPlaceholder: tr('Usuario / Teléfono Wally: +58 4XX-XXXXXXX', 'Wally User / Phone: +58 4XX-XXXXXXX', 'Wally 用户 / 电话: +58 4XX-XXXXXXX'),
            instructions: tr('Adjuntar captura del pago completado.', 'Attach screenshot of completed payment.', '请附上已完成付款的截图。'),
          },
          {
            name: 'PayPal',
            currency: 'USD',
            detailsPlaceholder: tr('Correo PayPal: pagos@tuempresa.com', 'PayPal Email: payments@yourcompany.com', 'PayPal 邮箱: payments@yourcompany.com'),
            instructions: tr(
              'Cubrir comisión PayPal para acreditar el monto neto de la mensualidad.',
              'Cover PayPal fees so the net monthly subscription amount is credited.',
              '请承担 PayPal 手续费以确保月费净额到账。'
            ),
          },
          {
            name: tr('Efectivo USD', 'USD Cash', '美元现金'),
            currency: 'USD',
            detailsPlaceholder: tr('Pago presencial en taquilla / oficina autorizada', 'In-person payment at authorized desk / office', '在授权网点或办公室当面付款'),
            instructions: tr(
              'Coordinar entrega previa vía WhatsApp oficial para emitir recibo.',
              'Coordinate delivery beforehand via official WhatsApp to issue a receipt.',
              '请提前通过官方 WhatsApp 预约交接以便开具收据。'
            ),
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
                  <span>{tr('Métodos Globales', 'Global Methods', '全局收款方式')} ({customPaymentMethods.length})</span>
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
                  <span>{tr('Por Tienda Registrada', 'Per Registered Store', '按注册店铺分配')} ({totalPerStoreMethodsCount})</span>
                </button>
              </div>
              <span className="text-[11px] text-zinc-400 px-2">
                {subMethodsScope === 'global'
                  ? tr('Aplican a todas las tiendas en el flujo de suscripción', 'Applies to all stores during subscription checkout', '适用于所有店铺的订阅结账流程')
                  : tr('Asigna cuentas o billeteras exclusivas para cobrar a cada tienda', 'Assign exclusive bank accounts or wallets to bill each store', '为每家店铺指定专属收款账户或钱包')}
              </span>
            </div>

            {subMethodsScope === 'per_store' ? (
              <div className="space-y-6">
                {/* Store Selector Card */}
                <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                      <Store className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>{tr('Cobro Manual de Suscripción por Cada Tienda Registrada', 'Manual Subscription Billing Per Registered Store', '按注册店铺配置手动订阅收款')}</span>
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-2xl">
                      {tr(
                        `Selecciona una tienda registrada y configura de forma manual los métodos de pago específicos para cobrar su suscripción mensual ($${billing.monthlyPriceUSD}/mes). La tienda los verá prioritariamente en su portal de suscripción.`,
                        `Select a registered store and manually configure dedicated payment methods to bill its monthly subscription ($${billing.monthlyPriceUSD}/mo). The store will see them prioritized in its subscription portal.`,
                        `选择已注册店铺并手动配置月度订阅（$${billing.monthlyPriceUSD}/月）专属收款方式，该店铺将在其订阅门户中优先看到这些方式。`
                      )}
                    </p>
                  </div>

                  {stores.length > 0 && (
                    <div className="min-w-[260px]">
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        {tr('Tienda Registrada Seleccionada *', 'Selected Registered Store *', '已选注册店铺 *')}
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
                              {s.storeName} — {s.registeredOwnerName} ({cnt} {tr(cnt === 1 ? 'método' : 'métodos', cnt === 1 ? 'method' : 'methods', '种方式')})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {!selectedSubStore ? (
                  <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
                    {tr('No hay tiendas registradas todavía para asignar métodos de cobro de suscripción.', 'No registered stores yet to assign subscription billing methods.', '暂无已注册店铺可分配订阅收款方式。')}
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
                                ? `${tr('Editar Método', 'Edit Method', '编辑方式')} (${selectedSubStore.storeName})`
                                : `${tr('Añadir Método para', 'Add Method for', '为以下店铺添加方式')} "${selectedSubStore.storeName}"`}
                            </span>
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {tr('Dueño:', 'Owner:', '店主:')} {selectedSubStore.registeredOwnerName}
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
                            {t.common.cancel}
                          </button>
                        )}
                      </div>

                      {!editingStoreSubTarget && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-zinc-400">{tr('Plantillas rápidas:', 'Quick templates:', '快速模板：')}</div>
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
                            {tr('Nombre del Método *', 'Method Name *', '方式名称 *')}
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={80}
                            value={ssPmName}
                            onChange={(e) => setSsPmName(e.target.value)}
                            placeholder={tr('Ej: Zelle / Pago Móvil / Binance Pay', 'e.g. Zelle / Pago Móvil / Binance Pay', '例如：Zelle / Pago Móvil / Binance Pay')}
                            className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-300 block mb-1">{tr('Moneda *', 'Currency *', '币种 *')}</label>
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
                            <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          {tr('Titular / Beneficiario', 'Account Holder / Beneficiary', '持有人 / 收款人')}
                        </label>
                        <input
                          type="text"
                          maxLength={120}
                          value={ssPmHolder}
                          onChange={(e) => setSsPmHolder(e.target.value)}
                          placeholder={tr('Ej: Inversiones Alhadiqa Invest C.A.', 'e.g. Inversiones Alhadiqa Invest C.A.', '例如：Inversiones Alhadiqa Invest C.A.')}
                          className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          {tr('Datos de Cobro Asignados a esta Tienda *', 'Billing Details Assigned to This Store *', '分配给此店铺的收款信息 *')}
                        </label>
                        <textarea
                          required
                          rows={3}
                          maxLength={300}
                          value={ssPmDetails}
                          onChange={(e) => setSsPmDetails(e.target.value)}
                          placeholder={tr('Cuenta bancaria, teléfono Pago Móvil, correo Zelle o Binance Pay ID', 'Bank account, Pago Móvil phone, Zelle email, or Binance Pay ID', '银行账号、Pago Móvil 电话、Zelle 邮箱或 Binance Pay ID')}
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-zinc-300 block mb-1">
                          {tr('Instrucciones para esta Tienda (Opcional)', 'Instructions for This Store (Optional)', '此店铺付款说明（可选）')}
                        </label>
                        <input
                          type="text"
                          maxLength={400}
                          value={ssPmInstructions}
                          onChange={(e) => setSsPmInstructions(e.target.value)}
                          placeholder={tr('Ej: Enviar captura o número de referencia al pagar mensualidad', 'e.g. Send screenshot or reference number when paying monthly plan', '例如：支付月费时发送截图或参考号')}
                          className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                        />
                      </div>

                      <QrUploadField
                        value={ssPmQrImageUrl}
                        onChange={setSsPmQrImageUrl}
                        onZoom={(qrUrl) =>
                          setZoomQrState({
                            qrUrl,
                            title: ssPmName || 'QR',
                            subtitle: selectedSubStore.storeName,
                            accountDetails: ssPmDetails,
                          })
                        }
                      />

                      <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={ssPmActive}
                          onChange={(e) => setSsPmActive(e.target.checked)}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>{tr('Activo para cobrar la suscripción de esta tienda', 'Active to bill this store subscription', '启用以向此店铺收取订阅费')}</span>
                      </label>

                      <button
                        type="submit"
                        disabled={isBusy}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>
                          {editingStoreSubTarget
                            ? tr('Actualizar Método de esta Tienda', 'Update Store Method', '更新此店铺方式')
                            : tr('Guardar Método para esta Tienda', 'Save Method for This Store', '保存此店铺方式')}
                        </span>
                      </button>
                    </form>

                    <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                      <div className="border-b border-white/[0.08] pb-3.5">
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          {tr('Métodos Asignados a', 'Methods Assigned to', '分配给')} "{selectedSubStore.storeName}" (
                          {selectedStoreSubMethods.length})
                        </h3>
                        <p className="text-xs text-zinc-400">
                          {tr(
                            'Estos métodos se guardan en Firestore por tienda y aparecen automáticamente en su checkout de suscripción.',
                            'These methods are stored in Firestore per store and appear automatically in its subscription checkout.',
                            '这些收款方式按店铺保存在云端，并自动显示在其订阅结账页中。'
                          )}
                        </p>
                      </div>

                      {selectedStoreSubMethods.length === 0 ? (
                        <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-2">
                          <CreditCard className="w-8 h-8 text-zinc-600 mx-auto" />
                          <p className="text-xs font-semibold text-zinc-300">
                            "{selectedSubStore.storeName}" {tr('aún usa únicamente los métodos globales', 'still uses global methods only', '目前仅使用全局收款方式')}
                          </p>
                          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                            {tr(
                              'Usa el formulario a la izquierda para asignarle métodos de cobro manuales exclusivos para su suscripción.',
                              'Use the form on the left to assign exclusive manual billing methods for its subscription.',
                              '请使用左侧表单为其订阅分配专属手动收款方式。'
                            )}
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
                                    {translatePaymentMethodLabel(method.name, lang)}
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
                                    <span>{method.isActive ? tr('Activo', 'Active', '启用') : tr('Pausado', 'Paused', '已暂停')}</span>
                                  </span>
                                </div>
                                {method.accountHolder && (
                                  <div className="text-zinc-400">
                                    {tr('Titular:', 'Holder:', '持有人:')}{' '}
                                    <span className="text-zinc-200">{method.accountHolder}</span>
                                  </div>
                                )}
                                <div className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                                  {method.accountDetails}
                                </div>
                                {method.instructions && (
                                  <div className="text-zinc-400 text-[11px]">
                                    {translateCommonPaymentInstruction(method.instructions, lang)}
                                  </div>
                                )}
                                {method.qrImageUrl && (
                                  <div className="pt-1.5 flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setZoomQrState({
                                          qrUrl: method.qrImageUrl!,
                                          title: translatePaymentMethodLabel(method.name, lang),
                                          subtitle: selectedSubStore.storeName,
                                          accountDetails: method.accountDetails,
                                        })
                                      }
                                      className="bg-white p-1.5 rounded-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                                    >
                                      <img
                                        src={method.qrImageUrl}
                                        alt={method.name}
                                        referrerPolicy="no-referrer"
                                        className="w-14 h-14 object-contain"
                                      />
                                    </button>
                                    <span className="text-[11px] text-amber-300 font-semibold">
                                      {tr('QR adjunto (clic para ampliar)', 'QR attached (click to zoom)', '已附二维码（点击放大）')}
                                    </span>
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
                                  {method.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Activate', '启用')}
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
                                    setSsPmQrImageUrl(method.qrImageUrl || '');
                                    setSsPmActive(method.isActive);
                                  }}
                                  className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                                  title={tr('Editar método', 'Edit method', '编辑方式')}
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
                                      {tr('Confirmar', 'Confirm', '确认')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteStoreSubId(null)}
                                      className="px-2 py-2 min-h-[38px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                                    >
                                      {tr('No', 'No', '否')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteStoreSubId(method.id)}
                                    className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                                    title={tr('Eliminar método', 'Delete method', '删除方式')}
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
                  <span>{tr('Métodos de Pago para que los Clientes Compren la Suscripción', 'Payment Methods for Store Owners to Buy Subscriptions', '客户购买订阅的全局收款方式')}</span>
                </h2>
                <p className="text-xs text-zinc-400 max-w-3xl">
                  {tr(
                    `Agrega, edita, activa o elimina las cuentas y billeteras aceptadas (Binance, Zelle, Transferencia, Pago Móvil, Zinli, Bybit, PayPal, etc.). Se guardan en tiempo real en Firestore para mostrarse al instante en el flujo de compra de suscripción ($${billing.monthlyPriceUSD}/mes).`,
                    `Add, edit, activate, or remove accepted accounts and wallets (Binance, Zelle, Bank Transfer, Pago Móvil, Zinli, Bybit, PayPal, etc.). Saved in real time to Firestore and shown immediately in subscription checkout ($${billing.monthlyPriceUSD}/mo).`,
                    `添加、编辑、启用或删除收款账户和钱包（Binance、Zelle、银行转账、Pago Móvil、Zinli、Bybit、PayPal 等）。实时保存至云端并立即显示在订阅结账（$${billing.monthlyPriceUSD}/月）中。`
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
                <div className="px-3.5 py-2 rounded-xl bg-[#09090b] border border-white/[0.08] font-mono tabular-nums">
                  <span className="text-zinc-400">{tr('Activos:', 'Active:', '启用:')}</span>{' '}
                  <strong className="text-emerald-300">{activeSubCount}</strong>
                  <span className="text-zinc-600 mx-1.5">·</span>
                  <span className="text-zinc-400">{tr('Pausados:', 'Paused:', '已暂停:')}</span>{' '}
                  <strong className="text-zinc-200">{pausedSubCount}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/40 text-xs font-semibold text-amber-300 whitespace-nowrap"
                >
                  {tr(`Precio ($${billing.monthlyPriceUSD}/mes) y WhatsApp`, `Price ($${billing.monthlyPriceUSD}/mo) & WhatsApp`, `价格 ($${billing.monthlyPriceUSD}/月) 与 WhatsApp`)}
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
                          ? `${tr('Editar Método:', 'Edit Method:', '编辑方式:')} ${editingMethodTarget.name}`
                          : tr('Añadir Método de Pago para Suscripción', 'Add Subscription Payment Method', '添加订阅收款方式')}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tr('Los clientes verán estos datos y podrán seleccionarlos al pagar su plan mensual.', 'Store owners will see these details and select them when paying their monthly plan.', '客户在支付月度订阅方案时将看到并可选择这些信息。')}
                    </p>
                  </div>
                  {editingMethodTarget && (
                    <button
                      type="button"
                      onClick={resetPaymentMethodForm}
                      className="text-xs text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-white/[0.08] whitespace-nowrap shrink-0"
                    >
                      {t.common.cancel}
                    </button>
                  )}
                </div>

                {!editingMethodTarget && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-zinc-400">{tr('Plantillas rápidas (1 clic para rellenar):', 'Quick templates (1-click autofill):', '快速模板（一键填充）：')}</div>
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
                    <label className="text-xs text-zinc-300 block mb-1">{tr('Nombre del Método *', 'Method Name *', '方式名称 *')}</label>
                    <input
                      required
                      type="text"
                      maxLength={80}
                      value={pmName}
                      onChange={(e) => setPmName(e.target.value)}
                      placeholder={tr('Ej: Pago Móvil Banesco / Zelle / Binance Pay', 'e.g. Pago Móvil Banesco / Zelle / Binance Pay', '例如：Pago Móvil Banesco / Zelle / Binance Pay')}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">{tr('Moneda *', 'Currency *', '币种 *')}</label>
                    <select
                      value={pmCurrency}
                      onChange={(e) => setPmCurrency(e.target.value as PlatformPaymentCurrency)}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="USDT">USDT</option>
                      <option value="Bs">Bs.</option>
                      <option value="EUR">EUR</option>
                      <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Titular / Beneficiario', 'Account Holder / Beneficiary', '持有人 / 收款人')}</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={pmHolder}
                    onChange={(e) => setPmHolder(e.target.value)}
                    placeholder={tr('Ej: Inversiones Alhadiqa Invest C.A.', 'e.g. Inversiones Alhadiqa Invest C.A.', '例如：Inversiones Alhadiqa Invest C.A.')}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Datos de Cobro para el Cliente (Cuenta, Teléfono, Correo o Wallet) *', 'Customer Billing Details (Account, Phone, Email or Wallet) *', '客户收款信息（账号、电话、邮箱或钱包）*')}
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={300}
                    value={pmDetails}
                    onChange={(e) => setPmDetails(e.target.value)}
                    placeholder={tr('Ej: 0134 Banesco · V-XX.XXX.XXX · 0414-XXXXXXX', 'e.g. 0134 Banesco · ID V-XX.XXX.XXX · 0414-XXXXXXX', '例如：0134 Banesco · 证件 V-XX.XXX.XXX · 0414-XXXXXXX')}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Instrucciones de Compra (Opcional)', 'Payment Instructions (Optional)', '付款说明（可选）')}
                  </label>
                  <input
                    type="text"
                    maxLength={400}
                    value={pmInstructions}
                    onChange={(e) => setPmInstructions(e.target.value)}
                    placeholder={tr('Ej: Indicar nombre de tienda y reportar referencia o captura', 'e.g. Include store name and submit reference or screenshot', '例如：请注明店铺名称并提交参考号或截图')}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <QrUploadField
                  value={pmQrImageUrl}
                  onChange={setPmQrImageUrl}
                  onZoom={(qrUrl) =>
                    setZoomQrState({
                      qrUrl,
                      title: pmName || 'QR',
                      accountDetails: pmDetails,
                    })
                  }
                />

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={pmActive}
                    onChange={(e) => setPmActive(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>{tr('Visible y disponible para que los clientes compren la suscripción', 'Visible and available for customers to pay subscriptions', '对客户可见并可用于订阅付款')}</span>
                </label>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 text-center"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingMethodTarget
                      ? tr('Actualizar Método de Suscripción', 'Update Subscription Method', '更新订阅方式')
                      : tr('Guardar Método de Suscripción', 'Save Subscription Method', '保存订阅方式')}
                  </span>
                </button>
              </form>

              {/* Right Column: Search, Filter & Methods List */}
              <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-display">
                      {tr('Métodos Configurados para Compra de Suscripción', 'Configured Subscription Payment Methods', '已配置的订阅收款方式')} ({customPaymentMethods.length})
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {tr('Cada método activo se muestra automáticamente en el checkout de suscripción de los clientes.', 'Every active method appears automatically in customer subscription checkout.', '所有已启用方式将自动显示在客户订阅结账页。')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#09090b] border border-white/[0.08] rounded-lg text-[11px] shrink-0">
                    {([
                      { id: 'all', label: tr('Todos', 'All', '全部') },
                      { id: 'active', label: tr('Activos', 'Active', '启用') },
                      { id: 'paused', label: tr('Pausados', 'Paused', '已暂停') },
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
                      placeholder={tr('Buscar por método, moneda, titular o cuenta...', 'Search by method, currency, holder, or account...', '按方式、币种、持有人或账号搜索...')}
                      className="w-full pl-9 pr-4 py-2 min-h-[40px] bg-[#09090b] border border-white/[0.08] rounded-xl text-xs text-white"
                    />
                  </div>
                )}

                {filteredSubMethods.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-2">
                    <CreditCard className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">
                      {customPaymentMethods.length === 0
                        ? tr('Aún no has agregado métodos de pago personalizados para la suscripción', 'You have not added custom subscription payment methods yet', '尚未添加自定义订阅收款方式')
                        : tr('No hay métodos que coincidan con tu búsqueda o filtro', 'No methods match your search or filter', '没有匹配搜索或筛选的收款方式')}
                    </p>
                    <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                      {tr(
                        'Usa el formulario y las plantillas rápidas a la izquierda para registrar Pago Móvil, Binance Pay, Zelle, Zinli o transferencia bancaria.',
                        'Use the form and quick templates on the left to add Pago Móvil, Binance Pay, Zelle, Zinli, or bank transfers.',
                        '请使用左侧表单和快速模板登记 Pago Móvil、Binance Pay、Zelle、Zinli 或银行转账。'
                      )}
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
                            <span className="font-bold text-white text-sm">
                              {translatePaymentMethodLabel(method.name, lang)}
                            </span>
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
                              <span>{method.isActive ? tr('Activo para clientes', 'Active for clients', '对客户启用') : tr('Pausado', 'Paused', '已暂停')}</span>
                            </span>
                          </div>
                          {method.accountHolder && (
                            <div className="text-zinc-400">
                              {tr('Titular:', 'Holder:', '持有人:')} <span className="text-zinc-200">{method.accountHolder}</span>
                            </div>
                          )}
                          <div className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                            {method.accountDetails}
                          </div>
                          {method.instructions && (
                            <div className="text-zinc-400 text-[11px]">
                              {translateCommonPaymentInstruction(method.instructions, lang)}
                            </div>
                          )}
                          {method.qrImageUrl && (
                            <div className="pt-1.5 flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setZoomQrState({
                                    qrUrl: method.qrImageUrl!,
                                    title: translatePaymentMethodLabel(method.name, lang),
                                    accountDetails: method.accountDetails,
                                  })
                                }
                                className="bg-white p-1.5 rounded-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                              >
                                <img
                                  src={method.qrImageUrl}
                                  alt={method.name}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-14 object-contain"
                                />
                              </button>
                              <span className="text-[11px] text-amber-300 font-semibold">
                                {tr('QR adjunto (clic para ampliar)', 'QR attached (click to zoom)', '已附二维码（点击放大）')}
                              </span>
                            </div>
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
                            {method.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Activate', '启用')}
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
                              setPmQrImageUrl(method.qrImageUrl || '');
                              setPmActive(method.isActive);
                            }}
                            className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                            title={tr('Editar método', 'Edit method', '编辑方式')}
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
                                {tr('Confirmar', 'Confirm', '确认')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMethodId(null)}
                                className="px-2 py-2 min-h-[38px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 hover:text-white text-[11px] whitespace-nowrap"
                              >
                                {tr('No', 'No', '否')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMethodId(method.id)}
                              className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                              title={tr('Eliminar método', 'Delete method', '删除方式')}
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
          <LanguageSettings variant="compact" />
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>
                  {tr(
                    `Parámetros de Suscripción SaaS ($${billing.monthlyPriceUSD}/mes)`,
                    `SaaS Subscription Parameters ($${billing.monthlyPriceUSD}/mo)`,
                    `SaaS 订阅参数 ($${billing.monthlyPriceUSD}/月)`
                  )}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {tr(
                  'Define el precio mensual, bono por referido y WhatsApp de soporte. Los métodos de pago manuales configurados en',
                  'Define the monthly price, referral bonus, and support WhatsApp. Manual payment methods configured in',
                  '设置月度价格、推荐奖励和客服 WhatsApp。以下手动收款方式：'
                )}{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('sub_methods')}
                  className="text-amber-300 underline hover:text-amber-200 font-semibold"
                >
                  {tr('Métodos Suscripción', 'Sub. Methods', '订阅方式')} ({customPaymentMethods.length})
                </button>{' '}
                {tr(
                  'se muestran directamente a los dueños de tienda para pagar su suscripción.',
                  'are shown directly to store owners when paying their subscription.',
                  '会直接展示给店主用于支付订阅费。'
                )}
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
                      {translatePaymentMethodLabel(m.name, lang)} ({m.currency}) {m.isActive ? '' : `· ${tr('Pausado', 'Paused', '已暂停')}`}
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
                <span>{tr('Configurar Métodos Manuales', 'Configure Manual Methods', '配置手动方式')} ({customPaymentMethods.length})</span>
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
                  value={translateUnconfiguredBillingText(billing.bankTransfers, lang)}
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
                  value={translateUnconfiguredBillingText(billing.pagoMovil, lang)}
                  onChange={(e) => setBilling({ ...billing, pagoMovil: e.target.value })}
                  className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {t.admin.binanceLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={translateUnconfiguredBillingText(billing.binancePay, lang)}
                    onChange={(e) => setBilling({ ...billing, binancePay: e.target.value })}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <QrUploadField
                  value={billing.binanceQrUrl}
                  onChange={(url) => setBilling({ ...billing, binanceQrUrl: url })}
                  label={tr('Código QR Binance Pay (Base)', 'Binance Pay QR Code (Base)', 'Binance Pay 基础收款二维码')}
                  hint={tr(
                    'Los dueños de tienda verán este QR directamente al elegir Binance Pay.',
                    'Store owners will see this QR directly when selecting Binance Pay.',
                    '店主选择 Binance Pay 时将直接看到此收款二维码。'
                  )}
                  onZoom={(qrUrl) =>
                    setZoomQrState({
                      qrUrl,
                      title: 'Binance Pay QR',
                      accountDetails: billing.binancePay,
                    })
                  }
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {t.admin.bybitLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={translateUnconfiguredBillingText(billing.bybitPay, lang)}
                    onChange={(e) => setBilling({ ...billing, bybitPay: e.target.value })}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <QrUploadField
                  value={billing.bybitQrUrl}
                  onChange={(url) => setBilling({ ...billing, bybitQrUrl: url })}
                  label={tr('Código QR Bybit Pay (Base)', 'Bybit Pay QR Code (Base)', 'Bybit Pay 基础收款二维码')}
                  hint={tr(
                    'Los dueños de tienda verán este QR directamente al elegir Bybit Pay.',
                    'Store owners will see this QR directly when selecting Bybit Pay.',
                    '店主选择 Bybit Pay 时将直接看到此收款二维码。'
                  )}
                  onZoom={(qrUrl) =>
                    setZoomQrState({
                      qrUrl,
                      title: 'Bybit Pay QR',
                      accountDetails: billing.bybitPay,
                    })
                  }
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
                <span>
                  {tr(
                    'Métodos de Pago Personalizados para Registro de Ventas de Tiendas',
                    'Custom Payment Methods for Store Sales Recording',
                    '商店销售记录的自定义收款方式'
                  )}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {tr(
                  'Agrega, edita o elimina opciones globales (ej: Binance Pay, Zinli, Transferencia Banesco, Zelle, Wally, Cashea) para que los dueños de tiendas las seleccionen automáticamente en Caja POS y en Ventas Directas. Cada dueño además configura manualmente sus propios datos de cobro desde su portal.',
                  'Add, edit, or remove global options (e.g., Binance Pay, Zinli, Banesco Transfer, Zelle, Wally, Cashea) so store owners can select them automatically in POS Checkout and Direct Sales. Each owner can also configure their own receiving details in their portal.',
                  '添加、编辑或删除全局选项（如 Binance Pay、Zinli、Banesco 转账、Zelle、Wally、Cashea），以便店主在 POS 收银和直接销售中自动选择。每位店主也可在其门户中手动配置收款信息。'
                )}
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
                        ? `${tr('Editar Método:', 'Edit Method:', '编辑方式:')} ${editingSalesMethodTarget.name}`
                        : tr('Agregar Método de Pago para Ventas', 'Add Sales Payment Method', '添加销售收款方式')}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tr(
                      'Define el nombre, moneda y si aplica IGTF 3% divisas para las ventas de los comercios.',
                      'Define the name, currency, and whether 3% foreign-currency IGTF applies to merchant sales.',
                      '设置名称、币种以及商家销售是否适用 3% 外币 IGTF 税。'
                    )}
                  </p>
                </div>
                {editingSalesMethodTarget && (
                  <button
                    type="button"
                    onClick={resetSalesMethodForm}
                    className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-[#09090b]"
                  >
                    {t.common.cancel}
                  </button>
                )}
              </div>

              {!editingSalesMethodTarget && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">{tr('Plantillas rápidas:', 'Quick templates:', '快速模板：')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        name: 'Binance Pay',
                        currency: 'USDT' as PlatformPaymentCurrency,
                        igtf: false,
                        desc: tr('Pago cripto en USDT sin comisión bancaria', 'USDT crypto payment without bank fees', '无银行手续费的 USDT 加密货币支付'),
                      },
                      {
                        name: 'Zinli',
                        currency: 'USD' as PlatformPaymentCurrency,
                        igtf: true,
                        desc: tr('Billetera digital USD prepagada', 'Prepaid USD digital wallet', '预付美元电子钱包'),
                      },
                      {
                        name: tr('Transferencia Banesco', 'Banesco Transfer', 'Banesco 转账'),
                        currency: 'Bs' as PlatformPaymentCurrency,
                        igtf: false,
                        desc: tr('Transferencia bancaria nacional en Bolívares', 'National bank transfer in Bolívares', '国内玻利瓦尔银行转账'),
                      },
                      {
                        name: 'Zelle',
                        currency: 'USD' as PlatformPaymentCurrency,
                        igtf: true,
                        desc: tr('Transferencia instantánea en USD', 'Instant USD transfer', '即时美元转账'),
                      },
                      {
                        name: 'Wally',
                        currency: 'USD' as PlatformPaymentCurrency,
                        igtf: true,
                        desc: tr('Billetera digital USD Banesco Panamá', 'Banesco Panama USD digital wallet', 'Banesco Panama 美元钱包'),
                      },
                      {
                        name: 'Cashea',
                        currency: 'USD' as PlatformPaymentCurrency,
                        igtf: false,
                        desc: tr('Compra ahora y paga en cuotas', 'Buy now, pay in installments', '先买后分期付款'),
                      },
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
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Nombre del Método *', 'Method Name *', '方式名称 *')}</label>
                  <input
                    required
                    type="text"
                    maxLength={80}
                    value={spName}
                    onChange={(e) => setSpName(e.target.value)}
                    placeholder={tr('Ej: Binance Pay / Zinli / Transferencia Banesco', 'e.g. Binance Pay / Zinli / Banesco Transfer', '例如：Binance Pay / Zinli / Banesco 转账')}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">{tr('Moneda *', 'Currency *', '币种 *')}</label>
                  <select
                    value={spCurrency}
                    onChange={(e) => setSpCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="USDT">USDT</option>
                    <option value="Bs">Bs.</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr('Descripción / Nota Operativa (Opcional)', 'Description / Operational Note (Optional)', '描述 / 操作说明（可选）')}
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={spDescription}
                  onChange={(e) => setSpDescription(e.target.value)}
                  placeholder={tr('Ej: Acepta USDT TRC20 / correo de billetera o transferencia directa', 'e.g. Accepts USDT TRC20 / wallet email or direct transfer', '例如：支持 USDT TRC20 / 钱包邮箱或直接转账')}
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
                  <span>{tr('Aplica IGTF 3% Divisas (SENIAT) por defecto en POS', 'Apply 3% Foreign-Currency IGTF by default in POS', '默认在 POS 中适用 3% 外币 IGTF 税')}</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spActive}
                    onChange={(e) => setSpActive(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span>{tr('Habilitado como opción para que las tiendas registren ventas', 'Enabled as an option for stores to record sales', '启用为商店记录销售的可选方式')}</span>
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
                    ? tr('Actualizar Método de Venta', 'Update Sales Method', '更新销售收款方式')
                    : tr('Agregar Método de Venta', 'Add Sales Method', '添加销售收款方式')}
                </span>
              </button>
            </form>

            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    {tr('Catálogo de Métodos Personalizados para Ventas', 'Custom Sales Payment Methods Catalog', '自定义销售收款方式目录')} ({salesPaymentMethods.length})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {tr(
                      'Todos los métodos activos aparecen automáticamente al registrar ventas en POS y en Ventas Directas de cada tienda.',
                      'All active methods appear automatically when recording sales in POS and Direct Sales for every store.',
                      '所有已启用的方式将自动出现在每家店铺的 POS 收银和直接销售中。'
                    )}
                  </p>
                </div>
              </div>

              {salesPaymentMethods.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                  <Wallet className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    {tr('No has agregado métodos personalizados para ventas aún', 'No custom sales payment methods added yet', '尚未添加自定义销售收款方式')}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {tr(
                      'Usa el formulario o las plantillas rápidas a la izquierda (Binance Pay, Zinli, Transferencia Banesco, Zelle).',
                      'Use the form or quick templates on the left (Binance Pay, Zinli, Banesco Transfer, Zelle).',
                      '请使用左侧表单或快速模板（Binance Pay、Zinli、Banesco 转账、Zelle）。'
                    )}
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
                          <span className="font-bold text-white text-sm">
                            {translatePaymentMethodLabel(method.name, lang)}
                          </span>
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
                            {method.isActive ? tr('Activo', 'Active', '启用') : tr('Pausado', 'Paused', '已暂停')}
                          </span>
                        </div>
                        {method.description && (
                          <div className="text-zinc-400 text-[11px]">
                            {translateCommonPaymentInstruction(method.description, lang)}
                          </div>
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
                          {method.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Activate', '启用')}
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
                          title={tr('Editar método', 'Edit method', '编辑方式')}
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
                            {tr('Confirmar', 'Confirm', '确认')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSalesMethodId(method.id)}
                            className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                            title={tr('Eliminar método', 'Delete method', '删除方式')}
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

      {/* ADMIN TAB: MANUAL YOUTUBE VIDEO GUIDES FOR USERS */}
      {activeTab === 'videos' && (() => {
        const resolvedYoutubeId = extractYouTubeVideoId(vidUrl);
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Add / Edit YouTube Tutorial Form */}
              <form
                onSubmit={handleSaveGuideVideo}
                className="lg:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                      <Video className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {editingVideoTarget
                          ? tr('Editar Video de YouTube', 'Edit YouTube Video', '编辑 YouTube 视频')
                          : tr('Agregar Video de YouTube', 'Add YouTube Video', '手动添加 YouTube 视频')}
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {tr(
                        'Pega cualquier enlace de YouTube (watch, youtu.be o Shorts) para crear la guía visual de los usuarios.',
                        'Paste any YouTube link (watch, youtu.be, or Shorts) to publish visual guides for platform users.',
                        '粘贴任意 YouTube 链接（标准视频、短链接或 Shorts），为用户提供视频操作指导。'
                      )}
                    </p>
                  </div>
                  {editingVideoTarget && (
                    <button
                      type="button"
                      onClick={resetVideoForm}
                      className="text-xs text-zinc-400 hover:text-white underline shrink-0"
                    >
                      {t.common.cancel}
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Título del Tutorial *', 'Tutorial Title *', '视频教程标题 *')}
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={120}
                    value={vidTitle}
                    onChange={(e) => setVidTitle(e.target.value)}
                    placeholder={tr(
                      'Ej: Cómo comprar y descargar tu factura PDF paso a paso',
                      'e.g. How to buy and download your PDF receipt step by step',
                      '例如：分步演示如何下单购买并下载 PDF 发票'
                    )}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Enlace o ID de YouTube *', 'YouTube Link or Video ID *', 'YouTube 视频链接或 ID *')}
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={300}
                    value={vidUrl}
                    onChange={(e) => setVidUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                  />
                  {vidUrl.trim() && (
                    <div className="mt-1.5 text-[11px] font-mono">
                      {resolvedYoutubeId ? (
                        <span className="text-emerald-400">
                          {tr(
                            `Video detectado correctamente · ID: ${resolvedYoutubeId}`,
                            `Valid YouTube video detected · ID: ${resolvedYoutubeId}`,
                            `已识别有效视频 · ID: ${resolvedYoutubeId}`
                          )}
                        </span>
                      ) : (
                        <span className="text-red-400">
                          {tr(
                            'Formato no reconocido. Verifica que sea una URL de YouTube válida.',
                            'Unrecognized format. Ensure this is a valid YouTube link.',
                            '链接格式无效，请确认粘贴的是有效的 YouTube 视频地址。'
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Real-time Thumbnail & Player Preview */}
                {resolvedYoutubeId && (
                  <div className="rounded-xl bg-[#09090b] border border-white/[0.08] overflow-hidden">
                    {previewAdminVideoId === resolvedYoutubeId ? (
                      <div className="relative aspect-video w-full">
                        <iframe
                          src={buildYouTubeEmbedUrl(resolvedYoutubeId)}
                          title={vidTitle || 'YouTube preview'}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full border-0"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-2.5">
                        <img
                          src={buildYouTubeThumbnailUrl(resolvedYoutubeId)}
                          alt={vidTitle || resolvedYoutubeId}
                          referrerPolicy="no-referrer"
                          className="w-24 aspect-video rounded-lg object-cover bg-zinc-900 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-[11px] text-zinc-300 font-medium truncate">
                            {vidTitle || tr('Vista previa lista', 'Preview ready', '预览已就绪')}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewAdminVideoId(resolvedYoutubeId)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                          >
                            <Play className="w-3 h-3" />
                            <span>{tr('Probar reproducción aquí', 'Test playback here', '在此测试播放')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Dirigido a', 'Target Audience', '适用人群')}
                    </label>
                    <select
                      value={vidAudience}
                      onChange={(e) => setVidAudience(e.target.value as GuideVideoAudience)}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    >
                      <option value="all">{tr('Todos / General', 'All / General', '综合 / 全部')}</option>
                      <option value="buyers">{tr('Compradores', 'Buyers', '买家用户')}</option>
                      <option value="sellers">{tr('Dueños de Tienda', 'Store Owners', '商家店主')}</option>
                      <option value="warehouse">{tr('Almacén & POS', 'Warehouse & POS', '仓库与收银')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Idioma del Video', 'Video Language', '视频语言')}
                    </label>
                    <select
                      value={vidLanguage}
                      onChange={(e) => setVidLanguage(e.target.value as GuideVideoLanguage)}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                      <option value="zh">{tr('中文 (Chino)', '中文 (Chinese)', '中文')}</option>
                      <option value="all">{tr('Multilingüe', 'Multilingual', '多语言')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-300 block mb-1">
                      {tr('Orden', 'Order', '排序序号')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={vidSortOrder}
                      onChange={(e) => setVidSortOrder(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Descripción breve (Opcional)', 'Short description (Optional)', '简短说明（可选）')}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={vidDescription}
                    onChange={(e) => setVidDescription(e.target.value)}
                    placeholder={tr(
                      'Explica qué aprenderá el usuario en este video (ej. registro de tienda, catálogo de ropa por tallas, verificación de pagos).',
                      'Summarize what users will learn in this video (e.g. store registration, apparel sizes, payment review).',
                      '简要介绍视频内容（例如：注册店铺、设置服装尺码、验证收款凭证）。'
                    )}
                    className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vidActive}
                    onChange={(e) => setVidActive(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span>
                    {tr(
                      'Publicar inmediatamente en la plataforma para usuarios',
                      'Publish immediately on platform for users',
                      '立即发布并在用户端展示此视频教程'
                    )}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isBusy || !resolvedYoutubeId}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 text-center"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingVideoTarget
                      ? tr('Actualizar Video Guía', 'Update Guide Video', '更新视频指南')
                      : tr('Publicar Video en la Plataforma', 'Publish Video to Platform', '发布视频到平台')}
                  </span>
                </button>
              </form>

              {/* Published & Paused Guide Videos Catalog */}
              <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-display">
                      {tr('Catálogo de Videos Guía en la Plataforma', 'Platform Video Guides Catalog', '平台视频教程列表')} ({guideVideos.length})
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {tr(
                        'Los videos activos aparecen automáticamente en la sección de Video Guías del Inicio, Menú, Directorio de Tiendas y Portal Dueño.',
                        'Active videos appear automatically in Video Guides across Landing, Menu, Store Directory, and Merchant Portal.',
                        '已启用的视频将自动展示在首页、导航菜单、店铺目录及商家后台的视频指南区。'
                      )}
                    </p>
                  </div>
                </div>

                {guideVideos.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                    <Video className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">
                      {tr('Aún no has agregado videos de YouTube', 'No YouTube videos added yet', '尚未添加任何 YouTube 视频教程')}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {tr(
                        'Usa el formulario a la izquierda para pegar enlaces de tus tutoriales de YouTube.',
                        'Use the form on the left to paste your YouTube tutorial links.',
                        '请使用左侧表单粘贴您的 YouTube 教学视频链接。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {guideVideos.map((vid) => {
                      const audienceLabel =
                        vid.audience === 'buyers'
                          ? tr('Compradores', 'Buyers', '买家')
                          : vid.audience === 'sellers'
                            ? tr('Dueños de Tienda', 'Store Owners', '商家')
                            : vid.audience === 'warehouse'
                              ? tr('Almacén & POS', 'Warehouse & POS', '仓库 POS')
                              : tr('General', 'General', '综合');
                      const langLabel =
                        vid.language === 'es'
                          ? 'ES'
                          : vid.language === 'en'
                            ? 'EN'
                            : vid.language === 'zh'
                              ? 'ZH'
                              : 'ES/EN/ZH';

                      return (
                        <div
                          key={vid.id}
                          className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-28 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.08] shrink-0 relative">
                              <img
                                src={buildYouTubeThumbnailUrl(vid.youtubeId)}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-amber-300 font-bold">
                                #{vid.sortOrder}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white text-sm truncate max-w-full">
                                  {vid.title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                    vid.isActive
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {vid.isActive ? tr('Activo', 'Active', '已发布') : tr('Pausado', 'Paused', '已暂停')}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
                                <span className="text-amber-300 font-semibold">{audienceLabel}</span>
                                <span aria-hidden="true">·</span>
                                <span>{langLabel}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">ID: {vid.youtubeId}</span>
                              </div>
                              {vid.description && (
                                <p className="text-[11px] text-zinc-400 line-clamp-2">{vid.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <a
                              href={buildYouTubeWatchUrl(vid.youtubeId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                              title={tr('Ver en YouTube', 'Open in YouTube', '在 YouTube 查看')}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleGuideVideoActive(vid)}
                              className={`px-3 py-2 min-h-[38px] rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                                vid.isActive
                                  ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                                  : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                              }`}
                            >
                              {vid.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Activate', '启用')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVideoTarget(vid);
                                setVidTitle(vid.title);
                                setVidUrl(vid.youtubeUrl || buildYouTubeWatchUrl(vid.youtubeId));
                                setVidDescription(vid.description || '');
                                setVidAudience(vid.audience);
                                setVidLanguage(vid.language);
                                setVidSortOrder(vid.sortOrder);
                                setVidActive(vid.isActive);
                                setPreviewAdminVideoId(vid.youtubeId);
                              }}
                              className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                              title={tr('Editar video', 'Edit video', '编辑视频')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteVideoId === vid.id ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteGuideVideo(vid)}
                                className="px-2.5 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                              >
                                {tr('Confirmar', 'Confirm', '确认删除')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVideoId(vid.id)}
                                className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                                title={tr('Eliminar video', 'Delete video', '删除视频')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
            detailsPlaceholder: tr(
              'Banco: Banesco (0134) · RIF/CI · Teléfono: 04XX-XXXXXXX',
              'Bank: Banesco (0134) · ID/RIF · Phone: 04XX-XXXXXXX',
              '银行: Banesco (0134) · 证件/税号 · 电话: 04XX-XXXXXXX'
            ),
            instructions: tr(
              'Calcular al cambio oficial BCV del día e indicar referencia.',
              'Calculate at the official daily BCV rate and indicate reference.',
              '按当日 BCV 官方汇率计算金额并注明参考号。'
            ),
          },
          {
            name: tr('Transferencia Banesco', 'Banesco Transfer', 'Banesco 银行转账'),
            currency: 'Bs',
            detailsPlaceholder: tr(
              'Banesco · Cuenta Corriente: 0134-XXXX-XX-XXXXXXXXXX',
              'Banesco · Checking Account: 0134-XXXX-XX-XXXXXXXXXX',
              'Banesco · 支票账户: 0134-XXXX-XX-XXXXXXXXXX'
            ),
            instructions: tr(
              'Colocar el nombre de la tienda en el concepto.',
              'Include the store name in the transfer memo.',
              '请在转账备注中填写店铺名称。'
            ),
          },
          {
            name: 'Binance Pay (QR)',
            currency: 'USDT',
            detailsPlaceholder: tr(
              'Binance Pay ID / Correo USDT · Escanear QR',
              'Binance Pay ID / USDT Email · Scan QR',
              'Binance Pay ID / USDT 邮箱 · 扫码付款'
            ),
            instructions: tr(
              'Escanea el QR oficial de Binance Pay y reporta Order ID al finalizar.',
              'Scan the official Binance Pay QR and submit Order ID when finished.',
              '请扫描 Binance Pay 二维码并提交订单号。'
            ),
          },
          {
            name: 'Bybit Pay (QR)',
            currency: 'USDT',
            detailsPlaceholder: tr(
              'Bybit UID / Correo interno · Escanear QR',
              'Bybit UID / Internal Email · Scan QR',
              'Bybit UID / 内部邮箱 · 扫码付款'
            ),
            instructions: tr(
              'Escanea el QR desde la app de Bybit o transfiere USDT sin comisión.',
              'Scan the QR in the Bybit app or send a zero-fee internal USDT transfer.',
              '请在 Bybit App 中扫码或进行免手续费 USDT 转账。'
            ),
          },
          {
            name: 'Zelle',
            currency: 'USD',
            detailsPlaceholder: tr(
              'Correo Zelle asignado a esta tienda',
              'Zelle email assigned to this store',
              '分配给此店铺的 Zelle 邮箱'
            ),
            instructions: tr(
              'Indicar nombre de tu tienda en el concepto del Zelle.',
              'Include your store name in the Zelle memo.',
              '请在 Zelle 备注栏填写您的店铺名称。'
            ),
          },
          {
            name: 'Zinli',
            currency: 'USD',
            detailsPlaceholder: tr('Correo Zinli receptor', 'Receiving Zinli email', '收款 Zinli 邮箱'),
            instructions: tr('Adjuntar comprobante de transacción.', 'Attach transaction receipt.', '请附上交易凭证。'),
          },
          {
            name: tr('Efectivo USD', 'USD Cash', '美元现金'),
            currency: 'USD',
            detailsPlaceholder: tr('Cobro presencial autorizado', 'Authorized in-person payment', '授权当面付款'),
            instructions: tr('Coordinar entrega previa por WhatsApp.', 'Coordinate handover in advance via WhatsApp.', '请提前通过 WhatsApp 预约交接。'),
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
                      {tr('Cobro de Suscripción', 'Subscription Billing', '订阅收款')} · {modalStore.storeName}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">
                      {tr('Dueño:', 'Owner:', '店主:')} {modalStore.registeredOwnerName}
                      {ownerEmailMap[modalStore.id] ? ` · ${ownerEmailMap[modalStore.id]}` : ''} · ${modalStore.subscriptionPriceUSD}{tr('/mes', '/mo', '/月')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoreSubMethodsModal(false)}
                  className="min-h-[40px] min-w-[40px] rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center shrink-0"
                  aria-label={tr('Cerrar modal', 'Close modal', '关闭弹窗')}
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
                          ? `${tr('Editar:', 'Edit:', '编辑:')} ${editingStoreSubTarget.name}`
                          : tr('Agregar Método Manual', 'Add Manual Method', '添加手动方式')}
                      </span>
                    </h4>
                    {editingStoreSubTarget && (
                      <button
                        type="button"
                        onClick={resetStoreSubMethodForm}
                        className="text-[11px] text-zinc-400 hover:text-white"
                      >
                        {t.common.cancel}
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
                      <label className="text-[11px] text-zinc-300 block mb-1">{tr('Método *', 'Method *', '方式 *')}</label>
                      <input
                        required
                        type="text"
                        maxLength={80}
                        value={ssPmName}
                        onChange={(e) => setSsPmName(e.target.value)}
                        placeholder={tr('Zelle / Pago Móvil / Binance', 'Zelle / Pago Móvil / Binance', 'Zelle / Pago Móvil / Binance')}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">{tr('Moneda *', 'Currency *', '币种 *')}</label>
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
                        <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      {tr('Titular / Beneficiario', 'Account Holder / Beneficiary', '持有人 / 收款人')}
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={ssPmHolder}
                      onChange={(e) => setSsPmHolder(e.target.value)}
                      placeholder={tr('Nombre o razón social receptora', 'Receiving person or legal entity name', '收款人姓名或公司名称')}
                      className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      {tr('Datos de Cobro *', 'Billing Details *', '收款信息 *')}
                    </label>
                    <textarea
                      required
                      rows={3}
                      maxLength={300}
                      value={ssPmDetails}
                      onChange={(e) => setSsPmDetails(e.target.value)}
                      placeholder={tr('Cuenta, teléfono, correo Zelle o Binance Pay ID', 'Account, phone, Zelle email, or Binance Pay ID', '银行账号、电话、Zelle 邮箱或 Binance Pay ID')}
                      className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 block mb-1">
                      {tr('Instrucciones (Opcional)', 'Instructions (Optional)', '付款说明（可选）')}
                    </label>
                    <input
                      type="text"
                      maxLength={400}
                      value={ssPmInstructions}
                      onChange={(e) => setSsPmInstructions(e.target.value)}
                      placeholder={tr('Indicar referencia o concepto al pagar', 'Include reference or memo when paying', '付款时请注明参考号或备注')}
                      className="w-full px-3 py-2 min-h-[40px] bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                    />
                  </div>

                  <QrUploadField
                    value={ssPmQrImageUrl}
                    onChange={setSsPmQrImageUrl}
                    onZoom={(qrUrl) =>
                      setZoomQrState({
                        qrUrl,
                        title: ssPmName || 'QR',
                        subtitle: modalStore.storeName,
                        accountDetails: ssPmDetails,
                      })
                    }
                  />

                  <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ssPmActive}
                      onChange={(e) => setSsPmActive(e.target.checked)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>{tr('Activo para esta tienda', 'Active for this store', '对此店铺启用')}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {editingStoreSubTarget
                        ? tr('Actualizar Método', 'Update Method', '更新方式')
                        : tr('Guardar Método para Tienda', 'Save Method for Store', '为店铺保存方式')}
                    </span>
                  </button>
                </form>

                <div className="lg:col-span-7 min-w-0 space-y-3">
                  <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                    <span>
                      {tr('Métodos configurados para esta tienda', 'Methods configured for this store', '已为此店铺配置的方式')} ({modalMethods.length})
                    </span>
                    <span className="text-[11px] font-normal text-zinc-400">
                      {tr('Sincronizado con Firestore', 'Synced with Firestore', '已与云端同步')}
                    </span>
                  </div>

                  {modalMethods.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                      <CreditCard className="w-7 h-7 text-zinc-600 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-300">
                        {tr('Sin métodos exclusivos asignados todavía', 'No exclusive methods assigned yet', '尚未分配专属方式')}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {tr(
                          `Agrega manualmente un método a la izquierda para cobrar la suscripción específicamente a ${modalStore.storeName}.`,
                          `Manually add a method on the left to bill the subscription specifically to ${modalStore.storeName}.`,
                          `请在左侧手动添加方式，以专门向 ${modalStore.storeName} 收取订阅费。`
                        )}
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
                              <span className="font-bold text-white">
                                {translatePaymentMethodLabel(method.name, lang)}
                              </span>
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
                                {method.isActive ? tr('Activo', 'Active', '启用') : tr('Pausado', 'Paused', '已暂停')}
                              </span>
                            </div>
                            {method.accountHolder && (
                              <div className="text-zinc-400 text-[11px]">
                                {tr('Titular:', 'Holder:', '持有人:')} <span className="text-zinc-200">{method.accountHolder}</span>
                              </div>
                            )}
                            <div className="text-zinc-200 font-mono text-[11px] whitespace-pre-line">
                              {method.accountDetails}
                            </div>
                            {method.instructions && (
                              <div className="text-zinc-400 text-[11px]">
                                {translateCommonPaymentInstruction(method.instructions, lang)}
                              </div>
                            )}
                            {method.qrImageUrl && (
                              <div className="pt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomQrState({
                                      qrUrl: method.qrImageUrl!,
                                      title: translatePaymentMethodLabel(method.name, lang),
                                      subtitle: modalStore.storeName,
                                      accountDetails: method.accountDetails,
                                    })
                                  }
                                  className="bg-white p-1 rounded-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                                >
                                  <img
                                    src={method.qrImageUrl}
                                    alt={method.name}
                                    referrerPolicy="no-referrer"
                                    className="w-12 h-12 object-contain"
                                  />
                                </button>
                                <span className="text-[11px] text-amber-300 font-semibold">
                                  {tr('QR (ampliar)', 'QR (zoom)', '查看二维码')}
                                </span>
                              </div>
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
                              {method.isActive ? tr('Pausar', 'Pause', '暂停') : tr('Activar', 'Activate', '启用')}
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
                                setSsPmQrImageUrl(method.qrImageUrl || '');
                                setSsPmActive(method.isActive);
                              }}
                              className="p-1.5 min-h-[34px] min-w-[34px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                              title={tr('Editar', 'Edit', '编辑')}
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
                                  {tr('Confirmar', 'Confirm', '确认')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStoreSubId(null)}
                                  className="px-2 py-1.5 min-h-[34px] rounded-lg bg-[#111114] border border-white/[0.1] text-zinc-400 text-[11px]"
                                >
                                  {tr('No', 'No', '否')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteStoreSubId(method.id)}
                                className="p-1.5 min-h-[34px] min-w-[34px] rounded-lg bg-red-950/50 border border-red-500/30 hover:bg-red-900/60 text-red-300 flex items-center justify-center"
                                title={tr('Eliminar', 'Delete', '删除')}
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

      <QrZoomModal
        isOpen={Boolean(zoomQrState)}
        qrUrl={zoomQrState?.qrUrl}
        title={zoomQrState?.title || 'QR'}
        subtitle={zoomQrState?.subtitle}
        accountDetails={zoomQrState?.accountDetails}
        onClose={() => setZoomQrState(null)}
      />
    </section>
  );
};
