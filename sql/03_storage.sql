-- ============================================================================
--  SHOWROOM MHD AUTO - STORAGE  (part 3/3 : buckets used to save & display images)
--  Run AFTER 02_security.sql. Idempotent.
--
--  Buckets (all public-read so an <img src="..."> works everywhere):
--
--   car-images     cars.images (JSONB array of full public URLs)
--                  path: car-images/{car_id}/{uuid}.jpg
--                  shown in: Showroom, Achats, POS, Ventes, Rapports, site web
--
--   car-documents  car_documents.doc_url
--                  path: car-documents/{car_id}/{uuid}.(jpg|pdf)
--                  shown in: Achats (fiche vehicule), Showroom detail
--
--   client-photos  clients.photo_url
--                  path: client-photos/{client_id}/{uuid}.jpg
--                  shown in: Clients, POS, Ventes, documents imprimes
--
--   showroom-logo  settings.logo_url
--                  path: showroom-logo/logo-{timestamp}.png
--                  shown in: login, sidebar, site web, EVERY printed template
--
--  After uploading:
--    const { data } = await supabase.storage.from(bucket).upload(path, file)
--    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
--    // publicUrl is what gets stored in the column above
-- ============================================================================


-- ============================================================================
-- 1. BUCKETS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('car-images',    'car-images',    true, 15728640,
     ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif']),
  ('car-documents', 'car-documents', true, 20971520,
     ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','application/pdf']),
  ('client-photos', 'client-photos', true, 10485760,
     ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('showroom-logo', 'showroom-logo', true, 10485760,
     ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 2. POLICIES - public read, authenticated write
-- ============================================================================
DROP POLICY IF EXISTS "app storage public read"  ON storage.objects;
DROP POLICY IF EXISTS "app storage auth insert"  ON storage.objects;
DROP POLICY IF EXISTS "app storage auth update"  ON storage.objects;
DROP POLICY IF EXISTS "app storage auth delete"  ON storage.objects;
-- older per-bucket policies from a previous install
DROP POLICY IF EXISTS "car-images: public read"    ON storage.objects;
DROP POLICY IF EXISTS "car-images: auth insert"    ON storage.objects;
DROP POLICY IF EXISTS "car-images: auth update"    ON storage.objects;
DROP POLICY IF EXISTS "car-images: auth delete"    ON storage.objects;
DROP POLICY IF EXISTS "car-documents: public read" ON storage.objects;
DROP POLICY IF EXISTS "car-documents: auth insert" ON storage.objects;
DROP POLICY IF EXISTS "car-documents: auth update" ON storage.objects;
DROP POLICY IF EXISTS "car-documents: auth delete" ON storage.objects;
DROP POLICY IF EXISTS "client-photos: public read" ON storage.objects;
DROP POLICY IF EXISTS "client-photos: auth insert" ON storage.objects;
DROP POLICY IF EXISTS "client-photos: auth update" ON storage.objects;
DROP POLICY IF EXISTS "client-photos: auth delete" ON storage.objects;
DROP POLICY IF EXISTS "showroom-logo: public read" ON storage.objects;
DROP POLICY IF EXISTS "showroom-logo: auth insert" ON storage.objects;
DROP POLICY IF EXISTS "showroom-logo: auth update" ON storage.objects;
DROP POLICY IF EXISTS "showroom-logo: auth delete" ON storage.objects;

CREATE POLICY "app storage public read" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('car-images','car-documents','client-photos','showroom-logo'));

CREATE POLICY "app storage auth insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('car-images','car-documents','client-photos','showroom-logo')
              AND auth.uid() IS NOT NULL);

CREATE POLICY "app storage auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('car-images','car-documents','client-photos','showroom-logo')
         AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id IN ('car-images','car-documents','client-photos','showroom-logo')
              AND auth.uid() IS NOT NULL);

CREATE POLICY "app storage auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('car-images','car-documents','client-photos','showroom-logo')
         AND auth.uid() IS NOT NULL);


-- ============================================================================
-- 3. HELPER - build a public URL from a bucket + path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.storage_url(bucket TEXT, path TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $fn$
  SELECT 'https://nnqrfbqxqfepjwglfgiu.supabase.co/storage/v1/object/public/'
         || bucket || '/' || path;
$fn$;


-- ============================================================================
-- DONE - the database is ready.
--
--  Next steps
--  ----------
--  1. Authentication -> Providers -> Email -> turn OFF "Confirm email".
--  2. Open the application login page and click
--     "Creer un compte administrateur" (the button disappears for good once an
--     administrator exists).
--  3. Log in, then fill Parametres -> Showroom (name, logo, RC / NIF / NIS /
--     ART, address, phone) - every printed document reads it from there.
--  4. Employes -> create a role, tick its permissions, then create the worker
--     with "Activer un compte d'acces" so he can sign in with his own email.
-- ============================================================================
