-- Sprint 4.2A — Migration 001: extensions, schemas, public domain tables
-- Architecture Freeze V1.1

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS engine;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_businesses_status ON public.businesses (status);

-- ---------------------------------------------------------------------------
-- operation_days
-- ---------------------------------------------------------------------------
CREATE TABLE public.operation_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  operation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'homologated')),
  daily_goal_units INTEGER CHECK (daily_goal_units IS NULL OR daily_goal_units >= 0),
  homologated_at TIMESTAMPTZ,
  homologation_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT operation_days_business_id_operation_date_unique UNIQUE (business_id, operation_date)
);

CREATE INDEX idx_operation_days_business_date
  ON public.operation_days (business_id, operation_date DESC);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_business ON public.products (business_id);
CREATE INDEX idx_products_business_status ON public.products (business_id, status);
CREATE UNIQUE INDEX idx_products_business_name_active
  ON public.products (business_id, name)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT,
  company TEXT,
  phone TEXT,
  notes TEXT,
  registered_business_id UUID REFERENCES public.businesses (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_registered_business ON public.clients (registered_business_id);
CREATE INDEX idx_clients_name ON public.clients (name);

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id),
  client_id UUID REFERENCES public.clients (id),
  sale_date DATE NOT NULL,
  sale_time TIME NOT NULL,
  department TEXT,
  payment_method TEXT CHECK (payment_method IN ('pix', 'card', 'cash')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  amount_received NUMERIC(12, 2) NOT NULL DEFAULT 0,
  settlement_date DATE,
  total_amount NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL,
  profit NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_business_date ON public.sales (business_id, sale_date DESC);
CREATE INDEX idx_sales_operation_day ON public.sales (operation_day_id);
CREATE INDEX idx_sales_client ON public.sales (client_id);

-- ---------------------------------------------------------------------------
-- sale_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  profit NUMERIC(12, 2) NOT NULL,
  flavor_confidence TEXT CHECK (flavor_confidence IN ('confirmed', 'unknown', 'estimated'))
);

CREATE INDEX idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items (product_id);

-- ---------------------------------------------------------------------------
-- daily_purchases
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL UNIQUE REFERENCES public.operation_days (id),
  total_units INTEGER NOT NULL CHECK (total_units > 0),
  total_investment NUMERIC(12, 2) NOT NULL CHECK (total_investment >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- daily_purchase_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_purchase_id UUID NOT NULL REFERENCES public.daily_purchases (id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products (id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 4)
);

CREATE INDEX idx_daily_purchase_items_purchase ON public.daily_purchase_items (daily_purchase_id);

-- ---------------------------------------------------------------------------
-- daily_investments
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  investment_type TEXT NOT NULL CHECK (investment_type IN ('initial', 'additional', 'withdrawal')),
  source_type TEXT NOT NULL CHECK (
    source_type IN ('own_capital', 'family', 'partner', 'investor', 'supplier', 'loan', 'other')
  ),
  source_name TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_investments_operation_day ON public.daily_investments (operation_day_id);
CREATE INDEX idx_daily_investments_source ON public.daily_investments (source_type, source_name);

-- ---------------------------------------------------------------------------
-- cash_flow_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.cash_flow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  operation_day_id UUID REFERENCES public.operation_days (id),
  sale_id UUID REFERENCES public.sales (id),
  event_type TEXT NOT NULL CHECK (event_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_flow_business_date ON public.cash_flow_events (business_id, event_date DESC);
CREATE INDEX idx_cash_flow_sale ON public.cash_flow_events (sale_id);

-- ---------------------------------------------------------------------------
-- stock_movements
-- ---------------------------------------------------------------------------
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id),
  operation_day_id UUID REFERENCES public.operation_days (id),
  sale_id UUID REFERENCES public.sales (id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_product_created
  ON public.stock_movements (product_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- diary_entries
-- ---------------------------------------------------------------------------
CREATE TABLE public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL UNIQUE REFERENCES public.operation_days (id),
  schema_version INTEGER NOT NULL DEFAULT 1,
  revenue_received NUMERIC(12, 2) NOT NULL,
  revenue_pending NUMERIC(12, 2) NOT NULL DEFAULT 0,
  revenue_total NUMERIC(12, 2) NOT NULL,
  operational_profit NUMERIC(12, 2) NOT NULL,
  quantity_sold INTEGER NOT NULL,
  quantity_lost INTEGER NOT NULL DEFAULT 0,
  observations TEXT,
  manual_insights TEXT,
  commercial_intelligence JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  narrative JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- operational_lessons
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_lessons_operation_day
  ON public.operational_lessons (operation_day_id);

-- ---------------------------------------------------------------------------
-- product_hypotheses
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id) ON DELETE CASCADE,
  flavor TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  confirmed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- operational_actions
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
  source TEXT NOT NULL DEFAULT 'diary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_actions_status
  ON public.operational_actions (status)
  WHERE status != 'done';

-- ---------------------------------------------------------------------------
-- operational_pendings
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_pendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id) ON DELETE CASCADE,
  pending_type TEXT NOT NULL CHECK (
    pending_type IN ('inventory_investigation', 'flavor_unknown', 'client_unknown', 'payment_pending')
  ),
  product_id UUID REFERENCES public.products (id),
  client_id UUID REFERENCES public.clients (id),
  sale_id UUID REFERENCES public.sales (id),
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_amount NUMERIC(12, 2),
  potential_revenue NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'converted_to_loss')),
  description TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- operational_losses
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_losses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_day_id UUID NOT NULL REFERENCES public.operation_days (id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products (id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- future_orders
-- ---------------------------------------------------------------------------
CREATE TABLE public.future_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  client_id UUID REFERENCES public.clients (id),
  product_id UUID REFERENCES public.products (id),
  product_name TEXT,
  quantity INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'confirmed', 'fulfilled', 'cancelled')),
  origin_operation_day_id UUID REFERENCES public.operation_days (id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_future_orders_business_scheduled
  ON public.future_orders (business_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  goal_type TEXT NOT NULL CHECK (goal_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  target_amount NUMERIC(12, 2) NOT NULL,
  target_units INTEGER,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_business_type
  ON public.goals (business_id, goal_type, period_start DESC);

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
