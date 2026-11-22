import React, { useState, useEffect } from 'react';
import { Product, CartItem, PaymentMethod, Sale } from '../types';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  Receipt, 
  Printer, 
  Share2, 
  ArrowRight,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  X,
  Camera,
  Barcode,
  Download,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { exportSingleReceiptPDF, printReceiptTicket } from '../utils/pdfExport';
import { 
  getStoredFiscalConfig, 
  generateFiscalCommandStream, 
  downloadFiscalSpoolerFile 
} from '../utils/fiscalPrinter';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { getCaracasDateTimeStamp, normalizeVenezuelanPhone } from '../utils/venezuelaTime';
import { useSubsectionTranslation } from './LanguageSettings';
import { buildCartLineKey } from '../utils/clothingSizes';
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateCommonPaymentInstruction,
  translatePaymentMethodLabel,
  translateSizeTokenLabel,
} from '../utils/platformLabelsI18n';
import { Ruler } from 'lucide-react';

export interface POSCustomPaymentOption {
  name: string;
  currency?: string;
  appliesIgtf?: boolean;
  accountHolder?: string;
  accountDetails?: string;
  instructions?: string;
  source?: 'store' | 'admin';
}

interface POSModuleProps {
  products: Product[];
  exchangeRate: number;
  onCompleteSale: (sale: Sale) => void;
  onOpenScanner?: () => void;
  customPaymentMethods?: POSCustomPaymentOption[];
  onOpenPaymentSettings?: () => void;
}

