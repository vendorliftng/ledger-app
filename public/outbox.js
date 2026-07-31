/* Ledger — offline outbox for the 6 field-capture actions (Stock In, Load
   Out, Sale, Return, Cash, Crates). Runs in both the page (immediate send
   attempt right after a submit) and the service worker (Background Sync
   draining the queue on reconnect) — no window/document references here.
   Depends on db.js being loaded first. */

function enqueueSubmission(fn, payload, token) {
  var item = {
    clientRef: payload.clientRef,
    fn: fn,
    payload: payload,
    token: token,
    createdAt: new Date().toISOString(),
    status: 'queued' // queued | needs-auth
  };
  return outboxAdd(item).then(function () { return attemptSend(item); });
}

/**
 * Tries to send one queued item.
 * Returns { sent: true, message } | { sent: false, reason: 'offline'|'auth'|'rejected', message }
 *
 * A network failure leaves the item queued and retries later, silently — a
 * rep with no signal shouldn't see an alarming error for something that
 * isn't actually wrong. A definitive server rejection (a real business-rule
 * error) removes it from the outbox — retrying a rejected submission
 * forever would be wrong — and surfaces the message so it can be fixed and
 * re-entered. An expired/invalid session keeps the item queued, not
 * deleted (deleting real field data over an auth technicality would be a
 * data-loss bug in exactly the tool meant to prevent shrinkage), and marks
 * it so it's retried automatically once the user signs in again.
 */
function attemptSend(item) {
  return fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ fn: item.fn, token: item.token, payload: item.payload })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.ok === false && /session|signed in/i.test(data.message || '')) {
        item.status = 'needs-auth';
        return outboxUpdate(item).then(function () {
          return { sent: false, reason: 'auth', message: data.message };
        });
      }
      // Any other response — ok:true (including the idempotent "already
      // recorded" case) or a definitive ok:false business rejection — means
      // the server has made its decision. Stop retrying either way.
      return outboxRemove(item.clientRef).then(function () {
        return data && data.ok === false
          ? { sent: false, reason: 'rejected', message: data.message }
          : { sent: true, message: data && data.message };
      });
    })
    .catch(function () {
      return { sent: false, reason: 'offline' };
    });
}

/** Re-stamps every queued item with a fresh token (after re-login) and retries them all. */
function retryOutboxWithToken(token) {
  return outboxAll().then(function (items) {
    var chain = Promise.resolve();
    items.forEach(function (item) {
      item.token = token;
      chain = chain.then(function () { return attemptSend(item); });
    });
    return chain;
  });
}

/** Best-effort single pass over everything currently queued. Used by
    Background Sync and by the foreground online/visibility fallback. */
function drainOutbox() {
  return outboxAll().then(function (items) {
    var chain = Promise.resolve();
    items.forEach(function (item) {
      if (item.status === 'needs-auth') return; // waits for retryOutboxWithToken instead
      chain = chain.then(function () { return attemptSend(item); });
    });
    return chain;
  });
}
