/* SJNBridge: connects the open app to the relay server so Claude (through the MCP connector) can read and edit the document.
   The app opens one long-lived GET /app/events stream (SSE over fetch, so the server's keep-alive comments are visible),
   receives {id, tool, args} commands and posts each answer to POST /app/result. No document is stored on the server.
   Status values: off | connecting | online | offline | superseded | error */
(function(global){
'use strict';
var st = { status:'off', detail:'', server:'', key:'', client:'' };
var ctl = null, retryT = null, watchT = null, backoff = 1000, lastByte = 0, wantOn = false, handler = null, listeners = [];

function emit(status, detail){
  st.status = status; st.detail = detail || '';
  listeners.slice().forEach(function(f){ try{ f(status, st.detail); }catch(e){} });
}
function onStatus(f){ listeners.push(f); }
function clean(url){
  var u = String(url || '').trim().replace(/\/+$/, '');
  if(u && !/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && /^[^\s/]+\.[^\s/]+/.test(u)) u = (/^(localhost|127\.|192\.168\.|10\.)/i.test(u) ? 'http://' : 'https://') + u;
  return u;
}
function randomKey(){
  var a = new Uint8Array(24);
  global.crypto.getRandomValues(a);
  var s = ''; for(var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');          /* 32 url-safe chars */
}
function connectorUrl(server, key){ return clean(server) + '/mcp/' + key; }
function validServer(u){ return /^https?:\/\/[^\s/]+/i.test(clean(u)); }

function post(path, body){
  return fetch(st.server + path + '?room=' + encodeURIComponent(st.key), {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body), keepalive:false
  });
}
function answer(cmd){
  var reply;
  Promise.resolve().then(function(){ return handler(cmd.tool, cmd.args || {}); }).then(function(r){
    reply = { id:cmd.id, ok:true, result:r };
  }, function(e){
    reply = { id:cmd.id, ok:false, error:String(e && e.message || e || 'Error') };
  }).then(function(){
    return post('/app/result', reply).catch(function(){ return post('/app/result', reply); }).catch(function(){});
  });
}

function dispatchEvent(ev, data){
  if(ev === 'hello'){ backoff = 1000; emit('online'); return; }
  if(ev === 'superseded'){ wantOn = false; closeStream(); emit('superseded'); return; }
  if(ev === 'command'){
    var cmd; try{ cmd = JSON.parse(data); }catch(e){ return; }
    if(cmd && typeof cmd.id === 'string' && typeof cmd.tool === 'string') answer(cmd);
  }
}
function closeStream(){
  clearTimeout(retryT); clearInterval(watchT); retryT = watchT = null;
  if(ctl){ try{ ctl.abort(); }catch(e){} ctl = null; }
}
function schedule(){
  if(!wantOn) return;
  clearTimeout(retryT);
  emit('offline', 'Reconnecting…');
  retryT = setTimeout(open, backoff);
  backoff = Math.min(backoff * 2, 30000);
}
function open(){
  if(!wantOn) return;
  closeStream();
  emit('connecting');
  var my = ctl = new AbortController();
  lastByte = Date.now();
  watchT = setInterval(function(){
    if(Date.now() - lastByte > 45000){ try{ my.abort(); }catch(e){} }          /* the server pings every 15 s */
  }, 5000);
  fetch(st.server + '/app/events?room=' + encodeURIComponent(st.key) + '&client=' + encodeURIComponent(st.client), {
    headers:{ Accept:'text/event-stream' }, signal:my.signal, cache:'no-store'
  }).then(function(res){
    if(!res.ok || !res.body){
      var e = new Error(res.status === 429 ? 'Too many connections. Wait a minute.' : 'Relay answered HTTP ' + res.status);
      e.fatal = res.status === 400 || res.status === 404;
      throw e;
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    function pump(){
      return reader.read().then(function(r){
        if(r.done) return;
        lastByte = Date.now();
        buf += dec.decode(r.value, { stream:true });
        var idx;
        while((idx = buf.indexOf('\n\n')) >= 0){
          var block = buf.slice(0, idx); buf = buf.slice(idx + 2);
          var ev = 'message', data = [];
          block.split('\n').forEach(function(line){
            if(line.charAt(0) === ':') return;
            var c = line.indexOf(':'); if(c < 0) return;
            var k = line.slice(0, c), v = line.slice(c + 1).replace(/^ /, '');
            if(k === 'event') ev = v; else if(k === 'data') data.push(v);
          });
          if(data.length || ev !== 'message') dispatchEvent(ev, data.join('\n'));
        }
        return pump();
      });
    }
    return pump();
  }).then(function(){
    if(ctl === my){ ctl = null; clearInterval(watchT); schedule(); }
  }, function(e){
    if(ctl !== my) return;                                   /* replaced or stopped on purpose */
    clearInterval(watchT);
    if(e && e.fatal){ wantOn = false; ctl = null; emit('error', e.message); return; }
    ctl = null; schedule();
  });
}

function start(opts){
  if(!validServer(opts.server)) { emit('error', 'Enter the relay address, like https://your-relay.example.com'); return false; }
  if(!/^[A-Za-z0-9_-]{24,64}$/.test(opts.key || '')){ emit('error', 'The room key is invalid'); return false; }
  st.server = clean(opts.server); st.key = opts.key;
  st.client = opts.client || (st.client || ('app-' + randomKey().slice(0, 8)));
  if(opts.handler) handler = opts.handler;
  wantOn = true; backoff = 1000;
  open();
  return true;
}
function stop(){
  wantOn = false; closeStream(); emit('off');
}
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible' && wantOn && (!ctl || Date.now() - lastByte > 30000)){ backoff = 1000; open(); }
});
global.addEventListener('online', function(){ if(wantOn){ backoff = 1000; open(); } });

global.SJNBridge = {
  start:start, stop:stop, onStatus:onStatus, randomKey:randomKey, connectorUrl:connectorUrl, validServer:validServer, clean:clean,
  state:function(){ return { status:st.status, detail:st.detail, server:st.server, key:st.key }; },
  setHandler:function(f){ handler = f; }
};
})(window);
