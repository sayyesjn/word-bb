#!/bin/bash
# Full SJN docx test run. Usage: ./run-all.sh [outdir]   (default /tmp/sjn-docx-out)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="${1:-/tmp/sjn-docx-out}"; rm -rf "$OUT"; mkdir -p "$OUT"; FAIL=0
step(){ echo; echo "### $*"; }
step "1. export sample documents (Playwright + Chromium)"
node "$HERE/run.js" "$OUT" export || FAIL=1
step "2. package validation: unzip -t + xmllint on every part"
for f in "$OUT"/sample*.docx; do
  unzip -tq "$f" >/dev/null || { echo "BAD ZIP $f"; FAIL=1; }
  d="$OUT/x_$(basename "$f" .docx)"; mkdir -p "$d"; unzip -q "$f" -d "$d"
  (cd "$d" && find . -type f \( -name '*.xml' -o -name '*.rels' \) -print0 | xargs -0 -n1 xmllint --noout) || { echo "BAD XML in $f"; FAIL=1; }
done; echo "package checks done"
step "3. python-docx structure checks"
python3 -I "$HERE/validate.py" "$OUT" | grep -E "FAIL|FAILED" ; python3 -I "$HERE/validate.py" "$OUT" >/dev/null || FAIL=1
step "4. LibreOffice -> PDF (page counts)"
mkdir -p "$OUT/pdf"; soffice --headless --convert-to pdf --outdir "$OUT/pdf" "$OUT/sample.docx" "$OUT/sample-land.docx" >/dev/null 2>&1
for p in "$OUT"/pdf/*.pdf; do echo "$(basename "$p"): $(pdfinfo "$p" | grep -E 'Pages' | tr -s ' ')"; done
[ "$(pdfinfo "$OUT/pdf/sample.pdf" | awk '/Pages/{print $2}')" -ge 4 ] || { echo "unexpected page count"; FAIL=1; }
pdftoppm -png -r 70 -f 1 -l 3 "$OUT/pdf/sample.pdf" "$OUT/pdf/page" && echo "rasterized to $OUT/pdf/page-*.png (open them to eyeball Thai, lists, table, image)"
step "5. round trip: export -> import, compare with the original"
node "$HERE/run.js" "$OUT" roundtrip | grep -E "^FAIL|^  first" ; node "$HERE/run.js" "$OUT" roundtrip >/dev/null || FAIL=1
echo "round trip: $(node "$HERE/run.js" "$OUT" roundtrip | grep -c ^PASS) checks passed"
step "6. foreign files: python-docx made + LibreOffice re-saved"
python3 -I "$HERE/make_foreign.py" "$OUT"
mkdir -p "$OUT/lo"; soffice --headless --convert-to docx:"MS Word 2007 XML" --outdir "$OUT/lo" "$OUT/sample.docx" >/dev/null 2>&1 && mv "$OUT/lo/sample.docx" "$OUT/foreign-lo.docx"
node "$HERE/run.js" "$OUT" import "$OUT/foreign-python.docx" "$OUT/foreign-lo.docx" || FAIL=1
python3 -I "$HERE/check_foreign.py" "$OUT" || FAIL=1
step "6b. zip.js interop (data descriptors, UTF-8 names, python zipfile reads our output)"
python3 -I "$HERE/zip_check.py" "$OUT" make && node "$HERE/run.js" "$OUT" zip && python3 -I "$HERE/zip_check.py" "$OUT" verify || FAIL=1
step "7. fuzz: truncated / empty / random zips, hostile HTML, mutated XML"
node "$HERE/run.js" "$OUT" fuzz | tail -n +1 || FAIL=1
node "$HERE/run.js" "$OUT" weird || FAIL=1
echo; [ $FAIL = 0 ] && echo "ALL OK" || echo "SOME CHECKS FAILED"; exit $FAIL
