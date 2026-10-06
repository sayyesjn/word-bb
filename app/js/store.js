/* SJNStore: document library in IndexedDB (falls back to memory when IndexedDB is unavailable). */
(function(global){
'use strict';
var DB = 'sjn-word', VER = 1, DOCS = 'docs', META = 'meta';
var dbp = null, mem = { docs:{}, meta:{} }, persistent = false;

function open(){
  if(dbp) return dbp;
  dbp = new Promise(function(resolve){
    if(!global.indexedDB){ resolve(null); return; }
    var req;
    try{ req = global.indexedDB.open(DB, VER); }catch(e){ resolve(null); return; }
    req.onupgradeneeded = function(){
      var db = req.result;
      if(!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath:'id' });
      if(!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = function(){
      var db = req.result;
      db.onversionchange = function(){ db.close(); dbp = null; };
      persistent = true;
      resolve(db);
    };
    req.onerror = req.onblocked = function(){ resolve(null); };
  });
  return dbp;
}
function tx(store, mode, fn){
  return open().then(function(db){
    if(!db) return fn(null);
    return new Promise(function(resolve, reject){
      var t = db.transaction(store, mode), os = t.objectStore(store), out;
      try{ out = fn(os); }catch(e){ reject(e); return; }
      t.oncomplete = function(){ resolve(out && 'result' in out ? out.result : undefined); };
      t.onerror = t.onabort = function(){ reject(t.error || new Error('IndexedDB error')); };
    });
  });
}
function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }

function put(rec){
  return open().then(function(db){
    if(!db){ mem.docs[rec.id] = clone(rec); return rec.id; }
    return tx(DOCS, 'readwrite', function(os){ return os.put(rec); }).then(function(){ return rec.id; });
  });
}
function get(id){
  return open().then(function(db){
    if(!db) return clone(mem.docs[id]) || null;
    return tx(DOCS, 'readonly', function(os){ return os.get(id); }).then(function(r){ return r || null; });
  });
}
function remove(id){
  return open().then(function(db){
    if(!db){ delete mem.docs[id]; return; }
    return tx(DOCS, 'readwrite', function(os){ return os['delete'](id); });
  });
}
function list(){
  function meta(r){
    var txt = String(r.html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return { id:r.id, title:r.title, created:r.created, updated:r.updated, preview:txt.slice(0, 90), size:(r.html || '').length };
  }
  return open().then(function(db){
    if(!db) return Object.keys(mem.docs).map(function(k){ return meta(mem.docs[k]); }).sort(function(a, b){ return b.updated - a.updated; });
    return tx(DOCS, 'readonly', function(os){ return os.getAll(); }).then(function(all){
      return (all || []).map(meta).sort(function(a, b){ return b.updated - a.updated; });
    });
  });
}
function getMeta(k){
  return open().then(function(db){
    if(!db) return mem.meta[k];
    return tx(META, 'readonly', function(os){ return os.get(k); });
  });
}
function setMeta(k, v){
  return open().then(function(db){
    if(!db){ mem.meta[k] = v; return; }
    return tx(META, 'readwrite', function(os){ return os.put(v, k); });
  });
}
function persist(){
  try{
    if(global.navigator && navigator.storage && navigator.storage.persist){
      return navigator.storage.persisted().then(function(p){ return p || navigator.storage.persist(); }).catch(function(){ return false; });
    }
  }catch(e){}
  return Promise.resolve(false);
}
function newId(){
  var a = new Uint8Array(9);
  (global.crypto || global.msCrypto).getRandomValues(a);
  return Array.prototype.map.call(a, function(b){ return (b % 36).toString(36); }).join('');
}

global.SJNStore = {
  open:open, put:put, get:get, remove:remove, list:list, getMeta:getMeta, setMeta:setMeta, persist:persist, newId:newId,
  isPersistent:function(){ return persistent; }
};
})(typeof self !== 'undefined' ? self : this);
