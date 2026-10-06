# SJN Word relay

A tiny, zero-dependency Node.js server (Node 20+, built-ins only) that lets Claude read and edit the
document open in the **SJN Word** web app.

```
Claude (claude.ai / mobile)  --MCP over HTTPS-->  relay  --Server-Sent Events-->  SJN Word web app
        POST /mcp/<KEY>                      holds no documents                GET /app/events
                                                                               POST /app/result
```

The relay only forwards tool calls from Claude to the app that is currently connected and returns the
app's answer. Documents never touch the server.

## Configuration

| Env var           | Default | Meaning                                                       |
|-------------------|---------|---------------------------------------------------------------|
| `PORT`            | `8787`  | HTTP port                                                     |
| `ALLOW_ORIGIN`    | `*`     | Value of `Access-Control-Allow-Origin` (set it to your app's origin in production) |
| `TOOL_TIMEOUT_MS` | `30000` | How long a tool call waits for the app before giving up       |

## Run locally

```sh
npm start            # or: node server.js
npm test             # node:test suite, no dependencies
```

## Deploy

Any host that runs a container or Node works (Railway, Render, Fly.io, ...).

* **Dockerfile**: point the platform at this folder; it builds `node:22-alpine`, runs as the unprivileged
  `node` user and exposes `8787`. Platforms that inject `PORT` are supported.
* **Without Docker**: set the start command to `npm start` (Node >= 20).
* Always serve it over **HTTPS** (all three platforms do this for you).
* Run **one instance only**: rooms and pending calls live in memory, so a second instance would not see
  the app's connection.

## URLs you need

Replace `HOST` with your deployment's host name.

* **SJN Word app** (AI icon, or File > Connect Claude): server `https://HOST`; the app chooses a long random room
  key and connects to `https://HOST/app/events?room=<KEY>&client=<ID>`.
* **Claude connector** (claude.ai > Settings > Connectors > Add custom connector, "No sign in"):
  `https://HOST/mcp/<KEY>` using the same key.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /`, `GET /healthz` | `{"ok":true,"name":"sjn-word-relay","version":"1.0.0"}` |
| `GET /app/events?room=KEY&client=ID` | SSE stream for the app: `hello`, `command`, `superseded`, `: ping` every 15 s. Only the newest client of a room is active. |
| `POST /app/result?room=KEY` | The app answers a command: `{"id","ok":true,"result":...}` or `{"id","ok":false,"error":"..."}` (max 4 MB) |
| `GET /app/status?room=KEY` | `{connected, lastSeenMsAgo, pending, calls, lastCallMsAgo}` |
| `POST /mcp/KEY` | MCP Streamable HTTP, stateless (initialize, ping, tools/list, tools/call; JSON-RPC batches ok; max 2 MB). `GET` is 405, `DELETE` is 204. |

Room keys match `[A-Za-z0-9_-]{24,64}`; anything else gets `404`. Tools: `word_get_document`,
`word_edit`, `word_list_documents`, `word_open_document`, `word_new_document`. The app receives them as
`command` events whose `tool` is the name without the `word_` prefix.

Limits: 60 tool calls per minute per room; rooms with no client and no pending call are removed after
10 minutes.

## Try it with curl

Terminal 1: `node server.js`. Terminal 2 starts a simulated app that answers with canned data and prints
the connector URL:

```sh
node test/e2e-simulated-app.js            # prints "Connector URL: http://localhost:8787/mcp/<KEY>"
```

Terminal 3 (use the printed URL):

```sh
URL=http://localhost:8787/mcp/<KEY>
H='Content-Type: application/json'

curl -s $URL -H "$H" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'
curl -s $URL -H "$H" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s $URL -H "$H" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"word_get_document","arguments":{}}}'
curl -s $URL -H "$H" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"word_edit","arguments":{"say":"demo","ops":[{"op":"replace","i":2,"html":"New text"}]}}}'
curl -s "http://localhost:8787/app/status?room=<KEY>"
```

Without the simulated app running, tool calls return the "app is not connected" message.

## Security notes

* The **room key is the only secret**: anyone who has it can read and edit the open document. Keys must be
  long and random (the app generates one); treat the connector URL like a password and rotate the key in
  the app if it leaks.
* Use HTTPS only; the key travels in the URL.
* Logs never contain a full key (first 6 characters followed by `…`).
* Nothing is persisted. Restarting the server drops connections (the app reconnects) and pending calls.
* Set `ALLOW_ORIGIN` to the web app's origin so other sites cannot call the app endpoints from a browser.
