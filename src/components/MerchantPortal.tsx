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
  Ruler,
  Globe,
  ChevronDown,
  Video,
  QrCode,
  Share2,
  Link2,
} from 'lucide-react';
import { MerchantVectorTab } from './MerchantVectorTab';
import { EmailProviderConfigPanel } from './EmailProviderConfigPanel';
import { SizeTagBuilder } from './SizeTagBuilder';
import { LanguageSettings } from './LanguageSettings';
import { QrUploadField, QrZoomModal } from './QrCodeModalAndField';
import { StoreQrShareModal } from './StoreQrShareModal';
import { normalizeSizeList, buildCartLineKey } from '../utils/clothingSizes';
import {
  buildSocialShareIntents,
  getStoreShareUrl,
  getStoreSubdomainDisplay,
  isSharedHostingOrLocalHost,
  isValidStoreSubdomainSlug,
  normalizeStoreSubdomainSlug,
  sanitizeSocialLinksMap,
  SOCIAL_PLATFORMS,
} from '../utils/socialLinks';
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
  StoreSocialLinks,
  StoreSubscriptionPaymentMethod,
  StoreTenant,
  SubscriptionPayment,
  SubscriptionPaymentMethod,
  GuideVideoAudience,
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
  isStoreSlugAvailable,
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
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateCommonPaymentInstruction,
  translateOrderStatusLabel,
  translatePaymentMethodLabel,
  translateSaleChannelLabel,
  translateShippingTypeLabel,
  translateSizeTokenLabel,
} from '../utils/platformLabelsI18n';
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
  onOpenVideoGuides?: (audience?: GuideVideoAudience) => void;
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
  onOpenVideoGuides,
  onActiveBrandContext,
}) => {
  const { lang, t, tr } = useLanguage();
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
  const [regSlug, setRegSlug] = useState('');
  const [regSlugManuallyEdited, setRegSlugManuallyEdited] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regRif, setRegRif] = useState('');
  const [regLogoUrl, setRegLogoUrl] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('+58 ');
  const [regCategory, setRegCategory] = useState('Comercio General');
  const [regDescription, setRegDescription] = useState('');
  const [regSocialLinks, setRegSocialLinks] = useState<StoreSocialLinks>({});
  const [showStoreQrModal, setShowStoreQrModal] = useState(false);
  const [regNationalEnabled, setRegNationalEnabled] = useState(true);
  const [regNationalCouriers, setRegNationalCouriers] = useState('MRW, Zoom, Tealca');
  const [regLocalEnabled, setRegLocalEnabled] = useState(true);
  const [regLocalFee, setRegLocalFee] = useState('3');
  const [regLocalZone, setRegLocalZone] = useState('Área Metropolitana');
  const [regPickupEnabled, setRegPickupEnabled] = useState(true);
  const [regClothingSizesEnabled, setRegClothingSizesEnabled] = useState(false);
  const [regDefaultClothingSizes, setRegDefaultClothingSizes] = useState<string[]>([
    'XS',
    'S',
    'M',
    'L',
    'XL',
  ]);
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
  const [prodAvailableSizes, setProdAvailableSizes] = useState<string[]>([]);
  const [prodSizeGuide, setProdSizeGuide] = useState('');

  // Bulk Import Preview State
  const [importPreview, setImportPreview] = useState<StoreProductInput[]>([]);
  const [importFileName, setImportFileName] = useState('');

  // Direct Sale Modal State (Per-store personalized sales registration)
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [directCart, setDirectCart] = useState<StoreCartItem[]>([]);
  const [directSizePromptProduct, setDirectSizePromptProduct] = useState<StoreProduct | null>(null);
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
  const [stPmQrImageUrl, setStPmQrImageUrl] = useState('');
  const [stPmAppliesIgtf, setStPmAppliesIgtf] = useState(false);
  const [stPmActive, setStPmActive] = useState(true);
  const [confirmDeleteStoreMethodId, setConfirmDeleteStoreMethodId] = useState<string | null>(null);
  const [showOwnerGuide, setShowOwnerGuide] = useState(true);
  const [merchantZoomQr, setMerchantZoomQr] = useState<{
    qrUrl: string;
    title: string;
    subtitle?: string;
    accountDetails?: string;
  } | null>(null);
  const [linkCopiedKey, setLinkCopiedKey] = useState<'at' | 'subdomain' | null>(null);

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
          `${tr('Tienda vinculada automáticamente:', 'Store automatically linked:', '店铺已自动关联:')} ${claimed.map((s) => s.storeName).join(', ')}`
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

  // Auto-generate clean subdomain slug while creating a new store unless manually edited
  useEffect(() => {
    if ((activeStore && !isCreatingNewStore) || regSlugManuallyEdited) return;
    const autoSlug = normalizeStoreSubdomainSlug(regStoreName);
    setRegSlug(autoSlug);
  }, [regStoreName, activeStore, isCreatingNewStore, regSlugManuallyEdited]);

  // Debounced uniqueness validation for custom store subdomain slug
  useEffect(() => {
    const clean = normalizeStoreSubdomainSlug(regSlug);
    if (!clean) {
      setSlugAvailability('idle');
      return;
    }
    const validity = isValidStoreSubdomainSlug(clean);
    if (!validity.valid) {
      setSlugAvailability('invalid');
      return;
    }
    if (!isCreatingNewStore && activeStore && clean === activeStore.slug) {
      setSlugAvailability('available');
      return;
    }
    let cancelled = false;
    setSlugAvailability('checking');
    const timer = setTimeout(async () => {
      const free = await isStoreSlugAvailable(
        clean,
        isCreatingNewStore ? undefined : activeStore?.id
      );
      if (!cancelled) {
        setSlugAvailability(free ? 'available' : 'taken');
      }
    }, 360);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [regSlug, activeStore?.id, activeStore?.slug, isCreatingNewStore]);

  // Populate Settings form when switching activeStore
  useEffect(() => {
    if (!activeStore || isCreatingNewStore) return;
    setRegStoreName(activeStore.storeName);
    setRegSlug(activeStore.slug);
    setRegSlugManuallyEdited(false);
    setRegOwnerName(activeStore.registeredOwnerName);
    setRegRif(activeStore.rif || '');
    setRegLogoUrl(activeStore.logoUrl || '');
    setRegWhatsapp(activeStore.businessWhatsapp);
    setPayWhatsapp((prev) => prev || activeStore.businessWhatsapp || '');
    setRegCategory(activeStore.category || 'Comercio General');
    setRegDescription(activeStore.description || '');
    setRegSocialLinks(activeStore.socialLinks || {});
    setRegNationalEnabled(activeStore.nationalShippingEnabled);
    setRegNationalCouriers(activeStore.nationalCouriers || 'MRW, Zoom, Tealca');
    setRegLocalEnabled(activeStore.localDeliveryEnabled);
    setRegLocalFee(String(activeStore.localDeliveryFeeUSD ?? 0));
    setRegLocalZone(activeStore.localDeliveryZone || '');
    setRegPickupEnabled(activeStore.pickupEnabled);
    setRegClothingSizesEnabled(Boolean(activeStore.clothingSizesEnabled));
    setRegDefaultClothingSizes(
      normalizeSizeList(activeStore.defaultClothingSizes).length > 0
        ? normalizeSizeList(activeStore.defaultClothingSizes)
        : ['XS', 'S', 'M', 'L', 'XL']
    );
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
      notify(tr('Logo cargado y optimizado.', 'Logo uploaded and optimized.', '徽标已上传并优化。'));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error al procesar logo.', 'Error processing logo.', '处理徽标时出错。'));
    }
  };

  const handleUploadProductPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataURL(file, 420, 0.72);
      setProdImage(dataUrl);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error al procesar imagen.', 'Error processing image.', '处理图片时出错。'));
    }
  };

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsBusy(true);
    try {
      const created = await registerStoreTenant(user, {
        storeName: regStoreName,
        slug: regSlug.trim() || undefined,
        registeredOwnerName: regOwnerName,
        rif: regRif,
        logoUrl: regLogoUrl,
        businessWhatsapp: regWhatsapp,
        category: regCategory,
        description: regDescription,
        socialLinks: sanitizeSocialLinksMap(regSocialLinks),
        nationalShippingEnabled: regNationalEnabled,
        nationalCouriers: regNationalCouriers,
        localDeliveryEnabled: regLocalEnabled,
        localDeliveryFeeUSD: Number(regLocalFee) || 0,
        localDeliveryZone: regLocalZone,
        pickupEnabled: regPickupEnabled,
        clothingSizesEnabled: regClothingSizesEnabled,
        defaultClothingSizes: normalizeSizeList(regDefaultClothingSizes),
        referredByCode: regReferralCode.trim() || undefined,
      });
      setSelectedStoreId(created.id);
      setIsCreatingNewStore(false);
      setActiveTab('billing');
      onClearCapturedReferral?.();
      notify(tr('Tienda registrada. Reporta tu pago mensual de $25 para solicitar activación.', 'Store registered. Submit your $25 monthly payment to request activation.', '店铺已注册。请提交 $25 月费付款以申请激活。'));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error registrando tienda.', 'Error registering store.', '注册店铺时出错。'));
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
        slug: regSlug.trim() || activeStore.slug,
        registeredOwnerName: regOwnerName,
        rif: regRif,
        logoUrl: regLogoUrl,
        businessWhatsapp: regWhatsapp,
        category: regCategory,
        description: regDescription,
        socialLinks: sanitizeSocialLinksMap(regSocialLinks),
        nationalShippingEnabled: regNationalEnabled,
        nationalCouriers: regNationalCouriers,
        localDeliveryEnabled: regLocalEnabled,
        localDeliveryFeeUSD: Number(regLocalFee) || 0,
        localDeliveryZone: regLocalZone,
        pickupEnabled: regPickupEnabled,
        clothingSizesEnabled: regClothingSizesEnabled,
        defaultClothingSizes: normalizeSizeList(regDefaultClothingSizes),
      });
      notify(tr('Datos, enlace subdominio, redes sociales y envíos actualizados.', 'Store details, subdomain link, social profiles, and shipping updated.', '店铺资料、子域名链接、社交主页与配送设置已更新。'));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error actualizando tienda.', 'Error updating store.', '更新店铺资料时出错。'));
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
      qrImageUrl: undefined as string | undefined,
    },
    {
      key: 'Transferencia Bancaria',
      title: t.merchant.bankTransfers,
      currency: 'Bs' as PlatformPaymentCurrency,
      value: billing.bankTransfers,
      qrImageUrl: undefined as string | undefined,
    },
    {
      key: 'Binance Pay',
      title: t.merchant.binancePay,
      currency: 'USDT' as PlatformPaymentCurrency,
      value: billing.binancePay,
      qrImageUrl: billing.binanceQrUrl,
    },
    {
      key: 'Bybit',
      title: t.merchant.bybitPay,
      currency: 'USDT' as PlatformPaymentCurrency,
      value: billing.bybitPay,
      qrImageUrl: billing.bybitQrUrl,
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
    qrImageUrl?: string;
    isCustom: boolean;
    isStoreSpecific: boolean;
  }> = [
    ...activeStoreSubscriptionMethods.map((pm) => ({
      value: pm.name,
      label: `${translatePaymentMethodLabel(pm.name, lang)} (${pm.currency}) · ${tr('Asignado a tu tienda', 'Assigned to your store', '专属您店铺')}`,
      currency: pm.currency,
      accountHolder: pm.accountHolder,
      accountDetails: pm.accountDetails,
      instructions: pm.instructions,
      qrImageUrl: pm.qrImageUrl,
      isCustom: true,
      isStoreSpecific: true,
    })),
    ...filteredGlobalCustomMethods.map((pm) => ({
      value: pm.name,
      label: `${translatePaymentMethodLabel(pm.name, lang)} (${pm.currency})`,
      currency: pm.currency,
      accountHolder: pm.accountHolder,
      accountDetails: pm.accountDetails,
      instructions: pm.instructions,
      qrImageUrl: pm.qrImageUrl,
      isCustom: true,
      isStoreSpecific: false,
    })),
    ...configuredBaseAccounts.map((base) => ({
      value: base.key,
      label: `${base.title} (${base.currency})`,
      currency: base.currency,
      accountDetails: base.value,
      qrImageUrl: base.qrImageUrl,
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
    const defaultVal = subscriptionCheckoutOptions[0].value as SubscriptionPaymentMethod;
    if ((!exists || !hasManualPayMethodSelection) && payMethod !== defaultVal) {
      setPayMethod(defaultVal);
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
      notify(tr('Captura del comprobante cargada y optimizada.', 'Receipt screenshot uploaded and optimized.', '付款截图已上传并优化。'));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('No se pudo procesar la captura del comprobante.', 'Could not process receipt screenshot.', '无法处理付款凭证截图。'));
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
          ? tr('Comprobante registrado y enviado automáticamente por correo al Administrador. Puedes reenviarlo también por WhatsApp abajo.', 'Receipt recorded and automatically emailed to the Administrator. You can also resend it via WhatsApp below.', '付款凭证已登记并自动电邮给管理员。您也可通过下方 WhatsApp 再次发送。')
          : tr('Comprobante registrado en la nube. Usa los botones directos de WhatsApp y Correo para enviar tu recibo al Administrador.', 'Receipt saved to the cloud. Use the WhatsApp and Email buttons below to send your receipt to the Administrator.', '凭证已保存至云端。请使用下方的 WhatsApp 与邮件按钮将收据发送给管理员。')
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error enviando comprobante.', 'Error submitting receipt.', '发送凭证时出错。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !effectiveUid) return;
    const normalizedSizes = normalizeSizeList(prodAvailableSizes);
    const cleanSizeGuide = prodSizeGuide.trim();
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
      availableSizes: normalizedSizes,
      sizeGuide: cleanSizeGuide || undefined,
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
      setProdAvailableSizes([]);
      setProdSizeGuide('');
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
        ...(normalizedSizes.length > 0 ? { availableSizes: normalizedSizes } : {}),
        ...(cleanSizeGuide ? { sizeGuide: cleanSizeGuide } : {}),
        isActive: true,
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextProducts = editingProduct
        ? products.map((p) => (p.id === localProd.id ? localProd : p))
        : [localProd, ...products];
      setProducts(nextProducts);
      saveCachedStorefrontWarehouseProducts(activeStore.id, nextProducts);
      saveCachedStoreProducts(activeStore.id, nextProducts);
      queueOfflineMutation({
        type: 'storefront_product_upsert',
        label: `${tr('Catálogo', 'Catalog', '目录')} ${activeStore.storeName}: ${localProd.name}`,
        payload: {
          storeId: activeStore.id,
          ownerUid: effectiveUid,
          input: { ...productInput, id: localProd.id },
          existingProduct: editingProduct || undefined,
        },
      });
      resetProductForm();
      notify(tr('Producto guardado localmente en Modo Offline. Se sincronizará automáticamente al volver internet.', 'Product saved locally in Offline Mode. It will sync automatically when back online.', '商品已本地保存（离线模式）。恢复网络后将自动同步。'));
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
      notify(tr('Producto guardado en el catálogo de tu tienda.', 'Product saved to your store catalog.', '商品已保存至您的店铺目录。'));
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        saveProductLocally();
      } else {
        notifyError(err instanceof Error ? err.message : tr('Error guardando producto.', 'Error saving product.', '保存商品时出错。'));
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
    setStPmQrImageUrl('');
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
          qrImageUrl: stPmQrImageUrl,
          appliesIgtf: stPmAppliesIgtf,
          isActive: stPmActive,
        },
        editingStoreMethod || undefined
      );
      notify(
        editingStoreMethod
          ? tr(`Método de cobro "${stPmName}" actualizado para ${activeStore.storeName}.`, `Collection method "${stPmName}" updated for ${activeStore.storeName}.`, `已为 ${activeStore.storeName} 更新收款方式“${stPmName}”。`)
          : tr(`Método de cobro "${stPmName}" configurado. Ya aparece para tus clientes y en tus ventas.`, `Collection method "${stPmName}" configured. Now visible to customers and sales.`, `已配置收款方式“${stPmName}”，现已对顾客和销售模块可见。`)
      );
      resetStoreMethodForm();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error guardando método de cobro de tu tienda.', 'Error saving your store collection method.', '保存店铺收款方式时出错。'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleStoreMethodActive = async (method: StorePaymentMethod) => {
    if (!activeStore) return;
    setIsBusy(true);
    try {
      await toggleStorePaymentMethodActive(activeStore.id, method, !method.isActive);
      notify(
        !method.isActive
          ? tr(`Método de cobro "${method.name}" activado.`, `Collection method "${method.name}" activated.`, `收款方式“${method.name}”已启用。`)
          : tr(`Método de cobro "${method.name}" pausado.`, `Collection method "${method.name}" paused.`, `收款方式“${method.name}”已暂停。`)
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error actualizando estado del método de cobro.', 'Error updating collection method status.', '更新收款方式状态时出错。'));
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
      notify(tr(`Método de cobro "${method.name}" eliminado.`, `Collection method "${method.name}" deleted.`, `收款方式“${method.name}”已删除。`));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error eliminando método de cobro.', 'Error deleting collection method.', '删除收款方式时出错。'));
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
        notifyError(tr('No se detectaron productos válidos en el archivo CSV/JSON.', 'No valid products detected in the CSV/JSON file.', 'CSV/JSON 文件中未检测到有效商品。'));
        return;
      }
      setImportPreview(parsed);
      setImportFileName(file.name);
      notify(tr(`Archivo leído: ${parsed.length} productos listos para importar.`, `File parsed: ${parsed.length} products ready to import.`, `文件读取成功：${parsed.length} 件商品准备导入。`));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Archivo CSV/JSON inválido.', 'Invalid CSV/JSON file.', '无效的 CSV/JSON 文件。'));
    }
  };

  const handleConfirmImport = async () => {
    if (!user || !activeStore || importPreview.length === 0) return;
    setIsBusy(true);
    try {
      const count = await importStoreProductsBatch(activeStore.id, user.uid, importPreview);
      setImportPreview([]);
      setImportFileName('');
      notify(tr(`${count} productos importados exitosamente con foto, descripción, precio y estrellas.`, `${count} products imported successfully with photo, description, price, and rating.`, `成功导入 ${count} 件商品（含图片、描述、价格和评分）。`));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error importando base de datos.', 'Error importing database.', '导入商品数据库时出错。'));
    } finally {
      setIsBusy(false);
    }
  };

  const downloadSampleCSVTemplate = () => {
    const csv =
      '\uFEFFnombre,descripcion,precioUSD,calificacionEstrellas,foto,categoria,sku,stock,costoUSD,unidad,tallas,guiaTallas\n' +
      '"Franela Oversize Algodón Pima","Corte urbano unisex 240gsm suave al tacto",18.00,5,"","Moda y Ropa","FRAN-01",40,9.50,"und","XS | S | M | L | XL","Corte holgado; pedir talla habitual"\n' +
      '"Audífonos Pro Bluetooth","Cancelación de ruido y estuche de carga rápida",29.90,5,"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400","Electrónica","AUD-001",25,16.50,"und","",""\n' +
      '"Café Gourmet Venezolano 500g","Tueste medio altura andina aroma intenso",8.50,4.8,"","Alimentos","CAF-500",40,4.80,"bolsa","",""\n';
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
      exportStoreOrderInvoicePDF(activeStore, ord, items, mode, lang);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('No se pudo generar la factura PDF.', 'Could not generate PDF invoice.', '无法生成 PDF 发票。'));
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
      const nextStatusLabel = translateOrderStatusLabel(nextStatus, lang);
      notify(
        stockDiscountedNow
          ? tr(`Orden #${ord.invoiceNumber} actualizada a "${nextStatusLabel}" y stock descontado automáticamente.`, `Order #${ord.invoiceNumber} updated to "${nextStatusLabel}" and stock deducted automatically.`, `订单 #${ord.invoiceNumber} 已更新为“${nextStatusLabel}”并自动扣减库存。`)
          : tr(`Estado de orden #${ord.invoiceNumber} actualizado a "${nextStatusLabel}".`, `Order #${ord.invoiceNumber} status updated to "${nextStatusLabel}".`, `订单 #${ord.invoiceNumber} 状态已更新为“${nextStatusLabel}”。`)
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tr('Error actualizando estado de orden.', 'Error updating order status.', '更新订单状态时出错。'));
    } finally {
      setIsBusy(false);
    }
  };

  const addProductToDirectSale = (prod: StoreProduct, explicitSize?: string) => {
    const pSizes = normalizeSizeList(prod.availableSizes);
    if (pSizes.length > 0 && !explicitSize) {
      setDirectSizePromptProduct(prod);
      return;
    }
    const chosenSize = pSizes.length > 0 ? explicitSize || pSizes[0] : undefined;
    const targetKey = buildCartLineKey(prod.id, chosenSize);

    setDirectCart((prev) => {
      const totalForProd = prev.reduce(
        (sum, i) => (i.product.id === prod.id ? sum + i.quantity : sum),
        0
      );
      const maxStock = prod.stock > 0 ? prod.stock : 999;
      if (totalForProd >= maxStock) return prev;

      const found = prev.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === targetKey
      );
      if (found) {
        return prev.map((i) =>
          buildCartLineKey(i.product.id, i.selectedSize) === targetKey
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        { product: prod, quantity: 1, ...(chosenSize ? { selectedSize: chosenSize } : {}) },
      ];
    });
    setDirectSizePromptProduct(null);
  };

  const updateDirectSaleQty = (productId: string, delta: number, selectedSize?: string) => {
    const targetKey = buildCartLineKey(productId, selectedSize);
    setDirectCart((prev) => {
      const otherLinesQty = prev.reduce(
        (sum, i) =>
          i.product.id === productId &&
          buildCartLineKey(i.product.id, i.selectedSize) !== targetKey
            ? sum + i.quantity
            : sum,
        0
      );
      return prev
        .map((i) => {
          if (buildCartLineKey(i.product.id, i.selectedSize) !== targetKey) return i;
          const maxStock =
            i.product.stock > 0 ? Math.max(0, i.product.stock - otherLinesQty) : 999;
          return { ...i, quantity: Math.min(maxStock, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0);
    });
  };

  const changeDirectSaleItemSize = (
    productId: string,
    oldSize: string | undefined,
    newSize: string
  ) => {
    const oldKey = buildCartLineKey(productId, oldSize);
    const newKey = buildCartLineKey(productId, newSize);
    if (oldKey === newKey) return;
    setDirectCart((prev) => {
      const source = prev.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === oldKey
      );
      if (!source) return prev;
      const targetExists = prev.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === newKey
      );
      if (targetExists) {
        return prev
          .filter((i) => buildCartLineKey(i.product.id, i.selectedSize) !== oldKey)
          .map((i) =>
            buildCartLineKey(i.product.id, i.selectedSize) === newKey
              ? { ...i, quantity: i.quantity + source.quantity }
              : i
          );
      }
      return prev.map((i) =>
        buildCartLineKey(i.product.id, i.selectedSize) === oldKey
          ? { ...i, selectedSize: newSize }
          : i
      );
    });
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
        .map(
          (i) =>
            `${i.quantity}x ${i.product.name}${i.selectedSize ? ` [Talla: ${i.selectedSize}]` : ''} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`
        )
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
        exportStoreOrderInvoicePDF(activeStore, order, snapshot, 'dual', lang);
        setDirectCart([]);
        setDirectSizePromptProduct(null);
        setSaleCustomerName('');
        setSaleCustomerRif('');
        setSaleCustomerPhone('');
        setSaleShippingDetails('');
        setShowDirectSaleModal(false);
        notify(
          offlineSaved
            ? tr(`Venta Offline #${order.invoiceNumber} guardada localmente en ${activeStore.storeName} (stock descontado y PDF Dual generado). Se sincronizará al volver la señal.`, `Offline Sale #${order.invoiceNumber} saved locally in ${activeStore.storeName} (stock deducted & dual PDF generated). Will sync when back online.`, `离线销售 #${order.invoiceNumber} 已在 ${activeStore.storeName} 本地保存（已扣库存并生成双联 PDF）。联网后将自动同步。`)
            : tr(`Venta #${order.invoiceNumber} registrada en ${activeStore.storeName}, stock descontado y Factura Dual (Cliente + Dueño) generada.`, `Sale #${order.invoiceNumber} recorded in ${activeStore.storeName}, stock deducted & Dual Invoice (Customer + Owner) generated.`, `销售 #${order.invoiceNumber} 已在 ${activeStore.storeName} 登记，库存已扣减并生成双联发票。`)
        );
      };

      const saveDirectSaleOffline = () => {
        queueOfflineMutation({
          type: 'marketplace_order',
          label: `${tr('Venta Directa', 'Direct Sale', '店铺直销')} #${invoiceNumber} (${activeStore.storeName})`,
          payload: {
            store: activeStore,
            orderInput: baseOrderInput,
            items: snapshot,
            options: saleOptions,
          },
        });
        const soldByProduct = new Map<string, number>();
        snapshot.forEach((line) => {
          soldByProduct.set(
            line.product.id,
            (soldByProduct.get(line.product.id) || 0) + line.quantity
          );
        });
        const nextProducts = products.map((p) => {
          const soldQty = soldByProduct.get(p.id) || 0;
          return soldQty > 0
            ? { ...p, stock: Math.max(0, (Number(p.stock) || 0) - soldQty) }
            : p;
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
      notifyError(err instanceof Error ? err.message : tr('No se pudo registrar la venta directa.', 'Could not record direct sale.', '无法登记店铺直销订单。'));
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
        {/* Clear Seller Space Role Header + Private Language Reassurance */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Store className="w-4 h-4 shrink-0" />
              <span>{t.merchant.roleBanner}</span>
            </div>
            <span className="text-zinc-500 hidden sm:inline" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              <span>
                {tr(
                  'Tu idioma es privado (Español por defecto). Tus compradores eligen el suyo aparte.',
                  'Your panel language stays private to you; buyers always choose their own language.',
                  '您的管理语言仅自己可见，不会影响买家（买家默认界面为西班牙语）。'
                )}
              </span>
            </span>
          </div>
          {onNavigateMarketplace && (
            <button
              type="button"
              onClick={onNavigateMarketplace}
              className="text-zinc-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
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
                onClick={() => onOpenVectorSellerGuide(tr('Guía para registrar mi tienda paso a paso', 'Step-by-step guide to register my store', '分步注册店铺指南'))}
                className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-xs sm:text-sm font-semibold text-amber-300 flex items-center gap-2 min-h-[44px]"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>{t.merchant.askVectorGuide}</span>
              </button>
            )}
            {onOpenVideoGuides && (
              <button
                type="button"
                onClick={() => onOpenVideoGuides('sellers')}
                className="px-4 py-3 rounded-xl bg-[#09090b] hover:bg-zinc-900 border border-white/[0.12] hover:border-amber-400/35 text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-2 min-h-[44px]"
              >
                <Video className="w-4 h-4 text-amber-400" />
                <span>{tr('Video Guías para Dueños', 'Owner Video Guides', '商家视频教程')}</span>
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
                <span>{tr('Métodos Disponibles para Comprar tu Suscripción', 'Available Methods to Pay Your Subscription', '可用的订阅付款方式')}</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {tr(
                  'Inicia sesión con Google, registra tu tienda y reporta tu pago con cualquiera de estas opciones habilitadas.',
                  'Sign in with Google, register your store, and report your payment using any of these enabled options.',
                  '使用 Google 登录，注册您的店铺，并使用以下任一已启用方式提交付款凭证。'
                )}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs">
              <span className="font-bold text-amber-300">${baseSubscriptionUSD} USD/{tr('mes', 'mo', '月')}</span>
              <span className="text-zinc-500 mx-1.5">·</span>
              <span className="text-zinc-400">
                ≈ {(baseSubscriptionUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
          </div>

          {subscriptionCheckoutOptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#09090b] border border-amber-500/25 text-xs text-zinc-300">
              {tr(
                `El Administrador está configurando los métodos de cobro de suscripción. Puedes solicitar las cuentas actualizadas por WhatsApp (${billing.supportWhatsapp}).`,
                `The Administrator is configuring subscription payment methods. You can request updated accounts via WhatsApp (${billing.supportWhatsapp}).`,
                `管理员正在配置订阅收款方式。您可通过 WhatsApp (${billing.supportWhatsapp}) 获取最新收款账户。`
              )}
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
                    <p className="text-[11px] text-zinc-400 truncate">{tr('Titular:', 'Holder:', '持有人:')} {opt.accountHolder}</p>
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
                onClick={() => onOpenVectorSellerGuide(tr('Paso 2: Cómo llenar los datos y RIF de mi tienda', 'Step 2: How to fill in my store details and RIF tax ID', '第2步：如何填写店铺信息及税号'))}
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
                placeholder={tr('Ej: Inversiones Caracas Tech', 'Ex: Caracas Tech Store', '例：Caracas 科技贸易行')}
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
                placeholder={tr('Ej: María Rodríguez / Inversiones C.A.', 'Ex: Maria Rodriguez / Corp LLC', '例：李华 / 某某贸易有限公司')}
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
                placeholder={tr('Ej: J-50129384-7', 'Ex: J-50129384-7', '例：J-50129384-7')}
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
                placeholder={tr('Moda y Ropa, Bodegón, Tech...', 'Apparel & Fashion, Retail, Tech...', '服装时尚、百货、数码...')}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-sm text-white"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[
                  'Moda y Ropa',
                  'Calzado y Accesorios',
                  'Comercio General',
                  'Bodegón & Licores',
                  'Tecnología',
                ].map((catSug) => (
                  <button
                    key={catSug}
                    type="button"
                    onClick={() => {
                      setRegCategory(catSug);
                      if (/ropa|moda|calzado|apparel|fashion|footwear|服|鞋/i.test(catSug)) {
                        setRegClothingSizesEnabled(true);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      regCategory === catSug
                        ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold'
                        : 'bg-[#09090b] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {translateCategoryLabel(catSug, lang)}
                  </button>
                ))}
              </div>
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
                  value={regLogoUrl.startsWith('data:') ? tr('Imagen cargada', 'Image loaded', '图片已加载') : regLogoUrl}
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

          {/* Store Subdomain URL Customization */}
          <div className="bg-[#09090b]/70 border border-emerald-500/25 rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    'Enlace Subdominio de Tu Tienda (para Bio de Redes Sociales)',
                    'Your Store Subdomain URL (for Social Media Bio)',
                    '店铺专属子域名短链（适合放在社交媒体主页简介）'
                  )}
                </span>
              </label>
              {slugAvailability === 'checking' && (
                <span className="text-[11px] text-zinc-400">{tr('Verificando...', 'Checking...', '检测中...')}</span>
              )}
              {slugAvailability === 'available' && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  ✓ {tr('Disponible', 'Available', '可用')}
                </span>
              )}
              {slugAvailability === 'taken' && (
                <span className="text-[11px] text-red-400 font-semibold">
                  ✕ {tr('En uso por otra tienda', 'Already taken', '已被其他店铺占用')}
                </span>
              )}
              {slugAvailability === 'invalid' && (
                <span className="text-[11px] text-amber-400 font-semibold">
                  {tr('Mín. 2 caracteres (letras, números y guiones)', 'Min 2 chars (lowercase, numbers & hyphens)', '至少 2 个字符（小写字母、数字和连字符）')}
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 flex items-center bg-[#111114] border border-white/[0.1] rounded-xl overflow-hidden">
                <span className="px-3 py-2.5 text-xs font-mono text-zinc-400 bg-zinc-900/70 border-r border-white/[0.08] shrink-0">
                  /@
                </span>
                <input
                  type="text"
                  maxLength={60}
                  value={regSlug}
                  onChange={(e) => {
                    setRegSlugManuallyEdited(true);
                    setRegSlug(normalizeStoreSubdomainSlug(e.target.value));
                  }}
                  placeholder="mi-boutique"
                  className="w-full px-3 py-2.5 bg-transparent text-xs font-mono text-white focus:outline-none"
                />
              </div>
              <div className="text-[11px] font-mono text-zinc-400 px-3 py-2 rounded-xl bg-[#111114] border border-white/[0.06] truncate">
                {getStoreSubdomainDisplay(regSlug || 'mi-tienda')}
              </div>
            </div>
          </div>

          {/* Store Social Media Profiles */}
          <div className="bg-[#09090b]/70 border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {tr(
                  'Redes Sociales de Tu Tienda (Opcional)',
                  'Store Social Media Profiles (Optional)',
                  '店铺社交媒体主页（可选）'
                )}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SOCIAL_PLATFORMS.map((soc) => (
                <div key={`reg-soc-${soc.key}`}>
                  <label className="text-[11px] text-zinc-400 block mb-1">{soc.label}</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={regSocialLinks[soc.key] || ''}
                    onChange={(e) =>
                      setRegSocialLinks((prev) => ({
                        ...prev,
                        [soc.key]: e.target.value,
                      }))
                    }
                    placeholder={soc.placeholder}
                    className="w-full px-3 py-2 bg-[#111114] border border-white/[0.08] rounded-lg text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Universal Clothing / Product Sizes Configurator (Indistinct of project/category) */}
          <div className="bg-[#09090b]/70 border border-amber-500/25 rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={regClothingSizesEnabled}
                onChange={(e) => setRegClothingSizesEnabled(e.target.checked)}
                className="mt-0.5 accent-amber-500 w-4 h-4 shrink-0"
              />
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Habilitar Selector de Tallas de Ropa / Calzado (Válido para cualquier rubro)',
                      'Enable Clothing / Footwear Size Configurator (Works for any store)',
                      '启用服装/鞋靴尺码配置器（适用于任意店铺品类）'
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {tr(
                    'Pre-carga tallas por defecto (XS–3XL, pantalones 26–42, calzado 35–44 o personalizadas) para aplicarlas rápido a tus productos.',
                    'Preload default size packs (XS–3XL, pants 26–42, footwear 35–44, or custom) to quickly apply across your products.',
                    '预置默认尺码表（XS–3XL、裤装 26–42、鞋码 35–44 或自定义）以便快速应用至商品。'
                  )}
                </p>
              </div>
            </label>

            {regClothingSizesEnabled && (
              <SizeTagBuilder
                compact
                sizes={regDefaultClothingSizes}
                onChange={setRegDefaultClothingSizes}
                title={tr('Tallas base de la tienda', 'Store default sizes', '店铺默认尺码')}
              />
            )}
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
                <span>{tr('Métodos Habilitados para Pagar tu Suscripción (Paso 3)', 'Enabled Methods to Pay Your Subscription (Step 3)', '可用的订阅付款方式（第3步）')}</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {tr(
                  'Al registrar tu tienda pasarás al checkout para reportar tu pago con cualquiera de estas cuentas configuradas por el Administrador.',
                  'After registering your store, proceed to checkout to report your payment using any of these Administrator-configured accounts.',
                  '注册店铺后，您将进入结账页，可使用管理员配置的以下任一账户提交付款凭证。'
                )}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs">
              <span className="font-bold text-amber-300">${baseSubscriptionUSD} USD/{tr('mes', 'mo', '月')}</span>
              <span className="text-zinc-500 mx-1.5">·</span>
              <span className="text-zinc-400">
                ≈ {(baseSubscriptionUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>
          </div>

          {subscriptionCheckoutOptions.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-[#09090b] border border-amber-500/25 text-xs text-zinc-300">
              {tr(
                `Aún no hay cuentas de pago publicadas por el Administrador. Al finalizar el registro podrás coordinar directamente vía WhatsApp (${billing.supportWhatsapp}).`,
                `No payment accounts have been published by the Administrator yet. After registering you can coordinate directly via WhatsApp (${billing.supportWhatsapp}).`,
                `管理员尚未公布收款账户。完成注册后，您可直接通过 WhatsApp (${billing.supportWhatsapp}) 联系处理。`
              )}
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
                    <p className="text-[11px] text-zinc-400 truncate">{tr('Titular:', 'Holder:', '持有人:')} {opt.accountHolder}</p>
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
                  {s.storeName} ({s.status === 'active' ? t.merchant.statusActive : s.status === 'pending' ? t.merchant.statusPending : t.merchant.statusSuspended})
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
            onClick={() => {
              setIsCreatingNewStore(true);
              setRegSlug('');
              setRegSlugManuallyEdited(false);
              setRegSocialLinks({});
            }}
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

      {/* Shareable Subdomain URL Banner for Social Media */}
      {(() => {
        const liveAtUrl = getStoreShareUrl(activeStore.slug, 'live_at');
        const subdomainPreview = getStoreSubdomainDisplay(activeStore.slug);
        const subdomainUrl = getStoreShareUrl(activeStore.slug, 'subdomain_preview');
        const intents = buildSocialShareIntents(liveAtUrl, activeStore.storeName);
        const isSharedEnv =
          typeof window !== 'undefined' && isSharedHostingOrLocalHost(window.location.hostname);

        return (
          <div className="bg-[#111114] border border-emerald-500/25 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {tr(
                    'Enlace Subdominio de Tu Tienda para Redes Sociales',
                    'Store Subdomain Link for Social Media Sharing',
                    '用于社交媒体分享的店铺专属链接'
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-white bg-[#09090b] border border-white/[0.08] px-2.5 py-1 rounded-lg break-all">
                  {liveAtUrl}
                </span>
                <span className="text-zinc-500 text-[11px] font-mono">
                  · {subdomainPreview}
                </span>
              </div>
              {isSharedEnv && (
                <p className="text-[11px] text-zinc-400">
                  {tr(
                    'Comparte el enlace /@' + activeStore.slug + ' ahora mismo en Instagram, TikTok, WhatsApp o Facebook. También soporta subdominio directo al vincular dominio propio.',
                    'Share the /@' + activeStore.slug + ' link right away in Instagram, TikTok, WhatsApp, or Facebook bios. Also routes wildcard subdomains on custom domains.',
                    '可立即将 /@' + activeStore.slug + ' 链接放入 Instagram、TikTok、WhatsApp 或 Facebook 简介；绑定自定义域名后亦可直接启用子域名访问。'
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(liveAtUrl);
                  setLinkCopiedKey('at');
                  setTimeout(() => setLinkCopiedKey(null), 1800);
                  notify(tr('Enlace de tienda copiado.', 'Store link copied.', '店铺链接已复制。'));
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {linkCopiedKey === 'at' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{linkCopiedKey === 'at' ? tr('Copiado', 'Copied', '已复制') : tr('Copiar Enlace', 'Copy Link', '复制链接')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(subdomainUrl);
                  setLinkCopiedKey('subdomain');
                  setTimeout(() => setLinkCopiedKey(null), 1800);
                  notify(tr('Formato subdominio copiado.', 'Subdomain URL copied.', '子域名格式已复制。'));
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>{linkCopiedKey === 'subdomain' ? tr('Copiado', 'Copied', '已复制') : tr('Copiar Subdominio', 'Copy Subdomain', '复制子域名')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStoreQrModal(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{tr('QR de Tienda', 'Store QR', '店铺二维码')}</span>
              </button>
              <a
                href={intents.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/35 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                {tr('Personalizar URL / Redes', 'Customize URL / Social', '自定义链接 / 社交')}
              </button>
            </div>
          </div>
        );
      })()}

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

      {/* Owner Operational Guide & Language Isolation Strip */}
      {(() => {
        const activeCollectionCount = storePaymentMethods.filter((m) => m.isActive).length;
        const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
        const isStoreActive = activeStore.status === 'active';
        const hasProducts = products.length > 0;
        const hasPayments = activeCollectionCount > 0;
        const completedSteps =
          (isStoreActive ? 1 : 0) + (hasProducts ? 1 : 0) + (hasPayments ? 1 : 0) + 1;

        return (
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-100">
                  {tr(
                    'Guía Operativa del Dueño · Idioma personal: Español',
                    'Store Owner Action Guide · Personal UI: English',
                    '店主运营操作指南 · 当前仅您个人使用中文后台'
                  )}
                </span>
                <span className="text-[11px] font-mono text-amber-400 tabular-nums">
                  {completedSteps}/4 {tr('listos', 'ready', '项就绪')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenVectorSellerGuide && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenVectorSellerGuide(
                        tr(
                          '¿Qué debo configurar primero en mi tienda para empezar a vender?',
                          'What should I configure first in my store to start selling?',
                          '我是商家，如何快速完成开店、上传商品和设置收款？'
                        )
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-amber-400/30 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>{tr('Consultar Dudas (Vector)', 'Ask Vector Guide', '向 Vector 咨询开店流程')}</span>
                  </button>
                )}
                {onOpenVideoGuides && (
                  <button
                    type="button"
                    onClick={() => onOpenVideoGuides('sellers')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.1] hover:border-amber-400/35 text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Video className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{tr('Video Guías', 'Video Guides', '视频指南')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowOwnerGuide((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.08] text-[11px] font-medium text-zinc-300 flex items-center gap-1 whitespace-nowrap"
                >
                  <span>
                    {showOwnerGuide
                      ? tr('Ocultar guía', 'Hide guide', '收起指南')
                      : tr('Ver guía paso a paso', 'Show owner guide', '展开店主指南')}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showOwnerGuide ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            {showOwnerGuide && (
              <>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {tr(
                    'Tu selección de idioma es privada para tu cuenta. Tus compradores verán el catálogo en su propio idioma (Español por defecto). Sigue estos 4 pasos para operar tu tienda:',
                    'Your dashboard language is isolated to your account only. Customers browse your catalog in their own preferred language (Spanish by default). Follow these 4 steps to run your store:',
                    '您切换的中文界面仅保存在您的个人账号中，绝不会强制改变顾客或管理员的语言（平台默认对买家展示西班牙语）。请按以下 4 步管理您的店铺：'
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {/* Step 1: Subscription & Activation */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 min-h-[76px] ${
                      isStoreActive
                        ? 'bg-[#09090b] border-emerald-500/30 hover:border-emerald-400/50'
                        : 'bg-amber-500/[0.08] border-amber-400/45 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className={`font-bold ${isStoreActive ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {tr('1. Activar Suscripción', '1. Store Activation', '1. 激活店铺订阅')}
                      </span>
                      {isStoreActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-snug">
                      {isStoreActive
                        ? tr('Tienda activa y visible al público en el directorio.', 'Store active and live in the public directory.', '店铺已激活，已在公共商城公开展示。')
                        : tr('Reporta tu pago en Suscripción para activar tu tienda.', 'Submit subscription payment to publish your store.', '前往“订阅”上报付款凭证即可解锁公开营业。')}
                    </span>
                  </button>

                  {/* Step 2: Catalog & Clothing Sizes */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 min-h-[76px] ${
                      hasProducts
                        ? 'bg-[#09090b] border-emerald-500/30 hover:border-emerald-400/50'
                        : 'bg-amber-500/[0.08] border-amber-400/45 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className={`font-bold ${hasProducts ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {tr('2. Cargar Productos', '2. Publish Products', '2. 上架商品与尺码')}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-300 tabular-nums shrink-0">
                        {products.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-snug">
                      {hasProducts
                        ? tr('Agrega fotos, precios USD, stock o tallas de ropa en Catálogo.', 'Manage USD pricing, stock quantities & sizes in Catalog.', '可在“商品目录”继续添加图片、美元定价、库存及服装尺码。')
                        : tr('Aún sin productos: carga artículos manuales o importa un CSV.', 'No items yet: add products manually or import CSV here.', '暂无上架商品：点击此处手动添加或批量导入 CSV 商品清单。')}
                    </span>
                  </button>

                  {/* Step 3: Store Payment Collection Accounts */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment_methods')}
                    className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 min-h-[76px] ${
                      hasPayments
                        ? 'bg-[#09090b] border-emerald-500/30 hover:border-emerald-400/50'
                        : 'bg-amber-500/[0.08] border-amber-400/45 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className={`font-bold ${hasPayments ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {tr('3. Cuentas de Cobro', '3. Payment Accounts', '3. 设置收款账户')}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-300 tabular-nums shrink-0">
                        {activeCollectionCount}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-snug">
                      {hasPayments
                        ? tr('Tus clientes ya ven tus cuentas al pagar en el carrito.', 'Buyers see your receiving accounts clearly at checkout.', '买家在购物车结账时已可查看您的 Pago Móvil / Zelle / Binance 等收款信息。')
                        : tr('Configura Pago Móvil, Zelle o Binance para cobrar pedidos.', 'Add Pago Móvil, Zelle, or Binance so buyers can pay you.', '请配置 Pago Móvil、Zelle 或 Binance 账户，方便客户直接付款下单。')}
                    </span>
                  </button>

                  {/* Step 4: Shipping, Orders & POS */}
                  <button
                    type="button"
                    onClick={() => setActiveTab(pendingOrdersCount > 0 ? 'orders' : 'settings')}
                    className="p-3 rounded-xl border bg-[#09090b] border-white/[0.1] hover:border-amber-400/45 text-left transition-colors flex flex-col justify-between gap-1.5 min-h-[76px]"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-bold text-zinc-100">
                        {pendingOrdersCount > 0
                          ? tr(`4. Atender Pedidos (${pendingOrdersCount})`, `4. Pending Orders (${pendingOrdersCount})`, `4. 处理待办订单 (${pendingOrdersCount})`)
                          : tr('4. Envíos y Ventas', '4. Shipping & Orders', '4. 配送设置与接单')}
                      </span>
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-snug">
                      {pendingOrdersCount > 0
                        ? tr('Tienes pedidos por confirmar: revisa comprobantes y despacha.', 'You have orders awaiting confirmation and dispatch.', '您有新订单等待确认付款与安排发货，点击立即处理。')
                        : tr('Revisa tus envíos, retiro en tienda y registra ventas directas.', 'Configure delivery fees, pickup & manage POS or web orders.', '配置全国物流/同城配送/到店自提，并管理线上与门店销售订单。')}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/[0.08] pb-3">
        {[
          { id: 'billing', label: t.merchant.tabBilling, icon: CreditCard },
          {
            id: 'payment_methods',
            label: `${tr('Cobros de Mi Tienda', 'My Store Collections', '店铺收款方式')} (${storePaymentMethods.filter((m) => m.isActive).length})`,
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
          { id: 'vector', label: tr('Asistente Vector', 'Vector Assistant', 'Vector 助手'), icon: Compass },
          { id: 'email_smtp', label: tr('SMTP / Alertas', 'SMTP / Alerts', 'SMTP / 提醒'), icon: Server },
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
                    {t.merchant.paymentMethodsTitle} ${netSubscriptionUSD.toFixed(2)}/{tr('mes', 'mo', '月')}
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {activeStoreSubscriptionMethods.length > 0
                      ? tr(
                          `Incluye ${activeStoreSubscriptionMethods.length} método${activeStoreSubscriptionMethods.length === 1 ? '' : 's'} asignado${activeStoreSubscriptionMethods.length === 1 ? '' : 's'} específicamente a ${activeStore?.storeName || 'tu tienda'}.`,
                          `Includes ${activeStoreSubscriptionMethods.length} method${activeStoreSubscriptionMethods.length === 1 ? '' : 's'} specifically assigned to ${activeStore?.storeName || 'your store'}.`,
                          `包含 ${activeStoreSubscriptionMethods.length} 项专属分配给 ${activeStore?.storeName || '您店铺'} 的收款方式。`
                        )
                      : tr(
                          'Métodos configurados por el Administrador. Haz clic en uno para seleccionarlo automáticamente en el formulario.',
                          'Methods configured by the Administrator. Click one to select it automatically in the form.',
                          '管理员配置的收款方式。点击任意一项即可自动选入下方表单。'
                        )}
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
                      {tr('El Administrador aún no ha cargado métodos de pago manuales', 'The Administrator has not added manual payment methods yet', '管理员尚未添加手动收款方式')}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {tr(
                        'Cuando el Administrador configure Pago Móvil, Zelle, Binance Pay o cuentas bancarias en el Panel Admin, aparecerán aquí automáticamente.',
                        'Once the Administrator configures Pago Móvil, Zelle, Binance Pay, or bank accounts in the Admin Panel, they will appear here automatically.',
                        '当管理员在管理面板中配置 Pago Móvil、Zelle、Binance Pay 或银行账户后，它们将自动显示在此处。'
                      )}
                    </p>
                    <a
                      href={`https://wa.me/${(normalizeVenezuelanPhone(billing.supportWhatsapp) || '584220273766')}?text=${encodeURIComponent(
                        tr(
                          `Hola Administrador, deseo pagar la suscripción de mi tienda "${activeStore?.storeName || ''}" ($${netSubscriptionUSD} USD). ¿A qué cuenta transfiero?`,
                          `Hello Admin, I would like to pay the subscription for my store "${activeStore?.storeName || ''}" ($${netSubscriptionUSD} USD). Which account should I transfer to?`,
                          `管理员您好，我想支付我店铺“${activeStore?.storeName || ''}”的订阅费 ($${netSubscriptionUSD} USD)，请问转账至哪个账户？`
                        )
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{tr('Solicitar Datos de Pago por WhatsApp', 'Request Payment Details via WhatsApp', '通过 WhatsApp 获取付款信息')}</span>
                    </a>
                  </div>
                ) : (
                  subscriptionCheckoutOptions.map((opt) => {
                  const isSelected = payMethod === opt.value;
                  const exactPayAmount = formatSubscriptionOptionAmount(
                    opt.currency,
                    netSubscriptionUSD
                  );
                  const displayOptName = translatePaymentMethodLabel(opt.value, lang);
                  const displayInstructions = translateCommonPaymentInstruction(opt.instructions, lang);
                  const fullCopyText = [
                    `${displayOptName} (${opt.currency}) · ${tr('Monto:', 'Amount:', '金额:')} ${exactPayAmount}`,
                    opt.accountHolder ? `${tr('Titular:', 'Holder:', '持有人:')} ${opt.accountHolder}` : '',
                    opt.accountDetails,
                    displayInstructions ? `${tr('Instrucciones:', 'Instructions:', '说明:')} ${displayInstructions}` : '',
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
                            {displayOptName}
                          </span>
                          <span className="text-zinc-500" aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] text-amber-200 tabular-nums shrink-0">
                            {exactPayAmount}
                          </span>
                          {opt.isStoreSpecific && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 text-[10px] font-semibold shrink-0">
                              {tr('Asignado a tu tienda', 'Assigned to your store', '专属您店铺')}
                            </span>
                          )}
                          {isSelected && (
                            <>
                              <span className="text-zinc-500" aria-hidden="true">·</span>
                              <span className="text-[11px] font-semibold text-amber-300 shrink-0">
                                {tr('Seleccionado', 'Selected', '已选择')}
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
                            notify(`${displayOptName} - ${t.common.copied}`);
                          }}
                          className="text-[11px] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg bg-[#111114] border border-white/[0.08] flex items-center gap-1 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.common.copy}</span>
                        </button>
                      </div>
                      {opt.accountHolder && (
                        <p className="text-zinc-400 text-[11px]">
                          {tr('Titular:', 'Holder:', '持有人:')} <span className="text-zinc-200">{opt.accountHolder}</span>
                        </p>
                      )}
                      <p className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                        {opt.accountDetails}
                      </p>
                      {displayInstructions && (
                        <p className="text-zinc-400 text-[11px]">{displayInstructions}</p>
                      )}
                      {opt.qrImageUrl && (
                        <div className="pt-1.5 flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMerchantZoomQr({
                                qrUrl: opt.qrImageUrl!,
                                title: displayOptName,
                                subtitle: `${exactPayAmount}`,
                                accountDetails: opt.accountDetails,
                              });
                            }}
                            className="bg-white p-1.5 rounded-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                          >
                            <img
                              src={opt.qrImageUrl}
                              alt={displayOptName}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 object-contain"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMerchantZoomQr({
                                qrUrl: opt.qrImageUrl!,
                                title: displayOptName,
                                subtitle: `${exactPayAmount}`,
                                accountDetails: opt.accountDetails,
                              });
                            }}
                            className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{tr('Escanear / Ampliar QR', 'Scan / Zoom QR', '扫码 / 放大二维码')}</span>
                          </button>
                        </div>
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
                            {translatePaymentMethodLabel('Coordinado con Admin (WhatsApp)', lang)}
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
                            {tr('Cuenta receptora', 'Receiving account', '收款账户')} ({translatePaymentMethodLabel(activeSelectedSubscriptionOption.value, lang)}):
                          </span>
                          <span className="font-mono text-[11px] font-bold text-emerald-300">
                            {formatSubscriptionOptionAmount(
                              activeSelectedSubscriptionOption.currency,
                              netSubscriptionUSD
                            )}
                          </span>
                          {activeSelectedSubscriptionOption.isStoreSpecific && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 text-[10px] font-semibold">
                              {tr('Asignado a tu tienda', 'Assigned to your store', '专属您店铺')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeSelectedSubscriptionOption.accountDetails);
                            notify(`${translatePaymentMethodLabel(activeSelectedSubscriptionOption.value, lang)} - ${t.common.copied}`);
                          }}
                          className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.common.copy}</span>
                        </button>
                      </div>
                      {activeSelectedSubscriptionOption.accountHolder && (
                        <div className="text-[11px] text-zinc-400">
                          {tr('Titular:', 'Holder:', '持有人:')} <span className="text-zinc-200">{activeSelectedSubscriptionOption.accountHolder}</span>
                        </div>
                      )}
                      <div className="font-mono text-[11px] text-zinc-200 whitespace-pre-line">
                        {activeSelectedSubscriptionOption.accountDetails}
                      </div>
                      {activeSelectedSubscriptionOption.instructions && (
                        <div className="text-[11px] text-zinc-400">
                          {translateCommonPaymentInstruction(activeSelectedSubscriptionOption.instructions, lang)}
                        </div>
                      )}
                      {activeSelectedSubscriptionOption.qrImageUrl && (
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-white/[0.06] mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setMerchantZoomQr({
                                qrUrl: activeSelectedSubscriptionOption.qrImageUrl!,
                                title: translatePaymentMethodLabel(
                                  activeSelectedSubscriptionOption.value,
                                  lang
                                ),
                                subtitle: formatSubscriptionOptionAmount(
                                  activeSelectedSubscriptionOption.currency,
                                  netSubscriptionUSD
                                ),
                                accountDetails: activeSelectedSubscriptionOption.accountDetails,
                              })
                            }
                            className="bg-white p-2 rounded-xl border border-white/20 w-fit hover:scale-105 transition-transform cursor-pointer"
                          >
                            <img
                              src={activeSelectedSubscriptionOption.qrImageUrl}
                              alt={activeSelectedSubscriptionOption.value}
                              referrerPolicy="no-referrer"
                              className="w-28 h-28 object-contain"
                            />
                          </button>
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <QrCode className="w-3.5 h-3.5" />
                              <span>{tr('Código QR Oficial Listo para Escanear', 'Official QR Code Ready to Scan', '官方收款二维码（可直接扫码）')}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              {tr(
                                'Abre Binance o Bybit, escanea el QR y pega el Order ID o referencia arriba.',
                                'Open Binance or Bybit, scan the QR, and enter the Order ID or reference above.',
                                '打开 Binance 或 Bybit 扫码转账，并在上方填入订单号或参考号。'
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setMerchantZoomQr({
                                  qrUrl: activeSelectedSubscriptionOption.qrImageUrl!,
                                  title: translatePaymentMethodLabel(
                                    activeSelectedSubscriptionOption.value,
                                    lang
                                  ),
                                  subtitle: formatSubscriptionOptionAmount(
                                    activeSelectedSubscriptionOption.currency,
                                    netSubscriptionUSD
                                  ),
                                  accountDetails: activeSelectedSubscriptionOption.accountDetails,
                                })
                              }
                              className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                            >
                              {tr('Ampliar QR en pantalla completa', 'Zoom QR fullscreen', '全屏放大二维码')}
                            </button>
                          </div>
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
                    {tr('WhatsApp para recibir confirmación', 'WhatsApp to receive confirmation', '接收确认通知的 WhatsApp')}
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
                  {tr('Captura del Comprobante (Opcional - Imagen)', 'Payment Screenshot (Optional - Image)', '付款截图（可选 - 图片）')}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.1] text-xs font-semibold text-amber-300 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingProof
                        ? tr('Procesando...', 'Processing...', '处理中...')
                        : tr('Adjuntar Captura', 'Attach Screenshot', '添加付款截图')}
                    </span>
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
                        alt={tr('Captura de pago', 'Payment screenshot', '付款截图')}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-emerald-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setPayProofImage('')}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        {tr('Quitar', 'Remove', '移除')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-500">
                      {tr(
                        'Se adjuntará automáticamente en el correo al Administrador.',
                        'Will be automatically attached in the email to the Administrator.',
                        '将自动附加到发送给管理员的电子邮件中。'
                      )}
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
                        {tr(
                          `Comprobante #${lastPaymentVoucher.payment.referenceNumber} Listo`,
                          `Receipt #${lastPaymentVoucher.payment.referenceNumber} Ready`,
                          `付款凭证 #${lastPaymentVoucher.payment.referenceNumber} 已就绪`
                        )}
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
                    aria-label={t.common.close}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-[#09090b]/80 border border-white/[0.08] rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{tr('Tienda:', 'Store:', '店铺:')}</span>
                    <span className="font-bold text-white">{lastPaymentVoucher.payment.storeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{tr('Monto reportado:', 'Reported amount:', '申报金额:')}</span>
                    <span className="font-mono font-bold text-amber-400">
                      ${Number(lastPaymentVoucher.payment.amountUSD).toFixed(2)} USD · {translatePaymentMethodLabel(lastPaymentVoucher.payment.paymentMethod, lang)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{tr('Estado de correo:', 'Email status:', '邮件状态:')}</span>
                    <span className="font-semibold text-emerald-300">
                      {lastPaymentVoucher.result.emailSent
                        ? `${tr('Enviado', 'Sent', '已发送')} (${lastPaymentVoucher.result.deliveryChannel.toUpperCase()})`
                        : tr('Listo para enviar vía tu correo', 'Ready to send via your email', '准备通过您的邮箱发送')}
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
                    <span>{tr('Enviar Comprobante por WhatsApp', 'Send Receipt via WhatsApp', '通过 WhatsApp 发送凭证')}</span>
                  </a>
                  <a
                    href={lastPaymentVoucher.result.mailtoHref}
                    className="py-2.5 px-3.5 rounded-xl bg-[#09090b] hover:bg-zinc-900 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors min-h-[42px]"
                  >
                    <Mail className="w-4 h-4" />
                    <span>
                      {lastPaymentVoucher.result.emailSent
                        ? tr('Reenviar Copia por Correo', 'Resend Copy via Email', '重发邮件副本')
                        : tr('Enviar Comprobante por Correo', 'Send Receipt via Email', '通过邮件发送凭证')}
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
                            {translatePaymentMethodLabel(p.paymentMethod, lang)} · Ref: {p.referenceNumber}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            ${p.amountUSD} USD · {p.storeName}
                            {p.couponCode ? ` · ${p.couponCode} (-$${p.discountUSD ?? 0})` : ''}
                            {p.proofImageUrl ? ` · ${tr('Captura adjunta', 'Screenshot attached', '含付款截图')}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={voucherLinks.whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-[10px] font-bold flex items-center gap-1"
                            title={tr('Enviar comprobante por WhatsApp', 'Send receipt via WhatsApp', '通过 WhatsApp 发送凭证')}
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={voucherLinks.mailtoHref}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-white/[0.08]"
                            title={tr('Enviar comprobante por correo', 'Send receipt via email', '通过邮件发送凭证')}
                          >
                            <Mail className="w-3 h-3" />
                            <span>{tr('Correo', 'Email', '邮件')}</span>
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
                    <span>{tr('Llenar desde Almacén', 'Fill from Warehouse', '从仓库导入商品')}</span>
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
                    value={prodImage.startsWith('data:') ? tr('Foto cargada', 'Photo loaded', '已加载图片') : prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {/* Universal Size Configurator for any Product (Clothes, Footwear, Variants) */}
              <div className="pt-2 border-t border-white/[0.08]">
                <SizeTagBuilder
                  compact
                  sizes={prodAvailableSizes}
                  onChange={setProdAvailableSizes}
                  storeDefaultSizes={activeStore.defaultClothingSizes}
                  sizeGuide={prodSizeGuide}
                  onSizeGuideChange={setProdSizeGuide}
                  title={tr('Tallas de Ropa / Calzado (Opcional)', 'Apparel / Footwear Sizes (Optional)', '服装/鞋靴尺码配置（可选）')}
                  subtitle={tr(
                    'Agrega o edita tallas para este producto sin importar la categoría de tu tienda.',
                    'Add or edit sizes for this item regardless of your store category.',
                    '无论店铺品类，均可为该商品添加或编辑可选尺码。'
                  )}
                />
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
                      setProdAvailableSizes([]);
                      setProdSizeGuide('');
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
                products.map((prod) => {
                  const pSizes = normalizeSizeList(prod.availableSizes);
                  return (
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
                              referrerPolicy="no-referrer"
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
                          <div className="flex flex-wrap items-center gap-2 text-[11px] mt-0.5">
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
                            {pSizes.length > 0 && (
                              <>
                                <span className="text-zinc-500">·</span>
                                <span className="font-mono text-amber-300 truncate max-w-[220px]">
                                  {tr('Tallas:', 'Sizes:', '尺码:')} {pSizes.map((s) => translateSizeTokenLabel(s, lang)).join(', ')}
                                </span>
                              </>
                            )}
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
                            setProdAvailableSizes(normalizeSizeList(prod.availableSizes));
                            setProdSizeGuide(prod.sizeGuide || '');
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
                  );
                })
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
                  onClick={() => exportStoreSalesLedgerPDF(activeStore, orders, exchangeRate, lang)}
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
                          {translateSaleChannelLabel(ord.saleChannel || 'Carrito Web', lang)}
                        </span>
                        <span className="font-bold text-white">{ord.customerName}</span>
                        {ord.customerRif && (
                          <span className="font-mono text-zinc-400">({ord.customerRif})</span>
                        )}
                        <span className="text-zinc-400">· {ord.customerPhone}</span>
                        <span className="px-2 py-0.5 rounded bg-[#09090b] border border-white/[0.1] text-zinc-300">
                          {translateShippingTypeLabel(ord.shippingType, lang)}
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
                        <span className="text-zinc-300 font-normal">{translatePaymentMethodLabel(ord.paymentMethod, lang)}</span>
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
                          tr(
                            `Hola ${ord.customerName}, te escribimos de ${activeStore.storeName} respecto a tu factura #${ord.invoiceNumber}.`,
                            `Hello ${ord.customerName}, writing from ${activeStore.storeName} regarding your invoice #${ord.invoiceNumber}.`,
                            `${ord.customerName} 您好，我们是 ${activeStore.storeName}，关于您的订单发票 #${ord.invoiceNumber} 与您联系。`
                          )
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
                      {products.map((prod) => {
                        const pSizes = normalizeSizeList(prod.availableSizes);
                        return (
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
                                {pSizes.length > 0 ? ` · ${pSizes.length} ${tr('tallas', 'sizes', '尺码')}` : ''}
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Size Prompt for Apparel Products */}
                  {directSizePromptProduct && (
                    <div className="bg-amber-500/[0.07] border border-amber-400/40 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5" />
                          <span>
                            {tr('Elige talla para', 'Select size for', '选择尺码:')}{' '}
                            <strong className="text-white">{directSizePromptProduct.name}</strong>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDirectSizePromptProduct(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {normalizeSizeList(directSizePromptProduct.availableSizes).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => addProductToDirectSale(directSizePromptProduct, sz)}
                            className="min-w-[38px] min-h-[34px] px-2.5 rounded-lg bg-[#09090b] hover:bg-amber-400 hover:text-zinc-950 border border-amber-400/40 text-xs font-mono font-bold text-amber-300 transition-colors"
                          >
                            {translateSizeTokenLabel(sz, lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Cart Items */}
                  {directCart.length > 0 && (
                    <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-3 space-y-2">
                      {directCart.map((item) => {
                        const lineKey = buildCartLineKey(item.product.id, item.selectedSize);
                        const itemSizes = normalizeSizeList(item.product.availableSizes);
                        return (
                          <div key={lineKey} className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 flex items-center gap-2 flex-1">
                              <span className="text-white font-semibold truncate">{item.product.name}</span>
                              {itemSizes.length > 0 && (
                                <select
                                  value={item.selectedSize || itemSizes[0]}
                                  onChange={(e) =>
                                    changeDirectSaleItemSize(
                                      item.product.id,
                                      item.selectedSize,
                                      e.target.value
                                    )
                                  }
                                  className="px-1.5 py-0.5 rounded bg-[#111114] border border-amber-400/35 text-[11px] font-mono text-amber-300 shrink-0"
                                >
                                  {itemSizes.map((sz) => (
                                    <option key={sz} value={sz}>
                                      {translateSizeTokenLabel(sz, lang)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  updateDirectSaleQty(item.product.id, -1, item.selectedSize)
                                }
                                className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono text-white w-5 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDirectSaleQty(item.product.id, 1, item.selectedSize)
                                }
                                className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="font-mono text-amber-400 w-16 text-right">
                                ${(item.product.priceUSD * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
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
                                label: `${translatePaymentMethodLabel(m.name, lang)} (${m.currency} · ${tr('Mi Tienda', 'My Store', '我的店铺')})`,
                                value: m.name,
                                details: m.accountDetails,
                              });
                            });
                          salesPaymentMethods.forEach((m) => {
                            const k = m.name.trim().toLowerCase();
                            if (!k || seen.has(k)) return;
                            seen.add(k);
                            opts.push({
                              label: `${translatePaymentMethodLabel(m.name, lang)} (${m.currency}${m.appliesIgtf ? ' · IGTF 3%' : ''})`,
                              value: m.name,
                            });
                          });
                          [
                            { value: 'Pago Móvil', label: `${translatePaymentMethodLabel('Pago Móvil', lang)} (Bs.)` },
                            { value: 'Efectivo USD', label: translatePaymentMethodLabel('Efectivo USD', lang) },
                            { value: 'Transferencia Bancaria', label: translatePaymentMethodLabel('Transferencia Bancaria', lang) },
                            { value: 'Binance Pay', label: `${translatePaymentMethodLabel('Binance Pay', lang)} (USDT)` },
                            { value: 'Bybit', label: translatePaymentMethodLabel('Bybit', lang) },
                            { value: 'Zelle', label: translatePaymentMethodLabel('Zelle', lang) },
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
                {tr(
                  `Premio: $${billing.referralRewardUSD ?? 25} USD / Referido`,
                  `Reward: $${billing.referralRewardUSD ?? 25} USD / Referral`,
                  `推荐奖励: $${billing.referralRewardUSD ?? 25} USD / 位`
                )}
              </div>
            </div>

            {(() => {
              const storeRefCode = activeStore.referralCode || '...';
              const promoUrl =
                typeof window !== 'undefined'
                  ? `${window.location.origin}/?ref=${storeRefCode}`
                  : `https://smith-solutions.app/?ref=${storeRefCode}`;
              const waInviteText = encodeURIComponent(
                tr(
                  `¡Hola! Te invito a crear tu propia tienda online con carrito, facturas PDF duales, Pago Móvil, Binance Pay y pedidos por WhatsApp en Smith Solutions E-Commerce ($25/mes).\n\nUsa mi enlace oficial de referido para registrarte:\n${promoUrl}\n\nCódigo de referido: ${storeRefCode}`,
                  `Hi! I invite you to launch your own online store with shopping cart, dual PDF invoices, Pago Móvil, Binance Pay, and WhatsApp orders on Smith Solutions E-Commerce ($25/mo).\n\nUse my official referral link to register:\n${promoUrl}\n\nReferral code: ${storeRefCode}`,
                  `您好！诚邀您在 Smith Solutions E-Commerce（$25/月）创建专属线上店铺，支持购物车、双联 PDF 发票、Pago Móvil、Binance Pay 与 WhatsApp 接单。\n\n请使用我的官方推荐链接注册：\n${promoUrl}\n\n推荐码：${storeRefCode}`
                )
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
                            {tr('Por invitar a:', 'For inviting:', '邀请店铺:')}{' '}
                            <strong className="text-zinc-200">{c.referredStoreName}</strong>
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
                          {tr('Código:', 'Code:', '推荐码:')} {r.referrerCode}
                          {r.rewardCouponCode ? ` · ${r.rewardCouponCode}` : ''}
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

      {/* TAB 6: STORE DATA, CLOTHING SIZES & SHIPPING SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <LanguageSettings />

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
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.categoryLabel}</label>
              <input
                type="text"
                value={regCategory}
                onChange={(e) => setRegCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t.merchant.descLabel}</label>
              <input
                type="text"
                value={regDescription}
                onChange={(e) => setRegDescription(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Store Subdomain URL Customization */}
          <div className="bg-[#09090b] border border-emerald-500/25 rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    'URL Subdominio Personalizado de Tu Tienda',
                    'Custom Store Subdomain URL',
                    '自定义店铺子域名链接'
                  )}
                </span>
              </label>
              {slugAvailability === 'checking' && (
                <span className="text-[11px] text-zinc-400">{tr('Verificando...', 'Checking...', '检测中...')}</span>
              )}
              {slugAvailability === 'available' && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  ✓ {tr('Disponible', 'Available', '可用')}
                </span>
              )}
              {slugAvailability === 'taken' && (
                <span className="text-[11px] text-red-400 font-semibold">
                  ✕ {tr('Ya está en uso por otra tienda', 'Already taken by another store', '已被其他店铺使用')}
                </span>
              )}
              {slugAvailability === 'invalid' && (
                <span className="text-[11px] text-amber-400 font-semibold">
                  {tr('Usa 2–60 caracteres: minúsculas, números y guiones', 'Use 2–60 chars: lowercase, numbers & hyphens', '请使用 2–60 个字符：小写字母、数字和连字符')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center bg-[#111114] border border-white/[0.1] rounded-xl overflow-hidden">
                <span className="px-3 py-2.5 text-xs font-mono text-zinc-400 bg-zinc-900/70 border-r border-white/[0.08] shrink-0">
                  /@
                </span>
                <input
                  type="text"
                  maxLength={60}
                  value={regSlug}
                  onChange={(e) => {
                    setRegSlugManuallyEdited(true);
                    setRegSlug(normalizeStoreSubdomainSlug(e.target.value));
                  }}
                  placeholder="mi-tienda"
                  className="w-full px-3 py-2.5 bg-transparent text-xs font-mono text-white focus:outline-none"
                />
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-[#111114] border border-white/[0.08] text-[11px] font-mono text-zinc-300 flex items-center justify-between gap-2">
                <span className="truncate">{getStoreSubdomainDisplay(regSlug || activeStore.slug)}</span>
                <span className="text-emerald-400 shrink-0">/ @{regSlug || activeStore.slug}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-zinc-400">
                {tr(
                  'Genera tu tarjeta QR exclusiva con el enlace directo de tu tienda para redes e impresos.',
                  'Generate a custom QR card with your store link for social bios and print.',
                  '生成带有店铺专属直达链接的二维码海报，适合社交媒体或线下打印。'
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowStoreQrModal(true)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{tr('Generar QR de Tu Tienda', 'Generate Store QR', '生成店铺二维码')}</span>
              </button>
            </div>
          </div>

          {/* Store Social Networks Configuration */}
          <div className="bg-[#09090b] border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {tr(
                    'Redes Sociales de Tu Tienda (Visibles en Directorio y Perfil)',
                    'Store Social Networks (Visible in Directory & Storefront)',
                    '店铺社交媒体账号（展示在商城目录与店铺主页）'
                  )}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {tr(
                  'Ingresa @usuario o la URL completa (ej: @mimarca o https://instagram.com/mimarca).',
                  'Enter @handle or full URL (e.g. @mybrand or https://instagram.com/mybrand).',
                  '输入 @账号 或完整网址（例如 @mybrand 或 https://instagram.com/mybrand）。'
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SOCIAL_PLATFORMS.map((soc) => (
                <div key={`set-soc-${soc.key}`}>
                  <label className="text-[11px] text-zinc-400 block mb-1">{soc.label}</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={regSocialLinks[soc.key] || ''}
                    onChange={(e) =>
                      setRegSocialLinks((prev) => ({
                        ...prev,
                        [soc.key]: e.target.value,
                      }))
                    }
                    placeholder={soc.placeholder}
                    className="w-full px-3 py-2 bg-[#111114] border border-white/[0.08] rounded-lg text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Store-level Default Clothing / Apparel Sizes Settings */}
          <div className="bg-[#09090b] border border-amber-500/25 rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={regClothingSizesEnabled}
                onChange={(e) => setRegClothingSizesEnabled(e.target.checked)}
                className="mt-0.5 accent-amber-500 w-4 h-4 shrink-0"
              />
              <div>
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Modo Tallas de Ropa / Calzado para esta Tienda (Cualquier Categoría)',
                      'Apparel / Footwear Size Mode for this Store (Any Category)',
                      '店铺服装/鞋靴尺码默认模板（适用于任意品类）'
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {tr(
                    'Permite aplicar rápidamente tallas por defecto al crear productos y destacar disponibilidad de tallas en el directorio.',
                    'Lets you apply default size presets rapidly when adding items and highlights size availability in the marketplace directory.',
                    '新增商品时可一键应用默认尺码模板，并在商城目录中展示尺码支持标记。'
                  )}
                </p>
              </div>
            </label>

            {regClothingSizesEnabled && (
              <SizeTagBuilder
                compact
                sizes={regDefaultClothingSizes}
                onChange={setRegDefaultClothingSizes}
                title={tr('Tallas base predeterminadas', 'Default base sizes', '店铺默认基础尺码')}
              />
            )}
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
                  placeholder={tr('Zona de entrega', 'Delivery zone', '配送区域')}
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
        </div>
      )}

      {/* TAB: PER-STORE OWNER MANUAL PAYMENT & COLLECTION CONFIGURATION */}
      {activeTab === 'payment_methods' && (
        <div className="space-y-6">
          <div className="bg-[#111114] border border-emerald-500/30 rounded-2xl p-5 space-y-1.5">
            <h2 className="text-base sm:text-lg font-extrabold text-white font-display flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span>
                {tr(
                  `Configurar Cómo Cobra Tu Tienda (${activeStore.storeName})`,
                  `Configure How Your Store Collects Payments (${activeStore.storeName})`,
                  `配置店铺收款方式 (${activeStore.storeName})`
                )}
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              {tr(
                'Cada dueño de tienda configura de forma manual sus propias cuentas bancarias, Pago Móvil, Binance Pay, Zinli, Transferencia Banesco o Zelle donde recibe el dinero de sus ventas. Los métodos activos se muestran a tus compradores al finalizar el carrito y en tu sistema POS/Ventas.',
                'Each store owner manually configures their own bank accounts, Pago Móvil, Binance Pay, Zinli, Bank Transfer, or Zelle where sales revenue is received. Active methods appear to buyers at checkout and in your POS/Sales system.',
                '每位店主均可手动配置自己的收款账户（银行账户、Pago Móvil、Binance Pay、Zinli 或 Zelle）。启用后的方式将向购物车结账顾客以及收银台展示。'
              )}
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
                        ? `${tr('Editar Cobro:', 'Edit Method:', '编辑收款方式:')} ${translatePaymentMethodLabel(editingStoreMethod.name, lang)}`
                        : tr('Agregar Cuenta o Método de Cobro', 'Add Collection Account or Method', '添加收款账户或方式')}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tr(
                      'Ingresa tus datos reales donde tus clientes te enviarán el dinero.',
                      'Enter your real account details where customers will send payments.',
                      '填写顾客将向您付款的真实账户信息。'
                    )}
                  </p>
                </div>
                {editingStoreMethod && (
                  <button
                    type="button"
                    onClick={resetStoreMethodForm}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-[#09090b]"
                  >
                    {t.common.cancel}
                  </button>
                )}
              </div>

              {!editingStoreMethod && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-zinc-400">
                    {tr(
                      'Plantillas rápidas (opcionales, luego colocas tu cuenta):',
                      'Quick templates (optional, then fill in your account):',
                      '快速模板（可选，选择后填入您的账户）：'
                    )}
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
                        { name: 'Binance Pay (QR)', currency: 'USDT' as PlatformPaymentCurrency, appliesIgtf: false },
                        { name: 'Bybit Pay (QR)', currency: 'USDT' as PlatformPaymentCurrency, appliesIgtf: false },
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
                          + {translatePaymentMethodLabel(sug.name, lang)}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Nombre del Método *', 'Method Name *', '收款方式名称 *')}
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={80}
                    value={stPmName}
                    onChange={(e) => setStPmName(e.target.value)}
                    placeholder={tr('Ej: Pago Móvil Banesco / Binance Pay / Zelle', 'Ex: Pago Móvil / Binance Pay / Zelle', '如：Pago Móvil / Binance Pay / Zelle')}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">
                    {tr('Moneda *', 'Currency *', '币种 *')}
                  </label>
                  <select
                    value={stPmCurrency}
                    onChange={(e) => setStPmCurrency(e.target.value as PlatformPaymentCurrency)}
                    className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="Bs">Bs.</option>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR</option>
                    <option value="Otro">{tr('Otro', 'Other', '其他')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr('Titular / Razón Social / RIF', 'Account Holder / Business / Tax ID', '账户持有人 / 企业名称 / RIF')}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={stPmHolder}
                  onChange={(e) => setStPmHolder(e.target.value)}
                  placeholder={`${activeStore.registeredOwnerName}${activeStore.rif ? ` · ${activeStore.rif}` : ''}`}
                  className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr(
                    'Datos de Cobro de Tu Tienda (Cuenta, Teléfono Pago Móvil, Correo o Wallet) *',
                    'Your Store Payment Details (Bank Account, Pago Móvil Phone, Email, or Wallet) *',
                    '收款详情（银行账号、Pago Móvil 电话、邮箱或钱包地址）*'
                  )}
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={300}
                  value={stPmDetails}
                  onChange={(e) => setStPmDetails(e.target.value)}
                  placeholder="0134 Banesco · 0414-0000000 · V-12345678 / PayID: 12345678"
                  className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">
                  {tr('Instrucciones para Tu Cliente (Opcional)', 'Instructions for Your Customer (Optional)', '买家付款指引（可选）')}
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={stPmInstructions}
                  onChange={(e) => setStPmInstructions(e.target.value)}
                  placeholder={tr(
                    'Ej: Enviar captura por WhatsApp tras transferir para despachar pedido',
                    'Ex: Send screenshot via WhatsApp after transfer to dispatch order',
                    '例如：转账后请通过 WhatsApp 发送截图以便安排发货'
                  )}
                  className="w-full px-3 py-2.5 min-h-[42px] bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                />
              </div>

              <QrUploadField
                value={stPmQrImageUrl}
                onChange={setStPmQrImageUrl}
                accent="emerald"
                onZoom={(qrUrl) =>
                  setMerchantZoomQr({
                    qrUrl,
                    title: stPmName || 'QR',
                    subtitle: activeStore.storeName,
                    accountDetails: stPmDetails,
                  })
                }
              />

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stPmAppliesIgtf}
                    onChange={(e) => setStPmAppliesIgtf(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>
                    {tr(
                      'Aplica IGTF 3% Divisas (SENIAT) cuando se registre en POS',
                      'Apply 3% Foreign Currency Tax (IGTF) when recorded in POS',
                      '在 POS 结算时适用 3% 外汇交易税 (IGTF)'
                    )}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stPmActive}
                    onChange={(e) => setStPmActive(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span>
                    {tr(
                      'Visible para clientes en tu Tienda Online y POS',
                      'Visible to customers in your Online Store & POS',
                      '在线上商城与 POS 结算中向顾客可见'
                    )}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>
                  {editingStoreMethod
                    ? tr('Actualizar Método de Cobro', 'Update Collection Method', '更新收款方式')
                    : tr('Guardar Método de Cobro', 'Save Collection Method', '保存收款方式')}
                </span>
              </button>
            </form>

            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    {tr(
                      `Métodos de Cobro de Tu Tienda (${storePaymentMethods.length})`,
                      `Your Store Collection Methods (${storePaymentMethods.length})`,
                      `已配置的店铺收款方式 (${storePaymentMethods.length})`
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {tr(
                      'Solo tú administras las cuentas y wallets mostradas a tus clientes.',
                      'Only you manage the accounts and wallets displayed to your buyers.',
                      '仅您本人可管理展示给买家的银行账户与电子钱包。'
                    )}
                  </p>
                </div>
              </div>

              {storePaymentMethods.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#09090b] border border-white/[0.06] text-center space-y-1.5">
                  <Wallet className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    {tr(
                      'Aún no has configurado tus cuentas de cobro manuales',
                      'You have not configured any manual collection accounts yet',
                      '您尚未配置任何手动收款账户'
                    )}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {tr(
                      'Agrega aquí tu Pago Móvil, cuenta Banesco, Binance Pay, Zinli o Zelle para que tus compradores sepan exactamente a dónde pagarte.',
                      'Add your Pago Móvil, bank account, Binance Pay, Zinli, or Zelle here so buyers know exactly where to pay you.',
                      '在此添加您的 Pago Móvil、银行账号、Binance Pay、Zinli 或 Zelle，方便买家直接向您付款。'
                    )}
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
                          <span className="font-bold text-white text-sm">{translatePaymentMethodLabel(method.name, lang)}</span>
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
                            {method.isActive
                              ? tr('Activo', 'Active', '已启用')
                              : tr('Pausado', 'Paused', '已暂停')}
                          </span>
                        </div>
                        {method.accountHolder && (
                          <div className="text-zinc-400">
                            {tr('Titular:', 'Holder:', '持有人:')} {method.accountHolder}
                          </div>
                        )}
                        <div className="text-zinc-200 whitespace-pre-line font-mono text-[11px]">
                          {method.accountDetails}
                        </div>
                        {method.instructions && (
                          <div className="text-zinc-400 text-[11px]">{translateCommonPaymentInstruction(method.instructions, lang)}</div>
                        )}
                        {method.qrImageUrl && (
                          <div className="pt-1.5 flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setMerchantZoomQr({
                                  qrUrl: method.qrImageUrl!,
                                  title: translatePaymentMethodLabel(method.name, lang),
                                  subtitle: activeStore.storeName,
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
                            <span className="text-[11px] text-emerald-300 font-semibold">
                              {tr('QR activo para clientes (clic para ampliar)', 'Active QR for buyers (click to zoom)', '已对买家开启二维码（点击放大）')}
                            </span>
                          </div>
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
                          {method.isActive
                            ? tr('Pausar', 'Pause', '暂停')
                            : tr('Activar', 'Activate', '启用')}
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
                            setStPmQrImageUrl(method.qrImageUrl || '');
                            setStPmAppliesIgtf(Boolean(method.appliesIgtf));
                            setStPmActive(method.isActive);
                          }}
                          className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-[#111114] border border-white/[0.1] hover:border-amber-400 text-zinc-200 flex items-center justify-center"
                          title={tr('Editar método', 'Edit method', '编辑方式')}
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
                            {tr('Confirmar', 'Confirm', '确认删除')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStoreMethodId(method.id)}
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

      <QrZoomModal
        isOpen={Boolean(merchantZoomQr)}
        qrUrl={merchantZoomQr?.qrUrl}
        title={merchantZoomQr?.title || 'QR'}
        subtitle={merchantZoomQr?.subtitle}
        accountDetails={merchantZoomQr?.accountDetails}
        onClose={() => setMerchantZoomQr(null)}
      />

      <StoreQrShareModal
        isOpen={showStoreQrModal}
        store={activeStore || null}
        onClose={() => setShowStoreQrModal(false)}
        onVisitStore={(st) => onOpenStorefront(st.slug)}
      />
    </section>
  );
};
