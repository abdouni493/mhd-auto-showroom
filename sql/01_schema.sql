-- ============================================================================
--  SHOWROOM MHD AUTO - COMPLETE SUPABASE SCHEMA  (part 1/3 : tables & triggers)
--  Project : https://nnqrfbqxqfepjwglfgiu.supabase.co
--
--  Run 01_schema.sql, then 02_security.sql, then 03_storage.sql
--  in : Supabase Dashboard -> SQL Editor -> New query
--  Every file is idempotent: re-running it is safe.
--
--  Covers every interface and every button-action of the application:
--    Dashboard, Showroom, Achats, POS, Ventes, Paiements, Reglements
--    proprietaires, Caisse, Clients, Fournisseurs, Employes + permissions,
--    Depenses, Rapports, Parametres, Site web, Impressions et envois email.
--
--  IMPORTANT (one click, no SQL):
--    Authentication -> Providers -> Email -> turn OFF "Confirm email"
--    so a new admin / worker can sign in immediately after creation.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================
DO $enums$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'car_status') THEN
    CREATE TYPE car_status AS ENUM ('AVAILABLE', 'SOLD', 'RESERVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'energy_type') THEN
    CREATE TYPE energy_type AS ENUM ('ESSENCE', 'DIESEL', 'HYBRID', 'ELECTRIC');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gearbox_type') THEN
    CREATE TYPE gearbox_type AS ENUM ('MANUAL', 'AUTO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    -- CLIENT   : "Prestation (Depot client)" - the car belongs to a client and
    --            is only displayed / marketed by the showroom for the owner
    -- SHOWROOM : the showroom owner bought the car himself
    CREATE TYPE source_type AS ENUM ('CLIENT', 'SHOWROOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_type') THEN
    CREATE TYPE sale_type AS ENUM ('NORMAL', 'DEPOSIT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reduction_type') THEN
    CREATE TYPE reduction_type AS ENUM ('NONE', 'PERCENT', 'FIXED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_type') THEN
    CREATE TYPE expense_type AS ENUM ('CAR', 'SHOWROOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pay_type') THEN
    CREATE TYPE pay_type AS ENUM ('MONTHLY', 'DAILY', 'NONE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    CREATE TYPE reservation_status AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_tx_type') THEN
    CREATE TYPE cash_tx_type AS ENUM ('DEPOSIT', 'WITHDRAWAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    CREATE TYPE settlement_status AS ENUM ('PENDING', 'SETTLED');
  END IF;
END
$enums$;

-- Upgrade a database created before the SHOWROOM source existed.
-- Kept as a top-level statement: PostgreSQL refuses ALTER TYPE ... ADD VALUE
-- from inside a function or a DO block.
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'SHOWROOM';


-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1  users - admin accounts, mirrors auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id    UUID UNIQUE,                       -- = auth.users.id
  full_name  TEXT NOT NULL DEFAULT '',
  username   TEXT UNIQUE,
  email      TEXT UNIQUE,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 2.2  settings - one row: the showroom identity printed on every document
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id                  SERIAL PRIMARY KEY,
  name                TEXT,
  description         TEXT,
  email               TEXT,
  phone               TEXT,
  phone2              TEXT,
  address             TEXT,
  nif                 TEXT,
  nis                 TEXT,
  article             TEXT,
  rc                  TEXT,
  rib                 TEXT,
  logo_url            TEXT,                      -- bucket: showroom-logo
  facebook            TEXT,
  instagram           TEXT,
  tiktok              TEXT,
  maps                TEXT,
  whatsapp            TEXT,
  -- reusable inspection checklist shared by purchases and sales
  inspection_template JSONB DEFAULT '{}'::jsonb,
  -- transactional email (Brevo) identity
  email_sender_name   TEXT,
  email_sender        TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS phone2              TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS rib                 TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS inspection_template JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS email_sender_name   TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS email_sender        TEXT;

INSERT INTO public.settings (name, email_sender_name, email_sender)
SELECT 'MHD AUTO', 'mhd showroom', 'icarmhd@gmail.com'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);


-- ----------------------------------------------------------------------------
-- 2.4  clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id                   SERIAL PRIMARY KEY,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  phone_primary        TEXT NOT NULL,
  phone_secondary      TEXT,
  email                TEXT,
  address              TEXT,
  profession           TEXT,
  birth_date           DATE,
  birth_place          TEXT,
  gender               CHAR(1),
  doc_type             TEXT,
  doc_number           TEXT,
  doc_delivery_date    DATE,
  doc_expiry           DATE,
  doc_delivery_address TEXT,
  nif                  TEXT,
  rc                   TEXT,
  photo_url            TEXT,                     -- bucket: client-photos
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(last_name, first_name);


-- ----------------------------------------------------------------------------
-- 2.5  worker_roles - the permission map that gates every worker interface
--      permissions shape:
--        { "<section>": { "view":bool, "create":bool, "edit":bool,
--                         "delete":bool, "print":bool } }
--      sections: dashboard, showroom, purchase, pos, sales, payments,
--                settlements, caisse, websiteSettings, websiteReservations,
--                clients, workers, expenses, reports, settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_roles (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 2.6  workers (Employes) - optional login linked to auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workers (
  id              SERIAL PRIMARY KEY,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  birthday        DATE,
  id_card_number  TEXT,
  role_id         INT REFERENCES public.worker_roles(id) ON DELETE SET NULL,
  payment_type    pay_type DEFAULT 'NONE',
  payment_amount  NUMERIC(12,2) DEFAULT 0,
  start_date      DATE,
  account_enabled BOOLEAN DEFAULT false,
  auth_id         UUID UNIQUE,                   -- = auth.users.id
  email           TEXT,
  username        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workers_auth_id ON public.workers(auth_id);


-- ----------------------------------------------------------------------------
-- 2.7  worker_payments / worker_advances / worker_absences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_payments (
  id          SERIAL PRIMARY KEY,
  worker_id   INT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  month       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_advances (
  id          SERIAL PRIMARY KEY,
  worker_id   INT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  is_paid     BOOLEAN DEFAULT false,
  paid_at     TIMESTAMPTZ,
  payment_id  INT REFERENCES public.worker_payments(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_absences (
  id          SERIAL PRIMARY KEY,
  worker_id   INT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  is_paid     BOOLEAN DEFAULT false,
  paid_at     TIMESTAMPTZ,
  payment_id  INT REFERENCES public.worker_payments(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 2.8  cars (Vehicules)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cars (
  id         SERIAL PRIMARY KEY,
  brand      TEXT NOT NULL,
  model      TEXT NOT NULL,
  plate      TEXT,
  year       INT,
  color      TEXT,
  energy     energy_type DEFAULT 'ESSENCE',
  gearbox    gearbox_type DEFAULT 'MANUAL',
  seats      INT,
  mileage    INT,
  vin        TEXT,
  keys_count INT,
  fiche      TEXT,
  -- extra technical data printed on the "Fiche technique"
  -- { engine, power, fuel, transmission, consumption, wheelbase, trunk,
  --   weight, tank, dimensions }
  specs      JSONB DEFAULT '{}'::jsonb,
  status     car_status DEFAULT 'AVAILABLE',
  hidden     BOOLEAN DEFAULT false,
  -- public price mirrored from the purchase so the public website can read it
  -- without exposing the whole purchases table to anonymous visitors
  price      NUMERIC(12,2) DEFAULT 0,
  images     JSONB DEFAULT '[]'::jsonb,          -- bucket: car-images (full URLs)
  inspection JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_hidden ON public.cars(hidden);


-- ----------------------------------------------------------------------------
-- 2.9  car_document_types + car_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_document_types (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

INSERT INTO public.car_document_types (name) VALUES
  ('Carte Grise'), ('Double cles'), ('Dossier de fonds'), ('Assurance'),
  ('Carnet'), ('Jeu de tapis'), ('Roue de secours'), ('Gonfleur'),
  ('Liquide de pneu'), ('Controle Technique'), ('Carte de Propriete')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.car_documents (
  id         SERIAL PRIMARY KEY,
  car_id     INT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  doc_url    TEXT,                               -- bucket: car-documents
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_car_documents_car_id ON public.car_documents(car_id);


-- ----------------------------------------------------------------------------
-- 2.9b car_colors + car_years
--      Reference lists behind the "Couleur" and "Annee" pickers of the
--      purchase form. The user picks an existing entry or creates a new one
--      without leaving the form.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_colors (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.car_colors (name) VALUES
  ('Blanc'), ('Noir'), ('Gris'), ('Gris metallise'), ('Argent'), ('Bleu'),
  ('Bleu nuit'), ('Rouge'), ('Bordeaux'), ('Vert'), ('Beige'), ('Marron'),
  ('Orange'), ('Jaune'), ('Dore')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.car_years (
  id         SERIAL PRIMARY KEY,
  year       INT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_car_years_year ON public.car_years(year DESC);

INSERT INTO public.car_years (year)
SELECT g FROM generate_series(1990, EXTRACT(YEAR FROM NOW())::int + 1) AS g
ON CONFLICT (year) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2.10 purchases (Achats)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
  id             SERIAL PRIMARY KEY,
  reference      TEXT UNIQUE,                     -- ACH-0001
  entry_number   TEXT,                            -- "N Bon d'entree"
  car_id         INT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  source_type    source_type NOT NULL DEFAULT 'SHOWROOM',
  client_id      INT REFERENCES public.clients(id) ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12,2) DEFAULT 0,
  amount_paid    NUMERIC(12,2) DEFAULT 0,
  amount_rest    NUMERIC(12,2) GENERATED ALWAYS AS (purchase_price - amount_paid) STORED,
  -- "Formulaire reception vehicule"
  received_at    TIMESTAMPTZ,
  received_by    TEXT,
  received_phone TEXT,
  remark         TEXT,
  date           TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS entry_number   TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS received_at    TIMESTAMPTZ;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS received_by    TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS received_phone TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS remark         TEXT;
CREATE INDEX IF NOT EXISTS idx_purchases_car_id      ON public.purchases(car_id);
CREATE INDEX IF NOT EXISTS idx_purchases_client_id   ON public.purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_source_type ON public.purchases(source_type);

CREATE OR REPLACE FUNCTION public.set_purchase_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'ACH-' || LPAD(NEW.id::text, 4, '0');
  END IF;
  IF NEW.entry_number IS NULL THEN
    NEW.entry_number := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_purchase_reference ON public.purchases;
CREATE TRIGGER trg_purchase_reference
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_purchase_reference();

-- mirror the selling price onto the car (public website price)
CREATE OR REPLACE FUNCTION public.sync_car_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE public.cars SET price = COALESCE(NEW.selling_price, 0) WHERE id = NEW.car_id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_car_price ON public.purchases;
CREATE TRIGGER trg_sync_car_price
  AFTER INSERT OR UPDATE OF selling_price ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.sync_car_price();


-- NOTE ON THE BOOKKEEPING TRIGGERS
-- The triggers that maintain derived data (amount_paid, car status, public
-- price, initial payment) are SECURITY DEFINER on purpose: they must succeed
-- whatever the row level security of the employee who triggered them. Without
-- it, an employee allowed to record a payment but not to edit a sale would see
-- his own payment refused by the trigger that updates that sale.

-- ----------------------------------------------------------------------------
-- 2.11 purchase_payments (paying off a purchase debt)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id          SERIAL PRIMARY KEY,
  purchase_id INT NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  date        TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id
  ON public.purchase_payments(purchase_id);

CREATE OR REPLACE FUNCTION public.update_purchase_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE pid INT;
BEGIN
  pid := COALESCE(NEW.purchase_id, OLD.purchase_id);
  UPDATE public.purchases p
     SET amount_paid = (
       SELECT COALESCE(SUM(amount), 0)
         FROM public.purchase_payments
        WHERE purchase_id = pid
     )
   WHERE p.id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_update_purchase_paid ON public.purchase_payments;
CREATE TRIGGER trg_update_purchase_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_purchase_paid();


-- ----------------------------------------------------------------------------
-- 2.12 sales (Ventes / POS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id                    SERIAL PRIMARY KEY,
  reference             TEXT UNIQUE,              -- VNT-0001
  car_id                INT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  client_id             INT REFERENCES public.clients(id) ON DELETE SET NULL,
  sale_type             sale_type DEFAULT 'NORMAL',
  total_before_tax      NUMERIC(12,2) DEFAULT 0,
  tva_enabled           BOOLEAN DEFAULT false,
  tva_rate              NUMERIC(5,2) DEFAULT 19,
  stamp_enabled         BOOLEAN DEFAULT false,    -- "TIMBRE 2%" on the invoice
  stamp_rate            NUMERIC(5,2) DEFAULT 2,
  reduction_type        reduction_type DEFAULT 'NONE',
  reduction_value       NUMERIC(12,2) DEFAULT 0,
  total_after_reduction NUMERIC(12,2) DEFAULT 0,
  amount_paid           NUMERIC(12,2) DEFAULT 0,
  amount_rest           NUMERIC(12,2) GENERATED ALWAYS AS (total_after_reduction - amount_paid) STORED,
  -- Part of the sale kept by the showroom when the vehicle belongs to a client
  -- (purchase.source_type = 'CLIENT'). The rest, minus the car expenses, is
  -- paid back to the owner through a reglement (client_settlements).
  showroom_share        NUMERIC(12,2) DEFAULT 0,
  payment_method        TEXT,
  client_take_car       BOOLEAN DEFAULT true,
  inspection            JSONB DEFAULT '{}'::jsonb,
  date                  TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS showroom_share NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS stamp_enabled  BOOLEAN DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS stamp_rate     NUMERIC(5,2) DEFAULT 2;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
CREATE INDEX IF NOT EXISTS idx_sales_car_id    ON public.sales(car_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_date      ON public.sales(date);

CREATE OR REPLACE FUNCTION public.set_sale_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'VNT-' || LPAD(NEW.id::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sale_reference ON public.sales;
CREATE TRIGGER trg_sale_reference
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_sale_reference();

-- the car status follows the sale (SOLD when taken, RESERVED on a deposit)
CREATE OR REPLACE FUNCTION public.sync_car_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE public.cars
     SET status = CASE WHEN NEW.client_take_car THEN 'SOLD'::car_status
                       ELSE 'RESERVED'::car_status END
   WHERE id = NEW.car_id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_car_status ON public.sales;
CREATE TRIGGER trg_sync_car_status
  AFTER INSERT OR UPDATE OF client_take_car, car_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_car_status();

-- deleting a sale puts the vehicle back in stock
CREATE OR REPLACE FUNCTION public.release_car_on_sale_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE public.cars SET status = 'AVAILABLE' WHERE id = OLD.car_id;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_release_car_on_sale_delete ON public.sales;
CREATE TRIGGER trg_release_car_on_sale_delete
  AFTER DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.release_car_on_sale_delete();


-- ----------------------------------------------------------------------------
-- 2.13 sale_payments (Reglements clients - page Paiements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id          SERIAL PRIMARY KEY,
  reference   TEXT,                               -- REG-0001
  sale_id     INT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  car_id      INT REFERENCES public.cars(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- true for the down payment recorded when the sale itself was created
  is_initial  BOOLEAN NOT NULL DEFAULT false,
  date        TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS reference  TEXT;
ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS is_initial BOOLEAN NOT NULL DEFAULT false;

DO $uniq$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_payments_reference_key') THEN
    ALTER TABLE public.sale_payments ADD CONSTRAINT sale_payments_reference_key UNIQUE (reference);
  END IF;
END
$uniq$;

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_car_id  ON public.sale_payments(car_id);

CREATE OR REPLACE FUNCTION public.set_sale_payment_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'REG-' || LPAD(NEW.id::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sale_payment_reference ON public.sale_payments;
CREATE TRIGGER trg_sale_payment_reference
  BEFORE INSERT ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_sale_payment_reference();

CREATE OR REPLACE FUNCTION public.update_sale_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE sid INT;
BEGIN
  sid := COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.sales s
     SET amount_paid = (
       SELECT COALESCE(SUM(amount), 0) FROM public.sale_payments WHERE sale_id = sid
     )
   WHERE s.id = sid;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_update_sale_paid ON public.sale_payments;
CREATE TRIGGER trg_update_sale_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_sale_paid();

-- `amount_paid` is rebuilt from sale_payments as soon as one is recorded, so the
-- down payment collected when the sale was created must be a payment row too -
-- otherwise the first "payer la dette" would erase it.
CREATE OR REPLACE FUNCTION public.seed_initial_sale_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF COALESCE(NEW.amount_paid, 0) > 0 THEN
    INSERT INTO public.sale_payments (sale_id, car_id, amount, is_initial, date, description)
    VALUES (NEW.id, NEW.car_id, NEW.amount_paid, true, NEW.date, 'Versement initial');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_seed_initial_sale_payment ON public.sales;
CREATE TRIGGER trg_seed_initial_sale_payment
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.seed_initial_sale_payment();


-- ----------------------------------------------------------------------------
-- 2.14 client_settlements - "Reglement proprietaire"
--      Created when the showroom pays the owner of a deposited vehicle
--      (purchase.source_type = 'CLIENT') after it has been sold.
--        owner_amount = sale_price - showroom_share - expenses_total
--      A sale of a client vehicle WITHOUT a row here raises the alert shown on
--      the dashboard, on the sidebar Clients entry and on the Clients page.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_settlements (
  id             SERIAL PRIMARY KEY,
  reference      TEXT UNIQUE,                     -- RGL-0001
  client_id      INT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  car_id         INT REFERENCES public.cars(id) ON DELETE SET NULL,
  sale_id        INT UNIQUE REFERENCES public.sales(id) ON DELETE CASCADE,
  purchase_id    INT REFERENCES public.purchases(id) ON DELETE SET NULL,
  sale_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  showroom_share NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  owner_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- snapshot of the expense list at settlement time (printed on the receipt)
  expenses       JSONB DEFAULT '[]'::jsonb,
  payment_method TEXT,
  note           TEXT,
  status         settlement_status NOT NULL DEFAULT 'SETTLED',
  date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_settlements_client_id ON public.client_settlements(client_id);
CREATE INDEX IF NOT EXISTS idx_client_settlements_sale_id   ON public.client_settlements(sale_id);

CREATE OR REPLACE FUNCTION public.set_settlement_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'RGL-' || LPAD(NEW.id::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_settlement_reference ON public.client_settlements;
CREATE TRIGGER trg_settlement_reference
  BEFORE INSERT ON public.client_settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_settlement_reference();


-- ----------------------------------------------------------------------------
-- 2.15 expenses (Depenses vehicule + showroom)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  type        expense_type NOT NULL DEFAULT 'SHOWROOM',
  car_id      INT REFERENCES public.cars(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_type   ON public.expenses(type);
CREATE INDEX IF NOT EXISTS idx_expenses_car_id ON public.expenses(car_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date   ON public.expenses(date);


-- ----------------------------------------------------------------------------
-- 2.16 cash_transactions (Caisse)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id           SERIAL PRIMARY KEY,
  reference    TEXT UNIQUE,                       -- VRS-0001 / RET-0001
  type         cash_tx_type NOT NULL DEFAULT 'DEPOSIT',
  client_id    INT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name  TEXT,
  client_phone TEXT,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  description  TEXT,
  date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON public.cash_transactions(date);

CREATE OR REPLACE FUNCTION public.set_cash_transaction_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := CASE WHEN NEW.type = 'WITHDRAWAL' THEN 'RET-' ELSE 'VRS-' END
                     || LPAD(NEW.id::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cash_transaction_reference ON public.cash_transactions;
CREATE TRIGGER trg_cash_transaction_reference
  BEFORE INSERT ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_cash_transaction_reference();


-- ----------------------------------------------------------------------------
-- 2.17 special_offers + website_reservations (site web)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.special_offers (
  id            SERIAL PRIMARY KEY,
  car_id        INT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  special_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  old_price     NUMERIC(12,2),
  start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date      TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.website_reservations (
  id           SERIAL PRIMARY KEY,
  car_id       INT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  client_name  TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  status       reservation_status DEFAULT 'PENDING',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 2.18 email_logs - printing templates emailed to a client through Brevo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id          SERIAL PRIMARY KEY,
  sale_id     INT REFERENCES public.sales(id) ON DELETE SET NULL,
  purchase_id INT REFERENCES public.purchases(id) ON DELETE SET NULL,
  client_id   INT REFERENCES public.clients(id) ON DELETE SET NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT,
  templates   JSONB DEFAULT '[]'::jsonb,          -- ["facture-finale","bon-versement"]
  lang        TEXT DEFAULT 'fr',
  status      TEXT DEFAULT 'SENT',                -- SENT | FAILED
  error       TEXT,
  provider_id TEXT,                               -- Brevo messageId
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_sale_id ON public.email_logs(sale_id);


-- ============================================================================
-- 3. VIEWS
-- ============================================================================

-- Full vehicle view: last purchase + last sale + counterparties
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


-- Sales of client-owned vehicles still waiting for an owner settlement.
-- This is the single source of truth behind the "Reglement" alerts.
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


-- Dashboard KPIs
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


-- Views run with the privileges of the CALLER, so the row level security of
-- part 2 applies to them as well, and no view is readable anonymously.
-- (security_invoker needs PostgreSQL 15+; on an older server the REVOKE below
--  is what keeps the views out of anonymous reach.)
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
-- 4. MAINTENANCE - backfill values for an existing database
-- ============================================================================
UPDATE public.cars c
   SET price = p.selling_price
  FROM public.purchases p
 WHERE p.car_id = c.id
   AND COALESCE(c.price, 0) = 0
   AND COALESCE(p.selling_price, 0) > 0;

UPDATE public.purchases SET entry_number = id::text WHERE entry_number IS NULL;
UPDATE public.sale_payments SET reference = 'REG-' || LPAD(id::text, 4, '0') WHERE reference IS NULL;

-- Sales recorded before the down payment became a payment row: recreate it so
-- the totals stay right the next time a payment is added.
INSERT INTO public.sale_payments (sale_id, car_id, amount, is_initial, date, description)
SELECT s.id, s.car_id, s.amount_paid, true, s.date, 'Versement initial'
  FROM public.sales s
 WHERE COALESCE(s.amount_paid, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.sale_payments p WHERE p.sale_id = s.id);

-- ============================================================================
-- END OF PART 1 - continue with 02_security.sql
-- ============================================================================
