# legacy-backend/ — ancien serveur Express (NON DÉPLOYÉ)

> ⚠️ **Ce dossier n'est pas déployable et ne doit jamais être un « Root
> Directory » Vercel.** Il est conservé uniquement comme référence historique.
> Il s'appelait `backend/` ; il a été renommé parce que ce nom poussait à créer
> par erreur un projet Vercel pointant dessus.

L'application n'utilise plus ce serveur. Le frontend parle **directement à
Supabase** (`frontend/src/lib/supabase.js` + `frontend/src/lib/api.js`), et la
seule fonction serveur encore en service est `api/send-email.js` à la racine du
dépôt.

## Déployer correctement

Un seul projet Vercel, avec **Root Directory = `./`** (la racine du dépôt).
Voir la section « Déploiement Vercel » de [`../SETUP.md`](../SETUP.md).

## Ce qu'il contenait

API REST Express + Prisma (PostgreSQL) : `auth`, `cars`, `purchases`, `sales`,
`payments`, `workers`, `expenses`, `reports`, `website`, `dashboard`, `upload`.
Toutes ces routes ont été remplacées par des requêtes PostgREST/Supabase et par
les triggers SQL de `sql/01_schema.sql`.

Pour le relancer localement (nécessite un PostgreSQL et un `.env` avec
`DATABASE_URL`) :

```bash
npm install --prefix legacy-backend
npm --prefix legacy-backend run dev     # http://localhost:4000
```
