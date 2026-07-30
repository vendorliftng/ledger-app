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
  by `wrangler.jsonc`)
- **Backend:** a Google Apps Script Web App (the Sheet + script), reached
  through `src/worker.js`'s `/api` route so the browser never talks to it
  directly (avoids cross-origin issues, keeps the raw Apps Script URL out
  of the public site)

## One required setting

In the Cloudflare dashboard (not in this repo): project → **Settings →
Variables and secrets**, add:

```
APPS_SCRIPT_URL = https://script.google.com/macros/s/.../exec
```

Without this, `/api` replies with a "Server misconfigured" message instead
of reaching the Sheet.

## Local development

```
cp .dev.vars.example .dev.vars
# edit .dev.vars with your real Apps Script test-deployment URL
npx wrangler dev
```

## Status

Phase 2 of the migration plan: proving the browser → Worker → Apps Script →
Sheet round trip works. `public/index.html` is a placeholder that checks
this connection on load — the real app screens land in Phase 3.
