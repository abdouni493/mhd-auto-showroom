-- ============================================================================
--  11 · Update 2026-11 — Factures proforma (sans vente du véhicule)
-- ----------------------------------------------------------------------------
--  Run ONCE on an existing database, after 01..10. Idempotent + transactional.
--
--  Une facture proforma se crée depuis le POS avec les mêmes étapes qu'une
--  vente (client → inspection → tarification) mais NE vend PAS le véhicule :
--  il reste disponible. L'historique (page « Factures proforma ») permet de
--  voir, modifier, imprimer et supprimer chaque proforma.
--
--  Le véhicule et le client sont aussi gardés en copie (car_snapshot /
--  client_snapshot) pour que la proforma reste imprimable même si le véhicule
--  est vendu ou supprimé ensuite.
--
--  Tant que ce fichier n'est pas exécuté, l'application garde les proformas
--  dans le navigateur (localStorage) : elles fonctionnent, mais ne sont pas
--  partagées entre les postes.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.proformas (
  id                    SERIAL PRIMARY KEY,
  reference             TEXT UNIQUE,                 -- PRO-2026-0001 (série par année)
  car_id                INT REFERENCES public.cars(id) ON DELETE SET NULL,
  client_id             INT REFERENCES public.clients(id) ON DELETE SET NULL,
  car_snapshot          JSONB DEFAULT '{}'::jsonb,
  client_snapshot       JSONB DEFAULT '{}'::jsonb,
  total_before_tax      NUMERIC(12,2) DEFAULT 0,
  tva_enabled           BOOLEAN DEFAULT false,
  tva_rate              NUMERIC(5,2) DEFAULT 19,
  stamp_enabled         BOOLEAN DEFAULT false,
  stamp_rate            NUMERIC(5,2) DEFAULT 2,
  reduction_type        TEXT DEFAULT 'NONE',
  reduction_value       NUMERIC(12,2) DEFAULT 0,
  total_after_reduction NUMERIC(12,2) DEFAULT 0,
  showroom_share        NUMERIC(12,2) DEFAULT 0,
  payment_method        TEXT,
  inspection            JSONB DEFAULT '{}'::jsonb,
  remark                TEXT,
  date                  TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proformas_date   ON public.proformas(date);
CREATE INDEX IF NOT EXISTS idx_proformas_car_id ON public.proformas(car_id);

-- Numérotation en série par année : PRO-2026-0001, PRO-2026-0002, …
-- (l'application envoie déjà le numéro ; ce trigger le donne si absent).
CREATE OR REPLACE FUNCTION public.set_proforma_reference()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  y   INT := EXTRACT(YEAR FROM COALESCE(NEW.date, NOW()))::int;
  seq INT;
BEGIN
  IF NEW.reference IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('proforma_ref_' || y));
    SELECT COALESCE(MAX(split_part(reference, '-', 3)::int), 0) + 1 INTO seq
      FROM public.proformas
     WHERE reference ~ ('^PRO-' || y || '-[0-9]+$');
    NEW.reference := 'PRO-' || y || '-' || LPAD(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_proforma_reference ON public.proformas;
CREATE TRIGGER trg_proforma_reference
  BEFORE INSERT ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.set_proforma_reference();

-- ── Droits : section « proformas » (et le POS qui les crée) ─────────────────
ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proformas perm select" ON public.proformas;
DROP POLICY IF EXISTS "proformas perm insert" ON public.proformas;
DROP POLICY IF EXISTS "proformas perm update" ON public.proformas;
DROP POLICY IF EXISTS "proformas perm delete" ON public.proformas;

CREATE POLICY "proformas perm select" ON public.proformas FOR SELECT TO authenticated
  USING (public.has_any_perm(ARRAY['proformas','pos','sales'], 'view'));
CREATE POLICY "proformas perm insert" ON public.proformas FOR INSERT TO authenticated
  WITH CHECK (public.has_any_perm(ARRAY['proformas','pos'], 'create'));
CREATE POLICY "proformas perm update" ON public.proformas FOR UPDATE TO authenticated
  USING (public.has_any_perm(ARRAY['proformas','pos'], 'edit'))
  WITH CHECK (public.has_any_perm(ARRAY['proformas','pos'], 'edit'));
CREATE POLICY "proformas perm delete" ON public.proformas FOR DELETE TO authenticated
  USING (public.has_any_perm(ARRAY['proformas'], 'delete'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proformas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.proformas_id_seq TO authenticated;

COMMIT;

-- ============================================================================
-- END OF MIGRATION 11
-- ============================================================================
