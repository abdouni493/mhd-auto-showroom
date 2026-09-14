-- ============================================================================
--  SHOWROOM MHD AUTO - SECURITY  (part 2/3 : auth, permissions, RLS)
--  Run AFTER 01_schema.sql. Idempotent.
--
--  Model
--  -----
--  * An ADMIN is an auth.users account with a row in public.users (role='admin').
--    Admins can do everything.
--  * A WORKER is an auth.users account linked to public.workers.auth_id.
--    A worker only sees the interfaces and the button-actions granted by the
--    permission map of its role (public.worker_roles.permissions), and the SAME
--    map is enforced here at the database level, so a worker cannot reach data
--    through the API that the interface hides from him.
--  * ANON (public website visitors) can read the catalogue and post a
--    reservation, nothing else.
-- ============================================================================


-- ============================================================================
-- 1. HELPER FUNCTIONS  (SECURITY DEFINER = no RLS recursion)
-- ============================================================================

-- Is the caller an administrator?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.auth_id = auth.uid() AND u.role = 'admin'
  );
$fn$;

-- The worker row of the caller (NULL for an admin).
CREATE OR REPLACE FUNCTION public.my_worker_id()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT w.id FROM public.workers w WHERE w.auth_id = auth.uid() LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.my_role_id()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT w.role_id FROM public.workers w WHERE w.auth_id = auth.uid() LIMIT 1;
$fn$;

-- The permission map of the caller.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(r.permissions, '{}'::jsonb)
    FROM public.workers w
    LEFT JOIN public.worker_roles r ON r.id = w.role_id
   WHERE w.auth_id = auth.uid()
   LIMIT 1;
$fn$;

