(function(){
'use strict';
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var doc = $('#doc'), sheet = $('#sheet'), scaler = $('#scaler'), desk = $('#desk'), pagesEl = $('#pages'),
    deco = $('#deco'), inkSvg = $('#ink'), menu = $('#menu'), sizeEl = $('#size');
var KEY = 'sjn-word-v2', OLDKEY = 'sjn-word-v1', GAP = 14;
var SVGNS = 'http://www.w3.org/2000/svg';

/* ================= fonts ================= */
var THAI = ['TH Sarabun New','TH SarabunPSK','Sarabun','Prompt','Kanit','Mitr','Niramit','K2D','Krub','KoHo','Kodchasan',
  'Bai Jamjuree','Chakra Petch','Athiti','Mali','Pridi','Taviraj','Trirong','Maitree','Noto Sans Thai','Noto Serif Thai',
  'Anuphan','IBM Plex Sans Thai','Charmonman','Srisakdi','Fahkwang','Thasadith','Itim','Chonburi','Pattaya','Sriracha'];
var LATIN = ['Roboto','Open Sans','Lato','Montserrat','Poppins','Merriweather','Playfair Display','Lora','Source Serif 4',
  'Inconsolata','Caveat','Dancing Script','Arial','Times New Roman','Georgia','Courier New','Tahoma','Verdana'];
var SERIF = {'Pridi':1,'Taviraj':1,'Trirong':1,'Maitree':1,'Noto Serif Thai':1,'Charmonman':1,'Srisakdi':1,'Merriweather':1,
  'Playfair Display':1,'Lora':1,'Source Serif 4':1,'Georgia':1,'Times New Roman':1};
var MONO = {'Inconsolata':1,'Courier New':1};
var SIZES = [8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72];
function stackFor(n){
  var q = '"' + n + '"';
  if(n.indexOf('TH Sarabun') === 0) return q + ',"Sarabun",sans-serif';
  var g = SERIF[n] ? 'serif' : (MONO[n] ? 'monospace' : 'sans-serif');
  return THAI.indexOf(n) >= 0 ? q + ',"Sarabun",' + g : q + ',' + g;
}

/* ================= icons (24 grid) ================= */
var ICONS = {
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.500 10.900c.700.600 1 1.300 1 2.100h5c0-.800.300-1.500 1-2.100A6 6 0 0012 3z"/>',
  book:'<path d="M3 5.500c2.800-1 5.500-.900 9 1 3.500-1.900 6.200-2 9-1V19c-2.800-1-5.500-.900-9 1-3.500-1.900-6.200-2-9-1z"/><path d="M12 6.500V20"/>',
  share:'<circle cx="18" cy="5.500" r="2.500"/><circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="18.500" r="2.500"/><path d="M8.200 10.800l7.600-4M8.200 13.200l7.600 4"/>',
  undo:'<path d="M9 6L4 11l5 5"/><path d="M4 11h10.500a5 5 0 010 10H11"/>',
  redo:'<path d="M15 6l5 5-5 5"/><path d="M20 11H9.500a5 5 0 000 10H13"/>',
  chevup:'<path d="M5 15l7-7 7 7"/>',
  chevdown:'<path d="M5 9l7 7 7-7"/>',
  chevr:'<path d="M9 5l7 7-7 7"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  up:'<path d="M6 15l6-6 6 6"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  replace:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  bullets:'<circle class="acf" cx="4.500" cy="7" r="1.500"/><circle class="acf" cx="4.500" cy="12" r="1.500"/><circle class="acf" cx="4.500" cy="17" r="1.500"/><path d="M9 7h12M9 12h12M9 17h12"/>',
  numbering:'<text class="acf" x="2" y="9" font-size="7" stroke="none">1</text><text class="acf" x="2" y="14" font-size="7" stroke="none">2</text><text class="acf" x="2" y="19" font-size="7" stroke="none">3</text><path d="M9 7h12M9 12h12M9 17h12"/>',
  ltr:'<path class="ac" d="M3 8l3.500 4L3 16"/><path d="M15 5v14M19 5v14M15 5h-3.500a3.500 3.500 0 000 7H15"/>',
  rtl:'<path class="ac" d="M21 8l-3.500 4 3.500 4"/><path d="M11 5v14M15 5v14M11 5H7.500a3.500 3.500 0 000 7H11"/>',
  align:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignL:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignC:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignR:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  alignJ:'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  linesp:'<path class="ac" d="M6 4v16M3.500 6.500L6 4l2.500 2.500M3.500 17.500L6 20l2.500-2.500"/><path d="M12 6h9M12 10h9M12 14h9M12 18h9"/>',
  para:'<path d="M3 5h18M3 9h18M3 13h8"/><path d="M16 12v9M19 12v9M16 12h-2a2.500 2.500 0 000 5h2"/>',
  indent:'<path d="M4 5h16M12 9h8M12 13h8M4 17h16"/><path class="ac" d="M4 9l3.500 2.500L4 14z"/>',
  outdent:'<path d="M4 5h16M12 9h8M12 13h8M4 17h16"/><path class="ac" d="M8 9L4.500 11.500 8 14z"/>',
  special:'<path d="M4 5h16M4 9h16M4 13h16"/><path class="ac" d="M4 17l3 2-3 2M9 19h11"/>',
  styles:'<path d="M3 20L8.500 5 14 20M5.300 15h6.400"/><path class="ac" d="M15 18l5.500-5.500 2 2L17 20l-3 1z"/>',
  find:'<circle cx="10" cy="10" r="6.500"/><path d="M15 15l6 6"/>',
  highlighter:'<path d="M4 15l1.500-4.500 8-8 3.500 3.500-8 8z" transform="translate(2 1)"/><path class="ac" d="M12 5.500l3.500 3.500" transform="translate(2 1)"/>',
  clearfmt:'<path d="M3 19L8.500 5 14 19M5.300 14h6.400"/><path class="pk" d="M14 17l3.500-3.500 5 5-3 3h-3z"/>',
  table:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v14M15 5v14"/>',
  picture:'<rect x="3" y="5" width="18" height="14" rx="1.500"/><circle cx="8.500" cy="10" r="1.800"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  link:'<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1.500 1.500"/><path d="M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1.500-1.500"/>',
  hf:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 8h14M5 16h14"/>',
  pnum:'<rect x="5" y="3" width="14" height="18" rx="1"/><text x="12" y="14.500" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">#</text><path d="M9 18h6"/>',
  pbreak:'<path d="M7 3h10v6H7zM7 15h10v6H7z"/><path d="M2 12h3M9 12h2M13 12h2M19 12h3"/>',
  symbol:'<text x="12" y="18" font-size="17" text-anchor="middle" fill="currentColor" stroke="none">Ω</text>',
  date:'<rect x="4" y="5" width="16" height="15" rx="1.500"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  hr:'<path d="M3 12h18"/><path d="M7 7h10M7 17h10" opacity=".45"/>',
  pen:'<path d="M4 20l1-4.500L16 4.500l3.500 3.500L8.500 19z"/><path d="M13.500 7l3.500 3.500"/>',
  eraser:'<path d="M4 16l8-9 7 7-5 5H8z"/><path d="M9 11l7 7M12 21h9"/>',
  touch:'<path d="M9 12V5.500a1.500 1.500 0 013 0V11l4 1a2 2 0 011.500 2l-.500 4.500A3 3 0 0114 21h-2.500a3 3 0 01-2.400-1.200L5 14.500a1.600 1.600 0 012.600-1.800L9 14"/>',
  thick:'<path d="M4 6h16" stroke-width="1"/><path d="M4 11h16" stroke-width="2.500"/><path d="M4 17h16" stroke-width="5"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  margins:'<rect x="5" y="3" width="14" height="18" rx="1"/><rect x="8" y="6" width="8" height="12" stroke-dasharray="2 2"/>',
  orient:'<rect x="4" y="3" width="9" height="13" rx="1"/><path d="M15 9h5v10H9v-1"/><path d="M17 6l3 3-3 3"/>',
  psize:'<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M3 8v8M21 8v8M3 12h2M19 12h2"/>',
  wordcount:'<text x="12" y="10" font-size="7.500" text-anchor="middle" fill="currentColor" stroke="none">ABC</text><text x="12" y="19" font-size="7.500" text-anchor="middle" fill="currentColor" stroke="none">123</text>',
  spell:'<text x="10" y="11" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">ABC</text><path class="ac" d="M5 16l4 4 9-9"/>',
  speaker:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.500 6.500a8 8 0 010 11"/>',
  printlayout:'<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  mobile:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  zoom:'<circle cx="10" cy="10" r="6.500"/><path d="M15 15l6 6M7.500 10h5M10 7.500v5"/>',
  fitwidth:'<path d="M3 6v12M21 6v12"/><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3"/>',
  download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  print:'<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
  recent:'<circle cx="12" cy="12" r="8.500"/><path d="M12 7v5l3.500 2"/>',
  plug:'<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/>',
  install:'<path d="M12 3v10M8 9l4 4 4-4"/><rect x="4" y="15" width="16" height="6" rx="1.500"/>',
  newdoc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  open:'<path d="M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>',
  save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  rename:'<path d="M4 20l1-4.500L16 4.500l3.500 3.500L8.500 19z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.5"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="1.500"/><path d="M16 8V4H4v13h4"/>',
  code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 5l-4 14"/>',
  sparkle:'<path d="M10.500 3.500l1.900 5.600 5.600 1.900-5.600 1.900-1.900 5.600-1.900-5.600L3 11l5.600-1.900z"/><path d="M18.500 15l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8z"/>'
};
function ico(n){ return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
$$('[data-ico]').forEach(function(e){ e.innerHTML = ico(e.getAttribute('data-ico')); });

/* ================= state ================= */
var saved = null, snapT = null, saveT = null, countT = null, toastT = null, pillT = null;
var hist = [], hi = -1;
var zoom = 1, manualZoom = false;
var activeTab = 'home', ribbonCollapsed = false;
var view = 'print';           /* print | mobile */
var reading = false;
var title = 'เอกสารไม่มีชื่อ';
var docId = null, created = 0, lastSaved = 0;
var page = { size:'A4', land:false, mt:96, mb:96, ml:96, mr:96, w:794, h:1123 };
var hf = { header:'', footer:'', pos:'bc', fmt:'หน้า {n} / {N}' };
var PAGE_SIZES = { A4:[794,1123], A5:[559,794], A3:[1123,1587], B5:[665,945], Letter:[816,1056], Legal:[816,1344] };
var lastColor = '#e00000', lastHilite = '#ffff00';
var spVal = 1.27;
var strokes = [], inkUndo = [], inkRedo = [], inkTool = null, inkColor = '#000000', inkW = 3, touchDraw = false;

function toast(t){
  var e = $('#toast');
  e.textContent = t; e.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ e.classList.remove('show'); }, 2600);
}
function r2(n){ return Math.round(n * 100) / 100; }
function cleanHTML(){
  return doc.innerHTML.replace(/ data-pg=""/g, '').replace(/--pg: ?[\d.\-]+px;? ?/g, '').replace(/ style=" ?"/g, '');
}
function ensureBlock(){
  var h = doc.innerHTML.trim();
  if(!h || h === '<br>') doc.innerHTML = '<p><br></p>';
}

/* ================= selection ================= */
document.addEventListener('selectionchange', function(){
  var s = window.getSelection();
  if(!s.rangeCount) return;
  var r = s.getRangeAt(0);
  if(doc.contains(r.commonAncestorContainer)){ saved = r.cloneRange(); updateState(); if(aiOpenState) aiSoon(); }
});
function restore(){
  if(reading) return;
  doc.focus({preventScroll:true});
  if(saved){
    var s = window.getSelection();
    s.removeAllRanges(); s.addRange(saved);
  }
}
function getOffsets(){
  var s = window.getSelection();
  if(!s.rangeCount) return null;
  var r = s.getRangeAt(0);
  if(!doc.contains(r.commonAncestorContainer)) return null;
  var pre = document.createRange();
  pre.selectNodeContents(doc);
  pre.setEnd(r.startContainer, r.startOffset);
  var a = pre.toString().length;
  return [a, a + r.toString().length];
}
function caretToEnd(){
  var r = document.createRange();
  r.selectNodeContents(doc); r.collapse(false);
  var s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
  saved = r.cloneRange();
}
function setOffsets(o){
  if(!o){ caretToEnd(); return; }
  var w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  var n, pos = 0, sN = null, sO = 0, eN = null, eO = 0;
  while((n = w.nextNode())){
    var l = n.nodeValue.length;
    if(sN === null && pos + l >= o[0]){ sN = n; sO = o[0] - pos; }
    if(eN === null && pos + l >= o[1]){ eN = n; eO = o[1] - pos; break; }
    pos += l;
  }
  if(!sN){ caretToEnd(); return; }
  if(!eN){ eN = sN; eO = sO; }
  var r = document.createRange();
  r.setStart(sN, sO); r.setEnd(eN, eO);
  var s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
  saved = r.cloneRange();
}

/* ================= history ================= */
function updateUndo(){
  var inkMode = inkActive();
  $('#btnUndo').disabled = inkMode ? !inkUndo.length : hi <= 0;
  $('#btnRedo').disabled = inkMode ? !inkRedo.length : hi >= hist.length - 1;
}
function snap(){
  var s = { html: cleanHTML(), sel: getOffsets() };
  if(hi >= 0 && hist[hi].html === s.html){ hist[hi].sel = s.sel; updateUndo(); return; }
  hist.length = hi + 1;
  hist.push(s);
  if(hist.length > 200) hist.shift();
  hi = hist.length - 1;
  updateUndo();
  scheduleSave();
}
function flushSnap(){ if(snapT){ clearTimeout(snapT); snapT = null; snap(); } }
function scheduleSnap(){
  clearTimeout(snapT);
  snapT = setTimeout(function(){ snapT = null; snap(); }, 450);
  refreshSoon();
}
function afterCommand(){
  clearTimeout(snapT); snapT = null;
  snap(); updateState(); refreshSoon();
}
function loadState(s){
  doc.innerHTML = s.html;
  ensureBlock();
  if(!reading){ doc.focus({preventScroll:true}); setOffsets(s.sel); }
  updateState(); refreshSoon(); scheduleSave(); updateUndo();
}
function undo(){
  if(inkActive()){ inkStep(inkUndo, inkRedo); return; }
  flushSnap(); if(hi <= 0) return; hi--; loadState(hist[hi]);
}
function redo(){
  if(inkActive()){ inkStep(inkRedo, inkUndo); return; }
  flushSnap(); if(hi >= hist.length - 1) return; hi++; loadState(hist[hi]);
}

/* ================= autosave ================= */
function setSaveState(t){ $('#saveState').textContent = t; }
function scheduleSave(){
  setSaveState('Saving…');
  clearTimeout(saveT);
  saveT = setTimeout(save, 600);
}
function inkData(){
  return strokes.map(function(s){ return { t:s.t, c:s.c, w:s.w, pts:s.pts.map(function(p){ return [Math.round(p[0]*10)/10, Math.round(p[1]*10)/10]; }) }; });
}
function snapshotRec(){
  return { id:docId, title:title, html:cleanHTML(), page:JSON.parse(JSON.stringify(page)), hf:JSON.parse(JSON.stringify(hf)),
    ink:inkData(), created:created, updated:Date.now() };
}
function save(){
  clearTimeout(saveT); saveT = null;
  if(!docId) return Promise.resolve();
  var rec = snapshotRec();
  return SJNStore.put(rec).then(function(){
    lastSaved = rec.updated;
    if(!saveT) setSaveState(SJNStore.isPersistent() ? 'Saved' : 'Saved (temporary)');
  }, function(){ setSaveState('Not saved'); });
}
function flushSave(){ if(saveT) save(); }
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') flushSave(); });
window.addEventListener('pagehide', flushSave);
function setTitle(t){
  title = t || 'เอกสารไม่มีชื่อ';
  $('#ttlText').textContent = title;
  document.title = title + ' – SJN Word';
  scheduleSave();
}

/* ================= editing commands ================= */
function setCSSMode(on){ try{ document.execCommand('styleWithCSS', false, on); }catch(e){} }
doc.addEventListener('focus', function(){
  setCSSMode(true);
  try{ document.execCommand('defaultParagraphSeparator', false, 'p'); }catch(e){}
});
function cmd(name, val){
  if(reading) return false;
  flushSnap();
  restore();
  var ok = false;
  try{ ok = document.execCommand(name, false, val == null ? null : val); }catch(e){}
  afterCommand();
  return ok;
}
function applyInline(props, set){
  if(reading) return;
  flushSnap(); restore();
  var sel = window.getSelection();
  if(!sel.rangeCount) return;
  var r = sel.getRangeAt(0);
  if(sel.isCollapsed){
    var p = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer, span;
    if(p && p.tagName === 'SPAN' && p.textContent === '​' && doc.contains(p)){ span = p; }
    else{ span = document.createElement('span'); span.textContent = '​'; r.insertNode(span); }
    set(span);
    var nr = document.createRange();
    nr.setStart(span.firstChild, 1); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
  }else{
    setCSSMode(false);
    try{ document.execCommand('fontSize', false, '7'); }catch(e){}
    setCSSMode(true);
    var spans = $$('font[size="7"]', doc).map(function(f){
      var s = document.createElement('span');
      while(f.firstChild) s.appendChild(f.firstChild);
      $$('*', s).forEach(function(e){ if(e.style) props.forEach(function(pn){ e.style[pn] = ''; }); });
      set(s);
      f.parentNode.replaceChild(s, f);
      return s;
    });
    if(spans.length){
      var nr2 = document.createRange();
      nr2.setStartBefore(spans[0]); nr2.setEndAfter(spans[spans.length - 1]);
      sel.removeAllRanges(); sel.addRange(nr2);
    }
  }
  afterCommand();
}
function applyFont(n){ applyInline(['fontFamily'], function(s){ s.style.fontFamily = stackFor(n); }); }
function applySize(pt){
  pt = Math.max(1, Math.min(400, pt));
  applyInline(['fontSize'], function(s){ s.style.fontSize = pt + 'pt'; });
  sizeEl.value = fmtSize(pt);
}
function fmtSize(n){ return String(Math.round(n * 10) / 10); }
function stepSize(dir){
  var cur = parseFloat(sizeEl.value) || 16, next;
  if(dir > 0){
    next = SIZES.filter(function(s){ return s > cur; })[0];
    if(next == null) next = cur + 8;
  }else{
    var sm = SIZES.filter(function(s){ return s < cur; });
    next = sm.length ? sm[sm.length - 1] : Math.max(1, cur - 1);
  }
  applySize(next);
}
function commitSize(){
  var v = parseFloat(String(sizeEl.value).replace(',', '.'));
  if(isFinite(v) && v > 0) applySize(v); else updateState();
}
sizeEl.addEventListener('keydown', function(e){
  if(e.key === 'Enter'){ e.preventDefault(); commitSize(); doc.focus({preventScroll:true}); }
});
sizeEl.addEventListener('change', commitSize);
sizeEl.addEventListener('focus', function(){ sizeEl.select(); });

function applyColor(c){
  lastColor = c || '#1b1b1b';
  $('#colBar').style.setProperty('--c', c || '#e00000');
  setCSSMode(true);
  cmd('foreColor', lastColor);
}
function applyHilite(c){
  setCSSMode(true);
  if(c){ lastHilite = c; $('#hlBar').style.setProperty('--c', c); }
  else $('#hlBar').style.setProperty('--c', '#ffffff');
  if(!cmd('hiliteColor', c || 'transparent')) cmd('backColor', c || 'transparent');
}
function clearFormat(){
  flushSnap(); restore();
  try{ document.execCommand('removeFormat'); }catch(e){}
  try{ document.execCommand('formatBlock', false, 'P'); }catch(e){}
  selectedBlocks().forEach(function(b){ b.removeAttribute('style'); b.removeAttribute('dir'); });
  afterCommand();
}

/* ---- blocks and paragraph helpers ---- */
function blocksIn(range){
  var out = [];
  if(!range) return out;
  $$('p,h1,h2,h3,li,td,th,div', doc).forEach(function(b){
    if(b.classList.contains('pbreak')) return;
    if(range.intersectsNode(b)) out.push(b);
  });
  return out.filter(function(b){ return !out.some(function(o){ return o !== b && b.contains(o); }); });
}
function selectedBlocks(){
  restore();
  var s = window.getSelection();
  if(!s.rangeCount) return [];
  var bl = blocksIn(s.getRangeAt(0));
  if(!bl.length){
    try{ document.execCommand('formatBlock', false, 'P'); }catch(e){}
    var s2 = window.getSelection();
    if(s2.rangeCount) bl = blocksIn(s2.getRangeAt(0));
  }
  return bl;
}
function editBlocks(fn){
  flushSnap();
  selectedBlocks().forEach(fn);
  afterCommand();
}
var BLOCK_DEFAULTS = { P:[0,6], H1:[12,6], H2:[10,6], H3:[8,4] };
var UNIT_CM = { cm:1, mm:0.1, pt:2.54/72, px:2.54/96, 'in':2.54 };
function parseLen(v){
  var m = /^(-?[\d.]+)\s*(cm|mm|pt|px|in)?$/.exec(String(v || '').trim());
  return m ? { n: parseFloat(m[1]), u: m[2] || 'px' } : null;
}
function toCm(v){ var p = parseLen(v); return p ? p.n * UNIT_CM[p.u] : 0; }
function toPt(v, def){ var p = parseLen(v); return p ? p.n * UNIT_CM[p.u] * 72 / 2.54 : def; }
function sideProp(b, side){ return (b.tagName === 'TD' || b.tagName === 'TH' ? 'padding' : 'margin') + side; }
function readPara(){
  var b = blocksIn(saved)[0];
  var o = { left:0, right:0, indent:0, before:0, after:6, line:1.25, dir:'ltr' };
  if(!b) return o;
  var d = BLOCK_DEFAULTS[b.tagName] || [0, 0];
  o.left = toCm(b.style[sideProp(b, 'Left')]);
  o.right = toCm(b.style[sideProp(b, 'Right')]);
  o.indent = toCm(b.style.textIndent);
  o.before = b.style.marginTop ? toPt(b.style.marginTop, d[0]) : d[0];
  o.after = b.style.marginBottom ? toPt(b.style.marginBottom, d[1]) : d[1];
  var lh = parseFloat(b.style.lineHeight);
  if(isFinite(lh)) o.line = lh;
  try{ o.dir = getComputedStyle(b).direction; }catch(e){}
  return o;
}
function paraMode(){ var i = readPara().indent; return i > 0.001 ? 'first' : (i < -0.001 ? 'hanging' : 'none'); }
function setParaMode(md){
  editBlocks(function(b){
    if(md === 'none'){ b.style.textIndent = ''; }
    else if(md === 'first'){ b.style.textIndent = spVal + 'cm'; }
    else{
      b.style.textIndent = (-spVal) + 'cm';
      var p = sideProp(b, 'Left');
      if(toCm(b.style[p]) < spVal) b.style[p] = spVal + 'cm';
    }
  });
}
function indentBlocks(dir){
  var bl = selectedBlocks();
  if(bl.some(function(b){ return b.tagName === 'LI'; })){ cmd(dir > 0 ? 'indent' : 'outdent'); return; }
  flushSnap();
  bl.forEach(function(b){
    var p = sideProp(b, 'Left');
    var v = Math.max(0, r2(toCm(b.style[p]) + dir * 1.27));
    b.style[p] = v ? v + 'cm' : '';
  });
  afterCommand();
}
function setDir(d){ editBlocks(function(b){ b.setAttribute('dir', d); }); }
function atParaStart(){
  var s = window.getSelection();
  if(!s.rangeCount || !s.isCollapsed) return null;
  var r = s.getRangeAt(0);
  var n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
  var b = n && n.closest ? n.closest('p,h1,h2,h3,div') : null;
  if(!b || b === doc || !doc.contains(b)) return null;
  var pre = document.createRange();
  pre.selectNodeContents(b); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().replace(/​/g, '').length === 0 ? b : null;
}
function applyLineSpacing(v){ editBlocks(function(b){ b.style.lineHeight = String(v); }); }

/* ---- styles gallery ---- */
var STYLE_PROPS = ['fontSize','fontWeight','fontStyle','color','textAlign','marginTop','marginBottom','marginLeft','marginRight','textIndent','lineHeight','letterSpacing','fontFamily'];
var STYLES = [
  ['Normal','P',{},'font-size:16px'],
  ['No Spacing','P',{marginTop:'0pt',marginBottom:'0pt',lineHeight:'1'},'font-size:16px'],
  ['Heading 1','H1',{},'font-size:24px;font-weight:700'],
  ['Heading 2','H2',{},'font-size:20px;font-weight:700'],
  ['Heading 3','H3',{},'font-size:18px;font-weight:700'],
  ['Title','P',{fontSize:'28pt',fontWeight:'700',marginBottom:'8pt'},'font-size:26px;font-weight:700'],
  ['Subtitle','P',{fontSize:'18pt',color:'#595959',marginBottom:'8pt'},'font-size:19px;color:#6a6a6a'],
  ['Quote','P',{fontStyle:'italic',textAlign:'center',marginLeft:'1.27cm',marginRight:'1.27cm',color:'#404040'},'font-size:17px;font-style:italic']
];
function applyStyle(name){
  var s = STYLES.filter(function(x){ return x[0] === name; })[0];
  if(!s) return;
  flushSnap(); restore();
  try{ document.execCommand('formatBlock', false, s[1]); }catch(e){}
  selectedBlocks().forEach(function(b){
    STYLE_PROPS.forEach(function(p){ b.style[p] = ''; });
    Object.keys(s[2]).forEach(function(k){ b.style[k] = s[2][k]; });
  });
  afterCommand();
}

/* ---- tables ---- */
function insertTable(rows, cols){
  var h = '<table><tbody>';
  for(var i = 0; i < rows; i++){
    h += '<tr>';
    for(var j = 0; j < cols; j++) h += '<td><br></td>';
    h += '</tr>';
  }
  h += '</tbody></table><p><br></p>';
  cmd('insertHTML', h);
}
function cellOf(){
  if(!saved) return null;
  var n = saved.startContainer;
  if(n.nodeType === 3) n = n.parentElement;
  var c = n && n.closest ? n.closest('td,th') : null;
  return c && doc.contains(c) ? c : null;
}
function tableOp(op){
  var cell = cellOf();
  if(!cell) return;
  flushSnap();
  var row = cell.parentElement, table = cell.closest('table'), idx = cell.cellIndex;
  if(op === 'row+'){
    var nr = document.createElement('tr');
    for(var i = 0; i < row.cells.length; i++){ var td = document.createElement('td'); td.innerHTML = '<br>'; nr.appendChild(td); }
    row.parentNode.insertBefore(nr, row.nextSibling);
  }else if(op === 'col+'){
    Array.prototype.forEach.call(table.rows, function(r){
      var td2 = document.createElement('td'); td2.innerHTML = '<br>';
      var ref = r.cells[idx];
      if(ref) ref.parentNode.insertBefore(td2, ref.nextSibling); else r.appendChild(td2);
    });
  }else if(op === 'row-'){
    if(table.rows.length > 1) row.remove(); else table.remove();
  }else if(op === 'col-'){
    if(row.cells.length > 1) Array.prototype.forEach.call(table.rows, function(r){ if(r.cells[idx]) r.cells[idx].remove(); });
    else table.remove();
  }else if(op === 'del'){ table.remove(); }
  ensureBlock();
  afterCommand();
}

/* ---- link, picture, break ---- */
function applyLink(url, text){
  url = (url || '').trim();
  if(!url) return;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  var esc = function(s){ return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  if(!saved || saved.collapsed) cmd('insertHTML', '<a href="' + esc(url) + '">' + esc(text || url) + '</a>&nbsp;');
  else cmd('createLink', url);
}
function insertImage(file){
  if(!file) return;
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var alpha = /png|gif|webp|svg/.test(file.type);
      cmd('insertImage', c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = function(){ toast('Cannot open this picture'); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
$('#imgInput').addEventListener('change', function(e){ insertImage(e.target.files[0]); e.target.value = ''; });
function insertPageBreak(){ cmd('insertHTML', '<div class="pbreak" contenteditable="false"></div><p><br></p>'); }

/* ================= pagination ================= */
var UNIT_SEL = 'p,h1,h2,h3,li,hr,tr,.pbreak';
var pgEls = [];
function clearPg(){
  pgEls.forEach(function(e){
    e.removeAttribute('data-pg'); e.style.removeProperty('--pg');
    if(e.getAttribute('style') === '') e.removeAttribute('style');
  });
  pgEls = [];
}
function isUnit(u){
  if(u.tagName === 'TR') return true;
  if(u.parentElement && u.parentElement.closest('tr')) return false;
  return !u.querySelector(UNIT_SEL);
}
function markPg(u, s){
  var targets = u.tagName === 'TR' ? Array.prototype.slice.call(u.cells) : [u];
  targets.forEach(function(t){
    t.setAttribute('data-pg', '');
    t.style.setProperty('--pg', r2(s) + 'px');
    pgEls.push(t);
  });
}
var sheetH = 1123;
function paginate(){
  clearPg();
  doc.style.minHeight = '';
  var H = page.h, P = H + GAP, mt = page.mt, mb = page.mb, area = H - mt - mb, pages = 1;
  if(view === 'mobile'){
    sheetH = Math.max(doc.offsetHeight, 200);
    buildPages(1); renderDeco(1); layoutAll();
    return;
  }
  var z = zoom || 1, base = doc.getBoundingClientRect().top;
  var natural = doc.offsetHeight;
  var items = $$(UNIT_SEL, doc).filter(isUnit).map(function(u){
    var r = u.getBoundingClientRect();
    return { u:u, t:(r.top - base) / z, b:(r.bottom - base) / z };
  });
  var extra = 0, force = false;
  items.forEach(function(it){
    var t = it.t + extra, b = it.b + extra;
    if(it.u.classList.contains('pbreak')){ force = true; return; }
    var h = b - t;
    var k = Math.max(0, Math.floor((t - mt + 0.5) / P));
    var A = k * P + mt, B = k * P + H - mb, target = null;
    if(t > B - 1 || (b > B + 0.5 && (h <= area + 0.5 || B - t < Math.min(h, 60)))){
      target = (k + 1) * P + mt;
    }
    if(target == null && force){
      if(t - A > 0.5) target = (k + 1) * P + mt;
    }
    if(target != null && target - t > 0.5){
      var s = target - t;
      markPg(it.u, s);
      extra += s; t += s;
    }
    force = false;
  });
  var total = natural + extra;
  pages = Math.max(1, Math.ceil((total + GAP) / P - 1e-6));
  sheetH = pages * P - GAP;
  doc.style.minHeight = sheetH + 'px';
  buildPages(pages); renderDeco(pages); layoutAll();
  var pc = $('#pill');
  pc.dataset.n = pages;
}
function buildPages(n){
  pagesEl.innerHTML = '';
  if(view === 'mobile') return;
  for(var k = 0; k < n; k++){
    var d = document.createElement('div');
    d.className = 'pg';
    d.style.top = (k * (page.h + GAP)) + 'px';
    d.style.height = page.h + 'px';
    pagesEl.appendChild(d);
  }
}
function fmtPage(n, N){ return hf.fmt.replace('{n}', n).replace('{N}', N); }
function renderDeco(n){
  deco.innerHTML = '';
  if(view === 'mobile') return;
  for(var k = 0; k < n; k++){
    var d = document.createElement('div');
    d.className = 'dp';
    d.style.top = (k * (page.h + GAP)) + 'px';
    d.style.height = page.h + 'px';
    var pad = 'padding-left:' + page.ml + 'px;padding-right:' + page.mr + 'px';
    var h = '';
    if(hf.header) h += '<div class="hd" style="' + pad + '">' + escapeHTML(hf.header) + '</div>';
    if(hf.footer) h += '<div class="ft" style="' + pad + '">' + escapeHTML(hf.footer) + '</div>';
    if(hf.pos && hf.pos !== 'none') h += '<div class="pn ' + hf.pos + '" style="' + pad + '">' + escapeHTML(fmtPage(k + 1, n)) + '</div>';
    d.innerHTML = h;
    deco.appendChild(d);
  }
}
function escapeHTML(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function pageCount(){ return Math.max(1, Math.round((sheetH + GAP) / (page.h + GAP))); }

/* ================= layout, zoom ================= */
function applyPage(){
  var d = PAGE_SIZES[page.size] || PAGE_SIZES.A4;
  page.w = page.land ? d[1] : d[0];
  page.h = page.land ? d[0] : d[1];
  if(view === 'mobile'){
    sheet.style.width = Math.max(280, desk.clientWidth - 32) + 'px';
    doc.style.padding = '24px 22px';
  }else{
    sheet.style.width = page.w + 'px';
    doc.style.padding = page.mt + 'px ' + page.mr + 'px ' + page.mb + 'px ' + page.ml + 'px';
  }
}
function layoutAll(){
  sheet.style.transform = 'scale(' + zoom + ')';
  var w = view === 'mobile' ? Math.max(280, desk.clientWidth - 32) : page.w;
  scaler.style.width = (w * zoom) + 'px';
  scaler.style.height = (sheetH * zoom) + 'px';
  inkSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + sheetH);
  $('#zoomLbl').textContent = Math.round(zoom * 100) + '%';
}
function fitZoom(){
  var w = desk.clientWidth - 32;
  return Math.max(0.4, Math.min(1.25, w / page.w));
}
function setZoom(z, manual){
  if(view === 'mobile') z = 1;
  zoom = Math.max(0.4, Math.min(2.5, Math.round(z * 100) / 100));
  if(manual) manualZoom = true;
  layoutAll();
  refreshSoon();
}
function refreshSoon(){
  clearTimeout(countT);
  countT = setTimeout(function(){ paginate(); showPill(); }, 220);
}
function currentPage(){
  var P = (page.h + GAP) * zoom;
  var y = desk.scrollTop + desk.clientHeight * 0.35 - scaler.offsetTop;
  return Math.max(1, Math.min(pageCount(), Math.floor(y / P) + 1));
}
function showPill(force){
  if(view === 'mobile') return;
  var p = $('#pill');
  p.textContent = 'Page ' + currentPage() + ' of ' + pageCount();
  if(!force) return;
  p.classList.add('show');
  clearTimeout(pillT);
  pillT = setTimeout(function(){ p.classList.remove('show'); }, 1300);
}
desk.addEventListener('scroll', function(){ showPill(true); }, {passive:true});
/* two-finger pinch zoom */
var pinch = null;
function dist(t){ var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
desk.addEventListener('touchstart', function(e){ if(e.touches.length === 2) pinch = { d: dist(e.touches), z: zoom }; }, {passive:true});
desk.addEventListener('touchmove', function(e){
  if(pinch && e.touches.length === 2){
    if(e.cancelable) e.preventDefault();
    setZoom(pinch.z * dist(e.touches) / pinch.d, true);
  }
}, {passive:false});
desk.addEventListener('touchend', function(e){ if(e.touches.length < 2) pinch = null; }, {passive:true});

function setView(v){
  view = v;
  sheet.className = 'sheet ' + v;
  $$('[data-act="v-print"]').forEach(function(b){ b.setAttribute('aria-pressed', v === 'print'); });
  $$('[data-act="v-mobile"]').forEach(function(b){ b.setAttribute('aria-pressed', v === 'mobile'); });
  applyPage();
  if(v === 'mobile') zoom = 1; else if(!manualZoom) zoom = fitZoom();
  paginate();
}

/* ================= toolbar state ================= */
var TOGGLES = ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList'];
function updateState(){
  TOGGLES.forEach(function(c){
    var b = $('[data-cmd="' + c + '"]');
    if(!b) return;
    var v = false;
    try{ v = document.queryCommandState(c); }catch(e){}
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
  });
  var s = window.getSelection();
  if(!s.rangeCount) return;
  var n = s.anchorNode;
  if(!n || !doc.contains(n)) return;
  if(n.nodeType === 3) n = n.parentElement;
  if(!n) return;
  var cs = getComputedStyle(n);
  var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  $('#fontLbl').textContent = fam;
  if(document.activeElement !== sizeEl) sizeEl.value = fmtSize(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2);
  var dir = cs.direction;
  $('[data-act="ltr"]').setAttribute('aria-pressed', dir !== 'rtl');
  $('[data-act="rtl"]').setAttribute('aria-pressed', dir === 'rtl');
}

/* ================= popup menus ================= */
var cur = null, stack = [], menuBtn = null;
function el(tag, cls, html){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html != null) e.innerHTML = html;
  return e;
}
function row(icon, label, fn, o){
  o = o || {};
  var b = el('button', 'mi' + (o.on ? ' on' : ''));
  b.type = 'button';
  b.innerHTML = (icon ? '<span class="mic">' + ico(icon) + '</span>' : '') + '<span class="ml">' + label + '</span>' +
    (o.trail ? '<span class="tr">' + o.trail + '</span>' : (o.on ? '<span class="tr">' + ico('check') + '</span>' : ''));
  b.addEventListener('click', function(){ if(!o.keep) closeMenu(); fn(); });
  return b;
}
function renderMenu(){
  menu.innerHTML = '';
  if(cur.title){
    var h = el('div', 'mt');
    if(stack.length){
      var b = el('button', 'back', ico('back') + '<span>' + cur.title + '</span>');
      b.type = 'button'; b.addEventListener('click', goBack);
      h.appendChild(b);
    }else h.textContent = cur.title;
    menu.appendChild(h);
    menu.appendChild(el('div', 'msep'));
  }
  cur.fn(menu);
}
function nav(fn, t){ stack.push(cur); cur = { fn:fn, title:t }; renderMenu(); placeMenu(); }
function goBack(){ cur = stack.pop(); renderMenu(); placeMenu(); }
function rerender(){ var top = menu.scrollTop; renderMenu(); menu.scrollTop = top; }
function closeMenu(){
  if(menu.hidden) return;
  menu.hidden = true;
  if(menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn = null; stack = []; cur = null;
}
function openMenu(btn, v){
  if(menuBtn === btn && !menu.hidden){ closeMenu(); return; }
  closeMenu();
  stack = []; cur = { fn:v.fn, title:v.title };
  menu.className = 'menu ' + (v.cls || '');
  menuBtn = btn;
  renderMenu();
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  placeMenu();
}
function placeMenu(){
  if(!menuBtn) return;
  var r = menuBtn.getBoundingClientRect();
  var vw = window.innerWidth, vh = window.innerHeight;
  menu.style.maxHeight = Math.max(220, vh - r.bottom - 14) + 'px';
  var mw = menu.offsetWidth;
  menu.style.left = Math.min(Math.max(8, r.left), vw - mw - 8) + 'px';
  menu.style.top = (r.bottom + 4) + 'px';
}
function stepper(m, label, unit, get, step, min, max, write, refs){
  var rw = el('div', 'prow');
  rw.appendChild(el('span', 'pl', label));
  var box = el('div', 'pstep');
  var dec = el('button', null, '−'), inc = el('button', null, '+'), inp = el('input');
  dec.type = 'button'; inc.type = 'button';
  dec.setAttribute('aria-label', 'Decrease ' + label); inc.setAttribute('aria-label', 'Increase ' + label);
  inp.inputMode = 'decimal'; inp.setAttribute('aria-label', label);
  function show(){ inp.value = String(r2(get())); }
  function commit(v){
    if(!isFinite(v)){ show(); return; }
    write(Math.max(min, Math.min(max, r2(v))));
    if(refs) refs.forEach(function(f){ f(); }); else show();
  }
  dec.addEventListener('click', function(){ commit(get() - step); });
  inc.addEventListener('click', function(){ commit(get() + step); });
  inp.addEventListener('change', function(){ commit(parseFloat(inp.value.replace(',', '.'))); });
  inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); } });
  box.appendChild(dec); box.appendChild(inp); box.appendChild(inc);
  rw.appendChild(box);
  rw.appendChild(el('span', 'pu', unit));
  show();
  if(refs) refs.push(show);
  m.appendChild(rw);
}
function mix(hex, t, w){
  var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  var f = function(c){ return Math.round(c + (w - c) * t); };
  return '#' + [f(r), f(g), f(b)].map(function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
}
var THEME_C = ['#ffffff','#000000','#e7e6e6','#44546a','#4472c4','#ed7d31','#a5a5a5','#ffc000','#5b9bd5','#70ad47'];
var STD_C = ['#c00000','#ff0000','#ffc000','#ffff00','#92d050','#00b050','#00b0f0','#0070c0','#002060','#7030a0'];
var HL_C = ['#ffff00','#00ff00','#00ffff','#ff00ff','#0000ff','#ff0000','#000080','#008080','#008000','#800080','#800000','#808000','#808080','#c0c0c0','#000000'];
function swatches(m, list, cls, pick){
  var g = el('div', 'swg ' + (cls || ''));
  list.forEach(function(c){
    var b = el('button'); b.type = 'button';
    b.style.background = c; b.setAttribute('aria-label', c);
    b.addEventListener('click', function(){ closeMenu(); pick(c); });
    g.appendChild(b);
  });
  m.appendChild(g);
}
function colorMenu(m, autoLabel, pick){
  m.appendChild(row(null, autoLabel, function(){ pick(null); }));
  m.appendChild(el('div', 'mh', 'Theme Colors'));
  var rows = [THEME_C];
  [[.8,255],[.6,255],[.4,255],[.25,0],[.5,0]].forEach(function(q){
    rows.push(THEME_C.map(function(c, i){
      if(i === 0) return mix(c, [.05,.15,.25,.35,.5][rows.length - 1], 0);
      if(i === 1) return mix(c, [.5,.35,.25,.15,.05][rows.length - 1], 255);
      return mix(c, q[0], q[1]);
    }));
  });
  rows.forEach(function(r){ swatches(m, r, '', pick); });
  m.appendChild(el('div', 'mh', 'Standard Colors'));
  swatches(m, STD_C, '', pick);
  var rw = el('div', 'mrow');
  rw.appendChild(el('span', null, 'More Colors'));
  var inp = el('input'); inp.type = 'color'; inp.setAttribute('aria-label', 'Custom color');
  inp.addEventListener('input', function(){ pick(inp.value); });
  rw.appendChild(inp);
  m.appendChild(rw);
}

var VIEWS = {};
VIEWS.font = { title:'Font', cls:'wide', fn:function(m){
  var cf = $('#fontLbl').textContent;
  [['Thai fonts', THAI, true], ['English and system fonts', LATIN, false]].forEach(function(sec){
    m.appendChild(el('div', 'mh', sec[0]));
    sec[1].forEach(function(n){
      var b = row(null, '<span class="fs" style="font-family:' + stackFor(n).replace(/"/g, "'") + '">' + (sec[2] ? 'สวัสดี Hello' : 'Hello Aa') + '</span>',
        function(){ applyFont(n); }, { on: n === cf });
      var fnm = el('span', 'fn', n);
      b.insertBefore(fnm, b.querySelector('.tr'));
      m.appendChild(b);
    });
  });
  setTimeout(function(){ var on = m.querySelector('.on'); if(on) m.scrollTop = Math.max(0, on.offsetTop - 120); }, 0);
}};
VIEWS.sizes = { title:'', fn:function(m){
  var c = parseFloat(sizeEl.value);
  SIZES.forEach(function(s){ m.appendChild(row(null, String(s), function(){ applySize(s); }, { on: s === c })); });
}};
VIEWS.color = { title:'Font Color', cls:'pal', fn:function(m){ colorMenu(m, 'Automatic', applyColor); }};
VIEWS.hilite = { title:'Highlight Color', cls:'pal', fn:function(m){
  m.appendChild(row(null, 'No Color', function(){ applyHilite(null); }));
  swatches(m, HL_C, 'hl', applyHilite);
}};
VIEWS.more = { title:'More Formatting', fn:function(m){
  m.appendChild(row(null, 'Subscript', function(){ cmd('subscript'); }));
  m.appendChild(row(null, 'Superscript', function(){ cmd('superscript'); }));
  m.appendChild(row(null, 'Small Caps', function(){ applyInline(['fontVariant'], function(s){ s.style.fontVariant = 'small-caps'; }); }));
  m.appendChild(row(null, 'All Caps', function(){ applyInline(['textTransform'], function(s){ s.style.textTransform = 'uppercase'; }); }));
  m.appendChild(row(null, 'Character Spacing: Expanded', function(){ applyInline(['letterSpacing'], function(s){ s.style.letterSpacing = '1pt'; }); }));
  m.appendChild(row(null, 'Character Spacing: Normal', function(){ applyInline(['letterSpacing','fontVariant','textTransform'], function(s){ s.style.letterSpacing = ''; s.style.fontVariant = ''; s.style.textTransform = ''; }); }));
}};
VIEWS.align = { title:'Alignment', fn:function(m){
  var r = el('div', 'irow');
  [['justifyLeft','alignL','Align left'],['justifyCenter','alignC','Center'],['justifyRight','alignR','Align right'],['justifyFull','alignJ','Justify']].forEach(function(a){
    var on = false;
    try{ on = document.queryCommandState(a[0]); }catch(e){}
    var b = el('button', 'ibtn' + (on ? ' on' : ''), ico(a[1]));
    b.type = 'button'; b.title = a[2]; b.setAttribute('aria-label', a[2]);
    b.addEventListener('click', function(){ closeMenu(); cmd(a[0]); });
    r.appendChild(b);
  });
  m.appendChild(r);
}};
VIEWS.spacing = { title:'Line Spacing', fn:function(m){
  var c = readPara().line;
  [['1.0',1],['1.15',1.15],['1.25 (default)',1.25],['1.5',1.5],['2.0',2],['2.5',2.5],['3.0',3]].forEach(function(s){
    m.appendChild(row(null, s[0], function(){ applyLineSpacing(s[1]); }, { on: Math.abs(c - s[1]) < 0.01 }));
  });
  m.appendChild(el('div', 'msep'));
  m.appendChild(row(null, 'Add Space Before Paragraph', function(){ editBlocks(function(b){ b.style.marginTop = '12pt'; }); }));
  m.appendChild(row(null, 'Remove Space After Paragraph', function(){ editBlocks(function(b){ b.style.marginBottom = '0pt'; }); }));
}};
VIEWS.para = { title:'Paragraph', fn:function(m){
  var r = el('div', 'irow');
  [['outdent','Decrease indent',-1],['indent','Increase indent',1]].forEach(function(a){
    var b = el('button', 'ibtn', ico(a[0]));
    b.type = 'button'; b.title = a[1]; b.setAttribute('aria-label', a[1]);
    b.addEventListener('click', function(){ indentBlocks(a[2]); });
    r.appendChild(b);
  });
  m.appendChild(r);
  m.appendChild(row('special', 'Special Indent', function(){ nav(VIEWS.special.fn, 'Special Indent'); }, { keep:true, trail:ico('chevr') }));
  m.appendChild(row('para', 'Indents &amp; Spacing', function(){ nav(VIEWS.paraAdv.fn, 'Indents & Spacing'); }, { keep:true, trail:ico('chevr') }));
}};
VIEWS.special = { title:'Special Indent', fn:function(m){
  var md = paraMode();
  var i = Math.abs(readPara().indent);
  if(i > 0.001) spVal = r2(i);
  [['None','none'],['First Line','first'],['Hanging','hanging']].forEach(function(o){
    m.appendChild(row(null, o[0], function(){ setParaMode(o[1]); rerender(); }, { on: md === o[1], keep:true }));
  });
  stepper(m, 'By', 'cm', function(){ return spVal; }, 0.25, 0, 20, function(v){
    spVal = v;
    var cm = paraMode();
    if(cm !== 'none') setParaMode(cm);
  });
  var ch = el('div', 'chips');
  [['First line 1.25 cm', 1.25], ['First line 2.5 cm', 2.5]].forEach(function(c){
    var b = el('button', 'chip', c[0]); b.type = 'button';
    b.addEventListener('click', function(){ spVal = c[1]; setParaMode('first'); rerender(); });
    ch.appendChild(b);
  });
  m.appendChild(ch);
}};
VIEWS.paraAdv = { title:'Indents & Spacing', cls:'wide', fn:function(m){
  var refs = [];
  m.appendChild(el('div', 'mh', 'Indentation'));
  stepper(m, 'Left', 'cm', function(){ return readPara().left; }, 0.25, 0, 20, function(v){
    editBlocks(function(b){ b.style[sideProp(b, 'Left')] = v ? v + 'cm' : ''; });
  }, refs);
  stepper(m, 'Right', 'cm', function(){ return readPara().right; }, 0.25, 0, 20, function(v){
    editBlocks(function(b){ b.style[sideProp(b, 'Right')] = v ? v + 'cm' : ''; });
  }, refs);
  m.appendChild(el('div', 'mh', 'Spacing'));
  stepper(m, 'Before', 'pt', function(){ return readPara().before; }, 2, 0, 200, function(v){
    editBlocks(function(b){ b.style.marginTop = v + 'pt'; });
  }, refs);
  stepper(m, 'After', 'pt', function(){ return readPara().after; }, 2, 0, 200, function(v){
    editBlocks(function(b){ b.style.marginBottom = v + 'pt'; });
  }, refs);
  stepper(m, 'Line spacing', 'x', function(){ return readPara().line; }, 0.05, 0.5, 5, applyLineSpacing, refs);
  m.appendChild(el('div', 'msep'));
  var rs = el('button', 'chip', 'Reset paragraph'); rs.type = 'button';
  rs.style.margin = '6px 22px';
  rs.addEventListener('click', function(){
    editBlocks(function(b){
      ['marginLeft','marginRight','marginTop','marginBottom','textIndent','lineHeight'].forEach(function(p){ b.style[p] = ''; });
      if(b.tagName === 'TD' || b.tagName === 'TH'){ b.style.paddingLeft = ''; b.style.paddingRight = ''; }
    });
    refs.forEach(function(f){ f(); });
  });
  m.appendChild(rs);
}};
VIEWS.styles = { title:'Styles', fn:function(m){
  STYLES.forEach(function(s){
    m.appendChild(row(null, '<span style="' + s[3] + '">' + s[0] + '</span>', function(){ applyStyle(s[0]); }));
  });
}};
VIEWS.table = { title:'Insert Table', fn:function(m){
  var lab = el('div', 'tlabel', 'Tap a size');
  var g = el('div', 'tgrid'), cells = [];
  function hl(r, c){
    cells.forEach(function(i){ i.classList.toggle('on', +i.dataset.r <= r && +i.dataset.c <= c); });
    lab.textContent = r + ' rows × ' + c + ' columns';
  }
  for(var r = 1; r <= 8; r++) for(var c = 1; c <= 10; c++){
    (function(r, c){
      var i = el('i'); i.dataset.r = r; i.dataset.c = c;
      i.addEventListener('pointerenter', function(){ hl(r, c); });
      i.addEventListener('click', function(){ closeMenu(); insertTable(r, c); });
      cells.push(i); g.appendChild(i);
    })(r, c);
  }
  m.appendChild(lab); m.appendChild(g);
  if(cellOf()){
    m.appendChild(el('div', 'msep'));
    [['Insert row below','row+'],['Insert column right','col+'],['Delete row','row-'],['Delete column','col-'],['Delete table','del']].forEach(function(o){
      m.appendChild(row(null, o[0], function(){ tableOp(o[1]); }));
    });
  }
}};
VIEWS.link = { title:'Link', cls:'wide', fn:function(m){
  var selText = saved && !saved.collapsed ? saved.toString() : '';
  var f1 = el('div', 'fld', '<label for="lkText">Text to display</label>');
  var t = el('input'); t.id = 'lkText'; t.type = 'text'; t.value = selText; f1.appendChild(t);
  var f2 = el('div', 'fld', '<label for="lkUrl">Address</label>');
  var u = el('input'); u.id = 'lkUrl'; u.type = 'url'; u.placeholder = 'https://'; f2.appendChild(u);
  var bt = el('div', 'mbtns');
  var ok = el('button', 'mbtn', 'Insert'); ok.type = 'button';
  var run = function(){ var url = u.value, tx = t.value; closeMenu(); applyLink(url, tx); };
  ok.addEventListener('click', run);
  u.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); run(); } });
  var rm = el('button', 'mbtn alt', 'Remove Link'); rm.type = 'button';
  rm.addEventListener('click', function(){ closeMenu(); cmd('unlink'); });
  bt.appendChild(ok); bt.appendChild(rm);
  m.appendChild(f1); m.appendChild(f2); m.appendChild(bt);
}};
VIEWS.hf = { title:'Header & Footer', cls:'wide', fn:function(m){
  var f1 = el('div', 'fld', '<label for="hfH">Header text</label>');
  var h = el('input'); h.id = 'hfH'; h.type = 'text'; h.value = hf.header; f1.appendChild(h);
  var f2 = el('div', 'fld', '<label for="hfF">Footer text</label>');
  var f = el('input'); f.id = 'hfF'; f.type = 'text'; f.value = hf.footer; f2.appendChild(f);
  var bt = el('div', 'mbtns');
  var ok = el('button', 'mbtn', 'Apply'); ok.type = 'button';
  ok.addEventListener('click', function(){ hf.header = h.value; hf.footer = f.value; closeMenu(); renderDeco(pageCount()); scheduleSave(); });
  var rm = el('button', 'mbtn alt', 'Remove'); rm.type = 'button';
  rm.addEventListener('click', function(){ hf.header = ''; hf.footer = ''; closeMenu(); renderDeco(pageCount()); scheduleSave(); });
  bt.appendChild(ok); bt.appendChild(rm);
  m.appendChild(f1); m.appendChild(f2); m.appendChild(bt);
}};
VIEWS.pnum = { title:'Page Number', fn:function(m){
  m.appendChild(el('div', 'mh', 'Position'));
  [['Top right','tr'],['Top center','tc'],['Bottom right','br'],['Bottom center','bc']].forEach(function(p){
    m.appendChild(row(null, p[0], function(){ hf.pos = p[1]; renderDeco(pageCount()); scheduleSave(); rerender(); }, { on: hf.pos === p[1], keep:true }));
  });
  m.appendChild(el('div', 'mh', 'Format'));
  [['1','{n}'],['Page 1','Page {n}'],['Page 1 of N','Page {n} of {N}'],['หน้า 1','หน้า {n}'],['หน้า 1 / N','หน้า {n} / {N}']].forEach(function(p){
    m.appendChild(row(null, p[0], function(){ hf.fmt = p[1]; if(hf.pos === 'none') hf.pos = 'bc'; renderDeco(pageCount()); scheduleSave(); rerender(); }, { on: hf.fmt === p[1] && hf.pos !== 'none', keep:true }));
  });
  m.appendChild(el('div', 'msep'));
  m.appendChild(row(null, 'Remove Page Numbers', function(){ hf.pos = 'none'; renderDeco(pageCount()); scheduleSave(); }));
}};
var SYMS = '฿ © ® ™ ° ± × ÷ ½ ¼ ¾ ‰ § ¶ † ‡ • … – — « » ‹ › ← → ↑ ↓ ↔ ✓ ✗ ★ ☆ ♥ ♪ ∞ ≠ ≈ ≤ ≥ √ ∑ π Ω µ € £ ¥ ¢ ๏ ๚ ๛ ฯ ๆ ฿'.split(' ');
VIEWS.symbol = { title:'Symbol', cls:'wide', fn:function(m){
  var g = el('div', 'symg');
  SYMS.forEach(function(s){
    var b = el('button', null, s); b.type = 'button'; b.setAttribute('aria-label', 'Insert ' + s);
    b.addEventListener('click', function(){ closeMenu(); cmd('insertText', s); });
    g.appendChild(b);
  });
  m.appendChild(g);
}};
VIEWS.date = { title:'Date & Time', fn:function(m){
  var d = new Date();
  var f = function(loc, o){ try{ return new Intl.DateTimeFormat(loc, o).format(d); }catch(e){ return d.toLocaleDateString(); } };
  [f('th-TH', {day:'numeric', month:'long', year:'numeric'}),
   f('th-TH', {day:'numeric', month:'short', year:'numeric'}),
   f('th-TH', {day:'2-digit', month:'2-digit', year:'numeric'}),
   f('en-GB', {day:'numeric', month:'long', year:'numeric'}),
   f('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'}),
   f('th-TH', {hour:'2-digit', minute:'2-digit'}) + ' น.'
  ].forEach(function(t){ m.appendChild(row(null, t, function(){ cmd('insertText', t); })); });
}};
VIEWS.margins = { title:'Margins', fn:function(m){
  var cm = function(px){ return r2(px * 2.54 / 96); };
  [['Normal',2.54,2.54,2.54,2.54],['Narrow',1.27,1.27,1.27,1.27],['Moderate',2.54,2.54,1.91,1.91],['Wide',2.54,2.54,5.08,5.08]].forEach(function(p){
    var px = function(c){ return Math.round(c * 96 / 2.54); };
    var on = Math.abs(cm(page.mt) - p[1]) < 0.02 && Math.abs(cm(page.mb) - p[2]) < 0.02 && Math.abs(cm(page.ml) - p[3]) < 0.02 && Math.abs(cm(page.mr) - p[4]) < 0.02;
    m.appendChild(row(null, p[0] + '<small>Top ' + p[1] + '  Bottom ' + p[2] + '  Left ' + p[3] + '  Right ' + p[4] + ' cm</small>', function(){
      page.mt = px(p[1]); page.mb = px(p[2]); page.ml = px(p[3]); page.mr = px(p[4]); relayout();
    }, { on:on }));
  });
  m.appendChild(row(null, 'Custom Margins', function(){ nav(VIEWS.marginsCustom.fn, 'Custom Margins'); }, { keep:true, trail:ico('chevr') }));
}};
VIEWS.marginsCustom = { title:'Custom Margins', cls:'wide', fn:function(m){
  var cm = function(px){ return r2(px * 2.54 / 96); }, px = function(c){ return Math.round(c * 96 / 2.54); };
  [['Top','mt'],['Bottom','mb'],['Left','ml'],['Right','mr']].forEach(function(k){
    stepper(m, k[0], 'cm', function(){ return cm(page[k[1]]); }, 0.25, 0, 10, function(v){ page[k[1]] = px(v); relayout(); });
  });
}};
VIEWS.orient = { title:'Orientation', fn:function(m){
  m.appendChild(row('psize', 'Portrait', function(){ page.land = false; relayout(true); }, { on: !page.land }));
  m.appendChild(row('orient', 'Landscape', function(){ page.land = true; relayout(true); }, { on: page.land }));
}};
VIEWS.psize = { title:'Paper Size', fn:function(m){
  var lbl = { A4:'A4<small>21 × 29.7 cm</small>', A5:'A5<small>14.8 × 21 cm</small>', A3:'A3<small>29.7 × 42 cm</small>', B5:'B5<small>17.6 × 25 cm</small>', Letter:'Letter<small>21.6 × 27.9 cm</small>', Legal:'Legal<small>21.6 × 35.6 cm</small>' };
  Object.keys(PAGE_SIZES).forEach(function(k){
    m.appendChild(row(null, lbl[k], function(){ page.size = k; relayout(true); }, { on: page.size === k }));
  });
}};
function relayout(refit){
  applyPage();
  if(refit && !manualZoom && view === 'print') zoom = fitZoom();
  paginate();
  scheduleSave();
}
VIEWS.zoom = { title:'Zoom', fn:function(m){
  [50,75,100,125,150,200].forEach(function(p){
    m.appendChild(row(null, p + '%', function(){ setZoom(p / 100, true); }, { on: Math.round(zoom * 100) === p }));
  });
  m.appendChild(row(null, 'Page Width', function(){ manualZoom = false; setZoom(fitZoom(), false); }));
}};
VIEWS.share = { title:'Share', fn:function(m){
  m.appendChild(row('copy', 'Copy with formatting', copyRich));
  m.appendChild(row('copy', 'Copy as plain text', function(){ copyText(doc.innerText.replace(/​/g, ''), 'Plain text copied'); }));
  m.appendChild(row('code', 'Copy as HTML', function(){ copyText(cleanHTML(), 'HTML copied'); }));
}};
VIEWS.inkcolor = { title:'Pen Color', cls:'pal', fn:function(m){
  var list = ['#000000','#e00000','#ff7a00','#ffd400','#2eaa4a','#00a3e0','#1f4fd8','#7a2fb5','#e0508c','#6b4a2b'];
  swatches(m, list, '', function(c){ inkColor = c; $('#inkDot').style.setProperty('--c', c); refreshInk(); });
  var rw = el('div', 'mrow');
  rw.appendChild(el('span', null, 'More Colors'));
  var inp = el('input'); inp.type = 'color'; inp.value = inkColor; inp.setAttribute('aria-label', 'Custom pen color');
  inp.addEventListener('input', function(){ inkColor = inp.value; $('#inkDot').style.setProperty('--c', inkColor); });
  rw.appendChild(inp); m.appendChild(rw);
}};
VIEWS.inkwidth = { title:'Thickness', fn:function(m){
  [1,2,3,5,8].forEach(function(w){
    m.appendChild(row(null, '<span class="thick" style="height:' + w + 'px"></span>', function(){ inkW = w; }, { on: inkW === w }));
  });
}};
var COMMANDS = [
  ['Bold','ตัวหนา b',function(){ cmd('bold'); }],
  ['Italic','ตัวเอียง i',function(){ cmd('italic'); }],
  ['Underline','ขีดเส้นใต้ u',function(){ cmd('underline'); }],
  ['Strikethrough','ขีดฆ่า',function(){ cmd('strikeThrough'); }],
  ['Bullets','รายการ หัวข้อย่อย list',function(){ cmd('insertUnorderedList'); }],
  ['Numbering','เลขลำดับ number',function(){ cmd('insertOrderedList'); }],
  ['Align Left','ชิดซ้าย',function(){ cmd('justifyLeft'); }],
  ['Center','กึ่งกลาง',function(){ cmd('justifyCenter'); }],
  ['Align Right','ชิดขวา',function(){ cmd('justifyRight'); }],
  ['Justify','กระจาย เต็มแนว',function(){ cmd('justifyFull'); }],
  ['Increase Indent','เยื้อง',function(){ indentBlocks(1); }],
  ['Decrease Indent','ลดการเยื้อง',function(){ indentBlocks(-1); }],
  ['Clear Formatting','ล้างรูปแบบ',clearFormat],
  ['Find','ค้นหา search',function(){ openFind(); }],
  ['Word Count','นับคำ',function(){ wordCount(); }],
  ['Read Aloud','อ่านออกเสียง',function(){ toggleSpeak(); }],
  ['Page Break','ขึ้นหน้าใหม่ ตัดหน้า',insertPageBreak],
  ['Insert Picture','รูปภาพ',function(){ $('#imgInput').click(); }],
  ['Mobile View','มุมมองมือถือ',function(){ setView('mobile'); }],
  ['Print Layout','มุมมองพิมพ์',function(){ setView('print'); }],
  ['Insert Table','ตาราง',function(){ goMenu('insert', 'table'); }],
  ['Margins','ขอบกระดาษ',function(){ goMenu('layout', 'margins'); }],
  ['Orientation','แนวกระดาษ แนวตั้ง แนวนอน',function(){ goMenu('layout', 'orient'); }],
  ['Paper Size','ขนาดกระดาษ A4',function(){ goMenu('layout', 'psize'); }],
  ['Paragraph','ย่อหน้า เยื้อง ระยะห่าง',function(){ goMenu('home', 'para'); }],
  ['Font','ฟอนต์ แบบอักษร',function(){ goMenu('home', 'font'); }],
  ['Draw','วาด ปากกา',function(){ onTab('draw'); }],
  ['AI Assistant','เอไอ ผู้ช่วย ถาม ai claude chatgpt gemini copilot',function(){ aiToggle(true); }],
  ['AI: Fix spelling','แก้คำผิด ตรวจคำ สะกด ai',function(){ aiQuick(0); }],
  ['AI: Make it formal','ภาษาทางการ ai',function(){ aiQuick(1); }],
  ['AI: Translate to English','แปลอังกฤษ ai',function(){ aiQuick(5); }]
];
function goMenu(tab, name){
  onTab(tab);
  setTimeout(function(){ var b = $('[data-menu="' + name + '"]', $('[data-panel="' + tab + '"]')); if(b) b.click(); }, 60);
}
VIEWS.tell = { title:'', cls:'wide', fn:function(m){
  var inp = el('input', 'tellin'); inp.type = 'text'; inp.placeholder = 'Tell me what you want to do'; inp.setAttribute('aria-label', 'Tell me what you want to do');
  var list = el('div');
  function draw(){
    var q = inp.value.trim().toLowerCase();
    list.innerHTML = '';
    COMMANDS.filter(function(c){ return !q || (c[0] + ' ' + c[1]).toLowerCase().indexOf(q) >= 0; }).slice(0, 9).forEach(function(c){
      list.appendChild(row(null, c[0], function(){ setTimeout(c[2], 30); }));
    });
  }
  inp.addEventListener('input', draw);
  m.appendChild(inp); m.appendChild(list); draw();
  setTimeout(function(){ inp.focus(); }, 0);
}};

