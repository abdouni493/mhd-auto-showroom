# backend/ — ancien serveur Express (NON DÉPLOYÉ)

> ⚠️ **Ne pas déployer ce dossier sur Vercel.**
> Il est conservé uniquement comme référence historique.

L'application n'utilise plus ce serveur. Le frontend parle **directement à
Supabase** (`frontend/src/lib/supabase.js` + `frontend/src/lib/api.js`), et la
seule fonction serveur encore en service est `api/send-email.js` à la racine du
dépôt.

Ce dossier est listé dans `.vercelignore` : ses fichiers sont retirés de chaque
déploiement. Créer un projet Vercel avec **Root Directory = `backend`** échoue
donc toujours — le dossier arrive vide sur la machine de build.

## Déployer correctement

Un seul projet Vercel, avec **Root Directory = `./`** (la racine du dépôt).
Voir la section « Déploiement Vercel » de [`../SETUP.md`](../SETUP.md).

## Ce qu'il contenait

API REST Express + Prisma (PostgreSQL) : `auth`, `cars`, `purchases`, `sales`,
`payments`, `workers`, `expenses`, `reports`, `website`, `dashboard`, `upload`.
Toutes ces routes ont été remplacées par des requêtes PostgREST/Supabase et par
les triggers SQL de `sql/01_schema.sql`.
