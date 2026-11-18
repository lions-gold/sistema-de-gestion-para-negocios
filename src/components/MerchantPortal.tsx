import React, { useState, useEffect } from 'react';
import {
  Store,
  CreditCard,
  Package,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit3,
  Star,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  MessageCircle,
  ShoppingBag,
  LogOut,
  FileSpreadsheet,
  ExternalLink,
  FileText,
  TrendingUp,
  DollarSign,
  Receipt,
  X,
  Minus,
  Gift,
  Mail,
  Ticket,
  Check,
  Sparkles,
  Compass,
  Server,
  Wallet,
  Save,
} from 'lucide-react';
import { MerchantVectorTab } from './MerchantVectorTab';
import { EmailProviderConfigPanel } from './EmailProviderConfigPanel';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { normalizeVenezuelanPhone } from '../utils/venezuelaTime';
import {
  PlatformBillingSettings,
  PlatformPaymentCurrency,
  PlatformPaymentMethod,
  ReferralCodeLookup,
  ReferralCoupon,
  SalesPaymentMethod,
  ShippingType,
  StoreCartItem,
  StoreInboxMessage,
  StoreOrder,
  StorePaymentMethod,
  StoreProduct,
  StoreReferral,
  StoreSubscriptionPaymentMethod,
  StoreTenant,
  SubscriptionPayment,
  SubscriptionPaymentMethod,
} from '../types';
import {
  buildPaymentVoucherLinks,
  claimPendingAdminStoresForUser,
  compressImageFileToDataURL,
  createStoreOrderInCloud,
  DEFAULT_BILLING_SETTINGS,
  deleteStorePaymentMethod,
  deleteStoreProduct,
  dispatchSubscriptionPaymentProof,
  ensureStoreReferralCode,
  exportProductsToCSV,
  exportProductsToJSON,
  exportStoreSalesToCSV,
  fetchStoreOrderItems,
  getPlatformBillingSettings,
  importStoreProductsBatch,
  markStoreInboxMessageRead,
  normalizeReferralCode,
  parseImportedDatabaseFile,
  PaymentVoucherDispatchResult,
  registerStoreTenant,
  resolveReferralCode,
  saveStorePaymentMethod,
  saveStoreProduct,
  signOutAccount,
  StoreProductInput,
  submitSubscriptionPayment,
  subscribeActivePlatformPaymentMethods,
  subscribeActiveSalesPaymentMethods,
  subscribeAllStorePaymentMethodsForOwner,
  subscribeOwnerCoupons,
  subscribeOwnerPayments,
  subscribeOwnerReferrals,
  subscribeOwnerStoreOrders,
  subscribeOwnerStoreProducts,
  subscribeOwnerStores,
  subscribeStoreInbox,
  subscribeStoreSubscriptionMethodsForOwner,
  toggleStorePaymentMethodActive,
  updateStoreOrderStatus,
  updateStoreTenantByOwner,
} from '../services/saasService';
import { GoogleAuthButton } from './GoogleAuthButton';
import {
  exportStoreOrderInvoicePDF,
  exportStoreSalesLedgerPDF,
} from '../utils/pdfExport';
import { useLanguage } from '../i18n/LanguageContext';
import {
  applyOfflineOrderStockToCache,
  createLocalOfflineOrderSnapshot,
  isAppEffectivelyOffline,
  isNetworkOrOfflineError,
  loadCachedAuthSnapshot,
  loadCachedOwnerStoreOrders,
  loadCachedOwnerStores,
  loadCachedPlatformBilling,
  loadCachedPlatformPaymentMethods,
  loadCachedSalesPaymentMethods,
  loadCachedStorefrontWarehouseProducts,
  loadCachedStorePaymentMethods,
  loadCachedStoreSubscriptionMethods,
  queueOfflineMutation,
  saveCachedOwnerStoreOrders,
  saveCachedOwnerStores,
  saveCachedPlatformBilling,
  saveCachedPlatformPaymentMethods,
  saveCachedSalesPaymentMethods,
  saveCachedStorefrontWarehouseProducts,
  saveCachedStorePaymentMethods,
  saveCachedStoreProducts,
  saveCachedStoreSubscriptionMethods,
} from '../services/offlineSyncService';

interface MerchantPortalProps {
  exchangeRate: number;
  initialReferralCode?: string;
  onClearCapturedReferral?: () => void;
  onOpenStorefront: (slug: string) => void;
  onOpenWarehouseApp?: (storeId?: string) => void;
  onNavigateMarketplace?: () => void;
  onOpenVectorSellerGuide?: (autoPrompt?: string) => void;
  onActiveBrandContext?: (ctx: { store: StoreTenant | null; products: StoreProduct[] }) => void;
}

