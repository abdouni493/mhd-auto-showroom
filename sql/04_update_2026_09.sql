-- ============================================================================
-- ALTECH SHOWROOM — MIGRATION 04  (September 2026)
--
-- Run this file ONCE on an existing database, after 01_schema.sql,
-- 02_security.sql and 03_storage.sql.
-- (A brand new database gets all of this from 01/02 directly — those files
--  have been updated too, so running them alone is enough for a fresh install.)
--
-- What it does
--   1. Reference tables for the vehicle COLOUR and the vehicle YEAR, so the
--      purchase form can offer a list and let the user create a new entry.
--   2. Removes the SUPPLIERS ("Fournisseurs") feature entirely: the table, the
--      purchases.supplier_id column, the SUPPLIER source type, the related RLS
--      policies and the "suppliers" key of every worker role.
--      Purchases that came from a supplier become SHOWROOM purchases (their
--      amounts, payments and debts are preserved untouched).
--   3. Rebuilds the three views that depended on the above.
--
-- The whole file is transactional: if a statement fails nothing is applied.
-- ============================================================================


-- ============================================================================
-- PART A — enum surgery (must run OUTSIDE the main transaction block below,
--          PostgreSQL forbids using a new enum value in the same transaction
--          that created it). Executed first, on its own.
-- ============================================================================

-- A.1  Any purchase still attached to a supplier becomes a showroom purchase.
--      Guarded so the file stays safe to re-run once 'SUPPLIER' is gone.
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'source_type' AND e.enumlabel = 'SUPPLIER'
  ) THEN
    EXECUTE $q$UPDATE public.purchases
                  SET source_type = 'SHOWROOM'
                WHERE source_type::text = 'SUPPLIER'$q$;
  END IF;
END
$mig$;


BEGIN;

-- ============================================================================
-- PART B — drop the views that depend on suppliers / source_type
-- ============================================================================
DROP VIEW IF EXISTS public.v_dashboard_kpis;
DROP VIEW IF EXISTS public.v_pending_settlements;
DROP VIEW IF EXISTS public.v_cars_full;


-- ============================================================================
-- PART C — remove the suppliers feature
-- ============================================================================

-- C.1  the foreign key column on purchases
DROP INDEX IF EXISTS public.idx_purchases_supplier_id;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS supplier_id;

-- C.2  the table itself (CASCADE also drops its RLS policies and triggers)
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP FUNCTION IF EXISTS public.set_supplier_code() CASCADE;

-- C.3  rebuild source_type without the 'SUPPLIER' value
DO $enum$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'source_type' AND e.enumlabel = 'SUPPLIER'
  ) THEN
    ALTER TABLE public.purchases ALTER COLUMN source_type DROP DEFAULT;
    ALTER TYPE public.source_type RENAME TO source_type_old;
    CREATE TYPE public.source_type AS ENUM ('CLIENT', 'SHOWROOM');
    ALTER TABLE public.purchases
      ALTER COLUMN source_type TYPE public.source_type
      USING source_type::text::public.source_type;
    DROP TYPE public.source_type_old;
  END IF;
  ALTER TABLE public.purchases ALTER COLUMN source_type SET DEFAULT 'SHOWROOM';
END
$enum$;

-- C.4  strip the "suppliers" section from every worker permission map
UPDATE public.worker_roles
   SET permissions = permissions - 'suppliers'
 WHERE permissions ? 'suppliers';


