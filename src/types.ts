export interface Product {
  id: string;
  name: string;
  category: 'Licores' | 'Cervezas' | 'Vinos' | 'Bebidas' | 'Snacks';
  sku: string;
  stock: number;
  minStock: number;
  costUSD: number;
  priceUSD: number;
  unit: string;
  barcode: string;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'Pago Móvil' | 'Efectivo USD' | 'Efectivo Bs' | 'Punto de Venta' | 'Zelle' | 'Fiado (Crédito)';

export interface Sale {
  id: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  items: CartItem[];
  subtotalUSD: number;
  subtotalBs: number;
  paymentMethod: PaymentMethod;
  exchangeRate: number;
  status: 'Completada' | 'Pendiente (Fiado)';
}

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  balanceUSD: number;
  lastPurchaseDate: string;
  notes: string;
  history: {
    date: string;
    description: string;
    amountUSD: number;
    type: 'cargo' | 'abono';
  }[];
}

export interface CashMovement {
  id: string;
  type: 'ingreso' | 'gasto';
  category: 'Venta' | 'Inventario' | 'Servicios' | 'Caja Chica' | 'Nómina' | 'Otro';
  description: string;
  amountUSD: number;
  date: string;
}
