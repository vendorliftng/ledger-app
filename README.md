# Ledger — frontend

The web app for Admiral Distribution's Ledger system. This repo is a
Cloudflare Worker: `public/` is the static site, `src/worker.js` is the one
small piece of server code — it proxies `/api` requests to the Google Apps
Script backend and serves everything else as a static file. The actual data
lives in a Google Sheet, driven by the Apps Script project in a separate
folder, not in this repo.

## How this is hosted

- **Source:** this GitHub repo
- **Hosting:** a Cloudflare Worker, connected directly to this repo — every
  push to `main` deploys automatically (`npx wrangler deploy`, configured
  by `wrangler.toml`)
- **Backend:** a Google Apps Script Web App (the Sheet + script), reached
  through `src/worker.js`'s `/api` route so the browser never talks to it
  directly (avoids cross-origin issues, keeps the raw Apps Script URL out
  of the public site)

## Backend URL

`APPS_SCRIPT_URL` is set directly in `wrangler.toml` under `[vars]` — the
Cloudflare dashboard's own "Variables and secrets" UI didn't reliably
attach to the Worker's runtime for this project (tried Plaintext, Secret,
and the Bindings panel — none of it stuck across a redeploy), so the file
is the actual source of truth here. It's not a password: the real
protection is the PIN-login/session system in the backend itself, not
keeping this address hidden.

## Local development

```
cp .dev.vars.example .dev.vars
# edit .dev.vars with your real Apps Script test-deployment URL
npx wrangler dev
```

## Status

Full build, both fronts:

- **Mobile app** (`index.html`, Marketer only) — the six field-capture forms
  plus Reconciliation, installable as a PWA, works offline (IndexedDB outbox
  + Background Sync, with a foreground fallback for iOS).
- **Admin dashboard** (`admin.html`, Owner/Manager/Storekeeper) — Overview
  with trend charts, Record Entry (the same six forms, for desk use),
  Records (browse/edit, with edited rows flagged), Reconciliation history,
  Cold Room stock, Marketers/Products/Locations/Users management, Audit Log,
  Settings. Responsive down to phone width.

Both talk to `/api` → the Apps Script backend, never `google.script.run`.
Custom domain and moving off Google Sheets are both open, deliberately
deferred future phases — not urgent at current scale.
