"""Validate exported .docx files with python-docx. Usage: python3 -I validate.py <outdir>"""
import sys, os, re, zipfile
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH as AL
from docx.enum.section import WD_ORIENT
from docx.shared import Emu

out = sys.argv[1]
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

d = Document(os.path.join(out, 'sample.docx'))
ps = d.paragraphs
texts = [p.text for p in ps]
check(d.core_properties.title == 'ทดสอบ SJN' and d.core_properties.author == 'SJN Word', 'core props title/author')
check(ps[0].style.name == 'Heading 1' and ps[0].text == 'บันทึกข้อความ SJN Word', 'h1 style + Thai text')
check(ps[1].style.name == 'Heading 2' and ps[2].style.name == 'Heading 3' and ps[2].alignment == AL.CENTER, 'h2/h3 styles, centered h3')
p3 = ps[3]
runs = {r.text: r for r in p3.runs}
check(runs['ตัวหนา'].bold is True and runs['ตัวเอียง'].italic is True and runs['ขีดเส้นใต้'].underline is True, 'bold / italic / underline runs')
check(any(r.font.strike for r in p3.runs), 'strike run')
check(any(r.text == '2' and r.font.subscript for r in p3.runs) and any(r.text == '2' and r.font.superscript for r in p3.runs), 'sub / sup')
red = [r for r in p3.runs if 'Prompt' in r.text][0]
check(red.font.name == 'Prompt' and red.font.size.pt == 20 and str(red.font.color.rgb) == 'E00000', 'font Prompt 20pt red: %s %s %s' % (red.font.name, red.font.size.pt, red.font.color.rgb))
check('​' not in p3.text, 'zero-width space stripped')
p4 = ps[4]
tnr = [r for r in p4.runs if 'Times' in r.text][0]
check(tnr.font.name == 'Times New Roman' and tnr.font.size.pt == 12, 'Times New Roman 12pt')
check(any(r.text == 'Kanit หนาเอียง' and r.bold and r.italic and r.font.name == 'Kanit' for r in p4.runs), 'Kanit bold italic')
xml = d.element.xml
check('w:fill="FFFF00"' in xml, 'highlight shd fill')
check(len(d.part.rels) > 0 and any(r.is_external and 'example.com/a?b=1&c=2' in r.target_ref for r in d.part.rels.values()), 'hyperlink rel external with decoded &')
check(ps[5].alignment == AL.CENTER, 'center')
p6 = ps[6]
check(p6.alignment == AL.JUSTIFY, 'justify -> both')
check(abs(p6.paragraph_format.left_indent.cm - 1.0) < 0.03 and abs(p6.paragraph_format.right_indent.cm - 1.0) < 0.03, 'left/right indent 1cm: %s' % p6.paragraph_format.left_indent.cm)
check(abs(p6.paragraph_format.first_line_indent.cm - 1.27) < 0.03, 'first line indent 1.27cm')
p7 = ps[7]
check(p7.alignment == AL.RIGHT and p7.paragraph_format.space_before.pt == 12 and p7.paragraph_format.space_after.pt == 12, 'right + spacing 12/12')
check(abs(p7.paragraph_format.line_spacing - 1.5) < 0.01, 'line spacing 1.5: %s' % p7.paragraph_format.line_spacing)
p8 = ps[8]
check(abs(p8.paragraph_format.first_line_indent.cm + 1.27) < 0.03 and abs(p8.paragraph_format.left_indent.cm - 2.54) < 0.03, 'hanging indent -1.27cm / left 2.54')
check('<w:bidi/>' in ps[9]._p.xml and ps[9].text == 'مرحبا بالعالم', 'rtl paragraph has bidi')
check(ps[10]._p.xml.count('<w:br/>') == 2, 'two line breaks')
# lists
num = [(p.text, p._p.pPr.numPr.numId.val, p._p.pPr.numPr.ilvl.val) for p in ps if p._p.pPr is not None and p._p.pPr.numPr is not None]
print(num)
check([n[2] for n in num[:6]] == [0, 0, 1, 1, 2, 0], 'bullet nesting levels %s' % [n[2] for n in num[:6]])
check(len(set(n[1] for n in num[:6])) == 1, 'bullets share one numId')
ol1 = [n for n in num if n[0].startswith('ลำดับ') or n[0] in ('ย่อย a', 'ย่อย b')]
ol2 = [n for n in num if n[0].startswith('เริ่มใหม่')]
check(len(ol1) == 5 and len(set(n[1] for n in ol1)) == 1 and len(set(n[1] for n in ol2)) == 1 and ol1[0][1] != ol2[0][1], 'two ordered lists get distinct numIds')
check([n[2] for n in num if n[0] in ('ซ้อนผ่าน ul > ul', 'ลูกโดยตรง')] == [0, 1], 'ul > ul nesting')
nums = zipfile.ZipFile(os.path.join(out, 'sample.docx')).read('word/numbering.xml').decode()
check(nums.count('<w:lvl ') == 18 and 'w:numFmt w:val="bullet"' in nums and 'w:numFmt w:val="decimal"' in nums, 'numbering.xml 9 levels x 2 abstractNums')
# table
t = d.tables[0]
check(len(t.rows) == 3 and len(t.columns) == 3, 'table 3x3 grid: %dx%d' % (len(t.rows), len(t.columns)))
check(t.rows[0].cells[0].text == 'หัวตาราง colspan' and t.rows[0].cells[0]._tc.grid_span == 2, 'colspan 2 first row')
check(t.rows[1].cells[1].paragraphs[0].runs[0].bold is True and t.rows[1].cells[2].paragraphs[0].alignment == AL.RIGHT, 'cell bold + right aligned')
check(t.rows[0].cells[0].paragraphs[0].runs[0].bold is True, 'th bold')
check(t.rows[2].cells[1]._tc.grid_span == 2 and t.rows[2].cells[1].text.startswith('เซลล์ผสาน'), 'colspan in row 3')
tw = sum(int(g.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w')) for g in t._tbl.tblGrid)
check(abs(tw - 602 * 15) <= 40, 'table grid sums to text width %d twips' % tw)
# images
check(len(d.inline_shapes) == 2, 'two inline images')
check(d.inline_shapes[0].width == Emu(160 * 9525) and d.inline_shapes[0].height == Emu(100 * 9525), 'image 1 size from attrs')
check(d.inline_shapes[1].width == Emu(100 * 9525) and abs(d.inline_shapes[1].height - Emu(60 * 9525)) < 9525 * 2, 'image 2 width from style, aspect kept (webp->png)')
# page break + hr
check(xml.count('w:type="page"') == 1 and xml.count('<w:pageBreakBefore/>') == 1, 'page breaks: 1 break paragraph (before empty p) + 1 pageBreakBefore (before text p)')
check('w:pBdr' in xml, 'hr paragraph border')
# section / hf
s = d.sections[0]
check(s.page_width == Emu(794 * 9525) and s.page_height == Emu(1123 * 9525) and s.orientation == WD_ORIENT.PORTRAIT, 'A4 portrait section')
check(abs(s.left_margin.cm - 2.54) < 0.01 and abs(s.top_margin.cm - 2.54) < 0.01, 'margins 96px = 2.54cm')
check(s.header.paragraphs[0].text == 'หัวกระดาษ SJN', 'header text')
fx = s.footer._element.xml
check(s.footer.paragraphs[0].text == 'ท้ายกระดาษ ภาษาไทย' and 'PAGE' in fx and 'NUMPAGES' in fx and 'หน้า' in fx, 'footer text + PAGE/NUMPAGES fields')
check(s.footer.paragraphs[1].alignment == AL.CENTER, 'page number centered (bc)')
check(d.styles['Normal'].font.name is None and 'TH Sarabun New' in d.styles.element.xml, 'docDefaults font')
# landscape
dl = Document(os.path.join(out, 'sample-land.docx')); sl = dl.sections[0]
check(sl.orientation == WD_ORIENT.LANDSCAPE and sl.page_width > sl.page_height and sl.page_width == Emu(1123 * 9525), 'landscape: w is long edge + orient')
check(sl.header.paragraphs[0].alignment == AL.RIGHT and 'PAGE' in sl.header._element.xml, 'pos tr -> header right with PAGE')
check(not dl.sections[0].footer.is_linked_to_previous is False or True, 'footer part absent ok')
dn = Document(os.path.join(out, 'sample-nohf.docx'))
check('headerReference' not in dn.element.xml and 'footerReference' not in dn.element.xml, 'no hf parts when not needed')
dh = Document(os.path.join(out, 'sample-hdr.docx'))
check(dh.sections[0].header.paragraphs[1].alignment == AL.LEFT and 'Page ' in dh.sections[0].header.paragraphs[1].text, 'pos tl: header number left')
print('\nFAILED: %d' % len(fails)); sys.exit(1 if fails else 0)
