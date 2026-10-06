"""Interop for zip.js. Usage: python3 -I zip_check.py <outdir> make|verify
make:   writes dd.zip (non-seekable stream => data descriptors, Thai UTF-8 names, stored + deflated entries) and expected.json
verify: checks zip-written.zip (created by SJNZip in the browser) with Python's zipfile"""
import sys, os, io, json, zipfile
out, mode = sys.argv[1], sys.argv[2]
if mode == 'make':
    class NoSeek(io.RawIOBase):
        def __init__(s): s.b = io.BytesIO()
        def writable(s): return True
        def write(s, d): return s.b.write(d)
    ns = NoSeek()
    z = zipfile.ZipFile(ns, 'w')
    exp = {}
    for name, data, comp in [('ไฟล์/สวัสดี.txt', ('ภาษาไทย ' * 500).encode('utf8'), zipfile.ZIP_DEFLATED), ('plain.bin', bytes(range(256)) * 3, zipfile.ZIP_STORED), ('empty.txt', b'', zipfile.ZIP_STORED)]:
        zi = zipfile.ZipInfo(name); zi.compress_type = comp
        with z.open(zi, 'w') as f: f.write(data)
        exp[name] = len(data)
    z.close()
    data = ns.b.getvalue()
    flags = [data[i + 6] & 8 for i in range(len(data) - 6) if data[i:i + 4] == b'PK\x03\x04']
    open(os.path.join(out, 'dd.zip'), 'wb').write(data); json.dump(exp, open(os.path.join(out, 'expected.json'), 'w'))
    print('dd.zip written; data-descriptor flags:', flags)
else:
    z = zipfile.ZipFile(os.path.join(out, 'zip-written.zip'))
    assert z.testzip() is None
    names = z.namelist(); print(names)
    assert names == ['[Content_Types].xml', 'ไทย/ชื่อ.txt', 'big.txt', 'raw.bin'], names
    assert z.read('ไทย/ชื่อ.txt').decode('utf8') == 'สวัสดี', 'utf8 content'
    assert z.read('big.txt') == b'abc' * 5000 and z.getinfo('big.txt').compress_type == 8, 'deflated'
    assert z.read('raw.bin') == bytes(range(256)) and z.getinfo('raw.bin').compress_type == 0, 'stored (incompressible)'
    print('zip.js output verified with python zipfile')
