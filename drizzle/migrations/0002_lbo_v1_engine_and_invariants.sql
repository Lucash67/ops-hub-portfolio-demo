-- Sprint 4.2A — Migration 002: engine schema + integrity invariants INV-01..INV-04
-- Architecture Freeze V1.1

-- ---------------------------------------------------------------------------
-- engine.operations
-- ---------------------------------------------------------------------------
CREATE TABLE engine.operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id),
  status TEXT NOT NULL CHECK (status IN ('executed', 'rejected', 'failed', 'pending')),
  operation_type TEXT NOT NULL,
  source TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  confidence NUMERIC(5, 4),
  duration_ms INTEGER,
  effects_count INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_engine_operations_business_created
  ON engine.operations (business_id, created_at DESC);
CREATE INDEX idx_engine_operations_status ON engine.operations (status);

-- ---------------------------------------------------------------------------
-- engine.operation_payloads
-- ---------------------------------------------------------------------------
CREATE TABLE engine.operation_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES engine.operations (id),
  raw_payload TEXT NOT NULL,
  payload_type TEXT NOT NULL CHECK (payload_type IN ('text', 'structured')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- engine.operation_interpretations
-- ---------------------------------------------------------------------------
CREATE TABLE engine.operation_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES engine.operations (id),
  interpretation JSONB NOT NULL,
  interpreted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- engine.effect_records
-- ---------------------------------------------------------------------------
CREATE TABLE engine.effect_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES engine.operations (id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_engine_effect_records_entity
  ON engine.effect_records (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- engine.domain_events
-- ---------------------------------------------------------------------------
CREATE TABLE engine.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES engine.operations (id),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_engine_domain_events_type_occurred
  ON engine.domain_events (event_type, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- INV-01 & INV-04: sales.business_id and sales.sale_date vs operation_days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_sales_operation_day()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  od_business_id UUID;
  od_operation_date DATE;
BEGIN
  SELECT business_id, operation_date
    INTO od_business_id, od_operation_date
  FROM public.operation_days
  WHERE id = NEW.operation_day_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation_day_id % not found', NEW.operation_day_id;
  END IF;

  IF NEW.business_id IS DISTINCT FROM od_business_id THEN
    RAISE EXCEPTION
      'INV-01 violation: sales.business_id (%) must equal operation_days.business_id (%)',
      NEW.business_id,
      od_business_id;
  END IF;

  IF NEW.sale_date IS DISTINCT FROM od_operation_date THEN
    RAISE EXCEPTION
      'INV-04 violation: sales.sale_date (%) must equal operation_days.operation_date (%)',
      NEW.sale_date,
      od_operation_date;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_operation_day_validate
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sales_operation_day();

-- ---------------------------------------------------------------------------
-- INV-02: sale_items.product_id must belong to same business as parent sale
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_sale_item_product_business()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sale_business_id UUID;
  product_business_id UUID;
BEGIN
  SELECT business_id INTO sale_business_id
  FROM public.sales
  WHERE id = NEW.sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale_id % not found', NEW.sale_id;
  END IF;

  SELECT business_id INTO product_business_id
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_id % not found', NEW.product_id;
  END IF;

  IF sale_business_id IS DISTINCT FROM product_business_id THEN
    RAISE EXCEPTION
      'INV-02 violation: product.business_id (%) must equal sale.business_id (%)',
      product_business_id,
      sale_business_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sale_items_business_validate
  BEFORE INSERT OR UPDATE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sale_item_product_business();

-- ---------------------------------------------------------------------------
-- INV-03: daily_purchases.total_investment = SUM(daily_investments.amount)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_daily_purchase_investment_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  op_day_id UUID;
  purchase_total NUMERIC(12, 2);
  investment_sum NUMERIC(12, 2);
BEGIN
  IF TG_TABLE_NAME = 'daily_purchases' THEN
    op_day_id := NEW.operation_day_id;
    purchase_total := NEW.total_investment;
  ELSE
    op_day_id := COALESCE(NEW.operation_day_id, OLD.operation_day_id);

    SELECT total_investment
      INTO purchase_total
    FROM public.daily_purchases
    WHERE operation_day_id = op_day_id;

    IF NOT FOUND THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO investment_sum
  FROM public.daily_investments
  WHERE operation_day_id = op_day_id;

  IF purchase_total IS DISTINCT FROM investment_sum THEN
    RAISE EXCEPTION
      'INV-03 violation: daily_purchases.total_investment (%) must equal SUM(daily_investments.amount) (%) for operation_day %',
      purchase_total,
      investment_sum,
      op_day_id;
  END IF;

  IF TG_TABLE_NAME = 'daily_purchases' THEN
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_daily_purchases_investment_validate
  BEFORE INSERT OR UPDATE ON public.daily_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_daily_purchase_investment_sum();

CREATE TRIGGER trg_daily_investments_investment_validate
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_investments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_daily_purchase_investment_sum();
