// MCP protocol behaviour of POST /mcp/KEY and the tool relay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, newKey, rpc, call, sse, fakeApp, postResult } from './_util.js';
import { OPS_REFERENCE } from '../ops-reference.js';

const setup = async (t, opts) => {
  const app = await boot(opts);
  t.after(() => app.close());
  return { app, key: newKey() };
};

test('initialize echoes supported versions, otherwise answers 2025-06-18', async (t) => {
  const { app, key } = await setup(t);
  for (const v of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    const r = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v, capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.equal(r.headers.get('mcp-session-id'), null);
    assert.equal(r.json.result.protocolVersion, v);
    assert.deepEqual(r.json.result.capabilities, { tools: { listChanged: false } });
    assert.deepEqual(r.json.result.serverInfo, { name: 'sjn-word', version: '1.0.0' });
    assert.match(r.json.result.instructions, /word_get_document/);
    assert.match(r.json.result.instructions, /word_edit/);
  }
  const odd = await rpc(app.url, key, { jsonrpc: '2.0', id: 'a', method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(odd.json.result.protocolVersion, '2025-06-18');
  assert.equal(odd.json.id, 'a');
  const none = await rpc(app.url, key, { jsonrpc: '2.0', id: 2, method: 'initialize' });
  assert.equal(none.json.result.protocolVersion, '2025-06-18');
});

test('ping returns {} and works without an app', async (t) => {
  const { app, key } = await setup(t);
  const r = await rpc(app.url, key, { jsonrpc: '2.0', id: 7, method: 'ping' });
  assert.deepEqual(r.json, { jsonrpc: '2.0', id: 7, result: {} });
});

test('tools/list returns exactly the five tools with the specified schemas', async (t) => {
  const { app, key } = await setup(t);
  const r = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = r.json.result.tools;
  assert.deepEqual(tools.map((x) => x.name), ['word_get_document', 'word_edit', 'word_list_documents', 'word_open_document', 'word_new_document']);
  const by = Object.fromEntries(tools.map((x) => [x.name, x]));
  assert.deepEqual(by.word_get_document.inputSchema.properties.scope.enum, ['all', 'selection']);
  assert.equal(by.word_get_document.inputSchema.properties.max_chars.type, 'integer');
  assert.equal(by.word_get_document.inputSchema.required, undefined);
  assert.match(by.word_get_document.description, /ALWAYS call this before word_edit/);
  assert.deepEqual(by.word_edit.inputSchema.required, ['ops']);
  assert.equal(by.word_edit.inputSchema.properties.ops.type, 'array');
  assert.ok(by.word_edit.description.startsWith('Edit the open document by applying operations in one undoable step'));
  assert.ok(by.word_edit.description.endsWith(OPS_REFERENCE));
  assert.ok(by.word_edit.description.includes('Returns a summary and the fresh listing.\n\nOperations (i / after are block numbers'));
  assert.ok(OPS_REFERENCE.includes('"op":"header_footer"') && OPS_REFERENCE.includes('Verdana.'));
  assert.deepEqual(by.word_open_document.inputSchema.required, ['id']);
  assert.equal(by.word_list_documents.description, "List the documents saved in the user's SJN Word library (id, title, last edited).");
  for (const x of tools) assert.equal(x.inputSchema.type, 'object');
});

test('every tool round-trips through the app with the right command name and args', async (t) => {
  const { app, key } = await setup(t);
  const { seen } = await fakeApp(app.url, key, (cmd) => {
    switch (cmd.tool) {
      case 'get_document': return { ok: true, result: { text: '[1] p: Hello' } }; // {text}
      case 'edit': return { ok: true, result: 'Applied 1 op\n[1] p: Hi' }; // string
      case 'list_documents': return { ok: true, result: [{ id: 'd1', title: 'A' }] }; // other -> JSON
      case 'open_document': return { ok: false, error: 'No such document' }; // error
      case 'new_document': return { ok: true, result: { id: 'n1' } };
    }
  });
  let r = await call(app.url, key, 'word_get_document', { scope: 'selection', max_chars: 500 });
  assert.deepEqual(r.json.result, { content: [{ type: 'text', text: '[1] p: Hello' }], isError: false });
  r = await call(app.url, key, 'word_edit', { say: 'working', ops: [{ op: 'replace', i: 1, html: 'Hi' }] });
  assert.deepEqual(r.json.result, { content: [{ type: 'text', text: 'Applied 1 op\n[1] p: Hi' }], isError: false });
  r = await call(app.url, key, 'word_list_documents');
  assert.equal(r.json.result.isError, false);
  assert.equal(r.json.result.content[0].text, JSON.stringify([{ id: 'd1', title: 'A' }]));
  r = await call(app.url, key, 'word_open_document', { id: 'zzz' });
  assert.deepEqual(r.json.result, { content: [{ type: 'text', text: 'Error: No such document' }], isError: true });
  r = await call(app.url, key, 'word_new_document', { title: 'Letter' });
  assert.equal(r.json.result.content[0].text, '{"id":"n1"}');

  assert.deepEqual(seen.map((c) => [c.tool, c.args]), [
    ['get_document', { scope: 'selection', max_chars: 500 }],
    ['edit', { ops: [{ op: 'replace', i: 1, html: 'Hi' }], say: 'working' }],
    ['list_documents', {}],
    ['open_document', { id: 'zzz' }],
    ['new_document', { title: 'Letter' }],
  ]);
  for (const c of seen) assert.match(c.id, /^[0-9a-f-]{36}$/);
});

test('no app connected: immediate isError with the friendly message', async (t) => {
  const { app, key } = await setup(t);
  const started = Date.now();
  const r = await call(app.url, key, 'word_get_document', {});
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(r.json.result, {
    content: [{ type: 'text', text: 'The SJN Word app is not connected. Open SJN Word on the tablet (Menu > Claude connection > Connect) and keep it open, then try again.' }],
    isError: true,
  });
});

test('timeout: app never answers', async (t) => {
  const { app, key } = await setup(t, { toolTimeoutMs: 150 });
  const c = await sse(app.url, key);
  await c.next('hello');
  const r = await call(app.url, key, 'word_get_document', {});
  assert.deepEqual(r.json.result, { content: [{ type: 'text', text: 'The SJN Word app did not answer in time. Make sure it is open and online.' }], isError: true });
  const cmd = c.events.find((e) => e.event === 'command'); // a late answer is now unknown
  assert.equal((await postResult(app.url, key, { id: cmd.data.id, ok: true, result: 'late' })).status, 404);
  const st = await (await fetch(`${app.url}/app/status?room=${key}`)).json();
  assert.equal(st.pending, 0);
});

test('batch requests return an array; notifications-only gives 202 with empty body', async (t) => {
  const { app, key } = await setup(t);
  const r = await rpc(app.url, key, [
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 'x', method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'nope' },
    42,
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 4);
  assert.deepEqual(r.json[0], { jsonrpc: '2.0', id: 1, result: {} });
  assert.equal(r.json[1].id, 'x');
  assert.equal(r.json[2].error.code, -32601);
  assert.equal(r.json[3].error.code, -32600);

  const n = await rpc(app.url, key, [{ jsonrpc: '2.0', method: 'notifications/initialized' }]);
  assert.equal(n.status, 202);
  assert.equal(n.text, '');
  const empty = await rpc(app.url, key, []);
  assert.equal(empty.json.error.code, -32600);
});

test('batch of tool calls resolves each against the app', async (t) => {
  const { app, key } = await setup(t);
  await fakeApp(app.url, key, (cmd) => ({ ok: true, result: cmd.tool }));
  const r = await rpc(app.url, key, [
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'word_get_document' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'word_list_documents' } },
  ]);
  assert.deepEqual(r.json.map((x) => x.result.content[0].text), ['get_document', 'list_documents']);
});