/* ================= clipboard ================= */
function selectAllCopy(){
  var s = window.getSelection(), keep = saved;
  var r = document.createRange();
  r.selectNodeContents(doc);
  s.removeAllRanges(); s.addRange(r);
  var ok = false;
  try{ ok = document.execCommand('copy'); }catch(e){}
  if(keep){ s.removeAllRanges(); s.addRange(keep); }
  return ok;
}
function copyRich(){
  var html = cleanHTML(), text = doc.innerText.replace(/​/g, '');
  var done = function(){ toast('Copied with formatting. Paste into Word or Google Docs.'); };
  var fail = function(){ if(selectAllCopy()) done(); else toast('Could not copy. Select the text and copy it yourself.'); };
  if(navigator.clipboard && window.ClipboardItem){
    navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], {type:'text/html'}),
      'text/plain': new Blob([text], {type:'text/plain'})
    })]).then(done, fail);
  }else fail();
}
function copyText(t, msg){
  var fb = function(){
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove();
    toast(ok ? msg : 'Could not copy');
  };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ toast(msg); }, fb);
  else fb();
}

/* ================= find and replace ================= */
var findState = { ranges:[], i:-1 };
var hasHL = !!(window.CSS && CSS.highlights && window.Highlight);
function openFind(){
  $('#findbar').hidden = false;
  var sel = saved && !saved.collapsed ? saved.toString() : '';
  if(sel && sel.length < 80 && sel.indexOf('\n') < 0) $('#findIn').value = sel;
  $('#findIn').focus(); $('#findIn').select();
  runFind(false);
}
function closeFind(){
  $('#findbar').hidden = true;
  if(hasHL){ CSS.highlights.delete('findhl'); CSS.highlights.delete('findcur'); }
  findState = { ranges:[], i:-1 };
}
function collectRanges(q){
  var out = [];
  if(!q) return out;
  var needle = q.toLowerCase();
  var w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT), n;
  while((n = w.nextNode())){
    var t = n.nodeValue.toLowerCase(), i = 0;
    while((i = t.indexOf(needle, i)) >= 0){
      var r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + q.length);
      out.push(r); i += q.length;
    }
  }
  return out;
}
function runFind(jump){
  var q = $('#findIn').value;
  findState.ranges = collectRanges(q);
  if(findState.i >= findState.ranges.length || findState.i < 0) findState.i = findState.ranges.length ? 0 : -1;
  paintFind();
  if(jump !== false && findState.i >= 0) gotoMatch(findState.i);
}
function paintFind(){
  var n = findState.ranges.length;
  $('#findCnt').textContent = n ? (findState.i + 1) + '/' + n : '0/0';
  if(!hasHL) return;
  CSS.highlights.delete('findhl');
  CSS.highlights.delete('findcur');
  if(n){
    var hl = new Highlight();
    findState.ranges.forEach(function(r){ hl.add(r); });
    CSS.highlights.set('findhl', hl);
    if(findState.i >= 0){
      var cur = new Highlight();
      cur.add(findState.ranges[findState.i]);
      CSS.highlights.set('findcur', cur);
    }
  }
}
function gotoMatch(i){
  var r = findState.ranges[i];
  if(!r) return;
  findState.i = i;
  paintFind();
  var s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
  var e = r.startContainer.parentElement;
  if(e && e.scrollIntoView) e.scrollIntoView({block:'center', behavior:'auto'});
}
function stepFind(d){
  var n = findState.ranges.length;
  if(!n) return;
  gotoMatch((findState.i + d + n) % n);
}
function replaceOne(){
  var r = findState.ranges[findState.i];
  if(!r) return;
  flushSnap();
  var s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
  doc.focus({preventScroll:true});
  try{ document.execCommand('insertText', false, $('#replIn').value); }catch(e){}
  afterCommand();
  runFind(true);
}
function replaceAll(){
  var list = collectRanges($('#findIn').value);
  if(!list.length) return;
  flushSnap();
  doc.focus({preventScroll:true});
  var val = $('#replIn').value, s = window.getSelection();
  for(var i = list.length - 1; i >= 0; i--){
    s.removeAllRanges(); s.addRange(list[i]);
    try{ document.execCommand('insertText', false, val); }catch(e){}
  }
  afterCommand();
  toast(list.length + ' replaced');
  runFind(false);
}
$('#findIn').addEventListener('input', function(){ findState.i = -1; runFind(true); });
$('#findIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); } });
$('#findbar').addEventListener('click', function(e){
  var b = e.target.closest('[data-f]');
  if(!b) return;
  var a = b.getAttribute('data-f');
  if(a === 'next') stepFind(1);
  else if(a === 'prev') stepFind(-1);
  else if(a === 'close') closeFind();
  else if(a === 'rtoggle'){ var rr = $('#replRow'); rr.hidden = !rr.hidden; b.classList.toggle('on', !rr.hidden); }
  else if(a === 'rep') replaceOne();
  else if(a === 'repall') replaceAll();
});

/* ================= review ================= */
function stats(){
  var t = doc.innerText.replace(/​/g, '');
  var words = 0;
  if(window.Intl && Intl.Segmenter){
    var it = new Intl.Segmenter('th', {granularity:'word'}).segment(t)[Symbol.iterator](), x;
    while(!(x = it.next()).done){ if(x.value.isWordLike) words++; }
  }else words = (t.trim().match(/\S+/g) || []).length;
  var paras = $$('p,h1,h2,h3,li', doc).filter(function(p){ return p.textContent.replace(/​/g, '').trim(); }).length;
  return { words:words, chars:t.replace(/\s/g, '').length, charsSp:t.replace(/\n/g, '').length, paras:paras, pages:pageCount() };
}
function modal(titleText, body, okLabel){
  var c = $('#mcard');
  c.innerHTML = '<h2>' + titleText + '</h2>' + body + '<div class="mbtns"><button class="mbtn" id="mOk" type="button">' + (okLabel || 'OK') + '</button></div>';
  $('#modal').hidden = false;
  $('#mOk').addEventListener('click', function(){ $('#modal').hidden = true; });
}
$('#modal').addEventListener('click', function(e){ if(e.target.id === 'modal') $('#modal').hidden = true; });
function wordCount(){
  var s = stats();
  modal('Word Count', '<dl><dt>Pages</dt><dd>' + s.pages + '</dd><dt>Words</dt><dd>' + s.words.toLocaleString() +
    '</dd><dt>Characters (no spaces)</dt><dd>' + s.chars.toLocaleString() + '</dd><dt>Characters (with spaces)</dt><dd>' +
    s.charsSp.toLocaleString() + '</dd><dt>Paragraphs</dt><dd>' + s.paras + '</dd></dl>');
}
var speaking = false;
function toggleSpeak(){
  if(!('speechSynthesis' in window)){ toast('Read Aloud is not available here'); return; }
  var b = $('[data-act="speak"]');
  if(speaking){ window.speechSynthesis.cancel(); speaking = false; b.setAttribute('aria-pressed', 'false'); return; }
  var text = doc.innerText.replace(/​/g, '').trim();
  if(!text){ toast('Nothing to read'); return; }
  try{
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.onend = u.onerror = function(){ speaking = false; b.setAttribute('aria-pressed', 'false'); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    speaking = true; b.setAttribute('aria-pressed', 'true');
  }catch(e){ toast('Read Aloud is not available here'); }
}
function setReading(on){
  reading = on;
  document.body.classList.toggle('reading', on);
  doc.contentEditable = on ? 'false' : 'true';
  closeMenu();
  refreshInk();
}
$('#editPill').addEventListener('click', function(){ setReading(false); });

/* ================= ink ================= */
function inkActive(){ return activeTab === 'draw' && !!inkTool && !reading; }
function refreshInk(){
  var on = inkActive();
  inkSvg.classList.toggle('on', on);
  inkSvg.classList.toggle('touch', on && touchDraw);
  ['pen','hl','eraser'].forEach(function(t){
    var b = $('[data-act="tool-' + t + '"]');
    if(b) b.setAttribute('aria-pressed', inkTool === t);
  });
  $('[data-act="touch"]').setAttribute('aria-pressed', touchDraw);
  updateUndo();
}
function pathD(pts){
  var d = 'M' + pts[0][0] + ' ' + pts[0][1];
  if(pts.length < 2) return d + 'l.01 0';
  for(var i = 1; i < pts.length - 1; i++){
    var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ' Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx + ' ' + my;
  }
  var l = pts[pts.length - 1];
  return d + ' L' + l[0] + ' ' + l[1];
}
function strokeEl(s){
  var p = document.createElementNS(SVGNS, 'path');
  p.setAttribute('d', pathD(s.pts));
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', s.c);
  p.setAttribute('stroke-width', s.t === 'hl' ? s.w * 4 : s.w);
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  if(s.t === 'hl'){ p.setAttribute('stroke-opacity', '0.4'); p.style.mixBlendMode = 'multiply'; }
  return p;
}
function renderInk(){
  inkSvg.innerHTML = '';
  strokes.forEach(function(s){ inkSvg.appendChild(strokeEl(s)); });
}
function pushInkUndo(){
  inkUndo.push(JSON.stringify(strokes));
  if(inkUndo.length > 60) inkUndo.shift();
  inkRedo = [];
  updateUndo();
}
function inkStep(from, to){
  if(!from.length) return;
  to.push(JSON.stringify(strokes));
  strokes = JSON.parse(from.pop());
  renderInk(); updateUndo(); scheduleSave();
}
function inkPoint(e){
  var r = sheet.getBoundingClientRect();
  return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom];
}
function distSeg(p, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  var t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
  return Math.sqrt(x * x + y * y);
}
var drawing = null;
inkSvg.addEventListener('pointerdown', function(e){
  if(!inkActive()) return;
  if(e.pointerType === 'touch' && !touchDraw) return;
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try{ inkSvg.setPointerCapture(e.pointerId); }catch(x){}
  pushInkUndo();
  var pt = inkPoint(e);
  if(inkTool === 'eraser'){ drawing = { erase:true }; eraseAt(pt); return; }
  var s = { t: inkTool, c: inkColor, w: inkW, pts: [pt] };
  var p = strokeEl(s);
  inkSvg.appendChild(p);
  drawing = { s:s, p:p };
});
inkSvg.addEventListener('pointermove', function(e){
  if(!drawing) return;
  e.preventDefault();
  var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  if(!evs.length) evs = [e];
  evs.forEach(function(ev){
    var pt = inkPoint(ev);
    if(drawing.erase){ eraseAt(pt); return; }
    var last = drawing.s.pts[drawing.s.pts.length - 1];
    if(Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]) < 0.8) return;
    drawing.s.pts.push(pt);
  });
  if(drawing.s) drawing.p.setAttribute('d', pathD(drawing.s.pts));
});
function endDraw(){
  if(!drawing) return;
  if(drawing.s) strokes.push(drawing.s);
  drawing = null;
  scheduleSave(); updateUndo();
}
inkSvg.addEventListener('pointerup', endDraw);
inkSvg.addEventListener('pointercancel', endDraw);
function eraseAt(pt){
  var rad = 10 / Math.max(zoom, 0.5), before = strokes.length;
  strokes = strokes.filter(function(s){
    var r = rad + (s.t === 'hl' ? s.w * 2 : s.w / 2);
    if(s.pts.length === 1) return Math.hypot(s.pts[0][0] - pt[0], s.pts[0][1] - pt[1]) > r;
    for(var i = 1; i < s.pts.length; i++) if(distSeg(pt, s.pts[i - 1], s.pts[i]) <= r) return false;
    return true;
  });
  if(strokes.length !== before) renderInk();
}