-- ============================================================================
-- PART D — vehicle colour & year reference tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.car_colors (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.car_years (
  id         SERIAL PRIMARY KEY,
  year       INT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_car_years_year ON public.car_years(year DESC);

-- D.1  starter colours
INSERT INTO public.car_colors (name) VALUES
  ('Blanc'), ('Noir'), ('Gris'), ('Gris métallisé'), ('Argent'), ('Bleu'),
  ('Bleu nuit'), ('Rouge'), ('Bordeaux'), ('Vert'), ('Beige'), ('Marron'),
  ('Orange'), ('Jaune'), ('Doré')
ON CONFLICT (name) DO NOTHING;

-- D.2  colours already used by the existing fleet
INSERT INTO public.car_colors (name)
SELECT DISTINCT btrim(color)
  FROM public.cars
 WHERE color IS NOT NULL AND btrim(color) <> ''
ON CONFLICT (name) DO NOTHING;

-- D.3  a sensible range of years + every year already used by the fleet
INSERT INTO public.car_years (year)
SELECT g FROM generate_series(1990, EXTRACT(YEAR FROM NOW())::int + 1) AS g
ON CONFLICT (year) DO NOTHING;

INSERT INTO public.car_years (year)
SELECT DISTINCT year FROM public.cars WHERE year IS NOT NULL AND year > 1900
ON CONFLICT (year) DO NOTHING;


-- ============================================================================
-- PART E — rebuild the views (identical to before, minus every supplier field)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_cars_full AS
SELECT
  c.*,
  p.id                     AS purchase_id,
  p.reference              AS purchase_reference,
  p.source_type,
  p.client_id              AS owner_client_id,
  p.purchase_price,
  p.selling_price,
  p.amount_paid            AS purchase_amount_paid,
  p.amount_rest            AS purchase_amount_rest,
  p.date                   AS purchase_date,
  sl.id                    AS sale_id,
  sl.client_id             AS buyer_client_id,
  sl.sale_type,
  sl.total_after_reduction AS sale_total,
  sl.showroom_share,
  sl.amount_paid           AS sale_amount_paid,
  sl.amount_rest           AS sale_amount_rest,
  cl.first_name            AS buyer_first_name,
  cl.last_name             AS buyer_last_name,
  cl.phone_primary         AS buyer_phone,
  COALESCE(ex.total, 0)    AS car_expenses_total
FROM public.cars c
LEFT JOIN LATERAL (
  SELECT * FROM public.purchases WHERE car_id = c.id ORDER BY created_at DESC LIMIT 1
) p ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.sales WHERE car_id = c.id ORDER BY created_at DESC LIMIT 1
) sl ON true
LEFT JOIN public.clients cl ON cl.id = sl.client_id
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.expenses
   WHERE car_id = c.id AND type = 'CAR'
) ex ON true;


CREATE OR REPLACE VIEW public.v_pending_settlements AS
SELECT
  sl.id                                       AS sale_id,
  sl.reference                                AS sale_reference,
  sl.date                                     AS sale_date,
  sl.total_after_reduction                    AS sale_price,
  COALESCE(sl.showroom_share, 0)              AS showroom_share,
  p.id                                        AS purchase_id,
  p.client_id                                 AS client_id,
  c.id                                        AS car_id,
  c.brand, c.model, c.plate, c.images,
  cl.first_name, cl.last_name, cl.phone_primary,
  COALESCE(ex.total, 0)                       AS expenses_total,
  sl.total_after_reduction
    - COALESCE(sl.showroom_share, 0)
    - COALESCE(ex.total, 0)                   AS owner_amount
FROM public.sales sl
JOIN public.cars c            ON c.id = sl.car_id
JOIN public.purchases p       ON p.car_id = c.id AND p.source_type = 'CLIENT'
JOIN public.clients cl        ON cl.id = p.client_id
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.expenses
   WHERE car_id = c.id AND type = 'CAR'
) ex ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_settlements st WHERE st.sale_id = sl.id
);


CREATE OR REPLACE VIEW public.v_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM public.cars WHERE status = 'AVAILABLE')            AS cars_in_stock,
  (SELECT COUNT(*) FROM public.cars WHERE status = 'SOLD')                 AS cars_sold,
  (SELECT COUNT(*) FROM public.cars WHERE status = 'RESERVED')             AS cars_reserved,
  (SELECT COALESCE(SUM(total_after_reduction), 0) FROM public.sales
     WHERE date >= date_trunc('month', NOW()))                             AS revenue_month,
  (SELECT COALESCE(SUM(amount_rest), 0) FROM public.sales
     WHERE amount_rest > 0)                                                AS client_debts,
  (SELECT COALESCE(SUM(amount_rest), 0) FROM public.purchases
     WHERE amount_rest > 0)                                                AS purchase_debts,
  (SELECT COALESCE(SUM(amount), 0) FROM public.expenses
     WHERE date >= date_trunc('month', CURRENT_DATE)::date)                AS expenses_month,
  (SELECT COUNT(*) FROM public.v_pending_settlements)                      AS pending_settlements;

