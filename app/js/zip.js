/* SJNZip - tiny dependency-free ZIP writer/reader (UTF-8 names, deflate-raw via CompressionStream, no zip64).
   window.SJNZip.create([{name, data:Uint8Array|string}]) -> Promise<Uint8Array>
   window.SJNZip.read(arrayBuffer)                        -> Promise<Map<string,Uint8Array>> */
(function(){
'use strict';
var MAX_ENTRY = 256 * 1024 * 1024;              // refuse to inflate anything larger (zip-bomb guard)
var CRC = (function(){
  var t = new Uint32Array(256);
  for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8){
  var c = 0xFFFFFFFF;
  for(var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function bytes(d){
  if(typeof d === 'string') return new TextEncoder().encode(d);
  if(d instanceof Uint8Array) return d;
  if(d instanceof ArrayBuffer) return new Uint8Array(d);
  return new Uint8Array(d || 0);
}
/* run bytes through a (De)CompressionStream; resolves null when unsupported or failing */
function pipe(Ctor, u8){
  if(typeof Ctor === 'undefined') return Promise.resolve(null);
  try{
    var s = new Blob([u8]).stream().pipeThrough(new Ctor('deflate-raw'));
    return new Response(s).arrayBuffer().then(function(b){ return new Uint8Array(b); }, function(){ return null; });
  }catch(e){ return Promise.resolve(null); }
}
function dosTime(d){
  var y = Math.max(1980, d.getFullYear());
  return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];
}

async function create(files){
  var now = dosTime(new Date()), parts = [], central = [], off = 0, enc = new TextEncoder();
  for(var i = 0; i < files.length; i++){
    var name = enc.encode(String(files[i].name)), raw = bytes(files[i].data), crc = crc32(raw);
    var comp = raw.length > 64 ? await pipe(typeof CompressionStream === 'undefined' ? undefined : CompressionStream, raw) : null;
    var method = 8;
    if(!comp || comp.length >= raw.length){ comp = raw; method = 0; }   // stored when deflate is unavailable or useless
    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, now[0], true); lh.setUint16(12, now[1], true); lh.setUint32(14, crc, true);
    lh.setUint32(18, comp.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, comp);
    var ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, method, true); ch.setUint16(12, now[0], true); ch.setUint16(14, now[1], true); ch.setUint32(16, crc, true);
    ch.setUint32(20, comp.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + comp.length;
  }
  var csize = 0; central.forEach(function(p){ csize += p.length; });
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, off, true);
  var all = parts.concat(central, [new Uint8Array(end.buffer)]), total = 0, pos = 0;
  all.forEach(function(p){ total += p.length; });
  var out = new Uint8Array(total);
  all.forEach(function(p){ out.set(p, pos); pos += p.length; });
  return out;
}

async function read(buf){
  var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf || 0);
  if(u8.length < 22) throw new Error('Not a ZIP file (too small)');
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), e = -1;
  for(var i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--){
    if(dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
  }
  if(e < 0) throw new Error('Not a ZIP file (end of central directory not found; file may be truncated)');
  var count = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), dec = new TextDecoder('utf-8');
  if(count === 0xFFFF || p === 0xFFFFFFFF) throw new Error('ZIP64 archives are not supported');
  var out = new Map();
  for(var n = 0; n < count; n++){
    if(p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if(!name || name.charAt(name.length - 1) === '/') continue;           // directory entry
    if(lo + 30 > u8.length || dv.getUint32(lo, true) !== 0x04034b50 || usize > MAX_ENTRY) continue;
    var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);   // sizes come from the central dir, so data descriptors are fine
    if(start + csize > u8.length) continue;                                // truncated entry: skip it
    var data = u8.subarray(start, start + csize);
    if(method === 0) out.set(name, data.slice());
    else if(method === 8){
      var raw = await pipe(typeof DecompressionStream === 'undefined' ? undefined : DecompressionStream, data);
      if(raw && raw.length <= MAX_ENTRY) out.set(name, raw);
    }
  }
  return out;
}
window.SJNZip = { create: create, read: read, crc32: crc32 };
})();
