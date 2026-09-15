-- ============================================================================
--  ALTECH SHOWROOM — 05 : image optimisation (WebP uploads)
--  Run AFTER 03_storage.sql. Idempotent — safe to run more than once.
--
--  Context
--  -------
--  Images are now compressed IN THE BROWSER before upload (a ~10 MB phone photo
--  becomes a ~1 MB WebP). This migration is OPTIONAL: the buckets created in
--  03_storage.sql already allow 'image/webp'. It exists only as a safety net for
--  older installs whose bucket config might predate WebP, and to (optionally)
--  tighten the per-file size limits now that uploads are small.
-- ============================================================================

-- 1. Guarantee every image bucket accepts WebP (and keeps the formats it had).
--    The uploader emits WebP for photos; PDFs (documents) and SVG (logo) still
--    pass through untouched, so those types stay in the lists below.
UPDATE storage.buckets
   SET allowed_mime_types =
         ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif']
 WHERE id = 'car-images';

UPDATE storage.buckets
   SET allowed_mime_types =
         ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','application/pdf']
 WHERE id = 'car-documents';

UPDATE storage.buckets
   SET allowed_mime_types =
         ARRAY['image/jpeg','image/jpg','image/png','image/webp']
 WHERE id = 'client-photos';

UPDATE storage.buckets
   SET allowed_mime_types =
         ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml']
 WHERE id = 'showroom-logo';

-- 2. (OPTIONAL) Tighten per-file size limits. Compression keeps uploads far
--    under these; the limits stay generous so that if in-browser compression
--    ever fails, the untouched original can still go through (fail-open).
--    Uncomment to apply.
-- UPDATE storage.buckets SET file_size_limit =  8388608 WHERE id = 'car-images';     --  8 MB
-- UPDATE storage.buckets SET file_size_limit = 20971520 WHERE id = 'car-documents';  -- 20 MB (PDFs)
-- UPDATE storage.buckets SET file_size_limit =  8388608 WHERE id = 'client-photos';  --  8 MB
-- UPDATE storage.buckets SET file_size_limit =  5242880 WHERE id = 'showroom-logo';  --  5 MB

-- ============================================================================
-- DONE.
-- ============================================================================
