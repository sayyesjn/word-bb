/* SJNDocx.importDocx(arrayBuffer) -> Promise<{html, title, page, hf}>   (needs zip.js)
   Reads a .docx (OOXML) and produces HTML in the editor subset: p h1-h3 ul ol li table(td/th colspan/rowspan) hr img
   div.pbreak and inline span[style] b i u s sub sup a[href] br. Output is built from escaped strings and whitelisted
   values only, so it contains no scripts, no on* handlers, only http/https/mailto/tel links and data:image srcs. */
(function(){
'use strict';
var SJN = window.SJNDocx = window.SJNDocx || {};
var NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
var PAGE_SIZES = { A4:[794,1123], A5:[559,794], A3:[1123,1587], B5:[665,945], Letter:[816,1056], Legal:[816,1344] };
var THAI = /(^TH Sarabun|^Sarabun$|^Prompt$|^Kanit$|^Mitr$|^Niramit$|^K2D$|^Krub$|^KoHo$|^Kodchasan$|^Bai Jamjuree$|^Chakra Petch$|^Athiti$|^Mali$|^Pridi$|^Taviraj$|^Trirong$|^Maitree$|^Noto (Sans|Serif) Thai$|^Anuphan$|^IBM Plex Sans Thai$)/;
var SERIF = /^(Pridi|Taviraj|Trirong|Maitree|Noto Serif Thai|Merriweather|Playfair Display|Lora|Source Serif 4|Georgia|Times New Roman|Cambria|Garamond|Angsana New|AngsanaUPC)$/;
var MONO = /^(Inconsolata|Courier New|Consolas|Lucida Console)$/;
var HL = { yellow:'ffff00', green:'00ff00', cyan:'00ffff', magenta:'ff00ff', blue:'0000ff', red:'ff0000', darkBlue:'000080', darkCyan:'008080',
  darkGreen:'008000', darkMagenta:'800080', darkRed:'800000', darkYellow:'808000', darkGray:'808080', lightGray:'c0c0c0', black:'000000', white:'ffffff' };
var DEF_SIZE = { p: 16, h1: 24, h2: 20, h3: 18 }, DEF_BM = { p: [0, 6], h1: [12, 6], h2: [10, 6], h3: [8, 4] }, DEF_LH = { p: 1.25, h1: 1.2, h2: 1.2, h3: 1.2 };

/* ---------- small helpers ---------- */
function esc(s){ return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function kids(el, ln){ var r = []; if(el) for(var c = el.firstChild; c; c = c.nextSibling) if(c.nodeType === 1 && (!ln || c.localName === ln)) r.push(c); return r; }
function kid(el, ln){ if(el) for(var c = el.firstChild; c; c = c.nextSibling) if(c.nodeType === 1 && c.localName === ln) return c; return null; }
function wa(el, n){ if(!el) return null; var v = el.getAttributeNS(NS_W, n); if(v == null || v === '') v = el.getAttribute('w:' + n); return v === '' ? null : v; }
function ra(el, n){ if(!el) return null; return el.getAttributeNS(NS_R, n) || el.getAttribute('r:' + n) || null; }
function nv(el, n){ var v = parseFloat(wa(el, n)); return isFinite(v) ? v : undefined; }
function on(el){ if(!el) return undefined; var v = wa(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); }
function all(el, ln){ return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', ln)) : []; }
function parseXml(u8){
  if(!u8) return null;
  try{
    var d = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(u8), 'application/xml');
    return d.getElementsByTagName('parsererror').length ? null : d.documentElement;
  }catch(e){ return null; }
}
function safeHref(h){ h = String(h || '').trim(); return /^(https?:|mailto:|tel:)/i.test(h) ? h : ''; }
function cleanFont(f){ return String(f || '').replace(/["'\;<>{}()\u0000-\u001F]/g, '').trim().slice(0, 60); }
function stackFor(n){
  var q = '"' + n + '"';
  if(/^TH Sarabun/.test(n)) return q + ',"Sarabun",sans-serif';
  var g = SERIF.test(n) ? 'serif' : (MONO.test(n) ? 'monospace' : 'sans-serif');
  return THAI.test(n) ? q + ',"Sarabun",' + g : q + ',' + g;
}
function round(n, d){ var k = Math.pow(10, d || 2); return Math.round(n * k) / k; }
function cm(tw){ return round(tw * 2.54 / 1440, 2); }                  // twips -> cm
function b64(u8){
  var s = '';
  for(var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function sniff(u){                                                        // image mime from magic bytes
  if(u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E) return 'image/png';
  if(u[0] === 0xFF && u[1] === 0xD8) return 'image/jpeg';
  if(u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return 'image/gif';
  if(u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45) return 'image/webp';
  if(u[0] === 0x42 && u[1] === 0x4D) return 'image/bmp';
  var head = new TextDecoder().decode(u.subarray(0, 300));
  return /<svg[\s>]/i.test(head) ? 'image/svg+xml' : '';
}

/* ---------- package parts: rels, theme, styles, numbering ---------- */
function readRels(u8, base){
  var m = {}, root = parseXml(u8);
  kids(root, 'Relationship').forEach(function(r){
    var t = r.getAttribute('Target') || '', ext = r.getAttribute('TargetMode') === 'External';
    if(!ext){
      var parts = (t.charAt(0) === '/' ? t.slice(1) : base + t).split('/'), out = [];
      parts.forEach(function(p){ if(p === '..') out.pop(); else if(p && p !== '.') out.push(p); });
      t = out.join('/');
    }
    m[r.getAttribute('Id')] = { target: t, ext: ext, type: r.getAttribute('Type') || '' };
  });
  return m;
}
function parseRPr(rp, theme){
  var o = {};
  if(!rp) return o;
  var f = kid(rp, 'rFonts');
  if(f){
    var th = function(n){ var v = wa(f, n + 'Theme'); return v ? (/major/i.test(v) ? theme.major : theme.minor) : null; };
    o.fa = wa(f, 'ascii') || th('ascii'); o.fh = wa(f, 'hAnsi') || th('hAnsi'); o.fc = wa(f, 'cs') || th('cs'); o.fe = wa(f, 'eastAsia') || th('eastAsia');
  }
  o.sz = nv(kid(rp, 'sz'), 'val'); o.szCs = nv(kid(rp, 'szCs'), 'val');
  o.b = on(kid(rp, 'b')); o.bCs = on(kid(rp, 'bCs')); o.i = on(kid(rp, 'i')); o.iCs = on(kid(rp, 'iCs'));
  o.u = on(kid(rp, 'u')); o.strike = on(kid(rp, 'strike')) || on(kid(rp, 'dstrike')); o.vanish = on(kid(rp, 'vanish'));
  var c = wa(kid(rp, 'color'), 'val'); if(c) o.color = c;
  var h = wa(kid(rp, 'highlight'), 'val'); if(h) o.hl = h === 'none' ? '' : (HL[h] || '');
  var sh = kid(rp, 'shd'); if(sh && wa(sh, 'fill')) o.shd = /^[0-9a-f]{6}$/i.test(wa(sh, 'fill')) ? wa(sh, 'fill') : '';
  var va = wa(kid(rp, 'vertAlign'), 'val'); if(va) o.va = va;
  var rs = wa(kid(rp, 'rStyle'), 'val'); if(rs) o.rStyle = rs;
  Object.keys(o).forEach(function(k){ if(o[k] === undefined || o[k] === null) delete o[k]; });
  return o;
}
function parsePPr(pp){
  var o = {};
  if(!pp) return o;
  var jc = wa(kid(pp, 'jc'), 'val'); if(jc) o.jc = jc;
  var ind = kid(pp, 'ind');
  if(ind){ o.left = nv(ind, 'left') != null ? nv(ind, 'left') : nv(ind, 'start'); o.right = nv(ind, 'right') != null ? nv(ind, 'right') : nv(ind, 'end'); o.first = nv(ind, 'firstLine'); o.hang = nv(ind, 'hanging'); }
  var sp = kid(pp, 'spacing');
  if(sp){ o.before = nv(sp, 'before'); o.after = nv(sp, 'after'); o.line = nv(sp, 'line'); o.rule = wa(sp, 'lineRule'); }
  if(kid(pp, 'bidi')) o.bidi = on(kid(pp, 'bidi'));
  if(kid(pp, 'pageBreakBefore')) o.pbb = on(kid(pp, 'pageBreakBefore'));
  var np = kid(pp, 'numPr');
  if(np){ o.numId = wa(kid(np, 'numId'), 'val'); o.ilvl = nv(kid(np, 'ilvl'), 'val'); }
  var ps = wa(kid(pp, 'pStyle'), 'val'); if(ps) o.pStyle = ps;
  var bd = kid(pp, 'pBdr'); if(bd && kid(bd, 'bottom')) o.rule_bottom = true;
  Object.keys(o).forEach(function(k){ if(o[k] === undefined || o[k] === null) delete o[k]; });
  return o;
}
function readStyles(root, theme){
  var S = { by: {}, defP: {}, defR: {}, defPara: null };
  if(!root) return S;
  var dd = kid(root, 'docDefaults');
  S.defR = parseRPr(kid(kid(dd, 'rPrDefault'), 'rPr'), theme); S.defP = parsePPr(kid(kid(dd, 'pPrDefault'), 'pPr'));
  kids(root, 'style').forEach(function(s){
    var id = wa(s, 'styleId'), nm = wa(kid(s, 'name'), 'val') || '';
    S.by[id] = { id: id, type: wa(s, 'type'), name: nm.toLowerCase(), based: wa(kid(s, 'basedOn'), 'val'), p: parsePPr(kid(s, 'pPr')), r: parseRPr(kid(s, 'rPr'), theme) };
    if(wa(s, 'default') === '1' && wa(s, 'type') === 'paragraph') S.defPara = id;
  });
  return S;
}
function chain(S, id){                                                    // base style first, derived last
  var out = [], seen = {};
  while(id && S.by[id] && !seen[id] && out.length < 20){ seen[id] = 1; out.unshift(S.by[id]); id = S.by[id].based; }
  return out;
}
function headingLevel(S, id){
  var c = chain(S, id).reverse();
  for(var i = 0; i < c.length; i++){
    var m = /^heading\s*([1-3])$/.exec(c[i].name) || /^heading([1-3])$/i.exec(c[i].id || '');
    if(m) return +m[1];
  }
  return 0;
}
function readNumbering(root){
  var N = { abs: {}, nums: {} };
  kids(root, 'abstractNum').forEach(function(a){
    var lv = {};
    kids(a, 'lvl').forEach(function(l){ lv[wa(l, 'ilvl') || 0] = { fmt: wa(kid(l, 'numFmt'), 'val') || 'decimal', start: nv(kid(l, 'start'), 'val') || 1 }; });
    N.abs[wa(a, 'abstractNumId')] = lv;
  });
  kids(root, 'num').forEach(function(n){
    var ov = {};
    kids(n, 'lvlOverride').forEach(function(o){ var so = kid(o, 'startOverride'); if(so) ov[wa(o, 'ilvl') || 0] = nv(so, 'val'); });
    N.nums[wa(n, 'numId')] = { abs: wa(kid(n, 'abstractNumId'), 'val'), ov: ov };
  });
  return N;
}

/* ---------- run formatting -> HTML ---------- */
function mediaImg(C, rid, wpx, hpx, alt){
  var rel = C.rels[rid], u8 = rel && !rel.ext && C.zip.get(rel.target);
  if(!u8 || u8.length > 25e6) return '';
  var mime = sniff(u8);
  if(!mime) return '';                                                    // EMF/WMF etc. cannot be shown
  var a = ' src="data:' + mime + ';base64,' + b64(u8) + '"';
  if(wpx > 0) a += ' width="' + Math.round(wpx) + '"';
  if(hpx > 0) a += ' height="' + Math.round(hpx) + '"';
  return '<img' + a + (alt ? ' alt="' + esc(alt) + '"' : '') + '>';
}
// resolved run props + text -> {open, close} markup (merged with neighbours that share `open`)
function fmtRun(rp, text, def){
  var thai = /[\u0E00-\u0E7F]/.test(text);
  var font = cleanFont(thai ? (rp.fc || rp.fa || rp.fh || rp.fe) : (rp.fa || rp.fh || rp.fc || rp.fe));
  var sz = thai ? (rp.szCs != null ? rp.szCs : rp.sz) : (rp.sz != null ? rp.sz : rp.szCs);
  var bold = thai ? (rp.bCs != null ? rp.bCs : rp.b) : (rp.b != null ? rp.b : rp.bCs);
  var ital = thai ? (rp.iCs != null ? rp.iCs : rp.i) : (rp.i != null ? rp.i : rp.iCs);
  var css = '';
  if(font && !/^TH Sarabun New$/i.test(font)) css += 'font-family:' + stackFor(font) + ';';
  if(sz && round(sz / 2, 1) !== def.size) css += 'font-size:' + round(sz / 2, 1) + 'pt;';
  if(rp.color && /^[0-9a-f]{6}$/i.test(rp.color)) css += 'color:#' + rp.color.toLowerCase() + ';';
  var bg = rp.hl || rp.shd;
  if(bg && /^[0-9a-f]{6}$/i.test(bg)) css += 'background-color:#' + bg.toLowerCase() + ';';
  if(def.bold && !bold) css += 'font-weight:400;';
  var open = css ? '<span style="' + esc(css) + '">' : '', close = css ? '</span>' : '';
  [[rp.va === 'subscript', 'sub'], [rp.va === 'superscript', 'sup'], [rp.strike, 's'], [rp.u, 'u'], [ital, 'i'], [bold && !def.bold, 'b']].forEach(function(t){
    if(t[0]){ open += '<' + t[1] + '>'; close = '</' + t[1] + '>' + close; }
  });
  return { open: open, close: close };
}
function pxFromStyle(s, k){
  var m = new RegExp('(?:^|;)\\s*' + k + '\\s*:\\s*([\\d.]+)\\s*(pt|px|cm|in)?', 'i').exec(s || '');
  return m ? parseFloat(m[1]) * ({ pt: 96 / 72, px: 1, cm: 96 / 2.54, 'in': 96 }[(m[2] || 'px').toLowerCase()]) : 0;
}

/* ---------- paragraph content (tokens) ---------- */
// token: {open, close, html, link} | {raw} | {pb:true}
function walkInline(node, base, st, out, C){
  kids(node).forEach(function(c){
    switch(c.localName){
      case 'r': run(c, base, st, out, C); break;
      case 'hyperlink':
        var rid = ra(c, 'id'), url = rid && C.rels[rid] && C.rels[rid].ext ? safeHref(C.rels[rid].target) : '';
        var prev = st.link; if(url) st.link = url;
        walkInline(c, base, st, out, C); st.link = prev; break;
      case 'del': case 'moveFrom': case 'pPr': case 'bookmarkStart': case 'bookmarkEnd': case 'proofErr': break;
      case 'AlternateContent': walkInline(kid(c, 'Choice') || kid(c, 'Fallback') || c, base, st, out, C); break;
      default: walkInline(c, base, st, out, C);                           // ins, sdt, sdtContent, smartTag, fldSimple, customXml...
    }
  });
}
function run(r, base, st, out, C){
  var rp = Object.assign({}, base), direct = parseRPr(kid(r, 'rPr'), C.theme);
  if(direct.rStyle) chain(C.S, direct.rStyle).forEach(function(s){ Object.assign(rp, s.r); });
  Object.assign(rp, direct);
  if(rp.vanish) return;
  var buf = '';
  var flush = function(){
    if(!buf) return;
    var segs = buf.match(/[\u0E00-\u0E7F]+[^A-Za-z\u0E00-\u0E7F]*|[^\u0E00-\u0E7F]+/g) || [];       // Thai / non-Thai text uses different font slots
    segs.forEach(function(s){ var f = fmtRun(rp, s, C.def); out.push({ open: f.open, close: f.close, html: esc(s), link: st.link }); });
    buf = '';
  };
  var kidsOf = function(el){
    kids(el).forEach(function(c){
      switch(c.localName){
        case 't': if(!st.inInstr) buf += c.textContent; break;
        case 'tab': buf += '\u00a0\u00a0\u00a0\u00a0'; break;
        case 'noBreakHyphen': buf += '-'; break;
        case 'br': case 'cr':
          flush();
          if(wa(c, 'type') === 'page') out.push({ pb: true }); else if(wa(c, 'type') !== 'column') out.push({ raw: '<br>' });
          break;
        case 'fldChar':
          var t = wa(c, 'fldCharType');
          if(t === 'begin'){ st.fields.push({ instr: '', link: st.link }); st.inInstr = true; }
          else if(t === 'separate'){
            var f = st.fields[st.fields.length - 1], m = f && /HYPERLINK\s+"?([^"\s]+)"?/i.exec(f.instr);
            st.inInstr = false; if(m && safeHref(m[1])) st.link = safeHref(m[1]);
          }else if(t === 'end'){ var d = st.fields.pop(); st.inInstr = false; if(d) st.link = d.link; }
          break;
        case 'instrText': if(st.fields.length) st.fields[st.fields.length - 1].instr += c.textContent; break;
        case 'drawing': case 'pict': case 'object': flush(); drawingTok(c, out, C); break;
        case 'AlternateContent': kidsOf(kid(c, 'Choice') || kid(c, 'Fallback') || c); break;
      }
    });
  };
  kidsOf(r); flush();
}
function drawingTok(d, out, C){
  var blip = all(d, 'blip')[0], html = '';
  if(blip){
    var ext = all(d, 'extent')[0], dp = all(d, 'docPr')[0];
    html = mediaImg(C, ra(blip, 'embed'), ext ? (parseFloat(ext.getAttribute('cx')) || 0) / 9525 : 0, ext ? (parseFloat(ext.getAttribute('cy')) || 0) / 9525 : 0, dp ? dp.getAttribute('descr') : '');
  }else if(all(d, 'imagedata')[0]){                                       // legacy VML picture
    var im = all(d, 'imagedata')[0], shp = im.parentNode, sty = shp && shp.getAttribute ? shp.getAttribute('style') : '';
    html = mediaImg(C, ra(im, 'id') || im.getAttribute('o:relid'), pxFromStyle(sty, 'width'), pxFromStyle(sty, 'height'), '');
  }else{                                                                  // text box: keep its text
    var tx = all(d, 'txbxContent').map(function(t){ return all(t, 't').map(function(x){ return x.textContent; }).join(''); }).join(' ').trim();
    if(tx) html = esc(tx);
  }
  if(html) out.push({ raw: html });
}
// tokens -> inline html (merges neighbours with the same formatting, groups links)
function tokensHtml(tokens){
  var h = '', i = 0;
  while(i < tokens.length){
    var link = tokens[i].link || '', seg = '';
    for(; i < tokens.length && (tokens[i].link || '') === link; i++){
      var t = tokens[i];
      if(t.pb) continue;
      if(t.raw != null){ seg += t.raw; continue; }
      var j = i, inner = '';
      while(j < tokens.length && tokens[j].open === t.open && (tokens[j].link || '') === link && tokens[j].html != null){ inner += tokens[j].html; j++; }
      seg += t.open + inner.replace(/ {2,}/g, function(m){ return ' ' + new Array(m.length).join('\u00a0'); }) + t.close;
      i = j - 1;
    }
    h += link ? '<a href="' + esc(link) + '">' + seg + '</a>' : seg;
  }
  return h;
}
function plain(tokens){ return tokens.map(function(t){ return t.html != null ? t.html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : ''; }).join(''); }

/* ---------- block level: paragraphs, lists, tables ---------- */
function paraProps(C, pp){
  var P = Object.assign({}, C.S.defP), R = Object.assign({}, C.S.defR), id = pp.pStyle || C.S.defPara;
  chain(C.S, id).forEach(function(s){ Object.assign(P, s.p); Object.assign(R, s.r); });
  Object.assign(P, pp);
  var level = headingLevel(C.S, id);
  C.def = { size: DEF_SIZE[level ? 'h' + level : 'p'], bold: !!level };       // what the editor shows by default for this tag
  return { P: P, R: R, level: level };
}
function blockCss(P, tag){
  var css = '', bidi = P.bidi, jc = P.jc;
  if(jc === 'both' || jc === 'distribute') css += 'text-align:justify;';
  else if(jc === 'center') css += 'text-align:center;';
  else if(bidi && (jc === 'right' || jc === 'end')) css += 'text-align:left;';
  else if(!bidi && (jc === 'right' || jc === 'end')) css += 'text-align:right;';
  var l = P.left || 0, r = P.right || 0;
  if(bidi){ var x = l; l = r; r = x; }
  if(l > 0) css += 'margin-left:' + cm(l) + 'cm;';
  if(r > 0) css += 'margin-right:' + cm(r) + 'cm;';
  if(P.hang) css += 'text-indent:-' + cm(P.hang) + 'cm;'; else if(P.first) css += 'text-indent:' + cm(P.first) + 'cm;';
  var bm = DEF_BM[tag], mt = round((P.before || 0) / 20, 1), mb = round((P.after || 0) / 20, 1);
  if(mt !== bm[0]) css += 'margin-top:' + mt + 'pt;';
  if(mb !== bm[1]) css += 'margin-bottom:' + mb + 'pt;';
  if(P.line && (!P.rule || P.rule === 'auto')){ var lh = round(P.line / 240, 2); if(Math.abs(lh - DEF_LH[tag]) > 0.005 && lh > 0.2 && lh < 10) css += 'line-height:' + lh + ';'; }
  return css;
}
function listType(C, P){
  if(!P.numId || P.numId === '0') return null;
  var n = C.N.nums[P.numId], lv = n && C.N.abs[n.abs] && C.N.abs[n.abs][P.ilvl || 0];
  var fmt = lv ? lv.fmt : 'bullet';
  var restart = !!(n && n.ov[P.ilvl || 0] != null && !C.used[P.numId]);
  C.used[P.numId] = 1;
  return { tag: fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol', key: n && n.abs != null ? 'a' + n.abs : 'n' + P.numId, numId: P.numId, restart: restart,
    start: n && n.ov[P.ilvl || 0] != null ? n.ov[P.ilvl || 0] : (lv ? lv.start : 1) };
}
function blockList(c){                                                    // direct block children, unwrapping content controls
  var out = [];
  kids(c).forEach(function(e){
    var n = e.localName;
    if(n === 'p' || n === 'tbl') out.push(e);
    else if(n === 'sdt') out = out.concat(blockList(kid(e, 'sdtContent')));
    else if(n === 'sdtContent' || n === 'customXml' || n === 'ins' || n === 'moveTo' || n === 'smartTag') out = out.concat(blockList(e));
    else if(n === 'AlternateContent') out = out.concat(blockList(kid(e, 'Choice') || e));
  });
  return out;
}
function convBlocks(c, C, inCell){
  var html = '', ls = [];
  var flushList = function(){ while(ls.length) html += '</li></' + ls.pop().tag + '>'; };
  // L = {tag, key (abstractNum: Word counts per abstractNum), numId, restart (first use of a num with startOverride), start}
  var addItem = function(L, lvl, inner, css){
    while(ls.length && ls[ls.length - 1].lvl > lvl) html += '</li></' + ls.pop().tag + '>';
    var top = ls[ls.length - 1];
    if(top && top.lvl === lvl && (top.tag !== L.tag || (ls.length === 1 && (top.key !== L.key || (L.restart && top.numId !== L.numId))))){
      html += '</li></' + ls.pop().tag + '>'; top = ls[ls.length - 1];
    }
    if(L.restart && lvl === 0) C.cnt[L.key] = 0;
    if(!top || top.lvl < lvl){
      var seen = C.cnt[L.key] || 0, st = ls.length === 0 && L.tag === 'ol' ? (seen ? seen + 1 : (L.start > 1 ? L.start : 0)) : 0;
      html += '<' + L.tag + (st > 1 ? ' start="' + st + '"' : '') + '>'; ls.push({ tag: L.tag, lvl: lvl, key: L.key, numId: L.numId });
    }else html += '</li>';
    if(L.tag === 'ol' && lvl === 0) C.cnt[L.key] = (C.cnt[L.key] || 0) + 1;
    html += '<li' + (css ? ' style="' + esc(css) + '"' : '') + '>' + (inner || '<br>');
  };
  blockList(c).forEach(function(e){
    try{
      if(e.localName === 'tbl'){ flushList(); html += convTable(e, C); return; }
      var pp = parsePPr(kid(e, 'pPr')), pr = paraProps(C, pp), P = pr.P, tag = pr.level ? 'h' + pr.level : 'p';
      var tokens = []; walkInline(e, pr.R, { link: '', fields: [], inInstr: false }, tokens, C);
      if(!C.title && pr.level && /^h/.test(tag)) C.title = plain(tokens).trim().slice(0, 120);
      var lt = pr.level ? null : listType(C, P), PB = '<div class="pbreak" contenteditable="false"></div>';
      var attrs = function(){ var css = blockCss(P, tag); return (P.bidi ? ' dir="rtl"' : '') + (css ? ' style="' + esc(css) + '"' : ''); };
      // pageBreakBefore -> marker first; a w:br page splits the paragraph (text before stays, the paragraph mark lands after the break)
      if(P.pbb && !inCell && html){ flushList(); html += PB; }
      var segs = [[]];
      tokens.forEach(function(t){ if(t.pb){ if(!inCell && !lt) segs.push([]); } else segs[segs.length - 1].push(t); });
      if(segs.length > 1){
        flushList();
        segs.forEach(function(sg, k){
          var sh = tokensHtml(sg);
          if(k < segs.length - 1){ if(sh) html += '<' + tag + attrs() + '>' + sh + '</' + tag + '>'; html += PB; }
          else html += '<' + tag + attrs() + '>' + (sh || '<br>') + '</' + tag + '>';
        });
        return;
      }
      var inner = tokensHtml(segs[0]);
      if(lt){
        var jcss = P.jc === 'center' ? 'text-align:center;' : P.jc === 'right' ? 'text-align:right;' : P.jc === 'both' ? 'text-align:justify;' : '';
        addItem(lt, P.ilvl || 0, inner, jcss);
        return;
      }
      flushList();
      if(P.rule_bottom && !inner.replace(/<br>/g, '').trim()){ html += '<hr>'; return; }
      html += '<' + tag + attrs() + '>' + (inner || '<br>') + '</' + tag + '>';
    }catch(err){
      flushList();
      html += '<p>' + esc(all(e, 't').map(function(t){ return t.textContent; }).join('')) + '</p>';
    }
  });
  flushList();
  return html;
}
function convTable(tbl, C){
  var grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map(function(g){ return nv(g, 'w') || 0; }), gt = grid.reduce(function(a, b){ return a + b; }, 0);
  var open = {}, rows = [];
  kids(tbl, 'tr').forEach(function(tr, ri){
    var col = 0, cells = [];
    kids(tr).forEach(function(tc){
      if(tc.localName === 'sdt'){ return; }
      if(tc.localName !== 'tc') return;
      var pr = kid(tc, 'tcPr'), span = Math.max(1, nv(kid(pr, 'gridSpan'), 'val') || 1), vm = kid(pr, 'vMerge');
      if(vm && wa(vm, 'val') !== 'restart'){                              // continuation of a merged cell: grow the cell above
        if(open[col]) open[col].rows++;
        col += span; return;
      }
      var w = 0; for(var k = col; k < col + span; k++) w += grid[k] || 0;
      var fill = wa(kid(pr, 'shd'), 'fill'), cell = { span: span, rows: 1, w: w || nv(kid(pr, 'tcW'), 'w') || 0,
        bg: fill && /^[0-9a-f]{6}$/i.test(fill) ? fill : '', html: convBlocks(tc, C, true) };
      // a lone plain paragraph becomes bare cell content like the editor's cells; its formatting moves onto the td (margins -> padding)
      var m = /^<p((?: dir="rtl")?)(?: style="([^"]*)")?>((?:(?!<\/?p[ >]).)*)<\/p>$/s.exec(cell.html);
      cell.css = ''; cell.dir = '';
      if(m){
        cell.dir = m[1]; cell.html = m[3] || '<br>';
        cell.css = (m[2] || '').split(';').filter(function(d){ return d && !/^margin-(top|bottom):/.test(d); })
          .map(function(d){ return d.replace(/^margin-(left|right):/, 'padding-$1:') + ';'; }).join('');
      }else cell.html = cell.html || '<br>';
      if(vm) open[col] = cell; else delete open[col];
      cells.push(cell); col += span;
    });
    rows.push({ cells: cells, first: ri === 0 });
  });
  var tot = gt || rows[0] && rows[0].cells.reduce(function(a, c){ return a + c.w; }, 0) || 0;
  return '<table><tbody>' + rows.map(function(r){
    return '<tr>' + r.cells.map(function(c){
      var css = (r.first && tot && c.w ? 'width:' + round(c.w * 100 / tot, 1) + '%;' : '') + (c.bg ? 'background-color:#' + c.bg.toLowerCase() + ';' : '') + c.css;
      return '<td' + c.dir + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rows > 1 ? ' rowspan="' + c.rows + '"' : '') + (css ? ' style="' + css + '"' : '') + '>' + c.html + '</td>';
    }).join('') + '</tr>';
  }).join('') + '</tbody></table>';
}

/* ---------- page + header/footer ---------- */
function readPage(sect){
  var sz = kid(sect, 'pgSz'), mar = kid(sect, 'pgMar'), page = {};
  if(sz && nv(sz, 'w') > 0 && nv(sz, 'h') > 0){
    var w = Math.round(nv(sz, 'w') / 15), h = Math.round(nv(sz, 'h') / 15);
    page.land = wa(sz, 'orient') === 'landscape' || w > h;
    page.w = w; page.h = h; page.size = 'A4';
    var lo = Math.min(w, h), hi = Math.max(w, h);
    Object.keys(PAGE_SIZES).forEach(function(k){
      if(Math.abs(PAGE_SIZES[k][0] - lo) <= 6 && Math.abs(PAGE_SIZES[k][1] - hi) <= 6) page.size = k;
    });
  }
  if(mar){
    ['top:mt', 'bottom:mb', 'left:ml', 'right:mr'].forEach(function(p){
      var v = nv(mar, p.split(':')[0]); if(v != null) page[p.split(':')[1]] = Math.abs(Math.round(v / 15));
    });
  }
  return page;
}
// header/footer paragraph -> {text, hasPage, jc}; PAGE/NUMPAGES fields become {n}/{N}
function hfPara(p){
  var s = { t: '', page: false, skip: 0 };
  (function walk(n){
    kids(n).forEach(function(c){
      var ln = c.localName;
      if(ln === 't'){ if(!s.skip) s.t += c.textContent; }
      else if(ln === 'tab'){ if(!s.skip) s.t += ' '; }
      else if(ln === 'fldSimple'){
        var ins = wa(c, 'instr') || '';
        if(/^\s*PAGE\b/i.test(ins)){ s.t += '{n}'; s.page = true; } else if(/NUMPAGES/i.test(ins)){ s.t += '{N}'; s.page = true; } else walk(c);
      }
      else if(ln === 'fldChar'){
        var ty = wa(c, 'fldCharType');
        if(ty === 'begin'){ s.cur = ''; s.inI = true; }
        else if(ty === 'separate'){
          s.inI = false;
          if(/^\s*PAGE\b/i.test(s.cur)){ s.t += '{n}'; s.page = true; s.skip++; } else if(/NUMPAGES/i.test(s.cur)){ s.t += '{N}'; s.page = true; s.skip++; }
        }else if(ty === 'end'){ if(s.skip) s.skip--; s.inI = false; }
      }
      else if(ln === 'instrText'){ if(s.inI) s.cur = (s.cur || '') + c.textContent; }
      else if(ln !== 'pPr' && ln !== 'del') walk(c);
    });
  })(p);
  return { text: s.t, page: s.page, jc: wa(kid(kid(p, 'pPr'), 'jc'), 'val') || 'left' };
}
function readHF(sect, rels, zip, kind, hf){
  var refs = kids(sect, kind + 'Reference'), ref = refs.filter(function(r){ return wa(r, 'type') === 'default'; })[0] || refs[0];
  var rel = ref && rels[ra(ref, 'id')], root = rel && parseXml(zip.get(rel.target));
  if(!root) return;
  kids(root, 'p').forEach(function(p){
    var r = hfPara(p);
    if(r.page && !hf._numSet){
      hf.fmt = r.text.replace(/\s+$/, '') || '{n}';
      var j = /center/.test(r.jc) ? 'c' : /^(right|end)$/.test(r.jc) ? 'r' : 'l';
      hf.pos = (kind === 'header' ? 't' : 'b') + j; hf._numSet = true;
    }else if(!r.page && r.text.trim() && !hf[kind]) hf[kind] = r.text.trim();
  });
}

/* ---------- main ---------- */
async function importDocx(buf){
  var zip;
  try{ zip = await window.SJNZip.read(buf); }
  catch(e){ throw new Error('Not a valid .docx file: ' + (e && e.message || e)); }
  var relRoot = zip.get('_rels/.rels') && readRels(zip.get('_rels/.rels'), ''), main = 'word/document.xml';
  Object.keys(relRoot || {}).forEach(function(k){ if(/officeDocument$/.test(relRoot[k].type) && zip.get(relRoot[k].target)) main = relRoot[k].target; });
  var docRoot = parseXml(zip.get(main));
  if(!docRoot || docRoot.localName !== 'document') throw new Error('Not a Word document (word/document.xml is missing or unreadable)');
  var dir = main.replace(/[^\/]*$/, '');
  var rels = readRels(zip.get(dir + '_rels/' + main.split('/').pop() + '.rels'), dir);
  var theme = { major: '', minor: '' }, th = parseXml(zip.get(dir + 'theme/theme1.xml'));
  var latin = function(tag){ var f = all(th, tag)[0], l = f && kid(f, 'latin'); return l ? l.getAttribute('typeface') || '' : ''; };
  if(th){ theme.major = latin('majorFont'); theme.minor = latin('minorFont'); }
  var C = { zip: zip, rels: rels, theme: theme, S: readStyles(parseXml(zip.get(dir + 'styles.xml')), theme),
    N: readNumbering(parseXml(zip.get(dir + 'numbering.xml'))), cnt: {}, used: {}, title: '', def: { size: 16, bold: false } };
  var body = kid(docRoot, 'body'), html = '';
  try{ html = convBlocks(body, C, false); }catch(e){ html = ''; }
  if(!html.trim()) html = '<p><br></p>';
  var sect = kid(body, 'sectPr') || all(body, 'sectPr')[0], page = {}, hf = { header: '', footer: '', pos: 'none', fmt: 'หน้า {n} / {N}' };
  try{ if(sect){ page = readPage(sect); readHF(sect, rels, zip, 'footer', hf); readHF(sect, rels, zip, 'header', hf); } }catch(e){}
  delete hf._numSet;
  var title = '', core = parseXml(zip.get('docProps/core.xml'));
  if(core){ var t = all(core, 'title')[0]; title = t ? t.textContent.trim() : ''; }
  return { html: html, title: title || C.title || '', page: page, hf: hf };
}
SJN.importDocx = importDocx;
})();
