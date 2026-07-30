/**
 * src/worker.js
 * The one entry point for this Worker (see wrangler.jsonc's "main"). Two jobs:
 *   - /api requests are proxied to the Apps Script backend (server-to-server,
 *     so no CORS issue reaches the browser; also keeps the real Apps Script
 *     URL out of anything the browser can see — it only ever lives in the
 *     APPS_SCRIPT_URL variable, set in Cloudflare's dashboard, Settings ->
 *     Variables and secrets).
 *   - everything else is served as a static file from public/, via the
 *     ASSETS binding configured in wrangler.jsonc.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api') {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const target = env.APPS_SCRIPT_URL;
  if (!target) {
    return json({ ok: false, message: 'Server misconfigured: APPS_SCRIPT_URL is not set in Cloudflare.' }, 500);
  }

  let upstream;
  try {
    if (method === 'POST') {
      // text/plain (not application/json) keeps this a "simple request" —
      // matches what Apps Script's doPost expects to manually JSON.parse.
      const bodyText = await request.text();
      upstream = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyText,
        redirect: 'follow' // Apps Script 302s to a googleusercontent.com execution URL
      });
    } else if (method === 'GET') {
      const incoming = new URL(request.url);
      const upstreamUrl = new URL(target);
      incoming.searchParams.forEach(function (value, key) { upstreamUrl.searchParams.set(key, value); });
      upstream = await fetch(upstreamUrl.toString(), { method: 'GET', redirect: 'follow' });
    } else {
      return json({ ok: false, message: 'Method not allowed.' }, 405);
    }
  } catch (err) {
    return json({ ok: false, message: 'Could not reach the backend: ' + err.message }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}
