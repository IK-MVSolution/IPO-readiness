# 🚀 วิธี Deploy IPO Readiness App

## สรุปไฟล์ที่สร้างใหม่
- `backend/render.yaml` - Render blueprint
- `backend/Procfile` - Gunicorn config
- `frontend/vercel.json` - Vercel config
- `frontend/.env.example` - Environment template

---

## 📦 Step 1: เตรียม Git Repository

```bash
# ไปที่โฟลเดอร์โปรเจค
cd /Users/ik/Downloads/PMT/IPO

# สร้าง git repo ใหม่ (ถ้ายังไม่มี)
git init

# เพิ่มไฟล์ทั้งหมด
git add .

# Commit
git commit -m "Initial commit: IPO Readiness Assessment App"
```

### Push ขึ้น GitHub
1. ไปที่ https://github.com/new สร้าง repository ใหม่
2. ตั้งชื่อ เช่น `ipo-readiness-app`
3. Push code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/ipo-readiness-app.git
git branch -M main
git push -u origin main
```

---

## 🔵 Step 2: Deploy Backend บน Render

1. ไปที่ https://render.com และ Sign up/Login
2. คลิก **New +** → **Web Service**
3. เชื่อมต่อ GitHub และเลือก repo ของคุณ
4. ตั้งค่า:
   - **Name**: `ipo-readiness-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. คลิก **Create Web Service**
6. รอ deploy เสร็จ จะได้ URL เช่น: `https://ipo-readiness-api.onrender.com`

### ⚙️ Environment Variables (Optional)
ใน Render Dashboard → Environment:
```
FRONTEND_URL=https://your-vercel-app.vercel.app
```

---

## 🟢 Step 3: Deploy Frontend บน Vercel

1. ไปที่ https://vercel.com และ Sign up/Login (ใช้ GitHub)
2. คลิก **Add New...** → **Project**
3. Import repository จาก GitHub
4. ตั้งค่า:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables** (สำคัญ!):
   ```
   VITE_API_BASE=https://ipo-readiness-api.onrender.com
   ```
   (ใส่ URL ของ Render backend ที่ได้จาก Step 2)
6. คลิก **Deploy**
7. รอ deploy เสร็จ จะได้ URL เช่น: `https://ipo-readiness.vercel.app`

---

## ✅ Step 4: ทดสอบ

1. เปิด URL ของ Vercel frontend
2. ลอง Login / สมัครสมาชิก
3. อัปโหลดไฟล์ Excel ทดสอบ

---

## 🔄 การอัปเดต

ทุกครั้งที่ push code ใหม่ขึ้น GitHub:
- **Vercel** จะ auto-deploy frontend ใหม่
- **Render** จะ auto-deploy backend ใหม่

```bash
git add .
git commit -m "Update: description"
git push
```

---

## ⚠️ หมายเหตุ

### Render Free Tier
- Server จะ "หลับ" หลังไม่มีการใช้งาน 15 นาที
- Request แรกหลังหลับจะใช้เวลา ~30 วินาที (Cold Start)
- ถ้าต้องการให้ตื่นตลอด ต้องอัปเกรดเป็น paid plan

### Vercel Free Tier
- ไม่มีข้อจำกัดสำหรับ personal projects
- Bandwidth 100GB/เดือน
- Serverless Functions 100GB-Hours/เดือน

---

## 🛠️ Troubleshooting

### Backend ไม่ทำงาน
1. ตรวจสอบ Logs ใน Render Dashboard
2. ตรวจสอบว่า `requirements.txt` ครบ
3. ตรวจสอบว่า `Procfile` ถูกต้อง

### Frontend เรียก API ไม่ได้
1. ตรวจสอบว่า `VITE_API_BASE` ตั้งค่าถูกต้องใน Vercel
2. ตรวจสอบ CORS ใน backend
3. ลองเรียก API ตรงๆ ใน browser: `https://your-render-url.onrender.com/api/analyze`

### CORS Error
ถ้าเจอ CORS error ให้อัปเดต `backend/app.py`:
```python
CORS(app, origins=[
    "https://your-vercel-app.vercel.app",
    "https://*.vercel.app",
])
```
