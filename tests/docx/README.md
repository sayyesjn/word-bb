# SJN Word .docx module tests

Code under test: `app/js/zip.js`, `app/js/docx-export.js`, `app/js/docx-import.js` (zero dependencies, classic scripts).
`harness.html` loads them together with `app/css/app.css` (so the editor's own CSS decides every style) and defines a rich
sample document (`sampleHtml()`), page and header/footer presets.

## Run everything

```bash
cd /home/claude/sjn-word/tests/docx
./run-all.sh                 # outputs to /tmp/sjn-docx-out (or pass another dir); exit code 0 = all good
```

Needs: node + Playwright (`/opt/npm-tools/node_modules/playwright`), Chromium at `/opt/pw-browsers/chromium`,
`python3` with `python-docx`, `xmllint`, `unzip`, LibreOffice (`soffice`), `pdfinfo`/`pdftoppm`.

## What each step does

| step | command | checks |
|------|---------|--------|
| export | `node run.js OUT export` | writes `sample.docx`, `sample-land.docx`, `sample-nohf.docx`, `sample-hdr.docx` |
| package | `unzip -t`, `xmllint --noout` per part | zip integrity, every XML part well-formed |
| python-docx | `python3 -I validate.py OUT` | styles, runs (bold/italic/underline/strike/sub/sup/font/size/colour/highlight), alignment, indents, spacing, line spacing, bidi, lists + numIds, table + colspan, images + EMU size, page breaks, section size/orientation/margins, header/footer + PAGE/NUMPAGES fields |
| LibreOffice | `soffice --headless --convert-to pdf` | opens without repair, page count; `pdftoppm -png` pages for eyeballing Thai/lists/table/image |
| round trip | `node run.js OUT roundtrip` | export then import, compare with the original: text per block, inline formatting, paragraph props, list nesting/types, table, images, page breaks, page size/margins, header/footer + page-number position/format, all page sizes |
| foreign | `python3 -I make_foreign.py OUT`, soffice re-save, `node run.js OUT import FILE...`, `python3 -I check_foreign.py OUT` | files not written by us: python-docx (theme fonts, List Bullet/Number styles, merged cells, picture) and a LibreOffice re-saved copy of our export |
| zip | `python3 -I zip_check.py OUT make`, `node run.js OUT zip`, `python3 -I zip_check.py OUT verify` | reads data-descriptor zips with Thai UTF-8 names (made by Python), and Python reads zips written by `SJNZip.create` |
| fuzz | `node run.js OUT fuzz` | empty / tiny / text / random / truncated / bit-flipped zips, valid zip without document.xml, broken XML: always a rejected `Error`, never a non-Error throw |
| weird | `node run.js OUT weird` | hostile editor HTML (scripts, handlers, control chars, bad/remote images, nested + empty tables, rowspan, stray td/li, blocks in inline, huge paragraph, no options) exports to valid packages; 200 mutated `document.xml` files import without throwing |

Single steps can be run on their own, e.g. `node run.js /tmp/x export && python3 -I validate.py /tmp/x`.
To look at a rendering: `soffice --headless --convert-to pdf --outdir /tmp/x/pdf /tmp/x/sample.docx && pdftoppm -png -r 70 /tmp/x/pdf/sample.pdf /tmp/x/pdf/p`.
