/**
 * Multi-Tenant PostgreSQL / Drizzle-ready Type Contracts
 * Mirrors supabase-selfhost/init-db/02-multitenant-schema.sql so every
 * store, inventory product, cart, and order is strictly scoped by tenant_id.
 */

export type TenantStatus = 'pending' | 'active' | 'suspended';
export type TenantMemberRole = 'owner' | 'cashier' | 'viewer';
export type TenantOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

export interface TenantRow {
  id: string;
  slug: string | null;
  owner_email: string;
  owner_user_id: string | null;
  store_name: string;
  rif: string;
  whatsapp: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface TenantUserRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  email: string;
  role: TenantMemberRole;
  created_at: string;
}

export interface InventoryProductRow {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  cost_usd: number;
  price_usd: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShoppingCartRow {
  id: string;
  tenant_id: string;
  customer_email: string;
  status: 'open' | 'checked_out' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface CartItemRow {
  id: string;
  tenant_id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price_usd: number;
}

export interface StoreOrderRow {
  id: string;
  tenant_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: string;
  subtotal_usd: number;
  total_usd: number;
  total_bs: number;
  exchange_rate: number;
  status: TenantOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface StoreOrderItemRow {
  id: string;
  tenant_id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
}
