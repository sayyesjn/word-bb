/* Playwright driver: exports docs, imports docs, fuzzes. Usage: node run.js <outdir> [export|import <file>...|fuzz]  */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || '/tmp/sjn-docx-out', mode = process.argv[3] || 'export';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu', '--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !(mode === 'weird' && /Failed to load resource/.test(m.text()))) errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'harness.html'));
  const doExport = async (name, land, hf) => {
    const b64 = await page.evaluate(async ({ land, hf }) => {
      const blob = await SJNDocx.exportDocx({ html: sampleHtml(), title: 'ทดสอบ SJN', page: samplePage(land), hf: hf || sampleHF });
      if (blob.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') throw new Error('bad mime ' + blob.type);
      return toB64(await bytesOf(blob));
    }, { land, hf });
    fs.writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));
    console.log('wrote', name);
  };
  if (mode === 'export') {
    await doExport('sample.docx', false);
    await doExport('sample-land.docx', true, { header: '', footer: '', pos: 'tr', fmt: '{n}' });
    await doExport('sample-nohf.docx', false, { header: '', footer: '', pos: 'none', fmt: '{n}' });
    await doExport('sample-hdr.docx', false, { header: 'Header only', footer: 'Footer only', pos: 'tl', fmt: 'Page {n} of {N}' });
  } else if (mode === 'roundtrip') {
    const res = await page.evaluate(async () => {
      const mount = html => { const d = document.createElement('div'); d.className = 'doc'; d.style.cssText = 'position:fixed;left:-99999px;width:602px;padding:0'; d.innerHTML = html; document.body.appendChild(d); return d; };
      const norm = t => t.replace(/[​]/g, '').replace(/[\s ]+/g, ' ').trim();
      const out = [], ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
      const blob = await SJNDocx.exportDocx({ html: sampleHtml(), title: 'T', page: samplePage(false), hf: sampleHF });
      const imp = await SJNDocx.importDocx(await blob.arrayBuffer());
      const A = mount(sampleHtml()), B = mount(imp.html);
      // text compared block by block (trailing/leading spaces of a block are not significant in HTML or Word)
      const blocksText = r => { const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT), g = []; let n, last = null;
        while ((n = w.nextNode())) { const k = n.parentElement.closest('p,h1,h2,h3,li,td,th') || r, t = n.nodeValue.replace(/\u200B/g, ''); if (k === last) g[g.length - 1] += t; else { g.push(t); last = k; } }
        return g.map(norm).filter(Boolean).join('|'); };
      const ta = blocksText(A), tb = blocksText(B);
      ok(ta === tb, 'text equal block by block (' + ta.length + ' chars)');
      if (ta !== tb) { let k = 0; while (k < ta.length && ta[k] === tb[k]) k++; out.push('  first diff at ' + k + ': A=' + JSON.stringify(ta.slice(Math.max(0, k - 20), k + 30)) + ' B=' + JSON.stringify(tb.slice(Math.max(0, k - 20), k + 30))); }
      const find = (root, txt) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.indexOf(txt) >= 0) return n; return null; };
      const inl = (root, txt) => { let n = find(root, txt); if (!n) return null; const f = { b: 0, i: 0, u: 0, s: 0, v: '', fam: '', sz: '', col: '', bg: '' };
        let e = n.parentElement; const cs0 = getComputedStyle(e);
        f.b = parseInt(cs0.fontWeight) >= 600 ? 1 : 0; f.i = /italic/.test(cs0.fontStyle) ? 1 : 0; f.fam = cs0.fontFamily.split(',')[0].replace(/"/g, ''); f.sz = cs0.fontSize; f.col = cs0.color;
        for (; e && e !== root; e = e.parentElement) { const c = getComputedStyle(e); if (/underline/.test(c.textDecorationLine)) f.u = 1; if (/line-through/.test(c.textDecorationLine)) f.s = 1; if (/^(sub|super)$/.test(c.verticalAlign)) f.v = c.verticalAlign; if (c.backgroundColor !== 'rgba(0, 0, 0, 0)') f.bg = c.backgroundColor; }
        return JSON.stringify(f); };
      ['ตัวหนา', 'ตัวเอียง', 'ขีดเส้นใต้', 'ขีดฆ่า', 'Kanit หนาเอียง', 'เซลล์ B', 'หัวตาราง', 'ฟอนต์ Prompt', 'Times New Roman', 'ไฮไลต์', 'ลิงก์ตัวอย่าง', 'บันทึกข้อความ', 'หัวข้อรอง', 'หัวข้อย่อย'].forEach(t => {
        const a = inl(A, t), b = inl(B, t); ok(a === b && a, 'inline fmt "' + t + '"' + (a === b ? '' : '\n   A=' + a + '\n   B=' + b)); });
      ['ซ้อน 2.1', 'ซ้อน 3', 'ลำดับสอง', 'ย่อย b', 'เริ่มใหม่ 2', 'ลูกโดยตรง', 'รายการสาม'].forEach(t => {
        const info = r => { const n = find(r, t); let e = n.parentElement, depth = 0, kinds = []; for (; e && e !== r; e = e.parentElement) if (/^(UL|OL)$/.test(e.tagName)) { depth++; kinds.push(e.tagName); } return depth + kinds.join(''); };
        ok(info(A) === info(B), 'list structure "' + t + '" ' + info(A) + ' vs ' + info(B)); });
      ['จัดกึ่งกลาง', 'จัดชิดสองข้าง', 'ชิดขวา', 'แขวน', 'مرحبا', 'ขึ้นบรรทัดใหม่', 'ก่อนตัดหน้า', 'หัวข้อย่อย', 'หัวข้อรอง', 'บันทึกข้อความ', 'หน้าที่สอง'].forEach(t => {
        const info = r => { const n = find(r, t); const e = n.parentElement.closest('p,h1,h2,h3,td,th,li'); const c = getComputedStyle(e);
          return [e.tagName.replace('TH', 'TD'), c.textAlign.replace('start', 'left'), Math.round(parseFloat(c.marginLeft)), Math.round(parseFloat(c.marginRight)), Math.round(parseFloat(c.textIndent)), Math.round(parseFloat(c.marginTop)), Math.round(parseFloat(c.marginBottom)), (parseFloat(c.lineHeight) / parseFloat(c.fontSize)).toFixed(2), c.direction].join('|'); };
        const a = info(A), b = info(B); ok(a === b, 'block props "' + t + '" ' + a + (a === b ? '' : ' vs ' + b)); });
      const cnt = (r, s) => r.querySelectorAll(s).length;
      ok(cnt(A, 'img') === cnt(B, 'img') && cnt(B, 'img') === 2, 'images 2');
      ok(cnt(B, 'img[src^="data:image/png;base64,"]') === 2, 'images are data:image/png');
      ok(B.querySelector('img').getAttribute('width') === '160' && B.querySelector('img').getAttribute('height') === '100', 'image size attrs 160x100');
      ok(cnt(A, '.pbreak') === cnt(B, '.pbreak') && cnt(B, '.pbreak') === 2, 'page breaks 2');
      ok(cnt(B, 'hr') === 1, 'hr 1');
      ok(cnt(B, 'table') === 1 && cnt(B, 'td[colspan="2"]') === 2 && cnt(B, 'tr') === 3, 'table with 2 colspans, 3 rows');
      ok(cnt(B, 'a[href="https://example.com/a?b=1&c=2"]') === 1, 'hyperlink kept');
      ok(cnt(A, 'ul,ol') === cnt(B, 'ul,ol') && cnt(A, 'li') === cnt(B, 'li'), 'list containers/items equal: ' + cnt(B, 'ul,ol') + '/' + cnt(B, 'li'));
      ok(cnt(B, 'script,iframe,object') === 0 && !/ on\w+=/i.test(imp.html), 'no script / handlers');
      ok(imp.page.size === 'A4' && imp.page.mt === 96 && imp.page.w === 794 && imp.hf.header === 'หัวกระดาษ SJN' && imp.hf.pos === 'bc' && imp.hf.fmt === 'หน้า {n} / {N}', 'page + hf: ' + JSON.stringify(imp.page) + JSON.stringify(imp.hf));
      ok(imp.title === 'T', 'title from core.xml');
      // landscape + hf variants
      for (const [land, hf, expPos] of [[true, { header: '', footer: 'F', pos: 'tr', fmt: 'Page {n}' }, 'tr'], [false, { header: 'H', footer: '', pos: 'bl', fmt: '{n}/{N}' }, 'bl'], [false, { header: '', footer: '', pos: 'none', fmt: '{n}' }, 'none']]) {
        const r = await SJNDocx.importDocx(await (await SJNDocx.exportDocx({ html: '<p>x</p>', title: '', page: samplePage(land), hf })).arrayBuffer());
        ok(r.page.land === land && r.page.w === (land ? 1123 : 794) && r.page.h === (land ? 794 : 1123) && r.page.size === 'A4' && r.hf.pos === expPos && r.hf.header === hf.header && r.hf.footer === hf.footer && (expPos === 'none' || r.hf.fmt === hf.fmt), 'variant land=' + land + ' ' + JSON.stringify(r.hf) + JSON.stringify(r.page));
      }
      // other page sizes
      for (const sz of ['A5', 'Letter', 'Legal', 'B5', 'A3']) {
        const d = { A5: [559, 794], Letter: [816, 1056], Legal: [816, 1344], B5: [665, 945], A3: [1123, 1587] }[sz];
        const r = await SJNDocx.importDocx(await (await SJNDocx.exportDocx({ html: '<p>x</p>', page: { size: sz, land: false, mt: 50, mb: 60, ml: 70, mr: 80, w: d[0], h: d[1] } })).arrayBuffer());
        ok(r.page.size === sz && r.page.mt === 50 && r.page.mb === 60 && r.page.ml === 70 && r.page.mr === 80, 'page size ' + sz + ' round trip');
      }
      A.remove(); B.remove();
      return out;
    });
    console.log(res.join('\n'));
    if (res.some(l => l.startsWith('FAIL'))) process.exitCode = 1;
  } else if (mode === 'weird') {
    // export: hostile / odd HTML must never throw and must give XML-valid parts; import: mutated XML must never throw non-Error
    const htmls = {
      empty: '', undef: null, textOnly: 'just text no tags', script: '<p onclick="alert(1)">a<script>alert(1)</script><img src="x" onerror="alert(1)">b</p>',
      ctrl: '<p>ctl\u0001\u0002\u0008\u000b\u000c\u001f￾￿ ok \ud800 lone &amp; &lt;tag&gt; "q" \'s\'</p>',
      badImg: '<p><img><img src="data:image/png;base64,@@@@"><img src="http://example.com/x.png"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></p>',
      nestedTbl: '<table><tr><td><table><tr><td>inner</td></tr></table></td><td rowspan="2">rs</td></tr><tr><td>x</td></tr></table><table><tr><td>second adjacent</td></tr></table>',
      emptyTbl: '<table></table><table><tbody><tr></tr></tbody></table><p>after</p>',
      strayTd: '<td>stray</td><li>stray li</li><tr><td>x</td></tr>',
      deepDivs: '<div><div><div><p>deep</p><div>deeper text<br>and br</div></div></div></div>',
      listOdd: '<ul><li></li><li><p>para in li</p><p>second</p></li><ol><li>ol in ul</li></ol>text in ul</ul><ol start="7"><li>seven</li></ol>',
      blockInInline: '<p>a<div>div in p</div>b<h2>h in p</h2></p>',
      pb: '<div class="pbreak"></div><div class="pbreak"></div><table><tr><td>t</td></tr></table><div class="pbreak"></div>',
      cellFmt: '<table><tr><td style="text-align:right;padding-left:2cm;text-indent:1cm" dir="rtl">cell text<br>line2</td><td><p>p1</p><p>p2</p><ul><li>li in cell</li></ul></td></tr></table>',
      big: '<p>' + 'ภาษาไทย '.repeat(20000) + '</p>'
    };
    const res = await page.evaluate(async (htmls) => {
      const r = {};
      for (const [k, h] of Object.entries(htmls)) {
        try { const blob = await SJNDocx.exportDocx({ html: h, title: 'w<>&"', page: samplePage(false), hf: { header: 'h<&>', footer: '', pos: 'br', fmt: '{n}{N}{n}' } });
          const imp = await SJNDocx.importDocx(await blob.arrayBuffer()); r[k] = { size: blob.size, b64: toB64(await bytesOf(blob)), imp: imp.html.slice(0, 200).replace(/base64,[^"]+/g, 'base64,...') };
        } catch (e) { r[k] = { err: String(e && e.stack || e) }; }
      }
      try { const b = await SJNDocx.exportDocx(); r.noOpts = { size: b.size }; } catch (e) { r.noOpts = { err: String(e) }; }
      return r;
    }, htmls);
    for (const [k, v] of Object.entries(res)) {
      if (v.err) { console.log('FAIL', k, v.err); process.exitCode = 1; continue; }
      if (v.b64) fs.writeFileSync(path.join(out, 'weird-' + k + '.docx'), Buffer.from(v.b64, 'base64'));
      console.log('ok  ', k.padEnd(12), v.size, (v.imp || '').slice(0, 110));
    }
    // XML-level mutation fuzz on the import side
    const good = fs.readFileSync(path.join(out, 'sample.docx')).toString('base64');
    const bad = await page.evaluate(async (good) => {
      const files = await SJNZip.read(fromB64(good)); const doc = new TextDecoder().decode(files.get('word/document.xml'));
      let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      let nonError = 0, resolved = 0, rejected = 0;
      for (let k = 0; k < 120; k++) {
        let x = doc;
        for (let j = 0; j < 1 + k % 6; j++) {
          const i = Math.floor(rnd() * x.length), m = k % 4;
          if (m === 0) x = x.slice(0, i) + x.slice(i + 1 + Math.floor(rnd() * 200));          // delete a chunk
          else if (m === 1) x = x.slice(0, i) + '<w:p><w:r><w:t>' + x.slice(i);                // unbalanced insert
          else if (m === 2) x = x.replace(/w:val="[^"]*"/, 'w:val="999999999"');               // silly values
          else x = x.replace(/<w:tc>/g, '<w:tc><w:tbl><w:tr><w:tc>').replace(/w:numId w:val="\d+"/g, 'w:numId w:val="77"'); // odd nesting
        }
        const f = [{ name: '[Content_Types].xml', data: '<Types/>' }, { name: 'word/document.xml', data: x }];
        for (const [n, d] of files) if (n !== 'word/document.xml' && n !== '[Content_Types].xml') f.push({ name: n, data: d });
        try { await SJNDocx.importDocx((await SJNZip.create(f)).buffer); resolved++; } catch (e) { if (e instanceof Error) rejected++; else nonError++; }
      }
      // well-formed structural mutations (drop / rename / re-parent elements, silly attribute values)
      for (let k = 0; k < 80; k++) {
        const dom = new DOMParser().parseFromString(doc, 'application/xml'), els = Array.from(dom.getElementsByTagName('*'));
        for (let j = 0; j < 3 + k % 8; j++) {
          const e = els[Math.floor(rnd() * els.length)]; if (!e || !e.parentNode || e === dom.documentElement) continue;
          const m = Math.floor(rnd() * 4);
          if (m === 0) e.remove(); else if (m === 1) { const t = els[Math.floor(rnd() * els.length)]; if (t !== e && !e.contains(t)) t.appendChild(e); }
          else if (m === 2) for (const a of Array.from(e.attributes)) e.setAttribute(a.name, ['-5', '', 'NaN', '1e99', 'x'][Math.floor(rnd() * 5)]);
          else e.textContent = '';
        }
        const f = [{ name: 'word/document.xml', data: new XMLSerializer().serializeToString(dom) }];
        for (const [n, d] of files) if (n !== 'word/document.xml') f.push({ name: n, data: d });
        try { await SJNDocx.importDocx((await SJNZip.create(f)).buffer); resolved++; } catch (e) { if (e instanceof Error) rejected++; else nonError++; }
      }
      return { nonError, resolved, rejected };
    }, good);
    console.log('xml mutation fuzz:', JSON.stringify(bad)); if (bad.nonError) process.exitCode = 1;
  } else if (mode === 'zip') {
    const exp = JSON.parse(fs.readFileSync(path.join(out, 'expected.json'), 'utf8'));
    const got = await page.evaluate(async (b64) => { const m = await SJNZip.read(fromB64(b64)); const o = {}; for (const [k, v] of m) o[k] = v.length; return o; }, fs.readFileSync(path.join(out, 'dd.zip')).toString('base64'));
    const same = JSON.stringify(got) === JSON.stringify(exp); console.log(same ? 'PASS' : 'FAIL', 'SJNZip.read of data-descriptor zip with Thai names', JSON.stringify(got)); if (!same) process.exitCode = 1;
    const b64 = await page.evaluate(async () => { const rnd = Uint8Array.from({ length: 256 }, (_, i) => i);
      return toB64(Array.from(await SJNZip.create([{ name: '[Content_Types].xml', data: '<x/>' }, { name: 'ไทย/ชื่อ.txt', data: 'สวัสดี' }, { name: 'big.txt', data: 'abc'.repeat(5000) }, { name: 'raw.bin', data: rnd }]))); });
    fs.writeFileSync(path.join(out, 'zip-written.zip'), Buffer.from(b64, 'base64'));
  } else if (mode === 'import') {
    for (const f of process.argv.slice(4)) {
      const r = await page.evaluate(async (b64) => {
        try { return { ok: await SJNDocx.importDocx(fromB64(b64)) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, fs.readFileSync(f).toString('base64'));
      const name = path.basename(f).replace(/\.docx$/, '') + '.import.json';
      fs.writeFileSync(path.join(out, name), JSON.stringify(r, null, 1));
      console.log('import', f, r.err ? 'ERR ' + r.err : 'ok html=' + r.ok.html.length);
    }
  } else if (mode === 'fuzz') {
    const good = fs.readFileSync(path.join(out, 'sample.docx'));
    const cases = { empty: Buffer.alloc(0), tiny: Buffer.from('PK'), text: Buffer.from('hello world, not a zip file at all, just text'),
      truncHalf: good.subarray(0, good.length >> 1), truncTail: good.subarray(0, good.length - 30), headerOnly: good.subarray(0, 100) };
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    cases.random = Buffer.from(Array.from({ length: 5000 }, () => Math.floor(rnd() * 256)));
    for (let k = 0; k < 8; k++) { const b = Buffer.from(good); for (let j = 0; j < 40; j++) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256); cases['corrupt' + k] = b; }
    const flip = Buffer.from(good); for (let j = 0; j < flip.length; j += 97) flip[j] ^= 0xff; cases.flipAll = flip;
    // valid zip but not a docx / garbage xml
    cases.zipNoDoc = await page.evaluate(async () => toB64(Array.from(await SJNZip.create([{ name: 'a.txt', data: 'hi' }]))));
    cases.zipBadXml = await page.evaluate(async () => toB64(Array.from(await SJNZip.create([{ name: 'word/document.xml', data: '<w:document><w:body><w:p>' }]))));
    cases.zipEmptyDoc = await page.evaluate(async () => toB64(Array.from(await SJNZip.create([{ name: 'word/document.xml', data: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>' }]))));
    const res = {};
    for (const [k, v] of Object.entries(cases)) {
      const b64 = typeof v === 'string' ? v : v.toString('base64');
      res[k] = await page.evaluate(async (b64) => {
        try { const r = await SJNDocx.importDocx(fromB64(b64)); return 'resolved html=' + r.html.slice(0, 40) + ' ...'; }
        catch (e) { return (e instanceof Error ? 'rejected Error: ' : 'rejected NON-ERROR: ') + (e && e.message); }
      }, b64);
      console.log(k.padEnd(12), res[k]);
    }
    if (Object.values(res).some(v => /NON-ERROR/.test(v))) { console.log('FUZZ FAIL'); process.exitCode = 1; }
  }
  if (errs.length) { console.log('PAGE ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