/* ================= tabs, backstage, actions ================= */
function onTab(name){
  if(name === 'file'){ openBackstage(); return; }
  activeTab = name;
  $$('.tab').forEach(function(t){ t.setAttribute('aria-selected', t.getAttribute('data-tab') === name); });
  $$('.panel').forEach(function(p){ p.classList.toggle('on', p.getAttribute('data-panel') === name); });
  $('#ribbonWrap').hidden = false; ribbonCollapsed = false;
  $('#btnCollapse').innerHTML = ico('chevup');
  $('#ribbon').scrollLeft = 0;
  closeMenu();
  refreshInk();
}
$('#btnCollapse').addEventListener('click', function(){
  ribbonCollapsed = !ribbonCollapsed;
  $('#ribbonWrap').hidden = ribbonCollapsed;
  closeMenu();
  if(ribbonCollapsed) $$('.tab').forEach(function(t){ t.setAttribute('aria-selected', 'false'); });
  else onTab(activeTab);
});
/* ================= documents (library) ================= */
function blankPage(){ return { size:'A4', land:false, mt:96, mb:96, ml:96, mr:96, w:794, h:1123 }; }
function blankHf(){ return { header:'', footer:'', pos:'bc', fmt:'หน้า {n} / {N}' }; }
function loadDocument(rec){
  docId = rec.id; created = rec.created || Date.now();
  title = rec.title || 'เอกสารไม่มีชื่อ';
  page = Object.assign(blankPage(), rec.page || {});
  hf = Object.assign(blankHf(), rec.hf || {});
  strokes = Array.isArray(rec.ink) ? rec.ink : []; inkUndo = []; inkRedo = [];
  clearTimeout(snapT); snapT = null;
  doc.innerHTML = rec.html && String(rec.html).trim() ? rec.html : '<p><br></p>';
  ensureBlock();
  $('#ttlText').textContent = title;
  document.title = title + ' – SJN Word';
  applyPage();
  manualZoom = false; zoom = fitZoom();
  renderInk();
  hist = [{ html:cleanHTML(), sel:null }]; hi = 0;
  saved = null; aiCtx = null;
  paginate(); refreshInk(); updateUndo(); updateState();
  desk.scrollTop = 0;
  setSaveState('Saved');
  SJNStore.setMeta('current', docId);
  if(typeof aiHint === 'function') aiHint();
}
function newRecord(o){
  var now = Date.now();
  return { id:SJNStore.newId(), title:o.title || 'เอกสารไม่มีชื่อ', html:o.html || '<p><br></p>', page:o.page || null, hf:o.hf || null,
    ink:[], created:now, updated:now };
}
function createDocument(o){
  return save().then(function(){
    var r = newRecord(o || {});
    return SJNStore.put(r).then(function(){ loadDocument(r); return r; });
  });
}
function openDocument(id){
  if(id === docId) return Promise.resolve();
  return save().then(function(){ return SJNStore.get(id); }).then(function(r){
    if(!r) throw new Error('Document not found');
    loadDocument(r); return r;
  });
}
function duplicateDocument(id){
  return save().then(function(){ return SJNStore.get(id); }).then(function(r){
    if(!r) throw new Error('Document not found');
    var c = JSON.parse(JSON.stringify(r)), now = Date.now();
    c.id = SJNStore.newId(); c.title = r.title + ' (copy)'; c.created = c.updated = now;
    return SJNStore.put(c).then(function(){ return c; });
  });
}
function deleteDocument(id){
  return SJNStore.remove(id).then(function(){
    if(id !== docId) return;
    return SJNStore.list().then(function(l){
      if(l.length) return SJNStore.get(l[0].id).then(loadDocument);
      docId = null;
      return createDocument({});
    });
  });
}
function fmtDate(ts){
  try{ return new Intl.DateTimeFormat('th-TH', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(ts)); }
  catch(e){ return new Date(ts).toLocaleString(); }
}

