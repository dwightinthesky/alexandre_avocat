# Alexandre Avocat - Cloudflare Pages Edition

Bilingual (FR/EN) static site with protected schedule admin APIs, deployed on **Cloudflare Pages + Pages Functions**.

## Structure

- `public/` static pages and assets
- `functions/api/[[path]].js` API endpoints for booking/admin
- `src/lib/*` shared auth, schedule, Outlook ICS logic
- `wrangler.toml` Pages config

## Local preview

Static only:

```bash
python3 -m http.server 4173 -d public
```

Full site + APIs (Pages runtime):

```bash
npx wrangler pages dev public
```

## Pages project

- Production URL: `https://alexandre-martinez-avocat.pages.dev`
- Preview URL format: `https://<hash>.alexandre-martinez-avocat.pages.dev`

## Required secrets (Pages)

Set on your Pages project:

```bash
npx wrangler pages secret put SCHEDULE_ADMIN_USERNAME --project-name alexandre-martinez-avocat
npx wrangler pages secret put SCHEDULE_ADMIN_PASSWORD --project-name alexandre-martinez-avocat
npx wrangler pages secret put SCHEDULE_AUTH_SECRET --project-name alexandre-martinez-avocat
```

Optional environment vars:

- `OUTLOOK_ICS_URL`
- `ALLOW_INSECURE_ICS` (`0` or `1`)

## Deploy

```bash
npx wrangler pages deploy public --project-name alexandre-martinez-avocat
```

## API routes

- `GET /api/schedule`
- `POST /api/schedule/book`
- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET/PUT /api/admin/schedule`
- `POST /api/admin/outlook-sync`
- `POST /api/admin/apply-rules`

## Redirects

- `/honoraires(.html)` -> `/methode`
- `/en/honoraires(.html)` -> `/en/approach`