export const MerchantPortal: React.FC<MerchantPortalProps> = ({
  exchangeRate,
  initialReferralCode = '',
  onClearCapturedReferral,
  onOpenStorefront,
  onOpenWarehouseApp,
  onNavigateMarketplace,
  onOpenVectorSellerGuide,
  onActiveBrandContext,
}) => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [stores, setStores] = useState<StoreTenant[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isCreatingNewStore, setIsCreatingNewStore] = useState(false);

  const [billing, setBilling] = useState<PlatformBillingSettings>(
    () => loadCachedPlatformBilling() || DEFAULT_BILLING_SETTINGS
  );
  const [customPaymentMethods, setCustomPaymentMethods] = useState<PlatformPaymentMethod[]>(() =>
    loadCachedPlatformPaymentMethods()
  );
  const [salesPaymentMethods, setSalesPaymentMethods] = useState<SalesPaymentMethod[]>(() =>
    loadCachedSalesPaymentMethods()
  );
  const [storePaymentMethods, setStorePaymentMethods] = useState<StorePaymentMethod[]>([]);
  const [storeSubscriptionMethods, setStoreSubscriptionMethods] = useState<
    StoreSubscriptionPaymentMethod[]
  >([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [referrals, setReferrals] = useState<StoreReferral[]>([]);
  const [coupons, setCoupons] = useState<ReferralCoupon[]>([]);
  const [inboxMessages, setInboxMessages] = useState<StoreInboxMessage[]>([]);

  const [activeTab, setActiveTab] = useState<
    | 'catalog'
    | 'billing'
    | 'payment_methods'
    | 'orders'
    | 'referrals'
    | 'inbox'
    | 'vector'
    | 'email_smtp'
    | 'settings'
  >('billing');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Store Registration Form State
  const [regStoreName, setRegStoreName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regRif, setRegRif] = useState('');
  const [regLogoUrl, setRegLogoUrl] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('+58 ');
  const [regCategory, setRegCategory] = useState('Comercio General');
  const [regDescription, setRegDescription] = useState('');
  const [regNationalEnabled, setRegNationalEnabled] = useState(true);
  const [regNationalCouriers, setRegNationalCouriers] = useState('MRW, Zoom, Tealca');
  const [regLocalEnabled, setRegLocalEnabled] = useState(true);
  const [regLocalFee, setRegLocalFee] = useState('3');
  const [regLocalZone, setRegLocalZone] = useState('Área Metropolitana');
  const [regPickupEnabled, setRegPickupEnabled] = useState(true);
  const [regReferralCode, setRegReferralCode] = useState(initialReferralCode);
  const [resolvedReferrer, setResolvedReferrer] = useState<ReferralCodeLookup | null>(null);

  // Payment Report Form State
  const [payMethod, setPayMethod] = useState<SubscriptionPaymentMethod>('Pago Móvil');
  const [hasManualPayMethodSelection, setHasManualPayMethodSelection] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payPayerInfo, setPayPayerInfo] = useState('');
  const [payWhatsapp, setPayWhatsapp] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payProofImage, setPayProofImage] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [lastPaymentVoucher, setLastPaymentVoucher] = useState<{
    payment: SubscriptionPayment;
    result: PaymentVoucherDispatchResult;
  } | null>(null);

  // Product Editor Modal/Inline State
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodRating, setProdRating] = useState('5');
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('General');
  const [prodSku, setProdSku] = useState('');
  const [prodStock, setProdStock] = useState('15');
  const [prodUnit, setProdUnit] = useState('und');

  // Bulk Import Preview State
  const [importPreview, setImportPreview] = useState<StoreProductInput[]>([]);
  const [importFileName, setImportFileName] = useState('');

  // Direct Sale Modal State (Per-store personalized sales registration)
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [directCart, setDirectCart] = useState<StoreCartItem[]>([]);
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerRif, setSaleCustomerRif] = useState('');
  const [saleCustomerPhone, setSaleCustomerPhone] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState('Pago Móvil');
  const [saleShippingType, setSaleShippingType] = useState<ShippingType>('Retiro en Tienda');
  const [saleShippingDetails, setSaleShippingDetails] = useState('');

  // Store Owner Manual Payment / Collection Method Form State
  const [editingStoreMethod, setEditingStoreMethod] = useState<StorePaymentMethod | null>(null);
  const [stPmName, setStPmName] = useState('');
  const [stPmCurrency, setStPmCurrency] = useState<PlatformPaymentCurrency>('USD');
  const [stPmHolder, setStPmHolder] = useState('');
  const [stPmDetails, setStPmDetails] = useState('');
  const [stPmInstructions, setStPmInstructions] = useState('');
  const [stPmAppliesIgtf, setStPmAppliesIgtf] = useState(false);
  const [stPmActive, setStPmActive] = useState(true);
  const [confirmDeleteStoreMethodId, setConfirmDeleteStoreMethodId] = useState<string | null>(null);

  useEffect(() => {
    getPlatformBillingSettings().then((b) => {
      setBilling(b);
      saveCachedPlatformBilling(b);
    });
    const unsubCustomMethods = subscribeActivePlatformPaymentMethods((list) => {
      setCustomPaymentMethods(list);
      saveCachedPlatformPaymentMethods(list);
    });
    const unsubSalesMethods = subscribeActiveSalesPaymentMethods((list) => {
      setSalesPaymentMethods(list);
      saveCachedSalesPaymentMethods(list);
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName) {
        setRegOwnerName((prev) => prev || u.displayName || '');
      }
    });
    return () => {
      unsub();
      unsubCustomMethods();
      unsubSalesMethods();
    };
  }, []);

  const cachedAuth = loadCachedAuthSnapshot();
  const effectiveUid =
    user && user.emailVerified
      ? user.uid
      : !user && isAppEffectivelyOffline() && cachedAuth?.emailVerified
        ? cachedAuth.uid
        : '';
  const effectiveEmail = user?.email || cachedAuth?.email || '';
  const effectiveDisplayName = user?.displayName || cachedAuth?.displayName || '';
  const effectivePhotoURL = user?.photoURL || '';

  useEffect(() => {
    if (!user || !user.emailVerified) {
      if (effectiveUid) {
        const cachedStores = loadCachedOwnerStores(effectiveUid);
        if (cachedStores.length > 0) {
          setStores(cachedStores);
          setSelectedStoreId((prev) => prev || cachedStores[0].id);
        }
        return;
      }
      setStores([]);
      setPayments([]);
      setReferrals([]);
      setCoupons([]);
      return;
    }

    const cachedStores = loadCachedOwnerStores(user.uid);
    if (cachedStores.length > 0) {
      setStores((prev) => (prev.length === 0 ? cachedStores : prev));
      setSelectedStoreId((prev) => prev || cachedStores[0].id);
    }

    let cancelled = false;
    if (!isAppEffectivelyOffline()) {
      claimPendingAdminStoresForUser(user).then((claimed) => {
        if (cancelled || claimed.length === 0) return;
        setSelectedStoreId((prev) => prev || claimed[0].id);
        setStatusMessage(
          `Tienda vinculada automáticamente: ${claimed.map((s) => s.storeName).join(', ')}`
        );
      });
    }

    const unsubStores = subscribeOwnerStores(user.uid, (list) => {
      setStores(list);
      saveCachedOwnerStores(user.uid, list);
      if (list.length > 0) {
        setSelectedStoreId((prev) => prev || list[0].id);
      }
    });
    const unsubPays = subscribeOwnerPayments(user.uid, setPayments);
    const unsubRefs = subscribeOwnerReferrals(user.uid, setReferrals);
    const unsubCoups = subscribeOwnerCoupons(user.uid, setCoupons);
    return () => {
      cancelled = true;
      unsubStores();
      unsubPays();
      unsubRefs();
      unsubCoups();
    };
  }, [user, effectiveUid]);

  const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;

  useEffect(() => {
    if (!activeStore || !effectiveUid) {
      setProducts([]);
      setOrders([]);
      setInboxMessages([]);
      setStorePaymentMethods([]);
      setStoreSubscriptionMethods([]);
      return;
    }

    const cachedProds = loadCachedStorefrontWarehouseProducts(activeStore.id);
    if (cachedProds.length > 0) setProducts(cachedProds);
    const cachedOrders = loadCachedOwnerStoreOrders(activeStore.id);
    if (cachedOrders.length > 0) setOrders(cachedOrders);
    const cachedPayMethods = loadCachedStorePaymentMethods(activeStore.id);
    if (cachedPayMethods.length > 0) setStorePaymentMethods(cachedPayMethods);
    const cachedSubMethods = loadCachedStoreSubscriptionMethods(activeStore.id);
    setStoreSubscriptionMethods(cachedSubMethods);

    if (!user) return;

    const unsubProds = subscribeOwnerStoreProducts(activeStore.id, user.uid, (list) => {
      setProducts(list);
      saveCachedStorefrontWarehouseProducts(activeStore.id, list);
    });
    const unsubOrds = subscribeOwnerStoreOrders(activeStore.id, user.uid, (list) => {
      setOrders(list);
      saveCachedOwnerStoreOrders(activeStore.id, list);
    });
    const unsubInbox = subscribeStoreInbox(activeStore.id, user.uid, setInboxMessages);
    const unsubStorePm = subscribeAllStorePaymentMethodsForOwner(activeStore.id, user.uid, (list) => {
      setStorePaymentMethods(list);
      saveCachedStorePaymentMethods(activeStore.id, list);
    });
    const unsubStoreSubPm = subscribeStoreSubscriptionMethodsForOwner(
      activeStore.id,
      user.uid,
      (list) => {
        setStoreSubscriptionMethods(list);
        saveCachedStoreSubscriptionMethods(activeStore.id, list);
      }
    );

    if (!activeStore.referralCode && !isAppEffectivelyOffline()) {
      ensureStoreReferralCode(activeStore).catch(() => {});
    }

    return () => {
      unsubProds();
      unsubOrds();
      unsubInbox();
      unsubStorePm();
      unsubStoreSubPm();
    };
  }, [activeStore, user, effectiveUid]);

  const onActiveBrandContextRef = React.useRef(onActiveBrandContext);
  onActiveBrandContextRef.current = onActiveBrandContext;

  useEffect(() => {
    onActiveBrandContextRef.current?.({
      store: activeStore,
      products,
    });
  }, [activeStore, products]);

  useEffect(() => {
    if (initialReferralCode && !regReferralCode) {
      setRegReferralCode(initialReferralCode);
    }
  }, [initialReferralCode, regReferralCode]);

  useEffect(() => {
    const clean = normalizeReferralCode(regReferralCode);
    if (clean.length < 4) {
      setResolvedReferrer(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      resolveReferralCode(clean).then((res) => {
        if (!cancelled) setResolvedReferrer(res);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [regReferralCode]);

  // Populate Settings form when switching activeStore
  useEffect(() => {
    if (!activeStore || isCreatingNewStore) return;
    setRegStoreName(activeStore.storeName);
    setRegOwnerName(activeStore.registeredOwnerName);
    setRegRif(activeStore.rif || '');
    setRegLogoUrl(activeStore.logoUrl || '');
    setRegWhatsapp(activeStore.businessWhatsapp);
    setPayWhatsapp((prev) => prev || activeStore.businessWhatsapp || '');
    setRegCategory(activeStore.category || 'Comercio General');
    setRegDescription(activeStore.description || '');
    setRegNationalEnabled(activeStore.nationalShippingEnabled);
    setRegNationalCouriers(activeStore.nationalCouriers || 'MRW, Zoom, Tealca');
    setRegLocalEnabled(activeStore.localDeliveryEnabled);
    setRegLocalFee(String(activeStore.localDeliveryFeeUSD ?? 0));
    setRegLocalZone(activeStore.localDeliveryZone || '');
    setRegPickupEnabled(activeStore.pickupEnabled);
  }, [activeStore, isCreatingNewStore]);

  const notify = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const notifyError = (msg: string) => {
    setStatusMessage(null);
    setErrorMessage(msg);
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataURL(file, 320, 0.78);
      setRegLogoUrl(dataUrl);
      notify('Logo cargado y optimizado.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error al procesar logo.');
    }
  };

  const handleUploadProductPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataURL(file, 420, 0.72);
      setProdImage(dataUrl);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error al procesar imagen.');
    }
  };

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsBusy(true);
    try {
      const created = await registerStoreTenant(user, {
        storeName: regStoreName,
        registeredOwnerName: regOwnerName,
        rif: regRif,
        logoUrl: regLogoUrl,
        businessWhatsapp: regWhatsapp,
        category: regCategory,
        description: regDescription,
        nationalShippingEnabled: regNationalEnabled,
        nationalCouriers: regNationalCouriers,
        localDeliveryEnabled: regLocalEnabled,
        localDeliveryFeeUSD: Number(regLocalFee) || 0,
        localDeliveryZone: regLocalZone,
        pickupEnabled: regPickupEnabled,
        referredByCode: regReferralCode.trim() || undefined,
      });
      setSelectedStoreId(created.id);
      setIsCreatingNewStore(false);
      setActiveTab('billing');
      onClearCapturedReferral?.();
      notify('Tienda registrada. Reporta tu pago mensual de $25 para solicitar activación.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error registrando tienda.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setIsBusy(true);
    try {
      await updateStoreTenantByOwner(activeStore, {
        storeName: regStoreName,
        registeredOwnerName: regOwnerName,
        rif: regRif,
        logoUrl: regLogoUrl,
        businessWhatsapp: regWhatsapp,
        category: regCategory,
        description: regDescription,
        nationalShippingEnabled: regNationalEnabled,
        nationalCouriers: regNationalCouriers,
        localDeliveryEnabled: regLocalEnabled,
        localDeliveryFeeUSD: Number(regLocalFee) || 0,
        localDeliveryZone: regLocalZone,
        pickupEnabled: regPickupEnabled,
      });
      notify('Datos fiscales, logo y preferencias de envío actualizados.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error actualizando tienda.');
    } finally {
      setIsBusy(false);
    }
  };

  const availableCoupons = coupons.filter((c) => c.status === 'available');
  const selectedCoupon = availableCoupons.find((c) => c.id === selectedCouponId) || null;
  const baseSubscriptionUSD = billing.monthlyPriceUSD || 25;
  const netSubscriptionUSD = selectedCoupon
    ? Math.max(0, Number((baseSubscriptionUSD - selectedCoupon.discountUSD).toFixed(2)))
    : baseSubscriptionUSD;

  const isConfiguredBaseMethod = (text?: string) => {
    const clean = (text || '').trim();
    return Boolean(clean) && !clean.toLowerCase().startsWith('por configurar');
  };

  const activeStoreSubscriptionMethods = storeSubscriptionMethods.filter((m) => m.isActive);
  const storeSpecificMethodNames = new Set(
    activeStoreSubscriptionMethods.map((m) => m.name.trim().toLowerCase())
  );

  const configuredBaseAccounts = [
    {
      key: 'Pago Móvil',
      title: t.merchant.pagoMovil,
      currency: 'Bs' as PlatformPaymentCurrency,
      value: billing.pagoMovil,
    },
    {
      key: 'Transferencia Bancaria',
      title: t.merchant.bankTransfers,
      currency: 'Bs' as PlatformPaymentCurrency,
      value: billing.bankTransfers,
    },
    {
      key: 'Binance Pay',
      title: t.merchant.binancePay,
      currency: 'USDT' as PlatformPaymentCurrency,
      value: billing.binancePay,
    },
    {
      key: 'Bybit',
      title: t.merchant.bybitPay,
      currency: 'USDT' as PlatformPaymentCurrency,
      value: billing.bybitPay,
    },
  ].filter(
    (item) =>
      isConfiguredBaseMethod(item.value) &&
      !storeSpecificMethodNames.has(item.key.trim().toLowerCase()) &&
      !customPaymentMethods.some(
        (pm) => pm.name.trim().toLowerCase() === item.key.trim().toLowerCase()
      )
  );

  const filteredGlobalCustomMethods = customPaymentMethods.filter(
    (pm) => !storeSpecificMethodNames.has(pm.name.trim().toLowerCase())
  );

  const subscriptionCheckoutOptions: Array<{
    value: string;
    label: string;
    currency: string;
    accountHolder?: string;
    accountDetails: string;
    instructions?: string;
    isCustom: boolean;
    isStoreSpecific: boolean;
  }> = [
    ...activeStoreSubscriptionMethods.map((pm) => ({
      value: pm.name,
      label: `${pm.name} (${pm.currency}) · Asignado a tu tienda`,
      currency: pm.currency,
      accountHolder: pm.accountHolder,
      accountDetails: pm.accountDetails,
      instructions: pm.instructions,
      isCustom: true,
      isStoreSpecific: true,
    })),
    ...filteredGlobalCustomMethods.map((pm) => ({
      value: pm.name,
      label: `${pm.name} (${pm.currency})`,
      currency: pm.currency,
      accountHolder: pm.accountHolder,
      accountDetails: pm.accountDetails,
      instructions: pm.instructions,
      isCustom: true,
      isStoreSpecific: false,
    })),
    ...configuredBaseAccounts.map((base) => ({
      value: base.key,
      label: `${base.title} (${base.currency})`,
      currency: base.currency,
      accountDetails: base.value,
      isCustom: false,
      isStoreSpecific: false,
    })),
  ];

  useEffect(() => {
    setHasManualPayMethodSelection(false);
  }, [activeStore?.id]);

  useEffect(() => {
    if (subscriptionCheckoutOptions.length === 0) {
      if (payMethod !== 'Coordinado con Admin (WhatsApp)') {
        setPayMethod('Coordinado con Admin (WhatsApp)');
      }
      return;
    }
    const exists = subscriptionCheckoutOptions.some((opt) => opt.value === payMethod);
    if (!exists || !hasManualPayMethodSelection) {
      setPayMethod(subscriptionCheckoutOptions[0].value as SubscriptionPaymentMethod);
    }
  }, [
    activeStore?.id,
    activeStoreSubscriptionMethods.length,
    customPaymentMethods.length,
    configuredBaseAccounts.length,
    hasManualPayMethodSelection,
    subscriptionCheckoutOptions[0]?.value,
  ]);

  const activeSelectedSubscriptionOption =
    subscriptionCheckoutOptions.find((opt) => opt.value === payMethod) ||
    subscriptionCheckoutOptions[0] ||
    null;

  const formatSubscriptionOptionAmount = (currency: string, usdAmount: number) => {
    if (currency === 'Bs') {
      return `${(usdAmount * exchangeRate).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Bs.`;
    }
    return `$${usdAmount.toFixed(2)} ${currency}`;
  };

  const handleUploadPaymentProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const dataUrl = await compressImageFileToDataURL(file, 480, 0.72);
      setPayProofImage(dataUrl);
      notify('Captura del comprobante cargada y optimizada.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'No se pudo procesar la captura del comprobante.');
    } finally {
      setIsUploadingProof(false);
      e.target.value = '';
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeStore) return;
    if (netSubscriptionUSD > 0 && !payRef.trim()) return;
    setIsBusy(true);
    try {
      const savedPayment = await submitSubscriptionPayment(user, activeStore, {
        amountUSD: baseSubscriptionUSD,
        paymentMethod: payMethod,
        referenceNumber:
          netSubscriptionUSD === 0 && selectedCoupon ? selectedCoupon.code : payRef,
        payerInfo: payPayerInfo,
        notes: payNotes,
        proofImageUrl: payProofImage || undefined,
        ownerWhatsapp: payWhatsapp.trim() || activeStore.businessWhatsapp,
        coupon: selectedCoupon,
      });
      const voucherResult = await dispatchSubscriptionPaymentProof({
        user,
        store: activeStore,
        payment: savedPayment,
        exchangeRate,
        supportWhatsapp: billing.supportWhatsapp,
      });
      setLastPaymentVoucher({
        payment: savedPayment,
        result: voucherResult,
      });
      setPayRef('');
      setPayPayerInfo('');
      setPayNotes('');
      setPayProofImage('');
      setSelectedCouponId('');
      notify(
        voucherResult.emailSent
          ? 'Comprobante registrado y enviado automáticamente por correo al Administrador. Puedes reenviarlo también por WhatsApp abajo.'
          : 'Comprobante registrado en la nube. Usa los botones directos de WhatsApp y Correo para enviar tu recibo al Administrador.'
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error enviando comprobante.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !effectiveUid) return;
    const productInput: StoreProductInput = {
      id: editingProduct?.id,
      name: prodName,
      description: prodDesc,
      priceUSD: Number(prodPrice) || 0,
      costUSD: prodCost ? Number(prodCost) : undefined,
      rating: Number(prodRating) || 5,
      imageUrl: prodImage,
      category: prodCategory,
      sku: prodSku,
      stock: Number(prodStock) || 0,
      unit: prodUnit,
      isActive: true,
    };

    const resetProductForm = () => {
      setEditingProduct(null);
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdCost('');
      setProdRating('5');
      setProdImage('');
      setProdSku('');
      setProdStock('15');
    };

    const saveProductLocally = () => {
      const localProd: StoreProduct = {
        id: editingProduct?.id || `local-prod-${Date.now()}`,
        storeId: activeStore.id,
        ownerUid: effectiveUid,
        name: productInput.name.trim() || 'Producto',
        description: productInput.description.trim() || 'Producto disponible en catálogo',
        priceUSD: Math.max(0, productInput.priceUSD),
        costUSD: productInput.costUSD,
        rating: productInput.rating,
        imageUrl: productInput.imageUrl,
        category: productInput.category,
        sku: productInput.sku,
        stock: Math.max(0, productInput.stock),
        unit: productInput.unit,
        isActive: true,
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProducts((prev) => {
        const next = editingProduct
          ? prev.map((p) => (p.id === localProd.id ? localProd : p))
          : [localProd, ...prev];
        saveCachedStorefrontWarehouseProducts(activeStore.id, next);
        saveCachedStoreProducts(activeStore.id, next);
        return next;
      });
      queueOfflineMutation({
        type: 'storefront_product_upsert',
        label: `Catálogo ${activeStore.storeName}: ${localProd.name}`,
        payload: {
          storeId: activeStore.id,
          ownerUid: effectiveUid,
          input: { ...productInput, id: localProd.id },
          existingProduct: editingProduct || undefined,
        },
      });
      resetProductForm();
      notify('Producto guardado localmente en Modo Offline. Se sincronizará automáticamente al volver internet.');
    };

    if (isAppEffectivelyOffline() || !user) {
      saveProductLocally();
      return;
    }

    setIsBusy(true);
    try {
      await saveStoreProduct(
        activeStore.id,
        user.uid,
        productInput,
        editingProduct || undefined
      );
      resetProductForm();
      notify('Producto guardado en el catálogo de tu tienda.');
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        saveProductLocally();
      } else {
        notifyError(err instanceof Error ? err.message : 'Error guardando producto.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const resetStoreMethodForm = () => {
    setEditingStoreMethod(null);
    setStPmName('');
    setStPmCurrency('USD');
    setStPmHolder(activeStore?.registeredOwnerName || '');
    setStPmDetails('');
    setStPmInstructions('');
    setStPmAppliesIgtf(false);
    setStPmActive(true);
  };

  const handleSaveStorePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeStore) return;
    setIsBusy(true);
    try {
      await saveStorePaymentMethod(
        activeStore.id,
        user.uid,
        {
          id: editingStoreMethod?.id,
          name: stPmName,
          currency: stPmCurrency,
          accountHolder: stPmHolder,
          accountDetails: stPmDetails,
          instructions: stPmInstructions,
          appliesIgtf: stPmAppliesIgtf,
          isActive: stPmActive,
        },
        editingStoreMethod || undefined
      );
      notify(
        editingStoreMethod
          ? `Método de cobro "${stPmName}" actualizado para ${activeStore.storeName}.`
          : `Método de cobro "${stPmName}" configurado. Ya aparece para tus clientes y en tus ventas.`
      );
      resetStoreMethodForm();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error guardando método de cobro de tu tienda.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleStoreMethodActive = async (method: StorePaymentMethod) => {
    if (!activeStore) return;
    setIsBusy(true);
    try {
      await toggleStorePaymentMethodActive(activeStore.id, method, !method.isActive);
      notify(`Método de cobro "${method.name}" ${!method.isActive ? 'activado' : 'pausado'}.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error actualizando estado del método de cobro.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteStorePaymentMethod = async (method: StorePaymentMethod) => {
    if (!activeStore) return;
    setIsBusy(true);
    try {
      await deleteStorePaymentMethod(activeStore.id, method.id);
      setConfirmDeleteStoreMethodId(null);
      if (editingStoreMethod?.id === method.id) {
        resetStoreMethodForm();
      }
      notify(`Método de cobro "${method.name}" eliminado.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error eliminando método de cobro.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedDatabaseFile(text, file.name);
      if (parsed.length === 0) {
        notifyError('No se detectaron productos válidos en el archivo CSV/JSON.');
        return;
      }
      setImportPreview(parsed);
      setImportFileName(file.name);
      notify(`Archivo leído: ${parsed.length} productos listos para importar.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Archivo CSV/JSON inválido.');
    }
  };

  const handleConfirmImport = async () => {
    if (!user || !activeStore || importPreview.length === 0) return;
    setIsBusy(true);
    try {
      const count = await importStoreProductsBatch(activeStore.id, user.uid, importPreview);
      setImportPreview([]);
      setImportFileName('');
      notify(`${count} productos importados exitosamente con foto, descripción, precio y estrellas.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error importando base de datos.');
    } finally {
      setIsBusy(false);
    }
  };

  const downloadSampleCSVTemplate = () => {
    const csv =
      '\uFEFFnombre,descripcion,precioUSD,calificacionEstrellas,foto,categoria,sku,stock,costoUSD,unidad\n' +
      '"Audífonos Pro Bluetooth","Cancelación de ruido y estuche de carga rápida",29.90,5,"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400","Electrónica","AUD-001",25,16.50,"und"\n' +
      '"Café Gourmet Venezolano 500g","Tueste medio altura andina aroma intenso",8.50,4.8,"","Alimentos","CAF-500",40,4.80,"bolsa"\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos_smith_saas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOrderInvoice = async (
    ord: StoreOrder,
    mode: 'cliente' | 'dueno' | 'dual'
  ) => {
    if (!activeStore || !user) return;
    setIsBusy(true);
    try {
      const items = await fetchStoreOrderItems(activeStore.id, ord, user.uid);
      exportStoreOrderInvoicePDF(activeStore, ord, items, mode);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'No se pudo generar la factura PDF.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleOrderStatusChange = async (
    ord: StoreOrder,
    nextStatus: StoreOrder['status']
  ) => {
    if (!activeStore) return;
    setIsBusy(true);
    try {
      const stockDiscountedNow = await updateStoreOrderStatus(
        activeStore.id,
        ord,
        nextStatus,
        products
      );
      notify(
        stockDiscountedNow
          ? `Orden #${ord.invoiceNumber} actualizada a "${nextStatus}" y stock descontado automáticamente.`
          : `Estado de orden #${ord.invoiceNumber} actualizado a "${nextStatus}".`
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error actualizando estado de orden.');
    } finally {
      setIsBusy(false);
    }
  };

  const addProductToDirectSale = (prod: StoreProduct) => {
    setDirectCart((prev) => {
      const found = prev.find((i) => i.product.id === prod.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === prod.id
            ? { ...i, quantity: Math.min(prod.stock || 999, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
  };

  const updateDirectSaleQty = (productId: string, delta: number) => {
    setDirectCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const maxStock = i.product.stock > 0 ? i.product.stock : 999;
          return { ...i, quantity: Math.min(maxStock, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const handleCreateDirectStoreSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !effectiveUid || directCart.length === 0) return;
    if (!saleCustomerName.trim() || !saleCustomerPhone.trim()) return;

    setIsBusy(true);
    try {
      const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`;
      const subtotalUSD = Number(
        directCart.reduce((acc, i) => acc + i.product.priceUSD * i.quantity, 0).toFixed(2)
      );
      const shippingFeeUSD =
        saleShippingType === 'Delivery Local' && activeStore.localDeliveryEnabled
          ? activeStore.localDeliveryFeeUSD || 0
          : 0;
      const totalUSD = Number((subtotalUSD + shippingFeeUSD).toFixed(2));
      const totalBs = Number((totalUSD * exchangeRate).toFixed(2));
      const itemsSummary = directCart
        .map((i) => `${i.quantity}x ${i.product.name} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`)
        .join(' | ')
        .slice(0, 1950);

      const snapshot = [...directCart];
      const baseOrderInput = {
        invoiceNumber,
        customerName: saleCustomerName.trim(),
        customerRif: saleCustomerRif.trim() || undefined,
        customerPhone: saleCustomerPhone.trim(),
        shippingType: saleShippingType,
        shippingDetails: saleShippingDetails.trim() || undefined,
        shippingFeeUSD,
        paymentMethod: salePaymentMethod,
        subtotalUSD,
        totalUSD,
        totalBs,
        exchangeRate,
        itemsSummary,
        saleChannel: 'Venta Directa Tienda' as const,
      };
      const saleOptions = {
        initialStatus: 'completed' as const,
        deductStockImmediately: true,
      };

      const finishDirectSaleReset = (order: StoreOrder, offlineSaved: boolean) => {
        exportStoreOrderInvoicePDF(activeStore, order, snapshot, 'dual');
        setDirectCart([]);
        setSaleCustomerName('');
        setSaleCustomerRif('');
        setSaleCustomerPhone('');
        setSaleShippingDetails('');
        setShowDirectSaleModal(false);
        notify(
          offlineSaved
            ? `Venta Offline #${order.invoiceNumber} guardada localmente en ${activeStore.storeName} (stock descontado y PDF Dual generado). Se sincronizará al volver la señal.`
            : `Venta #${order.invoiceNumber} registrada en ${activeStore.storeName}, stock descontado y Factura Dual (Cliente + Dueño) generada.`
        );
      };

      const saveDirectSaleOffline = () => {
        queueOfflineMutation({
          type: 'marketplace_order',
          label: `Venta Directa #${invoiceNumber} (${activeStore.storeName})`,
          payload: {
            store: activeStore,
            orderInput: baseOrderInput,
            items: snapshot,
            options: saleOptions,
          },
        });
        const nextProducts = products.map((p) => {
          const sold = snapshot.find((i) => i.product.id === p.id);
          return sold ? { ...p, stock: Math.max(0, (Number(p.stock) || 0) - sold.quantity) } : p;
        });
        setProducts(nextProducts);
        saveCachedStorefrontWarehouseProducts(activeStore.id, nextProducts);
        applyOfflineOrderStockToCache(activeStore.id, snapshot);

        const localOrder = createLocalOfflineOrderSnapshot(
          activeStore,
          baseOrderInput,
          snapshot,
          effectiveUid,
          'completed'
        );
        setOrders((prev) => {
          const next = [localOrder, ...prev];
          saveCachedOwnerStoreOrders(activeStore.id, next);
          return next;
        });
        finishDirectSaleReset(localOrder, true);
      };

      if (isAppEffectivelyOffline() || !user) {
        saveDirectSaleOffline();
        return;
      }

      try {
        const savedOrder = await createStoreOrderInCloud(
          user,
          activeStore,
          baseOrderInput,
          snapshot,
          saleOptions
        );
        finishDirectSaleReset(savedOrder, false);
      } catch (cloudErr) {
        if (isNetworkOrOfflineError(cloudErr)) {
          saveDirectSaleOffline();
          return;
        }
        throw cloudErr;
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'No se pudo registrar la venta directa.');
    } finally {
      setIsBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Unauthenticated Google Gate (skipped when offline cache holds verified merchant session)
  // ---------------------------------------------------------------------------
  if (!user && !effectiveUid) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-5">
        {/* Clear Seller Space Role Header */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <Store className="w-4 h-4 shrink-0" />
            <span>{t.merchant.roleBanner}</span>
          </div>
          {onNavigateMarketplace && (
            <button
              type="button"
              onClick={onNavigateMarketplace}
              className="text-zinc-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t.merchant.switchToBuyer}</span>
            </button>
          )}
        </div>

        {/* 4-Step Guided Onboarding Tracker */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {t.merchant.stepsTitle}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              { title: t.merchant.step1Title, desc: t.merchant.step1Desc, active: true },
              { title: t.merchant.step2Title, desc: t.merchant.step2Desc, active: false },
              { title: t.merchant.step3Title, desc: t.merchant.step3Desc, active: false },
              { title: t.merchant.step4Title, desc: t.merchant.step4Desc, active: false },
            ].map((step) => (
              <div
                key={step.title}
                className={`p-3 rounded-xl border ${
                  step.active
                    ? 'bg-amber-400/10 border-amber-400/40 text-zinc-100'
                    : 'bg-[#09090b] border-white/[0.06] text-zinc-400'
                }`}
              >
                <div className={`font-bold ${step.active ? 'text-amber-300' : 'text-zinc-200'}`}>
                  {step.title}
                </div>
                <div className="text-[11px] mt-0.5 text-zinc-400">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
              {t.merchant.gateTitle}
            </h1>
            <p className="text-sm text-zinc-300 max-w-xl mx-auto">
              {t.merchant.gateDesc}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <GoogleAuthButton label={t.merchant.gateBtn} variant="primary" />
            {onOpenVectorSellerGuide && (
              <button
                type="button"
                onClick={() => onOpenVectorSellerGuide('Guía para registrar mi tienda paso a paso')}
                className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-xs sm:text-sm font-semibold text-amber-300 flex items-center gap-2 min-h-[44px]"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>{t.merchant.askVectorGuide}</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            {t.merchant.gateFooter}
          </p>
        </div>

        {/* Public Preview of Subscription Payment Methods Configured by Admin */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Métodos Disponibles para Comprar tu Suscripción</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Inicia sesión con Google, registra tu tienda y reporta tu pago con cualquiera de estas opciones habilitadas.
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs">
              <span className="font-bold text-amber-300">${baseSubscriptionUSD} USD/mes</span>
              <span className="text-zinc-500 mx-1.5">·</span>
              <span className="text-zinc-400">
                ≈ {(baseSubscriptionUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
          </div>

          {subscriptionCheckoutOptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#09090b] border border-amber-500/25 text-xs text-zinc-300">
              El Administrador está configurando los métodos de cobro de suscripción. Puedes solicitar las cuentas actualizadas por WhatsApp ({billing.supportWhatsapp}).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {subscriptionCheckoutOptions.map((opt) => (
                <div
                  key={`preview-${opt.value}`}
                  className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-zinc-100 truncate">{opt.value}</span>
                    <span className="font-mono text-[11px] text-amber-300 shrink-0">
                      {opt.currency}
                    </span>
                  </div>
                  {opt.accountHolder && (
                    <p className="text-[11px] text-zinc-400 truncate">Titular: {opt.accountHolder}</p>
                  )}
                  <p className="text-[11px] text-zinc-300 font-mono line-clamp-2 whitespace-pre-line">
                    {opt.accountDetails}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Store Registration View (No stores yet OR creating new)
  // ---------------------------------------------------------------------------
  if (!activeStore || isCreatingNewStore) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Clear Seller Space Header */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <Store className="w-4 h-4 shrink-0" />
            <span>{t.merchant.roleBanner}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onOpenVectorSellerGuide && (
              <button
                type="button"
                onClick={() => onOpenVectorSellerGuide('Paso 2: Cómo llenar los datos y RIF de mi tienda')}
                className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{t.merchant.askVectorGuide}</span>
              </button>
            )}
            {onNavigateMarketplace && (
              <button
                type="button"
                onClick={onNavigateMarketplace}
                className="text-zinc-300 hover:text-white font-medium flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.merchant.switchToBuyer}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Step Progress Bar (Step 1 done, Step 2 active) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/35 text-emerald-200">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t.merchant.step1Title}</span>
            </div>
            <div className="text-[11px] mt-0.5 text-emerald-200/75">{t.merchant.step1Desc}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/45 text-zinc-100">
            <div className="font-bold text-amber-300">{t.merchant.step2Title}</div>
            <div className="text-[11px] mt-0.5 text-zinc-300">{t.merchant.step2Desc}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08] text-zinc-400">
            <div className="font-bold text-zinc-200">{t.merchant.step3Title}</div>
            <div className="text-[11px] mt-0.5">{t.merchant.step3Desc}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#111114] border border-white/[0.08] text-zinc-400">
            <div className="font-bold text-zinc-200">{t.merchant.step4Title}</div>
            <div className="text-[11px] mt-0.5">{t.merchant.step4Desc}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111114] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            {effectivePhotoURL && (
              <img
                src={effectivePhotoURL}
                alt={effectiveDisplayName || ''}
                className="w-10 h-10 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <div className="text-sm font-bold text-white">{effectiveDisplayName || effectiveEmail}</div>
              <div className="text-xs text-zinc-400">{effectiveEmail}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeStore && (
              <button
                onClick={() => setIsCreatingNewStore(false)}
                className="px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white"
              >
                {t.common.cancel}
              </button>
            )}
            <button
              onClick={() => signOutAccount()}
              className="px-3.5 py-2 min-h-[44px] rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] text-xs text-zinc-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.common.signOut}</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleRegisterStore}
          className="bg-[#111114] border border-amber-500/25 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display">
              {t.merchant.regTitle}
            </h1>
            <p className="text-xs text-zinc-400">
              {t.merchant.regSub}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.merchant.storeNameLabel}
              </label>
              <input
                required
                type="text"
                value={regStoreName}
                onChange={(e) => setRegStoreName(e.target.value)}
                placeholder="Ej: Inversiones Caracas Tech"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.merchant.ownerNameLabel}
              </label>
              <input
                required
                type="text"
                value={regOwnerName}
                onChange={(e) => setRegOwnerName(e.target.value)}
                placeholder="Ej: María Rodríguez / Inversiones C.A."
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.merchant.rifLabel}
              </label>
              <input
                type="text"
                value={regRif}
                onChange={(e) => setRegRif(e.target.value)}
                placeholder="Ej: J-50129384-7"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.merchant.waLabel}
              </label>
              <input
                required
                type="tel"
                value={regWhatsapp}
                onChange={(e) => setRegWhatsapp(e.target.value)}
                placeholder="+58 414 1234567"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">{t.merchant.categoryLabel}</label>
              <input
                type="text"
                value={regCategory}
                onChange={(e) => setRegCategory(e.target.value)}
                placeholder="Bodegón, Tech, Retail..."
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-300 block mb-1">
                {t.merchant.logoLabel}
              </label>
              <div className="flex items-center gap-2">
                <label className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-white cursor-pointer shrink-0">
                  {t.merchant.uploadLogoBtn}
                  <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                </label>
                <input
                  type="text"
                  value={regLogoUrl.startsWith('data:') ? 'Image loaded' : regLogoUrl}
                  onChange={(e) => setRegLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-300 block mb-1">{t.merchant.descLabel}</label>
            <textarea
              rows={2}
              value={regDescription}
              onChange={(e) => setRegDescription(e.target.value)}
              placeholder="..."
              className="w-full px-3.5 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
            />
          </div>

          {/* Shipping Options */}
          <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {t.merchant.shippingOptsTitle}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#111114] border border-white/[0.08] cursor-pointer">
                <input
                  type="checkbox"
                  checked={regNationalEnabled}
                  onChange={(e) => setRegNationalEnabled(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-bold text-white">{t.merchant.nationalTitle}</div>
                  <div className="text-[11px] text-zinc-400">{t.merchant.nationalSub}</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#111114] border border-white/[0.08] cursor-pointer">
                <input
                  type="checkbox"
                  checked={regLocalEnabled}
                  onChange={(e) => setRegLocalEnabled(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-bold text-white">{t.merchant.localTitle}</div>
                  <div className="text-[11px] text-zinc-400">{t.merchant.localSub}</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#111114] border border-white/[0.08] cursor-pointer">
                <input
                  type="checkbox"
                  checked={regPickupEnabled}
                  onChange={(e) => setRegPickupEnabled(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-bold text-white">{t.merchant.pickupTitle}</div>
                  <div className="text-[11px] text-zinc-400">{t.merchant.pickupSub}</div>
                </div>
              </label>
            </div>
          </div>

          {/* Referral Attribution Input */}
          <div className="bg-[#09090b]/70 border border-amber-500/20 rounded-xl p-4 space-y-2">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Gift className="w-4 h-4" />
              <span>{t.merchant.referralInputLabel}</span>
            </label>
            <input
              type="text"
              value={regReferralCode}
              onChange={(e) => setRegReferralCode(normalizeReferralCode(e.target.value))}
              placeholder={t.merchant.referralInputPlaceholder}
              className="w-full px-3.5 py-2.5 bg-[#111114] border border-white/[0.1] rounded-xl text-xs font-mono uppercase text-white"
            />
            {resolvedReferrer ? (
              <div className="text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {t.merchant.referralValidBadge} <strong>{resolvedReferrer.storeName}</strong>
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400">{t.merchant.referralInvalidHint}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 min-h-[48px]"
          >
            {isBusy ? t.merchant.creatingStore : t.merchant.createStoreSubmit}
          </button>
        </form>

        {/* Step 3 Preview: Subscription Payment Methods Configured by Admin */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Métodos Habilitados para Pagar tu Suscripción (Paso 3)</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Al registrar tu tienda pasarás al checkout para reportar tu pago con cualquiera de estas cuentas configuradas por el Administrador.
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs">
              <span className="font-bold text-amber-300">${baseSubscriptionUSD} USD/mes</span>
              <span className="text-zinc-500 mx-1.5">·</span>
              <span className="text-zinc-400">
                ≈ {(baseSubscriptionUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
          </div>

          {subscriptionCheckoutOptions.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-amber-500/25 text-xs text-zinc-300">
              Aún no hay cuentas de pago publicadas por el Administrador. Al finalizar el registro podrás coordinar directamente vía WhatsApp ({billing.supportWhatsapp}).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {subscriptionCheckoutOptions.map((opt) => (
                <div
                  key={`reg-preview-${opt.value}`}
                  className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-zinc-100 truncate">{opt.value}</span>
                    <span className="font-mono text-[11px] text-amber-300 shrink-0">
                      {formatSubscriptionOptionAmount(opt.currency, baseSubscriptionUSD)}
                    </span>
                  </div>
                  {opt.accountHolder && (
                    <p className="text-[11px] text-zinc-400 truncate">Titular: {opt.accountHolder}</p>
                  )}
                  <p className="text-[11px] text-zinc-300 font-mono line-clamp-2 whitespace-pre-line">
                    {opt.accountDetails}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Registered Store Dashboard
  // ---------------------------------------------------------------------------
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 w-full min-w-0">
      {/* Top Merchant Header & Store Selector */}
      <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-xl bg-[#09090b] border border-amber-500/30 overflow-hidden shrink-0 flex items-center justify-center">
            {activeStore.logoUrl ? (
              <img
                src={activeStore.logoUrl}
                alt={activeStore.storeName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-7 h-7 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-white font-display break-words">
                {activeStore.storeName}
              </h1>
              {activeStore.status === 'active' ? (
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t.merchant.statusActive}
                </span>
              ) : activeStore.status === 'pending' ? (
                <span className="px-2.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {t.merchant.statusPending}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t.merchant.statusSuspended}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400">
              {t.merchant.ownerPrefix}: {activeStore.registeredOwnerName} · RIF: {activeStore.rif || t.merchant.noRif}
              {effectiveEmail ? ` · ${effectiveEmail}` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto lg:justify-end">
          {stores.length > 1 && (
            <select
              value={activeStore.id}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-2 min-h-[40px] rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-white"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.storeName} ({s.status})
                </option>
              ))}
            </select>
          )}
          {activeStore.status === 'active' && (
            <button
              onClick={() => onOpenStorefront(activeStore.slug)}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>{t.merchant.viewPublicStore}</span>
            </button>
          )}
          {(activeStore.warehousePosEnabled || billing.warehousePosEnabled) && onOpenWarehouseApp && (
            <button
              onClick={() => onOpenWarehouseApp(activeStore.id)}
              className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>{t.merchant.openWarehousePos}</span>
            </button>
          )}
          <button
            onClick={() => setIsCreatingNewStore(true)}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-medium text-white flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>{t.merchant.newStore}</span>
          </button>
          <button
            onClick={() => signOutAccount()}
            className="px-3.5 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>{t.common.signOut}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs sm:text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/[0.08] pb-3">
        {[
          { id: 'billing', label: t.merchant.tabBilling, icon: CreditCard },
          {
            id: 'payment_methods',
            label: `Cobros de Mi Tienda (${storePaymentMethods.filter((m) => m.isActive).length})`,
            icon: Wallet,
          },
          { id: 'catalog', label: `${t.merchant.tabCatalog} (${products.length})`, icon: Package },
          { id: 'orders', label: `${t.merchant.tabOrders} (${orders.length})`, icon: ShoppingBag },
          {
            id: 'referrals',
            label: `${t.merchant.tabReferrals} (${availableCoupons.length})`,
            icon: Gift,
          },
          {
            id: 'inbox',
            label: `${t.merchant.tabInbox} (${inboxMessages.filter((m) => !m.isRead).length})`,
            icon: Mail,
          },
          { id: 'vector', label: 'Asistente Vector', icon: Compass },
          { id: 'email_smtp', label: 'SMTP / Alertas', icon: Server },
          { id: 'settings', label: t.merchant.tabSettings, icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors min-h-[44px] whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-[#111114] border border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BILLING / SUBSCRIPTION PURCHASE */}
      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 min-w-0 space-y-4">
            <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    {t.merchant.paymentMethodsTitle} ${netSubscriptionUSD.toFixed(2)}/mes
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {activeStoreSubscriptionMethods.length > 0
                      ? `Incluye ${activeStoreSubscriptionMethods.length} método${activeStoreSubscriptionMethods.length === 1 ? '' : 's'} asignado${activeStoreSubscriptionMethods.length === 1 ? '' : 's'} específicamente a ${activeStore?.storeName || 'tu tienda'}.`
                      : 'Métodos configurados por el Administrador. Haz clic en uno para seleccionarlo automáticamente en el formulario.'}
                  </p>
                </div>
                <span className="font-mono text-xs text-amber-300 tabular-nums shrink-0">
                  ≈ {(netSubscriptionUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {subscriptionCheckoutOptions.length === 0 ? (
                  <div className="p-5 rounded-xl bg-[#09090b] border border-amber-500/30 space-y-2.5 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                    <div className="text-xs font-bold text-white">
                      El Administrador aún no ha cargado métodos de pago manuales
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Cuando el Administrador configure Pago Móvil, Zelle, Binance Pay o cuentas bancarias en el Panel Admin, aparecerán aquí automáticamente.
                    </p>
                    <a
                      href={`https://wa.me/${(normalizeVenezuelanPhone(billing.supportWhatsapp) || '584220273766')}?text=${encodeURIComponent(
                        `Hola Administrador, deseo pagar la suscripción de mi tienda "${activeStore?.storeName || ''}" ($${netSubscriptionUSD} USD). ¿A qué cuenta transfiero?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Solicitar Datos de Pago por WhatsApp</span>
                    </a>
                  </div>
                ) : (
                  subscriptionCheckoutOptions.map((opt) => {
                  const isSelected = payMethod === opt.value;
                  const exactPayAmount = formatSubscriptionOptionAmount(
                    opt.currency,
                    netSubscriptionUSD
                  );
                  const fullCopyText = [
                    `${opt.value} (${opt.currency}) · Monto: ${exactPayAmount}`,
                    opt.accountHolder ? `Titular: ${opt.accountHolder}` : '',
                    opt.accountDetails,
                    opt.instructions ? `Instrucciones: ${opt.instructions}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n');
                  return (
                    <div
                      key={opt.value}
                      onClick={() => {
                        setHasManualPayMethodSelection(true);
                        setPayMethod(opt.value as SubscriptionPaymentMethod);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setHasManualPayMethodSelection(true);
                          setPayMethod(opt.value as SubscriptionPaymentMethod);
                        }
                      }}
                      className={`rounded-xl p-3.5 space-y-1.5 border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/[0.08] border-amber-400/60'
                          : opt.isStoreSpecific
                            ? 'bg-indigo-950/20 border-indigo-500/35 hover:border-amber-400/45'
                            : 'bg-[#09090b] border-white/[0.08] hover:border-amber-400/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className={`font-bold truncate ${isSelected ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {opt.value}
                          </span>
                          <span className="text-zinc-500" aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] text-amber-200 tabular-nums shrink-0">
                            {exactPayAmount}
                          </span>
                          {opt.isStoreSpecific && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 text-[10px] font-semibold shrink-0">
                              Asignado a tu tienda
                            </span>
                          )}
                          {isSelected && (
                            <>
                              <span className="text-zinc-500" aria-hidden="true">·</span>
                              <span className="text-[11px] font-semibold text-amber-300 shrink-0">
                                Seleccionado
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHasManualPayMethodSelection(true);
                            setPayMethod(opt.value as SubscriptionPaymentMethod);
                            navigator.clipboard?.writeText(fullCopyText);
                            notify(`${opt.value} - ${t.common.copied}`);
                          }}
                          className="text-[11px] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg bg-[#111114] border border-white/[0.08] flex items-center gap-1 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.common.copy}</span>
                        </button>
                      </div>
                      {opt.accountHolder && (
                        <p className="text-zinc-400 text-[11px]">
                          Titular: <span className="text-zinc-200">{opt.accountHolder}</span>
                        </p>
                      )}
                      <p className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                        {opt.accountDetails}
                      </p>
                      {opt.instructions && (
                        <p className="text-zinc-400 text-[11px]">{opt.instructions}</p>
                      )}
                    </div>
                  );
                })
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0 space-y-4">
            <form
              onSubmit={handleSubmitPayment}
              className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-4"
            >
              <h3 className="text-base font-bold text-white font-display">
                {t.merchant.reportPaymentTitle}
              </h3>

              {/* Renewal Coupon Selector */}
              {availableCoupons.length > 0 && (
                <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 space-y-2">
                  <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4" />
                    <span>{t.merchant.couponSelectLabel}</span>
                  </label>
                  <select
                    value={selectedCouponId}
                    onChange={(e) => setSelectedCouponId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090b] border border-emerald-500/40 rounded-lg text-xs text-white font-mono"
                  >
                    <option value="">{t.merchant.noCouponOption}</option>
                    {availableCoupons.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} (-${c.discountUSD} USD · {c.referredStoreName || c.storeName})
                      </option>
                    ))}
                  </select>
                  {selectedCoupon && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-300">
                        {t.merchant.couponDiscountNote} -${selectedCoupon.discountUSD} USD
                      </span>
                      <span className="font-mono font-bold text-white">
                        {t.merchant.netToPayLabel} ${netSubscriptionUSD.toFixed(2)} USD (
                        {(netSubscriptionUSD * exchangeRate).toLocaleString('es-VE', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        Bs.)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {netSubscriptionUSD > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">{t.merchant.methodUsed}</label>
                      <select
                        value={payMethod}
                        onChange={(e) => {
                          setHasManualPayMethodSelection(true);
                          setPayMethod(e.target.value as SubscriptionPaymentMethod);
                        }}
                        className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                      >
                        {subscriptionCheckoutOptions.length === 0 ? (
                          <option value="Coordinado con Admin (WhatsApp)">
                            Coordinado con Admin (WhatsApp)
                          </option>
                        ) : (
                          subscriptionCheckoutOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">{t.merchant.refHash}</label>
                      <input
                        required={netSubscriptionUSD > 0}
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="00492817 / TxID"
                        className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>

                  {activeSelectedSubscriptionOption && (
                    <div className="p-3 rounded-xl bg-[#09090b] border border-amber-500/25 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-amber-300">
                            Cuenta receptora ({activeSelectedSubscriptionOption.value}):
                          </span>
                          <span className="font-mono text-[11px] font-bold text-emerald-300">
                            {formatSubscriptionOptionAmount(
                              activeSelectedSubscriptionOption.currency,
                              netSubscriptionUSD
                            )}
                          </span>
                          {activeSelectedSubscriptionOption.isStoreSpecific && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 text-[10px] font-semibold">
                              Asignado a tu tienda
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeSelectedSubscriptionOption.accountDetails);
                            notify(`${activeSelectedSubscriptionOption.value} - ${t.common.copied}`);
                          }}
                          className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.common.copy}</span>
                        </button>
                      </div>
                      {activeSelectedSubscriptionOption.accountHolder && (
                        <div className="text-[11px] text-zinc-400">
                          Titular: <span className="text-zinc-200">{activeSelectedSubscriptionOption.accountHolder}</span>
                        </div>
                      )}
                      <div className="font-mono text-[11px] text-zinc-200 whitespace-pre-line">
                        {activeSelectedSubscriptionOption.accountDetails}
                      </div>
                      {activeSelectedSubscriptionOption.instructions && (
                        <div className="text-[11px] text-zinc-400">
                          {activeSelectedSubscriptionOption.instructions}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    {t.merchant.payerInfo}
                  </label>
                  <input
                    type="text"
                    value={payPayerInfo}
                    onChange={(e) => setPayPayerInfo(e.target.value)}
                    placeholder="Banesco 0414-0000000 / PayID"
                    className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    WhatsApp para recibir confirmación
                  </label>
                  <input
                    type="tel"
                    value={payWhatsapp}
                    onChange={(e) => setPayWhatsapp(e.target.value)}
                    placeholder="+58 414 0000000"
                    className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Captura del Comprobante (Opcional - Imagen)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-amber-300 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingProof ? 'Procesando...' : 'Adjuntar Captura'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPaymentProof}
                      className="hidden"
                    />
                  </label>
                  {payProofImage ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={payProofImage}
                        alt="Captura de pago"
                        className="w-10 h-10 rounded-lg object-cover border border-emerald-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setPayProofImage('')}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-500">
                      Se adjuntará automáticamente en el correo al Administrador.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t.merchant.notes}</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="..."
                  className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm min-h-[44px]"
              >
                {netSubscriptionUSD === 0 && selectedCoupon
                  ? `${t.merchant.freeCouponSubmitBtn} (${selectedCoupon.code})`
                  : `${t.merchant.sendPaymentBtn} ($${netSubscriptionUSD} USD)`}
              </button>
            </form>

            {/* Immediate Payment Voucher Dispatch Card (Email + WhatsApp) */}
            {lastPaymentVoucher && (
              <div className="bg-emerald-950/35 border border-emerald-500/40 rounded-2xl p-5 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h4 className="text-sm font-bold text-white font-display">
                        Comprobante #{lastPaymentVoucher.payment.referenceNumber} Listo
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-200/90 mt-1">
                      {lastPaymentVoucher.result.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastPaymentVoucher(null)}
                    className="text-zinc-400 hover:text-white p-1"
                    aria-label="Cerrar comprobante"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-[#09090b]/80 border border-white/[0.08] rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tienda:</span>
                    <span className="font-bold text-white">{lastPaymentVoucher.payment.storeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Monto reportado:</span>
                    <span className="font-mono font-bold text-amber-400">
                      ${Number(lastPaymentVoucher.payment.amountUSD).toFixed(2)} USD · {lastPaymentVoucher.payment.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Estado de correo:</span>
                    <span className="font-semibold text-emerald-300">
                      {lastPaymentVoucher.result.emailSent
                        ? `Enviado (${lastPaymentVoucher.result.deliveryChannel.toUpperCase()})`
                        : 'Listo para enviar vía tu correo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={lastPaymentVoucher.result.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors min-h-[42px]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Comprobante por WhatsApp</span>
                  </a>
                  <a
                    href={lastPaymentVoucher.result.mailtoHref}
                    className="py-2.5 px-3.5 rounded-xl bg-[#09090b] hover:bg-zinc-900 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors min-h-[42px]"
                  >
                    <Mail className="w-4 h-4" />
                    <span>
                      {lastPaymentVoucher.result.emailSent
                        ? 'Reenviar Copia por Correo'
                        : 'Enviar Comprobante por Correo'}
                    </span>
                  </a>
                </div>
              </div>
            )}

            {/* Payments History */}
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">{t.merchant.paymentsHistory}</h3>
              {payments.length === 0 ? (
                <p className="text-xs text-zinc-500">{t.merchant.noPaymentsYet}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {payments.map((p) => {
                    const voucherLinks = buildPaymentVoucherLinks({
                      payment: p,
                      store: activeStore,
                      exchangeRate,
                      supportWhatsapp: billing.supportWhatsapp,
                    });
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {p.paymentMethod} · Ref: {p.referenceNumber}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            ${p.amountUSD} USD · {p.storeName}
                            {p.couponCode ? ` · 🎟 ${p.couponCode} (-$${p.discountUSD ?? 0})` : ''}
                            {p.proofImageUrl ? ' · 📎 Captura adjunta' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={voucherLinks.whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-[10px] font-bold flex items-center gap-1"
                            title="Enviar comprobante por WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={voucherLinks.mailtoHref}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-white/[0.08]"
                            title="Enviar comprobante por correo"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Correo</span>
                          </a>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              p.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : p.status === 'rejected'
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {p.status === 'approved'
                              ? t.common.approved
                              : p.status === 'rejected'
                                ? t.common.rejected
                                : t.common.inReview}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG & EXPORT / IMPORT DATABASE */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Database Import/Export Toolbar */}
          <div className="bg-[#111114] border border-amber-500/25 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                  <span>{t.merchant.catalogHeader}</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  {t.merchant.catalogSub}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(activeStore.warehousePosEnabled || billing.warehousePosEnabled) && onOpenWarehouseApp && (
                  <button
                    type="button"
                    onClick={() => onOpenWarehouseApp(activeStore.id)}
                    className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Llenar desde Almacén</span>
                  </button>
                )}
                <button
                  onClick={downloadSampleCSVTemplate}
                  className="px-3 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-amber-400 text-xs text-zinc-200"
                >
                  {t.merchant.templateCsv}
                </button>
                <button
                  onClick={() => exportProductsToCSV(activeStore, products)}
                  disabled={products.length === 0}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.merchant.exportCsv}</span>
                </button>
                <button
                  onClick={() => exportProductsToJSON(activeStore, products)}
                  disabled={products.length === 0}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.merchant.exportJson}</span>
                </button>
                <label className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.merchant.importFile}</span>
                  <input
                    type="file"
                    accept=".csv,.json,application/json,text/csv"
                    onChange={handleImportFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {importPreview.length > 0 && (
              <div className="bg-[#09090b] border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-200">
                  <strong>{importFileName}</strong>: {importPreview.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setImportPreview([])}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 text-xs text-zinc-300"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isBusy}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                  >
                    {t.merchant.confirmImport}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Add / Edit Single Product Form */}
            <form
              onSubmit={handleSaveProduct}
              className="lg:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold text-white">
                {editingProduct ? t.merchant.editProduct : t.merchant.addProduct}
              </h3>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">{t.merchant.prodName}</label>
                <input
                  required
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">{t.merchant.prodDesc}</label>
                <textarea
                  required
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{t.merchant.prodPrice}</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    {t.merchant.prodRating}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={prodRating}
                    onChange={(e) => setProdRating(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{t.common.stock}</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{t.merchant.prodCategory}</label>
                  <input
                    type="text"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  {t.merchant.prodPhoto}
                </label>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white cursor-pointer shrink-0">
                    {t.merchant.uploadPhoto}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadProductPhoto}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={prodImage.startsWith('data:') ? 'Photo loaded' : prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProdName('');
                      setProdDesc('');
                      setProdPrice('');
                      setProdImage('');
                    }}
                    className="px-3 py-2 rounded-lg bg-zinc-900 text-xs text-zinc-300"
                  >
                    {t.common.cancel}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs min-h-[40px]"
                >
                  {editingProduct ? t.merchant.updateProduct : t.merchant.saveProduct}
                </button>
              </div>
            </form>

            {/* Product List */}
            <div className="lg:col-span-7 min-w-0 space-y-3">
              {products.length === 0 ? (
                <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
                  {t.merchant.noProductsYet}
                </div>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-[#111114] border border-white/[0.08] rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-[#09090b] border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{prod.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {prod.description}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] mt-0.5">
                          <span className="font-mono font-bold text-amber-400">
                            ${prod.priceUSD.toFixed(2)}
                          </span>
                          <span className="text-zinc-500">·</span>
                          <span className="flex items-center gap-0.5 text-amber-300 font-mono">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {prod.rating.toFixed(1)}
                          </span>
                          <span className="text-zinc-500">·</span>
                          <span className="text-zinc-400">{t.common.stock}: {prod.stock}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingProduct(prod);
                          setProdName(prod.name);
                          setProdDesc(prod.description);
                          setProdPrice(String(prod.priceUSD));
                          setProdCost(prod.costUSD ? String(prod.costUSD) : '');
                          setProdRating(String(prod.rating));
                          setProdImage(prod.imageUrl || '');
                          setProdCategory(prod.category || 'General');
                          setProdSku(prod.sku || '');
                          setProdStock(String(prod.stock));
                          setProdUnit(prod.unit || 'und');
                        }}
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                        title={t.common.edit}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteStoreProduct(activeStore.id, prod.id)}
                        className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-red-300"
                        title={t.common.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERSONALIZED PER-STORE SALES & ORDERS SYSTEM */}
      {activeTab === 'orders' && (() => {
        const validOrders = orders.filter((o) => o.status !== 'cancelled');
        const totalRevenueUSD = validOrders.reduce((acc, o) => acc + o.totalUSD, 0);
        const totalRevenueBs = validOrders.reduce((acc, o) => acc + o.totalBs, 0);
        const totalProfitUSD = validOrders.reduce(
          (acc, o) => acc + (o.estimatedProfitUSD ?? o.subtotalUSD),
          0
        );
        const completedCount = orders.filter((o) => o.status === 'completed').length;
        const pendingCount = orders.filter((o) => o.status === 'pending').length;

        const directSubtotalUSD = directCart.reduce(
          (acc, i) => acc + i.product.priceUSD * i.quantity,
          0
        );
        const directShippingUSD =
          saleShippingType === 'Delivery Local' && activeStore.localDeliveryEnabled
            ? activeStore.localDeliveryFeeUSD || 0
            : 0;
        const directTotalUSD = directSubtotalUSD + directShippingUSD;

        return (
          <div className="space-y-5">
            {/* Personalized Store Sales Header & Actions */}
            <div className="bg-[#111114] border border-emerald-500/25 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <span>{t.merchant.salesHeader} · {activeStore.storeName}</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  {t.merchant.ownerPrefix}: <strong className="text-zinc-200">{activeStore.registeredOwnerName}</strong>
                  {activeStore.rif ? ` · RIF ${activeStore.rif}` : ''} · {t.merchant.salesSub}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportStoreSalesToCSV(activeStore, orders)}
                  disabled={orders.length === 0}
                  className="px-3.5 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-amber-400 disabled:opacity-40 text-xs font-semibold text-amber-300 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.merchant.ledgerCsv}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportStoreSalesLedgerPDF(activeStore, orders, exchangeRate)}
                  disabled={orders.length === 0}
                  className="px-3.5 py-2 rounded-lg bg-[#09090b] border border-emerald-500/30 hover:border-emerald-400 disabled:opacity-40 text-xs font-semibold text-emerald-300 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t.merchant.ledgerPdf}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDirectSaleModal(true)}
                  disabled={products.length === 0}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{t.merchant.directSaleBtn}</span>
                </button>
              </div>
            </div>

            {/* Per-Store KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>{t.merchant.kpiRevenue}</span>
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                  ${totalRevenueUSD.toFixed(2)} USD
                </div>
                <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                  {totalRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </div>
              </div>

              <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>{t.merchant.kpiProfit}</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  ${totalProfitUSD.toFixed(2)} USD
                </div>
                <div className="text-[11px] text-zinc-400">
                  {validOrders.length} {t.merchant.kpiActiveOrders}
                </div>
              </div>

              <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">{t.merchant.kpiPending}</div>
                <div className="text-xl font-bold font-mono text-amber-300 tabular-nums">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {t.merchant.kpiToDispatch}
                </div>
              </div>

              <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">{t.merchant.kpiCompleted}</div>
                <div className="text-xl font-bold font-mono text-white tabular-nums">
                  {completedCount}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {t.merchant.kpiSyncedStock}
                </div>
              </div>
            </div>

            {/* Orders & Invoices List */}
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-zinc-400">
                  {t.merchant.noOrdersYet}
                </div>
              ) : (
                orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-[#111114] border border-white/[0.08] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">
                          #{ord.invoiceNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 font-semibold">
                          {ord.saleChannel || 'Carrito Web'}
                        </span>
                        <span className="font-bold text-white">{ord.customerName}</span>
                        {ord.customerRif && (
                          <span className="font-mono text-zinc-400">({ord.customerRif})</span>
                        )}
                        <span className="text-zinc-400">· {ord.customerPhone}</span>
                        <span className="px-2 py-0.5 rounded bg-[#09090b] border border-white/[0.1] text-zinc-300">
                          {ord.shippingType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ord.stockDeducted
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {ord.stockDeducted ? t.merchant.stockDeducted : t.merchant.stockPending}
                        </span>
                      </div>
                      <p className="text-zinc-300">{ord.itemsSummary}</p>
                      {ord.shippingDetails && (
                        <p className="text-[11px] text-zinc-400">{ord.shippingDetails}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 font-mono font-bold text-emerald-400">
                        <span>
                          {t.common.total}: ${ord.totalUSD.toFixed(2)} USD ({ord.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.)
                        </span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-300 font-normal">{ord.paymentMethod}</span>
                        {typeof ord.estimatedProfitUSD === 'number' && (
                          <>
                            <span className="text-zinc-500">·</span>
                            <span className="text-amber-300">
                              {t.merchant.estProfit}: ${ord.estimatedProfitUSD.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={ord.status}
                        disabled={ord.status === 'completed' || ord.status === 'cancelled' || isBusy}
                        onChange={(e) =>
                          handleOrderStatusChange(ord, e.target.value as StoreOrder['status'])
                        }
                        className="px-3 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-white"
                      >
                        <option value="pending">{t.merchant.statusOptPending}</option>
                        <option value="confirmed">{t.merchant.statusOptConfirmed}</option>
                        <option value="shipped">{t.merchant.statusOptShipped}</option>
                        <option value="completed">{t.merchant.statusOptCompleted}</option>
                        <option value="cancelled">{t.merchant.statusOptCancelled}</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDownloadOrderInvoice(ord, 'dueno')}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t.merchant.ownerInvoiceBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadOrderInvoice(ord, 'cliente')}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t.merchant.clientCopyBtn}</span>
                      </button>

                      <a
                        href={`https://wa.me/${normalizeVenezuelanPhone(ord.customerPhone)}?text=${encodeURIComponent(
                          `Hola ${ord.customerName}, te escribimos de ${activeStore.storeName} respecto a tu factura #${ord.invoiceNumber}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{t.common.whatsapp}</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Direct Sale Registration Modal */}
            {showDirectSaleModal && (
              <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
                <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white font-display">
                        {t.merchant.directModalTitle} · {activeStore.storeName}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        {t.merchant.directModalSub}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDirectSaleModal(false)}
                      className="text-zinc-400 hover:text-white p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Product Picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 block">
                      {t.merchant.directStep1}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {products.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          disabled={prod.stock <= 0}
                          onClick={() => addProductToDirectSale(prod)}
                          className="p-2.5 rounded-lg bg-[#09090b] border border-white/[0.08] hover:border-amber-500/40 disabled:opacity-40 text-left flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{prod.name}</div>
                            <div className="text-[11px] font-mono text-zinc-400">
                              ${prod.priceUSD.toFixed(2)} · {t.common.stock}: {prod.stock}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Cart Items */}
                  {directCart.length > 0 && (
                    <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-3 space-y-2">
                      {directCart.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-white font-semibold truncate">{item.product.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateDirectSaleQty(item.product.id, -1)}
                              className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-white w-5 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateDirectSaleQty(item.product.id, 1)}
                              className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-amber-400 w-16 text-right">
                              ${(item.product.priceUSD * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleCreateDirectStoreSale} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.merchant.directBuyerName}</label>
                        <input
                          required
                          type="text"
                          value={saleCustomerName}
                          onChange={(e) => setSaleCustomerName(e.target.value)}
                          placeholder={t.marketplace.buyerNamePlaceholder}
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.marketplace.buyerRifLabel}</label>
                        <input
                          type="text"
                          value={saleCustomerRif}
                          onChange={(e) => setSaleCustomerRif(e.target.value)}
                          placeholder="V-00000000"
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.marketplace.buyerPhoneLabel}</label>
                        <input
                          required
                          type="tel"
                          value={saleCustomerPhone}
                          onChange={(e) => setSaleCustomerPhone(e.target.value)}
                          placeholder="+58 414 0000000"
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.marketplace.paymentMethodLabel}</label>
                        {(() => {
                          const opts: Array<{ label: string; value: string; details?: string }> = [];
                          const seen = new Set<string>();
                          storePaymentMethods
                            .filter((m) => m.isActive)
                            .forEach((m) => {
                              const k = m.name.trim().toLowerCase();
                              if (!k || seen.has(k)) return;
                              seen.add(k);
                              opts.push({
                                label: `${m.name} (${m.currency} · Mi Tienda)`,
                                value: m.name,
                                details: m.accountDetails,
                              });
                            });
                          salesPaymentMethods.forEach((m) => {
                            const k = m.name.trim().toLowerCase();
                            if (!k || seen.has(k)) return;
                            seen.add(k);
                            opts.push({
                              label: `${m.name} (${m.currency}${m.appliesIgtf ? ' · IGTF 3%' : ''})`,
                              value: m.name,
                            });
                          });
                          [
                            { value: 'Pago Móvil', label: 'Pago Móvil (Bs.)' },
                            { value: 'Efectivo USD', label: 'Efectivo USD' },
                            { value: 'Transferencia Bancaria', label: 'Transferencia Bancaria' },
                            { value: 'Binance Pay', label: 'Binance Pay (USDT)' },
                            { value: 'Bybit', label: 'Bybit Pay' },
                            { value: 'Zelle', label: 'Zelle' },
                          ].forEach((fallback) => {
                            const k = fallback.value.toLowerCase();
                            if (!seen.has(k)) {
                              seen.add(k);
                              opts.push(fallback);
                            }
                          });
                          return (
                            <select
                              value={salePaymentMethod}
                              onChange={(e) => setSalePaymentMethod(e.target.value)}
                              className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                            >
                              {opts.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.marketplace.deliveryMethodLabel}</label>
                        <select
                          value={saleShippingType}
                          onChange={(e) => setSaleShippingType(e.target.value as ShippingType)}
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        >
                          <option value="Retiro en Tienda">{t.marketplace.localPickup}</option>
                          {activeStore.localDeliveryEnabled && (
                            <option value="Delivery Local">
                              {t.marketplace.localDelivery} (+${(activeStore.localDeliveryFeeUSD || 0).toFixed(2)})
                            </option>
                          )}
                          {activeStore.nationalShippingEnabled && (
                            <option value="Envío Nacional">{t.marketplace.nationalShipping}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-zinc-300 block mb-1">{t.marketplace.deliveryDetailNational}</label>
                        <input
                          type="text"
                          value={saleShippingDetails}
                          onChange={(e) => setSaleShippingDetails(e.target.value)}
                          placeholder={t.marketplace.deliveryDetailPlaceholder}
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        />
                      </div>
                    </div>

                    <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
                      <span className="text-zinc-300 font-semibold">{t.merchant.directTotalLabel}</span>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-amber-400">
                          ${directTotalUSD.toFixed(2)} USD
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {(directTotalUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setShowDirectSaleModal(false)}
                        className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-300 font-medium"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        type="submit"
                        disabled={isBusy || directCart.length === 0}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold"
                      >
                        {t.merchant.directSubmitBtn}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 4: PLATFORM REFERRALS & SERVICE RENEWAL COUPONS */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25 border border-amber-500/35 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-white font-display flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>{t.merchant.referralsHeroTitle}</span>
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                  {t.merchant.referralsHeroDesc}
                </p>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-mono text-emerald-300 shrink-0">
                🎁 Premio: ${billing.referralRewardUSD ?? 25} USD / Referido
              </div>
            </div>

            {(() => {
              const storeRefCode = activeStore.referralCode || '...';
              const promoUrl =
                typeof window !== 'undefined'
                  ? `${window.location.origin}/?ref=${storeRefCode}`
                  : `https://smith-solutions.app/?ref=${storeRefCode}`;
              const waInviteText = encodeURIComponent(
                `¡Hola! Te invito a crear tu propia tienda online con carrito, facturas PDF duales, Pago Móvil, Binance Pay y pedidos por WhatsApp en Smith Solutions E-Commerce ($25/mes).\n\nUsa mi enlace oficial de referido para registrarte:\n${promoUrl}\n\nCódigo de referido: ${storeRefCode}`
              );
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
                    <div className="text-xs text-zinc-400">{t.merchant.yourReferralCode}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-extrabold font-mono text-amber-300 tracking-wider">
                        {storeRefCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(storeRefCode);
                          notify(`${storeRefCode} - ${t.common.copied}`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.merchant.copyReferralCode}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
                    <div className="text-xs text-zinc-400">{t.merchant.yourReferralLink}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono text-zinc-200 truncate max-w-xs sm:max-w-sm">
                        {promoUrl}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(promoUrl);
                            notify(`${t.common.copied}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.merchant.copyReferralLink}</span>
                        </button>
                        <a
                          href={`https://wa.me/?text=${waInviteText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{t.merchant.shareReferralWa}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available / Redeemed Coupons */}
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-400" />
                <span>
                  {t.merchant.myCouponsTitle} ({coupons.length})
                </span>
              </h3>
              {coupons.length === 0 ? (
                <p className="text-xs text-zinc-400">{t.merchant.noCouponsYet}</p>
              ) : (
                <div className="space-y-3">
                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-amber-300 text-sm">
                            {c.code}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                            -${c.discountUSD} USD
                          </span>
                        </div>
                        {c.referredStoreName && (
                          <div className="text-xs text-zinc-400">
                            Por invitar a: <strong className="text-zinc-200">{c.referredStoreName}</strong>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
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
                        {c.status === 'available' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCouponId(c.id);
                              setActiveTab('billing');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold"
                          >
                            {t.merchant.useCouponNow}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invited Stores */}
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>
                  {t.merchant.referralsInvitedTitle} ({referrals.length})
                </span>
              </h3>
              {referrals.length === 0 ? (
                <p className="text-xs text-zinc-400">{t.merchant.noReferralsYet}</p>
              ) : (
                <div className="space-y-3">
                  {referrals.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{r.referredStoreName}</div>
                        <div className="text-zinc-400 font-mono text-[11px]">
                          Código: {r.referrerCode}
                          {r.rewardCouponCode ? ` · 🎟 ${r.rewardCouponCode}` : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OFFICIAL ADMIN INBOX & REFERRAL ALERTS */}
      {activeTab === 'inbox' && (
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-400" />
              <span>{t.merchant.inboxTitle}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">{t.merchant.inboxSub}</p>
          </div>

          {inboxMessages.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.08] text-center text-xs text-zinc-400">
              {t.merchant.inboxEmpty}
            </div>
          ) : (
            <div className="space-y-3">
              {inboxMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border space-y-2 ${
                    msg.isRead
                      ? 'bg-[#09090b] border-white/[0.08]'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          msg.category === 'referral_reward'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {msg.category === 'referral_reward'
                          ? t.merchant.catReferralReward
                          : t.merchant.catAdminEmail}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          msg.isRead
                            ? 'bg-zinc-900 text-zinc-400'
                            : 'bg-amber-500 text-zinc-950'
                        }`}
                      >
                        {msg.isRead ? t.merchant.inboxRead : t.merchant.inboxUnread}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">{msg.senderEmail}</span>
                    </div>

                    {!msg.isRead && (
                      <button
                        type="button"
                        onClick={() => markStoreInboxMessageRead(activeStore.id, msg.id)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.merchant.markAsRead}</span>
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white">{msg.subject}</h3>
                  <p className="text-xs text-zinc-300 whitespace-pre-line">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: STORE DATA & SHIPPING SETTINGS */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveStoreSettings}
          className="bg-[#111114] border border-white/[0.08] rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-white font-display">
            {t.merchant.settingsTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.storeNameLabel}</label>
              <input
                required
                type="text"
                value={regStoreName}
                onChange={(e) => setRegStoreName(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.ownerNameLabel}</label>
              <input
                required
                type="text"
                value={regOwnerName}
                onChange={(e) => setRegOwnerName(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.rifLabel}</label>
              <input
                type="text"
                value={regRif}
                onChange={(e) => setRegRif(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.waLabel}</label>
              <input
                required
                type="text"
                value={regWhatsapp}
                onChange={(e) => setRegWhatsapp(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/[0.08]">
            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={regNationalEnabled}
                  onChange={(e) => setRegNationalEnabled(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>{t.merchant.offerNational}</span>
              </label>
              <input
                type="text"
                value={regNationalCouriers}
                onChange={(e) => setRegNationalCouriers(e.target.value)}
                placeholder="MRW, Zoom, Tealca, Domesa"
                className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
              />
            </div>

            <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={regLocalEnabled}
                  onChange={(e) => setRegLocalEnabled(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>{t.merchant.offerLocal}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={regLocalFee}
                  onChange={(e) => setRegLocalFee(e.target.value)}
                  placeholder="USD"
                  className="px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  value={regLocalZone}
                  onChange={(e) => setRegLocalZone(e.target.value)}
                  placeholder="Zone"
                  className="px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm min-h-[44px]"
          >
            {t.merchant.saveSettingsBtn}
          </button>
        </form>
      )}

      {/* TAB: PER-STORE OWNER MANUAL PAYMENT & COLLECTION CONFIGURATION */}
      {activeTab === 'payment_methods' && (
        <div className="space-y-6">
          <div className="bg-[#111114] border border-emerald-500/30 rounded-2xl p-5 space-y-1.5">
            <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span>Configurar Cómo Cobra Tu Tienda ({activeStore.storeName})</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Cada dueño de tienda configura de forma manual sus propias cuentas bancarias, Pago Móvil, Binance Pay, Zinli, Transferencia Banesco o Zelle donde recibe el dinero de sus ventas. Los métodos activos se muestran a tus compradores al finalizar el carrito y en tu sistema POS/Ventas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveStorePaymentMethod}
              className="lg:col-span-5 min-w-0 bg-[#111114] border border-amber-500/25 rounded-2xl p-5 sm:p-6 space-y-4 h-fit"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {editingStoreMethod
                        ? `Editar Cobro: ${editingStoreMethod.name}`
                        : 'Agregar Cuenta o Método de Cobro'}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Ingresa tus datos reales donde tus clientes te enviarán el dinero.
                  </p>
                </div>
                {editingStoreMethod && (
                  <button
                    type="button"
                    onClick={resetStoreMethodForm}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-[#09090b]"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {!editingStoreMethod && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">
                    Plantillas rápidas (opcionales, luego colocas tu cuenta):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const suggestions: Array<{
                        name: string;
                        currency: PlatformPaymentCurrency;
                        appliesIgtf: boolean;
                      }> = [];
                      const seen = new Set<string>();
                      salesPaymentMethods.forEach((sm) => {
                        const k = sm.name.trim().toLowerCase();
                        if (!k || seen.has(k)) return;
                        seen.add(k);
                        suggestions.push({
                          name: sm.name,
                          currency: sm.currency,
                          appliesIgtf: sm.appliesIgtf,
                        });
                      });
                      [
                        { name: 'Pago Móvil', currency: 'Bs' as PlatformPaymentCurrency, appliesIgtf: false },
                        { name: 'Transferencia Banesco', currency: 'Bs' as PlatformPaymentCurrency, appliesIgtf: false },
                        { name: 'Binance Pay', currency: 'USDT' as PlatformPaymentCurrency, appliesIgtf: false },
                        { name: 'Zinli', currency: 'USD' as PlatformPaymentCurrency, appliesIgtf: true },
                        { name: 'Zelle', currency: 'USD' as PlatformPaymentCurrency, appliesIgtf: true },
                        { name: 'Efectivo USD', currency: 'USD' as PlatformPaymentCurrency, appliesIgtf: true },
                      ].forEach((base) => {
                        const k = base.name.toLowerCase();
                        if (!seen.has(k)) {
                          seen.add(k);
                          suggestions.push(base);
                        }
                      });
                      return suggestions.map((sug) => (
                        <button
                          key={sug.name}
                          type="button"
                          onClick={() => {
                            setStPmName(sug.name);
                            setStPmCurrency(sug.currency);
                            setStPmAppliesIgtf(sug.appliesIgtf);
                            if (!stPmHolder) setStPmHolder(activeStore.registeredOwnerName || '');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-[11px] text-zinc-200 font-medium transition-colors"
                        >
                          + {sug.name}
                        </button>
                      ));
                    })()}
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
                    value={stPmName}
                    onChange={(e) => setStPmName(e.target.value)}
                    placeholder="Ej: Pago Móvil Banesco / Binance Pay / Zelle"
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Moneda *</label>
                  <select
                    value={stPmCurrency}
                    onChange={(e) => setStPmCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="Bs">Bs.</option>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">Titular / Razón Social / RIF</label>
                <input
                  type="text"
                  maxLength={120}
                  value={stPmHolder}
                  onChange={(e) => setStPmHolder(e.target.value)}
                  placeholder={`Ej: ${activeStore.registeredOwnerName}${activeStore.rif ? ` · ${activeStore.rif}` : ''}`}
                  className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  Datos de Cobro de Tu Tienda (Cuenta, Teléfono Pago Móvil, Correo o Wallet) *
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={300}
                  value={stPmDetails}
                  onChange={(e) => setStPmDetails(e.target.value)}
                  placeholder="Ej: 0134 Banesco · 0414-0000000 · V-12345678 / correo@tudominio.com / PayID: 12345678"
                  className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  Instrucciones para Tu Cliente (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={stPmInstructions}
                  onChange={(e) => setStPmInstructions(e.target.value)}
                  placeholder="Ej: Enviar captura por WhatsApp tras transferir para despachar pedido"
                  className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stPmAppliesIgtf}
                    onChange={(e) => setStPmAppliesIgtf(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>Aplica IGTF 3% Divisas (SENIAT) cuando se registre en POS</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stPmActive}
                    onChange={(e) => setStPmActive(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span>Visible para clientes en tu Tienda Online y POS</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>
                  {editingStoreMethod ? 'Actualizar Método de Cobro' : 'Guardar Método de Cobro'}
                </span>
              </button>
            </form>

            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    Métodos de Cobro de Tu Tienda ({storePaymentMethods.length})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Solo tú administras las cuentas y wallets mostradas a tus clientes.
                  </p>
                </div>
              </div>

              {storePaymentMethods.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                  <Wallet className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    Aún no has configurado tus cuentas de cobro manuales
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Agrega aquí tu Pago Móvil, cuenta Banesco, Binance Pay, Zinli o Zelle para que tus compradores sepan exactamente a dónde pagarte.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storePaymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="p-4 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">{method.name}</span>
                          <span className="text-amber-300 font-mono text-[11px] font-bold">
                            {method.currency}
                          </span>
                          {method.appliesIgtf && (
                            <span className="text-sky-300 font-mono text-[11px]">· IGTF 3%</span>
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
                        {method.accountHolder && (
                          <div className="text-zinc-400">Titular: {method.accountHolder}</div>
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
                          onClick={() => handleToggleStoreMethodActive(method)}
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
                            setEditingStoreMethod(method);
                            setStPmName(method.name);
                            setStPmCurrency(method.currency);
                            setStPmHolder(method.accountHolder);
                            setStPmDetails(method.accountDetails);
                            setStPmInstructions(method.instructions || '');
                            setStPmAppliesIgtf(Boolean(method.appliesIgtf));
                            setStPmActive(method.isActive);
                          }}
                          className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                          title="Editar método"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteStoreMethodId === method.id ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteStorePaymentMethod(method)}
                            className="px-2.5 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStoreMethodId(method.id)}
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

      {activeTab === 'vector' && activeStore && user && (
        <MerchantVectorTab
          user={user}
          store={activeStore}
          onNotify={notify}
          onError={notifyError}
        />
      )}

      {activeTab === 'email_smtp' && activeStore && user && (
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6">
          <EmailProviderConfigPanel
            storeId={activeStore.id}
            ownerUid={activeStore.ownerUid}
            storeName={activeStore.storeName}
            ownerEmail={user.email || ''}
            exchangeRate={exchangeRate}
            storeProducts={products}
            orders={orders}
          />
        </div>
      )}
    </section>
  );
};
