/**
 * functions/api.js
 * Cloudflare Pages Function — sits between the browser and the Apps Script
 * backend. Two jobs:
 *   1. The browser talks to this (same origin as the site, so no CORS
 *      problem ever reaches it) — this forwards to Apps Script server-to-
 *      server, where CORS doesn't apply at all, and adds proper CORS
 *      headers to what it hands back.
 *   2. Keeps the real Apps Script URL out of the public JS bundle — it
 *      only ever lives in the APPS_SCRIPT_URL environment variable,
 *      configured in the Cloudflare Pages dashboard (Settings ->
 *      Environment variables), never committed to this repo.
 *
 * File is named api.js (not api/index.js) on purpose — that maps
 * unambiguously to the /api route.
 */

export async function onRequestPost(context) {
  return forward(context, 'POST');
}

export async function onRequestGet(context) {
  return forward(context, 'GET');
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function forward(context, method) {
  const { request, env } = context;
  const target = env.APPS_SCRIPT_URL;

  if (!target) {
    return json({ ok: false, message: 'Server misconfigured: APPS_SCRIPT_URL is not set in Cloudflare Pages.' }, 500);
  }

  let upstream;
  try {
    if (method === 'POST') {
      // text/plain (not application/json) keeps this a "simple request" on
      // the way in from the browser, and matches what Apps Script's doPost
      // expects to manually JSON.parse — see WebApp.gs.
      const bodyText = await request.text();
      upstream = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyText,
        redirect: 'follow' // Apps Script 302s to a googleusercontent.com execution URL
      });
    } else {
      const incoming = new URL(request.url);
      const upstreamUrl = new URL(target);
      incoming.searchParams.forEach(function (value, key) { upstreamUrl.searchParams.set(key, value); });
      upstream = await fetch(upstreamUrl.toString(), { method: 'GET', redirect: 'follow' });
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
