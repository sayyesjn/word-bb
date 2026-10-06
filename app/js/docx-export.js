/* SJNDocx.exportDocx(opts) -> Promise<Blob>   (needs zip.js)
   opts = { html, title, page:{size,land,mt,mb,ml,mr,w,h}, hf:{header,footer,pos,fmt} }
   Renders the editor HTML off-screen so the app's own CSS resolves every style, then maps the
   computed styles onto WordprocessingML. Every block is converted inside try/catch (fallback = plain text). */
(function(){
'use strict';
var SJN = window.SJNDocx = window.SJNDocx || {};
var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var FONT = 'TH Sarabun New';
var SIZES = { A4:[794,1123], A5:[559,794], A3:[1123,1587], B5:[665,945], Letter:[816,1056], Legal:[816,1344] };
var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
var XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
var RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
var ILLEGAL = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu;

function esc(s){ return String(s == null ? '' : s).replace(ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function num(v, d){ v = parseFloat(v); return isFinite(v) ? v : (d || 0); }
function tw(px){ return Math.round(px * 15); }                 // css px -> twips
function hex2(n){ return ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); }
function rgb(c){                                               // 'rgb(a)(...)' -> 'RRGGBB' or '' when transparent
  var m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,\/]+([\d.]+%?))?/.exec(c || '');
  if(!m || (m[4] != null && parseFloat(m[4]) === 0)) return '';
  return (hex2(m[1]) + hex2(m[2]) + hex2(m[3])).toUpperCase();
}

function Builder(opts){
  var self = this;
  this.rels = [];            // [{id, type, target, ext}]
  this.media = [];           // [{name, bytes}]
  this.imgCache = {};
  this.linkIds = {};
  this.numDefs = [];         // [{abs, start}]
  this.docPr = 0;
  this.pb = false;           // true when a page-break paragraph was just written
  this.hostColor = '';
  this.textW = opts.textW;
  this.addRel = function(type, target, ext){ var id = 'rId' + (self.rels.length + 4); self.rels.push({ id: id, type: type, target: target, ext: ext }); return id; };
}

/* ---------- run / paragraph properties ---------- */
function firstFamily(ff){
  var f = String(ff || '').split(',')[0].replace(/^[\s"']+|[\s"']+$/g, '');
  if(!f || /^(sans-serif|system-ui|ui-sans-serif)$/i.test(f)) return FONT;
  if(/^serif$/i.test(f)) return 'Times New Roman';
  if(/^monospace$/i.test(f)) return 'Courier New';
  return f;
}
// run properties for text whose parent element is `el`; st = inherited decoration state; hb = inside a heading style
function rpr(B, el, st, hb){
  var cs = getComputedStyle(el), f = esc(firstFamily(cs.fontFamily));
  var px = st.v ? num(st.vfs, 21.33) : num(cs.fontSize, 21.33), sz = Math.max(2, Math.min(3276, Math.round(px * 1.5)));
  var b = parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === 'bold', i = /italic|oblique/.test(cs.fontStyle);
  var col = rgb(cs.color), x = '';
  x += '<w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>';
  if(b) x += '<w:b/><w:bCs/>'; else if(hb) x += '<w:b w:val="0"/><w:bCs w:val="0"/>';
  if(i) x += '<w:i/><w:iCs/>';
  if(st.s) x += '<w:strike/>';
  if(col && col !== B.hostColor) x += '<w:color w:val="' + col + '"/>';
  x += '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>';
  if(st.u) x += '<w:u w:val="single"/>';
  if(st.bg) x += '<w:shd w:val="clear" w:color="auto" w:fill="' + st.bg + '"/>';
  if(st.v) x += '<w:vertAlign w:val="' + (st.v === 'sub' ? 'subscript' : 'superscript') + '"/>';
  return x + '<w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/>';
}
function isBlockEl(n){ return n.nodeType === 1 && /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|HR|BLOCKQUOTE|PRE|SECTION|ARTICLE|FIGURE)$/.test(n.tagName); }
function safeHref(h){ h = String(h || '').trim(); return /^(https?:|mailto:|tel:)/i.test(h) ? h : ''; }

/* ---------- images ---------- */
function dataUrl(src){
  var m = /^data:(image\/[a-z0-9.+-]+)(;[^,]*)?,(.*)$/is.exec(src || '');
  if(!m) return null;
  try{
    var bin = /;base64/i.test(m[2] || '') ? atob(m[3].replace(/\s/g, '')) : decodeURIComponent(m[3]);
    var u8 = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 255;
    return { mime: m[1].toLowerCase(), bytes: u8 };
  }catch(e){ return null; }
}
// register the image once; returns {rid,name} or null. Unsupported formats are converted to PNG through a canvas.
function addImage(B, img){
  var src = img.getAttribute('src') || '';
  if(B.imgCache[src]) return B.imgCache[src];
  var d = dataUrl(src);
  if(!d) return null;
  var ext = { 'image/png':'png', 'image/jpeg':'jpeg', 'image/jpg':'jpeg', 'image/gif':'gif' }[d.mime];
  if(!ext){
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    d = dataUrl(c.toDataURL('image/png')); ext = 'png';
    if(!d) return null;
  }
  if(!img.complete || !img.naturalWidth) return null;                    // undecodable picture: skip it
  var name = 'image' + (B.media.length + 1) + '.' + ext;
  B.media.push({ name: name, bytes: d.bytes, ext: ext });
  return (B.imgCache[src] = { rid: B.addRel(RT + 'image', 'media/' + name), name: name });
}
function drawing(B, img){
  var m = addImage(B, img);
  if(!m) return '';
  var w = img.getBoundingClientRect().width || num(img.getAttribute('width')) || img.naturalWidth || 100;
  var h = img.getBoundingClientRect().height || num(img.getAttribute('height')) || img.naturalHeight || 100;
  if(w > B.textW){ h = h * B.textW / w; w = B.textW; }
  var cx = Math.max(1, Math.round(w * 9525)), cy = Math.max(1, Math.round(h * 9525)), id = ++B.docPr;
  return '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
    '<wp:docPr id="' + id + '" name="Picture ' + id + '" descr="' + esc(img.getAttribute('alt') || '') + '"/>' +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
    '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + m.name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="' + m.rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
}

/* ---------- inline content ---------- */
// walk inline nodes collecting {k:'t'|'br'|'img', rpr, t, el, link}
function inl(B, n, st, items, link, hb){
  if(n.nodeType === 3){
    var t = n.nodeValue.replace(/​/g, '').replace(/[ \t\r\n\f]+/g, ' ');
    if(t) items.push({ k: 't', t: t, rpr: rpr(B, n.parentElement, st, hb), link: link });
    return;
  }
  if(n.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE|HEAD|META|LINK)$/.test(n.tagName)) return;
  if(n.tagName === 'BR'){ items.push({ k: 'br', rpr: rpr(B, n.parentElement || B.host, st, hb), link: link }); return; }
  if(n.tagName === 'IMG'){ items.push({ k: 'img', el: n, link: link }); return; }
  var cs = getComputedStyle(n);
  if(cs.display === 'none') return;
  var st2 = { u: st.u || /underline/.test(cs.textDecorationLine), s: st.s || /line-through/.test(cs.textDecorationLine),
    v: st.v, vfs: st.vfs, bg: st.bg };
  if(!st.v && /^(sub|super)$/.test(cs.verticalAlign)){ st2.v = cs.verticalAlign; st2.vfs = getComputedStyle(n.parentElement).fontSize; }
  var bg = rgb(cs.backgroundColor); if(bg) st2.bg = bg;
  var l2 = link;
  if(n.tagName === 'A'){ var h = safeHref(n.getAttribute('href')); if(h) l2 = h; }
  if(isBlockEl(n) && items.length) items.push({ k: 'br', rpr: rpr(B, n, st2, hb) });
  for(var c = n.firstChild; c; c = c.nextSibling) inl(B, c, st2, items, l2, hb);
}
function runsXml(B, items){
  // trim collapsible spaces at line starts/ends, drop a trailing <br>
  var prevBr = true;
  items.forEach(function(it, i){
    if(it.k === 't'){
      if(prevBr) it.t = it.t.replace(/^ +/, '');
      var nx = items[i + 1];
      if(!nx || nx.k === 'br') it.t = it.t.replace(/ +$/, '');
    }
    prevBr = it.k === 'br';
  });
  while(items.length && items[items.length - 1].k === 'br') items.pop();
  var merged = [];
  items.forEach(function(it){                                   // merge identical adjacent text runs
    var last = merged[merged.length - 1];
    if(it.k === 't' && !it.t) return;
    if(it.k === 't' && last && last.k === 't' && last.rpr === it.rpr && last.link === it.link) last.t += it.t;
    else merged.push({ k: it.k, rpr: it.rpr, t: it.t, el: it.el, link: it.link });
  });
  var out = '', i = 0;
  while(i < merged.length){
    var link = merged[i].link, xml = '';
    for(; i < merged.length && merged[i].link === link; i++){
      var it = merged[i], rp = it.rpr ? '<w:rPr>' + (link ? '<w:rStyle w:val="Hyperlink"/>' : '') + it.rpr + '</w:rPr>' : '';
      if(it.k === 't') xml += '<w:r>' + rp + '<w:t xml:space="preserve">' + esc(it.t) + '</w:t></w:r>';
      else if(it.k === 'br') xml += '<w:r>' + rp + '<w:br/></w:r>';
      else{ var dr = drawing(B, it.el); if(dr) xml += '<w:r>' + dr + '</w:r>'; }
    }
    if(link){
      if(!B.linkIds[link]) B.linkIds[link] = B.addRel(RT + 'hyperlink', link, true);
      xml = '<w:hyperlink r:id="' + B.linkIds[link] + '" w:history="1">' + xml + '</w:hyperlink>';
    }
    out += xml;
  }
  return out;
}

/* ---------- paragraphs ---------- */
function paraXml(B, el, nodes, o){
  o = o || {};
  var cs = getComputedStyle(el), tag = el.tagName, hb = /^H[1-3]$/.test(tag), items = [];
  nodes.forEach(function(n){ inl(B, n, { u: false, s: false, v: '', bg: '' }, items, null, hb); });
  var runs = runsXml(B, items), p = '';
  if(hb) p += '<w:pStyle w:val="Heading' + tag.charAt(1) + '"/>';
  if(B.pbPending){ p += '<w:pageBreakBefore/>'; B.pbPending = false; }
  if(o.num) p += '<w:numPr><w:ilvl w:val="' + o.num.lvl + '"/><w:numId w:val="' + o.num.id + '"/></w:numPr>';
  if(tag === 'HR') p += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="8A949B"/></w:pBdr>';
  var rtl = cs.direction === 'rtl';
  if(rtl) p += '<w:bidi/>';
  var fs = num(cs.fontSize, 21.33), lh = cs.lineHeight === 'normal' ? 1.2 : num(cs.lineHeight) / fs;
  var before = tag === 'HR' ? 120 : tw(num(cs.marginTop)), after = tag === 'HR' ? 120 : tw(num(cs.marginBottom));
  p += '<w:spacing w:before="' + before + '" w:after="' + after + '" w:line="' + Math.max(20, Math.round(lh * 240)) + '" w:lineRule="auto"/>';
  var inCell = o.cell && o.cell === el;                  // loose content of a td: its indentation lives in padding-left/right
  var ml = inCell ? tw(cmPx(el.style.paddingLeft)) : tw(num(cs.marginLeft)), mr = inCell ? tw(cmPx(el.style.paddingRight)) : tw(num(cs.marginRight));
  if(rtl){ var sw = ml; ml = mr; mr = sw; }
  var ti = tag === 'LI' ? 0 : tw(num(cs.textIndent)), ind = '';
  if(o.num){
    if(ml) ind = ' w:left="' + (720 * (o.num.lvl + 1) + ml) + '" w:hanging="360"';
  }else if(ml || mr || ti){
    ind = ' w:left="' + Math.max(0, ml) + '" w:right="' + Math.max(0, mr) + '"' + (ti > 0 ? ' w:firstLine="' + ti + '"' : ti < 0 ? ' w:hanging="' + (-ti) + '"' : '');
  }
  if(ind) p += '<w:ind' + ind + '/>';
  var ta = cs.textAlign, jc = '';
  if(/center/.test(ta)) jc = 'center'; else if(ta === 'justify') jc = 'both';
  else if(ta === 'right') jc = rtl ? '' : 'right'; else if(ta === 'left') jc = rtl ? 'right' : '';
  if(jc) p += '<w:jc w:val="' + jc + '"/>';
  var f = esc(firstFamily(cs.fontFamily)), sz = Math.round(fs * 1.5);
  p += '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr>';
  return '<w:p><w:pPr>' + p + '</w:pPr>' + runs + '</w:p>';
}
function cmPx(v){ var m = /^(-?[\d.]+)(cm|mm|pt|px|in)?$/.exec(String(v).trim()); if(!m) return 0; return parseFloat(m[1]) * ({ cm: 96 / 2.54, mm: 96 / 25.4, pt: 96 / 72, px: 1, 'in': 96 }[m[2] || 'px']); }
function plainPara(text){
  return '<w:p><w:r><w:t xml:space="preserve">' + esc(String(text || '').replace(/​/g, '')) + '</w:t></w:r></w:p>';
}
function pageBreakPara(){ return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }
function isEmptyP(e){
  return e && e.tagName === 'P' && !e.querySelector('img,table') && !e.textContent.replace(/[​\s]/g, '');
}

/* ---------- lists ---------- */
function listXml(B, list, lvl, parentNum, cell){
  var ordered = list.tagName === 'OL', num = parentNum;
  if(!num || lvl === 0 || num.ordered !== ordered){
    var id = B.numDefs.length + 1;
    var start = ordered ? Math.max(1, parseInt(list.getAttribute('start'), 10) || 1) : 1;
    B.numDefs.push({ abs: ordered ? 1 : 0, start: start, id: id });
    num = { id: id, ordered: ordered };
  }
  var out = '';
  for(var c = list.firstChild; c; c = c.nextSibling){
    if(c.nodeType === 3){ if(c.nodeValue.replace(/[\u200B\s]/g, '')) out += block(B, c, { cell: cell }); continue; }
    if(c.nodeType !== 1) continue;
    if(c.tagName === 'UL' || c.tagName === 'OL'){ out += listXml(B, c, Math.min(8, lvl + 1), num, cell); continue; }   // ul > ul
    if(c.tagName !== 'LI'){ out += block(B, c, { cell: cell }); continue; }
    var inline = [];
    var nested = '';
    for(var k = c.firstChild; k; k = k.nextSibling){
      if(k.nodeType === 1 && (k.tagName === 'UL' || k.tagName === 'OL')) nested += listXml(B, k, Math.min(8, lvl + 1), num, cell);
      else if(k.nodeType === 1 && /^(P|DIV|H[1-6])$/.test(k.tagName) && !k.querySelector('ul,ol')){ for(var q = k.firstChild; q; q = q.nextSibling) inline.push(q); if(k.nextSibling) inline.push(document.createElement('br')); }
      else inline.push(k);
    }
    out += safe(function(){ return paraXml(B, c, inline, { num: { id: num.id, lvl: lvl }, cell: null }); }, c) + nested;
  }
  return out;
}

/* ---------- tables ---------- */
function tableXml(B, t){
  var rows = Array.prototype.slice.call(t.rows).filter(function(r){ return r.cells.length; }), tr = t.getBoundingClientRect(), edges = [];
  if(!rows.length) return '';
  rows.forEach(function(r){ Array.prototype.forEach.call(r.cells, function(c){
    var b = c.getBoundingClientRect(); edges.push(b.left - tr.left, b.right - tr.left);
  }); });
  edges.sort(function(a, b){ return a - b; });
  var grid = [];                                                // unique column edges (merge within 1.5px)
  edges.forEach(function(e){ if(!grid.length || e - grid[grid.length - 1] > 1.5) grid.push(e); });
  if(grid.length < 2) grid = [0, Math.max(1, tr.width)];
  var near = function(x){ var bi = 0; grid.forEach(function(g, i){ if(Math.abs(g - x) < Math.abs(grid[bi] - x)) bi = i; }); return bi; };
  var cols = grid.length - 1, widths = [];
  for(var i = 0; i < cols; i++) widths.push(Math.max(30, tw(grid[i + 1] - grid[i])));
  var total = widths.reduce(function(a, b){ return a + b; }, 0);
  var x = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + total + '" w:type="dxa"/>' +
    '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function(s){ return '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="8A949B"/>'; }).join('') + '</w:tblBorders>' +
    '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>' +
    widths.map(function(w){ return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>';
  var pend = {};                                                // col index -> {left rows, span} for rowSpan continuation cells
  rows.forEach(function(r){
    var cells = Array.prototype.slice.call(r.cells), col = 0, rx = '';
    var cont = function(upTo){
      for(; col < upTo; ){
        var pd = pend[col];
        if(pd && pd.left > 0){ rx += '<w:tc><w:tcPr><w:tcW w:w="' + pd.w + '" w:type="dxa"/>' + (pd.span > 1 ? '<w:gridSpan w:val="' + pd.span + '"/>' : '') + '<w:vMerge/></w:tcPr><w:p/></w:tc>'; pd.left--; col += pd.span; }
        else{ rx += '<w:tc><w:tcPr><w:tcW w:w="' + widths[col] + '" w:type="dxa"/></w:tcPr><w:p/></w:tc>'; col++; }
      }
    };
    cells.forEach(function(c){
      var b = c.getBoundingClientRect(), s = near(b.left - tr.left), e = Math.max(s + 1, near(b.right - tr.left));
      cont(s);
      var w = 0; for(var k = s; k < e; k++) w += widths[k];
      var rs = Math.max(1, c.rowSpan || 1), cbg = rgb(getComputedStyle(c).backgroundColor), inner;
      inner = safe(function(){ return flow(B, c, { cell: c }); }, c) || '';
      if(!/(<\/w:p>|<w:p\/>)$/.test(inner)) inner += '<w:p/>';           // a cell must end with a paragraph
      rx += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (e - s > 1 ? '<w:gridSpan w:val="' + (e - s) + '"/>' : '') +
        (rs > 1 ? '<w:vMerge w:val="restart"/>' : '') + (cbg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + cbg + '"/>' : '') + '</w:tcPr>' + inner + '</w:tc>';
      if(rs > 1) pend[s] = { left: rs - 1, span: e - s, w: w };
      col = e;
    });
    cont(cols);
    x += '<w:tr>' + rx + '</w:tr>';
  });
  return x + '</w:tbl>';
}

/* ---------- block dispatch ---------- */
function safe(fn, el){
  try{ return fn(); }catch(e){ return plainPara(el && el.textContent); }
}
function block(B, el, o){
  if(el.nodeType === 3){ return el.nodeValue.trim() ? safe(function(){ return paraXml(B, el.parentElement, [el], o); }, el) : ''; }
  if(el.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE|META|LINK)$/.test(el.tagName)) return '';
  return safe(function(){
    var tag = el.tagName;
    if(el.classList.contains('pbreak')) return pageBreakPara();
    if(tag === 'UL' || tag === 'OL') return listXml(B, el, 0, null, o && o.cell);
    if(tag === 'TABLE') return tableXml(B, el);
    if(tag === 'HR') return paraXml(B, el, [], o);
    if(tag === 'P' || /^H[1-6]$/.test(tag) || tag === 'LI') return paraXml(B, el, Array.prototype.slice.call(el.childNodes), o);
    if(el.querySelector('p,div,ul,ol,table,h1,h2,h3,hr') || tag === 'DIV' && !el.childNodes.length) return flow(B, el, o);
    return paraXml(B, el, Array.prototype.slice.call(el.childNodes), o);          // div/blockquote/pre with only inline content
  }, el);
}
// children of a container: loose inline runs go to anonymous paragraphs, block children are dispatched
function flow(B, c, o){
  var out = '', buf = [], kids = Array.prototype.slice.call(c.childNodes), lastTbl = false;
  var flush = function(){
    if(buf.some(function(n){ return n.nodeType === 1 || n.nodeValue.replace(/[​\s]/g, ''); }))
      out += safe(function(){ return paraXml(B, c, buf, o); }, c);
    buf = [];
  };
  for(var i = 0; i < kids.length; i++){
    var k = kids[i];
    if(k.nodeType === 1 && (isBlockEl(k) || k.tagName === 'TABLE')){
      flush();
      var isT = k.tagName === 'TABLE';
      if(isT && lastTbl) out += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';   // keep adjacent tables apart
      if(k.classList.contains('pbreak')){
        var nx = k.nextSibling; while(nx && nx.nodeType === 3 && !nx.nodeValue.trim()) nx = nx.nextSibling;
        if(isEmptyP(nx)){ out += pageBreakPara(); i = kids.indexOf(nx); }   // break paragraph's own mark = the editor's empty <p> after it
        else if(nx && nx.nodeType === 1 && /^(P|H[1-3]|UL|OL|HR)$/.test(nx.tagName)){ B.pbPending = true; }   // next paragraph carries pageBreakBefore
        else out += pageBreakPara();
      }else{ var piece = block(B, k, o); out += piece; lastTbl = isT && piece !== ''; continue; }
      lastTbl = false;
    }else buf.push(k);
  }
  flush();
  return out;
}

/* ---------- static parts ---------- */
function stylesXml(){
  var fonts = '<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:cs="' + FONT + '" w:eastAsia="' + FONT + '"/>';
  var head = function(n, sz, before, after, line){
    return '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="' + before + '" w:after="' + after + '" w:line="' + line + '" w:lineRule="auto"/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>';
  };
  return XMLH + '<w:styles ' + NS + '><w:docDefaults><w:rPrDefault><w:rPr>' + fonts + '<w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/></w:style>' +
    head(1, 48, 240, 120, 288) + head(2, 40, 200, 120, 288) + head(3, 36, 160, 80, 288) +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0B5CAD"/><w:u w:val="single"/></w:rPr></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function(s){ return '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="8A949B"/>'; }).join('') + '</w:tblBorders></w:tblPr></w:style></w:styles>';
}
function numberingXml(defs){
  var BUL = ['•', 'o', '▪'], DEC = ['decimal', 'lowerLetter', 'lowerRoman'];
  var abs = function(id, ordered){
    var x = '<w:abstractNum w:abstractNumId="' + id + '"><w:multiLevelType w:val="hybridMultilevel"/>';
    for(var l = 0; l < 9; l++){
      x += '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="' + (ordered ? DEC[l % 3] : 'bullet') + '"/><w:lvlText w:val="' +
        (ordered ? '%' + (l + 1) + '.' : BUL[l % 3]) + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 * (l + 1)) + '" w:hanging="360"/></w:pPr>' +
        (ordered ? '' : '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New" w:hint="default"/></w:rPr>') + '</w:lvl>';
    }
    return x + '</w:abstractNum>';
  };
  var x = XMLH + '<w:numbering ' + NS + '>' + abs(0, false) + abs(1, true);
  defs.forEach(function(d){
    x += '<w:num w:numId="' + d.id + '"><w:abstractNumId w:val="' + d.abs + '"/>' +
      (d.abs ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="' + d.start + '"/></w:lvlOverride>' : '') + '</w:num>';
  });
  return x + '</w:numbering>';
}
function fieldRuns(rp, name, shown){
  return '<w:r>' + rp + '<w:fldChar w:fldCharType="begin"/></w:r><w:r>' + rp + '<w:instrText xml:space="preserve"> ' + name + ' </w:instrText></w:r><w:r>' + rp +
    '<w:fldChar w:fldCharType="separate"/></w:r><w:r>' + rp + '<w:t>' + shown + '</w:t></w:r><w:r>' + rp + '<w:fldChar w:fldCharType="end"/></w:r>';
}
// header/footer part: optional centered text paragraph + optional page-number paragraph (PAGE / NUMPAGES fields from the {n}/{N} template)
function hfXml(tag, text, numFmt, jc){
  var rp = '<w:rPr><w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:cs="' + FONT + '" w:eastAsia="' + FONT + '"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
  var pp = function(j){ return '<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="' + j + '"/></w:pPr>'; };
  var x = XMLH + '<w:' + tag + ' ' + NS + '>';
  if(text) x += '<w:p>' + pp('center') + '<w:r>' + rp + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  if(numFmt != null){
    x += '<w:p>' + pp(jc);
    String(numFmt).split(/(\{n\}|\{N\})/).forEach(function(s){
      if(s === '{n}') x += fieldRuns(rp, 'PAGE', '1'); else if(s === '{N}') x += fieldRuns(rp, 'NUMPAGES', '1');
      else if(s) x += '<w:r>' + rp + '<w:t xml:space="preserve">' + esc(s) + '</w:t></w:r>';
    });
    x += '</w:p>';
  }
  if(!text && numFmt == null) x += '<w:p/>';
  return x + '</w:' + tag + '>';
}

/* ---------- main ---------- */
async function exportDocx(opts){
  opts = opts || {};
  if(!window.SJNZip) throw new Error('SJNZip is not loaded');
  var pg = Object.assign({ size: 'A4', land: false, mt: 96, mb: 96, ml: 96, mr: 96 }, opts.page || {});
  var dims = SIZES[pg.size] || SIZES.A4;
  pg.w = num(pg.w) || (pg.land ? dims[1] : dims[0]); pg.h = num(pg.h) || (pg.land ? dims[0] : dims[1]);
  var hf = Object.assign({ header: '', footer: '', pos: 'none', fmt: '{n}' }, opts.hf || {});
  var textW = Math.max(100, pg.w - num(pg.ml) - num(pg.mr));
  var B = new Builder({ textW: textW });

  // parse the editor HTML inertly, strip anything active, then lay it out off-screen
  var parsed = new DOMParser().parseFromString('<body>' + String(opts.html || '') + '</body>', 'text/html');
  Array.prototype.forEach.call(parsed.querySelectorAll('script,style,iframe,object,embed,link,meta,form,svg,video,audio'), function(e){ e.remove(); });
  Array.prototype.forEach.call(parsed.querySelectorAll('img'), function(e){        // only embedded pictures: never fetch anything
    if(!/^data:image\//i.test(e.getAttribute('src') || '')) e.remove();
  });
  Array.prototype.forEach.call(parsed.querySelectorAll('*'), function(e){
    Array.prototype.slice.call(e.attributes).forEach(function(a){
      if(/^on/i.test(a.name) || /^(srcset|background|poster)$/i.test(a.name)) e.removeAttribute(a.name);
      else if(a.name === 'style' && /url\s*\(|@import|expression/i.test(a.value)) e.setAttribute('style', a.value.replace(/url\s*\([^)]*\)/gi, 'none'));
    });
  });
  var host = document.createElement('div');
  host.className = 'doc';
  host.style.cssText = 'position:fixed;left:-99999px;top:0;padding:0;margin:0;min-height:0;visibility:hidden;pointer-events:none;width:' + textW + 'px';
  Array.prototype.slice.call(parsed.body.childNodes).forEach(function(n){ host.appendChild(document.importNode(n, true)); });
  document.body.appendChild(host);
  B.host = host;
  var body = '';
  try{
    var imgs = Array.prototype.slice.call(host.querySelectorAll('img'));
    await Promise.all(imgs.map(function(im){ return im.complete && im.naturalWidth ? 0 : (im.decode ? im.decode().catch(function(){}) : 0); }));
    B.hostColor = rgb(getComputedStyle(host).color);
    body = flow(B, host, {});
  }finally{ host.remove(); }
  if(!body || /<\/w:tbl>$/.test(body)) body += '<w:p/>';                          // body may not end with a table

  // section: page size, margins, header/footer references
  var posH = /^t[lcr]$/.test(hf.pos), posF = /^b[lcr]$/.test(hf.pos), jcMap = { l: 'left', c: 'center', r: 'right' };
  var hdrText = String(hf.header || ''), ftrText = String(hf.footer || ''), parts = [], refs = '';
  if(hdrText || posH){
    parts.push({ name: 'word/header1.xml', xml: hfXml('hdr', hdrText, posH ? hf.fmt : null, jcMap[hf.pos.charAt(1)]), type: 'header' });
    refs += '<w:headerReference w:type="default" r:id="' + B.addRel(RT + 'header', 'header1.xml') + '"/>';
  }
  if(ftrText || posF){
    parts.push({ name: 'word/footer1.xml', xml: hfXml('ftr', ftrText, posF ? hf.fmt : null, jcMap[hf.pos.charAt(1)]), type: 'footer' });
    refs += '<w:footerReference w:type="default" r:id="' + B.addRel(RT + 'footer', 'footer1.xml') + '"/>';
  }
  var sect = '<w:sectPr>' + refs + '<w:pgSz w:w="' + tw(pg.w) + '" w:h="' + tw(pg.h) + '"' + (pg.land ? ' w:orient="landscape"' : '') + '/>' +
    '<w:pgMar w:top="' + tw(pg.mt) + '" w:right="' + tw(pg.mr) + '" w:bottom="' + tw(pg.mb) + '" w:left="' + tw(pg.ml) + '" w:header="690" w:footer="690" w:gutter="0"/>' +
    '<w:cols w:space="720"/></w:sectPr>';

  var docXml = XMLH + '<w:document ' + NS + '><w:body>' + body + sect + '</w:body></w:document>';
  var relXml = XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="' + RT + 'styles" Target="styles.xml"/><Relationship Id="rId2" Type="' + RT + 'numbering" Target="numbering.xml"/>' +
    '<Relationship Id="rId3" Type="' + RT + 'settings" Target="settings.xml"/>' +
    B.rels.map(function(r){ return '<Relationship Id="' + r.id + '" Type="' + r.type + '" Target="' + esc(r.target) + '"' + (r.ext ? ' TargetMode="External"' : '') + '/>'; }).join('') + '</Relationships>';
  var exts = {}; B.media.forEach(function(m){ exts[m.ext] = 1; });
  var ct = XMLH + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    Object.keys(exts).map(function(e){ return '<Default Extension="' + e + '" ContentType="image/' + e + '"/>'; }).join('') +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    parts.map(function(p){ return '<Override PartName="/' + p.name + '" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.' + p.type + '+xml"/>'; }).join('') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
  var iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  var files = [
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + RT + 'officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="' + RT + 'extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'word/document.xml', data: docXml },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml(B.numDefs) },
    { name: 'word/settings.xml', data: XMLH + '<w:settings ' + NS + '><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="th-TH" w:bidi="th-TH"/></w:settings>' },
    { name: 'word/_rels/document.xml.rels', data: relXml }
  ];
  parts.forEach(function(p){ files.push({ name: p.name, data: p.xml }); });
  B.media.forEach(function(m){ files.push({ name: 'word/media/' + m.name, data: m.bytes }); });
  files.push({ name: 'docProps/core.xml', data: XMLH + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>' + esc(opts.title || '') + '</dc:title><dc:creator>SJN Word</dc:creator><cp:lastModifiedBy>SJN Word</cp:lastModifiedBy>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified></cp:coreProperties>' });
  files.push({ name: 'docProps/app.xml', data: XMLH + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SJN Word</Application><DocSecurity>0</DocSecurity></Properties>' });
  var zip = await window.SJNZip.create(files);
  return new Blob([zip], { type: DOCX_MIME });
}
SJN.exportDocx = exportDocx;
})();
