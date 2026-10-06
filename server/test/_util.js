// Shared helpers for the relay tests (not a test file itself).
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { start } from '../server.js';

export const newKey = () => randomBytes(24).toString('base64url'); // 32 chars

/** Start an in-process relay with a log collector. */
export async function boot(opts = {}) {
  const logs = [];
  const app = await start(0, { log: (l) => logs.push(l), sweepIntervalMs: 0, shutdownGraceMs: 50, ...opts });
  return { ...app, logs };
}

/** POST a JSON-RPC payload (object/array/raw string) to /mcp/KEY. */
export async function rpc(base, key, payload, init = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const res = await fetch(`${base}/mcp/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body,
    ...init,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : null };
}
export const call = (base, key, name, args, id = 1) =>
  rpc(base, key, { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

/** Minimal SSE client over http.get; collects events and comment lines. */
export function sse(base, key, client = 'c1') {
  return new Promise((resolve, reject) => {
    const events = [];
    const comments = [];
    const waiters = [];
    let buf = '';
    let ended = false;
    const state = { events, comments, ended: () => ended };
    const check = () => {
      for (const w of [...waiters]) {
        const hit = events.find((e) => e.event === w.event && !e.taken);
        if (hit) { hit.taken = true; waiters.splice(waiters.indexOf(w), 1); w.resolve(hit); }
      }
    };
    const req = http.get(`${base}/app/events?room=${key}&client=${client}`, (res) => {
      state.res = res;
      res.setEncoding('utf8');
      res.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = 'message', data = '';
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) comments.push(line);
            else if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data) events.push({ event, data: JSON.parse(data) });
        }
        check();
      });
      res.on('end', () => { ended = true; });
      res.on('close', () => { ended = true; });
      state.next = (event, ms = 3000) =>
        new Promise((ok, no) => {
          const w = { event, resolve: ok };
          waiters.push(w);
          check();
          setTimeout(() => no(new Error(`timeout waiting for SSE event ${event}`)), ms).unref();
        });
      state.close = () => req.destroy();
      resolve(state);
    });
    req.on('error', (e) => (ended ? undefined : reject(e)));
  });
}

export async function postResult(base, key, body) {
  const res = await fetch(`${base}/app/result?room=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

/** A fake app: connects over SSE and answers each command with handler(cmd) -> {ok,...}. */
export async function fakeApp(base, key, handler, client = 'app1') {
  const conn = await sse(base, key, client);
  await conn.next('hello');
  const seen = [];
  (async () => {
    for (;;) {
      let cmd;
      try { cmd = (await conn.next('command', 60000)).data; } catch { return; }
      seen.push(cmd);
      const answer = await handler(cmd);
      if (answer) await postResult(base, key, { id: cmd.id, ...answer });
    }
  })();
  return { conn, seen };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
