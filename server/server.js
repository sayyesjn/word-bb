// SJN Word relay: a tiny zero-dependency bridge between
//   * Claude (claude.ai custom connector, MCP Streamable HTTP)  ->  POST /mcp/<KEY>
//   * the SJN Word web app (Server-Sent Events + POST results)  ->  /app/*
// It holds no documents; all state (rooms, pending calls) lives in memory.
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TOOL_LIST, validateArgs, appToolName, isKnownTool } from './tools.js';

const VERSION = '1.0.0';
const KEY_RE = /^[A-Za-z0-9_-]{24,64}$/;
const CLIENT_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MIN = 60 * 1000;
const LIMITS = {
  mcpBody: 2 * 1024 * 1024, // POST /mcp/KEY
  resultBody: 4 * 1024 * 1024, // POST /app/result
  maxClients: 5, // SSE connections tracked per room (superseded ones linger until their socket closes)
  maxRooms: 5000,
  rateMax: 60, // tool calls per room ...
  rateWindowMs: MIN, // ... per minute
  gcIdleMs: 10 * MIN, // idle rooms (no client, no pending call) are dropped after this
};
const TEXT = {
  offline: 'The SJN Word app is not connected. Open SJN Word on the tablet (Menu > Claude connection > Connect) and keep it open, then try again.',
  timeout: 'The SJN Word app did not answer in time. Make sure it is open and online.',
  rate: 'Too many requests, wait a moment.',
  shutdown: 'The relay is restarting. Try again in a few seconds.',
};
const INSTRUCTIONS =
  'SJN Word lets you read and edit the document open in the SJN Word web app on the user\'s device. ' +
  'Call word_get_document first, then word_edit using block numbers from the latest listing ' +
  '(word_edit returns a fresh listing). The SJN Word app must be open and connected on the user\'s device; ' +
  'if a tool says it is not connected, ask the user to open it.';

const short = (key) => String(key).slice(0, 6) + '…';
// Any long key-like token is shortened, so a full room key can never reach a log line.
const redact = (s) => String(s).replace(/[A-Za-z0-9_-]{24,}/g, (m) => m.slice(0, 6) + '…');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
class RpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Start the relay. Options (all optional): toolTimeoutMs, allowOrigin, pingMs, now (clock fn),
 * sweepIntervalMs (0 disables the GC timer), shutdownGraceMs, log (line sink), host.
 * Resolves to { server, port, url, rooms, sweep, close }.
 */
