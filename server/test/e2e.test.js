// Runs test/e2e-simulated-app.js as a child process against an in-process relay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boot, newKey, rpc, call } from './_util.js';

test('simulated app script answers get_document and edit through /mcp', async (t) => {
  const app = await boot();
  const key = newKey();
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // the script exits immediately when it thinks it runs as a test
  const child = spawn(process.execPath, [fileURLToPath(new URL('./e2e-simulated-app.js', import.meta.url)), '--server', app.url, '--room', key], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env,
  });
  t.after(async () => { child.kill(); await app.close(); });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => d.toString().includes('connected (') && resolve());
    child.on('exit', () => reject(new Error('script exited early')));
    setTimeout(() => reject(new Error('script did not connect')), 5000).unref();
  });
  const doc = await call(app.url, key, 'word_get_document', {});
  assert.equal(doc.json.result.isError, false);
  assert.match(doc.json.result.content[0].text, /\[2\] p: Agenda for <b>Monday<\/b>/);
  const edit = await call(app.url, key, 'word_edit', { ops: [{ op: 'delete', i: 4 }] });
  assert.match(edit.json.result.content[0].text, /^Applied 1 operation/);
  const bad = await call(app.url, key, 'word_open_document', { id: 'missing' });
  assert.equal(bad.json.result.isError, true);
  assert.equal((await rpc(app.url, key, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 200);
});
