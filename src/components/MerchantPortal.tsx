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
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  PlatformBillingSettings,
  ReferralCodeLookup,
  ReferralCoupon,
  ShippingType,
  StoreCartItem,
  StoreInboxMessage,
  StoreOrder,
  StoreProduct,
  StoreReferral,
  StoreTenant,
  SubscriptionPayment,
  SubscriptionPaymentMethod,
} from '../types';
import {
  compressImageFileToDataURL,
  createStoreOrderInCloud,
  DEFAULT_BILLING_SETTINGS,
  deleteStoreProduct,
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
  registerStoreTenant,
  resolveReferralCode,
  saveStoreProduct,
  signInWithGoogleAccount,
  signOutAccount,
  StoreProductInput,
  submitSubscriptionPayment,
  subscribeOwnerCoupons,
  subscribeOwnerPayments,
  subscribeOwnerReferrals,
  subscribeOwnerStoreOrders,
  subscribeOwnerStoreProducts,
  subscribeOwnerStores,
  subscribeStoreInbox,
  updateStoreOrderStatus,
  updateStoreTenantByOwner,
} from '../services/saasService';
import {
  exportStoreOrderInvoicePDF,
  exportStoreSalesLedgerPDF,
} from '../utils/pdfExport';
import { useLanguage } from '../i18n/LanguageContext';

interface MerchantPortalProps {
  exchangeRate: number;
  initialReferralCode?: string;
  onClearCapturedReferral?: () => void;
  onOpenStorefront: (slug: string) => void;
  onOpenWarehouseApp?: () => void;
}

