/* End-to-end checks of the installable app: node tests/app/app.test.js  (needs Playwright + Chromium, see tests/docx/README.md) */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), APP = path.join(ROOT, 'app'), OUT = process.argv[2] || '/tmp/sjn-app-out';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff': 'font/woff' };
let fails = 0, n = 0;
const ok = (cond, msg, extra) => { n++; if (!cond) { fails++; console.log('  FAIL:', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } else console.log('  ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function staticServer() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(APP, p);
      if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}
async function mcp(base, key, method, params, id = 1) {
  const r = await fetch(`${base}/mcp/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  return r.json();
}
const call = async (base, key, name, args) => { const j = await mcp(base, key, 'tools/call', { name, arguments: args }); return { text: j.result?.content?.[0]?.text, err: j.result?.isError, raw: j }; };

(async () => {
  const web = await staticServer(), webBase = `http://127.0.0.1:${web.address().port}`;
  const RELAY_PORT = 18000 + Math.floor(Math.random() * 1000), relayBase = `http://127.0.0.1:${RELAY_PORT}`;
  const relay = spawn('node', [path.join(ROOT, 'server/server.js')], { env: { ...process.env, PORT: String(RELAY_PORT) }, stdio: 'ignore' });
  await sleep(700);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu', '--disable-extensions'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, serviceWorkers: 'allow' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errs.push('console: ' + m.text()); });
  const text = () => page.evaluate(() => document.getElementById('doc').innerText.replace(/​/g, ''));
  const wait = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await sleep(100); } return false; };
  const saved = () => wait(() => /^Saved/.test(document.getElementById('saveState').textContent), 5000);
  const openFile = async (label) => {
    await page.click('[data-tab="file"]'); await page.waitForSelector('#bs:not([hidden])');
    await page.click(`.bsi:has-text("${label}")`);
  };

  console.log('1. first start');
  await page.goto(webBase + '/index.html');
  await page.waitForFunction(() => document.getElementById('doc').innerText.length > 20);
  ok((await text()).includes('บันทึกข้อความ'), 'sample document is shown on first start');
  ok(await saved(), 'state says Saved');
  ok(await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)), 'service worker is active');
  ok(await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()).then((m) => m.display === 'standalone' && m.icons.length >= 3)), 'manifest is valid');

  console.log('2. edit, reload (IndexedDB persistence)');
  await page.click('#doc'); await page.keyboard.press('Control+End'); await page.keyboard.type(' ทดสอบบันทึกอัตโนมัติ XYZ123');
  await sleep(900); ok(await saved(), 'autosaved after typing');
  await page.reload(); await page.waitForFunction(() => document.getElementById('doc').innerText.length > 20);
  ok((await text()).includes('XYZ123'), 'edit survived a reload');
  ok(await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('sjn-word'); q.onsuccess = () => { const t = q.result.transaction('docs').objectStore('docs').count(); t.onsuccess = () => r(t.result === 1); }; })), 'exactly one record in IndexedDB');

  console.log('3. new document, recent list, switch');
  await openFile('New');
  await page.waitForFunction(() => document.getElementById('ttlText').textContent === 'เอกสารไม่มีชื่อ');
  await page.click('#doc'); await page.keyboard.type('second doc QWE');
  await sleep(900);
  await openFile('Recent documents');
  await page.waitForSelector('.bsdoc');
  ok((await page.$$('.bsdoc')).length === 2, 'recent lists two documents');
  await page.click('.bsdoc:not(.cur) .bsmain');
  await page.waitForFunction(() => document.getElementById('doc').innerText.includes('XYZ123'));
  ok(true, 'switched back to the first document');
  ok(!(await text()).includes('QWE'), 'documents are separate');

  console.log('4. download .docx');
  await page.evaluate(() => { window.__dl = []; document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[download]'); if (a) window.__dl.push(a.download); }, true); });
  await openFile('Download');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.bsi:has-text("Word document")')]);
  const docxPath = path.join(OUT, 'downloaded.docx'); await dl.saveAs(docxPath);
  const dlNames = await page.evaluate(() => window.__dl.slice());
  ok(dlNames.length === 1 && /\.docx$/.test(dlNames[0]) && dlNames[0].includes('บันทึกข้อความ'), 'download link carries a Thai .docx name (headless Chromium itself shows "download" for non-ASCII names)', dlNames);
  try { execFileSync('unzip', ['-tq', docxPath]); ok(true, 'docx is a valid zip'); } catch (e) { ok(false, 'docx zip'); }
  const py = execFileSync('python3', ['-I', '-c', 'import sys,docx;d=docx.Document(sys.argv[1]);print("\\n".join(p.text for p in d.paragraphs))', docxPath]).toString();
  ok(py.includes('XYZ123') && py.includes('บันทึกข้อความ'), 'python-docx reads our text back');
  await sleep(300);
  await openFile('Download');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('.bsi:has-text("Web page")')]);
  ok(dl2 && (await page.evaluate(() => window.__dl.length)) === 2, 'html download');
  await openFile('Download');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('.bsi:has-text("Plain text")')]);
  const txtPath = path.join(OUT, 'd.txt'); await dl3.saveAs(txtPath);
  ok(fs.readFileSync(txtPath, 'utf8').includes('XYZ123'), 'txt download has the text');

  console.log('5. open .docx from device');
  await page.setInputFiles('#openInput', docxPath);
  await page.waitForFunction(() => document.getElementById('doc').innerText.includes('XYZ123') && document.getElementById('ttlText').textContent.includes('downloaded') === false || true);
  await sleep(800);
  ok((await text()).includes('XYZ123') && (await page.$$eval('#doc p', (e) => e.length)) > 5, 'docx opened as a new document');
  const nDocs = await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('sjn-word'); q.onsuccess = () => { const t = q.result.transaction('docs').objectStore('docs').count(); t.onsuccess = () => r(t.result); }; }));
  ok(nDocs === 3, 'opened file became a third document', nDocs);
  await page.setInputFiles('#openInput', { name: 'note.md', mimeType: 'text/markdown', buffer: Buffer.from('# Head\n\n- one\n- two\n\nplain **bold**') });
  await sleep(600);
  ok(await page.$eval('#doc h1', (e) => e.textContent) === 'Head' && (await page.$$('#doc li')).length === 2 && (await page.$$('#doc b')).length === 1, 'markdown opened with headings/list/bold');
  await page.setInputFiles('#openInput', { name: 'x.html', mimeType: 'text/html', buffer: Buffer.from('<title>Hi</title><p onclick="alert(1)">a<script>alert(2)</script></p><a href="javascript:alert(3)">l</a>') });
  await sleep(600);
  ok(!(await page.evaluate(() => document.getElementById('doc').innerHTML)).match(/onclick|<script|javascript:/i), 'html import is sanitised');

  console.log('6. print / PDF');
  await openFile('Recent documents'); await page.waitForSelector('.bsdoc');
  await page.click('.bsdoc:has-text("เอกสารตัวอย่าง"), .bsdoc:has-text("บันทึกข้อความ") .bsmain');
  await page.waitForFunction(() => document.getElementById('doc').innerText.includes('XYZ123'));
  await page.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); });
  const css = await page.$eval('#printStyle', (e) => e.textContent);
  ok(/@page\{size:210mm 297mm/.test(css) && /counter\(page\)/.test(css) && /counter\(pages\)/.test(css), 'print CSS has page size and page numbers', css.slice(0, 300));
  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(OUT, 'print.pdf'); await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const info = execFileSync('pdfinfo', [pdf]).toString();
  ok(/Pages:\s+[1-9]/.test(info) && /A4/.test(info), 'PDF is A4', info.match(/Pages:.*|Page size:.*/g));
  const ptxt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
  ok(ptxt.includes('XYZ123') && !ptxt.includes('Rename'), 'PDF holds the document and none of the app chrome');
  ok(/หน้า\s*1\s*\/\s*\d/.test(ptxt), 'PDF has "หน้า 1 / N" page number', ptxt.slice(-120));

  console.log('7. Claude connector through the relay');
  await page.click('[data-act="ai"] >> nth=0');
  await page.waitForSelector('#ai:not([hidden])');
  const key = await page.$eval('#aiKey', (e) => e.value);
  ok(/^[A-Za-z0-9_-]{32}$/.test(key), 'room key generated: ' + key.length + ' chars');
  const off = await call(relayBase, key, 'word_get_document', {});
  ok(off.err && /open|app|not connected|offline/i.test(off.text || ''), 'tool call says the app is offline when not connected', off.text);
  await page.fill('#aiRelay', relayBase); await page.click('#aiConnect');
  ok(await wait(() => document.getElementById('aiDot').classList.contains('online'), 8000), 'app shows Connected');
  const tl = await mcp(relayBase, key, 'tools/list', {});
  ok(tl.result.tools.length === 5, 'MCP lists 5 tools');
  const noctx = await call(relayBase, key, 'word_edit', { ops: [{ op: 'replace', i: 0, html: 'x' }] });
  ok(noctx.err && /word_get_document/.test(noctx.text), 'edit before get is refused with a hint', noctx.text);

  await call(relayBase, key, 'word_new_document', { title: 'Claude test' });
  ok((await page.$eval('#ttlText', (e) => e.textContent)) === 'Claude test', 'Claude created and opened a document');
  let g = await call(relayBase, key, 'word_get_document', {});
  ok(g.text && /Title: Claude test/.test(g.text) && /Blocks: 1/.test(g.text), 'get_document lists the new document', g.text);
  const e1 = await call(relayBase, key, 'word_edit', { say: 'write', ops: [
    { op: 'replace', i: 0, html: 'หัวเรื่อง <b>ทดสอบ</b>' },
    { op: 'format', i: 0, align: 'center', size: 24, bold: true },
    { op: 'insert', after: 0, blocks: [{ tag: 'p', html: 'ย่อหน้าแรก' }, { tag: 'li', html: 'ข้อ A', list: 'number' }, { tag: 'li', html: 'ข้อ B' }, { tag: 'p', html: 'จบ' }] },
    { op: 'table', after: 0, rows: [['ชื่อ', 'จำนวน'], ['ปากกา', '2']] },
    { op: 'page', size: 'A5', orientation: 'landscape', margins: { top: 2, left: 3 } },
    { op: 'header_footer', header: 'หัวกระดาษ', footer: 'ท้าย', page_number: 'br', format: 'Page {n} of {N}' },
    { op: 'title', text: 'ชื่อใหม่ จาก Claude' },
  ] });
  ok(!e1.err && /Applied/.test(e1.text || ''), 'edit applied', e1.text);
  const dom = await page.evaluate(() => ({ html: document.getElementById('doc').innerHTML, title: document.getElementById('ttlText').textContent }));
  ok(/<ol[^>]*><li[^>]*>ข้อ A<\/li><li[^>]*>ข้อ B<\/li><\/ol>/.test(dom.html), 'numbered list built from insert blocks', dom.html.slice(0, 600));
  ok(/<table/.test(dom.html) && dom.html.indexOf('หัวเรื่อง') < dom.html.indexOf('<table') && dom.html.indexOf('ย่อหน้าแรก') < dom.html.indexOf('<table'), 'blocks and table inserted after block 0 in op order');
  ok(/text-align: ?center/.test(dom.html) && dom.title === 'ชื่อใหม่ จาก Claude', 'format + title ops');
  const st = await page.evaluate(() => ({ w: document.getElementById('sheet').style.width, ft: document.querySelector('.dp .ft')?.textContent, pn: document.querySelector('.dp .pn')?.textContent, pc: document.querySelector('.dp .pn')?.className }));
  ok(st.w === '794px' || st.w === '559px' || /^\d+px$/.test(st.w), 'sheet width set', st);
  ok(st.ft === 'ท้าย' && /Page 1 of/.test(st.pn || '') && /br/.test(st.pc || ''), 'header/footer/page-number op applied', st);
  g = await call(relayBase, key, 'word_get_document', {});
  ok(/Page: A5 landscape, margins cm top 2.01 right 2.54 bottom 2.54 left 2.99/.test(g.text), 'page op reflected in listing', g.text.split('\n').slice(0, 6));
  ok(/\[\d+\] li-numbered/.test(g.text), 'listing shows list type');
  // stale protection: user edits block, then Claude edits from the old listing
  const idx = Number((/\[(\d+)\] p: ย่อหน้าแรก/.exec(g.text) || [])[1]);
  await page.evaluate(() => { const p = [...document.querySelectorAll('#doc p')].find((x) => x.textContent === 'ย่อหน้าแรก'); p.textContent = 'ผู้ใช้แก้เอง'; document.getElementById('doc').dispatchEvent(new Event('input', { bubbles: true })); });
  const e2 = await call(relayBase, key, 'word_edit', { ops: [{ op: 'replace', i: idx, html: 'Claude เขียนทับ' }] });
  ok(/Skipped 1/.test(e2.text) && (await text()).includes('ผู้ใช้แก้เอง') && !(await text()).includes('Claude เขียนทับ'), 'stale block is protected', e2.text.split('\n')[0]);
  // undo = one step
  const before = await text();
  g = await call(relayBase, key, 'word_get_document', {});
  await call(relayBase, key, 'word_edit', { ops: [{ op: 'find_replace', find: 'จบ', with: 'END' }, { op: 'delete', i: 1 }] });
  ok((await text()).includes('END'), 'find_replace applied');
  await page.click('#btnUndo');
  ok((await text()) === before, 'one Undo reverts the whole Claude edit');
  const ld = await call(relayBase, key, 'word_list_documents', {});
  const lines = (ld.text || '').split('\n');
  ok(lines.length === 6 && /OPEN NOW/.test(ld.text), 'list_documents shows library (6 docs)', ld.text);
  const firstId = lines.find((l) => !/OPEN NOW/.test(l)).split(' | ')[0];
  const od = await call(relayBase, key, 'word_open_document', { id: firstId });
  ok(!od.err && /Opened/.test(od.text), 'open_document works', od.text);
  const bad = await call(relayBase, key, 'word_open_document', { id: 'nope' });
  ok(bad.err, 'open_document with unknown id is an error', bad.text);
  // reload: bridge reconnects by itself
  await page.reload(); await page.waitForFunction(() => document.getElementById('doc').innerText.length >= 0);
  ok(await wait(() => document.getElementById('aiDot') && document.getElementById('aiDot').classList.contains('online'), 10000), 'after reload the app reconnects on its own');
  await page.click('[data-act="ai"] >> nth=0'); await page.waitForSelector('#ai:not([hidden])');
  await page.click('#aiDisconnect');
  await sleep(300);
  const off2 = await call(relayBase, key, 'word_get_document', {});
  ok(off2.err, 'after Disconnect the relay reports the app offline', off2.text);

  console.log('8. offline start (service worker cache)');
  await ctx.setOffline(true);
  const p2 = await ctx.newPage();
  await p2.goto(webBase + '/index.html?source=pwa');
  await p2.waitForFunction(() => document.getElementById('doc') && document.getElementById('doc').innerText.length > 5, null, { timeout: 8000 }).catch(() => {});
  ok(await p2.evaluate(() => document.getElementById('doc').innerText.length > 5), 'app opens with no network');
  await ctx.setOffline(false);

  console.log('9. screenshots');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT, 'app.png') });
  ok(errs.length === 0, 'no page errors', errs);

  await browser.close(); relay.kill(); web.close();
  console.log(`\n${n - fails}/${n} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
