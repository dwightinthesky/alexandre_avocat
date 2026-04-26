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
- `CONTACT_NOTIFICATION_TO` (defaults to `cabinet@amartinez-avocat.fr`)
- `CONTACT_FROM_EMAIL` (defaults to `cabinet@amartinez-avocat.fr`)
- `CONTACT_FROM_NAME` (defaults to `Cabinet Alexandre MARTINEZ`)
- `RESEND_API_KEY` (optional, used if you want Resend)
- `MAILCHANNELS_API_KEY` (optional, used if you want authenticated MailChannels delivery)
- `MAILCHANNELS_ENDPOINT` (optional, defaults to `https://api.mailchannels.net/tx/v1/send`)

## Contact email providers

`POST /api/contact` now supports three provider paths, in this order:

1. Cloudflare `send_email` binding on `CONTACT_EMAIL`
2. `RESEND_API_KEY`
3. `MAILCHANNELS_API_KEY`

If none of these are configured, contact submissions will fail with an explicit configuration error.

### Cloudflare Email Service setup

To make `POST /api/contact` send real emails through Cloudflare Email Service:

1. Your sending domain must be on Cloudflare DNS.
2. In the Cloudflare dashboard, go to `Compute > Email Service > Email Sending`.
3. Onboard the domain you want to send from, then let Cloudflare add the required DNS records.
4. Make sure the sender address used by the site belongs to that onboarded domain.
   - Current default sender: `cabinet@amartinez-avocat.fr`
5. Add a `CONTACT_EMAIL` email binding to the Pages project in Cloudflare so it is available to Pages Functions at runtime.

If you need to override the sender identity, set:

- `CONTACT_FROM_EMAIL`
- `CONTACT_FROM_NAME`

The notification recipient is controlled by:

- `CONTACT_NOTIFICATION_TO` (defaults to `cabinet@amartinez-avocat.fr`)

## Deploy

```bash
npx wrangler pages deploy public --project-name alexandre-martinez-avocat
```

## API routes

- `POST /api/contact`
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
