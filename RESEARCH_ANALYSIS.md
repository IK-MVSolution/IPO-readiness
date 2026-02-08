# การวิเคราะห์ระบบและวิธีคิด สำหรับใช้อ้างอิงงานวิจัย

**ระบบประเมินความพร้อมการเข้าจดทะเบียนในตลาดหลักทรัพย์ (IPO Readiness Assessment)**  
เอกสารนี้สรุปสถาปัตยกรรม วิธีการทำงาน และคำสำคัญสำหรับใช้ค้นหางานวิจัยที่เกี่ยวข้อง

---

## 1. ภาพรวมระบบ (System Overview)

ระบบเป็น **Web Application แบบ Full-Stack** ที่ให้ผู้ใช้ (ที่ปรึกษา/นักวิเคราะห์) อัปโหลดข้อมูลทางการเงินจากไฟล์ Excel แล้วระบบจะประเมินว่าบริษัทมีความพร้อมตามเกณฑ์ตลาดหลักทรัพย์ SET และ mai หรือไม่ พร้อมให้คะแนนสุขภาพทางการเงินและคำแนะนำ

### 1.1 สถาปัตยกรรม (Architecture)

| ชั้น | เทคโนโลยี | หน้าที่ |
|-----|-----------|---------|
| **Frontend** | React (Vite), React Router (view state) | UI, อัปโหลดไฟล์, แสดงผลประเมิน, Dashboard, จัดการผู้ใช้ |
| **Backend** | Flask (Python), Gunicorn | REST API, ประมวลผลไฟล์, คำนวณ metrics, เกณฑ์ SET/mai |
| **Data** | SQLite (local) / PostgreSQL (production) | Users, Assessments, Projects, Audit logs |
| **Deploy** | Render (backend), Vercel (frontend) | Hosting |

### 1.2 โฟลว์การทำงานหลัก (Main Workflow)

1. **Login** → ตรวจสอบตัวตน (session เก็บใน localStorage)
2. **อัปโหลดไฟล์ Excel** → Parser ดึงงบการเงินและอัตราส่วน (หลายปี)
3. **คำนวณ Metrics** → หน่วยเงิน (บาท/ล้านบาท), margin, อัตราส่วน
4. **ประเมินเกณฑ์ IPO** → เปรียบเทียบกับเกณฑ์ SET และ mai (rule-based)
5. **คะแนนสุขภาพทางการเงิน** → ROA, ROE, Current Ratio, D/E, margin (scoring bands)
6. **คำแนะนำ** → สร้างจากเกณฑ์ที่ไม่ผ่าน + อัตราส่วนที่ต้องปรับปรุง
7. **บันทึกผล** → เก็บในตาราง assessments (company, user_id, คะแนน, phase, risk)
8. **Dashboard (Consultant Cockpit)** → แสดง Client Portfolio จาก assessments, กรองตาม user (ความเป็นส่วนตัว), Admin เลือกดูตามคนใน Team Pulse

---

## 2. วิธีคิดและวิธีการ (Methodology)

### 2.1 การประเมินความพร้อม IPO (IPO Readiness Assessment)

- **แหล่งอ้างอิงเกณฑ์:** ประกาศตลาดหลักทรัพย์ (มีผลตั้งแต่ 1 มกราคม 2568) — เกณฑ์กำไร (Profit Test)
- **วิธีคิด:** กำหนดเกณฑ์ขั้นต่ำ (threshold) แต่ละตลาด แล้วตรวจสอบทีละข้อ (ผ่าน/ไม่ผ่าน) และนับจำนวนที่ผ่าน
- **ตัวแปรหลักที่ใช้:**
  - ส่วนของผู้ถือหุ้น (Shareholders’ Equity)
  - กำไรสุทธิปีล่าสุด (Latest Year Net Profit)
  - กำไรสุทธิรวม 2–3 ปี (Cumulative Net Profit)
  - ทุนชำระแล้ว (Paid-up Capital) — ใช้ในเกณฑ์แต่ยังไม่ดึงจาก parser
  - Track record (จำนวนปีที่มีข้อมูลผลการดำเนินงาน)
  - มีกำไรในงวดสะสม (ไม่ขาดทุน)

**คำค้นงานวิจัย (Keywords):**

- IPO readiness / IPO eligibility
- Stock exchange listing criteria / listing requirements
- SET listing rules / MAI listing rules
- Profit test / financial eligibility
- Going public / initial public offering criteria

### 2.2 การดึงข้อมูลจากงบการเงิน (Financial Statement Parsing)