export const MerchantPortal: React.FC<MerchantPortalProps> = ({
  exchangeRate,
  initialReferralCode = '',
  onClearCapturedReferral,
  onOpenStorefront,
  onOpenWarehouseApp,
}) => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [stores, setStores] = useState<StoreTenant[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isCreatingNewStore, setIsCreatingNewStore] = useState(false);

  const [billing, setBilling] = useState<PlatformBillingSettings>(DEFAULT_BILLING_SETTINGS);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [referrals, setReferrals] = useState<StoreReferral[]>([]);
  const [coupons, setCoupons] = useState<ReferralCoupon[]>([]);
  const [inboxMessages, setInboxMessages] = useState<StoreInboxMessage[]>([]);

  const [activeTab, setActiveTab] = useState<
    'catalog' | 'billing' | 'orders' | 'referrals' | 'inbox' | 'settings'
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
  const [payRef, setPayRef] = useState('');
  const [payPayerInfo, setPayPayerInfo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');

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

  useEffect(() => {
    getPlatformBillingSettings().then(setBilling);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName && !regOwnerName) {
        setRegOwnerName(u.displayName);
      }
    });
    return () => unsub();
  }, [regOwnerName]);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setStores([]);
      setPayments([]);
      setReferrals([]);
      setCoupons([]);
      return;
    }
    const unsubStores = subscribeOwnerStores(user.uid, (list) => {
      setStores(list);
      if (list.length > 0 && !selectedStoreId) {
        setSelectedStoreId(list[0].id);
      }
    });
    const unsubPays = subscribeOwnerPayments(user.uid, setPayments);
    const unsubRefs = subscribeOwnerReferrals(user.uid, setReferrals);
    const unsubCoups = subscribeOwnerCoupons(user.uid, setCoupons);
    return () => {
      unsubStores();
      unsubPays();
      unsubRefs();
      unsubCoups();
    };
  }, [user, selectedStoreId]);

  const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;

  useEffect(() => {
    if (!activeStore || !user) {
      setProducts([]);
      setOrders([]);
      setInboxMessages([]);
      return;
    }
    const unsubProds = subscribeOwnerStoreProducts(activeStore.id, user.uid, setProducts);
    const unsubOrds = subscribeOwnerStoreOrders(activeStore.id, user.uid, setOrders);
    const unsubInbox = subscribeStoreInbox(activeStore.id, user.uid, setInboxMessages);

    if (!activeStore.referralCode) {
      ensureStoreReferralCode(activeStore).catch(() => {});
    }

    return () => {
      unsubProds();
      unsubOrds();
      unsubInbox();
    };
  }, [activeStore, user]);

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

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeStore) return;
    if (netSubscriptionUSD > 0 && !payRef.trim()) return;
    setIsBusy(true);
    try {
      await submitSubscriptionPayment(user, activeStore, {
        amountUSD: baseSubscriptionUSD,
        paymentMethod: payMethod,
        referenceNumber:
          netSubscriptionUSD === 0 && selectedCoupon ? selectedCoupon.code : payRef,
        payerInfo: payPayerInfo,
        notes: payNotes,
        coupon: selectedCoupon,
      });
      setPayRef('');
      setPayPayerInfo('');
      setPayNotes('');
      setSelectedCouponId('');
      notify(
        selectedCoupon && netSubscriptionUSD === 0
          ? `Renovación con Cupón ${selectedCoupon.code} enviada al Administrador para verificación.`
          : 'Pago reportado al Administrador (empresaalhadiqainvest@gmail.com). Tu cuenta será activada manualmente tras verificar la referencia.'
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error enviando comprobante.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeStore) return;
    setIsBusy(true);
    try {
      await saveStoreProduct(
        activeStore.id,
        user.uid,
        {
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
        },
        editingProduct || undefined
      );
      setEditingProduct(null);
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdCost('');
      setProdRating('5');
      setProdImage('');
      setProdSku('');
      setProdStock('15');
      notify('Producto guardado en el catálogo de tu tienda.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error guardando producto.');
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
    if (!user || !activeStore || directCart.length === 0) return;
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
      const savedOrder = await createStoreOrderInCloud(
        user,
        activeStore,
        {
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
          saleChannel: 'Venta Directa Tienda',
        },
        snapshot,
        { initialStatus: 'completed', deductStockImmediately: true }
      );

      exportStoreOrderInvoicePDF(activeStore, savedOrder, snapshot, 'dual');
      setDirectCart([]);
      setSaleCustomerName('');
      setSaleCustomerRif('');
      setSaleCustomerPhone('');
      setSaleShippingDetails('');
      setShowDirectSaleModal(false);
      notify(
        `Venta #${savedOrder.invoiceNumber} registrada en ${activeStore.storeName}, stock descontado y Factura Dual (Cliente + Dueño) generada.`
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'No se pudo registrar la venta directa.');
    } finally {
      setIsBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Unauthenticated Google Gate
  // ---------------------------------------------------------------------------
  if (!user) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
          <button
            onClick={() => signInWithGoogleAccount()}
            className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-zinc-950 font-bold text-sm inline-flex items-center gap-3 shadow-xl transition-transform hover:scale-[1.02] min-h-[48px]"
          >
            <span>{t.merchant.gateBtn}</span>
          </button>
          <p className="text-[11px] text-zinc-400">
            {t.merchant.gateFooter}
          </p>
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
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111114] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full" />
            )}
            <div>
              <div className="text-sm font-bold text-white">{user.displayName || user.email}</div>
              <div className="text-xs text-zinc-400">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeStore && (
              <button
                onClick={() => setIsCreatingNewStore(false)}
                className="px-3 py-2 rounded-lg bg-zinc-900 text-xs text-white"
              >
                {t.common.cancel}
              </button>
            )}
            <button
              onClick={() => signOutAccount()}
              className="px-3 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-zinc-300 flex items-center gap-1.5"
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
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Registered Store Dashboard
  // ---------------------------------------------------------------------------
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Merchant Header & Store Selector */}
      <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-white font-display">
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
              {t.merchant.ownerPrefix}: {activeStore.registeredOwnerName} · RIF: {activeStore.rif || t.merchant.noRif} ·{' '}
              {user.email}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stores.length > 1 && (
            <select
              value={activeStore.id}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-white"
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
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[38px]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.merchant.viewPublicStore}</span>
            </button>
          )}
          {(activeStore.warehousePosEnabled || billing.warehousePosEnabled) && onOpenWarehouseApp && (
            <button
              onClick={onOpenWarehouseApp}
              className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 min-h-[38px]"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{t.merchant.openWarehousePos}</span>
            </button>
          )}
          <button
            onClick={() => setIsCreatingNewStore(true)}
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-white flex items-center gap-1 min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.merchant.newStore}</span>
          </button>
          <button
            onClick={() => signOutAccount()}
            className="px-3 py-2 rounded-lg bg-[#09090b] border border-white/[0.1] text-xs text-zinc-300 flex items-center gap-1 min-h-[38px]"
          >
            <LogOut className="w-3.5 h-3.5" />
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
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        {[
          { id: 'billing', label: t.merchant.tabBilling, icon: CreditCard },
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
          { id: 'settings', label: t.merchant.tabSettings, icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors min-h-[42px] ${
                active
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-[#111114] border border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BILLING / $25 SUBSCRIPTION */}
      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#111114] border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white font-display">
                  {t.merchant.paymentMethodsTitle} ${billing.monthlyPriceUSD}/mo
                </h2>
                <span className="font-mono text-xs text-amber-300">
                  ≈ {(billing.monthlyPriceUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { title: t.merchant.bankTransfers, value: billing.bankTransfers },
                  { title: t.merchant.pagoMovil, value: billing.pagoMovil },
                  { title: t.merchant.binancePay, value: billing.binancePay },
                  { title: t.merchant.bybitPay, value: billing.bybitPay },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="bg-[#09090b] border border-white/[0.08] rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400">{item.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(item.value);
                          notify(`${item.title} - ${t.common.copied}`);
                        }}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{t.common.copy}</span>
                      </button>
                    </div>
                    <p className="text-zinc-300 whitespace-pre-line">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">{t.merchant.methodUsed}</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as SubscriptionPaymentMethod)}
                      className="w-full px-3 py-2.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-white"
                    >
                      <option value="Pago Móvil">Pago Móvil (Bs.)</option>
                      <option value="Transferencia Bancaria">Transferencia Bancaria VE</option>
                      <option value="Binance Pay">Binance Pay (USDT)</option>
                      <option value="Bybit">Bybit Pay</option>
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
              )}
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

            {/* Payments History */}
            <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">{t.merchant.paymentsHistory}</h3>
              {payments.length === 0 ? (
                <p className="text-xs text-zinc-500">{t.merchant.noPaymentsYet}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#09090b] border border-white/[0.08] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {p.paymentMethod} · Ref: {p.referenceNumber}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          ${p.amountUSD} USD · {p.storeName}
                          {p.couponCode ? ` · 🎟 ${p.couponCode} (-$${p.discountUSD ?? 0})` : ''}
                        </div>
                      </div>
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
                  ))}
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
              className="lg:col-span-5 bg-[#111114] border border-white/[0.08] rounded-2xl p-5 space-y-3 h-fit"
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
            <div className="lg:col-span-7 space-y-3">
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
                        href={`https://wa.me/${ord.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
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
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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
                        <select
                          value={salePaymentMethod}
                          onChange={(e) => setSalePaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 bg-[#09090b] border border-white/[0.1] rounded-lg text-white"
                        >
                          <option value="Pago Móvil">Pago Móvil (Bs.)</option>
                          <option value="Efectivo USD">Efectivo USD</option>
                          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                          <option value="Binance Pay">Binance Pay (USDT)</option>
                          <option value="Bybit">Bybit Pay</option>
                          <option value="Zelle">Zelle</option>
                        </select>
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
    </section>
  );
};
