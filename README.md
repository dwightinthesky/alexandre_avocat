# Alexandre Avocat - Site Vitrine

Fast-loading website for a Paris law office, with a protected schedule admin panel.

## Pages

- `index.html` (Accueil)
- `domaines.html` (Domaines d'intervention)
- `methode.html` (Méthode)
- `rendez-vous.html` (Prendre Rendez-vous)
- `admin-schedule.html` (édition sécurisée des disponibilités)
- `mentions-legales.html` (Mentions légales + médiateur)
- `politique-confidentialite.html` (RGPD)

## Local preview

```bash
python3 -m http.server 4173
```

Open: `http://127.0.0.1:4173/index.html`

Note: the Python server is only for static preview (no `/api` routes).  
Use Vercel (`vercel dev` or deployed project) to test login + schedule APIs.

## Admin auth & schedule API

Set these environment variables in Vercel Project Settings:

- `SCHEDULE_ADMIN_USERNAME`
- `SCHEDULE_ADMIN_PASSWORD`
- `SCHEDULE_AUTH_SECRET` (long random secret for cookie signing)

Optional (recommended for persistence across deployments/instances):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Without KV variables, schedule data falls back to memory and can reset.

Optional (Outlook sync default source):

- `OUTLOOK_ICS_URL` (public/private Outlook ICS URL, can also be set from admin page)

Admin page capabilities:

- Manual slot editing
- Outlook ICS sync (`/api/admin/outlook-sync`)
- Recurring availability rules (`/api/admin/apply-rules`)

## Notes before production

- Replace hosting provider placeholders in `mentions-legales.html`.

## Deploy to Vercel

This repository uses static pages + Vercel Serverless Functions (`/api`).

Recommended Vercel project settings:
- Framework Preset: `Other`
- Build Command: empty
- Output Directory: empty
