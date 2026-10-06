// HTTP surface, SSE behaviour, CORS, limits, GC and log redaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, newKey, rpc, call, sse, postResult, fakeApp, sleep } from './_util.js';

test('health endpoints', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  for (const p of ['/', '/healthz']) {
    const res = await fetch(app.url + p);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, name: 'sjn-word-relay', version: '1.0.0' });
  }
});

test('invalid room keys give 404 JSON on every route', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const bad = ['short', 'a'.repeat(23), 'a'.repeat(65), 'has space ' + 'a'.repeat(20), 'ünïcode' + 'a'.repeat(24), ''];
  for (const k of bad) {
    for (const [method, path] of [
      ['GET', `/app/events?room=${encodeURIComponent(k)}`],
      ['GET', `/app/status?room=${encodeURIComponent(k)}`],
      ['POST', `/app/result?room=${encodeURIComponent(k)}`],
      ['POST', `/mcp/${encodeURIComponent(k)}`],
    ]) {
      const res = await fetch(app.url + path, { method, body: method === 'POST' ? '{}' : undefined });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.match(res.headers.get('content-type'), /application\/json/);
      assert.ok((await res.json()).error);
    }
  }
  assert.equal((await fetch(app.url + '/nope')).status, 404);
});

test('mcp: GET is 405 with Allow POST, DELETE is 204', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const get = await fetch(`${app.url}/mcp/${key}`);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  const del = await fetch(`${app.url}/mcp/${key}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
});

test('CORS preflight and headers (default and configured origin)', async (t) => {
  const app = await boot();
  const app2 = await boot({ allowOrigin: 'https://word.example' });
  t.after(() => Promise.all([app.close(), app2.close()]));
  const key = newKey();
  for (const path of ['/app/events', `/mcp/${key}`, '/app/result', '/anything']) {
    const res = await fetch(app.url + path, { method: 'OPTIONS', headers: { Origin: 'https://x.test', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(res.headers.get('access-control-allow-methods'), 'GET,POST,OPTIONS');
    assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type');
    assert.equal(res.headers.get('access-control-max-age'), '86400');
  }
  const res2 = await fetch(app2.url + '/healthz');
  assert.equal(res2.headers.get('access-control-allow-origin'), 'https://word.example');
});

test('SSE: hello, ping, headers, status', async (t) => {
  const app = await boot({ pingMs: 40 });
  t.after(() => app.close());
  const key = newKey();
  let st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.deepEqual(st, { connected: false, lastSeenMsAgo: null, pending: 0, calls: 0, lastCallMsAgo: null });

  const c = await sse(app.url, key, 'tablet-1');
  assert.equal(c.res.headers['content-type'], 'text/event-stream');
  assert.equal(c.res.headers['cache-control'], 'no-cache');
  assert.equal(c.res.headers['x-accel-buffering'], 'no');
  const hello = await c.next('hello');
  assert.equal(hello.data.room, key.slice(0, 6) + '…');
  assert.equal(hello.data.client, 'tablet-1');
  assert.ok(Math.abs(hello.data.serverTime - Date.now()) < 5000);
  await sleep(150);
  assert.ok(c.comments.includes(': ping'), 'ping comment received');

  st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.equal(st.connected, true);
  assert.ok(st.lastSeenMsAgo >= 0 && st.lastSeenMsAgo < 2000);
  c.close();
  await sleep(100);
  st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.equal(st.connected, false);
});

test('SSE: newest client wins, older gets superseded and is ended', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const a = await sse(app.url, key, 'A');
  await a.next('hello');
  const b = await sse(app.url, key, 'B');
  await b.next('hello');
  const sup = await a.next('superseded');
  assert.deepEqual(sup.data, {});
  await sleep(50);
  assert.equal(a.ended(), true);

  const pending = call(app.url, key, 'word_get_document', {});
  const cmd = await b.next('command');
  assert.equal(cmd.data.tool, 'get_document');
  assert.equal(a.events.some((e) => e.event === 'command'), false);
  await postResult(app.url, key, { id: cmd.data.id, ok: true, result: 'x' });
  assert.equal((await pending).json.result.content[0].text, 'x');
});

test('SSE: invalid client id is rejected', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const res = await fetch(`${app.url}/app/events?room=${newKey()}&client=${encodeURIComponent('bad id!')}`);
  assert.equal(res.status, 400);
});

test('POST /app/result: unknown id is 404, malformed is 400', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const r = await postResult(app.url, key, { id: 'nope', ok: true, result: 1 });
  assert.equal(r.status, 404);
  assert.deepEqual(r.json, { error: 'unknown id' });
  const bad = await fetch(`${app.url}/app/result?room=${key}`, { method: 'POST', body: 'not json' });
  assert.equal(bad.status, 400);
  const bad2 = await postResult(app.url, key, { id: 5 });
  assert.equal(bad2.status, 400);
});

test('result accepted only once; status counts pending and calls', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const c = await sse(app.url, key);
  await c.next('hello');
  const pending = call(app.url, key, 'word_list_documents', {});
  const cmd = await c.next('command');
  let st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.equal(st.pending, 1);
  assert.equal(st.calls, 1);
  assert.ok(st.lastCallMsAgo >= 0);
  assert.equal((await postResult(app.url, key, { id: cmd.data.id, ok: true, result: [] })).status, 200);
  assert.equal((await postResult(app.url, key, { id: cmd.data.id, ok: true, result: [] })).status, 404);
  await pending;
  st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.equal(st.pending, 0);
});

test('body limits: /mcp 2 MB and /app/result 4 MB give 413', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const big = await rpc(app.url, key, 'x'.repeat(2 * 1024 * 1024 + 10));
  assert.equal(big.status, 413);
  const ok = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'ping' });
  assert.equal(ok.status, 200);
  const res = await fetch(`${app.url}/app/result?room=${key}`, { method: 'POST', body: 'y'.repeat(4 * 1024 * 1024 + 10) });
  assert.equal(res.status, 413);
});

test('room GC: idle rooms removed after 10 minutes, live/pending rooms kept', async (t) => {
  let clock = 1_000_000;
  const app = await boot({ now: () => clock });
  t.after(() => app.close());
  const idle = newKey(), live = newKey(), busy = newKey();

  await call(app.url, idle, 'word_get_document', {}); // idle: created by a call with no app
  const c = await sse(app.url, live); // live: has an SSE client
  await c.next('hello');
  const b = await sse(app.url, busy); // busy: pending call, client gone
  await b.next('hello');
  const pending = call(app.url, busy, 'word_get_document', {});
  const cmd = await b.next('command');
  b.close();
  await sleep(100);
  assert.equal(app.rooms.size, 3);

  clock += 9 * 60_000;
  assert.equal(app.sweep(), 0);
  clock += 2 * 60_000; // 11 minutes idle
  assert.equal(app.sweep(), 1, 'only the idle room goes');
  assert.ok(!app.rooms.has(idle));
  assert.ok(app.rooms.has(live) && app.rooms.has(busy));

  await postResult(app.url, busy, { id: cmd.data.id, ok: true, result: 'done' });
  await pending;
  clock += 11 * 60_000;
  assert.equal(app.sweep(), 1, 'busy room goes once its call is done');
  assert.ok(app.rooms.has(live), 'room with a connected client is never collected');
});

test('logs never contain a full room key', async (t) => {
  const app = await boot();
  t.after(() => app.close());
  const key = newKey();
  const c = await sse(app.url, key);
  await c.next('hello');
  await fakeApp(app.url, key, () => ({ ok: true, result: 'hi' }), 'second');
  await call(app.url, key, 'word_get_document', {});
  await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'ping' });
  await fetch(`${app.url}/app/status?room=${key}`);
  await fetch(`${app.url}/mcp/${key}`);
  await fetch(`${app.url}/app/status?room=${'Z'.repeat(30)}`); // invalid key must be redacted too
  c.close();
  await sleep(100);
  assert.ok(app.logs.length > 8, 'lines were logged');
  for (const line of app.logs) {
    assert.ok(!line.includes(key), `full key leaked: ${line}`);
    assert.ok(!line.includes('Z'.repeat(24)), `invalid key leaked: ${line}`);
  }
  assert.ok(app.logs.some((l) => l.includes(key.slice(0, 6) + '…')));
});

test('close() ends SSE streams and fails pending calls', async () => {
  const app = await boot();
  const key = newKey();
  const c = await sse(app.url, key);
  await c.next('hello');
  const pending = call(app.url, key, 'word_get_document', {});
  await c.next('command');
  await app.close();
  const r = await pending;
  assert.equal(r.json.result.isError, true);
  assert.equal(c.ended(), true);
});
