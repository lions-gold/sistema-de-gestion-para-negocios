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

interface POSModuleProps {
  products: Product[];
  exchangeRate: number;
  onCompleteSale: (sale: Sale) => void;
  onOpenScanner?: () => void;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  exchangeRate,
  onCompleteSale,
  onOpenScanner,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Cliente Mostrador');
  const [customerRIF, setCustomerRIF] = useState('V-27891234-5');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pago Móvil');
  const [applyIGTF, setApplyIGTF] = useState(true);
  const [cashTenderedUSD, setCashTenderedUSD] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const [fiscalPrintSuccess, setFiscalPrintSuccess] = useState<string | null>(null);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
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
            addToCart(found);
            setLastScannedFeedback(`¡Escaneado en PC: ${found.name}!`);
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
            setLastScannedFeedback(`Código "${scanned}" no encontrado en catálogo`);
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

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const isForeignCurrency = paymentMethod === 'Efectivo USD' || paymentMethod === 'Zelle';
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
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const fiscalNum = `FAC-00${Math.floor(1000 + Math.random() * 9000)}`;
    const controlNum = `00-${Math.floor(10000 + Math.random() * 90000)}`;

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      receiptNumber: receiptNum,
      date: now,
      customerName: customerName.trim() || 'Cliente Mostrador',
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
      cashierName: 'Carlos Smith (Caja Principal)',
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
      downloadFiscalSpoolerFile(commandStream, `FacturaFiscal_${sale.fiscalInvoiceNumber || sale.receiptNumber}.txt`);
      setFiscalPrintSuccess(`¡Comando enviado a Impresora Fiscal ${config.brand}! Serial: ${config.serialNumber} | Archivo Spooler descargado.`);
      setTimeout(() => setFiscalPrintSuccess(null), 6000);
    } catch (e) {
      console.error(e);
      setFiscalPrintSuccess('Factura fiscal enviada al spooler local.');
    }
  };

  const generateWhatsAppReceiptText = (sale: Sale) => {
    const itemsList = sale.items
      .map(
        (i) => `• ${i.quantity}x ${i.product.name} = $${(i.quantity * i.product.priceUSD).toFixed(2)}`
      )
      .join('%0A');

    const igtfText = (sale.igtfAmountUSD && sale.igtfAmountUSD > 0)
      ? `%0A*IGTF (3% Divisas)*: +$${sale.igtfAmountUSD.toFixed(2)} USD`
      : '';

    const totalFinalUSD = sale.totalWithIgtfUSD ? sale.totalWithIgtfUSD.toFixed(2) : sale.subtotalUSD.toFixed(2);
    const totalFinalBs = sale.totalWithIgtfBs 
      ? sale.totalWithIgtfBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })
      : sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 });

    return `*SMITH SOLUTIONS E-COMMERCE*%0A*Comprobante de Venta*: ${sale.receiptNumber}%0A*Factura Fiscal*: ${sale.fiscalInvoiceNumber || 'N/A'}%0A*Fecha*: ${sale.date}%0A*Cliente*: ${sale.customerName}%0A*RIF/CI*: ${sale.customerRIF || 'V-00000000-0'}%0A----------------------------%0A${itemsList}%0A----------------------------%0A*Base Imponible (16%)*: $${(sale.baseAmountUSD || (sale.subtotalUSD / 1.16)).toFixed(2)}%0A*IVA (16%)*: $${(sale.ivaUSD || (sale.subtotalUSD - sale.subtotalUSD / 1.16)).toFixed(2)}${igtfText}%0A*TOTAL FINAL USD*: $${totalFinalUSD}%0A*TOTAL BS*: ${totalFinalBs} Bs.%0A*Tasa*: ${sale.exchangeRate.toFixed(2)} Bs/USD%0A*Método de Pago*: ${sale.paymentMethod}%0A----------------------------%0A_Gracias por su compra en Smith Solutions E-Commerce._%0ASoftware por Smith Bussines Solutions 2026`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      {/* Left: Product Selector (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base font-display">
                Catálogo Rápido de Barra y Cava
              </h3>
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Barcode className="w-3 h-3" />
                Lector USB / Pistola Activo
              </span>
            </div>
            <span className="text-xs text-zinc-400">
              Usa la cámara del móvil, haz clic o escanea con pistola de código de barras en PC
            </span>
          </div>

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 transition-all shrink-0 min-h-[40px]"
            >
              <Camera className="w-4 h-4" />
              <span>Lector de Cámara</span>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((p) => {
            const inCart = cart.find((i) => i.product.id === p.id);
            const isOutOfStock = p.stock <= 0;

            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOutOfStock}
                className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
                  isOutOfStock
                    ? 'bg-[#111114]/40 border-white/[0.08] opacity-50 cursor-not-allowed'
                    : inCart
                    ? 'bg-[#111114] border-amber-500/80 shadow-md shadow-amber-500/10'
                    : 'bg-[#111114] border-white/[0.08] hover:border-amber-500/40 hover:bg-zinc-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                    <span>{p.category}</span>
                    <span className={`font-mono ${p.stock <= p.minStock ? 'text-amber-400' : 'text-zinc-400'}`}>
                      Stock: {p.stock}
                    </span>
                  </div>
                  <h4 className="font-medium text-white text-xs sm:text-sm line-clamp-2 mb-2 leading-tight">
                    {p.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-baseline justify-between">
                  <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                    ${p.priceUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                    {(p.priceUSD * exchangeRate).toFixed(0)} Bs.
                  </span>
                </div>

                {inCart && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shadow-md">
                    {inCart.quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Mobile Cart Bar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-18 left-3 right-3 z-30 animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => {
              document.getElementById('checkout-cart')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full p-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold rounded-2xl shadow-xl shadow-black/80 flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs font-bold">
                {cart.reduce((a, b) => a + b.quantity, 0)} ítems en la orden
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold">
              <span>${subtotalUSD.toFixed(2)} USD</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </div>
          </button>
        </div>
      )}

      {/* Right: Checkout & Cart (5 cols) */}
      <div id="checkout-cart" className="lg:col-span-5 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base font-display">
                Orden de Venta en Caja
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* Customer info: Nombre, RIF SENIAT, WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">Cliente / Razón Social</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full bg-[#09090b] border border-white/[0.08] rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1 flex items-center justify-between">
                <span>C.I. / RIF SENIAT</span>
                <span className="text-[10px] text-amber-400 font-mono">Fiscal</span>
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
              <label className="text-zinc-400 block mb-1">WhatsApp / Móvil</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="58414..."
                className="w-full bg-[#09090b] border border-white/[0.08] rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Cart item list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                El carrito está vacío. Agrega licores o bebidas desde el catálogo.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-[#09090b] p-2.5 rounded-lg border border-white/[0.08] flex items-center justify-between text-xs"
                >
                  <div className="flex-1 pr-2">
                    <span className="text-white font-medium block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-zinc-400 font-mono text-[11px]">
                      ${item.product.priceUSD.toFixed(2)} c/u
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#111114] rounded p-0.5 border border-white/[0.08]">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 text-zinc-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono px-1.5 text-white font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 text-zinc-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-mono font-bold text-amber-400 w-16 text-right tabular-nums">
                      ${(item.quantity * item.product.priceUSD).toFixed(2)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400 font-medium">
                Método de Pago
              </label>
              {isForeignCurrency && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Aplica IGTF 3% Divisas
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(
                [
                  'Pago Móvil',
                  'Efectivo USD',
                  'Efectivo Bs',
                  'Punto de Venta',
                  'Zelle',
                  'Fiado (Crédito)',
                ] as PaymentMethod[]
              ).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-2 rounded-lg text-center font-medium transition-colors ${
                    paymentMethod === method
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      : 'bg-[#09090b] text-zinc-300 hover:bg-zinc-800/80 border border-white/[0.08]'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* IGTF 3% Divisas Toggle & Banner */}
          {isForeignCurrency && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Manejo de IGTF (3% Divisas SENIAT)</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-amber-200">
                  <input
                    type="checkbox"
                    checked={applyIGTF}
                    onChange={(e) => setApplyIGTF(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5 rounded"
                  />
                  <span>Aplicar 3%</span>
                </label>
              </div>
              <p className="text-[11px] text-zinc-300">
                Conforme a la providencia SNAT/2022/000013, pagos en efectivo moneda extranjera o Zelle perciben 3.00% sobre el monto en divisas.
              </p>
            </div>
          )}

          {/* Cash Change Calculator when Efectivo USD is selected */}
          {paymentMethod === 'Efectivo USD' && (
            <div className="p-3 bg-[#09090b] rounded-lg border border-amber-500/20 text-xs space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Paga con billete (USD):</span>
                <input
                  type="number"
                  placeholder="$ Monto entregado"
                  value={cashTenderedUSD}
                  onChange={(e) => setCashTenderedUSD(e.target.value)}
                  className="w-24 bg-[#111114] border border-white/[0.1] rounded px-2 py-1 text-right text-white font-mono"
                />
              </div>
              {tenderedUSD >= totalWithIgtfUSD && totalWithIgtfUSD > 0 && (
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-emerald-400 font-medium">
                  <span>Vuelto / Cambio a entregar:</span>
                  <div className="text-right font-mono tabular-nums">
                    <div>${changeUSD.toFixed(2)} USD</div>
                    <div className="text-[10px] text-zinc-400">
                      o {changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
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
              <span>Base Imponible (16% IVA):</span>
              <span className="font-mono text-zinc-200 tabular-nums">${baseAmountUSD.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>IVA Fiscal (16%):</span>
              <span className="font-mono text-zinc-200 tabular-nums">${ivaUSD.toFixed(2)} USD</span>
            </div>
            {igtfRate > 0 && (
              <div className="flex justify-between text-amber-400 font-semibold">
                <span>+ IGTF Divisas (3%):</span>
                <span className="font-mono tabular-nums">+${igtfAmountUSD.toFixed(2)} USD</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-zinc-200 text-sm">
            <span className="font-bold">Total a Cobrar (USD):</span>
            <span className="font-mono text-2xl font-black text-amber-400 tabular-nums">
              ${totalWithIgtfUSD.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Equivalente en Bolívares (Tasa: {exchangeRate.toFixed(2)} Bs/USD):</span>
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
            <span>Cobrar y Generar Comprobante</span>
          </button>
        </div>
      </div>

      {/* Modal Digital Receipt after sale */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-base font-display">
                Venta Procesada con Éxito
              </h3>
              <p className="text-zinc-400 text-[11px]">
                Comprobante #{completedSale.receiptNumber} • Factura Fiscal {completedSale.fiscalInvoiceNumber || 'FAC-0084'}
              </p>
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
                <div className="font-bold text-white text-xs tracking-wider">LA TABERNA LIONS GOLD C.A.</div>
                <div className="text-[10px] text-amber-400 font-bold">RIF: J-50129384-7</div>
                <div className="text-[10px] text-zinc-400">Av. Las Mercedes, Caracas - Venezuela</div>
                <div className="text-[9px] text-zinc-500 mt-1">
                  Factura Fiscal: {completedSale.fiscalInvoiceNumber || 'FAC-0084'} | Control: {completedSale.fiscalControlNumber || '00-008420'}
                </div>
                <div className="text-[9px] text-zinc-500">
                  Serial Fiscal: {completedSale.fiscalDeviceSerial || 'HKA0084920'} | {completedSale.date}
                </div>
              </div>

              <div className="text-[11px] space-y-1 py-1">
                <div className="flex justify-between text-zinc-300">
                  <span>Cliente:</span>
                  <span className="font-semibold text-white">{completedSale.customerName}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>C.I. / RIF:</span>
                  <span className="font-mono text-amber-400">{completedSale.customerRIF || 'V-00000000-0'}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Método de Pago:</span>
                  <span className="text-amber-400">{completedSale.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-b border-white/[0.08] py-2 space-y-1 text-[11px]">
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-zinc-300">
                    <span className="truncate pr-2">{item.quantity}x {item.product.name}</span>
                    <span className="tabular-nums font-semibold">${(item.quantity * item.product.priceUSD).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Base Imponible (16%):</span>
                  <span className="tabular-nums">${(completedSale.baseAmountUSD || (completedSale.subtotalUSD / 1.16)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>IVA Débito Fiscal (16%):</span>
                  <span className="tabular-nums">${(completedSale.ivaUSD || (completedSale.subtotalUSD - completedSale.subtotalUSD / 1.16)).toFixed(2)}</span>
                </div>
                {completedSale.igtfAmountUSD && completedSale.igtfAmountUSD > 0 && (
                  <div className="flex justify-between text-[11px] text-amber-400 font-semibold">
                    <span>IGTF 3% Percepción Divisas:</span>
                    <span className="tabular-nums">+${completedSale.igtfAmountUSD.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-white font-bold border-t border-white/[0.08] pt-1">
                  <span>TOTAL USD:</span>
                  <span className="text-amber-400 tabular-nums">
                    ${(completedSale.totalWithIgtfUSD || completedSale.subtotalUSD).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-300 font-bold">
                  <span>TOTAL BS:</span>
                  <span className="tabular-nums">
                    {(completedSale.totalWithIgtfBs || completedSale.subtotalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </span>
                </div>
                <div className="text-[9px] text-zinc-500 text-center pt-1">
                  Tasa Oficial BCV: {completedSale.exchangeRate.toFixed(2)} Bs/USD
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {/* Primary Fiscal Emission Button */}
              <button
                type="button"
                onClick={() => handleEmitFiscalInvoice(completedSale)}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-extrabold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Emitir Factura a Impresora Fiscal (HKA / Spooler)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => exportSingleReceiptPDF(completedSale)}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-white/[0.1]"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => printReceiptTicket(completedSale)}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-white/[0.1]"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ticket Térmico</span>
                </button>
              </div>

              <a
                href={`https://wa.me/?text=${generateWhatsAppReceiptText(completedSale)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Enviar Recibo por WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full py-2 bg-[#111114] hover:bg-zinc-800/80 text-zinc-300 font-semibold rounded-lg transition-colors border border-white/[0.08]"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
