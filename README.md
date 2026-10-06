# SJN Word

โปรแกรมเขียนเอกสารแบบ Word สำหรับแท็บเล็ต (ออกแบบให้ใช้กับ Samsung Galaxy Tab S) เป็น **เว็บแอปติดตั้งได้ (PWA)**
โฮสต์เองได้ ไม่ต้องมีเซิร์ฟเวอร์ฐานข้อมูล ไม่มีไลบรารีภายนอก

- ฟอนต์ไทย TH Sarabun New และฟอนต์อื่นอีกกว่า 60 ตัว, จัดย่อหน้า/ระยะบรรทัด/ตาราง/รูป/เลขหน้า/หัวท้ายกระดาษ/ปากกาเขียนมือ
- **บันทึกในเครื่องอัตโนมัติ** (IndexedDB) มีหลายเอกสาร มีรายการล่าสุด ทำสำเนา/ลบได้
- **ดาวน์โหลดเป็น .docx จริง** (เปิดใน Word / Google Docs / LibreOffice ได้), เปิดไฟล์ .docx/.html/.txt/.md เข้ามาแก้ได้, แชร์ไฟล์ไปแอปอื่น, พิมพ์/บันทึกเป็น PDF
- **ทำงานออฟไลน์** หลังติดตั้งครั้งแรก
- **ให้ Claude เข้ามาแก้เอกสารที่เปิดอยู่** ผ่านตัวเชื่อม (custom connector): พิมพ์สั่งใน Claude แล้ว Claude อ่าน/แก้/จัดหน้า/ใส่ตาราง/ตั้งหัวท้ายกระดาษในเอกสารนี้ให้ (กด Undo ย้อนได้ทั้งชุดในครั้งเดียว)

```
app/      เว็บแอป (ไฟล์ static ล้วน: index.html, css/, js/, sw.js, manifest, icons/)
server/   relay เล็ก ๆ (Node ล้วน ไม่มี dependency) ที่ส่งคำสั่งจาก Claude ไปยังแอป
tests/    ชุดทดสอบ (app/ = เบราว์เซอร์จริงผ่าน Playwright, docx/ = ตรวจไฟล์ .docx)
```

## 1) โฮสต์ตัวแอป (GitHub Pages, ฟรี)

1. อัปโหลดโค้ดนี้ขึ้น GitHub repo ชื่อ `sjn-word` (branch `main`)
2. repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. ไปที่แท็บ **Actions** รอ workflow *Deploy app to GitHub Pages* เป็นสีเขียว (ถ้าไม่รันเอง กด *Run workflow*)
4. เปิด `https://<ชื่อผู้ใช้>.github.io/sjn-word/`

ทุกครั้งที่แก้ไฟล์ใน `app/` แล้ว push ระบบจะ deploy ใหม่ และแอปที่ติดตั้งไว้จะขึ้นแถบ **“A new version is ready · Update”**

> โฮสต์ที่อื่นก็ได้ (Cloudflare Pages, Vercel, Netlify): ชี้ไปที่โฟลเดอร์ `app/` ไม่ต้อง build
> ต้องเป็น **HTTPS** เท่านั้น PWA ถึงจะติดตั้งได้ และถ้าอยากให้แคชอัปเดตถูกต้อง ให้แทนที่คำว่า `__BUILD__` ใน `app/sw.js` ด้วยเลขเวอร์ชันใหม่ทุกครั้งที่ deploy

## 2) ติดตั้งบนแท็บเล็ต

เปิดลิงก์จากข้อ 1 ใน **Chrome** → เมนู ⋮ → **ติดตั้งแอป / Install app** (หรือเมนู **File → Install app** ในแอป)
จะได้ไอคอน “SJN Word” บนหน้าจอหลัก เปิดแล้วเต็มจอเหมือนแอปทั่วไป

## 3) เชื่อม Claude (ให้ Claude เข้ามาทำงานในเอกสาร)

Claude อยู่บนอินเทอร์เน็ต ส่วนเอกสารอยู่ในแท็บเล็ตของคุณ จึงต้องมี **relay** ตัวเล็ก ๆ ต่อกลางไว้
(relay ไม่เก็บเอกสารใด ๆ ทำหน้าที่ส่งคำสั่งต่อเท่านั้น)

```
Claude --(MCP / HTTPS)--> relay --(SSE)--> SJN Word ที่เปิดอยู่
```

### 3.1 ติดตั้ง relay บน Railway (หรือ Render / Fly.io)

1. https://railway.com → **New Project → Deploy from GitHub repo** → เลือก `sjn-word`
2. เข้าไปที่ service → **Settings → Root Directory** ใส่ `server`
3. **Settings → Networking → Generate Domain** จะได้ที่อยู่ เช่น `https://sjn-word-relay.up.railway.app`
4. (แนะนำ) **Variables** → เพิ่ม `ALLOW_ORIGIN` = `https://<ชื่อผู้ใช้>.github.io`
5. เปิด `https://<ที่อยู่ relay>/healthz` ต้องเห็น `{"ok":true,...}`