export async function start(port = 0, opts = {}) {
  const o = {
    toolTimeoutMs: Number(opts.toolTimeoutMs ?? process.env.TOOL_TIMEOUT_MS) || 30000,
    allowOrigin: opts.allowOrigin ?? (process.env.ALLOW_ORIGIN || '*'),
    pingMs: opts.pingMs ?? 15000,
    now: opts.now ?? Date.now,
    sweepIntervalMs: opts.sweepIntervalMs ?? MIN,
    shutdownGraceMs: opts.shutdownGraceMs ?? 500,
    sink: opts.log ?? ((line) => console.log(`${new Date().toISOString()} ${line}`)),
  };
  const now = o.now;
  const log = (line) => o.sink(redact(line));
  const rooms = new Map();

  // ---------------------------------------------------------------- rooms
  function getRoom(key, create) {
    let room = rooms.get(key);
    if (!room && create) {
      if (rooms.size >= LIMITS.maxRooms) throw new HttpError(503, 'Too many rooms');
      room = { key, clients: [], pending: new Map(), callTimes: [], calls: 0, lastCallAt: null, lastSeenAt: null, touchedAt: now() };
      rooms.set(key, room);
      log(`room created ${short(key)}`);
    }
    return room;
  }
  const touch = (room) => (room.touchedAt = now());
  const activeClient = (room) => [...room.clients].reverse().find((c) => !c.ended && !c.res.destroyed);

  /** Drop rooms with no client and no pending call for gcIdleMs. Returns how many were removed. */
  function sweep() {
    let removed = 0;
    for (const [key, room] of rooms) {
      if (room.clients.length === 0 && room.pending.size === 0 && now() - room.touchedAt >= LIMITS.gcIdleMs) {
        rooms.delete(key);
        removed++;
        log(`room collected ${short(key)}`);
      }
    }
    return removed;
  }
  const sweepTimer = o.sweepIntervalMs > 0 ? setInterval(sweep, o.sweepIntervalMs) : null;
  sweepTimer?.unref();

  // ------------------------------------------------------------------ sse
  const sseWrite = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  function endClient(client, event) {
    if (client.ended) return;
    client.ended = true;
    clearInterval(client.timer);
    if (event) sseWrite(client.res, event, {});
    client.res.end();
  }

  /** GET /app/events: open the stream; the newest client of a room is the only active one. */
  function handleEvents(req, res, key, clientId) {
    const room = getRoom(key, true);
    for (const old of room.clients) {
      if (!old.ended) {
        log(`sse superseded room=${short(key)} client=${old.id}`);
        endClient(old, 'superseded');
      }
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    const client = { id: clientId, res, ended: false, timer: null };
    room.clients.push(client);
    while (room.clients.length > LIMITS.maxClients) room.clients.shift().res.destroy(); // cap tracked connections
    room.lastSeenAt = touch(room);
    sseWrite(res, 'hello', { room: short(key), client: clientId, serverTime: now() });
    client.timer = setInterval(() => {
      res.write(': ping\n\n');
      room.lastSeenAt = now();
    }, o.pingMs);
    log(`sse connected room=${short(key)} client=${clientId}`);
    res.on('close', () => {
      clearInterval(client.timer);
      client.ended = true;
      room.clients = room.clients.filter((c) => c !== client);
      room.lastSeenAt = touch(room);
      log(`sse closed room=${short(key)} client=${clientId}`);
    });
  }

  /** Send a command to the room's active client and wait for POST /app/result (or the timeout). */
  function dispatch(room, client, tool, args) {
    return new Promise((resolve) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        room.pending.delete(id);
        touch(room);
        log(`call timeout room=${short(room.key)} tool=${tool} id=${id.slice(0, 8)}`);
        resolve({ timeout: true });
      }, o.toolTimeoutMs);
      room.pending.set(id, { resolve, timer, tool });
      room.calls++;
      room.lastCallAt = touch(room);
      log(`call dispatched room=${short(room.key)} tool=${tool} id=${id.slice(0, 8)}`);
      sseWrite(client.res, 'command', { id, tool, args });
    });
  }

  // ------------------------------------------------------------------ mcp
  const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
  const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  const toolText = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

  /** Turn the app's answer into an MCP tool result. */
  function toToolResult(out) {
    if (out.timeout) return toolText(TEXT.timeout, true);
    if (out.shutdown) return toolText(TEXT.shutdown, true);
    if (!out.ok) return toolText('Error: ' + (typeof out.error === 'string' ? out.error : JSON.stringify(out.error ?? 'unknown error')), true);
    const r = out.result;
    if (isObj(r) && typeof r.text === 'string') return toolText(r.text);
    return toolText(typeof r === 'string' ? r : JSON.stringify(r ?? null));
  }

  function takeRateToken(room) {
    const t = now();
    room.callTimes = room.callTimes.filter((x) => t - x < LIMITS.rateWindowMs);
    if (room.callTimes.length >= LIMITS.rateMax) return false;
    room.callTimes.push(t);
    return true;
  }

  async function callTool(key, params) {
    if (!isObj(params) || typeof params.name !== 'string') throw new RpcError(-32602, 'Invalid params: "name" is required');
    if (!isKnownTool(params.name)) throw new RpcError(-32602, `Unknown tool: ${params.name}`);
    const room = getRoom(key, true);
    if (!takeRateToken(room)) return toolText(TEXT.rate, true);
    const checked = validateArgs(params.name, params.arguments);
    if (checked.error) return toolText(checked.error, true);
    const client = activeClient(room);
    if (!client) return toolText(TEXT.offline, true);
    return toToolResult(await dispatch(room, client, appToolName(params.name), checked.args));
  }

  /** Handle one JSON-RPC message. Returns a response object, or null when nothing must be sent back. */
  async function handleRpc(key, msg) {
    if (!isObj(msg) || msg.jsonrpc !== '2.0') return rpcError(null, -32600, 'Invalid Request');
    const hasId = Object.hasOwn(msg, 'id');
    if (typeof msg.method !== 'string') {
      if (hasId && ('result' in msg || 'error' in msg)) return null; // a response from the client: ignore
      return rpcError(null, -32600, 'Invalid Request: "method" must be a string');
    }
    if (!hasId) return null; // notification (initialized, cancelled, ...): accept silently
    if (typeof msg.id !== 'string' && typeof msg.id !== 'number') return rpcError(null, -32600, 'Invalid Request: bad id');
    try {
      switch (msg.method) {
        case 'initialize': {
          const asked = msg.params?.protocolVersion;
          return rpcResult(msg.id, {
            protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'sjn-word', version: VERSION },
            instructions: INSTRUCTIONS,
          });
        }
        case 'ping':
          return rpcResult(msg.id, {});
        case 'tools/list':
          return rpcResult(msg.id, { tools: TOOL_LIST });
        case 'tools/call':
          return rpcResult(msg.id, await callTool(key, msg.params));
        default:
          return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
      }
    } catch (e) {
      if (e instanceof RpcError) return rpcError(msg.id, e.code, e.message);
      log(`rpc internal error: ${e?.message}`);
      return rpcError(msg.id, -32603, 'Internal error');
    }
  }

  /** POST /mcp/KEY: one JSON-RPC message or a batch. */
  async function handleMcpPost(req, res, key) {
    let msg;
    try {
      msg = JSON.parse(await readBody(req, LIMITS.mcpBody));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return sendJson(res, 400, rpcError(null, -32700, 'Parse error'));
    }
    if (Array.isArray(msg)) {
      if (msg.length === 0) return sendJson(res, 400, rpcError(null, -32600, 'Invalid Request: empty batch'));
      const replies = (await Promise.all(msg.map((m) => handleRpc(key, m)))).filter(Boolean);
      return replies.length ? sendJson(res, 200, replies) : sendEmpty(res, 202);
    }
    const reply = await handleRpc(key, msg);
    if (!reply) return sendEmpty(res, 202);
    return sendJson(res, reply.error?.code === -32600 ? 400 : 200, reply);
  }

  // ----------------------------------------------------------- app routes
  /** POST /app/result: the app answers a command. */
  async function handleResult(req, res, key) {
    let body;
    try {
      body = JSON.parse(await readBody(req, LIMITS.resultBody));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, 'Invalid JSON');
    }
    if (!isObj(body) || typeof body.id !== 'string' || typeof body.ok !== 'boolean') {
      throw new HttpError(400, 'Body must be {"id": string, "ok": boolean, "result"|"error": ...}');
    }
    const room = getRoom(key, false);
    const call = room?.pending.get(body.id);
    if (!call) throw new HttpError(404, 'unknown id');
    clearTimeout(call.timer);
    room.pending.delete(body.id);
    room.lastSeenAt = touch(room);
    log(`call result room=${short(key)} tool=${call.tool} id=${body.id.slice(0, 8)} ok=${body.ok}`);
    call.resolve({ ok: body.ok, result: body.result, error: body.error });
    sendJson(res, 200, { ok: true });
  }

  function handleStatus(res, key) {
    const room = getRoom(key, false);
    const ago = (t) => (t == null ? null : Math.max(0, now() - t));
    sendJson(res, 200, {
      connected: !!room && !!activeClient(room),
      lastSeenMsAgo: ago(room?.lastSeenAt),
      pending: room?.pending.size ?? 0,
      calls: room?.calls ?? 0,
      lastCallMsAgo: ago(room?.lastCallAt),
    });
  }

  // --------------------------------------------------------------- router
  function sendJson(res, status, body, headers = {}) {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers });
    res.end(data);
  }
  function sendEmpty(res, status, headers = {}) {
    res.writeHead(status, headers);
    res.end();
  }

  /** Read a request body up to `limit` bytes; over the limit it rejects with 413 (and keeps draining so the client sees the reply). */
  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      let over = false;
      const tooBig = () => {
        over = true;
        chunks.length = 0;
        reject(new HttpError(413, 'Payload too large'));
      };
      if (Number(req.headers['content-length']) > limit) tooBig();
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > limit * 3) return req.destroy(); // hard stop for endless uploads
        if (over) return;
        if (size > limit) return tooBig();
        chunks.push(chunk);
      });
      req.on('end', () => !over && resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  async function route(req, res, url) {
    const { pathname, searchParams } = url;
    const method = req.method;
    const needMethod = (...allowed) => {
      if (!allowed.includes(method)) throw new HttpError(405, 'Method not allowed');
    };
    const roomKey = () => {
      const key = searchParams.get('room') ?? '';
      if (!KEY_RE.test(key)) throw new HttpError(404, 'Unknown room');
      return key;
    };

    if (pathname === '/' || pathname === '/healthz') {
      needMethod('GET', 'HEAD');
      return sendJson(res, 200, { ok: true, name: 'sjn-word-relay', version: VERSION });
    }
    if (pathname === '/app/events') {
      needMethod('GET');
      const key = roomKey();
      const clientId = searchParams.get('client') || randomUUID();
      if (!CLIENT_RE.test(clientId)) throw new HttpError(400, 'Invalid client id');
      return handleEvents(req, res, key, clientId);
    }
    if (pathname === '/app/result') {
      needMethod('POST');
      return handleResult(req, res, roomKey());
    }
    if (pathname === '/app/status') {
      needMethod('GET');
      return handleStatus(res, roomKey());
    }
    const mcp = /^\/mcp\/([^/]*)$/.exec(pathname);
    if (mcp) {
      if (!KEY_RE.test(mcp[1])) throw new HttpError(404, 'Unknown room');
      if (method === 'POST') return handleMcpPost(req, res, mcp[1]);
      if (method === 'DELETE') return sendEmpty(res, 204); // stateless: nothing to terminate
      throw new HttpError(405, 'Method not allowed');
    }
    throw new HttpError(404, 'Not found');
  }

  async function onRequest(req, res) {
    const t0 = Date.now();
    res.on('close', () => log(`${req.method} ${req.url} -> ${res.statusCode} ${Date.now() - t0}ms`));
    res.setHeader('Access-Control-Allow-Origin', o.allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    try {
      if (req.method === 'OPTIONS') return sendEmpty(res, 204);
      let url;
      try {
        url = new URL(req.url, 'http://relay.local');
      } catch {
        throw new HttpError(400, 'Bad URL');
      }
      await route(req, res, url);
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (e instanceof HttpError) {
        const headers = {};
        if (e.status === 405) headers.Allow = req.url.startsWith('/mcp/') ? 'POST' : 'GET, POST, OPTIONS';
        if (e.status === 413) headers.Connection = 'close';
        return sendJson(res, e.status, { error: e.message }, headers);
      }
      log(`internal error: ${e?.stack || e}`);
      sendJson(res, 500, { error: 'Internal error' });
    }
  }

  // ------------------------------------------------------------ lifecycle
  const server = http.createServer({ headersTimeout: 30000, requestTimeout: 60000 }, onRequest);
  server.on('clientError', (err, socket) => socket.writable && socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));

  let closing = null;
  /** Graceful shutdown: end every SSE stream, fail pending calls, stop listening. */
  function close() {
    closing ??= (async () => {
      clearInterval(sweepTimer);
      for (const room of rooms.values()) {
        room.clients.forEach((c) => endClient(c));
        for (const call of room.pending.values()) {
          clearTimeout(call.timer);
          call.resolve({ shutdown: true });
        }
        room.pending.clear();
      }
      const done = new Promise((resolve) => server.close(resolve));
      server.closeIdleConnections();
      const force = setTimeout(() => server.closeAllConnections(), o.shutdownGraceMs);
      await done;
      clearTimeout(force);
      log('server closed');
    })();
    return closing;
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, opts.host, resolve);
  });
  const actual = server.address().port;
  log(`sjn-word-relay ${VERSION} listening on port ${actual}`);
  return { server, port: actual, url: `http://127.0.0.1:${actual}`, rooms, sweep, close };
}

// Run automatically only when executed directly (node server.js), not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await start(Number(process.env.PORT) || 8787);
  const stop = (signal) => {
    console.log(`${signal} received, shutting down`);
    app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