- **วิธีคิด:** กำหนด layout แบบตาราง (แถว/คอลัมน์) สำหรับชีทงบดุล งบกำไรขาดทุน และอัตราส่วน จากนั้นดึงค่าตาม cell (เช่น openpyxl, xlrd)
- **รองรับหลายรูปแบบ:** Standard layout และ Legacy layout
- **หน่วยข้อมูล:** ตรวจจับอัตโนมัติ (บาท / พันบาท / ล้านบาท) จากขนาดตัวเลข

**คำค้นงานวิจัย:**

- Financial statement extraction / parsing
- XBRL vs. spreadsheet-based financial data
- Financial data normalization / unit detection

### 2.3 คะแนนสุขภาพทางการเงิน (Financial Health Scoring)

- **วิธีคิด:** ใช้ **อัตราส่วนทางการเงิน** (financial ratios) แล้วให้คะแนนตามช่วงค่า (band/threshold)
  - ค่ายิ่งมากยิ่งดี: ROA, ROE, Gross/Net margin → กำหนดเกณฑ์ “ดีมาก” / “พอใช้” / “ต้องปรับปรุง”
  - ค่ายิ่งน้อยยิ่งดี: D/E, Debt-to-Assets → ใช้เกณฑ์ upper bound
  - ค่ากลางดีที่สุด: Current Ratio → ช่วง 1.2–3.0 ถือว่า “ดีมาก”
- **การรวมคะแนน:** รวมคะแนนจากแต่ละอัตราส่วน แล้วแปลงเป็นเปอร์เซ็นต์และระดับ (ดีมาก/ดี/พอใช้/ต้องปรับปรุง)

**คำค้นงานวิจัย:**

- Financial ratio analysis
- Financial health index / scoring model
- Multi-criteria decision making (MCDM) in finance
- Composite financial indicator / financial performance measurement
- Liquidity ratios, profitability ratios, leverage ratios

### 2.4 การสร้างคำแนะนำ (Recommendation Generation)

- **วิธีคิด:** Rule-based
  - จากเกณฑ์ IPO ที่ไม่ผ่าน → สร้างข้อความแนะนำ (เช่น “เพิ่มส่วนของผู้ถือหุ้นอีก X ล้านบาท”)
  - จากอัตราส่วนที่ได้ระดับ “ต้องปรับปรุง” → แนะนำให้ปรับ (เช่น Current Ratio, D/E, ROE)
- **การจัดลำดับ:** เรียงตามความสำคัญ (สูง/กลาง/ต่ำ)

**คำค้นงานวิจัย:**

- Rule-based recommendation system
- Decision support system (DSS) for IPO / listing
- Explanatory recommendations / gap analysis

### 2.5 Dashboard และการจัดการข้อมูลตามบทบาท (Privacy-Aware Dashboard)

- **วิธีคิด:** ผู้ใช้ทั่วไปเห็นเฉพาะผลประเมินของตัวเอง (filter ตาม `user_id`) เพื่อความเป็นส่วนตัว
- **Admin:** เห็นได้ทั้งหมด หรือเลือกดูของคนใดคนหนึ่งจาก Team Pulse (filter ตาม `view_user_id`)
- **Client Portfolio:** แสดงเฉพาะข้อมูลจากตาราง “assessments” (ข้อมูลจริง) ไม่ใช้ mock

**คำค้นงานวิจัย:**

- Role-based access control (RBAC)
- Dashboard design for consultants / advisory
- Privacy-preserving analytics / multi-user dashboard
- Portfolio view / client portfolio management

### 2.6 Audit Log และการเก็บประวัติ (Audit Trail)

- บันทึกการกระทำสำคัญ (Login, การประเมิน, การจัดการผู้ใช้) ลงตาราง audit logs
- ใช้สำหรับตรวจสอบและความรับผิดชอบ (accountability)

**คำค้นงานวิจัย:**

- Audit trail / audit log in information systems
- Accountability in decision support systems

---

## 3. สรุปแนวคิดที่ใช้ (Concepts Summary)

