-- ============================================================================
--  09 · Update 2026-09 — type de client : « Prestation » ou « Vente »
-- ----------------------------------------------------------------------------
--  Jusqu'ici la séparation entre les deux pages du menu — « Gestion de
--  Fournisseurs » et « Clients » — était déduite des données : un client
--  apparaissait comme fournisseur dès qu'un achat « Prestation / Dépôt client »
--  pointait sur lui. Rien ne permettait de le décider à la main, et le même
--  répertoire était proposé à l'achat et à la vente.
--
--  Cette mise à jour ajoute une colonne explicite :
--
--      clients.client_type = 'PRESTATION'  → fournisseur prestation (dépôt)
--                          = 'NORMAL'      → client de vente (par défaut)
--
--  · le formulaire d'achat ne propose (et ne crée) que des PRESTATION,
--  · le point de vente et la vente ne proposent (et ne créent) que des NORMAL,
--  · la page Clients / Fournisseurs filtre sur cette colonne et permet de
--    changer le type d'un client existant.
--
--  PARTIE A crée la colonne, PARTIE B reprend l'historique.
--  Le script est rejouable sans risque.
-- ============================================================================

BEGIN;

-- ── PARTIE A · la colonne ───────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'NORMAL';

-- La contrainte est (re)posée à part pour que le script reste rejouable.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_client_type_check
  CHECK (client_type IN ('NORMAL', 'PRESTATION'));

-- Les listes des deux pages et les recherches filtrent toutes sur ce champ.
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(client_type);

COMMENT ON COLUMN public.clients.client_type IS
  'NORMAL = client de vente ; PRESTATION = fournisseur ayant déposé un véhicule';


-- ── PARTIE B · reprise de l'historique ──────────────────────────────────────
--  Tout client déjà désigné comme propriétaire d'un véhicule déposé au
--  showroom — c'est-à-dire rattaché à au moins un achat de type
--  « Prestation / Dépôt client » (purchases.source_type = 'CLIENT') — devient
--  un fournisseur prestation.
UPDATE public.clients c
   SET client_type = 'PRESTATION'
 WHERE c.client_type <> 'PRESTATION'
   AND EXISTS (
         SELECT 1
           FROM public.purchases p
          WHERE p.client_id  = c.id
            AND p.source_type = 'CLIENT'
       );

-- Tous les autres restent des clients de vente.
UPDATE public.clients SET client_type = 'NORMAL' WHERE client_type IS NULL;

COMMIT;


-- ── Vérification (facultatif) ───────────────────────────────────────────────
-- SELECT client_type, COUNT(*) FROM public.clients GROUP BY client_type;
