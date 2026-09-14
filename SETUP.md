# MHD AUTO — Showroom Management

Application de gestion de showroom automobile : stock, achats, POS, ventes,
règlements, caisse, clients, fournisseurs, employés, dépenses, rapports,
site web public, impressions bilingues (FR / AR) et envoi des documents par email.

---

## 1. Base de données Supabase

Projet : `https://nnqrfbqxqfepjwglfgiu.supabase.co`

Dans **Supabase → SQL Editor → New query**, exécuter les trois fichiers du dossier
`sql/`, **dans cet ordre** :

| Ordre | Fichier              | Contenu                                                        |
|-------|----------------------|----------------------------------------------------------------|
| 1     | `sql/01_schema.sql`  | Types, tables, relations, triggers, vues, reprise de données    |
| 2     | `sql/02_security.sql`| Authentification, permissions employés, RLS, rôles par défaut   |
| 3     | `sql/03_storage.sql` | Buckets d'images/documents et leurs politiques d'accès          |

Les trois fichiers sont **idempotents** : on peut les relancer sans rien casser.

### Réglage obligatoire (1 clic, sans SQL)

**Authentication → Providers → Email → décocher « Confirm email ».**
Sans cela un nouvel administrateur / employé doit cliquer un lien reçu par email
avant de pouvoir se connecter (et le SMTP mutualisé de Supabase est limité).

### Tables principales

```
settings              identité du showroom imprimée sur chaque document
users                 comptes administrateurs (liés à auth.users)
worker_roles          carte des permissions (JSONB) par rôle
workers               employés + compte de connexion optionnel (auth_id)
suppliers / clients   tiers
cars                  véhicules (+ specs pour la fiche technique, price public)
car_document_types    types de documents (carte grise, double clés, …)
car_documents         documents scannés d'un véhicule
purchases             achats : SUPPLIER | CLIENT (dépôt) | SHOWROOM
purchase_payments     règlements d'une dette d'achat
sales                 ventes (dont showroom_share pour les véhicules client)
sale_payments         encaissements sur une vente
client_settlements    règlements versés au propriétaire d'un véhicule déposé
expenses              dépenses véhicule / showroom
cash_transactions     caisse (versements / retraits)
special_offers        offres spéciales du site
website_reservations  demandes de réservation venant du site
email_logs            historique des documents envoyés par email
```

### Vues

| Vue                     | Usage                                                        |
|-------------------------|--------------------------------------------------------------|
| `v_cars_full`           | véhicule + dernier achat + dernière vente + dépenses          |
| `v_pending_settlements` | ventes de véhicules client dont le propriétaire attend son dû |
| `v_dashboard_kpis`      | compteurs du tableau de bord                                  |

Les vues sont en `security_invoker` : elles respectent les mêmes permissions que
les tables et ne sont jamais lisibles anonymement.

---

## 2. Premier démarrage

1. Ouvrir la page de connexion de l'application.
2. Cliquer sur **« Créer un compte administrateur »**.
   Ce bouton n'apparaît que tant qu'aucun administrateur n'existe : dès que le
   compte est créé il disparaît définitivement (RPC `admin_exists()`).
3. Se connecter, puis remplir **Paramètres → Showroom** : nom, logo, adresse,
   téléphone, RC / NIF / NIS / ART. **Tous les documents imprimés lisent ces
   informations.**

---

## 3. Employés et permissions

**Employés → Nouvel employé → « Activer un compte d'accès »** crée le compte de
connexion dans `auth.users` et le relie à la fiche employé (`workers.auth_id`).

**Employés → Permissions** coche, section par section, les actions autorisées
(`view`, `create`, `edit`, `delete`, `print`).

Cette carte de permissions est appliquée **deux fois** :

* dans l'interface — les entrées de menu et les boutons non autorisés
  n'apparaissent pas ;
* dans la base — les politiques RLS de `02_security.sql` utilisent la même carte,
  donc un employé ne peut pas contourner l'interface par l'API.

Trois rôles prêts à l'emploi sont créés : **Vendeur**, **Gestionnaire de stock**,
**Comptable**. Ils restent entièrement modifiables.

Sections disponibles : `dashboard, showroom, purchase, pos, sales, payments,
settlements, caisse, websiteSettings, websiteReservations, suppliers, clients,
workers, expenses, reports, settings`.

---

## 4. Images et documents (Storage)

| Bucket          | Colonne                 | Chemin                              |
|-----------------|-------------------------|-------------------------------------|
| `car-images`    | `cars.images` (JSONB)   | `{car_id}/{uuid}.jpg`               |
| `car-documents` | `car_documents.doc_url` | `{car_id}/{uuid}.jpg\|pdf`          |
| `client-photos` | `clients.photo_url`     | `{client_id}/{uuid}.jpg`            |
| `showroom-logo` | `settings.logo_url`     | `logo-{timestamp}.png`              |

Lecture publique (affichage direct par URL), écriture réservée aux comptes
connectés. L'URL publique complète est stockée en base.

---

## 5. Achats — les trois sources

| Source                          | Contrepartie      | Particularité                              |
|---------------------------------|-------------------|--------------------------------------------|
| **Fournisseur**                 | `suppliers`       | dette possible (montant versé)             |
| **Prestation (Dépôt client)**   | `clients`         | le véhicule appartient au client           |
| **Showroom**                    | aucune            | pas de « montant versé », aucune dette      |

---

## 6. Vente d'un véhicule de client et règlement du propriétaire

1. **POS** : lors d'une vente d'un véhicule en dépôt, l'étape des prix affiche le
   bloc « Véhicule d'un client » où l'on saisit **la part du showroom**. Le net
   du propriétaire est calculé en direct :
   `prix de vente − part du showroom − dépenses du véhicule`.
