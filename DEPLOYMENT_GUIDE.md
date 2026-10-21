# Deployment Panduan: Vercel + Supabase

Berikut langkah-langkah praktis menghubungkan bot ini ke **Vercel** dan **Supabase** agar aktif 24/7 tanpa perlu menyalakan laptop:

---

### Langkah 1: Siapkan Supabase (Database Gratis)

1. Buka [supabase.com](https://supabase.com) dan buat project baru (gratis).
2. Di dashboard Supabase, buka menu **SQL Editor**.
3. Buat file SQL baru, lalu salin dan jalankan (Run) query dari file [supabase_schema.sql](file:///c:/Intern/bot-absen-magang/supabase_schema.sql):
   ```sql
   CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY DEFAULT 'default',
     build_id TEXT,
     access_token TEXT,
     cookies JSONB,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS drafts (
     chat_id TEXT PRIMARY KEY,
     activity_log TEXT,
     lesson_learned TEXT,
     obstacles TEXT,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```
4. Buka menu **Project Settings** -> **API**:
   - Salin **Project URL** (masukkan ke `SUPABASE_URL`)
   - Salin **Project API Keys (anon / public)** (masukkan ke `SUPABASE_ANON_KEY`)

---

### Langkah 2: Sinkronkan Sesi Token Lokal ke Supabase

Di laptop Anda (sebelum deploy), isi kedua variabel tadi ke [.env](file:///c:/Intern/bot-absen-magang/.env):
```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJh......
```
Lalu jalankan perintah:
```powershell
node scripts/sync-session.js
```
*Token aktif yang ada di laptop Anda sekarang langsung masuk ke database Supabase!*

---

### Langkah 3: Deploy ke Vercel

1. Push folder proyek ini ke repositori GitHub Anda.
2. Buka [vercel.com](https://vercel.com) -> **Add New Project** -> Pilih repositori Anda.
3. Di bagian **Environment Variables**, tambahkan semua variabel dari [.env](file:///c:/Intern/bot-absen-magang/.env):
   - `TELEGRAM_BOT_TOKEN`
   - `ALLOWED_CHAT_ID`
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PARTICIPANT_ID` (opsional)
   - `LATITUDE` (opsional)
   - `LONGITUDE` (opsional)
4. Klik **Deploy**.

---

### Langkah 4: Sambungkan Webhook Telegram ke Vercel

Setelah deploy selesai, Vercel akan memberi Anda domain URL (misal: `https://bot-absen-magang.vercel.app`).

Buka browser atau terminal, lalu buka URL berikut (ganti `<TOKEN_BOT>` dan domain Vercel Anda):
```
https://api.telegram.org/bot<TOKEN_BOT>/setWebhook?url=https://bot-absen-magang.vercel.app/api/webhook
```
Jika berhasil, akan muncul respon:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

### Hasil Akhir:
1. **Chat Telegram Langsung Dijawab Serverless Vercel**: Respon instan via webhook.
2. **Auto Refresh Token Otomatis**: Vercel Cron berjalan setiap 4 jam sekali (`vercel.json`) untuk meminta token baru ke Kemnaker dan menyimpannya di Supabase.
3. **Laptop Mati Total?**: Bot tetap hidup, token tidak akan basi!
