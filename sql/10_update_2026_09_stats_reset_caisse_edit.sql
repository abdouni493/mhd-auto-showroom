-- ============================================================================
--  10 · Update 2026-09 — période des statistiques, recherche par châssis,
--       modification de chaque ligne de la Caisse
-- ----------------------------------------------------------------------------
--  Run ONCE on an existing database, after 01..09. Idempotent + transactional.
--
--  PARTIE A · settings.stats_reset
--      Le tableau de bord remet ses cartes de statistiques à 0 au début de
--      chaque période choisie par l'utilisateur :
--        { "period": "NEVER"|"DAY"|"WEEK"|"MONTH"|"QUARTER"|"YEAR"|"CUSTOM",
--          "customFrom": "YYYY-MM-DD" | null }
--
--  PARTIE B · index sur cars.vin
--      La recherche de véhicule (nouvelle dépense) cherche aussi par N° de
--      châssis.
--
--  PARTIE C · droits de modification
--      · La Caisse permet de modifier chaque ligne (versement de vente, achat,
--        dépense, salaire, règlement propriétaire, bénéfice). La section
--        « caisse » reçoit donc le droit edit sur ces tables.
--      · Modifier une vente ou une dépense de véhicule recalcule le règlement
--        propriétaire lié (et la part showroom de la vente) : les sections
--        « sales » et « expenses » reçoivent le droit edit sur
--        client_settlements, et « expenses » sur sales.
--      Les listes view / create / delete sont reprises telles quelles de 06.
-- ============================================================================

BEGIN;

-- ── PARTIE A ────────────────────────────────────────────────────────────────
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS stats_reset JSONB NOT NULL
  DEFAULT '{"period": "NEVER", "customFrom": null}'::jsonb;

COMMENT ON COLUMN public.settings.stats_reset IS
  'Période de remise à zéro des statistiques du tableau de bord';


-- ── PARTIE B ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cars_vin ON public.cars(vin);


-- ── PARTIE C ────────────────────────────────────────────────────────────────
DO $pol$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table,                 view sections,
      --                        create sections,          edit sections,            delete sections
      ('purchases',             ARRAY['purchase','showroom','pos','sales','payments','reports','dashboard','clients','settlements','suppliers','caisse'],
                                ARRAY['purchase'],        ARRAY['purchase','caisse'], ARRAY['purchase']),
      ('sales',                 ARRAY['sales','pos','showroom','payments','reports','dashboard','clients','settlements','suppliers','caisse'],
                                ARRAY['pos'],             ARRAY['sales','pos','payments','settlements','suppliers','caisse','expenses'], ARRAY['sales']),
      ('sale_payments',         ARRAY['payments','sales','showroom','reports','dashboard','clients','suppliers','caisse'],
                                ARRAY['payments','sales'], ARRAY['payments','sales','caisse'], ARRAY['payments','sales']),
      ('client_settlements',    ARRAY['settlements','clients','sales','reports','dashboard','suppliers','caisse'],
                                ARRAY['settlements','clients','suppliers'],
                                ARRAY['settlements','clients','suppliers','caisse','sales','expenses'],
                                ARRAY['settlements','clients','suppliers']),
      ('expenses',              ARRAY['expenses','showroom','sales','reports','dashboard','settlements','suppliers','caisse'],
                                ARRAY['expenses'],        ARRAY['expenses','caisse'], ARRAY['expenses']),
      ('worker_payments',       ARRAY['workers','reports','dashboard','caisse'],
                                ARRAY['workers'],         ARRAY['workers','caisse'],  ARRAY['workers']),
      ('cash_transactions',     ARRAY['caisse','reports','dashboard'],
                                ARRAY['caisse'],          ARRAY['caisse'],            ARRAY['caisse'])
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

COMMIT;

-- ── Vérification (facultatif) ───────────────────────────────────────────────
-- SELECT stats_reset FROM public.settings;
-- ============================================================================
-- END OF MIGRATION 10
-- ============================================================================
