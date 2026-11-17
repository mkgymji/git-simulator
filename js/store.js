/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  store.js – „Moje scénáře“: nahrané scénáře uložené jen v tomto prohlížeči
 *
 *  Ukládá se jen text scénáře (IndexedDB, databáze git-simulator). Když
 *  prohlížeč IndexedDB nedovolí (soukromé okno, soubor z disku…), scénáře
 *  se drží jen do zavření stránky a GitStore.persistent je false.
 *  Záznam: {id, title, label, text, source, added}
 * ===================================================================== */
(function (root) {
  'use strict';
  var DB = 'git-simulator', STORE = 'scenarios', memory = {}, dbPromise = null;
  var api = { persistent: false };

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        if (!root.indexedDB) return resolve(null);
        var req = root.indexedDB.open(DB, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
        req.onsuccess = function () { api.persistent = true; resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        try {
          var t = db.transaction(STORE, mode), st = t.objectStore(STORE), res = fn(st);
          t.oncomplete = function () { resolve(res && res.result !== undefined ? res.result : res); };
          t.onerror = function () { reject(t.error); };
        } catch (e) { reject(e); }
      });
    }).catch(function () { return fn(null); });
  }

  // id podle obsahu: stejný text = stejný záznam (nenahraje se dvakrát)
  function idFor(text) { return 'my-' + root.GitText.sha1(root.GitText.utf8(text)).slice(0, 10); }

  api.list = function () {
    return tx('readonly', function (st) {
      if (!st) return Object.keys(memory).map(function (k) { return memory[k]; });
      return st.getAll();
    }).then(function (items) {
      return (items || []).slice().sort(function (a, b) { return b.added - a.added; });
    });
  };
  api.get = function (id) {
    return tx('readonly', function (st) { return st ? st.get(id) : memory[id]; }).then(function (x) { return x || null; });
  };
  api.save = function (rec) {
    var item = { id: idFor(rec.text), title: rec.title, label: rec.label || '', text: rec.text, source: rec.source || '', added: Date.now() };
    memory[item.id] = item;
    return tx('readwrite', function (st) { if (st) st.put(item); return item; }).then(function () { return item; });
  };
  api.remove = function (id) {
    delete memory[id];
    return tx('readwrite', function (st) { if (st) st.delete(id); return true; });
  };
  api.idFor = idFor;

  root.GitStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
