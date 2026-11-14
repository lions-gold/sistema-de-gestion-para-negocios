import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  ShippingType,
  StoreCartItem,
  StoreOrder,
  StoreProduct,
  StoreTenant,
} from '../types';
import {
  createStoreOrderInCloud,
  fetchStoreByIdOrSlug,
  signInWithGoogleAccount,
  subscribeActiveStores,
  subscribePublicStoreProducts,
} from '../services/saasService';
import { exportStoreOrderInvoicePDF } from '../utils/pdfExport';
import { useLanguage } from '../i18n/LanguageContext';

interface MarketplaceDirectoryProps {
  exchangeRate: number;
  initialStoreSlug?: string;
  onNavigateMerchant: () => void;
}

const CARTS_STORAGE_KEY = 'smith_saas_store_carts_v1';

export const MarketplaceDirectory: React.FC<MarketplaceDirectoryProps> = ({
  exchangeRate,
  initialStoreSlug,
  onNavigateMerchant,
}) => {
  const { t } = useLanguage();
  const [stores, setStores] = useState<StoreTenant[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreTenant | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [copiedSlug, setCopiedSlug] = useState(false);

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
  const [completedOrder, setCompletedOrder] = useState<{
    order: StoreOrder;
    items: StoreCartItem[];
    store: StoreTenant;
    registeredInCloud: boolean;
  } | null>(null);

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
      if (u?.displayName && !customerName) setCustomerName(u.displayName);
      if (u?.email && !customerEmail) setCustomerEmail(u.email);
    });
    return () => unsubAuth();
  }, [customerName, customerEmail]);

  useEffect(() => {
    const unsub = subscribeActiveStores((activeList) => {
      setStores(activeList);
    });
    return () => unsub();
  }, []);

  // Resolve initialStoreSlug if provided
  useEffect(() => {
    if (!initialStoreSlug) return;
    const match = stores.find(
      (s) => s.slug === initialStoreSlug || s.id === initialStoreSlug
    );
    if (match) {
      setSelectedStore(match);
    } else {
      fetchStoreByIdOrSlug(initialStoreSlug).then((found) => {
        if (found && found.status === 'active') setSelectedStore(found);
      });
    }
  }, [initialStoreSlug, stores]);

  // Subscribe to selected store's active products
  useEffect(() => {
    if (!selectedStore) {
      setProducts([]);
      return;
    }
    if (selectedStore.nationalShippingEnabled) {
      setShippingType('Envío Nacional');
    } else if (selectedStore.localDeliveryEnabled) {
      setShippingType('Delivery Local');
    } else {
      setShippingType('Retiro en Tienda');
    }

    const unsub = subscribePublicStoreProducts(selectedStore.id, (list) => {
      setProducts(list);
    });
    return () => unsub();
  }, [selectedStore]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.storeName.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        s.registeredOwnerName.toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  const activeCart = useMemo(() => {
    if (!selectedStore) return [];
    return cartsByStore[selectedStore.id] || [];
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

  const addToCart = (product: StoreProduct) => {
    if (!selectedStore) return;
    setCartsByStore((prev) => {
      const current = prev[selectedStore.id] || [];
      const existing = current.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          ...prev,
          [selectedStore.id]: current.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: Math.min(product.stock || 999, i.quantity + 1) }
              : i
          ),
        };
      }
      return {
        ...prev,
        [selectedStore.id]: [...current, { product, quantity: 1 }],
      };
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    if (!selectedStore) return;
    setCartsByStore((prev) => {
      const current = prev[selectedStore.id] || [];
      const next = current
        .map((i) => {
          if (i.product.id !== productId) return i;
          const maxAllowed = i.product.stock > 0 ? i.product.stock : 999;
          return { ...i, quantity: Math.min(maxAllowed, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0);
      return { ...prev, [selectedStore.id]: next };
    });
  };

  const clearStoreCart = () => {
    if (!selectedStore) return;
    setCartsByStore((prev) => ({ ...prev, [selectedStore.id]: [] }));
  };

  const buildWhatsappOrderLink = (
    store: StoreTenant,
    order: StoreOrder,
    items: StoreCartItem[]
  ) => {
    const cleanPhone = store.businessWhatsapp.replace(/[^0-9]/g, '');
    const lines = [
      `*NUEVO PEDIDO #${order.invoiceNumber}*`,
      `*Tienda:* ${store.storeName}`,
      `*Titular:* ${store.registeredOwnerName}${store.rif ? ` (RIF: ${store.rif})` : ''}`,
      ``,
      `*Cliente:* ${order.customerName}`,
      `*C.I./RIF:* ${order.customerRif || 'N/A'}`,
      `*Teléfono:* ${order.customerPhone}`,
      ``,
      `*Productos:*`,
      ...items.map(
        (i) =>
          `• ${i.quantity}x ${i.product.name} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`
      ),
      ``,
      `*Entrega:* ${order.shippingType}${order.shippingDetails ? ` (${order.shippingDetails})` : ''}`,
      `*Envío:* $${order.shippingFeeUSD.toFixed(2)} USD`,
      `*Método de Pago:* ${order.paymentMethod}`,
      `*TOTAL:* $${order.totalUSD.toFixed(2)} USD (${order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.)`,
      ``,
      `_Pedido generado desde Smith Solutions E-Commerce_`,
    ].join('\n');

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
  };

  const handleFinalizeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || activeCart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) return;

    setOrderError(null);
    setIsSubmittingOrder(true);
    try {
      let activeUser = user;
      if (!activeUser || !activeUser.emailVerified) {
        try {
          activeUser = await signInWithGoogleAccount();
          setUser(activeUser);
        } catch {
          setOrderError(t.marketplace.errLoginRequired);
          setIsSubmittingOrder(false);
          return;
        }
      }

      if (!activeUser || !activeUser.emailVerified) {
        setOrderError(t.marketplace.errEmailUnverified);
        setIsSubmittingOrder(false);
        return;
      }

      const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`;
      const itemsSummary = activeCart
        .map(
          (i) =>
            `${i.quantity}x ${i.product.name} ($${(i.product.priceUSD * i.quantity).toFixed(2)})`
        )
        .join(' | ')
        .slice(0, 1950);

      const snapshotItems = [...activeCart];
      const savedOrder = await createStoreOrderInCloud(
        activeUser,
        selectedStore,
        {
          invoiceNumber,
          customerName: customerName.trim(),
          customerRif: customerRif.trim() || undefined,
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || activeUser.email || undefined,
          shippingType,
          shippingDetails: shippingDetails.trim() || undefined,
          shippingFeeUSD,
          paymentMethod,
          subtotalUSD: cartSubtotalUSD,
          totalUSD,
          totalBs,
          exchangeRate,
          itemsSummary,
          saleChannel: 'Carrito Web',
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
      exportStoreOrderInvoicePDF(selectedStore, savedOrder, snapshotItems, 'dual');
      clearStoreCart();
      setIsCartOpen(false);
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

  const renderStars = (rating: number) => {
    const rounded = Math.round(Math.max(1, Math.min(5, rating || 5)));
    return (
      <div className="flex items-center gap-0.5" title={`${rating.toFixed(1)} de 5 estrellas`}>
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back & Share Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              setSelectedStore(null);
              setIsCartOpen(false);
              setCompletedOrder(null);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-amber-500/40 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.marketplace.backToDir}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/tienda/${selectedStore.slug}`;
                navigator.clipboard?.writeText(url);
                setCopiedSlug(true);
                setTimeout(() => setCopiedSlug(false), 2000);
              }}
              className="px-3 py-2 rounded-lg bg-[#111114] border border-white/[0.08] hover:border-amber-500/40 text-xs text-zinc-300 flex items-center gap-1.5 min-h-[40px]"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{copiedSlug ? t.marketplace.linkCopied : t.marketplace.copyStoreLink}</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 min-h-[40px]"
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

        {/* Store Banner Header */}
        <div className="bg-[#111114] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#09090b] border border-amber-500/30 overflow-hidden shrink-0 flex items-center justify-center">
              {selectedStore.logoUrl ? (
                <img
                  src={selectedStore.logoUrl}
                  alt={selectedStore.storeName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-8 h-8 text-amber-400" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display">
                  {selectedStore.storeName}
                </h1>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                  {t.marketplace.verifiedBadge}
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
                <p className="text-xs text-zinc-400 max-w-2xl">{selectedStore.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs text-zinc-400">
                {selectedStore.nationalShippingEnabled && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    {t.marketplace.nationalShipping} ({selectedStore.nationalCouriers || 'MRW / Zoom / Tealca'})
                  </span>
                )}
                {selectedStore.localDeliveryEnabled && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-300 tabular-nums">
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <Bike className="w-3.5 h-3.5 text-emerald-400" />
                    {t.marketplace.localDelivery} (${(selectedStore.localDeliveryFeeUSD || 0).toFixed(2)} USD)
                  </span>
                )}
                {selectedStore.pickupEnabled && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    {t.marketplace.localPickup}
                  </span>
                )}
              </div>
            </div>
          </div>

          <a
            href={`https://wa.me/${selectedStore.businessWhatsapp.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shrink-0 min-h-[44px]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t.marketplace.storeWhatsapp}</span>
          </a>
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
                  Bs.) · {completedOrder.order.shippingType} · {completedOrder.order.paymentMethod}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    exportStoreOrderInvoicePDF(
                      completedOrder.store,
                      completedOrder.order,
                      completedOrder.items,
                      'cliente'
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
                      'dueno'
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
                      'dual'
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

        {/* Product Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder={t.marketplace.searchProductsPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111114] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
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
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-[#111114] border border-white/[0.08] hover:border-amber-500/40 rounded-2xl overflow-hidden flex flex-col transition-all"
              >
                <div className="aspect-[4/3] bg-[#09090b] relative overflow-hidden flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-slate-700" />
                  )}
                  {product.category && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#09090b]/85 border border-white/[0.1] text-[10px] font-semibold text-amber-300">
                      {product.category}
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {renderStars(product.rating)}
                    <h3 className="text-sm font-bold text-white line-clamp-2 font-display">
                      {product.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">{product.description}</p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <div>
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
                      <span className="text-[11px] font-mono text-zinc-400">
                        {t.common.stock}: {product.stock} {product.unit || 'und'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        addToCart(product);
                        setIsCartOpen(true);
                      }}
                      disabled={product.stock <= 0}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-900 disabled:text-zinc-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors min-h-[42px]"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{product.stock > 0 ? t.marketplace.addToCart : t.marketplace.outOfStock}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Per-Store Shopping Cart & Custom Invoice Checkout Modal/Drawer */}
        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-lg bg-[#09090b] border-l border-white/[0.08] h-full overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-400" />
                    <span>{t.marketplace.cartDrawerTitle} · {selectedStore.storeName}</span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {t.marketplace.cartDrawerSub}
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#111114] border border-white/[0.1] text-xs text-zinc-300 hover:text-white"
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
                    {activeCart.map((item) => (
                      <div
                        key={item.product.id}
                        className="bg-[#111114] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-amber-400 font-mono tabular-nums">
                            ${item.product.priceUSD.toFixed(2)} {t.marketplace.eachUnit} · {t.common.subtotal}: $
                            {(item.product.priceUSD * item.quantity).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-mono font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateCartQty(item.product.id, -item.quantity)}
                            className="w-8 h-8 rounded-lg bg-red-950/50 hover:bg-red-900/60 flex items-center justify-center text-red-400 ml-1"
                            title="Quitar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Google sign-in option for cloud persistence */}
                  {!user && (
                    <div className="bg-[#111114] border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-zinc-300">
                        {t.marketplace.googlePrompt}
                      </div>
                      <button
                        type="button"
                        onClick={() => signInWithGoogleAccount()}
                        className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-bold shrink-0"
                      >
                        {t.marketplace.googleLoginBtn}
                      </button>
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
                          <option value="Pago Móvil">Pago Móvil (Bs.)</option>
                          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                          <option value="Binance Pay">Binance Pay (USDT)</option>
                          <option value="Bybit">Bybit Pay</option>
                          <option value="Zelle">Zelle</option>
                          <option value="Efectivo USD">Efectivo USD</option>
                        </select>
                      </div>
                    </div>

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
                            : `${t.marketplace.deliveryDetailLocal} (${selectedStore.localDeliveryZone || 'Local'})`}
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
                        <span>{t.marketplace.shippingCostLabel} ({shippingType}):</span>
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
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Multi-SaaS Store Directory View
  // ---------------------------------------------------------------------------
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="obsidian-surface rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.marketplace.badge}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 font-display text-balance">
            {t.marketplace.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {t.marketplace.subtitle}
          </p>
        </div>

        <button
          onClick={onNavigateMerchant}
          className="px-5 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_6px_24px_-6px_rgba(245,158,11,0.4)] transition-colors shrink-0 min-h-[44px]"
        >
          <Store className="w-4 h-4" />
          <span>{t.marketplace.registerBtn}</span>
        </button>
      </div>

      {/* Directory Search */}
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
        <div className="text-xs text-zinc-400 font-mono">
          {filteredStores.length}{' '}
          {filteredStores.length === 1
            ? t.marketplace.activeStoreSingular
            : t.marketplace.activeStorePlural}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              onClick={() => setSelectedStore(store)}
              className="cursor-pointer bg-[#111114] border border-white/[0.08] hover:border-amber-500/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-xl bg-[#09090b] border border-white/[0.1] overflow-hidden shrink-0 flex items-center justify-center">
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
                    <h3 className="text-base font-bold text-white group-hover:text-amber-300 truncate font-display">
                      {store.storeName}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">
                      {t.marketplace.ownerPrefix} {store.registeredOwnerName}
                    </p>
                    {store.rif && (
                      <span className="text-[11px] font-mono text-amber-400">
                        RIF: {store.rif}
                      </span>
                    )}
                  </div>
                </div>

                {store.description && (
                  <p className="text-xs text-zinc-300 line-clamp-2">{store.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                  {store.nationalShippingEnabled && (
                    <span className="text-zinc-300">{t.marketplace.nationalShipping}</span>
                  )}
                  {store.localDeliveryEnabled && (
                    <span className="text-emerald-400">
                      {store.nationalShippingEnabled ? '· ' : ''}{t.marketplace.localDelivery}
                    </span>
                  )}
                  {store.pickupEnabled && (
                    <span className="text-sky-400">
                      {(store.nationalShippingEnabled || store.localDeliveryEnabled) ? '· ' : ''}{t.marketplace.localPickup}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs font-bold text-amber-400">
                <span>{t.marketplace.visitCatalogBtn}</span>
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
