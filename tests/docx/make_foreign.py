"""Create a python-docx made .docx (foreign file) for import tests. Usage: python3 -I make_foreign.py <outdir>"""
import sys, os, struct, zlib
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.section import WD_ORIENT
out = sys.argv[1]
def png(w, h):
    raw = b''.join(b'\x00' + bytes([200, 40, 40]) * w for _ in range(h))
    def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
open(os.path.join(out, 'red.png'), 'wb').write(png(60, 40))
d = Document()
d.core_properties.title = 'python-docx sample'
d.add_heading('Main Title', 1); d.add_heading('Sub heading', 2); d.add_heading('Third', 3)
p = d.add_paragraph('Plain, ')
r = p.add_run('bold'); r.bold = True
r = p.add_run(' italic '); r.italic = True
r = p.add_run('big red Calibri 20'); r.font.size = Pt(20); r.font.color.rgb = RGBColor(0xC0, 0, 0); r.font.name = 'Arial'
r = p.add_run(' ภาษาไทย'); r.font.name = 'TH Sarabun New'
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
q = d.add_paragraph('Justified with indent and spacing ' * 5); q.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
q.paragraph_format.left_indent = Cm(2); q.paragraph_format.first_line_indent = Cm(1); q.paragraph_format.space_before = Pt(10); q.paragraph_format.space_after = Pt(4); q.paragraph_format.line_spacing = 1.5
d.add_paragraph('Bullet one', style='List Bullet'); d.add_paragraph('Bullet two', style='List Bullet'); d.add_paragraph('Nested bullet', style='List Bullet 2')
d.add_paragraph('Number one', style='List Number'); d.add_paragraph('Number two', style='List Number')
t = d.add_table(rows=2, cols=3); t.style = 'Table Grid'
t.cell(0, 0).merge(t.cell(0, 1)); t.cell(0, 0).text = 'merged'; t.cell(0, 2).text = 'C'; t.cell(1, 0).text = 'a'; t.cell(1, 1).text = 'b'; t.cell(1, 2).text = 'c'
d.add_picture(os.path.join(out, 'red.png'), width=Inches(1))
d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
d.add_paragraph('After page break')
s = d.sections[0]; s.orientation = WD_ORIENT.LANDSCAPE; s.page_width, s.page_height = s.page_height, s.page_width
s.header.paragraphs[0].text = 'PyHeader'
s.footer.paragraphs[0].text = 'PyFooter'
d.save(os.path.join(out, 'foreign-python.docx'))
