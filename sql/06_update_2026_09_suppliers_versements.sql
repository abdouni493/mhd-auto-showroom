-- ============================================================================
-- ALTECH SHOWROOM — MIGRATION 06  (September 2026)
--
-- Run this file ONCE on an existing database, after 01..05.
-- (A brand new database is already covered by 01/02; this file only adds the
--  new "suppliers" permission section and widens a few read policies so the
--  redesigned Caisse ledger can read every money movement.)
--
-- What it does — NO schema change, only security / permissions
-- ----------------------------------------------------------------------------
--   1. The versements feature reuses the existing `sale_payments` table
--      (bon number = sale id, versement number = sale_payment id, observation =
--      description, first-versement date = date). Nothing to migrate there.
--
--   2. New permission section  "suppliers"  — gates the "Gestion de
--      fournisseurs" page (owners who deposited a vehicle). It is added to the
--      row-level-security policies of the tables that page reads / writes.
--
--   3. The "clients" page now shows buyers only and the owner règlement moved
--      to the suppliers page, so the suppliers section is also allowed to
--      create / edit / delete client_settlements and to edit sales
--      (the showroom share is entered when the règlement is created).
--
--   4. The redesigned Caisse shows EVERY money movement (sales versements,
--      vehicle purchases, expenses, worker salaries, owner règlements). The
--      "caisse" section is therefore granted read access to those tables so a
--      caisse-only worker sees the full ledger. Admins already bypass RLS.
--
-- The whole file is transactional and idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Rebuild the permission-driven policies of the affected tables, with the new
-- "suppliers" / "caisse" sections merged into the existing lists. Mirrors the
-- generator of 02_security.sql, restricted to the tables that change.
-- ----------------------------------------------------------------------------
DO $pol$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table,                 view sections,
      --                        create sections,          edit sections,            delete sections
      ('cars',                  ARRAY['showroom','purchase','pos','sales','payments','expenses','reports','dashboard','websiteSettings','websiteReservations','settlements','clients','suppliers','caisse'],
                                ARRAY['purchase'],        ARRAY['showroom','purchase','pos','sales','websiteSettings'], ARRAY['purchase','showroom']),
      ('car_documents',         ARRAY['showroom','purchase','pos','sales','reports','dashboard','websiteSettings','clients','suppliers','caisse'],
                                ARRAY['purchase'],        ARRAY['purchase','showroom'], ARRAY['purchase','showroom']),
      ('purchases',             ARRAY['purchase','showroom','pos','sales','payments','reports','dashboard','clients','settlements','suppliers','caisse'],
                                ARRAY['purchase'],        ARRAY['purchase'],        ARRAY['purchase']),
      ('purchase_payments',     ARRAY['purchase','showroom','reports','dashboard','caisse'],
                                ARRAY['purchase'],        ARRAY['purchase'],        ARRAY['purchase']),
      ('sales',                 ARRAY['sales','pos','showroom','payments','reports','dashboard','clients','settlements','suppliers','caisse'],
                                ARRAY['pos'],             ARRAY['sales','pos','payments','settlements','suppliers'], ARRAY['sales']),
      ('sale_payments',         ARRAY['payments','sales','showroom','reports','dashboard','clients','suppliers','caisse'],
                                ARRAY['payments','sales'], ARRAY['payments','sales'], ARRAY['payments','sales']),
      ('client_settlements',    ARRAY['settlements','clients','sales','reports','dashboard','suppliers','caisse'],
                                ARRAY['settlements','clients','suppliers'], ARRAY['settlements','clients','suppliers'], ARRAY['settlements','clients','suppliers']),
      ('clients',               ARRAY['clients','purchase','pos','sales','payments','caisse','reports','dashboard','settlements','showroom','suppliers'],
                                ARRAY['clients','purchase','pos','caisse','suppliers'], ARRAY['clients','purchase','pos','sales','suppliers'], ARRAY['clients','suppliers']),
      ('expenses',              ARRAY['expenses','showroom','sales','reports','dashboard','settlements','suppliers','caisse'],
                                ARRAY['expenses'],        ARRAY['expenses'],        ARRAY['expenses']),
      ('worker_payments',       ARRAY['workers','reports','dashboard','caisse'],
                                ARRAY['workers'],         ARRAY['workers'],         ARRAY['workers'])
    ) AS x(tbl, sel, ins, upd, del)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || ' perm select', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || ' perm insert', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || ' perm update', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || ' perm delete', r.tbl);

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
$pol$;


-- ----------------------------------------------------------------------------
-- Default worker roles: a role that already manages clients now also gets the
-- same rights on the suppliers page, so nothing an existing role could do
-- disappears when clients / owners were split. Admins can fine-tune afterwards.
-- ----------------------------------------------------------------------------
UPDATE public.worker_roles
   SET permissions = jsonb_set(permissions, '{suppliers}', permissions -> 'clients')
 WHERE permissions ? 'clients'
   AND NOT (permissions ? 'suppliers');

COMMIT;

-- ============================================================================
-- END OF MIGRATION 06
-- ============================================================================