/* ================= download, share, print ================= */
var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function fileName(ext){
  var n = String(title || 'document').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
  return (n || 'document') + ext;
}
function saveBlob(blob, name){
  var a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}
function exportDocxBlob(){
  if(!window.SJNDocx || !SJNDocx.exportDocx) return Promise.reject(new Error('The Word exporter did not load'));
  return SJNDocx.exportDocx({ html:cleanHTML(), title:title, page:page, hf:hf });
}
function plainText(){
  return aiBlocks().map(function(b){ return b.textContent.replace(/​/g, ''); }).join('\n');
}
function htmlFile(){
  var fam = ($('#doc').style.fontFamily || '"TH Sarabun New","Sarabun","Noto Sans Thai",sans-serif');
  return '<!doctype html>\n<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHTML(title) + '</title>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,700;1,400;1,700&display=swap">' +
    '<style>body{max-width:' + page.w + 'px;margin:24px auto;padding:0 ' + Math.round(page.ml) + 'px;font:16pt/1.25 "TH Sarabun New","Sarabun","Noto Sans Thai",sans-serif;color:#111}' +
    'p{margin:0 0 6pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #8a949b;padding:4pt 6pt;vertical-align:top}img{max-width:100%;height:auto}.pbreak{border-top:1px dashed #999;margin:12pt 0}</style>' +
    '</head><body>\n' + cleanHTML() + '\n</body></html>\n';
}
function downloadAs(kind){
  if(saveT) save();
  if(kind === 'docx'){
    toast('Preparing Word file…');
    exportDocxBlob().then(function(b){ var n = fileName('.docx'); saveBlob(b, n); toast('Downloaded ' + n); },
      function(e){ toast('Could not create the .docx file: ' + (e && e.message || e)); });
  }else if(kind === 'html'){
    var n = fileName('.html'); saveBlob(new Blob([htmlFile()], { type:'text/html;charset=utf-8' }), n); toast('Downloaded ' + n);
  }else if(kind === 'txt'){
    var t = fileName('.txt'); saveBlob(new Blob(['﻿' + plainText()], { type:'text/plain;charset=utf-8' }), t); toast('Downloaded ' + t);
  }else if(kind === 'json'){
    var j = fileName('.sjnword.json'); saveBlob(new Blob([JSON.stringify(snapshotRec())], { type:'application/json' }), j); toast('Downloaded ' + j);
  }
}
function shareDoc(){
  exportDocxBlob().then(function(b){
    var f = new File([b], fileName('.docx'), { type:DOCX_MIME });
    if(navigator.canShare && navigator.canShare({ files:[f] })) return navigator.share({ files:[f], title:title });
    saveBlob(b, f.name); toast('Sharing is not supported here, so the file was downloaded instead');
  }).catch(function(e){ if(!e || e.name !== 'AbortError') toast('Could not share: ' + (e && e.message || e)); });
}