COMMIT;


-- ============================================================================
-- PART F — security for the two new tables (outside the transaction so a
--          re-run is idempotent even if a policy already exists)
-- ============================================================================

ALTER TABLE public.car_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_years  ENABLE ROW LEVEL SECURITY;

DO $newpol$
DECLARE
  r   RECORD;
  pol TEXT;
BEGIN
  FOREACH pol IN ARRAY ARRAY['car_colors', 'car_years'] LOOP
    FOR r IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = pol
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, pol);
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('car_colors', ARRAY['showroom','purchase','pos','sales','websiteSettings','reports','dashboard'],
                     ARRAY['purchase','showroom'], ARRAY['purchase'], ARRAY['purchase']),
      ('car_years',  ARRAY['showroom','purchase','pos','sales','websiteSettings','reports','dashboard'],
                     ARRAY['purchase','showroom'], ARRAY['purchase'], ARRAY['purchase'])
    ) AS x(tbl, sel, ins, upd, del)
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_any_perm(%L, %L))',
      r.tbl || ' perm select', r.tbl, r.sel, 'view');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_any_perm(%L, %L))',
      r.tbl || ' perm insert', r.tbl, r.ins, 'create');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_any_perm(%L, %L)) WITH CHECK (public.has_any_perm(%L, %L))',
      r.tbl || ' perm update', r.tbl, r.upd, 'edit', r.upd, 'edit');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_any_perm(%L, %L))',
      r.tbl || ' perm delete', r.tbl, r.del, 'delete');
  END LOOP;
END
$newpol$;

-- The public website filters the catalogue by colour / year.
CREATE POLICY "car_colors public read" ON public.car_colors FOR SELECT TO anon USING (true);
CREATE POLICY "car_years public read"  ON public.car_years  FOR SELECT TO anon USING (true);


-- ============================================================================
-- PART G — restore the view grants dropped along with the views
-- ============================================================================
DO $sec$
BEGIN
  ALTER VIEW public.v_cars_full           SET (security_invoker = true);
  ALTER VIEW public.v_pending_settlements SET (security_invoker = true);
  ALTER VIEW public.v_dashboard_kpis      SET (security_invoker = true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'security_invoker not supported on this server, skipped';
END
$sec$;

REVOKE ALL ON public.v_cars_full           FROM anon;
REVOKE ALL ON public.v_pending_settlements FROM anon;
REVOKE ALL ON public.v_dashboard_kpis      FROM anon;

GRANT SELECT ON public.v_cars_full           TO authenticated;
GRANT SELECT ON public.v_pending_settlements TO authenticated;
GRANT SELECT ON public.v_dashboard_kpis      TO authenticated;


-- ============================================================================
-- PART H — rename the application to ALTECH SHOWROOM
--          Only touches the row still carrying an old default name, so a
--          showroom that already set its own identity in Paramètres keeps it.
-- ============================================================================
UPDATE public.settings
   SET name = 'ALTECH SHOWROOM'
 WHERE name IS NULL
    OR btrim(name) = ''
    OR upper(btrim(name)) IN ('MHD AUTO', 'SHOWROOM MHD', 'FIFOU AUTO', 'PRESTIGE AUTO');

UPDATE public.settings
   SET email_sender_name = 'altech showroom'
 WHERE email_sender_name IS NULL
    OR btrim(email_sender_name) = ''
    OR lower(btrim(email_sender_name)) IN ('mhd showroom', 'fifou auto', 'prestige auto');


-- ============================================================================
-- END OF MIGRATION 04
-- ============================================================================
