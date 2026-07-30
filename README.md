# Ledger — frontend

The web app for Admiral Distribution's Ledger system. This repo is the site
itself (`public/`) plus one small serverless function (`functions/api/`)
that proxies requests to the Google Apps Script backend — the actual data
lives in a Google Sheet, driven by the Apps Script project in a separate
folder, not in this repo.

## How this is hosted

- **Source:** this GitHub repo
- **Hosting:** Cloudflare Pages, connected directly to this repo — every
  push to `main` deploys automatically
- **Backend:** a Google Apps Script Web App (the Sheet + script), reached
  through `functions/api/index.js` so the browser never talks to it
  directly (avoids cross-origin issues, keeps the raw Apps Script URL out
  of the public site)

## One required setting

In the Cloudflare Pages project (not in this repo): **Settings → Environment
variables**, add:

```
APPS_SCRIPT_URL = https://script.google.com/macros/s/.../exec
```

Set it for both **Production** and **Preview**. Without this, `/api` will
reply with a "Server misconfigured" message instead of reaching the Sheet.

## Local development

```
cp .dev.vars.example .dev.vars
# edit .dev.vars with your real Apps Script test-deployment URL
npx wrangler pages dev public
```

## Status

Phase 2 of the migration plan: proving the browser → Cloudflare Function →
Apps Script → Sheet round trip works. `public/index.html` is a placeholder
that checks this connection on load — the real app screens land in Phase 3.