/* print and "Save as PDF": #printRoot is the only thing visible while printing */
function cssStr(s){ return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"'; }
function preparePrint(){
  var root = $('#printRoot');
  root.innerHTML = cleanHTML();
  $$('.pbreak', root).forEach(function(b){ b.removeAttribute('contenteditable'); });
  var mm = function(px){ return r2(px * 25.4 / 96) + 'mm'; };
  var MMS = { A4:[210,297], A5:[148,210], A3:[297,420], B5:[176,250], Letter:[215.9,279.4], Legal:[215.9,355.6] };
  var sz = MMS[page.size] || MMS.A4, pw = (page.land ? sz[1] : sz[0]) + 'mm', ph = (page.land ? sz[0] : sz[1]) + 'mm';
  var boxes = {};
  var put = function(k, parts){ (boxes[k] = boxes[k] || []).push(parts); };
  if(hf.header) put('top-center', [cssStr(hf.header)]);
  if(hf.footer) put('bottom-center', [cssStr(hf.footer)]);
  if(hf.pos && hf.pos !== 'none'){
    var key = { tl:'top-left', tc:'top-center', tr:'top-right', bl:'bottom-left', bc:'bottom-center', br:'bottom-right' }[hf.pos] || 'bottom-center';
    var parts = [], fm = String(hf.fmt || '{n}'), re = /\{n\}|\{N\}/g, last = 0, m;
    while((m = re.exec(fm))){
      if(m.index > last) parts.push(cssStr(fm.slice(last, m.index)));
      parts.push(m[0] === '{n}' ? 'counter(page)' : 'counter(pages)');
      last = re.lastIndex;
    }
    if(last < fm.length) parts.push(cssStr(fm.slice(last)));
    put(key, parts);
  }
  var css = '@page{size:' + pw + ' ' + ph + ';margin:' + [page.mt, page.mr, page.mb, page.ml].map(mm).join(' ') + '}\n';
  Object.keys(boxes).forEach(function(k){
    var content = boxes[k].map(function(p){ return p.join(' '); }).join(' "\\A" ');
    css += '@page{@' + k + '{content:' + content + ';white-space:pre-wrap;font:10pt "Sarabun","Noto Sans Thai",sans-serif;color:#555}}\n';
  });
  $('#printStyle').textContent = css;
}
function printDoc(){
  if(saveT) save();
  preparePrint();
  setTimeout(function(){ window.print(); }, 60);
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', function(){ $('#printRoot').innerHTML = ''; });

/* ================= File panel (backstage) ================= */
function bsRow(l, icon, label, sub, fn, keep){
  var b = el('button', 'bsi', '<span class="mic">' + ico(icon) + '</span><span class="ml">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span>');
  b.type = 'button';
  b.addEventListener('click', function(){ if(keep){ fn(); return; } closeBackstage(); setTimeout(fn, 30); });
  l.appendChild(b);
  return b;
}
function bsBack(l, label){
  var b = bsRow(l, 'back', label || 'Back', '', function(){ openBackstage(); }, true);
  b.classList.add('bsback2');
}
function openBackstage(sub){
  var l = $('#bslist');
  l.innerHTML = '';
  var add = function(icon, label, text, fn, keep){ return bsRow(l, icon, label, text, fn, keep); };
  if(sub === 'download'){
    bsBack(l, 'Download as…');
    add('download', 'Word document (.docx)', 'Opens in Word, Google Docs, LibreOffice', function(){ downloadAs('docx'); });
    add('code', 'Web page (.html)', '', function(){ downloadAs('html'); });
    add('align', 'Plain text (.txt)', '', function(){ downloadAs('txt'); });
    add('save', 'Backup copy (.json)', 'Everything, including pen ink', function(){ downloadAs('json'); });
  }else if(sub === 'recent'){
    bsBack(l, 'Recent documents');
    var holder = el('div', 'bsrecent', '<div class="bsnote">Loading…</div>');
    l.appendChild(holder);
    save().then(function(){ return SJNStore.list(); }).then(function(items){
      holder.innerHTML = '';
      if(!items.length){ holder.innerHTML = '<div class="bsnote">No documents yet.</div>'; return; }
      items.forEach(function(it){
        var row = el('div', 'bsdoc' + (it.id === docId ? ' cur' : ''));
        var main = el('button', 'bsmain'); main.type = 'button';
        main.innerHTML = '<span class="bst"></span><small class="bsd"></small><small class="bsp"></small>';
        main.querySelector('.bst').textContent = it.title || 'เอกสารไม่มีชื่อ';
        main.querySelector('.bsd').textContent = fmtDate(it.updated) + (it.id === docId ? ' · open now' : '');
        main.querySelector('.bsp').textContent = it.preview;
        main.addEventListener('click', function(){ closeBackstage(); openDocument(it.id).catch(function(e){ toast(String(e.message || e)); }); });
        var dup = el('button', 'bsx', ico('copy')); dup.type = 'button'; dup.setAttribute('aria-label', 'Duplicate ' + it.title);
        dup.addEventListener('click', function(){ duplicateDocument(it.id).then(function(){ openBackstage('recent'); toast('Duplicated'); }); });
        var del = el('button', 'bsx', ico('trash')); del.type = 'button'; del.setAttribute('aria-label', 'Delete ' + it.title);
        del.addEventListener('click', function(){
          if(del.getAttribute('data-sure') !== '1'){ del.setAttribute('data-sure', '1'); del.classList.add('sure'); del.textContent = 'Delete?'; setTimeout(function(){ if(del.isConnected){ del.removeAttribute('data-sure'); del.classList.remove('sure'); del.innerHTML = ico('trash'); } }, 3000); return; }
          deleteDocument(it.id).then(function(){ openBackstage('recent'); toast('Deleted'); });
        });
        row.appendChild(main); row.appendChild(dup); row.appendChild(del);
        holder.appendChild(row);
      });
    });
  }else{
    add('newdoc', 'New', 'Blank document', function(){ createDocument({}).then(function(){ caretToEnd(); }); });
    add('open', 'Open from this device', 'Word (.docx), HTML, text or Markdown', function(){ $('#openInput').click(); });
    add('recent', 'Recent documents', 'Saved in this browser', function(){ openBackstage('recent'); }, true);
    add('download', 'Download', 'Word .docx, HTML, text', function(){ openBackstage('download'); }, true);
    add('share', 'Share…', 'Send the .docx to another app', shareDoc);
    add('print', 'Print / Save as PDF', 'Uses the paper size and margins', printDoc);
    add('rename', 'Rename', title, startRename);
    add('info', 'Info', 'Word count and pages', wordCount);
    add('plug', 'Connect Claude', 'Let Claude read and edit this document', function(){ aiToggle(true); aiOpenConnect(); });
    if(installEvt && !isStandalone()) add('install', 'Install app', 'Add SJN Word to the home screen', installApp);
    add('copy', 'Copy with formatting', 'Paste into Word or Google Docs', copyRich);
    add('copy', 'Copy as plain text', '', function(){ copyText(plainText(), 'Plain text copied'); });
    add('code', 'Load sample document', 'Thai memo with font samples', function(){ createDocument({ title:'บันทึกข้อความตัวอย่าง', html:sampleHTML() }); });
  }
  $('#bs').hidden = false;
}
function closeBackstage(){ $('#bs').hidden = true; }
$('#bs').addEventListener('click', function(e){ if(e.target.closest('[data-bs="close"]')) closeBackstage(); });

/* ---- install ---- */
var installEvt = null;
window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', function(){ installEvt = null; toast('SJN Word is installed'); });
function isStandalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
function installApp(){
  if(!installEvt){ toast('Open the browser menu (⋮) and choose "Install app" or "Add to Home screen"'); return; }
  var e = installEvt; installEvt = null;
  e.prompt();
}

function startRename(){
  var inp = $('#ttlIn'), btn = $('#ttlBtn');
  inp.value = title; btn.hidden = true; inp.hidden = false; inp.focus(); inp.select();
}
function endRename(ok){
  var inp = $('#ttlIn');
  if(inp.hidden) return;
  if(ok && inp.value.trim()) setTitle(inp.value.trim());
  inp.hidden = true; $('#ttlBtn').hidden = false;
}
$('#ttlBtn').addEventListener('click', startRename);
$('#ttlIn').addEventListener('keydown', function(e){ if(e.key === 'Enter') endRename(true); else if(e.key === 'Escape') endRename(false); });
$('#ttlIn').addEventListener('blur', function(){ endRename(true); });

/* ---- opening files ---- */
function sanitizeHtmlFile(txt){
  var d = new DOMParser().parseFromString(txt, 'text/html');
  $$('script,style,iframe,object,embed,link,meta,base,form', d).forEach(function(n){ n.remove(); });
  $$('*', d.body).forEach(function(n){
    Array.prototype.slice.call(n.attributes).forEach(function(a){
      if(/^on/i.test(a.name) || (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) && /^\s*(javascript|vbscript):/i.test(a.value))) n.removeAttribute(a.name);
    });
  });
  return { html:d.body.innerHTML, title:(d.title || '').trim() };
}
function openFile(f){
  var base = f.name.replace(/\.[^.]+$/, '');
  var fail = function(e){ toast('Could not open ' + f.name + (e && e.message ? ': ' + e.message : '')); };
  if(/\.docx$/i.test(f.name) || f.type === DOCX_MIME){
    if(!window.SJNDocx || !SJNDocx.importDocx){ toast('The Word reader did not load'); return; }
    toast('Opening ' + f.name + '…');
    f.arrayBuffer().then(function(buf){ return SJNDocx.importDocx(buf); }).then(function(r){
      return createDocument({ title:r.title || base, html:r.html, page:r.page, hf:r.hf });
    }).then(function(){ toast('Opened ' + f.name); }, fail);
    return;
  }
  if(/\.doc$/i.test(f.name)){ toast('Old .doc files are not supported. In Word choose Save As → .docx, then open that.'); return; }
  if(/\.pdf$/i.test(f.name)){ toast('PDF files cannot be edited here. Open the .docx or text version instead.'); return; }
  if(/\.sjnword\.json$/i.test(f.name) || /\.json$/i.test(f.name)){
    f.text().then(function(t){
      var o = JSON.parse(t);
      if(!o || typeof o.html !== 'string') throw new Error('not an SJN Word backup');
      var now = Date.now();
      return createDocument({ title:o.title || base, html:o.html, page:o.page, hf:o.hf }).then(function(r){
        r.ink = Array.isArray(o.ink) ? o.ink : []; strokes = r.ink; renderInk(); scheduleSave();
      });
    }).then(function(){ toast('Opened ' + f.name); }, fail);
    return;
  }
  f.text().then(function(txt){
    var html, t = base;
    if(/\.html?$/i.test(f.name) || /html/.test(f.type)){ var r = sanitizeHtmlFile(txt); html = r.html; if(r.title) t = r.title; }
    else if(/\.md$/i.test(f.name) || /markdown/.test(f.type)) html = markdownToHtml(txt);
    else html = txt.split(/\r?\n/).map(function(l){ return '<p>' + (escapeHTML(l) || '<br>') + '</p>'; }).join('');
    return createDocument({ title:t, html:html });
  }).then(function(){ toast('Opened ' + f.name); }, fail);
}
function markdownToHtml(md){
  var out = [], list = null, lines = String(md).replace(/\r/g, '').split('\n');
  var inl = function(s){
    s = escapeHTML(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/~~([^~]+)~~/g, '<s>$1</s>');
    return s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  };
  var close = function(){ if(list){ out.push('</' + list + '>'); list = null; } };
  lines.forEach(function(l){
    var m;
    if((m = /^(#{1,3})\s+(.*)$/.exec(l))){ close(); out.push('<h' + m[1].length + '>' + inl(m[2]) + '</h' + m[1].length + '>'); }
    else if((m = /^\s*[-*+]\s+(.*)$/.exec(l))){ if(list !== 'ul'){ close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inl(m[1]) + '</li>'); }
    else if((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))){ if(list !== 'ol'){ close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inl(m[1]) + '</li>'); }
    else if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){ close(); out.push('<hr>'); }
    else{ close(); out.push('<p>' + (l.trim() ? inl(l) : '<br>') + '</p>'); }
  });
  close();
  return out.join('');
}
$('#openInput').addEventListener('change', function(e){
  var f = e.target.files[0];
  e.target.value = '';
  if(f) openFile(f);
});

document.addEventListener('click', function(e){
  var t = e.target.closest('[data-tab]');
  if(t){ onTab(t.getAttribute('data-tab')); return; }
  var m = e.target.closest('[data-menu]');
  if(m){ openMenu(m, VIEWS[m.getAttribute('data-menu')]); return; }
  var c = e.target.closest('[data-cmd]');
  if(c){ cmd(c.getAttribute('data-cmd')); return; }
  var a = e.target.closest('[data-act]');
  if(!a) return;
  switch(a.getAttribute('data-act')){
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'clear': clearFormat(); break;
    case 'ltr': setDir('ltr'); break;
    case 'rtl': setDir('rtl'); break;
    case 'find': openFind(); break;
    case 'ai': aiToggle(); break;
    case 'picture': $('#imgInput').click(); break;
    case 'pbreak': insertPageBreak(); break;
    case 'touch': touchDraw = !touchDraw; refreshInk(); break;
    case 'tool-pen': inkTool = inkTool === 'pen' ? null : 'pen'; refreshInk(); break;
    case 'tool-hl': inkTool = inkTool === 'hl' ? null : 'hl'; refreshInk(); break;
    case 'tool-eraser': inkTool = inkTool === 'eraser' ? null : 'eraser'; refreshInk(); break;
    case 'ink-undo': inkStep(inkUndo, inkRedo); break;
    case 'ink-clear': if(strokes.length){ pushInkUndo(); strokes = []; renderInk(); scheduleSave(); toast('Ink cleared. Tap Undo Ink to restore.'); } break;
    case 'wc': wordCount(); break;
    case 'spell': doc.spellcheck = !doc.spellcheck; a.setAttribute('aria-pressed', doc.spellcheck); toast(doc.spellcheck ? 'Spelling check on' : 'Spelling check off'); break;
    case 'speak': toggleSpeak(); break;
    case 'v-print': setView('print'); break;
    case 'v-mobile': setView('mobile'); break;
    case 'v-read': setReading(true); break;
    case 'fit': manualZoom = false; setZoom(fitZoom(), false); break;
  }
});
function keepFocus(e){
  if(e.target.closest('input, textarea')) return;
  e.preventDefault();
}
['#ribbonWrap', '#tabs'].forEach(function(s){
  $(s).addEventListener('pointerdown', keepFocus);
  $(s).addEventListener('mousedown', keepFocus);
});
menu.addEventListener('pointerdown', keepFocus);
menu.addEventListener('mousedown', keepFocus);
document.addEventListener('pointerdown', function(e){
  if(!menu.hidden && !menu.contains(e.target) && !e.target.closest('[data-menu]')) closeMenu();
});
$('#ribbon').addEventListener('scroll', closeMenu);
window.addEventListener('resize', function(){
  closeMenu();
  if(view === 'mobile'){ applyPage(); paginate(); }
  else if(!manualZoom){ zoom = fitZoom(); layoutAll(); }
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(!menu.hidden) closeMenu();
    else if(!$('#modal').hidden) $('#modal').hidden = true;
    else if(!$('#bs').hidden) closeBackstage();
    else if(reading) setReading(false);
    else if(aiOpenState && $('#ai').contains(document.activeElement)) aiToggle(false);
  }
});

/* ================= editor events ================= */
doc.addEventListener('input', function(){ ensureBlock(); scheduleSnap(); });
doc.addEventListener('beforeinput', function(e){
  if(e.inputType === 'historyUndo'){ e.preventDefault(); undo(); }
  else if(e.inputType === 'historyRedo'){ e.preventDefault(); redo(); }
});
doc.addEventListener('keydown', function(e){
  var mod = e.ctrlKey || e.metaKey;
  if(mod){
    var k = e.key.toLowerCase();
    if(k === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if(k === 'y'){ e.preventDefault(); redo(); }
    else if(k === 's'){ e.preventDefault(); save(); toast('Saved'); }
    else if(k === 'f'){ e.preventDefault(); openFind(); }
    return;
  }
  if(e.key !== 'Tab' || e.altKey) return;
  e.preventDefault();
  var cell = cellOf();
  if(cell){
    var cells = $$('td,th', cell.closest('table'));
    var i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
    if(i < 0) return;
    if(i >= cells.length){ tableOp('row+'); cells = $$('td,th', cell.closest('table')); }
    var t = cells[i];
    if(!t) return;
    var r = document.createRange();
    r.selectNodeContents(t); r.collapse(true);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    return;
  }
  var a = window.getSelection().anchorNode;
  var an = a && (a.nodeType === 3 ? a.parentElement : a);
  if(an && an.closest && an.closest('li')){ cmd(e.shiftKey ? 'outdent' : 'indent'); return; }
  var b = atParaStart();
  if(b){
    flushSnap();
    var next = Math.max(0, r2(toCm(b.style.textIndent) + (e.shiftKey ? -1.27 : 1.27)));
    b.style.textIndent = next ? next + 'cm' : '';
    afterCommand();
  }else if(!e.shiftKey){
    cmd('insertText', ' ');
  }
});

/* ================= AI assistant =================
   Two ways in, one protocol. The page turns the document into numbered blocks and asks an AI to answer with
   JSON "operations" (replace / insert / delete / format / table / find_replace / pagebreak).
   - Claude: called directly through the artifact "sample" capability (the viewer's own Claude account).
   - Any other AI (ChatGPT, Gemini, ...): the same prompt is copied out, and the reply is pasted back in.
   Operations are applied as ONE undo step, to the blocks as they were when the prompt was built. */
var AI_LEAF = 'p,h1,h2,h3,li,td,th,div';
var AI_FONTS = THAI.concat(LATIN);
var AI_CHIPS = [
  ['แก้คำผิด', 'ตรวจและแก้คำผิด การสะกด วรรคตอน และไวยากรณ์ โดยคงความหมาย ถ้อยคำ และรูปแบบเดิมให้มากที่สุด'],
  ['ภาษาทางการ', 'เรียบเรียงใหม่ให้เป็นภาษาทางการ สุภาพ กระชับ แต่ความหมายเท่าเดิม'],
  ['ย่อให้สั้น', 'ย่อให้สั้นลงประมาณครึ่งหนึ่ง โดยคงใจความสำคัญไว้'],
  ['ขยายความ', 'ขยายความให้ละเอียดขึ้น เพิ่มรายละเอียดที่เหมาะสม โดยไม่เปลี่ยนความหมาย'],
  ['สรุปท้ายเอกสาร', 'สรุปเนื้อหาเป็นข้อ ๆ สั้น ๆ แล้วเพิ่มต่อท้ายเอกสารภายใต้หัวข้อ "สรุป"'],
  ['Translate to English', 'Translate the text into natural English. Keep the structure and formatting.'],
  ['แปลเป็นไทย', 'แปลเนื้อหาเป็นภาษาไทยที่เป็นธรรมชาติ คงโครงสร้างและรูปแบบเดิม'],
  ['เขียนต่อ', 'เขียนต่อจากตำแหน่งเคอร์เซอร์ให้เนื้อหาต่อเนื่อง น้ำเสียงเดียวกัน ประมาณ 2-3 ย่อหน้า'],
  ['ทำเป็นตาราง', 'จัดข้อมูลที่เหมาะสมในเอกสารให้อยู่ในรูปตาราง พร้อมหัวตาราง'],
  ['จัดรูปแบบ', 'จัดรูปแบบเอกสารให้เรียบร้อยแบบเอกสารราชการ: หัวเรื่องกึ่งกลางตัวหนา ย่อหน้าเนื้อหาเว้นบรรทัดแรก 2.5 ซม. จัดชิดขอบสองข้าง ระยะบรรทัด 1.15 โดยไม่แก้ไขข้อความ']
];
var aiScope = 'sel', aiCtx = null;
var aiOpenState = false, aiCards = [], aiHist = [], aiHintT = null;

function aiEsc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function aiIndexIn(n){ return Array.prototype.indexOf.call(n.parentNode.childNodes, n); }

/* ---- reading the document ---- */
function aiBlocks(){
  return $$(AI_LEAF, doc).filter(function(b){
    if(b.classList.contains('pbreak')) return false;
    return !b.querySelector('p,h1,h2,h3,li,td,th,div,ul,ol,table');
  });
}
function aiInline(node){
  var out = '';
  Array.prototype.forEach.call(node.childNodes, function(n){
    if(n.nodeType === 3){ out += aiEsc(n.nodeValue.replace(/​/g, '')); return; }
    if(n.nodeType !== 1) return;
    var t = n.tagName, st = n.style || {};
    if(t === 'BR'){ out += '<br>'; return; }
    if(t === 'IMG'){ out += '[image]'; return; }
    var inner = aiInline(n);
    if(!inner) return;
    var td = (st.textDecoration || '') + ' ' + (st.textDecorationLine || '');
    if(t === 'A' && n.getAttribute('href')) inner = '<a href="' + aiEsc(n.getAttribute('href')) + '">' + inner + '</a>';
    if(t === 'U' || /underline/.test(td)) inner = '<u>' + inner + '</u>';
    if(t === 'S' || t === 'STRIKE' || t === 'DEL' || /line-through/.test(td)) inner = '<s>' + inner + '</s>';
    if(t === 'I' || t === 'EM' || st.fontStyle === 'italic') inner = '<i>' + inner + '</i>';
    if(t === 'B' || t === 'STRONG' || /^(bold|[6-9]00)$/.test(st.fontWeight || '')) inner = '<b>' + inner + '</b>';
    out += inner;
  });
  return out;
}
function aiDesc(b){
  var t = b.tagName.toLowerCase(), st = b.style, bits;
  if(t === 'li') bits = [b.parentNode && b.parentNode.tagName === 'OL' ? 'li-numbered' : 'li-bullet'];
  else if(t === 'td' || t === 'th'){
    var tb = b.closest('table'), tr = b.parentNode;
    bits = ['cell(T' + (tb ? $$('table', doc).indexOf(tb) + 1 : 0) + ',r' + ((tr.rowIndex || 0) + 1) + ',c' + ((b.cellIndex || 0) + 1) + ')'];
  }else bits = [t];
  if(st.textAlign) bits.push(st.textAlign);
  if(st.textIndent) bits.push('first=' + st.textIndent);
  if(st.marginLeft) bits.push('left=' + st.marginLeft);
  if(st.lineHeight) bits.push('line=' + st.lineHeight);
  if(b.querySelector('img')) bits.push('has-image');
  return bits.join(' ');
}
function aiOff(node, off){
  var r = document.createRange();
  r.selectNodeContents(doc);
  r.setEnd(node, off);
  return r.toString().length;
}
function aiSelInfo(blocks){
  var out = { sel:[], cursor:-1, text:'' };
  if(!saved || !doc.contains(saved.startContainer) || !doc.contains(saved.endContainer)) return out;
  var s0 = aiOff(saved.startContainer, saved.startOffset), s1 = aiOff(saved.endContainer, saved.endOffset);
  if(s1 > s0){
    out.text = saved.toString().replace(/​/g, '');
    if(out.text.replace(/\s/g, '')){
      /* cheap pass first; only the first and last candidate blocks need an exact character check */
      var cand = [];
      blocks.forEach(function(b, i){ if(saved.intersectsNode(b)) cand.push(i); });
      cand.forEach(function(i, k){
        if(k > 0 && k < cand.length - 1){ out.sel.push(i); return; }
        var b = blocks[i], st = aiOff(b.parentNode, aiIndexIn(b)), en = st + b.textContent.length;
        if(s0 < en && s1 > st) out.sel.push(i);
      });
    }
  }
  if(!out.sel.length){
    var n = saved.startContainer;
    for(var k = 0; k < blocks.length; k++){ if(blocks[k].contains(n)){ out.cursor = k; break; } }
  }
  return out;
}

/* ---- building the prompt ---- */
function aiBuild(instruction){
  var blocks = aiBlocks(), info = aiSelInfo(blocks);
  var scope = aiScope === 'doc' ? 'doc' : (info.sel.length ? 'sel' : 'cursor');
  var focus = {};
  if(scope === 'sel') info.sel.forEach(function(i){ focus[i] = 1; });
  if(scope === 'cursor' && info.cursor >= 0) focus[info.cursor] = 1;
  var htmls = blocks.map(function(b){ return aiInline(b).replace(/\s*\n\s*/g, ' '); });
  var scopeLine;
  if(scope === 'doc') scopeLine = 'SCOPE: the whole document. Apply the instruction to every block it concerns.';
  else if(scope === 'sel'){
    scopeLine = 'SCOPE: the user selected block' + (info.sel.length > 1 ? 's ' : ' ') + info.sel.join(', ') +
      '. Apply the instruction only to the selected block' + (info.sel.length > 1 ? 's' : '') +
      '. If the selection covers only part of a block, return that whole block with only the selected words changed.\nSELECTED TEXT: ' + JSON.stringify(info.text.slice(0, 3000));
  }else{
    scopeLine = 'SCOPE: nothing is selected' + (info.cursor >= 0 ? '; the cursor is in block ' + info.cursor : '') +
      '. Apply the instruction to the whole document, unless it only makes sense at the cursor (for example "continue writing" or "insert here"), then work at the cursor block.';
  }
  var head = [
    'You are the AI editor built into "SJN Word", a word processor like Microsoft Word. The user\'s document is listed below as numbered blocks. Carry out the user\'s instruction by editing the document.',
    '',
    'Reply with ONLY one JSON object, with no markdown fences and no text outside it:',
    '{"say":"<one or two sentences for the user, in the language of the instruction>","ops":[ ...operations... ]}',
    '',
    'Operations (i and after are block numbers from the list):',
    '{"op":"replace","i":3,"html":"new content of block 3"}',
    '{"op":"insert","after":3,"tag":"p","html":"..."}   a new block after block 3; after:-1 = at the very start; tag = p | h1 | h2 | h3 | li',
    '{"op":"delete","i":3}',
    '{"op":"format","i":[3,4],"align":"left|center|right|justify","left":1.27,"first":1.27,"before":0,"after":6,"line":1.5,"tag":"p|h1|h2|h3","font":"TH Sarabun New","size":16,"color":"#000000","bold":true,"italic":false,"underline":false}',
    '   (every key except "i" is optional; "i":"all" = every block; left and first are in cm, first negative = hanging indent; before, after and size are in pt)',
    '{"op":"table","after":3,"rows":[["Name","Qty"],["Pen","2"]]}   the first row is the header',
    '{"op":"find_replace","find":"old text","with":"new text"}   every occurrence in the document',
    '{"op":"pagebreak","after":3}',
    '',
    'Rules:',
    '- "html" may contain only <b> <i> <u> <s> <br> and <a href>. Write literal & < > as &amp; &lt; &gt;. One block per paragraph; never put several paragraphs in one block.',
    '- Change only what the instruction needs. Blocks you do not mention stay exactly as they are, so do not resend unchanged blocks.',
    '- Keep the document\'s language, spelling and tone unless asked to change them.',
    '- If the request is a question, or nothing should change, answer in "say" and return "ops":[].',
    '- Fonts you may use: ' + AI_FONTS.join(', ') + '.',
    '',
    scopeLine
  ];
  if(aiHist.length){
    head.push('', 'RECENT EXCHANGE (context only; the document below is the current state):');
    aiHist.slice(-3).forEach(function(h){ head.push('User: ' + h.u, 'You: ' + h.a); });
  }
  function listing(limit){
    return blocks.map(function(b, i){
      var h = htmls[i];
      if(limit && !focus[i] && h.length > limit) h = h.slice(0, limit) + ' …[truncated; do not edit]';
      return '[' + i + '] ' + aiDesc(b) + ': ' + h;
    }).join('\n');
  }
  function assemble(limit){
    return head.join('\n') + '\n\nDOCUMENT (' + blocks.length + ' blocks):\n' + listing(limit) + '\n\nUSER INSTRUCTION:\n' + instruction + '\n';
  }
  var enc = new TextEncoder(), prompt = assemble(0);
  if(enc.encode(prompt).length > 245000) prompt = assemble(120);
  if(enc.encode(prompt).length > 245000) return { err:'The document is too long to send in one go. Select the part you want changed and try again.' };
  return { prompt:prompt, ctx:{ blocks:blocks.slice(), html:htmls.slice(), instruction:instruction } };
}

/* ---- reading the reply ---- */
function aiParse(text){
  var t = String(text || '').trim(), cands = [], m = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if(m) cands.push(m[1]);
  cands.push(t);
  var a = t.indexOf('{'), z = t.lastIndexOf('}');
  if(a >= 0 && z > a) cands.push(t.slice(a, z + 1));
  for(var k = 0; k < cands.length; k++){
    try{
      var o = JSON.parse(cands[k].trim());
      if(Array.isArray(o)) o = { ops:o };
      if(o && typeof o === 'object' && (Array.isArray(o.ops) || typeof o.say === 'string')) return o;
    }catch(e){}
  }
  return null;
}
var AI_ALIAS = { edit:'replace', rewrite:'replace', replace_text:'replace', add:'insert', insert_after:'insert', remove:'delete',
  style:'format', formatting:'format', replace_all:'find_replace', page_break:'pagebreak' };
function aiClean(html){
  var s = String(html == null ? '' : html);
  if(s.indexOf('<') < 0 && s.indexOf('&') < 0) return aiEsc(s).replace(/\r?\n/g, '<br>');
  var tp = document.createElement('template');
  tp.innerHTML = s.replace(/\r?\n/g, ' ');
  var out = document.createElement('div');
  var MAP = { B:'b', STRONG:'b', I:'i', EM:'i', U:'u', S:'s', STRIKE:'s', DEL:'s', SUB:'sub', SUP:'sup' };
  (function walk(src, dst){
    Array.prototype.forEach.call(src.childNodes, function(n){
      if(n.nodeType === 3){ dst.appendChild(document.createTextNode(n.nodeValue)); return; }
      if(n.nodeType !== 1) return;
      var t = n.tagName;
      if(t === 'SCRIPT' || t === 'STYLE') return;
      if(t === 'BR'){ dst.appendChild(document.createElement('br')); return; }
      if(MAP[t]){ var e = document.createElement(MAP[t]); walk(n, e); dst.appendChild(e); return; }
      if(t === 'A'){
        var h = (n.getAttribute('href') || '').trim();
        if(/^(https?:|mailto:|tel:)/i.test(h)){
          var a = document.createElement('a');
          a.setAttribute('href', h); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
          walk(n, a); dst.appendChild(a); return;
        }
      }
      walk(n, dst);
    });
  })(tp.content, out);
  return out.innerHTML;
}
function aiDomStyle(b){
  var total = b.textContent.replace(/​/g, '').length, spans = $$('span[style]', b);
  for(var i = 0; i < spans.length; i++){
    var s = spans[i].style;
    if(!(s.fontFamily || s.fontSize || s.color)) continue;
    var len = spans[i].textContent.replace(/​/g, '').length;
    if(!total || len >= total * 0.6) return { fontFamily:s.fontFamily, fontSize:s.fontSize, color:s.color };
  }
  return null;
}
function aiSetContent(b, html, styleSrc){
  var clean = aiClean(html), ds = aiDomStyle(styleSrc || b);
  b.innerHTML = '';
  if(!clean){ b.appendChild(document.createElement('br')); return; }
  if(ds){
    var sp = document.createElement('span');
    if(ds.fontFamily) sp.style.fontFamily = ds.fontFamily;
    if(ds.fontSize) sp.style.fontSize = ds.fontSize;
    if(ds.color) sp.style.color = ds.color;
    sp.innerHTML = clean;
    b.appendChild(sp);
  }else b.innerHTML = clean;
}
function aiTargets(v, n){
  var list;
  if(v === 'all') list = Array.apply(null, { length:n }).map(function(_, i){ return i; });
  else if(Array.isArray(v)) list = v;
  else if(v == null) list = [];
  else list = [v];
  return list.map(Number).filter(function(i){ return isFinite(i) && i >= 0 && i < n && Math.floor(i) === i; });
}
function aiUnwrap(e){ var p = e.parentNode; while(e.firstChild) p.insertBefore(e.firstChild, e); p.removeChild(e); }

/* ---- applying operations (one undo step) ---- */
function aiApplyOps(ops){
  var ctx = aiCtx;
  if(!ctx) return null;
  var n = ctx.blocks.length;
  var res = { replaced:0, inserted:0, deleted:0, formatted:0, tables:0, found:0, settings:0, skipped:0 }, relayoutNeeded = false, hfNeeded = false;
  var stale = ctx.blocks.map(function(b, i){ return !(doc.contains(b) && aiInline(b).replace(/\s*\n\s*/g, ' ') === ctx.html[i]); });
  var changed = [], tail = {};
  function live(i){ return !stale[i] && ctx.blocks[i] && doc.contains(ctx.blocks[i]); }
  function topOf(x){ while(x && x.parentNode !== doc) x = x.parentNode; return x; }
  function place(el, afterIdx, listType){
    var key = String(afterIdx), ref = null;
    if(tail[key] && doc.contains(tail[key])) ref = tail[key];
    else if(afterIdx !== -1){
      var a = ctx.blocks[afterIdx];
      if(!a || !doc.contains(a) || stale[afterIdx]) return null;
      ref = a;
    }
    var isLi = el.tagName === 'LI';
    if(ref && ref.tagName === 'LI' && isLi){
      var pt = ref.parentNode.tagName === 'OL' ? 'number' : 'bullet';
      if(!listType || listType === pt){ ref.parentNode.insertBefore(el, ref.nextSibling); tail[key] = el; return el; }
    }
    var node = el;
    if(isLi){ node = document.createElement(listType === 'number' ? 'ol' : 'ul'); node.appendChild(el); }
    if(!ref){ doc.insertBefore(node, doc.firstChild); }
    else{
      var top = topOf(ref);
      if(!top) return null;
      doc.insertBefore(node, top.nextSibling);
    }
    tail[key] = el;
    return el;
  }
  function retag(b, tag){
    if(b.tagName.toLowerCase() === tag || /^(LI|TD|TH)$/.test(b.tagName) || !b.parentNode) return b;
    var e = document.createElement(tag);
    Array.prototype.slice.call(b.attributes).forEach(function(a){ e.setAttribute(a.name, a.value); });
    while(b.firstChild) e.appendChild(b.firstChild);
    b.parentNode.replaceChild(e, b);
    return e;
  }
  function clearDesc(b, prop){ $$('*', b).forEach(function(e){ if(e.style) e.style[prop] = ''; }); }
  function formatBlock(i, op){
    var b = ctx.blocks[i], st, v;
    if(op.tag && ['p', 'h1', 'h2', 'h3'].indexOf(String(op.tag).toLowerCase()) >= 0){ b = retag(b, String(op.tag).toLowerCase()); ctx.blocks[i] = b; }
    st = b.style;
    if(['left', 'center', 'right', 'justify'].indexOf(op.align) >= 0) st.textAlign = op.align;
    if(isFinite(parseFloat(op.left))){ v = Math.max(0, Math.min(15, parseFloat(op.left))); st[sideProp(b, 'Left')] = v ? r2(v) + 'cm' : ''; }
    if(isFinite(parseFloat(op.right))){ v = Math.max(0, Math.min(15, parseFloat(op.right))); st[sideProp(b, 'Right')] = v ? r2(v) + 'cm' : ''; }
    if(isFinite(parseFloat(op.first))){ v = Math.max(-10, Math.min(15, parseFloat(op.first))); st.textIndent = v ? r2(v) + 'cm' : ''; }
    if(isFinite(parseFloat(op.before))) st.marginTop = Math.max(0, Math.min(200, parseFloat(op.before))) + 'pt';
    if(isFinite(parseFloat(op.after))) st.marginBottom = Math.max(0, Math.min(200, parseFloat(op.after))) + 'pt';
    if(isFinite(parseFloat(op.line))) st.lineHeight = String(Math.max(0.8, Math.min(4, parseFloat(op.line))));
    if(typeof op.font === 'string'){
      var f = AI_FONTS.filter(function(x){ return x.toLowerCase() === op.font.trim().toLowerCase(); })[0];
      if(f){ clearDesc(b, 'fontFamily'); st.fontFamily = stackFor(f); }
    }
    if(isFinite(parseFloat(op.size))){ clearDesc(b, 'fontSize'); st.fontSize = Math.max(6, Math.min(200, parseFloat(op.size))) + 'pt'; }
    if(typeof op.color === 'string' && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(op.color.trim()) && window.CSS && CSS.supports('color', op.color.trim())){
      clearDesc(b, 'color'); st.color = op.color.trim();
    }
    if(typeof op.bold === 'boolean'){
      if(op.bold) st.fontWeight = '700';
      else{ $$('b,strong', b).forEach(aiUnwrap); clearDesc(b, 'fontWeight'); st.fontWeight = '400'; }
    }
    if(typeof op.italic === 'boolean'){
      if(op.italic) st.fontStyle = 'italic';
      else{ $$('i,em', b).forEach(aiUnwrap); clearDesc(b, 'fontStyle'); st.fontStyle = 'normal'; }
    }
    if(typeof op.underline === 'boolean'){
      if(op.underline) st.textDecoration = 'underline';
      else{ $$('u', b).forEach(aiUnwrap); clearDesc(b, 'textDecoration'); st.textDecoration = 'none'; }
    }
    if(op.dir === 'rtl' || op.dir === 'ltr') b.setAttribute('dir', op.dir);
    changed.push(b);
    res.formatted++;
  }
  function one(op){
    var kind = String(op.op || '').toLowerCase();
    kind = AI_ALIAS[kind] || kind;
    var iv = op.i != null ? op.i : (op.index != null ? op.index : op.block);
    var html = typeof op.html === 'string' ? op.html : (typeof op.text === 'string' ? op.text : null);
    var i, b;
    if(kind === 'replace'){
      i = Number(iv);
      if(!isFinite(i) || !live(i) || html == null || ctx.blocks[i].querySelector('img')){ res.skipped++; return; }
      b = ctx.blocks[i];
      aiSetContent(b, html);
      if(aiInline(b).replace(/\s*\n\s*/g, ' ') !== ctx.html[i]){ changed.push(b); res.replaced++; }
    }else if(kind === 'insert'){
      var after = op.after != null ? Number(op.after) : -1;
      if(!isFinite(after) || after < -1 || after >= n){ res.skipped++; return; }
      var items = Array.isArray(op.blocks) ? op.blocks.slice(0, 300) : [op];
      items.forEach(function(it){
        if(!it || typeof it !== 'object'){ res.skipped++; return; }
        var ih = typeof it.html === 'string' ? it.html : (typeof it.text === 'string' ? it.text : null);
        var tag = String(it.tag || 'p').toLowerCase();
        if(['p', 'h1', 'h2', 'h3', 'li'].indexOf(tag) < 0) tag = 'p';
        if(ih == null){ res.skipped++; return; }
        var e = document.createElement(tag);
        aiSetContent(e, ih, after >= 0 && live(after) && tag === 'p' ? ctx.blocks[after] : null);
        var lt = it.list === 'number' || it.list === 'bullet' ? it.list : null;
        if(place(e, after, lt)){ changed.push(e); res.inserted++; } else res.skipped++;
      });
    }else if(kind === 'delete'){
      aiTargets(iv, n).forEach(function(k){
        if(!live(k) || ctx.blocks[k].querySelector('img')){ res.skipped++; return; }
        var blk = ctx.blocks[k], par = blk.parentNode;
        if(blk.tagName === 'TD' || blk.tagName === 'TH') blk.innerHTML = '<br>';
        else{
          par.removeChild(blk);
          if((par.tagName === 'UL' || par.tagName === 'OL') && !par.children.length && par.parentNode) par.parentNode.removeChild(par);
        }
        res.deleted++;
      });
    }else if(kind === 'format'){
      var ts = aiTargets(iv, n).filter(live);
      if(!ts.length){ res.skipped++; return; }
      ts.forEach(function(k){ formatBlock(k, op); });
    }else if(kind === 'table'){
      var rows = Array.isArray(op.rows) ? op.rows.slice(0, 60) : null;
      var aft = op.after != null ? Number(op.after) : -1;
      if(!rows || !rows.length || !isFinite(aft) || aft < -1 || aft >= n){ res.skipped++; return; }
      var cols = Math.min(12, rows.reduce(function(m, r){ return Math.max(m, Array.isArray(r) ? r.length : 0); }, 0));
      if(!cols){ res.skipped++; return; }
      var tb = document.createElement('table'), body = document.createElement('tbody');
      rows.forEach(function(r, ri){
        var tr = document.createElement('tr');
        for(var c = 0; c < cols; c++){
          var cell = document.createElement('td');
          var val = Array.isArray(r) && r[c] != null ? r[c] : '';
          cell.innerHTML = aiClean(String(val)) || '<br>';
          if(ri === 0 && op.header !== false) cell.style.fontWeight = '700';
          tr.appendChild(cell);
        }
        body.appendChild(tr);
      });
      tb.appendChild(body);
      if(place(tb, aft)){
        var nx = tb.nextElementSibling;
        if(!nx || nx.tagName === 'TABLE'){ var pp = document.createElement('p'); pp.innerHTML = '<br>'; doc.insertBefore(pp, tb.nextSibling); }
        changed.push(tb); res.tables++;
      }else res.skipped++;
    }else if(kind === 'find_replace'){
      var f = String(op.find == null ? '' : op.find), w = String(op['with'] == null ? (op.replace == null ? '' : op.replace) : op['with']);
      if(!f || f.length > 500){ res.skipped++; return; }
      var walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT), nodes = [], nd, cnt = 0;
      while((nd = walker.nextNode())) nodes.push(nd);
      nodes.forEach(function(t){
        var v = t.nodeValue;
        if(v.indexOf(f) >= 0){ var parts = v.split(f); cnt += parts.length - 1; t.nodeValue = parts.join(w); changed.push(t.parentElement); }
      });
      if(cnt) res.found += cnt; else res.skipped++;
    }else if(kind === 'pagebreak'){
      var pa = op.after != null ? Number(op.after) : -1;
      if(!isFinite(pa) || pa < -1 || pa >= n){ res.skipped++; return; }
      var pb = document.createElement('div');
      pb.className = 'pbreak'; pb.setAttribute('contenteditable', 'false');
      if(place(pb, pa)){
        var p2 = document.createElement('p'); p2.innerHTML = '<br>';
        doc.insertBefore(p2, pb.nextSibling);
        res.inserted++;
      }else res.skipped++;
    }else if(kind === 'page'){
      var pc = false, sz = typeof op.size === 'string' ? Object.keys(PAGE_SIZES).filter(function(k){ return k.toLowerCase() === op.size.trim().toLowerCase(); })[0] : null;
      if(sz){ page.size = sz; pc = true; }
      if(/^(landscape|portrait)$/i.test(String(op.orientation || ''))){ page.land = /^landscape$/i.test(op.orientation); pc = true; }
      if(op.margins && typeof op.margins === 'object'){
        [['top', 'mt'], ['bottom', 'mb'], ['left', 'ml'], ['right', 'mr']].forEach(function(k){
          var v = parseFloat(op.margins[k[0]]);
          if(isFinite(v)){ page[k[1]] = Math.round(Math.max(0, Math.min(10, v)) * 96 / 2.54); pc = true; }
        });
      }
      if(pc){ relayoutNeeded = true; res.settings++; } else res.skipped++;
    }else if(kind === 'header_footer'){
      var hc = false;
      if(typeof op.header === 'string'){ hf.header = op.header.slice(0, 200); hc = true; }
      if(typeof op.footer === 'string'){ hf.footer = op.footer.slice(0, 200); hc = true; }
      if(typeof op.page_number === 'string' && ['none', 'tl', 'tc', 'tr', 'bl', 'bc', 'br'].indexOf(op.page_number) >= 0){ hf.pos = op.page_number; hc = true; }
      if(typeof op.format === 'string' && op.format.trim()){
        hf.fmt = op.format.slice(0, 60); hc = true;
        if(hf.pos === 'none' && typeof op.page_number !== 'string') hf.pos = 'bc';
      }
      if(hc){ hfNeeded = true; res.settings++; } else res.skipped++;
    }else if(kind === 'title'){
      var tt = typeof op.text === 'string' ? op.text : (typeof op.title === 'string' ? op.title : '');
      if(tt.trim()){ setTitle(tt.trim().slice(0, 120)); res.settings++; } else res.skipped++;
    }else res.skipped++;
  }
  flushSnap();
  ops.slice(0, 400).forEach(function(op){
    if(!op || typeof op !== 'object'){ res.skipped++; return; }
    try{ one(op); }catch(e){ res.skipped++; }
  });
  var total = res.replaced + res.inserted + res.deleted + res.formatted + res.tables + res.found;
  if(relayoutNeeded) relayout(true);
  if(hfNeeded){ renderDeco(pageCount()); scheduleSave(); }
  if(total){
    ensureBlock();
    if(saved && !doc.contains(saved.startContainer)) saved = null;
    afterCommand();
    aiFlash(changed);
  }
  res.total = total + res.settings;
  return res;
}
function aiFlash(els){
  var seen = [], first = null, h = hasHL ? new Highlight() : null;
  els.forEach(function(e){
    if(!e || !doc.contains(e) || seen.indexOf(e) >= 0) return;
    seen.push(e);
    if(!first) first = e;
    if(h){ var r = document.createRange(); r.selectNodeContents(e); h.add(r); }
  });
  if(h){
    CSS.highlights.set('aiflash', h);
    setTimeout(function(){ CSS.highlights.delete('aiflash'); }, 2400);
  }
  if(first){
    var fr = first.getBoundingClientRect(), dr = desk.getBoundingClientRect();
    if(fr.top < dr.top + 20 || fr.bottom > dr.bottom - 20) desk.scrollTop += fr.top - dr.top - dr.height * 0.3;
  }
}
function aiSummary(r){
  var p = [];
  if(r.replaced) p.push(r.replaced + ' rewritten');
  if(r.inserted) p.push(r.inserted + ' added');
  if(r.tables) p.push(r.tables + ' table' + (r.tables > 1 ? 's' : ''));
  if(r.deleted) p.push(r.deleted + ' removed');
  if(r.formatted) p.push(r.formatted + ' formatted');
  if(r.found) p.push(r.found + ' word' + (r.found > 1 ? 's' : '') + ' replaced');
  if(r.settings) p.push(r.settings + ' document setting' + (r.settings > 1 ? 's' : ''));
  var s = p.length ? 'Applied: ' + p.join(', ') + '.' : 'Nothing was changed.';
  if(r.skipped) s += ' Skipped ' + r.skipped + ' (the text changed in the meantime or the step was not valid).';
  return s;
}

/* ---- cards (one per request) ---- */
function aiCardAdd(req, o){
  var c = { req:req, stat:'', say:'', res:'', err:'', acts:null };
  Object.keys(o || {}).forEach(function(k){ c[k] = o[k]; });
  aiCards.unshift(c);
  if(aiCards.length > 12) aiCards.length = 12;
  aiRender();
  return c;
}
function aiRender(){
  var box = $('#aiLog');
  box.innerHTML = '';
  aiCards.forEach(function(c){
    var d = el('div', 'aic');
    var rq = el('div', 'aireq'); rq.textContent = '“' + (c.req.length > 140 ? c.req.slice(0, 140) + '…' : c.req) + '”'; d.appendChild(rq);
    if(c.stat){ var s = el('div', 'aistat'); s.textContent = c.stat; d.appendChild(s); }
    if(c.say){ var y = el('div', 'aisay'); y.textContent = c.say; d.appendChild(y); }
    if(c.res){ var r = el('div', 'aires'); r.textContent = c.res; d.appendChild(r); }
    if(c.err){ var e = el('div', 'aierr'); e.textContent = c.err; d.appendChild(e); }
    if(c.acts && c.acts.length){
      var a = el('div', 'acts');
      c.acts.forEach(function(x){
        var b = el('button'); b.type = 'button'; b.textContent = x.t;
        b.addEventListener('click', function(){ x.f(c); });
        a.appendChild(b);
      });
      d.appendChild(a);
    }
    box.appendChild(d);
  });
}
function aiFinish(card, text, truncated){
  if(truncated){ card.err = 'The reply was cut off before it finished, so nothing was changed. Select a smaller part and try again.'; return; }
  var obj = aiParse(text);
  if(!obj){
    var plain = String(text || '').trim();
    card.say = plain || '(empty reply)';
    card.acts = [
      { t:'Insert at cursor', f:function(){ aiInsertText(plain); } },
      { t:'Copy', f:function(){ copyText(plain, 'Copied'); } }
    ];
    return;
  }
  var say = typeof obj.say === 'string' ? obj.say.trim() : '', ops = Array.isArray(obj.ops) ? obj.ops : [];
  card.say = say || (ops.length ? '' : '(no changes)');
  aiHist.push({ u:aiCtx ? aiCtx.instruction : '', a:say });
  if(aiHist.length > 6) aiHist.shift();
  if(!ops.length) return;
  var r = aiApplyOps(ops);
  if(!r){ card.err = 'Copy the prompt again first, so the block numbers match this document.'; return; }
  card.res = aiSummary(r);
  if(r.total){
    card.acts = [{ t:'Undo', f:function(c){ undo(); c.res += ' (undone)'; c.acts = null; aiRender(); } }];
    if(!aiOpenState) toast('AI edit applied. Tap Undo to revert.');
  }
}
function aiInsertText(text){
  var html = String(text).split(/\n+/).filter(function(l){ return l.trim(); }).map(function(l){ return '<p>' + aiEsc(l) + '</p>'; }).join('');
  if(!html) return;
  if(!saved || !doc.contains(saved.startContainer)) caretToEnd();
  cmd('insertHTML', html);
}
function aiCopyPrompt(){
  var instr = $('#aiIn').value.trim();
  if(!instr){ toast('Type your instruction first'); $('#aiIn').focus(); return; }
  var built = aiBuild(instr);
  if(built.err){ aiCardAdd(instr, { err:built.err }); return; }
  aiCtx = built.ctx;
  copyText(built.prompt, 'Prompt copied. Paste it into ChatGPT, Gemini or any AI.');
}
function aiApplyPasted(){
  var box = $('#aiPaste'), text = box.value.trim();
  if(!text){ toast('Paste the AI\'s reply first'); return; }
  var req = aiCtx ? aiCtx.instruction : 'Pasted reply';
  var card = aiCardAdd(req, {});
  if(!aiCtx && aiParse(text) && (aiParse(text).ops || []).length){
    card.err = 'Tap "Copy prompt" first, so the block numbers in the reply match this document.';
    aiRender(); return;
  }
  aiFinish(card, text, false);
  aiRender();
  if(!card.err) box.value = '';
}
function aiQuick(k){
  aiToggle(true);
  $('#aiIn').value = AI_CHIPS[k][1];
  $('#aiIn').focus();
}

/* ---- pane ---- */
function aiHint(){
  if(!aiOpenState) return;
  var b = aiBlocks(), i = aiSelInfo(b), t;
  if(aiScope === 'doc') t = 'Whole document · ' + b.length + ' paragraph' + (b.length === 1 ? '' : 's');
  else if(i.sel.length) t = 'Selection · ' + i.sel.length + ' paragraph' + (i.sel.length === 1 ? '' : 's') + ' (' + i.text.replace(/\s+/g, ' ').trim().length + ' characters)';
  else t = 'Nothing selected · the AI can work on the whole document or at your cursor';
  $('#aiHint').textContent = t;
  if(hasHL){
    CSS.highlights.delete('aisel');
    if(i.sel.length && saved){ var h = new Highlight(); h.add(saved.cloneRange()); CSS.highlights.set('aisel', h); }
  }
}
function aiSoon(){ clearTimeout(aiHintT); aiHintT = setTimeout(aiHint, 220); }
function aiLayout(){
  var wide = window.innerWidth >= 1000;
  document.body.classList.toggle('aipush', aiOpenState && wide);
  document.body.classList.toggle('aibot', aiOpenState && !wide);
  $('#ai').classList.toggle('side', wide);
  $$('[data-act="ai"]').forEach(function(b){ b.setAttribute('aria-pressed', aiOpenState ? 'true' : 'false'); });
  if(!manualZoom) zoom = fitZoom();
  layoutAll();
  refreshSoon();
}
function aiToggle(force){
  var on = typeof force === 'boolean' ? force : !aiOpenState;
  if(on === aiOpenState) return;
  aiOpenState = on;
  $('#ai').hidden = !on;
  closeMenu();
  aiLayout();
  if(on) aiHint();
  else if(hasHL) CSS.highlights.delete('aisel');
}
/* ---- Claude connector: commands from the relay ---- */
var bridgeCfg = { server:'', key:'', enabled:false };
function bridgeSaveCfg(){ return SJNStore.setMeta('bridge', { server:bridgeCfg.server, key:bridgeCfg.key, enabled:bridgeCfg.enabled }); }
function aiListing(blocks, htmls, only, short){
  return blocks.map(function(b, i){
    if(only && only.indexOf(i) < 0) return null;
    var h = htmls[i];
    if(short && h.length > 200) h = h.slice(0, 200) + ' …[truncated; do not edit]';
    return '[' + i + '] ' + aiDesc(b) + ': ' + h;
  }).filter(function(x){ return x != null; }).join('\n');
}
function bridgeDocText(scope, maxChars){
  var blocks = aiBlocks(), info = aiSelInfo(blocks);
  var htmls = blocks.map(function(b){ return aiInline(b).replace(/\s*\n\s*/g, ' '); });
  aiCtx = { blocks:blocks.slice(), html:htmls.slice(), instruction:'Claude (connector)' };
  var cm = function(px){ return r2(px * 2.54 / 96); };
  var head = [
    'Title: ' + title,
    'Document id: ' + docId,
    'Page: ' + page.size + ' ' + (page.land ? 'landscape' : 'portrait') + ', margins cm top ' + cm(page.mt) + ' right ' + cm(page.mr) + ' bottom ' + cm(page.mb) + ' left ' + cm(page.ml),
    'Header: ' + (hf.header || '(none)') + ' | Footer: ' + (hf.footer || '(none)'),
    'Page numbers: ' + (hf.pos === 'none' ? 'none' : hf.pos + ' format "' + hf.fmt + '"'),
    'Selection: ' + (info.sel.length ? 'blocks ' + info.sel.join(', ') + ' – "' + info.text.replace(/\s+/g, ' ').slice(0, 300) + '"' : (info.cursor >= 0 ? 'none, cursor in block ' + info.cursor : 'none')),
    'Blocks: ' + blocks.length, ''
  ];
  var only = null;
  if(scope === 'selection') only = info.sel.length ? info.sel : (info.cursor >= 0 ? [info.cursor] : []);
  var cap = Math.max(2000, Math.min(400000, maxChars || 120000));
  var body = aiListing(blocks, htmls, only, false);
  if(body.length > cap) body = aiListing(blocks, htmls, only, true);
  if(body.length > cap) body = body.slice(0, cap) + '\n…[listing cut here; later blocks are not shown]';
  if(only && !only.length) body = '(nothing is selected)';
  return head.join('\n') + body;
}
function bridgeCommand(tool, args){
  if(tool === 'get_document'){
    return { text:bridgeDocText(args.scope, args.max_chars) };
  }
  if(tool === 'edit'){
    if(!aiCtx) throw new Error('Call word_get_document first, so the block numbers are known.');
    var req = (args.say || 'Edit').toString();
    var r = aiApplyOps(args.ops || []);
    var card = aiCardAdd('Claude: ' + req, { say:'', res:aiSummary(r) });
    if(r.total) card.acts = [{ t:'Undo', f:function(c){ undo(); c.res += ' (undone)'; c.acts = null; aiRender(); } }];
    if(r.total && !aiOpenState) toast('Claude edited the document. Open the AI pane to undo.');
    return { text:aiSummary(r) + '\n\n' + bridgeDocText('all') };
  }
  if(tool === 'list_documents'){
    return save().then(function(){ return SJNStore.list(); }).then(function(l){
      return { text:l.length ? l.map(function(d){ return d.id + ' | ' + d.title + ' | edited ' + new Date(d.updated).toISOString() + (d.id === docId ? ' | OPEN NOW' : ''); }).join('\n') : '(no documents)' };
    });
  }
  if(tool === 'open_document'){
    return openDocument(String(args.id)).then(function(){ return { text:'Opened "' + title + '". Call word_get_document to read it.' }; });
  }
  if(tool === 'new_document'){
    return createDocument({ title:args.title ? String(args.title).slice(0, 120) : '' }).then(function(){ return { text:'Created "' + title + '" (id ' + docId + ') and opened it. It is empty: call word_get_document, then word_edit.' }; });
  }
  throw new Error('Unknown command: ' + tool);
}

/* ---- Claude connector: pane UI ---- */
function aiConnUI(){
  var s = SJNBridge.state();
  var map = { off:'Not connected', connecting:'Connecting…', online:'Connected. Claude can use this document.', offline:'Connection lost. Retrying…',
    superseded:'Another window took over this connection.', error:s.detail || 'Error' };
  $('#aiStatus').textContent = map[s.status] || s.status;
  $('#aiDot').className = 'aidot ' + s.status;
  var on = s.status === 'connecting' || s.status === 'online' || s.status === 'offline';
  $('#aiConnect').hidden = on; $('#aiDisconnect').hidden = !on;
  $('#aiConnect').textContent = s.status === 'superseded' ? 'Take over' : 'Connect';
  $$('[data-act="ai"]').forEach(function(b){ b.classList.toggle('live', s.status === 'online'); });
  var rel = $('#aiRelay').value.trim();
  $('#aiUrl').value = SJNBridge.validServer(rel) && bridgeCfg.key ? SJNBridge.connectorUrl(rel, bridgeCfg.key) : '';
  $('#aiCopyUrl').disabled = !$('#aiUrl').value;
  $('#aiKey').value = bridgeCfg.key;
}
function aiOpenConnect(){
  $('#aiSetup').open = true;
  setTimeout(function(){ var e = $('#aiConn'); if(e && e.scrollIntoView) e.scrollIntoView({ block:'start' }); }, 50);
}
function aiConnect(){
  var rel = SJNBridge.clean($('#aiRelay').value);
  $('#aiRelay').value = rel;
  if(!SJNBridge.validServer(rel)){ toast('Type the relay address first, like https://your-relay.example.com'); $('#aiRelay').focus(); return; }
  bridgeCfg.server = rel; bridgeCfg.enabled = true;
  bridgeSaveCfg();
  SJNBridge.start({ server:rel, key:bridgeCfg.key, handler:bridgeCommand });
}
function aiDisconnect(){
  bridgeCfg.enabled = false; bridgeSaveCfg();
  SJNBridge.stop();
}
function bridgeInit(){
  SJNBridge.setHandler(bridgeCommand);
  SJNBridge.onStatus(aiConnUI);
  return SJNStore.getMeta('bridge').then(function(c){
    if(c && typeof c === 'object') bridgeCfg = { server:c.server || '', key:c.key || '', enabled:!!c.enabled };
    if(!/^[A-Za-z0-9_-]{24,64}$/.test(bridgeCfg.key)){ bridgeCfg.key = SJNBridge.randomKey(); bridgeSaveCfg(); }
    $('#aiRelay').value = bridgeCfg.server;
    aiConnUI();
    if(bridgeCfg.enabled && SJNBridge.validServer(bridgeCfg.server)) SJNBridge.start({ server:bridgeCfg.server, key:bridgeCfg.key, handler:bridgeCommand });
  }).catch(function(){ bridgeCfg.key = SJNBridge.randomKey(); aiConnUI(); });
}

(function aiInit(){
  var chips = $('#aiChips');
  AI_CHIPS.forEach(function(c, k){
    var b = el('button', 'chip'); b.type = 'button'; b.textContent = c[0];
    b.addEventListener('click', function(){ aiQuick(k); });
    chips.appendChild(b);
  });
  $$('#aiScope button').forEach(function(b){
    b.addEventListener('click', function(){
      aiScope = b.getAttribute('data-v');
      $$('#aiScope button').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      aiHint();
    });
  });
  $('#aiClose').addEventListener('click', function(){ aiToggle(false); });
  $('#aiCopy').addEventListener('click', aiCopyPrompt);
  $('#aiApply').addEventListener('click', aiApplyPasted);
  $('#aiPasteBtn').addEventListener('click', function(){
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){ $('#aiPaste').value = t; }, function(){ toast('Paste is blocked here. Long-press the box and choose Paste.'); });
    }else toast('Long-press the box and choose Paste.');
  });
  $('#aiConnect').addEventListener('click', aiConnect);
  $('#aiDisconnect').addEventListener('click', aiDisconnect);
  $('#aiRelay').addEventListener('input', aiConnUI);
  $('#aiCopyUrl').addEventListener('click', function(){ copyText($('#aiUrl').value, 'Connector address copied'); });
  $('#aiKeyNew').addEventListener('click', function(){
    if(!$('#aiKeyNew').getAttribute('data-sure')){
      $('#aiKeyNew').setAttribute('data-sure', '1'); $('#aiKeyNew').textContent = 'Really? Tap again';
      setTimeout(function(){ $('#aiKeyNew').removeAttribute('data-sure'); $('#aiKeyNew').textContent = 'New key'; }, 3500);
      return;
    }
    $('#aiKeyNew').removeAttribute('data-sure'); $('#aiKeyNew').textContent = 'New key';
    var wasOn = SJNBridge.state().status !== 'off';
    SJNBridge.stop();
    bridgeCfg.key = SJNBridge.randomKey(); bridgeSaveCfg();
    aiConnUI();
    if(wasOn && SJNBridge.validServer($('#aiRelay').value)) aiConnect();
    toast('New key made. Add the new connector address in Claude.');
  });
  window.addEventListener('resize', function(){ if(aiOpenState) aiLayout(); });
})();