-- Does the caller hold <action> on <section>?  Admins always do.
CREATE OR REPLACE FUNCTION public.has_perm(p_section TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.is_admin()
      OR COALESCE((public.my_permissions() -> p_section ->> p_action)::boolean, false);
$fn$;

-- Same, for a list of sections (any one of them is enough).
CREATE OR REPLACE FUNCTION public.has_any_perm(p_sections TEXT[], p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.is_admin()
      OR EXISTS (
        SELECT 1 FROM unnest(p_sections) AS s(section)
         WHERE COALESCE((public.my_permissions() -> s.section ->> p_action)::boolean, false)
      );
$fn$;

-- Used by the login page to show / hide "Creer un compte administrateur".
-- Callable without being signed in.
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin');
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_exists()          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(TEXT, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_perm(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_worker_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role_id()            TO authenticated;


-- ============================================================================
-- 2. SIGN-UP TRIGGER
--    The app calls supabase.auth.signUp(..., { data: { kind, full_name,
--    username } }). kind='admin' creates the public.users row server-side
--    (SECURITY DEFINER bypasses RLS), so it works even with email confirmation.
--    kind='worker' is ignored here: the workers row is written by the admin
--    who creates the employee, and carries the auth_id returned by signUp.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF (NEW.raw_user_meta_data ->> 'kind') = 'admin' THEN
    BEGIN
      INSERT INTO public.users (auth_id, full_name, username, email, role)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        'admin'
      )
      ON CONFLICT (auth_id) DO NOTHING;
    EXCEPTION WHEN unique_violation THEN
      NULL;   -- username / email already taken: the client reconciles the row
    END;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

-- 3.1 Enable RLS everywhere -------------------------------------------------
DO $rls$
DECLARE
  t   TEXT;
  pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','settings','suppliers','clients','worker_roles','workers',
    'worker_payments','worker_advances','worker_absences','cars',
    'car_document_types','car_documents','purchases','purchase_payments',
    'sales','sale_payments','client_settlements','expenses','cash_transactions',
    'special_offers','website_reservations','email_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- drop every previously created policy on the table so this file can be
    -- re-run after the permission model changes
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;
  END LOOP;
END
$rls$;


-- 3.2 users -----------------------------------------------------------------
-- Every account may read / create / update ONLY its own profile row.
CREATE POLICY "users self select" ON public.users
  FOR SELECT USING (auth.uid() = auth_id OR public.is_admin());
CREATE POLICY "users self insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "users self update" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);


-- 3.3 A worker must always be able to read its OWN row and its OWN role,
--     otherwise it could never load its permission map at login.
CREATE POLICY "workers read own row" ON public.workers
  FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "worker_roles read own role" ON public.worker_roles
  FOR SELECT USING (id = public.my_role_id());


-- 3.4 Permission-driven policies -------------------------------------------
-- For each table: which permission sections unlock view / create / edit /
-- delete. Any one section of the list is enough (a purchase creates a car, a
-- sale reads a client, ...), which mirrors exactly what the interface does.
DO $pol$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table,                 view sections,
      --                        create sections,        edit sections,          delete sections
      ('cars',                  ARRAY['showroom','purchase','pos','sales','payments','expenses','reports','dashboard','websiteSettings','websiteReservations','settlements','clients','suppliers'],
                                ARRAY['purchase'],      ARRAY['showroom','purchase','pos','sales','websiteSettings'], ARRAY['purchase','showroom']),
      ('car_documents',         ARRAY['showroom','purchase','pos','sales','reports','dashboard','websiteSettings'],
                                ARRAY['purchase'],      ARRAY['purchase','showroom'], ARRAY['purchase','showroom']),
      ('car_document_types',    ARRAY['showroom','purchase','pos','sales'],
                                ARRAY['purchase'],      ARRAY['purchase'],      ARRAY['purchase']),
      ('purchases',             ARRAY['purchase','showroom','pos','sales','payments','reports','dashboard','suppliers','clients','settlements'],
                                ARRAY['purchase'],      ARRAY['purchase'],      ARRAY['purchase']),
      ('purchase_payments',     ARRAY['purchase','showroom','reports','dashboard','suppliers'],
                                ARRAY['purchase'],      ARRAY['purchase'],      ARRAY['purchase']),
      ('sales',                 ARRAY['sales','pos','showroom','payments','reports','dashboard','clients','settlements'],
                                ARRAY['pos'],           ARRAY['sales','pos','payments'], ARRAY['sales']),
      ('sale_payments',         ARRAY['payments','sales','showroom','reports','dashboard','clients'],
                                ARRAY['payments','sales'], ARRAY['payments','sales'], ARRAY['payments','sales']),
      ('client_settlements',    ARRAY['settlements','clients','sales','reports','dashboard'],
                                ARRAY['settlements','clients'], ARRAY['settlements','clients'], ARRAY['settlements','clients']),
      ('clients',               ARRAY['clients','purchase','pos','sales','payments','caisse','reports','dashboard','settlements','showroom'],
                                ARRAY['clients','purchase','pos','caisse'], ARRAY['clients','purchase','pos','sales'], ARRAY['clients']),
      ('suppliers',             ARRAY['suppliers','purchase','reports','dashboard','showroom'],
                                ARRAY['suppliers','purchase'], ARRAY['suppliers'], ARRAY['suppliers']),
      ('expenses',              ARRAY['expenses','showroom','sales','reports','dashboard','settlements'],
                                ARRAY['expenses'],      ARRAY['expenses'],      ARRAY['expenses']),
      ('cash_transactions',     ARRAY['caisse','reports','dashboard'],
                                ARRAY['caisse'],        ARRAY['caisse'],        ARRAY['caisse']),
      ('workers',               ARRAY['workers','reports','dashboard'],
                                ARRAY['workers'],       ARRAY['workers'],       ARRAY['workers']),
      ('worker_roles',          ARRAY['workers','reports','dashboard'],
                                ARRAY['workers'],       ARRAY['workers'],       ARRAY['workers']),
      ('worker_payments',       ARRAY['workers','reports','dashboard'],
                                ARRAY['workers'],       ARRAY['workers'],       ARRAY['workers']),
      ('worker_advances',       ARRAY['workers','reports','dashboard'],
                                ARRAY['workers'],       ARRAY['workers'],       ARRAY['workers']),
      ('worker_absences',       ARRAY['workers','reports','dashboard'],
                                ARRAY['workers'],       ARRAY['workers'],       ARRAY['workers']),
      ('special_offers',        ARRAY['websiteSettings','showroom','dashboard','reports'],
                                ARRAY['websiteSettings'], ARRAY['websiteSettings'], ARRAY['websiteSettings']),
      ('website_reservations',  ARRAY['websiteReservations','dashboard','reports'],
                                ARRAY['websiteReservations'], ARRAY['websiteReservations'], ARRAY['websiteReservations']),
      ('email_logs',            ARRAY['sales','purchase','clients','reports','dashboard'],
                                ARRAY['sales','purchase','clients'], ARRAY['sales'], ARRAY['sales'])
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
$pol$;


-- 3.5 settings --------------------------------------------------------------
-- Readable by everyone (the login page, the printed documents and the public
-- website all need the showroom identity); written by the Parametres section.
CREATE POLICY "settings public read" ON public.settings
  FOR SELECT USING (true);
CREATE POLICY "settings write" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_perm(ARRAY['settings','purchase','pos','sales','showroom','websiteSettings'], 'create'));
CREATE POLICY "settings update" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.has_any_perm(ARRAY['settings','purchase','pos','sales','showroom','websiteSettings'], 'edit'))
  WITH CHECK (public.has_any_perm(ARRAY['settings','purchase','pos','sales','showroom','websiteSettings'], 'edit'));


-- 3.6 Public website (anonymous visitors) -----------------------------------
CREATE POLICY "cars public read" ON public.cars
  FOR SELECT TO anon USING (true);
CREATE POLICY "car_documents public read" ON public.car_documents
  FOR SELECT TO anon USING (true);
CREATE POLICY "special_offers public read" ON public.special_offers
  FOR SELECT TO anon USING (true);
CREATE POLICY "website_reservations public insert" ON public.website_reservations
  FOR INSERT TO anon WITH CHECK (true);


-- ============================================================================
-- 4. DEFAULT WORKER ROLES
--    Ready-to-use permission maps. An admin can fine-tune them in
--    Employes -> Permissions; the interface AND the database follow.
-- ============================================================================
INSERT INTO public.worker_roles (name, permissions) VALUES
(
  'Vendeur',
  '{
    "dashboard":   {"view":true},
    "showroom":    {"view":true},
    "pos":         {"view":true,"create":true,"print":true},
    "sales":       {"view":true,"edit":true,"print":true},
    "payments":    {"view":true,"create":true,"print":true},
    "clients":     {"view":true,"create":true,"edit":true},
    "settlements": {"view":true}
  }'::jsonb
),
(
  'Gestionnaire de stock',
  '{
    "dashboard":  {"view":true},
    "showroom":   {"view":true,"edit":true},
    "purchase":   {"view":true,"create":true,"edit":true,"print":true},
    "suppliers":  {"view":true,"create":true,"edit":true},
    "clients":    {"view":true,"create":true},
    "expenses":   {"view":true,"create":true,"edit":true}
  }'::jsonb
),
(
  'Comptable',
  '{
    "dashboard":   {"view":true},
    "showroom":    {"view":true},
    "purchase":    {"view":true,"print":true},
    "sales":       {"view":true,"print":true},
    "payments":    {"view":true,"create":true,"print":true},
    "settlements": {"view":true,"create":true,"print":true},
    "caisse":      {"view":true,"create":true,"edit":true,"print":true},
    "expenses":    {"view":true,"create":true,"edit":true,"delete":true,"print":true},
    "clients":     {"view":true},
    "suppliers":   {"view":true},
    "reports":     {"view":true,"print":true}
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- END OF PART 2 - continue with 03_storage.sql
-- ============================================================================
