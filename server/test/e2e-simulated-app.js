// Simulated SJN Word app, for trying the MCP endpoint by hand (see README "Try it with curl").
//   node server.js                                   # terminal 1
//   node test/e2e-simulated-app.js                   # terminal 2: prints the connector URL
// Options: --server http://localhost:8787  --room <24-64 char key>  (or env SERVER / ROOM_KEY)
// It connects to /app/events like the real app and answers every command with canned data.
import { randomBytes } from 'node:crypto';

// `node --test` would otherwise start this long-running script as a test file.
if (process.env.NODE_TEST_CONTEXT) process.exit(0);

const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const server = (arg('server') || process.env.SERVER || 'http://localhost:8787').replace(/\/$/, '');
const room = arg('room') || process.env.ROOM_KEY || randomBytes(24).toString('base64url');
const client = 'simulated-app';

const LISTING = [
  'Title: Meeting notes',
  'Page: A4 portrait, margins 2.54 cm',
  'Selection: none',
  '[1] h1 center: Meeting notes',
  '[2] p: Agenda for <b>Monday</b>',
  '[3] li bullet: Budget',
  '[4] li bullet: Hiring',
].join('\n');
const DOCS = [{ id: 'doc-1', title: 'Meeting notes', edited: '2026-10-07T09:00:00Z' }, { id: 'doc-2', title: 'Letter', edited: '2026-10-06T18:30:00Z' }];

function answer({ tool, args }) {
  switch (tool) {
    case 'get_document': return { text: LISTING };
    case 'edit': return { text: `Applied ${args.ops.length} operation(s).\n\n${LISTING}` };
    case 'list_documents': return DOCS;
    case 'open_document': return DOCS.some((d) => d.id === args.id) ? { text: `Opened ${args.id}.` } : undefined;
    case 'new_document': return { text: `Created "${args.title || 'Untitled'}".` };
  }
}

async function postResult(body) {
  await fetch(`${server}/app/result?room=${room}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function handle(event, data) {
  if (event === 'hello') return console.log(`connected (${data})`);
  if (event === 'superseded') { console.log('superseded by a newer client, exiting'); process.exit(0); }
  if (event !== 'command') return;
  const cmd = JSON.parse(data);
  console.log(`command ${cmd.tool} ${JSON.stringify(cmd.args)}`);
  const result = answer(cmd);
  return postResult(result === undefined ? { id: cmd.id, ok: false, error: `No such document: ${cmd.args.id}` } : { id: cmd.id, ok: true, result });
}

console.log(`Server:        ${server}`);
console.log(`Room key:      ${room}`);
console.log(`Connector URL: ${server}/mcp/${room}`);
const res = await fetch(`${server}/app/events?room=${room}&client=${client}`, { headers: { Accept: 'text/event-stream' } });
if (!res.ok) { console.error(`cannot connect: HTTP ${res.status}`); process.exit(1); }
const decoder = new TextDecoder();
let buf = '';
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const block = buf.slice(0, i);
    buf = buf.slice(i + 2);
    let event = 'message', data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7);
      else if (line.startsWith('data: ')) data += line.slice(6);
    }
    if (data) await handle(event, data);
  }
}
console.log('stream closed');
