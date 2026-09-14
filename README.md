# 🚗 MHD AUTO — Showroom Management System

A complete, production-ready bilingual (French/Arabic) automotive showroom
management web application.

- **Frontend:** React 18 + Vite + React Router v6 + Tailwind CSS + Zustand + Recharts + react-i18next
- **Backend:** **none to host** — the browser talks to **Supabase** directly (PostgREST + RLS + Storage)
- **Database:** Supabase PostgreSQL (schema, triggers and views in [`sql/`](sql/))
- **Auth:** Supabase Auth (`@supabase/supabase-js`), permissions per worker role via RLS
- **Serverless:** a single function, [`api/send-email.js`](api/send-email.js), proxying Brevo for document emails
- **Design:** dark luxury crimson glassmorphism, with a light mode

> **There is no server to deploy.** An obsolete Express + Prisma API used to live
> in `backend/`; it was deleted because it repeatedly got mistaken for a
> deployable target. It is still in git history if you ever need it:
> `git checkout f104309 -- legacy-backend`.

---

## Installation

Everything runs from the repo root.

```bash
npm install --prefix frontend
npm run dev       # http://localhost:5173
npm run build     # builds to frontend/dist
```

Database setup (run the three `sql/` files once in the Supabase SQL editor) and
all app documentation are in **[SETUP.md](SETUP.md)**.

---

## Deployment (Vercel)

**One project, deployed from the repo root.**

| Setting            | Value                                |
|--------------------|--------------------------------------|
| Framework Preset   | **Other**                            |
| **Root Directory** | **`./`** — leave it at the root      |
| Build / Output / Install | leave empty — `vercel.json` supplies them |

[`vercel.json`](vercel.json) builds `frontend/` into `frontend/dist` and exposes
`api/` as serverless functions; a rewrite sends every other path to `index.html`
for client-side routing.

> ⚠️ **Root Directory must be empty.** Pointing it at any subfolder, and picking
> the **Express** preset, is the single most common way to break this deploy.
> The install command in `vercel.json` now aborts with an explicit message if
> the build starts anywhere but the repo root.

Environment variables (Settings → Environment Variables):

```
BREVO_API_KEY        Brevo v3 API key (xkeysib-…), for sending documents by email
BREVO_SENDER_EMAIL   icarmhd@gmail.com
BREVO_SENDER_NAME    mhd showroom
```

Supabase uses a public anon key already present in the source — nothing to add
for the database.

Full walkthrough, including recovery from a misconfigured project:
**[SETUP.md § 11 Déploiement Vercel](SETUP.md)**.

---

## Routes

| Route | Description |
|-------|-------------|
| `/login` | Login + admin registration |
| `/website` | Public showroom website (no auth) |
| `/website/contacts` | Public contacts page |
| `/website/car/:id` | Public car detail |
| `/app/dashboard` | KPIs, charts, recent activity |
| `/app/showroom` | Car catalogue + detail drawer |
| `/app/purchase` | Purchases (3-step flow + invoice print) |
| `/app/pos` | Caisse / POS (3-step sale flow + invoice print) |
| `/app/sales` | Sales list (pay debt, edit, delete, print) |
| `/app/payments` | Client car payments + receipts |
| `/app/suppliers` | Suppliers + purchase history |
| `/app/clients` | Clients + full history |
| `/app/workers` | Workers, roles, permissions, advances, absences, payroll |
| `/app/expenses` | Car & showroom expenses |
| `/app/reports` | 9-section printable report by date range |
| `/app/website-settings` | Offers / special offers / contacts / appearance |
| `/app/website-reservations` | Incoming website reservations |
| `/app/settings` | Showroom info / account / backup |

---

## Features

- Full CRUD with real Supabase persistence on every entity
- 3-step Purchase and Sale wizards with image upload & inspection checklists
- Invoice / receipt printing (`window.print()` with print-only templates)
- Debt tracking and payment ledgers on purchases, sales, and cars
- Owner settlements for consigned (client-owned) vehicles
- Dashboard analytics (line / bar / doughnut charts)
- Worker payroll with advances, absences, and role-based permission matrix
- Public website with offers, special offers (countdown), reservations
- Bilingual FR/AR with RTL layout switching, dark and light modes
- Sending documents by email through Brevo

---

## Project structure

```
.
├── api/              Vercel serverless functions (send-email.js)
├── frontend/         React app (pages, components, store, hooks, i18n, utils)
│   └── src/lib/      supabase.js (client) + api.js (all data access)
├── sql/              Supabase schema, security/RLS, storage buckets
├── vercel.json       root deployment config
└── SETUP.md          full documentation (FR)
```