/* ================= sample and boot ================= */
function sampleHTML(){
  var f = function(name, text){ return '<p style="font-family:\'' + name + '\',\'Sarabun\',sans-serif">' + name + '  ' + text + '</p>'; };
  return '' +
  '<p style="text-align:center"><span style="font-size:29pt"><b>บันทึกข้อความ</b></span></p>' +
  '<p><b>เรื่อง</b>  ขอเชิญประชุมคณะทำงานประจำเดือนตุลาคม ๒๕๖๙</p>' +
  '<p><b>เรียน</b>  คณะทำงานทุกท่าน</p>' +
  '<p style="text-align:justify;text-indent:2.5cm">ด้วยฝ่ายบริหารทั่วไปมีกำหนดจัดประชุมคณะทำงานในวันพุธที่ ๑๔ ตุลาคม ๒๕๖๙ เวลา ๑๓.๓๐ น. เพื่อติดตามความคืบหน้าของโครงการและวางแผนงานไตรมาสสุดท้ายของปี จึงขอเรียนเชิญทุกท่านเข้าร่วมประชุมตามวันและเวลาดังกล่าว</p>' +
  '<p>วาระการประชุม</p>' +
  '<ul><li>รับรองรายงานการประชุมครั้งที่แล้ว</li><li>ติดตามความคืบหน้าของโครงการ</li><li>แผนงานและงบประมาณไตรมาสที่ ๔</li></ul>' +
  '<p>จึงเรียนมาเพื่อโปรดทราบ</p>' +
  '<hr>' +
  '<p><b>ทดลองเปลี่ยนฟอนต์</b>  เลือกข้อความแล้วแตะกล่องฟอนต์บนแท็บ Home</p>' +
  f('Prompt','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Kanit','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Mitr','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Pridi','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Noto Serif Thai','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Charmonman','สวัสดีครับ ทดสอบฟอนต์ภาษาไทย 1234567890') +
  f('Lora','The quick brown fox jumps over the lazy dog') +
  f('Roboto','The quick brown fox jumps over the lazy dog');
}
function migrateOld(){
  return SJNStore.getMeta('migrated').then(function(m){
    if(m) return;
    var data = null;
    try{
      var raw = localStorage.getItem(KEY);
      if(raw) data = JSON.parse(raw);
      else{ var old = localStorage.getItem(OLDKEY); if(old){ var o = JSON.parse(old); data = { title:o.title, html:o.html }; } }
    }catch(e){ data = null; }
    var done = function(){ return SJNStore.setMeta('migrated', true); };
    if(!data || !data.html || !String(data.html).trim()) return done();
    return SJNStore.list().then(function(l){
      if(l.length) return done();
      var r = newRecord({ title:data.title, html:data.html, page:data.page, hf:data.hf });
      r.ink = data.ink || [];
      return SJNStore.put(r).then(function(){ return SJNStore.setMeta('current', r.id); }).then(done);
    });
  });
}
function boot(){
  return SJNStore.open().then(migrateOld).then(function(){ return SJNStore.getMeta('current'); }).then(function(cur){
    return cur ? SJNStore.get(cur) : null;
  }).then(function(rec){
    if(rec) return rec;
    return SJNStore.list().then(function(l){ return l.length ? SJNStore.get(l[0].id) : null; });
  }).then(function(rec){
    if(rec) return rec;
    rec = newRecord({ title:'บันทึกข้อความตัวอย่าง', html:sampleHTML() });
    return SJNStore.put(rec).then(function(){ return rec; });
  }).catch(function(){
    return newRecord({});
  }).then(function(rec){
    loadDocument(rec);
    SJNStore.persist();
    return bridgeInit();
  });
}
function startupActions(){
  try{
    var q = new URLSearchParams(location.search);
    if(q.get('new') === '1'){ history.replaceState(null, '', location.pathname); createDocument({}); }
  }catch(e){}
  if('launchQueue' in window && window.launchQueue && launchQueue.setConsumer){
    launchQueue.setConsumer(function(p){
      (p.files || []).forEach(function(h){ h.getFile().then(openFile); });
    });
  }
}
boot().then(startupActions);
if(document.fonts){
  if(document.fonts.ready) document.fonts.ready.then(refreshSoon);
  if(document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refreshSoon);
}
})();
