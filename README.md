# Alexandre Avocat - Cloudflare Edition

Static bilingual (FR/EN) law-office site with a protected admin schedule panel and booking APIs, deployed on **Cloudflare Workers + Assets**.

## Structure

- `public/` static pages and assets
- `src/worker.js` Cloudflare Worker router + API handlers
- `src/lib/*` auth, schedule store, Outlook ICS sync helpers
- `wrangler.toml` Cloudflare deploy config

## Local preview

```bash
# Static-only preview
python3 -m http.server 4173 -d public
```

Open: `http://127.0.0.1:4173/index.html`

To test APIs locally with Worker runtime:

```bash
npx wrangler dev
```

## Required secrets (Cloudflare)

Set these before deploy:

```bash
npx wrangler secret put SCHEDULE_ADMIN_USERNAME
npx wrangler secret put SCHEDULE_ADMIN_PASSWORD
npx wrangler secret put SCHEDULE_AUTH_SECRET
```

Optional vars:

- `OUTLOOK_ICS_URL` default Outlook ICS source
- `ALLOW_INSECURE_ICS=1` only for non-production HTTP ICS debugging

## Optional persistence (recommended)

Create and bind a KV namespace so schedule data survives worker restarts:

```bash
npx wrangler kv namespace create SCHEDULE_KV
```

Then add to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SCHEDULE_KV"
id = "<your-namespace-id>"
```

Without KV, schedule data uses in-memory fallback and can reset.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler deploy
```

## Routes

APIs served by Worker:

- `GET /api/schedule`
- `POST /api/schedule/book`
- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET/PUT /api/admin/schedule`
- `POST /api/admin/outlook-sync`
- `POST /api/admin/apply-rules`

Legacy redirects kept:

- `/honoraires(.html)` -> `/methode`
- `/en/honoraires(.html)` -> `/en/approach`