test('notifications return 202 with empty body', async (t) => {
  const { app, key } = await setup(t);
  for (const method of ['notifications/initialized', 'notifications/cancelled', 'notifications/whatever']) {
    const r = await rpc(app.url, key, { jsonrpc: '2.0', method, params: {} });
    assert.equal(r.status, 202, method);
    assert.equal(r.text, '');
  }
  const resp = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, result: {} }); // client response
  assert.equal(resp.status, 202);
});

test('error codes: -32601 unknown method, -32700 parse, -32600 shape, -32602 unknown tool', async (t) => {
  const { app, key } = await setup(t);
  let r = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'resources/list' });
  assert.equal(r.json.error.code, -32601);
  assert.equal(r.json.id, 1);
  r = await rpc(app.url, key, '{not json');
  assert.equal(r.json.error.code, -32700);
  assert.equal(r.json.id, null);
  r = await rpc(app.url, key, '');
  assert.equal(r.json.error.code, -32700);
  for (const bad of [{ id: 1, method: 'ping' }, { jsonrpc: '1.0', id: 1, method: 'ping' }, 'str', null, { jsonrpc: '2.0', id: 1 }, { jsonrpc: '2.0', id: {}, method: 'ping' }]) {
    r = await rpc(app.url, key, JSON.stringify(bad));
    assert.equal(r.json.error.code, -32600, JSON.stringify(bad));
  }
  r = await call(app.url, key, 'word_delete_everything', {});
  assert.equal(r.json.error.code, -32602);
  r = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} });
  assert.equal(r.json.error.code, -32602);
  r = await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'tools/call' });
  assert.equal(r.json.error.code, -32602);
});