| แนวคิด | การนำไปใช้ในระบบ | กลุ่มงานวิจัยที่เกี่ยวข้อง |
|--------|-------------------|----------------------------|
| **เกณฑ์การขึ้นทะเบียน (Listing criteria)** | SET / mai Profit Test, threshold แต่ละข้อ | Securities regulation, stock exchange listing |
| **อัตราส่วนทางการเงิน (Financial ratios)** | ROA, ROE, Current Ratio, D/E, margin | Corporate finance, financial statement analysis |
| **การให้คะแนนตามช่วง (Band scoring)** | ดีมาก / พอใช้ / ต้องปรับปรุง ต่อแต่ละอัตราส่วน | Scoring model, composite index |
| **Rule-based assessment** | ผ่าน/ไม่ผ่านแต่ละเกณฑ์, สร้างคำแนะนำจาก rule | Expert system, decision support system |
| **Multi-user + บทบาท** | User/Admin, การกรองข้อมูลตามคน | RBAC, privacy in dashboards |
| **การดึงข้อมูลจากเอกสาร** | Parser Excel ตาม layout | Document information extraction, financial data |

---

## 4. คำค้นสำหรับหางานวิจัย (Search Keywords for Literature)

### 4.1 ภาษาไทย

- ความพร้อมการเข้าจดทะเบียนในตลาดหลักทรัพย์
- เกณฑ์การขึ้นทะเบียน SET mai
- การประเมินความพร้อมไอพีโอ
- ระบบสนับสนุนการตัดสินใจด้านการเงิน
- อัตราส่วนทางการเงินกับการประเมินบริษัท
- ดัชนีสุขภาพทางการเงิน

### 4.2 ภาษาอังกฤษ

- **IPO readiness** / IPO eligibility assessment  
- **Stock exchange listing criteria** / listing requirements (SET, MAI, or general)  
- **Financial ratio analysis** for listing / going public  
- **Multi-criteria decision making** (MCDM) in IPO / listing  
- **Decision support system** (DSS) for IPO / securities  
- **Financial statement analysis** / financial health scoring  
- **Rule-based expert system** for financial assessment  
- **Consultant dashboard** / advisory dashboard design  
- **Role-based access** in financial or advisory systems  

### 4.3 หัวข้อที่อาจลงลึกในงานวิจัย

- เปรียบเทียบเกณฑ์ SET / mai กับตลาดอื่น (เช่น ASEAN)
- การใช้ ML/AI ทำนายความสำเร็จหลัง IPO (ถ้าขยายงาน)
- การออกแบบ DSS สำหรับที่ปรึกษาทางการเงิน (consultant tool)
- การวัดความน่าเชื่อถือของแบบจำลองคะแนนสุขภาพทางการเงิน (validation)

---

## 5. โครงสร้างโค้ดหลัก (Key Code Structure)

```
backend/
  app.py                    # REST API endpoints
  ipo_readiness/services/
    parser_thai.py          # ดึงข้อมูลจาก Excel (layout, หน่วยเงิน)
    metrics_engine.py       # เกณฑ์ SET/mai, คะแนนสุขภาพ, คำแนะนำ
    dashboard_service.py    # assessments, projects, Team Pulse data
    user_service.py         # Users, auth
    audit_service.py        # Audit logs
    db_helper.py            # SQLite/PostgreSQL abstraction

frontend/src/
  App.jsx                   # Login, routing, currentUser
  components/
    Home.jsx                # เมนูหลัก
    Assessment.jsx          # อัปโหลด + เรียก API analyze
    AssessmentReport.jsx    # แสดงผลประเมิน
    ProgressReport.jsx      # Consultant Cockpit, Client Portfolio, Team Pulse
```

---

## 6. สรุปสำหรับเขียนบทความ / งานวิจัย

- **ปัญหา:** บริษัทและที่ปรึกษาต้องการเครื่องมือประเมินความพร้อม IPO อย่างรวดเร็ว จากข้อมูลงบการเงินที่มีอยู่
- **วิธีที่ใช้:** ระบบเว็บที่ (1) ดึงข้อมูลจาก Excel ตาม layout ที่กำหนด (2) ใช้เกณฑ์ SET/mai แบบ rule-based (3) ให้คะแนนสุขภาพทางการเงินจากอัตราส่วนและช่วงค่า (4) สร้างคำแนะนำจากเกณฑ์ที่ไม่ผ่านและอัตราส่วนที่อ่อน (5) แสดงผลใน Dashboard แยกตามผู้ใช้และบทบาท
- **จุดเด่น:** ใช้เกณฑ์ตามประกาศตลาดหลักทรัพย์โดยตรง, รองรับหลายรูปแบบ Excel, แยกสิทธิ์ดูข้อมูล (ที่ปรึกษาเห็นเฉพาะของตัวเอง, แอดมินเลือกดูได้)

สามารถใช้เอกสารนี้ร่วมกับ **USER_MANUAL.md** และโค้ดจริงในการอธิบายระบบและหางานวิจัยที่เกี่ยวข้องเพิ่มเติมได้
