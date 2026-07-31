/* Ledger — IndexedDB wrapper. Two stores:
     referenceData — a single cached copy of getBootstrap's response, so
                      forms can still populate their dropdowns with no signal
     outbox        — queued submissions waiting to send (see outbox.js)

   Plain IndexedDB, no library. This file runs in both the page and the
   service worker (Background Sync happens there), so it must never touch
   window/document — only indexedDB, which both contexts have. */

var LEDGER_DB_NAME = 'ledger-db';
var LEDGER_DB_VERSION = 1;

function openLedgerDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(LEDGER_DB_NAME, LEDGER_DB_VERSION);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('referenceData')) db.createObjectStore('referenceData', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'clientRef' });
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function saveReferenceData(data) {
  return openLedgerDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('referenceData', 'readwrite');
      tx.objectStore('referenceData').put({ key: 'bootstrap', data: data, savedAt: new Date().toISOString() });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function loadReferenceData() {
  return openLedgerDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('referenceData', 'readonly');
      var req = tx.objectStore('referenceData').get('bootstrap');
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function outboxAdd(item) {
  return openLedgerDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').put(item);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/** put() upserts, so updating a queued item (e.g. a fresh token) reuses this. */
function outboxUpdate(item) { return outboxAdd(item); }

function outboxRemove(clientRef) {
  return openLedgerDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').delete(clientRef);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function outboxAll() {
  return openLedgerDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('outbox', 'readonly');
      var req = tx.objectStore('outbox').getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  });
}