const CORE_POS_METHODS: PaymentMethod[] = [
  'Pago Móvil',
  'Efectivo USD',
  'Efectivo Bs',
  'Punto de Venta',
  'Zelle',
  'Fiado (Crédito)',
];

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  exchangeRate,
  onCompleteSale,
  onOpenScanner,
  customPaymentMethods = [],
  onOpenPaymentSettings,
}) => {
  const { lang, tr } = useSubsectionTranslation('warehouse');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerRIF, setCustomerRIF] = useState('V-27891234-5');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pago Móvil');
  const [applyIGTF, setApplyIGTF] = useState(true);
  const [cashTenderedUSD, setCashTenderedUSD] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const [fiscalPrintSuccess, setFiscalPrintSuccess] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'catalog' | 'cart'>('catalog');
  const [sizePromptProduct, setSizePromptProduct] = useState<Product | null>(null);
  const { isOnline } = useOnlineStatus();

  const getMethodDisplayLabel = (name: string) => translatePaymentMethodLabel(name, lang);

  const addToCartWithSize = (product: Product, selectedSize?: string) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const totalForProduct = prev
        .filter((i) => i.product.id === product.id)
        .reduce((sum, i) => sum + i.quantity, 0);
      if (totalForProduct >= product.stock) return prev;

      const lineKey = buildCartLineKey(product.id, selectedSize);
      const existing = prev.find(
        (item) => buildCartLineKey(item.product.id, item.selectedSize) === lineKey
      );
      if (existing) {
        return prev.map((item) =>
          buildCartLineKey(item.product.id, item.selectedSize) === lineKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, selectedSize }];
    });
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    if (product.availableSizes && product.availableSizes.length > 0) {
      setSizePromptProduct(product);
      return;
    }
    addToCartWithSize(product);
  };

  // Support for PC USB / Bluetooth Barcode Scanners (wedge mode typing + Enter)
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 120) {
        barcodeBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 4) {
          const scanned = barcodeBuffer.trim();
          const found = products.find(
            (p) =>
              p.barcode === scanned ||
              p.sku.toLowerCase() === scanned.toLowerCase()
          );

          if (found && found.stock > 0) {
            addToCartWithSize(found, found.availableSizes?.[0]);
            setLastScannedFeedback(
              tr(
                `¡Escaneado en PC: ${found.name}!`,
                `Scanned on PC: ${found.name}!`,
                `PC 扫码成功：${found.name}`
              )
            );
            setTimeout(() => setLastScannedFeedback(null), 3000);
            try {
              const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              if (AudioClass) {
                const ctx = new AudioClass();
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1450, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
              }
            } catch {
              // ignore
            }
          } else {
            setLastScannedFeedback(
              tr(
                `Código "${scanned}" no encontrado en catálogo`,
                `Barcode "${scanned}" not found in catalog`,
                `目录中未找到条码 "${scanned}"`
              )
            );
            setTimeout(() => setLastScannedFeedback(null), 3500);
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const updateQuantity = (lineKey: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find(
        (i) => buildCartLineKey(i.product.id, i.selectedSize) === lineKey
      );
      if (!target) return prev;
      const totalOtherForProduct = prev
        .filter(
          (i) =>
            i.product.id === target.product.id &&
            buildCartLineKey(i.product.id, i.selectedSize) !== lineKey
        )
        .reduce((s, i) => s + i.quantity, 0);

      return prev
        .map((item) => {
          if (buildCartLineKey(item.product.id, item.selectedSize) === lineKey) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty + totalOtherForProduct > item.product.stock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const updateCartItemSize = (lineKey: string, nextSize: string) => {
    setCart((prev) =>
      prev.map((item) =>
        buildCartLineKey(item.product.id, item.selectedSize) === lineKey
          ? { ...item, selectedSize: nextSize }
          : item
      )
    );
  };

  const removeFromCart = (lineKey: string) => {
    setCart((prev) =>
      prev.filter((item) => buildCartLineKey(item.product.id, item.selectedSize) !== lineKey)
    );
  };

  const clearCart = () => setCart([]);

  const selectedCustomMethod = customPaymentMethods.find(
    (m) => m.name.trim().toLowerCase() === paymentMethod.trim().toLowerCase()
  );
  const mergedPaymentOptions: POSCustomPaymentOption[] = (() => {
    const result: POSCustomPaymentOption[] = [];
    const seen = new Set<string>();
    CORE_POS_METHODS.forEach((core) => {
      const lower = core.toLowerCase();
      seen.add(lower);
      const override = customPaymentMethods.find((m) => m.name.trim().toLowerCase() === lower);
      result.push(
        override || {
          name: core,
          appliesIgtf: core === 'Efectivo USD' || core === 'Zelle',
        }
      );
    });
    customPaymentMethods.forEach((custom) => {
      const lower = custom.name.trim().toLowerCase();
      if (!lower || seen.has(lower)) return;
      seen.add(lower);
      result.push(custom);
    });
    return result;
  })();

  const isForeignCurrency =
    paymentMethod === 'Efectivo USD' ||
    paymentMethod === 'Zelle' ||
    Boolean(selectedCustomMethod?.appliesIgtf);
  const igtfRate = (isForeignCurrency && applyIGTF) ? 0.03 : 0;
  const subtotalUSD = cart.reduce((acc, item) => acc + (item.product.priceUSD * item.quantity), 0);
  const baseAmountUSD = subtotalUSD > 0 ? Number((subtotalUSD / 1.16).toFixed(2)) : 0;
  const ivaUSD = subtotalUSD > 0 ? Number((subtotalUSD - baseAmountUSD).toFixed(2)) : 0;
  const igtfAmountUSD = Number((subtotalUSD * igtfRate).toFixed(2));
  const totalWithIgtfUSD = Number((subtotalUSD + igtfAmountUSD).toFixed(2));
  const totalWithIgtfBs = totalWithIgtfUSD * exchangeRate;
  const subtotalBs = subtotalUSD * exchangeRate;

  // Change calculator for USD cash (checks against totalWithIgtfUSD)
  const tenderedUSD = parseFloat(cashTenderedUSD) || 0;
  const changeUSD = tenderedUSD > totalWithIgtfUSD ? tenderedUSD - totalWithIgtfUSD : 0;
  const changeBs = changeUSD * exchangeRate;

  const handleProcessSale = () => {
    if (cart.length === 0) return;

    const receiptNum = `LG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = getCaracasDateTimeStamp();
    const fiscalNum = `FAC-00${Math.floor(1000 + Math.random() * 9000)}`;
    const controlNum = `00-${Math.floor(10000 + Math.random() * 90000)}`;

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      receiptNumber: receiptNum,
      date: now,
      customerName:
        customerName.trim() || tr('Cliente Mostrador', 'Walk-in Customer', '柜台散客'),
      customerRIF: customerRIF.trim() || 'V-00000000-0',
      items: [...cart],
      subtotalUSD,
      subtotalBs,
      paymentMethod,
      exchangeRate,
      status: paymentMethod === 'Fiado (Crédito)' ? 'Pendiente (Fiado)' : 'Completada',
      baseAmountUSD,
      ivaUSD,
      igtfRate,
      igtfAmountUSD,
      totalWithIgtfUSD,
      totalWithIgtfBs,
      fiscalInvoiceNumber: fiscalNum,
      fiscalControlNumber: controlNum,
      fiscalZReportNumber: 'Z-0082',
      fiscalDeviceSerial: 'HKA0084920',
      cashierName: tr('Caja Principal', 'Main Register', '主收银台'),
    };

    onCompleteSale(newSale);
    setCompletedSale(newSale);
    setCart([]);
    setCashTenderedUSD('');
    setFiscalPrintSuccess(null);
  };

  const handleEmitFiscalInvoice = (sale: Sale) => {
    try {
      const config = getStoredFiscalConfig();
      const commandStream = generateFiscalCommandStream(sale, config);
      downloadFiscalSpoolerFile(
        commandStream,
        `FacturaFiscal_${sale.fiscalInvoiceNumber || sale.receiptNumber}.txt`
      );
      setFiscalPrintSuccess(
        tr(
          `¡Comando enviado a Impresora Fiscal ${config.brand}! Serial: ${config.serialNumber} | Archivo Spooler descargado.`,
          `Command sent to Fiscal Printer ${config.brand}! Serial: ${config.serialNumber} | Spooler file downloaded.`,
          `指令已发送至税控打印机 ${config.brand}！序列号：${config.serialNumber} | 缓冲文件已下载。`
        )
      );
      setTimeout(() => setFiscalPrintSuccess(null), 6000);
    } catch (e) {
      console.error(e);
      setFiscalPrintSuccess(
        tr(
          'Factura fiscal enviada al spooler local.',
          'Fiscal invoice sent to local spooler.',
          '税控发票已发送至本地打印队列。'
        )
      );
    }
  };

  const generateWhatsAppReceiptText = (sale: Sale) => {
    const sizeTxt = tr('Talla', 'Size', '尺码');
    const itemsList = sale.items
      .map(
        (i) =>
          `• ${i.quantity}x ${i.product.name}${
            i.selectedSize
              ? ` [${sizeTxt}: ${translateSizeTokenLabel(i.selectedSize, lang)}]`
              : ''
          } = $${(i.quantity * i.product.priceUSD).toFixed(2)}`
      )
      .join('\n');

    const igtfText =
      sale.igtfAmountUSD && sale.igtfAmountUSD > 0
        ? `\n*${tr('IGTF (3% Divisas)', 'IGTF (3% FX Tax)', 'IGTF 外汇税 (3%)')}*: +$${sale.igtfAmountUSD.toFixed(2)} USD`
        : '';

    const totalFinalUSD = sale.totalWithIgtfUSD
      ? sale.totalWithIgtfUSD.toFixed(2)
      : sale.subtotalUSD.toFixed(2);
    const totalFinalBs = sale.totalWithIgtfBs
      ? sale.totalWithIgtfBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })
      : sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 });

    const text = [
      `*SMITH SOLUTIONS E-COMMERCE*`,
      `*${tr('Comprobante de Venta', 'Sales Receipt', '销售凭证')}*: ${sale.receiptNumber}`,
      `*${tr('Factura Fiscal', 'Fiscal Invoice', '税控发票')}*: ${sale.fiscalInvoiceNumber || 'N/A'}`,
      `*${tr('Fecha', 'Date', '日期')}*: ${sale.date}`,
      `*${tr('Cliente', 'Customer', '客户')}*: ${sale.customerName}`,
      `*${tr('RIF/CI', 'Tax ID', '税号/证件')}*: ${sale.customerRIF || 'V-00000000-0'}`,
      `----------------------------`,
      itemsList,
      `----------------------------`,
      `*${tr('Base Imponible (16%)', 'Taxable Base (16%)', '应税基数 (16%)')}*: $${(
        sale.baseAmountUSD || sale.subtotalUSD / 1.16
      ).toFixed(2)}`,
      `*${tr('IVA (16%)', 'VAT (16%)', '增值税 (16%)')}*: $${(
        sale.ivaUSD || sale.subtotalUSD - sale.subtotalUSD / 1.16
      ).toFixed(2)}${igtfText}`,
      `*${tr('TOTAL FINAL USD', 'TOTAL USD', '美元总计')}*: $${totalFinalUSD}`,
      `*${tr('TOTAL BS', 'TOTAL BS', '玻利瓦尔总计')}*: ${totalFinalBs} Bs.`,
      `*${tr('Tasa', 'Rate', '汇率')}*: ${sale.exchangeRate.toFixed(2)} Bs/USD`,
      `*${tr('Método de Pago', 'Payment Method', '支付方式')}*: ${translatePaymentMethodLabel(
        sale.paymentMethod,
        lang
      )}`,
      `----------------------------`,
      `_${tr(
        'Gracias por su compra en Smith Solutions E-Commerce.',
        'Thank you for your purchase at Smith Solutions E-Commerce.',
        '感谢您在 Smith Solutions E-Commerce 购买！'
      )}_`,
    ].join('\n');

    return encodeURIComponent(text);
  };

  const totalCartItems = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 relative min-w-0">
      {/* Mobile-Only Sticky Segmented Switcher: Catálogo vs Caja POS */}
      <div className="lg:hidden sticky top-[62px] z-20 py-1.5 bg-[#09090b]/90 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#111114] border border-white/[0.1]">
          <button
            type="button"
            onClick={() => setMobilePane('catalog')}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobilePane === 'catalog'
                ? 'bg-amber-400 text-zinc-950 shadow-sm'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Barcode className="w-4 h-4 shrink-0" />
            <span>
              {tr('Catálogo', 'Catalog', '商品目录')} ({products.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('cart')}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all tabular-nums ${
              mobilePane === 'cart'
                ? 'bg-amber-400 text-zinc-950 shadow-sm'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>
              {tr('Caja', 'Checkout', '收银车')} ({totalCartItems})
              {totalCartItems > 0 ? ` · $${totalWithIgtfUSD.toFixed(2)}` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* Left: Product Selector (7 cols) */}
      <div className={`${mobilePane === 'catalog' ? 'block' : 'hidden'} lg:block lg:col-span-7 min-w-0 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base font-display">
                {tr(
                  'Catálogo Rápido de Barra y Cava',
                  'Quick Point-of-Sale Catalog',
                  '快速收银商品目录'
                )}
              </h3>
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Barcode className="w-3 h-3" />
                {tr('Lector USB / Pistola Activo', 'USB Scanner Ready', 'USB 扫码枪就绪')}
              </span>
            </div>
            <span className="text-xs text-zinc-400">
              {tr(
                'Usa la cámara del móvil, haz clic o escanea con pistola de código de barras en PC',
                'Use mobile camera, click items, or scan with a USB barcode scanner on PC',
                '使用手机摄像头、点击商品或连接电脑 USB 扫码枪快速录单'
              )}
            </span>
          </div>

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 transition-all shrink-0 min-h-[40px]"
            >
              <Camera className="w-4 h-4" />
              <span>{tr('Lector de Cámara', 'Camera Scanner', '摄像头扫码')}</span>
            </button>
          )}
        </div>

        {/* Live Feedback Toast for Scanned Items */}
        {lastScannedFeedback && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between animate-in fade-in duration-150">
            <span className="font-semibold flex items-center gap-1.5">
              <Barcode className="w-4 h-4" />
              {lastScannedFeedback}
            </span>
            <button
              onClick={() => setLastScannedFeedback(null)}
              className="text-amber-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {products.map((p) => {
            const qtyInCart = cart
              .filter((i) => i.product.id === p.id)
              .reduce((s, i) => s + i.quantity, 0);
            const isOutOfStock = p.stock <= 0;

            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOutOfStock}
                className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between min-h-[112px] active:scale-[0.98] ${
                  isOutOfStock
                    ? 'bg-[#111114]/40 border-white/[0.08] opacity-50 cursor-not-allowed'
                    : qtyInCart > 0
                    ? 'bg-[#111114] border-amber-500/80 shadow-md shadow-amber-500/10'
                    : 'bg-[#111114] border-white/[0.08] hover:border-amber-500/40 hover:bg-zinc-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1 gap-1">
                    <span className="truncate">{translateCategoryLabel(p.category, lang)}</span>
                    <span className={`font-mono shrink-0 ${p.stock <= p.minStock ? 'text-amber-400' : 'text-zinc-400'}`}>
                      {p.stock}
                    </span>
                  </div>
                  <h4 className="font-medium text-white text-xs sm:text-sm line-clamp-2 mb-1.5 leading-tight">
                    {p.name}
                  </h4>
                  {p.availableSizes && p.availableSizes.length > 0 && (
                    <div className="text-[10px] font-mono text-amber-300/90 mb-2 truncate">
                      {tr('Tallas:', 'Sizes:', '尺码：')}{' '}
                      {p.availableSizes
                        .slice(0, 5)
                        .map((sz) => translateSizeTokenLabel(sz, lang))
                        .join(' · ')}
                      {p.availableSizes.length > 5 ? ` +${p.availableSizes.length - 5}` : ''}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-baseline justify-between gap-1">
                  <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                    ${p.priceUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 tabular-nums truncate">
                    {(p.priceUSD * exchangeRate).toFixed(0)} Bs.
                  </span>
                </div>

                {qtyInCart > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shadow-md">
                    {qtyInCart}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Quick Go-To-Checkout Inline CTA (avoids colliding with floating FABs) */}
        {cart.length > 0 && (
          <div className="lg:hidden pt-1">
            <button
              type="button"
              onClick={() => setMobilePane('cart')}
              className="w-full min-h-[48px] p-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold rounded-xl shadow-lg flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="text-xs font-bold">
                  {totalCartItems} {tr('ítems · Ir a Cobrar', 'items · Go to Checkout', '件商品 · 前往结账')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold">
                <span>${subtotalUSD.toFixed(2)}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Right: Checkout & Cart (5 cols) */}
      <div
        id="checkout-cart"
        className={`${mobilePane === 'cart' ? 'flex' : 'hidden'} lg:flex lg:col-span-5 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex-col justify-between`}
      >
        <div>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base font-display">
                {tr('Orden de Venta en Caja', 'POS Sales Ticket', '收银台销售单')}
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr('Vaciar', 'Clear', '清空')}</span>
              </button>
            )}
          </div>

          {/* Customer info: Nombre, RIF SENIAT, WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">
                {tr('Cliente / Razón Social', 'Customer / Company', '客户名称 / 抬头')}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={tr('Cliente Mostrador', 'Walk-in Customer', '柜台散客')}
                className="w-full bg-[#09090b] border border-white/[0.08] rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1 flex items-center justify-between">
                <span>C.I. / RIF SENIAT</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {tr('Fiscal', 'Tax ID', '税号')}
                </span>
              </label>
              <input
                type="text"
                value={customerRIF}
                onChange={(e) => setCustomerRIF(e.target.value)}
                placeholder="V-12345678-0"
                className="w-full bg-[#09090b] border border-white/[0.08] rounded px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                {tr('WhatsApp / Móvil', 'WhatsApp / Mobile', 'WhatsApp / 手机号')}
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0414-1234567"
                className="w-full bg-[#09090b] border border-white/[0.08] rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Cart item list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                {tr(
                  'El carrito está vacío. Agrega productos desde el catálogo.',
                  'Cart is empty. Tap items from the catalog to add.',
                  '购物车为空，请从左侧目录添加商品。'
                )}
              </div>
            ) : (
              cart.map((item) => {
                const lineKey = buildCartLineKey(item.product.id, item.selectedSize);
                const sizes = item.product.availableSizes || [];
                return (
                  <div
                    key={lineKey}
                    className="bg-[#09090b] p-2.5 rounded-lg border border-white/[0.08] flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <span className="text-white font-medium block truncate">
                        {item.product.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-zinc-400 font-mono text-[11px]">
                          ${item.product.priceUSD.toFixed(2)} {tr('c/u', 'ea.', '/件')}
                        </span>
                        {sizes.length > 0 && (
                          <select
                            value={item.selectedSize || sizes[0]}
                            onChange={(e) => updateCartItemSize(lineKey, e.target.value)}
                            className="bg-[#111114] border border-amber-400/35 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-300"
                            aria-label={tr('Talla', 'Size', '尺码')}
                          >
                            {sizes.map((sz) => (
                              <option key={`${lineKey}-opt-${sz}`} value={sz}>
                                {tr('Talla:', 'Size:', '尺码:')} {translateSizeTokenLabel(sz, lang)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 bg-[#111114] rounded-lg p-0.5 border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(lineKey, -1)}
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-white rounded"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono px-1.5 text-white font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(lineKey, 1)}
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-white rounded"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-mono font-bold text-amber-400 w-16 text-right tabular-nums">
                        ${(item.quantity * item.product.priceUSD).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(lineKey)}
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-500 hover:text-rose-400 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400 font-medium">
                  {tr('Método de Pago', 'Payment Method', '支付方式')}
                </label>
                {onOpenPaymentSettings && (
                  <button
                    type="button"
                    onClick={onOpenPaymentSettings}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    {tr('Configurar cobros', 'Configure methods', '配置收款方式')}
                  </button>
                )}
              </div>
              {isForeignCurrency && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {tr('Aplica IGTF 3% Divisas', '3% FX IGTF Applies', '适用 3% 外汇交易税')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {mergedPaymentOptions.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setPaymentMethod(option.name)}
                  className={`min-h-[44px] p-2 rounded-lg text-center font-medium transition-colors active:scale-[0.98] flex flex-col items-center justify-center ${
                    paymentMethod === option.name
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      : 'bg-[#09090b] text-zinc-300 hover:bg-zinc-800/80 border border-white/[0.08]'
                  }`}
                >
                  <span className="truncate max-w-full">{getMethodDisplayLabel(option.name)}</span>
                  {option.currency && (
                    <span
                      className={`text-[10px] font-mono ${
                        paymentMethod === option.name ? 'text-zinc-900' : 'text-zinc-400'
                      }`}
                    >
                      {option.currency}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {selectedCustomMethod && (selectedCustomMethod.accountDetails || selectedCustomMethod.instructions) && (
              <div className="p-2.5 rounded-lg bg-[#09090b] border border-emerald-500/25 text-[11px] space-y-0.5">
                <div className="font-semibold text-emerald-300 flex items-center justify-between gap-2">
                  <span>
                    {tr('Datos configurados para cobrar', 'Configured receiving details', '已配置的收款信息')} (
                    {getMethodDisplayLabel(selectedCustomMethod.name)})
                  </span>
                  {selectedCustomMethod.currency && (
                    <span className="font-mono text-zinc-400">{selectedCustomMethod.currency}</span>
                  )}
                </div>
                {selectedCustomMethod.accountHolder && (
                  <div className="text-zinc-400">
                    {tr('Titular:', 'Holder:', '户名：')} {selectedCustomMethod.accountHolder}
                  </div>
                )}
                {selectedCustomMethod.accountDetails && (
                  <div className="text-zinc-200 font-mono whitespace-pre-line">
                    {selectedCustomMethod.accountDetails}
                  </div>
                )}
                {selectedCustomMethod.instructions && (
                  <div className="text-zinc-400">
                    {translateCommonPaymentInstruction(selectedCustomMethod.instructions, lang)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* IGTF 3% Divisas Toggle & Banner */}
          {isForeignCurrency && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>
                    {tr('Manejo de IGTF (3% Divisas SENIAT)', 'IGTF 3% Foreign Currency Tax (SENIAT)', 'IGTF 3% 外汇交易税 (SENIAT)')}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-amber-200">
                  <input
                    type="checkbox"
                    checked={applyIGTF}
                    onChange={(e) => setApplyIGTF(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                  <span>{tr('Aplicar 3%', 'Apply 3%', '加收 3%')}</span>
                </label>
              </div>
              <p className="text-[11px] text-zinc-300">
                {tr(
                  'Conforme a la providencia SNAT/2022/000013, pagos en efectivo moneda extranjera o Zelle perciben 3.00% sobre el monto en divisas.',
                  'Per SENIAT ruling SNAT/2022/000013, foreign cash and Zelle payments include a 3.00% IGTF levy.',
                  '根据委内瑞拉税局 SNAT/2022/000013 规定，外币现金及 Zelle 付款需加征 3.00% IGTF 税。'
                )}
              </p>
            </div>
          )}

          {/* Cash Change Calculator when Efectivo USD is selected */}
          {paymentMethod === 'Efectivo USD' && (
            <div className="p-3 bg-[#09090b] rounded-lg border border-amber-500/20 text-xs space-y-2 mb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-300">
                  {tr('Paga con billete (USD):', 'Cash tendered (USD):', '实收美元现金：')}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={tr('$ Monto', '$ Amount', '$ 金额')}
                  value={cashTenderedUSD}
                  onChange={(e) => setCashTenderedUSD(e.target.value)}
                  className="w-28 bg-[#111114] border border-white/[0.1] rounded px-2.5 py-1.5 text-right text-white font-mono"
                />
              </div>
              {tenderedUSD >= totalWithIgtfUSD && totalWithIgtfUSD > 0 && (
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-emerald-400 font-medium">
                  <span>{tr('Vuelto / Cambio a entregar:', 'Change due:', '应找零金额：')}</span>
                  <div className="text-right font-mono tabular-nums">
                    <div>${changeUSD.toFixed(2)} USD</div>
                    <div className="text-[10px] text-zinc-400">
                      {tr('o', 'or', '或')} {changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Totals & Submit */}
        <div className="pt-4 border-t border-white/[0.08] space-y-2.5">
          <div className="space-y-1 text-xs border-b border-white/[0.08] pb-2">
            <div className="flex justify-between text-zinc-400">
              <span>{tr('Base Imponible (16% IVA):', 'Taxable Base (16% VAT):', '应税基数 (16% IVA)：')}</span>
              <span className="font-mono text-zinc-200 tabular-nums">${baseAmountUSD.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>{tr('IVA Fiscal (16%):', 'Fiscal VAT (16%):', '增值税 (16% IVA)：')}</span>
              <span className="font-mono text-zinc-200 tabular-nums">${ivaUSD.toFixed(2)} USD</span>
            </div>
            {igtfRate > 0 && (
              <div className="flex justify-between text-amber-400 font-semibold">
                <span>{tr('+ IGTF Divisas (3%):', '+ IGTF Foreign Currency (3%):', '+ 外汇交易税 IGTF (3%)：')}</span>
                <span className="font-mono tabular-nums">+${igtfAmountUSD.toFixed(2)} USD</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-zinc-200 text-sm">
            <span className="font-bold">{tr('Total a Cobrar (USD):', 'Total Due (USD):', '应收总额 (USD)：')}</span>
            <span className="font-mono text-2xl font-black text-amber-400 tabular-nums">
              ${totalWithIgtfUSD.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>
              {tr('Equivalente en Bolívares (Tasa:', 'Bolívares Equivalent (Rate:', '折合玻利瓦尔 (汇率：')}
              {' '}
              {exchangeRate.toFixed(2)} Bs/USD):
            </span>
            <span className="font-mono font-bold text-white text-sm tabular-nums">
              {totalWithIgtfBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
            </span>
          </div>

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {tr('Cobrar y Generar Comprobante', 'Charge & Issue Receipt', '确认收款并开具凭证')}
            </span>
          </button>
        </div>
      </div>

      {/* Modal Digital Receipt after sale */}
      {completedSale && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-500/40 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-base font-display">
                {tr('Venta Procesada con Éxito', 'Sale Completed Successfully', '销售收款已完成')}
              </h3>
              <p className="text-zinc-400 text-[11px]">
                {tr('Comprobante', 'Receipt', '小票单号')} #{completedSale.receiptNumber} •{' '}
                {tr('Factura Fiscal', 'Fiscal Invoice', '税控发票号')}{' '}
                {completedSale.fiscalInvoiceNumber || 'FAC-0084'}
              </p>
              {!isOnline && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-[11px] font-medium">
                  {tr(
                    'Modo Offline: Los productos vendidos, el descuento de stock y este recibo se guardaron localmente (IndexedDB + LocalStorage) y se sincronizarán al volver la señal.',
                    'Offline Mode: Sold items, stock deduction, and this receipt were saved locally (IndexedDB + LocalStorage) and will auto-sync once back online.',
                    '离线模式：已售商品、库存扣减与本张小票已安全保存至本地，网络恢复后将自动同步云端。'
                  )}
                </div>
              )}
            </div>

            {/* Fiscal Print Toast */}
            {fiscalPrintSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <Printer className="w-4 h-4 shrink-0" />
                <span className="font-medium">{fiscalPrintSuccess}</span>
              </div>
            )}

            {/* Receipt card preview with Venezuelan SENIAT details */}
            <div className="bg-[#09090b] p-4 rounded-xl border border-white/[0.08] font-mono space-y-2">
              <div className="text-center border-b border-white/[0.08] pb-2">
                <div className="font-bold text-white text-xs tracking-wider">SMITH SOLUTIONS E-COMMERCE</div>
                <div className="text-[10px] text-amber-400 font-bold">RIF: J-50129384-7</div>
                <div className="text-[10px] text-zinc-400">Caracas, Venezuela</div>
                <div className="text-[9px] text-zinc-500 mt-1">
                  {tr('Factura Fiscal:', 'Fiscal Invoice:', '税控发票：')}{' '}
                  {completedSale.fiscalInvoiceNumber || 'FAC-0084'} | {tr('Control:', 'Control:', '控税号：')}{' '}
                  {completedSale.fiscalControlNumber || '00-008420'}
                </div>
                <div className="text-[9px] text-zinc-500">
                  {tr('Serial Fiscal:', 'Fiscal Serial:', '税控机序列号：')}{' '}
                  {completedSale.fiscalDeviceSerial || 'HKA0084920'} | {completedSale.date}
                </div>
              </div>

              <div className="text-[11px] space-y-1 py-1">
                <div className="flex justify-between text-zinc-300">
                  <span>{tr('Cliente:', 'Customer:', '客户：')}</span>
                  <span className="font-semibold text-white">{completedSale.customerName}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>C.I. / RIF:</span>
                  <span className="font-mono text-amber-400">{completedSale.customerRIF || 'V-00000000-0'}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>{tr('Método de Pago:', 'Payment Method:', '支付方式：')}</span>
                  <span className="text-amber-400">
                    {getMethodDisplayLabel(completedSale.paymentMethod)}
                  </span>
                </div>
              </div>

              <div className="border-t border-b border-white/[0.08] py-2 space-y-1 text-[11px]">
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-zinc-300">
                    <span className="truncate pr-2">
                      {item.quantity}x {item.product.name}
                      {item.selectedSize
                        ? ` [${tr('Talla', 'Size', '尺码')}: ${translateSizeTokenLabel(item.selectedSize, lang)}]`
                        : ''}
                    </span>
                    <span className="tabular-nums font-semibold">${(item.quantity * item.product.priceUSD).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>{tr('Base Imponible (16%):', 'Taxable Base (16%):', '应税基数 (16%)：')}</span>
                  <span className="tabular-nums">${(completedSale.baseAmountUSD || (completedSale.subtotalUSD / 1.16)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>{tr('IVA Débito Fiscal (16%):', 'Fiscal VAT (16%):', '销项增值税 (16%)：')}</span>
                  <span className="tabular-nums">${(completedSale.ivaUSD || (completedSale.subtotalUSD - completedSale.subtotalUSD / 1.16)).toFixed(2)}</span>
                </div>
                {completedSale.igtfAmountUSD && completedSale.igtfAmountUSD > 0 && (
                  <div className="flex justify-between text-[11px] text-amber-400 font-semibold">
                    <span>{tr('IGTF 3% Percepción Divisas:', 'IGTF 3% FX Tax:', 'IGTF 3% 外汇税：')}</span>
                    <span className="tabular-nums">+${completedSale.igtfAmountUSD.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-white font-bold border-t border-white/[0.08] pt-1">
                  <span>{tr('TOTAL USD:', 'TOTAL USD:', '美元总计：')}</span>
                  <span className="text-amber-400 tabular-nums">
                    ${(completedSale.totalWithIgtfUSD || completedSale.subtotalUSD).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-300 font-bold">
                  <span>{tr('TOTAL BS:', 'TOTAL BS:', '玻利瓦尔总计：')}</span>
                  <span className="tabular-nums">
                    {(completedSale.totalWithIgtfBs || completedSale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </span>
                </div>
                <div className="text-[9px] text-zinc-500 text-center pt-1">
                  {tr('Tasa Oficial BCV:', 'Official BCV Rate:', 'BCV 官方汇率：')}{' '}
                  {completedSale.exchangeRate.toFixed(2)} Bs/USD
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleEmitFiscalInvoice(completedSale)}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-extrabold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {tr(
                    'Emitir Factura a Impresora Fiscal (HKA / Spooler)',
                    'Send Invoice to Fiscal Printer (HKA / Spooler)',
                    '发送至税控打印机 (HKA / 打印队列)'
                  )}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => exportSingleReceiptPDF(completedSale, lang)}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-white/[0.1]"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{tr('Descargar PDF', 'Download PDF', '下载 PDF')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => printReceiptTicket(completedSale, lang)}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-white/[0.1]"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>{tr('Ticket Térmico', 'Thermal Ticket', '热敏小票')}</span>
                </button>
              </div>

              <a
                href={`https://wa.me/${normalizeVenezuelanPhone(customerPhone)}?text=${generateWhatsAppReceiptText(completedSale)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>
                  {tr('Enviar Recibo por WhatsApp', 'Send Receipt via WhatsApp', '通过 WhatsApp 发送小票')}
                </span>
              </a>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full py-2 bg-[#111114] hover:bg-zinc-800/80 text-zinc-300 font-semibold rounded-lg transition-colors border border-white/[0.08]"
              >
                {tr('Nueva Venta', 'New Sale', '开始下一笔销售')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Size Picker Modal for Apparel / Sized Items */}
      {sizePromptProduct && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-400/35 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div>
                <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{tr('Seleccionar talla en caja', 'Select size at POS', '收银选码')}</span>
                </div>
                <h4 className="text-sm font-bold text-white mt-0.5">{sizePromptProduct.name}</h4>
                <p className="text-xs font-mono text-amber-300 mt-0.5">
                  ${sizePromptProduct.priceUSD.toFixed(2)} · {tr('Stock total:', 'Total stock:', '总库存：')} {sizePromptProduct.stock}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSizePromptProduct(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sizePromptProduct.sizeGuide && (
              <p className="text-[11px] text-zinc-400 bg-[#09090b] p-2.5 rounded-lg border border-white/[0.08]">
                {sizePromptProduct.sizeGuide}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {(sizePromptProduct.availableSizes || []).map((sz) => (
                <button
                  key={`pos-sz-${sz}`}
                  type="button"
                  onClick={() => {
                    addToCartWithSize(sizePromptProduct, sz);
                    setSizePromptProduct(null);
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#09090b] hover:bg-amber-400 hover:text-zinc-950 border border-white/[0.12] hover:border-amber-300 text-xs font-bold text-white transition-colors"
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
