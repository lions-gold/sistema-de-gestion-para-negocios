-- Multi-Tenant SaaS Relational Schema (PostgreSQL / Self-Hosted Supabase)
-- Strict tenant_id isolation linking each authenticated Google user to their independent store.

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  owner_email TEXT NOT NULL,
  owner_user_id UUID REFERENCES public.synced_users(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  rif TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.synced_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS public.inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS public.shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cart_id UUID NOT NULL REFERENCES public.shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12, 2) NOT NULL CHECK (unit_price_usd >= 0),
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  payment_method TEXT NOT NULL,
  subtotal_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_bs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(12, 4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12, 2) NOT NULL CHECK (unit_price_usd >= 0),
  subtotal_usd NUMERIC(12, 2) NOT NULL CHECK (subtotal_usd >= 0)
);

-- Performance indexes scoped by tenant_id
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON public.tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_tenant ON public.inventory_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_tenant ON public.shopping_carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_tenant ON public.store_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_tenant ON public.store_order_items(tenant_id);

-- Strict Row-Level Security (tenant isolation)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant owner reads own tenant" ON public.tenants;
CREATE POLICY "Tenant owner reads own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant isolation on inventory_products" ON public.inventory_products;
CREATE POLICY "Tenant isolation on inventory_products"
  ON public.inventory_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = inventory_products.tenant_id
        AND t.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = inventory_products.tenant_id
        AND t.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant isolation on store_orders" ON public.store_orders;
CREATE POLICY "Tenant isolation on store_orders"
  ON public.store_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = store_orders.tenant_id
        AND t.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = store_orders.tenant_id
        AND t.owner_user_id = auth.uid()
    )
  );

GRANT ALL ON public.tenants, public.tenant_users, public.inventory_products, public.shopping_carts, public.cart_items, public.store_orders, public.store_order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_products, public.store_orders TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