2. Une **alerte** apparaît aussitôt sur le tableau de bord, dans la barre du
   haut, sur l'entrée **Clients** du menu et sur la page Clients.
3. Un clic sur l'alerte ouvre le propriétaire concerné et son action
   **« Créer un règlement »** (proposée uniquement aux clients ayant déposé un
   véhicule). L'écran récapitule le prix de vente, la part du showroom, le total
   et le détail des dépenses.
4. La validation crée le règlement, **retire l'alerte**, propose l'impression du
   reçu (FR / AR) et l'ajoute à l'**historique du client**.

---

## 7. Impressions

Le bouton **Impressions** des pages Achats et Ventes ouvre la liste complète des
documents. Chaque document demande ses options puis la langue (Français /
العربية).

**Achats** : Bon d'entrée + inspection *(date et heure au choix)* · Formulaire
réception véhicule *(date et heure au choix)* · Engagement / contrat de dépôt
*(véhicules client)* · Fiche technique *(prix de vente modifiable)* · Bon d'achat.

**Ventes** : Facture finale · Facture proforma · Bon de versement · Bon d'entrée /
sortie *(date et heure au choix)* · Facture de vente.

**Clients** : Reçu de règlement propriétaire.

Aucune demande d'impression n'est faite après la création d'un achat ou d'une
vente : l'impression se fait quand on le décide, depuis la liste.

---

## 8. Envoi des documents par email (Brevo)

Page **Ventes → Envoyer par email** : sélection de plusieurs documents, adresse du
client, langue, objet — le tout part dans un seul message. Chaque envoi est
tracé dans `email_logs`.

En production la requête passe par la fonction serverless `api/send-email.js`
(la clé reste côté serveur). En développement local, l'application appelle Brevo
directement.

Variables d'environnement Vercel (facultatives, des valeurs par défaut existent) :

```
BREVO_API_KEY        clé API Brevo
BREVO_SENDER_EMAIL   icarmhd@gmail.com
BREVO_SENDER_NAME    mhd showroom
```

> L'expéditeur doit être **vérifié dans Brevo** (Senders & IP) sinon l'envoi est
> refusé. Si Brevo répond « unauthorized », remplacer la clé par une clé API v3
> (`xkeysib-…`) : les clés SMTP ne donnent pas accès à l'API transactionnelle.

---

## 9. Apparence

La barre du haut propose le passage **mode clair / mode sombre** (mémorisé), le
changement de langue et l'alerte des règlements. Le mode clair garde l'identité
de la marque : boutons et accents rouges, textes noirs sur fond clair.

---

## 10. Développement

```bash
npm install --prefix frontend
npm run dev       # http://localhost:5173
npm run build     # frontend/dist
```

---

## 11. Déploiement Vercel

Le dépôt se déploie en **un seul projet, depuis la racine**. Il n'y a pas de
serveur à héberger : le navigateur parle directement à Supabase, et la seule
fonction serveur est `api/send-email.js`.

### Réglages du projet Vercel

| Réglage               | Valeur                              |
|-----------------------|-------------------------------------|
| **Framework Preset**  | **Other**                           |
| **Root Directory**    | **`./`** (la racine — laisser vide) |
| Build Command         | *(laisser par défaut)*              |
| Output Directory      | *(laisser par défaut)*              |
| Install Command       | *(laisser par défaut)*              |

Les trois commandes viennent de `vercel.json`, il ne faut **rien** surcharger :

```
installCommand    npm --prefix frontend install
buildCommand      npm --prefix frontend run build
outputDirectory   frontend/dist
```

`api/send-email.js` est détecté automatiquement comme fonction serverless, et la
règle `rewrites` renvoie toutes les autres URL vers `index.html` (routage React).

### Variables d'environnement

À ajouter dans **Settings → Environment Variables** (Production + Preview) :

```
BREVO_API_KEY        clé API Brevo v3 (xkeysib-…)
BREVO_SENDER_EMAIL   icarmhd@gmail.com
BREVO_SENDER_NAME    mhd showroom
```

Les clés Supabase sont publiques (anon key) et déjà dans le code : rien à
ajouter pour la base de données.

### ⚠️ Erreur fréquente : « Root Directory = backend »

Créer un projet avec le préréglage **Express** et **Root Directory `backend`**
échoue systématiquement, avec des logs du type :

```
Found .vercelignore (repository root)
Removed 32 ignored files defined in .vercelignore
  /backend/package.json
  /backend/lib/prisma.js
  ...
Deployment failed with error.
```

Deux raisons :

1. `backend/` est listé dans `.vercelignore` — ses fichiers sont retirés avant le
   build, le dossier arrive donc **vide** sur la machine Vercel.
2. Ce dossier est de toute façon **obsolète** : l'ancienne API Express + Prisma a
   été remplacée par Supabase (voir `backend/README.md`). Aucune page de
   l'application ne l'appelle.

**Correction :** supprimer ce projet « backend » dans Vercel, puis dans le projet
principal aller dans **Settings → Build and Deployment → Root Directory**, mettre
**`./`**, enregistrer et relancer un déploiement (**Deployments → … → Redeploy**).

### Vérifier après déploiement

1. La page de connexion s'affiche et le login Supabase fonctionne.
2. Recharger directement une URL interne (`/ventes`, `/stock`) : pas de 404
   — c'est la règle `rewrites` qui fait son travail.
3. **Ventes → Envoyer par email** : un envoi réussi confirme que
   `api/send-email.js` et `BREVO_API_KEY` sont bien en place.
