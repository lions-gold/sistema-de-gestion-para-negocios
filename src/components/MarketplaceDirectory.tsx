import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Store,
  Search,
  ShoppingCart,
  Star,
  Truck,
  Bike,
  MapPin,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  FileText,
  MessageCircle,
  CheckCircle2,
  Share2,
  ShieldCheck,
  UserCheck,
  Package,
  Copy,
  Check,
  Ruler,
  Eye,
  X,
  Tag,
  Wallet,
  Globe,
  Video,
  QrCode,
  Maximize2,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  GuideVideoAudience,
  ShippingType,
  StoreCartItem,
  StoreOrder,
  StorePaymentMethod,
  StoreProduct,
  StoreTenant,
} from '../types';
import {
  createStoreOrderInCloud,
  fetchStoreByIdOrSlug,
  signInWithGoogleAccount,
  subscribeActiveStores,
  subscribePublicStorePaymentMethods,
  subscribePublicStoreProducts,
} from '../services/saasService';
import { mapGoogleAuthError } from '../services/authService';
import { GoogleAuthButton } from './GoogleAuthButton';
import { QrZoomModal } from './QrCodeModalAndField';
import { StoreQrShareModal } from './StoreQrShareModal';
import { exportStoreOrderInvoicePDF } from '../utils/pdfExport';
import { useLanguage } from '../i18n/LanguageContext';
import { normalizeVenezuelanPhone } from '../utils/venezuelaTime';
import {
  buildCartLineKey,
  isFashionOrApparelCategory,
  normalizeSizeList,
} from '../utils/clothingSizes';
import {
  buildSocialShareIntents,
  getSocialPlatformEntries,
  getStoreShareUrl,
  getStoreSubdomainDisplay,
  normalizeStoreSubdomainSlug,
} from '../utils/socialLinks';
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateCommonPaymentInstruction,
  translateDeliveryZoneLabel,
  translatePaymentMethodLabel,
  translateShippingTypeLabel,
  translateSizeTokenLabel,
  translateUnitLabel,
} from '../utils/platformLabelsI18n';
import fashionBoutiqueImg from '../assets/images/fashion_boutique_showcase_1795218110948.jpg';
import editorialStorefrontImg from '../assets/images/editorial_storefront_showcase_1795218110469.jpg';
import {
  applyOfflineOrderStockToCache,
  createLocalOfflineOrderSnapshot,
  isAppEffectivelyOffline,
  isNetworkOrOfflineError,
  loadCachedStorePaymentMethods,
  loadCachedStoreProducts,
  loadCachedStores,
  queueOfflineMutation,
  saveCachedStorePaymentMethods,
  saveCachedStoreProducts,
  saveCachedStores,
} from '../services/offlineSyncService';
import {
  checkSubmissionCooldown,
  isHoneypotTriggered,
  isTooFastSubmission,
  recordSubmissionTimestamp,
} from '../utils/antiBotGuard';

interface MarketplaceDirectoryProps {
  exchangeRate: number;
  initialStoreSlug?: string;
  onNavigateMerchant: () => void;
  onOpenVideoGuides?: (audience?: GuideVideoAudience) => void;
  onActiveStoreChange?: (store: StoreTenant | null, products: StoreProduct[]) => void;
  onVectorContextChange?: (ctx: {
    store: StoreTenant | null;
    products: StoreProduct[];
    cart: StoreCartItem[];
    addToCart: (p: StoreProduct) => void;
    openCart: () => void;
  }) => void;
}

const CARTS_STORAGE_KEY = 'smith_saas_store_carts_v1';
const EMPTY_STORE_CART: StoreCartItem[] = [];

