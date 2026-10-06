"""Assertions on the import results of the foreign files (python-docx and LibreOffice made). Usage: python3 -I check_foreign.py <outdir>"""
import json, re, sys, os
out = sys.argv[1]; fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def load(n): return json.load(open(os.path.join(out, n + '.import.json')))['ok']
def text(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).strip()
p = load('foreign-python'); h = p['html']
check(p['title'] == 'python-docx sample', 'python-docx: title from core.xml')
check(h.startswith('<h1') and 'Main Title' in h and '<h2' in h and '<h3' in h, 'python-docx: Heading 1-3 -> h1-h3')
check('<b>bold</b>' in h and '<i> italic </i>' in h, 'python-docx: bold / italic runs')
check('font-size:20pt' in h and 'color:#c00000' in h and '&quot;Arial&quot;' in h, 'python-docx: size / color / font')
check('text-align:center' in h and 'text-align:justify' in h and 'margin-left:2cm' in h and 'text-indent:1cm' in h and 'line-height:1.5' in h and 'margin-top:10pt' in h, 'python-docx: paragraph formatting')
check(len(re.findall('<ul>', h)) >= 1 and '<ol>' in h and 'Bullet two' in h and 'Number two' in h, 'python-docx: list styles -> ul / ol')
check('colspan="2"' in h and h.count('<tr>') == 2 and h.count('<td') == 5, 'python-docx: table with gridSpan')
check('<img src="data:image/png;base64,' in h and 'width="96"' in h and 'height="64"' in h, 'python-docx: picture -> data URL with px size')
check('class="pbreak"' in h and 'After page break' in h, 'python-docx: page break')
check(p['page'].get('land') is True and p['page']['size'] == 'Letter' and p['page']['w'] == 1056 and p['page']['ml'] == 120, 'python-docx: Letter landscape page, margins')
check(p['hf']['header'] == 'PyHeader' and p['hf']['footer'] == 'PyFooter' and p['hf']['pos'] == 'none', 'python-docx: header/footer text')
l = load('foreign-lo'); lh = l['html']
check(l['page']['size'] == 'A4' and l['page']['w'] == 794 and not l['page']['land'], 'LibreOffice file: A4 portrait')
check(l['hf']['pos'] == 'bc' and l['hf']['fmt'] == 'หน้า {n} / {N}' and l['hf']['footer'] == 'ท้ายกระดาษ ภาษาไทย' and l['hf']['header'] == 'หัวกระดาษ SJN', 'LibreOffice file: header/footer + PAGE/NUMPAGES fields -> pos/fmt')
check(lh.count('<ol>') == 3 and lh.count('<ul>') >= 2 and 'start=' not in lh, 'LibreOffice file: list restarts survive the re-save (3 ol)')
check('<table>' in lh and 'colspan="2"' in lh and lh.count('class="pbreak"') == 2 and lh.count('<img') == 2 and '<hr>' in lh, 'LibreOffice file: table, colspan, 2 page breaks, 2 images, hr')
check('<b>ตัวหนา</b>' in lh and '<i>ตัวเอียง</i>' in lh and '<sub>2</sub>' in lh and '<sup>2</sup>' in lh and 'href="https://example.com/a?b=1&amp;c=2"' in lh, 'LibreOffice file: inline formatting + link')
check(not re.search(r'<script|\son\w+=|javascript:', lh + h, re.I), 'no script / handlers / javascript: in output')
sys.exit(1 if fails else 0)
