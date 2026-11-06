import React, { useState } from 'react';
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
  X
} from 'lucide-react';

interface POSModuleProps {
  products: Product[];
  exchangeRate: number;
  onCompleteSale: (sale: Sale) => void;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  exchangeRate,
  onCompleteSale,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Cliente Mostrador');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pago Móvil');
  const [cashTenderedUSD, setCashTenderedUSD] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

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

  const subtotalUSD = cart.reduce((acc, item) => acc + (item.product.priceUSD * item.quantity), 0);
  const subtotalBs = subtotalUSD * exchangeRate;

  // Change calculator for USD cash
  const tenderedUSD = parseFloat(cashTenderedUSD) || 0;
  const changeUSD = tenderedUSD > subtotalUSD ? tenderedUSD - subtotalUSD : 0;
  const changeBs = changeUSD * exchangeRate;

  const handleProcessSale = () => {
    if (cart.length === 0) return;

    const receiptNum = `LG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      receiptNumber: receiptNum,
      date: now,
      customerName: customerName.trim() || 'Cliente Mostrador',
      items: [...cart],
      subtotalUSD,
      subtotalBs,
      paymentMethod,
      exchangeRate,
      status: paymentMethod === 'Fiado (Crédito)' ? 'Pendiente (Fiado)' : 'Completada',
    };

    onCompleteSale(newSale);
    setCompletedSale(newSale);
    setCart([]);
    setCashTenderedUSD('');
  };

  const generateWhatsAppReceiptText = (sale: Sale) => {
    const itemsList = sale.items
      .map(
        (i) => `• ${i.quantity}x ${i.product.name} = $${(i.quantity * i.product.priceUSD).toFixed(2)}`
      )
      .join('%0A');

    return `*LA TABERNA LIONS GOLD*%0A*Comprobante de Venta*: ${sale.receiptNumber}%0A*Fecha*: ${sale.date}%0A*Cliente*: ${sale.customerName}%0A----------------------------%0A${itemsList}%0A----------------------------%0A*TOTAL USD*: $${sale.subtotalUSD.toFixed(2)}%0A*TOTAL BS*: ${sale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.%0A*Tasa*: ${sale.exchangeRate.toFixed(2)} Bs/USD%0A*Método de Pago*: ${sale.paymentMethod}%0A----------------------------%0A_Gracias por su compra en La Taberna Lions Gold._%0ASoftware por Smith Bussines Solutions 2026`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Product Selector (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base font-display">
            Catálogo Rápido de Barra y Cava
          </h3>
          <span className="text-xs text-slate-400">
            Haz clic para agregar al carrito
          </span>
        </div>

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
                    ? 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'
                    : inCart
                    ? 'bg-slate-900 border-amber-500/80 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-amber-500/40 hover:bg-slate-850'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>{p.category}</span>
                    <span className={`font-mono ${p.stock <= p.minStock ? 'text-amber-400' : 'text-slate-400'}`}>
                      Stock: {p.stock}
                    </span>
                  </div>
                  <h4 className="font-medium text-white text-xs sm:text-sm line-clamp-2 mb-2 leading-tight">
                    {p.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                  <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                    ${p.priceUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {(p.priceUSD * exchangeRate).toFixed(0)} Bs.
                  </span>
                </div>

                {inCart && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-md">
                    {inCart.quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Checkout & Cart (5 cols) */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
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

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Cliente</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">WhatsApp / Teléfono</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="58414..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Cart item list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                El carrito está vacío. Agrega licores o bebidas desde el catálogo.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 pr-2">
                    <span className="text-white font-medium block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ${item.product.priceUSD.toFixed(2)} c/u
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 rounded p-0.5 border border-slate-800">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono px-1.5 text-white font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-mono font-bold text-amber-400 w-16 text-right tabular-nums">
                      ${(item.quantity * item.product.priceUSD).toFixed(2)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 mb-4">
            <label className="text-xs text-slate-400 block font-medium">
              Método de Pago
            </label>
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
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Cash Change Calculator when Efectivo USD is selected */}
          {paymentMethod === 'Efectivo USD' && (
            <div className="p-3 bg-slate-950 rounded-lg border border-amber-500/20 text-xs space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Paga con billete (USD):</span>
                <input
                  type="number"
                  placeholder="$ Monto entregado"
                  value={cashTenderedUSD}
                  onChange={(e) => setCashTenderedUSD(e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono"
                />
              </div>
              {tenderedUSD >= subtotalUSD && subtotalUSD > 0 && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-emerald-400 font-medium">
                  <span>Vuelto / Cambio a entregar:</span>
                  <div className="text-right font-mono tabular-nums">
                    <div>${changeUSD.toFixed(2)} USD</div>
                    <div className="text-[10px] text-slate-400">
                      o {changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Totals & Submit */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-300 text-sm">
            <span>Total en Dólares (USD):</span>
            <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
              ${subtotalUSD.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Equivalente en Bolívares ({exchangeRate.toFixed(2)} Bs/USD):</span>
            <span className="font-mono font-bold text-white text-base tabular-nums">
              {subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
            </span>
          </div>

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Cobrar y Generar Comprobante</span>
          </button>
        </div>
      </div>

      {/* Modal Digital Receipt after sale */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-xs space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-base font-display">
                Venta Procesada con Éxito
              </h3>
              <p className="text-slate-400 text-[11px]">
                Comprobante #{completedSale.receiptNumber}
              </p>
            </div>

            {/* Receipt card preview */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-2">
              <div className="text-center border-b border-slate-800 pb-2">
                <div className="font-bold text-white text-xs">LA TABERNA LIONS GOLD</div>
                <div className="text-[10px] text-slate-500">Almacén & Punto de Venta</div>
                <div className="text-[10px] text-slate-400">{completedSale.date}</div>
              </div>

              <div className="text-[11px] space-y-1 py-1">
                <div className="flex justify-between text-slate-300">
                  <span>Cliente:</span>
                  <span className="font-semibold text-white">{completedSale.customerName}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Método:</span>
                  <span className="text-amber-400">{completedSale.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-800 py-2 space-y-1 text-[11px]">
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-300">
                    <span className="truncate pr-2">{item.quantity}x {item.product.name}</span>
                    <span className="tabular-nums font-semibold">${(item.quantity * item.product.priceUSD).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-1">
                <div className="flex justify-between text-xs text-white font-bold">
                  <span>TOTAL USD:</span>
                  <span className="text-amber-400 tabular-nums">${completedSale.subtotalUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>TOTAL BS:</span>
                  <span className="tabular-nums font-semibold">{completedSale.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</span>
                </div>
                <div className="text-[9px] text-slate-500 text-center pt-2">
                  Tasa aplicada: {completedSale.exchangeRate.toFixed(2)} Bs/USD
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
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
                onClick={() => setCompletedSale(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors"
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