test('bad arguments produce isError results (not protocol errors) and never reach the app', async (t) => {
  const { app, key } = await setup(t);
  const { seen } = await fakeApp(app.url, key, () => ({ ok: true, result: 'ok' }));
  const cases = [
    ['word_get_document', { scope: 'everything' }, /scope/],
    ['word_get_document', { max_chars: 'lots' }, /max_chars/],
    ['word_get_document', { max_chars: 1.5 }, /max_chars/],
    ['word_get_document', 'string-args', /JSON object/],
    ['word_edit', {}, /ops/],
    ['word_edit', { ops: 'replace' }, /ops/],
    ['word_edit', { ops: [] }, /at least one/],
    ['word_edit', { ops: [{ i: 1 }] }, /ops\[0\]/],
    ['word_edit', { ops: [{ op: 'delete', i: 1 }, 'x'] }, /ops\[1\]/],
    ['word_edit', { ops: Array.from({ length: 401 }, () => ({ op: 'delete', i: 1 })) }, /401.*400/],
    ['word_edit', { ops: [{ op: 'delete', i: 1 }], say: 5 }, /say/],
    ['word_open_document', {}, /id/],
    ['word_open_document', { id: '  ' }, /id/],
    ['word_open_document', { id: 7 }, /id/],
    ['word_new_document', { title: 5 }, /title/],
  ];
  for (const [name, args, re] of cases) {
    const r = await call(app.url, key, name, args);
    assert.equal(r.json.error, undefined, name);
    assert.equal(r.json.result.isError, true, `${name} ${JSON.stringify(args).slice(0, 40)}`);
    assert.match(r.json.result.content[0].text, re);
  }
  assert.equal(seen.length, 0);
  const okr = await call(app.url, key, 'word_edit', { ops: Array.from({ length: 400 }, () => ({ op: 'delete', i: 1 })) });
  assert.equal(okr.json.result.isError, false); // exactly 400 ops is fine
});

test('rate limit: 61st tool call within a minute is refused', async (t) => {
  let clock = 5_000_000;
  const { app, key } = await setup(t, { now: () => clock });
  for (let n = 0; n < 60; n++) {
    const r = await call(app.url, key, 'word_list_documents', {}, n);
    assert.match(r.json.result.content[0].text, /not connected/, `call ${n}`);
  }
  const limited = await call(app.url, key, 'word_list_documents', {});
  assert.deepEqual(limited.json.result, { content: [{ type: 'text', text: 'Too many requests, wait a moment.' }], isError: true });
  const other = await call(app.url, newKey(), 'word_list_documents', {}); // other rooms are unaffected
  assert.match(other.json.result.content[0].text, /not connected/);
  clock += 61_000; // the window slides
  const again = await call(app.url, key, 'word_list_documents', {});
  assert.match(again.json.result.content[0].text, /not connected/);
});