export const MarketplaceDirectory: React.FC<MarketplaceDirectoryProps> = ({
  exchangeRate,
  initialStoreSlug,
  onNavigateMerchant,
  onOpenVideoGuides,
  onActiveStoreChange,
  onVectorContextChange,
}) => {
  const { lang, t, tr } = useLanguage();
  const [stores, setStores] = useState<StoreTenant[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreTenant | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [storePaymentMethods, setStorePaymentMethods] = useState<StorePaymentMethod[]>([]);
  const [copiedPaymentDetails, setCopiedPaymentDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<string>('all');
  const [productQuery, setProductQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productSizeFilter, setProductSizeFilter] = useState<string>('all');
  const [selectedSizesByProduct, setSelectedSizesByProduct] = useState<Record<string, string>>({});
  const [quickViewProduct, setQuickViewProduct] = useState<StoreProduct | null>(null);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [copiedSubdomainSlug, setCopiedSubdomainSlug] = useState(false);
  const [zoomQrData, setZoomQrData] = useState<{
    qrUrl: string;
    title: string;
    subtitle?: string;
    accountDetails?: string;
  } | null>(null);
  const [qrShareStore, setQrShareStore] = useState<StoreTenant | null>(null);

  // Per-store isolated shopping carts persisted in localStorage
  const [cartsByStore, setCartsByStore] = useState<Record<string, StoreCartItem[]>>(() => {
    try {
      const stored = localStorage.getItem(CARTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout state
  const [customerName, setCustomerName] = useState('');
  const [customerRif, setCustomerRif] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pago Móvil');
  const [shippingType, setShippingType] = useState<ShippingType>('Retiro en Tienda');
  const [shippingDetails, setShippingDetails] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [botTrapWebsite, setBotTrapWebsite] = useState('');
  const checkoutMountedAtRef = useRef<number>(Date.now());
  const [completedOrder, setCompletedOrder] = useState<{
    order: StoreOrder;
    items: StoreCartItem[];
    store: StoreTenant;
    registeredInCloud: boolean;
  } | null>(null);

  useEffect(() => {
    if (isCartOpen) {
      checkoutMountedAtRef.current = Date.now();
    }
  }, [isCartOpen]);

  const storeReputation = useMemo(() => {
    const rated = products.filter((p) => typeof p.rating === 'number' && p.rating > 0);
    if (rated.length === 0) return null;
    const avg =
      rated.reduce((sum, p) => sum + Number(p.rating || 5), 0) / rated.length;
    return {
      avg: Math.min(5, Math.max(1, avg)).toFixed(1),
      count: rated.length,
    };
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(CARTS_STORAGE_KEY, JSON.stringify(cartsByStore));
    } catch {
      // ignore quota errors
    }
  }, [cartsByStore]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName) setCustomerName((prev) => prev || u.displayName || '');
      if (u?.email) setCustomerEmail((prev) => prev || u.email || '');
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    // Hydrate cached active stores immediately so offline browsing works smoothly
    const cached = loadCachedStores();
    if (cached.length > 0) {
      setStores((prev) => (prev.length === 0 ? cached : prev));
    }

    const unsub = subscribeActiveStores((activeList) => {
      setStores(activeList);
      saveCachedStores(activeList);
    });
    return () => unsub();
  }, []);

  // Resolve initialStoreSlug if provided
  useEffect(() => {
    if (!initialStoreSlug) return;
    const cleanTarget = normalizeStoreSubdomainSlug(initialStoreSlug.replace(/^@/, ''));
    const match = stores.find(
      (s) =>
        s.slug === initialStoreSlug ||
        (cleanTarget && normalizeStoreSubdomainSlug(s.slug) === cleanTarget) ||
        s.id === initialStoreSlug ||
        (cleanTarget && s.id.toLowerCase() === cleanTarget)
    );
    if (match) {
      setSelectedStore(match);
    } else if (!isAppEffectivelyOffline()) {
      fetchStoreByIdOrSlug(cleanTarget || initialStoreSlug).then((found) => {
        if (found && found.status === 'active') setSelectedStore(found);
      });
    }
  }, [initialStoreSlug, stores]);

  // Subscribe to selected store's active products and configured payment methods (with offline cache)
  useEffect(() => {
    if (!selectedStore) {
      setProducts([]);
      setStorePaymentMethods([]);
      return;
    }
    if (selectedStore.nationalShippingEnabled) {
      setShippingType('Envío Nacional');
    } else if (selectedStore.localDeliveryEnabled) {
      setShippingType('Delivery Local');
    } else {
      setShippingType('Retiro en Tienda');
    }

    const cachedProds = loadCachedStoreProducts(selectedStore.id);
    if (cachedProds.length > 0) {
      setProducts(cachedProds);
    }
    const cachedPay = loadCachedStorePaymentMethods(selectedStore.id);
    if (cachedPay.length > 0) {
      setStorePaymentMethods(cachedPay);
      setPaymentMethod(cachedPay[0].name);
    } else {
      setStorePaymentMethods([]);
      setPaymentMethod('Pago Móvil');
    }

    const unsub = subscribePublicStoreProducts(selectedStore.id, (list) => {
      setProducts(list);
      saveCachedStoreProducts(selectedStore.id, list);
    });
    const unsubPay = subscribePublicStorePaymentMethods(selectedStore.id, (list) => {
      setStorePaymentMethods(list);
      saveCachedStorePaymentMethods(selectedStore.id, list);
      if (list.length > 0) {
        setPaymentMethod((prev) =>
          list.some((m) => m.name === prev) ? prev : list[0].name
        );
      }
    });
    return () => {
      unsub();
      unsubPay();
    };
  }, [selectedStore]);

  // Reset product-level filters when switching stores
  useEffect(() => {
    setProductQuery('');
    setProductCategoryFilter('all');
    setProductSizeFilter('all');
    setSelectedSizesByProduct({});
    setQuickViewProduct(null);
  }, [selectedStore?.id]);

  const storeCategories = useMemo(() => {
    const map = new Map<string, string>();
    stores.forEach((s) => {
      const cat = (s.category || '').trim();
      if (cat && !map.has(cat.toLowerCase())) {
        map.set(cat.toLowerCase(), cat);
      }
    });
    return Array.from(map.values());
  }, [stores]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stores.filter((s) => {
      if (storeCategoryFilter !== 'all') {
        const sc = (s.category || '').trim().toLowerCase();
        if (sc !== storeCategoryFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      const localizedCat = translateCategoryLabel(s.category, lang).toLowerCase();
      return (
        s.storeName.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        localizedCat.includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        s.registeredOwnerName.toLowerCase().includes(q)
      );
    });
  }, [stores, searchQuery, storeCategoryFilter, lang]);

  const productCategories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      const cat = (p.category || '').trim();
      if (cat && !map.has(cat.toLowerCase())) {
        map.set(cat.toLowerCase(), cat);
      }
    });
    return Array.from(map.values());
  }, [products]);

  const availableStoreSizes = useMemo(() => {
    const allSizes: string[] = [];
    products.forEach((p) => {
      normalizeSizeList(p.availableSizes).forEach((sz) => allSizes.push(sz));
    });
    return normalizeSizeList(allSizes);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (productCategoryFilter !== 'all') {
        if ((p.category || '').trim().toLowerCase() !== productCategoryFilter.toLowerCase()) {
          return false;
        }
      }
      if (productSizeFilter !== 'all') {
        const pSizes = normalizeSizeList(p.availableSizes).map((s) => s.toLowerCase());
        if (!pSizes.includes(productSizeFilter.toLowerCase())) {
          return false;
        }
      }
      if (!q) return true;
      const localizedCat = translateCategoryLabel(p.category, lang).toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        localizedCat.includes(q) ||
        normalizeSizeList(p.availableSizes).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [products, productQuery, productCategoryFilter, productSizeFilter, lang]);

  const activeCart = useMemo(() => {
    if (!selectedStore) return EMPTY_STORE_CART;
    return cartsByStore[selectedStore.id] || EMPTY_STORE_CART;
  }, [selectedStore, cartsByStore]);

  const cartItemCount = activeCart.reduce((acc, i) => acc + i.quantity, 0);
  const cartSubtotalUSD = activeCart.reduce(
    (acc, i) => acc + i.product.priceUSD * i.quantity,
    0
  );

  const shippingFeeUSD = useMemo(() => {
    if (!selectedStore) return 0;
    if (shippingType === 'Delivery Local' && selectedStore.localDeliveryEnabled) {
      return selectedStore.localDeliveryFeeUSD || 0;
    }
    return 0;
  }, [selectedStore, shippingType]);

  const totalUSD = cartSubtotalUSD + shippingFeeUSD;
  const totalBs = totalUSD * exchangeRate;

  const getProductQtyInCart = (productId: string, cart: StoreCartItem[]) =>
    cart.reduce((sum, item) => (item.product.id === productId ? sum + item.quantity : sum), 0);

  const resolveChosenSize = (product: StoreProduct, explicitSize?: string): string | undefined => {
    const sizes = normalizeSizeList(product.availableSizes);
    if (sizes.length === 0) return undefined;
    if (explicitSize && sizes.some((s) => s.toLowerCase() === explicitSize.toLowerCase())) {
      return sizes.find((s) => s.toLowerCase() === explicitSize.toLowerCase()) || sizes[0];
    }
    const picked = selectedSizesByProduct[product.id];
    if (picked && sizes.some((s) => s.toLowerCase() === picked.toLowerCase())) {
      return sizes.find((s) => s.toLowerCase() === picked.toLowerCase()) || sizes[0];
    }
    return sizes[0];
  };

  const addToCart = (product: StoreProduct, explicitSize?: string) => {
    if (!selectedStore) return;
    const chosenSize = resolveChosenSize(product, explicitSize);
    const targetKey = buildCartLineKey(product.id, chosenSize);

    setCartsByStore((prev) => {
      const current = prev[selectedStore.id] || [];
      const totalForProduct = getProductQtyInCart(product.id, current);
      const maxStock = product.stock > 0 ? product.stock : 999;
      if (totalForProduct >= maxStock) return prev;

      const existing = current.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === targetKey
      );
      if (existing) {
        return {
          ...prev,
          [selectedStore.id]: current.map((i) =>
            buildCartLineKey(i.product.id, i.selectedSize) === targetKey
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...prev,
        [selectedStore.id]: [
          ...current,
          { product, quantity: 1, ...(chosenSize ? { selectedSize: chosenSize } : {}) },
        ],
      };
    });
  };

  const updateCartQty = (productId: string, delta: number, selectedSize?: string) => {
    if (!selectedStore) return;
    const targetKey = buildCartLineKey(productId, selectedSize);
    setCartsByStore((prev) => {
      const current = prev[selectedStore.id] || [];
      const line = current.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === targetKey
      );
      if (!line) return prev;

      const totalOtherLines = current.reduce(
        (sum, i) =>
          i.product.id === productId &&
          buildCartLineKey(i.product.id, i.selectedSize) !== targetKey
            ? sum + i.quantity
            : sum,
        0
      );
      const maxAllowedForLine =
        line.product.stock > 0 ? Math.max(0, line.product.stock - totalOtherLines) : 999;

      const next = current
        .map((i) => {
          if (buildCartLineKey(i.product.id, i.selectedSize) !== targetKey) return i;
          return { ...i, quantity: Math.min(maxAllowedForLine, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0);
      return { ...prev, [selectedStore.id]: next };
    });
  };

  const changeCartItemSize = (productId: string, oldSize: string | undefined, newSize: string) => {
    if (!selectedStore) return;
    const oldKey = buildCartLineKey(productId, oldSize);
    const newKey = buildCartLineKey(productId, newSize);
    if (oldKey === newKey) return;

    setCartsByStore((prev) => {
      const current = prev[selectedStore.id] || [];
      const source = current.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === oldKey
      );
      if (!source) return prev;
      const targetExists = current.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === newKey
      );
      let next: StoreCartItem[];
      if (targetExists) {
        next = current
          .filter((i) => buildCartLineKey(i.product.id, i.selectedSize) !== oldKey)
          .map((i) =>
            buildCartLineKey(i.product.id, i.selectedSize) === newKey
              ? { ...i, quantity: i.quantity + source.quantity }
              : i
          );
      } else {
        next = current.map((i) =>
          buildCartLineKey(i.product.id, i.selectedSize) === oldKey
            ? { ...i, selectedSize: newSize }
            : i
        );
      }
      return { ...prev, [selectedStore.id]: next };
    });
  };

  const clearStoreCart = () => {
    if (!selectedStore) return;
    setCartsByStore((prev) => ({ ...prev, [selectedStore.id]: [] }));
  };

  const onVectorContextRef = React.useRef(onVectorContextChange);
  onVectorContextRef.current = onVectorContextChange;
  const onActiveStoreChangeRef = React.useRef(onActiveStoreChange);
  onActiveStoreChangeRef.current = onActiveStoreChange;

  const addToCartRef = React.useRef(addToCart);
  addToCartRef.current = addToCart;
  const stableAddToCart = React.useCallback((p: StoreProduct) => addToCartRef.current(p), []);
  const stableOpenCart = React.useCallback(() => setIsCartOpen(true), []);

  useEffect(() => {
    onActiveStoreChangeRef.current?.(selectedStore, products);
  }, [selectedStore, products]);

  useEffect(() => {
    onVectorContextRef.current?.({
      store: selectedStore,
      products,
      cart: activeCart,
      addToCart: stableAddToCart,
      openCart: stableOpenCart,
    });
  }, [selectedStore, products, activeCart, stableAddToCart, stableOpenCart]);

  const buildWhatsappOrderLink = (
    store: StoreTenant,
    order: StoreOrder,
    items: StoreCartItem[]
  ) => {
    const cleanPhone = normalizeVenezuelanPhone(store.businessWhatsapp);
    const lines = [
      `*${tr('NUEVO PEDIDO', 'NEW ORDER', '新订单')} #${order.invoiceNumber}*`,
      `*${tr('Tienda:', 'Store:', '店铺：')}* ${store.storeName}`,
      `*${tr('Titular:', 'Owner:', '店主：')}* ${store.registeredOwnerName}${store.rif ? ` (${tr('RIF', 'Tax ID', '税号')}: ${store.rif})` : ''}`,
      ``,
      `*${tr('Cliente:', 'Customer:', '买家：')}* ${order.customerName}`,
      `*${tr('C.I./RIF:', 'ID/Tax ID:', '证件/税号：')}* ${order.customerRif || 'N/A'}`,
      `*${tr('Teléfono:', 'Phone:', '电话：')}* ${order.customerPhone}`,
      ``,
      `*${tr('Productos:', 'Items:', '商品清单：')}*`,
      ...items.map(
        (i) =>
          `• ${i.quantity}x ${i.product.name}${i.selectedSize ? ` [${tr('Talla:', 'Size:', '尺码：')} ${translateSizeTokenLabel(i.selectedSize, lang)}]` : ''} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`
      ),
      ``,
      `*${tr('Entrega:', 'Delivery:', '配送方式：')}* ${translateShippingTypeLabel(order.shippingType, lang)}${order.shippingDetails ? ` (${order.shippingDetails})` : ''}`,
      `*${tr('Envío:', 'Shipping:', '运费：')}* $${order.shippingFeeUSD.toFixed(2)} USD`,
      `*${tr('Método de Pago:', 'Payment Method:', '付款方式：')}* ${translatePaymentMethodLabel(order.paymentMethod, lang)}`,
      `*${tr('TOTAL:', 'TOTAL:', '总计：')}* $${order.totalUSD.toFixed(2)} USD (${order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.)`,
      ``,
      `_${tr('Pedido generado desde Smith Solutions E-Commerce', 'Order generated via Smith Solutions E-Commerce', '订单生成自 Smith Solutions E-Commerce')}_`,
    ].join('\n');

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
  };

  const handleFinalizeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || activeCart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) return;

    if (isHoneypotTriggered(botTrapWebsite)) {
      setOrderError(
        tr(
          'Solicitud bloqueada por protección anti-bot.',
          'Request blocked by anti-bot protection.',
          '请求已被反机器人保护拦截。'
        )
      );
      return;
    }

    if (isTooFastSubmission(checkoutMountedAtRef.current, 600)) {
      setOrderError(
        tr(
          'Espera un momento antes de confirmar tu pedido.',
          'Please wait a moment before confirming your order.',
          '请稍候再确认订单。'
        )
      );
      return;
    }

    const cooldown = checkSubmissionCooldown('marketplace_checkout', 8000, 20);
    if (!cooldown.allowed) {
      setOrderError(
        tr(
          `Espera ${cooldown.waitSeconds}s antes de enviar otro pedido.`,
          `Please wait ${cooldown.waitSeconds}s before submitting another order.`,
          `请等待 ${cooldown.waitSeconds} 秒后再提交新订单。`
        )
      );
      return;
    }

    setOrderError(null);
    setIsSubmittingOrder(true);
    recordSubmissionTimestamp('marketplace_checkout');
    try {
      const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`;
      const itemsSummary = activeCart
        .map(
          (i) =>
            `${i.quantity}x ${i.product.name}${i.selectedSize ? ` [Talla: ${i.selectedSize}]` : ''} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`
        )
        .join(' | ')
        .slice(0, 1950);

      const snapshotItems = [...activeCart];
      const baseOrderInput = {
        invoiceNumber,
        customerName: customerName.trim(),
        customerRif: customerRif.trim() || undefined,
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || user?.email || undefined,
        shippingType,
        shippingDetails: shippingDetails.trim() || undefined,
        shippingFeeUSD,
        paymentMethod,
        subtotalUSD: cartSubtotalUSD,
        totalUSD,
        totalBs,
        exchangeRate,
        itemsSummary,
        saleChannel: 'Carrito Web' as const,
      };

      const isOfflineNow = isAppEffectivelyOffline();
      const saveOfflineMarketplaceOrder = () => {
        queueOfflineMutation({
          type: 'marketplace_order',
          label: `Pedido #${invoiceNumber} (${selectedStore.storeName})`,
          payload: {
            store: selectedStore,
            orderInput: baseOrderInput,
            items: snapshotItems,
          },
        });
        const updatedCatalog = applyOfflineOrderStockToCache(selectedStore.id, snapshotItems);
        if (updatedCatalog.length > 0) {
          setProducts(updatedCatalog);
        }
        const localOrder = createLocalOfflineOrderSnapshot(
          selectedStore,
          baseOrderInput,
          snapshotItems
        );
        setCompletedOrder({
          order: localOrder,
          items: snapshotItems,
          store: selectedStore,
          registeredInCloud: false,
        });
        exportStoreOrderInvoicePDF(selectedStore, localOrder, snapshotItems, 'dual', lang);
        clearStoreCart();
        setIsCartOpen(false);
      };

      if (isOfflineNow) {
        saveOfflineMarketplaceOrder();
        return;
      }

      let activeUser = user;
      if (!activeUser || !activeUser.emailVerified) {
        try {
          activeUser = await signInWithGoogleAccount();
          setUser(activeUser);
        } catch (authErr) {
          const friendly = mapGoogleAuthError(authErr);
          if (friendly.code === 'auth/redirect-initiated') {
            return;
          }
          setOrderError(
            friendly.hint ? `${friendly.message} ${friendly.hint}` : friendly.message || t.marketplace.errLoginRequired
          );
          setIsSubmittingOrder(false);
          return;
        }
      }

      if (!activeUser || !activeUser.emailVerified) {
        setOrderError(t.marketplace.errEmailUnverified);
        setIsSubmittingOrder(false);
        return;
      }

      try {
        const savedOrder = await createStoreOrderInCloud(
          activeUser,
          selectedStore,
          {
            ...baseOrderInput,
            customerEmail: baseOrderInput.customerEmail || activeUser.email || undefined,
          },
          snapshotItems
        );

        setCompletedOrder({
          order: savedOrder,
          items: snapshotItems,
          store: selectedStore,
          registeredInCloud: true,
        });

        // Genera el PDF Dual: Página 1 Factura Original Cliente + Página 2 Factura Copia Dueño de Tienda
        exportStoreOrderInvoicePDF(selectedStore, savedOrder, snapshotItems, 'dual', lang);
        clearStoreCart();
        setIsCartOpen(false);
      } catch (cloudErr) {
        if (isNetworkOrOfflineError(cloudErr)) {
          saveOfflineMarketplaceOrder();
          return;
        }
        throw cloudErr;
      }
    } catch (err) {
      console.error('Error procesando orden:', err);
      setOrderError(
        err instanceof Error
          ? `${t.marketplace.errOrderFailed}: ${err.message}`
          : t.marketplace.errOrderFailed
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const getShippingTypeLabel = (type: ShippingType) =>
    type === 'Envío Nacional'
      ? t.marketplace.nationalShipping
      : type === 'Delivery Local'
        ? t.marketplace.localDelivery
        : t.marketplace.localPickup;

  const renderStars = (rating: number) => {
    const rounded = Math.round(Math.max(1, Math.min(5, rating || 5)));
    return (
      <div
        className="flex items-center gap-0.5"
        title={tr(
          `${rating.toFixed(1)} de 5 estrellas`,
          `${rating.toFixed(1)} out of 5 stars`,
          `${rating.toFixed(1)} / 5 星评价`
        )}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`w-3.5 h-3.5 ${
              n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
            }`}
          />
        ))}
        <span className="ml-1 text-[11px] font-mono text-zinc-400 tabular-nums">
          {Number(rating || 5).toFixed(1)}
        </span>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Storefront Detail View (Selected Store)
  // ---------------------------------------------------------------------------
  if (selectedStore) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 w-full min-w-0">
        {/* Back & Share Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              setSelectedStore(null);
              setIsCartOpen(false);
              setCompletedOrder(null);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-amber-500/40 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{t.marketplace.backToDir}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const shareUrl = getStoreShareUrl(selectedStore.slug, 'live_at');
              const subdomainLabel = getStoreSubdomainDisplay(selectedStore.slug);
              const shareIntents = buildSocialShareIntents(shareUrl, selectedStore.storeName);
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(shareUrl);
                      setCopiedSlug(true);
                      setTimeout(() => setCopiedSlug(false), 2000);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-amber-500/40 text-xs text-zinc-200 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  >
                    {copiedSlug ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{copiedSlug ? t.marketplace.linkCopied : t.marketplace.copyStoreLink}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrShareStore(selectedStore)}
                    className="px-3 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-300 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                    title={tr('Generar QR personalizado para redes sociales', 'Generate custom QR for social sharing', '生成店铺社交分享二维码')}
                  >
                    <QrCode className="w-3.5 h-3.5 shrink-0" />
                    <span>{tr('QR Tienda', 'Store QR', '店铺二维码')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(subdomainLabel);
                      setCopiedSubdomainSlug(true);
                      setTimeout(() => setCopiedSubdomainSlug(false), 2000);
                    }}
                    className="hidden sm:inline-flex px-3 py-2 rounded-lg bg-[#111114] border border-amber-500/25 hover:border-amber-400/50 text-xs text-amber-300 font-mono items-center gap-1.5 min-h-[44px] cursor-pointer"
                    title={tr('Copiar dirección tipo subdominio', 'Copy subdomain address', '复制子域名链接')}
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[180px]">
                      {copiedSubdomainSlug ? tr('¡Subdominio copiado!', 'Copied!', '已复制!') : subdomainLabel}
                    </span>
                  </button>

                  <a
                    href={shareIntents.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 min-h-[44px]"
                    title={tr('Compartir en WhatsApp', 'Share on WhatsApp', '分享到 WhatsApp')}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">WA</span>
                  </a>
                  <a
                    href={shareIntents.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-sky-400/40 text-zinc-300 hover:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 min-h-[44px]"
                    title={tr('Compartir en Facebook', 'Share on Facebook', '分享到 Facebook')}
                  >
                    <span>FB</span>
                  </a>
                  <a
                    href={shareIntents.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-zinc-400 text-zinc-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 min-h-[44px]"
                    title={tr('Compartir en X', 'Share on X', '分享到 X')}
                  >
                    <span>X</span>
                  </a>
                </>
              );
            })()}

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 min-h-[44px] cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{t.marketplace.cartBtn} ({cartItemCount})</span>
              {cartItemCount > 0 && (
                <span className="font-mono bg-[#09090b]/20 px-1.5 py-0.5 rounded text-xs">
                  ${cartSubtotalUSD.toFixed(2)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Store Editorial Cover Hero Header */}
        {(() => {
          const isApparelStore =
            Boolean(selectedStore.clothingSizesEnabled) ||
            isFashionOrApparelCategory(selectedStore.category) ||
            availableStoreSizes.length > 0;
          const heroBackdrop = isApparelStore ? fashionBoutiqueImg : editorialStorefrontImg;
          return (
            <div className="relative overflow-hidden bg-[#111114] border border-white/[0.08] rounded-2xl min-w-0 shadow-2xl shadow-black/60">
              <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-[#09090b]">
                {!failedImageKeys[`store-hero-${selectedStore.id}`] ? (
                  <img
                    src={heroBackdrop}
                    alt={selectedStore.storeName}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImageKeys((prev) => ({
                        ...prev,
                        [`store-hero-${selectedStore.id}`]: true,
                      }))
                    }
                    className="w-full h-full object-cover object-center opacity-55"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-[#111114] to-[#09090b]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/65 to-transparent" />
                <div className="absolute top-3.5 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-amber-400 font-semibold uppercase tracking-wider">
                    {translateCategoryLabel(selectedStore.category, lang) || tr('Tienda Verificada', 'Verified Store', '认证店铺')}
                    {isApparelStore && availableStoreSizes.length > 0 && (
                      <span className="text-zinc-300">
                        {' '}· {tr(`${availableStoreSizes.length} tallas disponibles`, `${availableStoreSizes.length} sizes available`, `${availableStoreSizes.length} 种尺码可选`)}
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-300 tabular-nums">
                    {products.length} {tr('productos en catálogo', 'products in catalog', '件在售商品')}
                  </span>
                </div>
              </div>

              <div className="relative px-4 sm:px-6 pb-5 sm:pb-6 -mt-10 sm:-mt-12 flex flex-col md:flex-row md:items-end justify-between gap-5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0 flex-1">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#09090b] border-2 border-[#111114] ring-1 ring-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center shadow-xl">
                    {selectedStore.logoUrl && !failedImageKeys[`store-logo-${selectedStore.id}`] ? (
                      <img
                        src={selectedStore.logoUrl}
                        alt={selectedStore.storeName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImageKeys((prev) => ({
                            ...prev,
                            [`store-logo-${selectedStore.id}`]: true,
                          }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-9 h-9 text-amber-400" />
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 font-display tracking-tight break-words">
                        {selectedStore.storeName}
                      </h1>
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.marketplace.verifiedBadge}</span>
                      </span>
                      {storeReputation && (
                        <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-mono tabular-nums">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span>{storeReputation.avg}</span>
                          <span className="text-zinc-400 font-sans">({storeReputation.count})</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-sky-400 text-xs font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {tr('Checkout seguro', 'Verified checkout', '安全结账')}
                        </span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-300">
                      {t.marketplace.registeredTo}{' '}
                      <strong className="text-white">{selectedStore.registeredOwnerName}</strong>
                      {selectedStore.rif && (
                        <span className="ml-2 font-mono text-amber-300">· RIF {selectedStore.rif}</span>
                      )}
                    </p>

                    {selectedStore.description && (
                      <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                        {selectedStore.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono text-[11px]">
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span>/@{selectedStore.slug}</span>
                      </span>
                      {getSocialPlatformEntries(selectedStore.socialLinks).map((entry) => (
                        <a
                          key={entry.meta.key}
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#09090b] border border-white/[0.1] hover:border-amber-400/50 text-[11px] font-semibold text-zinc-200 hover:text-amber-300 transition-colors"
                          title={entry.displayHandle}
                        >
                          <span className="font-mono text-amber-400">{entry.meta.badgeText}</span>
                          <span>{entry.meta.label}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-zinc-400">
                      {selectedStore.nationalShippingEnabled && (
                        <span className="inline-flex items-center gap-1.5 text-zinc-300">
                          <Truck className="w-3.5 h-3.5 text-amber-400" />
                          {t.marketplace.nationalShipping} ({selectedStore.nationalCouriers || 'MRW / Zoom / Tealca'})
                        </span>
                      )}
                      {selectedStore.localDeliveryEnabled && (
                        <span className="inline-flex items-center gap-1.5 text-zinc-300 tabular-nums">
                          {selectedStore.nationalShippingEnabled && (
                            <span className="text-zinc-600" aria-hidden="true">·</span>
                          )}
                          <Bike className="w-3.5 h-3.5 text-emerald-400" />
                          {t.marketplace.localDelivery} (${(selectedStore.localDeliveryFeeUSD || 0).toFixed(2)} USD)
                        </span>
                      )}
                      {selectedStore.pickupEnabled && (
                        <span className="inline-flex items-center gap-1.5 text-zinc-300">
                          {(selectedStore.nationalShippingEnabled || selectedStore.localDeliveryEnabled) && (
                            <span className="text-zinc-600" aria-hidden="true">·</span>
                          )}
                          <MapPin className="w-3.5 h-3.5 text-sky-400" />
                          {t.marketplace.localPickup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${normalizeVenezuelanPhone(selectedStore.businessWhatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shrink-0 min-h-[44px] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t.marketplace.storeWhatsapp}</span>
                </a>
              </div>
            </div>
          );
        })()}

        {/* Storefront Buyer Clarity Bar (Payment Accounts + Rate + Quick How-To) */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs min-w-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100">
                {tr('Métodos de pago aceptados', 'Accepted payment methods', '本店支持的付款方式')}
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {storePaymentMethods.length > 0
                  ? storePaymentMethods
                      .map(
                        (m) =>
                          `${translatePaymentMethodLabel(m.name, lang)} (${m.currency}${m.qrImageUrl ? ' · QR' : ''})`
                      )
                      .join(' · ')
                  : tr(
                      'Pago Móvil, Transferencia, Binance Pay QR, Bybit QR, Zelle, Efectivo',
                      'Pago Móvil, Bank Transfer, Binance Pay QR, Bybit QR, Zelle, Cash',
                      'Pago Móvil、银行转账、Binance/Bybit 扫码、Zelle、现金'
                    )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 min-w-0">
            <ShoppingCart className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100">
                {tr('Cómo comprar aquí', 'How to buy here', '如何在此店下单购买')}
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                {tr(
                  'Elige artículo y talla, abre tu Carrito, selecciona entrega y descarga tu factura PDF.',
                  'Pick item & size, open Cart, choose delivery & payment, and get your PDF receipt.',
                  '挑选商品与尺码 → 打开购物车选择配送与付款方式 → 生成双联 PDF 发票并用 WhatsApp 确认。'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 min-w-0">
            <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100 tabular-nums">
                {tr('Tasa BCV:', 'Live BCV Rate:', 'BCV 实时汇率：')} {exchangeRate.toFixed(2)} Bs./USD
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                {tr(
                  'Navegas esta tienda en tu idioma elegido sin alterar la vista de otros compradores.',
                  'Browsing in your personal language without affecting other customers.',
                  '您正以个人选定的语言浏览本店，不会影响其他用户的界面语言。'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Completed Order Banner (Dual Invoice + Store Sales System Confirmation) */}
        {completedOrder && (
          <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    {t.marketplace.invoiceWord} #{completedOrder.order.invoiceNumber} {t.marketplace.orderBannerTitle} {completedOrder.store.storeName}
                  </span>
                </div>
                <p className="text-xs text-zinc-300">
                  {t.common.total}: ${completedOrder.order.totalUSD.toFixed(2)} USD (
                  {completedOrder.order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}{' '}
                  Bs.) · {getShippingTypeLabel(completedOrder.order.shippingType)} ·{' '}
                  {translatePaymentMethodLabel(completedOrder.order.paymentMethod, lang)}
                </p>
                {!completedOrder.registeredInCloud && (
                  <p className="text-[11px] font-mono text-amber-300">
                    {tr(
                      'Modo Offline: Factura PDF generada localmente y pedido guardado en cola para sincronizar automáticamente al volver internet.',
                      'Offline Mode: Dual PDF invoice generated locally and order queued for automatic cloud sync when internet returns.',
                      '离线模式：已在本地生成双联 PDF 发票，订单已加入队列，联网后将自动同步至云端。'
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    exportStoreOrderInvoicePDF(
                      completedOrder.store,
                      completedOrder.order,
                      completedOrder.items,
                      'cliente',
                      lang
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-[#111114] border border-amber-500/40 hover:border-amber-400 text-xs font-semibold text-amber-300 flex items-center gap-1.5 min-h-[40px]"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t.marketplace.clientPdfBtn}</span>
                </button>
                <button
                  onClick={() =>
                    exportStoreOrderInvoicePDF(
                      completedOrder.store,
                      completedOrder.order,
                      completedOrder.items,
                      'dueno',
                      lang
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-[#111114] border border-emerald-500/40 hover:border-emerald-400 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 min-h-[40px]"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t.marketplace.ownerPdfBtn}</span>
                </button>
                <button
                  onClick={() =>
                    exportStoreOrderInvoicePDF(
                      completedOrder.store,
                      completedOrder.order,
                      completedOrder.items,
                      'dual',
                      lang
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-white/[0.1] hover:border-white text-xs font-semibold text-white flex items-center gap-1.5 min-h-[40px]"
                >
                  <FileText className="w-4 h-4 text-zinc-300" />
                  <span>{t.marketplace.dualPdfBtn}</span>
                </button>
                <a
                  href={buildWhatsappOrderLink(
                    completedOrder.store,
                    completedOrder.order,
                    completedOrder.items
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 min-h-[40px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t.marketplace.waOrderBtn}</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Product Search, Category Tabs & Size Filters */}
        <div className="space-y-3 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder={t.marketplace.searchProductsPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-[#09090b] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="text-xs font-mono text-zinc-400 tabular-nums">
              {filteredProducts.length}{' '}
              {tr(
                filteredProducts.length === 1 ? 'producto encontrado' : 'productos encontrados',
                filteredProducts.length === 1 ? 'product found' : 'products found',
                '件商品'
              )}
            </div>
          </div>

          {productCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-zinc-500 mr-1 inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {tr('Categoría:', 'Category:', '分类:')}
              </span>
              <button
                type="button"
                onClick={() => setProductCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[34px] ${
                  productCategoryFilter === 'all'
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-[#09090b] border border-white/[0.08] text-zinc-300 hover:border-white/[0.2]'
                }`}
              >
                {t.common.all}
              </button>
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setProductCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[34px] ${
                    productCategoryFilter.toLowerCase() === cat.toLowerCase()
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'bg-[#09090b] border border-white/[0.08] text-zinc-300 hover:border-white/[0.2]'
                  }`}
                >
                  {translateCategoryLabel(cat, lang)}
                </button>
              ))}
            </div>
          )}

          {availableStoreSizes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/[0.06]">
              <span className="text-[11px] font-medium text-amber-400 mr-1 inline-flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5" />
                {tr('Filtrar por Talla:', 'Filter by Size:', '按尺码筛选:')}
              </span>
              <button
                type="button"
                onClick={() => setProductSizeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors min-h-[32px] ${
                  productSizeFilter === 'all'
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-[#09090b] border border-white/[0.08] text-zinc-300 hover:border-amber-400/40'
                }`}
              >
                {t.common.all}
              </button>
              {availableStoreSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setProductSizeFilter(size)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors min-h-[32px] min-w-[36px] ${
                    productSizeFilter.toLowerCase() === size.toLowerCase()
                      ? 'bg-amber-400 text-zinc-950'
                      : 'bg-[#09090b] border border-white/[0.08] text-zinc-200 hover:border-amber-400/50'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Store Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-10 text-center space-y-2">
            <Package className="w-10 h-10 text-zinc-500 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">
              {t.marketplace.emptyProductsTitle}
            </p>
            <p className="text-xs text-zinc-500">
              {t.marketplace.emptyProductsDesc}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => {
              const pSizes = normalizeSizeList(product.availableSizes);
              const activeSize =
                pSizes.length > 0 ? resolveChosenSize(product) : undefined;
              const qtyInCart = getProductQtyInCart(product.id, activeCart);
              const remainingStock =
                product.stock > 0 ? Math.max(0, product.stock - qtyInCart) : 0;

              return (
                <div
                  key={product.id}
                  className="bg-[#111114] border border-white/[0.08] hover:border-amber-400/45 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 group"
                >
                  <div
                    onClick={() => setQuickViewProduct(product)}
                    className="aspect-[4/3] bg-[#09090b] relative overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {product.imageUrl && !failedImageKeys[`prod-${product.id}`] ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImageKeys((prev) => ({
                            ...prev,
                            [`prod-${product.id}`]: true,
                          }))
                        }
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-zinc-600">
                        <Package className="w-11 h-11 text-amber-400/40" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          {translateCategoryLabel(product.category, lang) || tr('Artículo', 'Item', '商品')}
                        </span>
                      </div>
                    )}
                    {product.category && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#09090b]/85 border border-white/[0.12] text-[10px] font-semibold text-amber-300">
                        {translateCategoryLabel(product.category, lang)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewProduct(product);
                      }}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-[#09090b]/85 border border-white/[0.12] hover:border-amber-400/60 text-zinc-200 hover:text-amber-300 flex items-center justify-center transition-colors"
                      title={tr('Vista rápida y tallas', 'Quick view & sizes', '快速查看与尺码')}
                      aria-label={tr('Vista rápida y tallas', 'Quick view & sizes', '快速查看与尺码')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      {renderStars(product.rating)}
                      <h3
                        onClick={() => setQuickViewProduct(product)}
                        className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 font-display cursor-pointer"
                      >
                        {product.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2">{product.description}</p>
                    </div>

                    {pSizes.length > 0 && (
                      <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400 font-medium inline-flex items-center gap-1">
                            <Ruler className="w-3 h-3 text-amber-400" />
                            {tr('Talla:', 'Size:', '尺码:')}{' '}
                            <strong className="text-amber-300 font-mono">{activeSize}</strong>
                          </span>
                          {product.sizeGuide && (
                            <button
                              type="button"
                              onClick={() => setQuickViewProduct(product)}
                              className="text-[10px] text-amber-400 hover:text-amber-300 underline underline-offset-2"
                            >
                              {tr('Guía de tallas', 'Size guide', '尺码表')}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pSizes.map((sz) => {
                            const isSelected = activeSize?.toLowerCase() === sz.toLowerCase();
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() =>
                                  setSelectedSizesByProduct((prev) => ({
                                    ...prev,
                                    [product.id]: sz,
                                  }))
                                }
                                className={`min-w-[34px] min-h-[30px] px-2 rounded-md text-[11px] font-mono font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                                    : 'bg-[#09090b] border border-white/[0.1] text-zinc-200 hover:border-amber-400/50'
                                }`}
                              >
                                {translateSizeTokenLabel(sz, lang)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-lg font-extrabold text-amber-400 font-mono tabular-nums">
                            ${product.priceUSD.toFixed(2)}
                          </span>
                          <span className="block text-[11px] text-zinc-400 font-mono tabular-nums">
                            {(product.priceUSD * exchangeRate).toLocaleString('es-VE', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            Bs.
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                          {t.common.stock}: {product.stock} {translateUnitLabel(product.unit || 'und', lang, product.stock !== 1)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          addToCart(product, activeSize);
                          setIsCartOpen(true);
                        }}
                        disabled={product.stock <= 0 || remainingStock <= 0}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:bg-zinc-900 disabled:text-zinc-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>
                          {product.stock <= 0
                            ? t.marketplace.outOfStock
                            : remainingStock <= 0
                              ? tr('Máximo en carrito', 'Max in cart', '已达库存上限')
                              : activeSize
                                ? `${t.marketplace.addToCart} · ${translateSizeTokenLabel(activeSize, lang)}`
                                : t.marketplace.addToCart}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick View PDP Modal */}
        {quickViewProduct && (
          <div
            className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setQuickViewProduct(null)}
          >
            <div
              className="w-full max-w-3xl bg-[#111114] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 bg-[#09090b] relative aspect-[4/3] md:aspect-auto md:min-h-[340px] flex items-center justify-center">
                  {quickViewProduct.imageUrl && !failedImageKeys[`prod-${quickViewProduct.id}`] ? (
                    <img
                      src={quickViewProduct.imageUrl}
                      alt={quickViewProduct.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImageKeys((prev) => ({
                          ...prev,
                          [`prod-${quickViewProduct.id}`]: true,
                        }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-14 h-14 text-amber-400/40" />
                  )}
                </div>

                <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-amber-400">
                          <span>{translateCategoryLabel(quickViewProduct.category, lang) || tr('Catálogo', 'Catalog', '目录')}</span>
                          {quickViewProduct.sku && (
                            <span className="text-zinc-500">· SKU: {quickViewProduct.sku}</span>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                          {quickViewProduct.name}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickViewProduct(null)}
                        className="w-9 h-9 rounded-lg bg-[#09090b] border border-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center shrink-0"
                        aria-label={t.common.close}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {renderStars(quickViewProduct.rating)}

                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {quickViewProduct.description}
                    </p>

                    <div className="p-3.5 rounded-xl bg-[#09090b] border border-white/[0.08] flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <span className="text-2xl font-extrabold text-amber-400 font-mono tabular-nums">
                          ${quickViewProduct.priceUSD.toFixed(2)} USD
                        </span>
                        <span className="block text-xs text-zinc-400 font-mono tabular-nums">
                          {(quickViewProduct.priceUSD * exchangeRate).toLocaleString('es-VE', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          Bs. BCV
                        </span>
                      </div>
                      <div className="text-right text-xs font-mono text-zinc-300 tabular-nums">
                        {t.common.stock}: {quickViewProduct.stock} {translateUnitLabel(quickViewProduct.unit || 'und', lang, quickViewProduct.stock !== 1)}
                      </div>
                    </div>

                    {(() => {
                      const qSizes = normalizeSizeList(quickViewProduct.availableSizes);
                      if (qSizes.length === 0) return null;
                      const picked = resolveChosenSize(quickViewProduct);
                      return (
                        <div className="space-y-2 pt-1">
                          <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                            <Ruler className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {tr('Selecciona tu talla:', 'Select your size:', '选择尺码:')}{' '}
                              <span className="text-amber-400 font-mono">{translateSizeTokenLabel(picked, lang)}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {qSizes.map((sz) => {
                              const active = picked?.toLowerCase() === sz.toLowerCase();
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSizesByProduct((prev) => ({
                                      ...prev,
                                      [quickViewProduct.id]: sz,
                                    }))
                                  }
                                  className={`min-w-[44px] min-h-[38px] px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                                    active
                                      ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20'
                                      : 'bg-[#09090b] border border-white/[0.12] text-zinc-200 hover:border-amber-400/50'
                                  }`}
                                >
                                  {translateSizeTokenLabel(sz, lang)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {quickViewProduct.sizeGuide && (
                      <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-400/25 text-xs text-zinc-200 space-y-1">
                        <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5" />
                          <span>{tr('Guía de tallas / Medidas', 'Size guide / Fit notes', '尺码对照与版型说明')}</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
                          {quickViewProduct.sizeGuide}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    {(() => {
                      const qSizes = normalizeSizeList(quickViewProduct.availableSizes);
                      const picked = qSizes.length > 0 ? resolveChosenSize(quickViewProduct) : undefined;
                      const inCart = getProductQtyInCart(quickViewProduct.id, activeCart);
                      const canAdd = quickViewProduct.stock > 0 && inCart < quickViewProduct.stock;
                      return (
                        <button
                          type="button"
                          disabled={!canAdd}
                          onClick={() => {
                            addToCart(quickViewProduct, picked);
                            setQuickViewProduct(null);
                            setIsCartOpen(true);
                          }}
                          className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-900 disabled:text-zinc-500 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[46px]"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          <span>
                            {quickViewProduct.stock <= 0
                              ? t.marketplace.outOfStock
                              : !canAdd
                                ? tr('Máximo en carrito', 'Max in cart', '已达库存上限')
                                : picked
                                  ? `${t.marketplace.addToCart} (${tr('Talla', 'Size', '尺码')} ${picked})`
                                  : t.marketplace.addToCart}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Store Shopping Cart & Custom Invoice Checkout Modal/Drawer */}
        {isCartOpen && (
          <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-lg bg-[#09090b] border-l border-white/[0.08] h-[100dvh] safe-area-top safe-area-bottom overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 gap-2">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2 truncate">
                    <ShoppingCart className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="truncate">{t.marketplace.cartDrawerTitle} · {selectedStore.storeName}</span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {t.marketplace.cartDrawerSub}
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-3.5 py-2 min-h-[44px] rounded-lg bg-[#111114] border border-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white shrink-0"
                >
                  {t.common.close}
                </button>
              </div>

              {activeCart.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-sm space-y-2">
                  <ShoppingCart className="w-10 h-10 text-slate-700 mx-auto" />
                  <p>{t.marketplace.cartEmpty}</p>
                </div>
              ) : (
                <>
                  {/* Items List */}
                  <div className="space-y-3">
                    {activeCart.map((item) => {
                      const lineKey = buildCartLineKey(item.product.id, item.selectedSize);
                      const itemSizes = normalizeSizeList(item.product.availableSizes);
                      return (
                        <div
                          key={lineKey}
                          className="bg-[#111114] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="text-xs font-bold text-white truncate">
                              {item.product.name}
                            </div>
                            {itemSizes.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                <span className="text-zinc-400">{tr('Talla:', 'Size:', '尺码:')}</span>
                                <select
                                  value={item.selectedSize || itemSizes[0]}
                                  onChange={(e) =>
                                    changeCartItemSize(item.product.id, item.selectedSize, e.target.value)
                                  }
                                  className="px-1.5 py-0.5 rounded bg-[#09090b] border border-amber-400/35 text-[11px] font-mono text-amber-300"
                                >
                                  {itemSizes.map((sz) => (
                                    <option key={sz} value={sz}>
                                      {translateSizeTokenLabel(sz, lang)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : item.selectedSize ? (
                              <div className="text-[11px] font-mono text-amber-300">
                                {tr('Talla:', 'Size:', '尺码:')} {translateSizeTokenLabel(item.selectedSize, lang)}
                              </div>
                            ) : null}
                            <div className="text-[11px] text-amber-400 font-mono tabular-nums">
                              ${item.product.priceUSD.toFixed(2)} {t.marketplace.eachUnit} · {t.common.subtotal}: $
                              {(item.product.priceUSD * item.quantity).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, -1, item.selectedSize)}
                              className="w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 flex items-center justify-center text-white"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-7 text-center text-xs font-mono font-bold text-white tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, 1, item.selectedSize)}
                              className="w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 flex items-center justify-center text-white"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQty(item.product.id, -item.quantity, item.selectedSize)
                              }
                              className="w-10 h-10 rounded-lg bg-red-950/50 hover:bg-red-900/60 active:scale-95 flex items-center justify-center text-red-400 ml-0.5"
                              title={tr('Quitar', 'Remove', '移除')}
                              aria-label={tr('Quitar', 'Remove', '移除')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Google sign-in option for cloud persistence */}
                  {!user && (
                    <div className="bg-[#111114] border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                      <div className="text-[11px] text-zinc-300">
                        {t.marketplace.googlePrompt}
                      </div>
                      <GoogleAuthButton
                        label={t.marketplace.googleLoginBtn}
                        variant="compact"
                        fullWidth
                        onSuccess={(signedUser) => {
                          setUser(signedUser);
                          setOrderError(null);
                        }}
                      />
                    </div>
                  )}

                  {user && (
                    <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2">
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {t.marketplace.cloudLinked} {user.email}
                      </span>
                    </div>
                  )}

                  {/* Checkout Form */}
                  <form onSubmit={handleFinalizeOrder} className="space-y-3 pt-2 border-t border-white/[0.08]">
                    {/* Invisible anti-bot honeypot field */}
                    <div className="sr-only" aria-hidden="true">
                      <label htmlFor="checkout-company-website">Website</label>
                      <input
                        id="checkout-company-website"
                        name="companyWebsite"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={botTrapWebsite}
                        onChange={(e) => setBotTrapWebsite(e.target.value)}
                      />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {t.marketplace.checkoutSection}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          {t.marketplace.buyerNameLabel}
                        </label>
                        <input
                          required
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={t.marketplace.buyerNamePlaceholder}
                          className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          {t.marketplace.buyerRifLabel}
                        </label>
                        <input
                          type="text"
                          value={customerRif}
                          onChange={(e) => setCustomerRif(e.target.value)}
                          placeholder="V-12345678"
                          className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          {t.marketplace.buyerPhoneLabel}
                        </label>
                        <input
                          required
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+58 414 0000000"
                          className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          {t.marketplace.paymentMethodLabel}
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                        >
                          {storePaymentMethods.length > 0 ? (
                            storePaymentMethods.map((m) => (
                              <option key={m.id} value={m.name}>
                                {translatePaymentMethodLabel(m.name, lang)} ({m.currency})
                                {m.qrImageUrl ? ' · QR' : ''}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Pago Móvil">
                                {translatePaymentMethodLabel('Pago Móvil (Bs.)', lang)}
                              </option>
                              <option value="Transferencia Bancaria">
                                {translatePaymentMethodLabel('Transferencia Bancaria', lang)}
                              </option>
                              <option value="Binance Pay (QR)">{translatePaymentMethodLabel('Binance Pay (QR)', lang)} (USDT)</option>
                              <option value="Bybit Pay (QR)">{translatePaymentMethodLabel('Bybit Pay (QR)', lang)} (USDT)</option>
                              <option value="Zelle">{translatePaymentMethodLabel('Zelle', lang)}</option>
                              <option value="Efectivo USD">
                                {translatePaymentMethodLabel('Efectivo USD', lang)}
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const activeMethodInfo = storePaymentMethods.find(
                        (m) => m.name === paymentMethod
                      );
                      if (!activeMethodInfo) return null;
                      const holderPrefix = tr('Titular:', 'Holder:', '户名：');
                      const translatedName = translatePaymentMethodLabel(activeMethodInfo.name, lang);
                      const fullCopyText = [
                        `${translatedName} (${activeMethodInfo.currency})`,
                        activeMethodInfo.accountHolder
                          ? `${holderPrefix} ${activeMethodInfo.accountHolder}`
                          : '',
                        activeMethodInfo.accountDetails,
                      ]
                        .filter(Boolean)
                        .join('\n');
                      return (
                        <div className="p-3 rounded-xl bg-[#111114] border border-emerald-500/30 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-emerald-300">
                              {tr('Datos de Cobro', 'Payment Details', '收款账户信息')} · {translatedName} ({activeMethodInfo.currency})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(fullCopyText);
                                setCopiedPaymentDetails(true);
                                setTimeout(() => setCopiedPaymentDetails(false), 2000);
                              }}
                              className="px-2 py-1 rounded bg-[#09090b] border border-white/[0.1] text-[11px] text-zinc-200 hover:border-emerald-400 flex items-center gap-1 shrink-0"
                            >
                              {copiedPaymentDetails ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedPaymentDetails
                                  ? tr('Copiado', 'Copied', '已复制')
                                  : tr('Copiar', 'Copy', '复制')}
                              </span>
                            </button>
                          </div>
                          {activeMethodInfo.accountHolder && (
                            <div className="text-[11px] text-zinc-400">
                              {tr('Titular:', 'Holder:', '户名：')}{' '}
                              <span className="text-zinc-200">
                                {activeMethodInfo.accountHolder}
                              </span>
                            </div>
                          )}
                          <div className="text-[11px] font-mono text-zinc-100 whitespace-pre-line">
                            {activeMethodInfo.accountDetails}
                          </div>
                          {activeMethodInfo.instructions && (
                            <div className="text-[11px] text-amber-200/90">
                              {translateCommonPaymentInstruction(activeMethodInfo.instructions, lang)}
                            </div>
                          )}
                          {activeMethodInfo.qrImageUrl && (
                            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setZoomQrData({
                                    qrUrl: activeMethodInfo.qrImageUrl!,
                                    title: translatedName,
                                    subtitle: activeMethodInfo.accountHolder || selectedStore.storeName,
                                    accountDetails: activeMethodInfo.accountDetails,
                                  })
                                }
                                className="bg-white p-2 rounded-xl border border-white/20 shrink-0 hover:scale-[1.03] transition-transform cursor-pointer"
                                title={tr('Ampliar QR para escanear', 'Zoom QR to scan', '放大二维码扫码')}
                              >
                                <img
                                  src={activeMethodInfo.qrImageUrl}
                                  alt={translatedName}
                                  referrerPolicy="no-referrer"
                                  className="w-20 h-20 object-contain rounded"
                                />
                              </button>
                              <div className="space-y-1.5 min-w-0">
                                <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                                  <QrCode className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {tr('Código QR para Pagar Directo', 'Direct Scan Payment QR', '支持直接扫码付款')}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-snug">
                                  {tr(
                                    'Escanea desde Binance, Bybit o tu billetera y luego finaliza tu pedido.',
                                    'Scan from Binance, Bybit, or your wallet app, then confirm your order.',
                                    '使用 Binance、Bybit 或数字钱包扫码转账后确认提交订单。'
                                  )}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomQrData({
                                      qrUrl: activeMethodInfo.qrImageUrl!,
                                      title: translatedName,
                                      subtitle: activeMethodInfo.accountHolder || selectedStore.storeName,
                                      accountDetails: activeMethodInfo.accountDetails,
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>{tr('Ampliar / Escanear QR', 'Zoom / Scan QR', '放大 / 扫码')}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        {t.marketplace.deliveryMethodLabel}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {selectedStore.nationalShippingEnabled && (
                          <button
                            type="button"
                            onClick={() => setShippingType('Envío Nacional')}
                            className={`p-2 rounded-lg border text-xs font-semibold text-left ${
                              shippingType === 'Envío Nacional'
                                ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                                : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                            }`}
                          >
                            {t.marketplace.nationalShipping}
                          </button>
                        )}
                        {selectedStore.localDeliveryEnabled && (
                          <button
                            type="button"
                            onClick={() => setShippingType('Delivery Local')}
                            className={`p-2 rounded-lg border text-xs font-semibold text-left ${
                              shippingType === 'Delivery Local'
                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                                : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                            }`}
                          >
                            {t.marketplace.localDelivery} (${(selectedStore.localDeliveryFeeUSD || 0).toFixed(2)})
                          </button>
                        )}
                        {selectedStore.pickupEnabled && (
                          <button
                            type="button"
                            onClick={() => setShippingType('Retiro en Tienda')}
                            className={`p-2 rounded-lg border text-xs font-semibold text-left ${
                              shippingType === 'Retiro en Tienda'
                                ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                                : 'bg-[#111114] border-white/[0.1] text-zinc-300'
                            }`}
                          >
                            {t.marketplace.localPickup}
                          </button>
                        )}
                      </div>
                    </div>

                    {shippingType !== 'Retiro en Tienda' && (
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          {shippingType === 'Envío Nacional'
                            ? `${t.marketplace.deliveryDetailNational} (${selectedStore.nationalCouriers || 'MRW, Zoom, Tealca'})`
                            : `${t.marketplace.deliveryDetailLocal} (${translateDeliveryZoneLabel(selectedStore.localDeliveryZone || 'Local', lang)})`}
                        </label>
                        <input
                          type="text"
                          value={shippingDetails}
                          onChange={(e) => setShippingDetails(e.target.value)}
                          placeholder={t.marketplace.deliveryDetailPlaceholder}
                          className="w-full px-3 py-2 bg-[#111114] border border-white/[0.1] rounded-lg text-xs text-white"
                        />
                      </div>
                    )}

                    {/* Totals Summary */}
                    <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>{t.marketplace.itemsSummaryLabel} ({cartItemCount}):</span>
                        <span className="font-mono">${cartSubtotalUSD.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>{t.marketplace.shippingCostLabel} ({getShippingTypeLabel(shippingType)}):</span>
                        <span className="font-mono">${shippingFeeUSD.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/[0.08]">
                        <span>{t.marketplace.totalInvoiceLabel}</span>
                        <span className="font-mono text-amber-400">${totalUSD.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span>{t.marketplace.bcvEquivLabel} ({exchangeRate.toFixed(2)}):</span>
                        <span className="font-mono">
                          {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-white/[0.07] text-[11px] text-emerald-300">
                        {t.marketplace.dualNoticeBefore} {selectedStore.storeName}.
                      </div>
                    </div>

                    {orderError && (
                      <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
                        {orderError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingOrder}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 min-h-[46px]"
                    >
                      <FileText className="w-4 h-4" />
                      <span>
                        {isSubmittingOrder
                          ? t.marketplace.submittingBtn
                          : !user
                            ? t.marketplace.loginAndBuyBtn
                            : t.marketplace.finalizeBtn}
                      </span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        <QrZoomModal
          isOpen={Boolean(zoomQrData)}
          qrUrl={zoomQrData?.qrUrl}
          title={zoomQrData?.title || ''}
          subtitle={zoomQrData?.subtitle}
          accountDetails={zoomQrData?.accountDetails}
          onClose={() => setZoomQrData(null)}
        />

        <StoreQrShareModal
          isOpen={Boolean(qrShareStore)}
          store={qrShareStore}
          onClose={() => setQrShareStore(null)}
          onVisitStore={(st) => setSelectedStore(st)}
        />
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Multi-SaaS Store Directory View
  // ---------------------------------------------------------------------------
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 w-full min-w-0">
      {/* Editorial Directory Hero Banner */}
      <div className="obsidian-surface rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-w-0 shadow-2xl shadow-black/60">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6 min-w-0">
          <div className="space-y-3 min-w-0">
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{t.marketplace.badge}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-zinc-50 font-display tracking-tight text-balance">
              {t.marketplace.title}
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
              {t.marketplace.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-zinc-400 pt-1">
              <span className="text-amber-400 font-semibold">
                {tr('Moda y Tallas', 'Apparel & Sizes', '服饰尺码支持')}
              </span>
              <span aria-hidden="true">·</span>
              <span>{tr('Tasa BCV Oficial', 'Live BCV Rate', 'BCV 官方汇率')}</span>
              <span aria-hidden="true">·</span>
              <span>{tr('Factura Dual PDF', 'Dual PDF Invoice', '双联 PDF 发票')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateMerchant}
              className="px-5 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_6px_24px_-6px_rgba(245,158,11,0.4)] transition-colors shrink-0 min-h-[44px]"
            >
              <Store className="w-4 h-4" />
              <span>{t.marketplace.registerBtn}</span>
            </button>
            {onOpenVideoGuides && (
              <button
                type="button"
                onClick={() => onOpenVideoGuides('buyers')}
                className="px-4 py-3 rounded-lg bg-[#09090b] hover:bg-zinc-900 border border-white/[0.12] hover:border-amber-400/40 text-zinc-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shrink-0 min-h-[44px]"
              >
                <Video className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{tr('Ver Video Guías', 'Watch Video Guides', '观看视频指南')}</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[200px] lg:min-h-[260px] bg-[#09090b] overflow-hidden border-t lg:border-t-0 lg:border-l border-white/[0.08]">
          {!failedImageKeys['dir-hero'] ? (
            <img
              src={editorialStorefrontImg}
              alt={t.marketplace.title}
              referrerPolicy="no-referrer"
              onError={() => setFailedImageKeys((prev) => ({ ...prev, 'dir-hero': true }))}
              className="w-full h-full object-cover object-center opacity-80"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-[#09090b]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/45 to-transparent flex items-end p-5">
            <div className="w-full flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-200 font-semibold">
                {tr('Boutiques, Bodegones & Comercios', 'Boutiques, Retail & Multi-Store', '精品服饰店、百货与多商户商城')}
              </span>
              <span className="font-mono text-amber-400 font-bold tabular-nums shrink-0">
                {stores.length} {stores.length === 1 ? t.marketplace.activeStoreSingular : t.marketplace.activeStorePlural}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer 3-Step Purchase Clarity Strip (Personal Language View) */}
      <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 font-mono font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <div className="min-w-0">
            <div className="font-bold text-zinc-100">
              {tr('Elige tienda, rubro o talla', 'Choose store, category or size', '1. 按品类或尺码挑选认证店铺')}
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              {tr(
                'Explora tiendas verificadas por categoría, ropa con selector de tallas o buscador.',
                'Browse verified stores by localized category, apparel sizing, or product search.',
                '浏览按您的语言自动分类的认证商铺，支持服装尺码筛选与关键词搜索。'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono font-bold flex items-center justify-center shrink-0">
            2
          </span>
          <div className="min-w-0">
            <div className="font-bold text-zinc-100">
              {tr('Precios claros USD + Bs. BCV', 'Clear USD + Live BCV Bs. Pricing', '2. 美元与 BCV 玻利瓦尔透明标价')}
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug tabular-nums">
              {tr(
                `Tasa del día ${exchangeRate.toFixed(2)} Bs./USD. Verás métodos de cobro y envío antes de confirmar.`,
                `Live rate ${exchangeRate.toFixed(2)} Bs./USD. See store payment accounts & delivery fees upfront.`,
                `实时参考汇率 ${exchangeRate.toFixed(2)} Bs./USD。下单前即可查看商家收款账户与配送费用。`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/35 text-sky-300 font-mono font-bold flex items-center justify-center shrink-0">
            3
          </span>
          <div className="min-w-0">
            <div className="font-bold text-zinc-100">
              {tr('Pedido seguro + Factura PDF', 'Order + Instant Dual PDF Receipt', '3. 一键下单生成双联发票')}
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              {tr(
                'Descarga tu recibo PDF al instante y coordina el despacho directo por WhatsApp en tu idioma.',
                'Download your PDF invoice instantly and confirm delivery directly on WhatsApp.',
                '下单后立即可下载 PDF 电子发票，并通过 WhatsApp 直接联系商家安排发货。'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Directory Search & Category Strip */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.marketplace.searchStoresPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 bg-[#111114] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="text-xs text-zinc-400 font-mono tabular-nums">
            {filteredStores.length}{' '}
            {filteredStores.length === 1
              ? t.marketplace.activeStoreSingular
              : t.marketplace.activeStorePlural}
          </div>
        </div>

        {storeCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStoreCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                storeCategoryFilter === 'all'
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-[#111114] border border-white/[0.08] text-zinc-300 hover:border-white/[0.2]'
              }`}
            >
              {t.common.all}
            </button>
            {storeCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStoreCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                  storeCategoryFilter.toLowerCase() === cat.toLowerCase()
                    ? 'bg-amber-400 text-zinc-950 font-semibold'
                    : 'bg-[#111114] border border-white/[0.08] text-zinc-300 hover:border-white/[0.2]'
                }`}
              >
                {translateCategoryLabel(cat, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Stores Grid */}
      {filteredStores.length === 0 ? (
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-10 text-center space-y-4">
          <Store className="w-12 h-12 text-amber-400/60 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-display">
              {t.marketplace.emptyDirTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
              {t.marketplace.emptyDirDesc}
            </p>
          </div>
          <button
            onClick={onNavigateMerchant}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm"
          >
            {t.marketplace.emptyDirBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => {
            const isApparel =
              Boolean(store.clothingSizesEnabled) || isFashionOrApparelCategory(store.category);
            const coverImg = isApparel ? fashionBoutiqueImg : editorialStorefrontImg;
            return (
              <div
                key={store.id}
                onClick={() => setSelectedStore(store)}
                className="cursor-pointer bg-[#111114] border border-white/[0.08] hover:border-amber-400/50 hover:-translate-y-0.5 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 group shadow-lg shadow-black/40"
              >
                <div>
                  {/* Boutique Cover Strip */}
                  <div className="h-28 bg-[#09090b] relative overflow-hidden">
                    {!failedImageKeys[`card-cover-${store.id}`] ? (
                      <img
                        src={coverImg}
                        alt={store.storeName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImageKeys((prev) => ({
                            ...prev,
                            [`card-cover-${store.id}`]: true,
                          }))
                        }
                        className="w-full h-full object-cover object-center opacity-55 group-hover:scale-[1.04] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-[#09090b]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/45 to-transparent" />
                    <div className="absolute top-2.5 right-3 text-[11px] font-mono text-amber-300 font-semibold">
                      {translateCategoryLabel(store.category, lang) || tr('Comercio Verificado', 'Verified Store', '认证店铺')}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-5 pb-4 -mt-7 relative space-y-3">
                    <div className="flex items-end gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-[#09090b] border-2 border-[#111114] ring-1 ring-white/[0.14] overflow-hidden shrink-0 flex items-center justify-center shadow-lg">
                        {store.logoUrl && !failedImageKeys[`card-logo-${store.id}`] ? (
                          <img
                            src={store.logoUrl}
                            alt={store.storeName}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImageKeys((prev) => ({
                                ...prev,
                                [`card-logo-${store.id}`]: true,
                              }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Store className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 pb-0.5 flex-1">
                        <h3 className="text-base font-bold text-white group-hover:text-amber-300 truncate font-display transition-colors">
                          {store.storeName}
                        </h3>
                        <p className="text-xs text-zinc-400 truncate">
                          {t.marketplace.ownerPrefix} {store.registeredOwnerName}
                          {store.rif && (
                            <span className="font-mono text-amber-400"> · {store.rif}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {store.description && (
                      <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                        {store.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                      <span className="font-mono text-amber-300/90">/@{store.slug}</span>
                      {isApparel && (
                        <span className="text-amber-300 font-medium inline-flex items-center gap-1">
                          · <Ruler className="w-3 h-3" />
                          {tr('Tallas', 'Sizes', '多尺码')}
                        </span>
                      )}
                      {store.nationalShippingEnabled && (
                        <span className="text-zinc-300">
                          · {t.marketplace.nationalShipping}
                        </span>
                      )}
                      {store.localDeliveryEnabled && (
                        <span className="text-emerald-400">
                          · {t.marketplace.localDelivery}
                        </span>
                      )}
                      {store.pickupEnabled && (
                        <span className="text-sky-400">
                          · {t.marketplace.localPickup}
                        </span>
                      )}
                    </div>

                    {getSocialPlatformEntries(store.socialLinks).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {getSocialPlatformEntries(store.socialLinks)
                          .slice(0, 4)
                          .map((entry) => (
                            <a
                              key={entry.meta.key}
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={entry.displayHandle}
                              className="px-2 py-0.5 rounded-md bg-[#09090b] border border-white/[0.1] hover:border-amber-400/50 text-[10px] font-mono font-semibold text-zinc-300 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
                            >
                              <span>{entry.meta.badgeText}</span>
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-[#09090b]/45 border-t border-white/[0.08] flex items-center justify-between gap-2 text-xs font-bold text-amber-400 group-hover:text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span>{t.marketplace.visitCatalogBtn}</span>
                    <ShoppingCart className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrShareStore(store);
                    }}
                    title={tr('Compartir QR de esta tienda', 'Share this store QR', '分享此店铺二维码')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#111114] border border-white/[0.12] hover:border-amber-400/50 text-zinc-200 hover:text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>QR</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StoreQrShareModal
        isOpen={Boolean(qrShareStore)}
        store={qrShareStore}
        onClose={() => setQrShareStore(null)}
        onVisitStore={(st) => setSelectedStore(st)}
      />
    </section>
  );
};
