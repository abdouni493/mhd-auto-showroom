-- ============================================================================
--  07 · Update 2026-09 — third showroom phone number
-- ----------------------------------------------------------------------------
--  Adds settings.phone3 so the showroom can store a second and a third phone
--  number (phone2 already existed). Both are shown on every printing template.
--
--  The Caisse header cards (Total achats / ventes / dettes / gains) and the
--  removal of the sale-form gain are frontend-only changes and need no SQL.
--
--  Safe to run more than once.
-- ============================================================================

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS phone3 TEXT;
