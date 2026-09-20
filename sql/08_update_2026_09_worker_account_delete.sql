-- ============================================================================
--  08 · Update 2026-09 — deleting a worker also deletes his login account
-- ----------------------------------------------------------------------------
--  Until now "Supprimer" on the Employés page removed the row in
--  public.workers but left the account in Supabase's authentication table
--  (auth.users). The password stayed valid and the e-mail could never be
--  registered again.
--
--  auth.users is not writable from the browser with the anon key, so the
--  deletion goes through the SECURITY DEFINER function below. It:
--    1. checks the caller really holds the "workers / delete" permission
--       (an administrator always does — same rule as the RLS policies),
--    2. deletes the auth.users row of the worker, if he had one,
--    3. deletes the public.workers row,
--  all inside one transaction.
--
--  The other updates of this release (period filters + printing on the Caisse,
--  the new "Caisse" net view, the per-part printing of the Rapports page, the
--  redesigned fiche technique, the bon d'entrée without prices, the bon de
--  sortie title and the purchase form changes) are frontend-only and need no
--  SQL.
--
--  Safe to run more than once.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_worker_account(p_worker_id INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_auth_id UUID;
  v_deleted BOOLEAN := false;
BEGIN
  IF NOT public.has_perm('workers', 'delete') THEN
    RAISE EXCEPTION 'Permission refusée : suppression d''un employé';
  END IF;

  SELECT w.auth_id INTO v_auth_id FROM public.workers w WHERE w.id = p_worker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employé introuvable (id %)', p_worker_id;
  END IF;

  -- The worker row first: workers.auth_id has no FK to auth.users, so the
  -- order only matters for readability.
  DELETE FROM public.workers WHERE id = p_worker_id;

  IF v_auth_id IS NOT NULL THEN
    -- Never let an administrator delete his own session account through this
    -- path, and never touch an account that is also an admin of the app.
    IF v_auth_id = auth.uid() THEN
      RAISE EXCEPTION 'Impossible de supprimer votre propre compte de connexion';
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = v_auth_id) THEN
      RAISE EXCEPTION 'Ce compte est également un compte administrateur : supprimez-le depuis Supabase';
    END IF;

    DELETE FROM auth.users WHERE id = v_auth_id;
    v_deleted := true;
  END IF;

  RETURN jsonb_build_object(
    'workerId', p_worker_id,
    'authId', v_auth_id,
    'authDeleted', v_deleted
  );
END;
$fn$;

-- Only signed-in users may call it; the permission check above does the rest.
REVOKE ALL ON FUNCTION public.delete_worker_account(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_worker_account(INT) TO authenticated;

COMMIT;