ต้องรัน **เพียง 1 instance** (ข้อมูลห้อง/คำสั่งอยู่ในหน่วยความจำ) รายละเอียดอยู่ใน [`server/README.md`](server/README.md)

### 3.2 ต่อในแอป

1. เปิด SJN Word → แตะไอคอน ✨ (Claude & AI) หรือ **File → Connect Claude**
2. ช่อง **Relay address** วางที่อยู่จากข้อ 3.1 → กด **Connect** (สถานะต้องขึ้น *Connected* และมีจุดเขียวที่ไอคอน ✨)
3. กด **Copy** ที่ช่อง **Connector address** (หน้าตา `https://…/mcp/<รหัสลับ>`)

### 3.3 ต่อใน Claude

Claude → **Settings → Connectors → Add custom connector** → ตั้งชื่อ “SJN Word” → วางที่อยู่ → เลือก **ไม่ต้องล็อกอิน (No sign in)** → บันทึก
แล้วเปิดแชตใหม่ ลองสั่ง เช่น

- “เปิดเอกสาร Word ของฉันแล้วแก้คำผิดทั้งหมด”
- “ทำย่อหน้าที่ฉันเลือกให้สั้นลง”
- “สร้างหนังสือเชิญประชุมใหม่ ใช้ TH Sarabun 16 จัดแบบเอกสารราชการ ใส่เลขหน้า”
- “เปลี่ยนกระดาษเป็น A4 แนวนอน ขอบ 2 ซม. แล้วใส่ตารางสรุป”

**ข้อควรรู้**

- แอปต้อง **เปิดค้างและออนไลน์** ขณะ Claude ทำงาน (บน Samsung ใช้หน้าจอแยก Split screen: Claude อยู่ข้างหนึ่ง SJN Word อยู่อีกข้าง)
- **รหัสลับในที่อยู่ connector = กุญแจเข้าเอกสาร** ใครมีที่อยู่นี้อ่าน/แก้เอกสารที่เปิดอยู่ได้ อย่าแจกต่อ ถ้ารั่วกด **New key** ในแอปแล้วเพิ่ม connector ใหม่
- Claude ทำงานได้กับเอกสารที่เปิดอยู่ และสั่ง สร้าง/เปิดเอกสารอื่นจากคลังได้ (`word_list_documents`, `word_open_document`, `word_new_document`)
- ถ้าคุณพิมพ์แก้ย่อหน้าเดียวกันระหว่างที่ Claude ทำ ระบบจะ **ข้ามย่อหน้านั้น** ไม่เขียนทับงานคุณ

## ข้อจำกัดที่ควรรู้

- เอกสารเก็บใน **เบราว์เซอร์ของเครื่องนี้** (IndexedDB) ถ้าล้างข้อมูลเว็บไซต์ เอกสารจะหาย → ดาวน์โหลด .docx สำรองไว้เป็นระยะ (File → Download) แอปขอโหมดเก็บถาวรจากเบราว์เซอร์ให้อัตโนมัติ
- ลายเส้นปากกา (Draw) **ไม่ถูกส่งออกไป .docx และไม่ถูกพิมพ์** (สำรองได้ด้วย File → Download → Backup .json)
- .docx ที่สร้างตรวจกับ python-docx และ LibreOffice แล้ว แต่ **ยังไม่ได้ทดสอบกับ Microsoft Word จริง** ระยะห่างบางจุดอาจต่างเล็กน้อย; ไฟล์ `.doc` เก่าและ PDF เปิดแก้ไม่ได้
- หัว/ท้ายกระดาษและเลขหน้าตอนพิมพ์ใช้ความสามารถ `@page` ของ Chrome (ต้องเป็น Chrome เวอร์ชันใหม่); ขนาดกระดาษตอน “Save as PDF” บน Android อาจให้เลือกในหน้าต่างพิมพ์เอง
- ฟอนต์โหลดจาก Google Fonts ครั้งแรกต้องมีเน็ต หลังจากนั้นแคชไว้ใช้ออฟไลน์

## พัฒนาและทดสอบ

```bash
# เปิดแอปในเครื่อง (ไม่ต้อง build) แล้วเปิด http://localhost:8080
python3 -m http.server 8080 -d app

# relay
cd server && npm test && npm start

# ทดสอบแอปบนเบราว์เซอร์จริง (ต้องมี Playwright + Chromium)
node tests/app/app.test.js
# ทดสอบไฟล์ .docx (ต้องมี python-docx, LibreOffice)
tests/docx/run-all.sh
```

ใน GitHub Codespaces: รัน `python3 -m http.server 8080 -d app` แล้วเปิด Ports → 8080 ในเบราว์เซอร์ได้เลย
