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


---

### Fitur Baru: Otomatisasi Presensi & Reminder

1. **Hari Libur (Sabtu & Minggu) - Pukul 08:00 WIB (8 Pagi):**
   - Setiap jam 08:00 WIB, bot otomatis mengisi presensi magang dengan template khusus hari libur BPS Kabupaten Ketapang.
   - Dilengkapi **jeda acak 1-3 detik** sebelum submit agar perilaku bot natural dan tidak terdeteksi sistem.
   - Laporan presensi dikirimkan ke Telegram setelah berhasil.
   - Tersedia perintah `/absen_weekend` jika ingin memicu/mengecek draf manual.

2. **Hari Kerja / Weekdays (Senin s/d Jumat) - Pukul 20:00 WIB (8 Malam):**
   - Setiap jam 20:00 WIB, bot memeriksa apakah Anda sudah mengisi presensi hari ini.
   - Jika **belum**, bot akan mengirimkan pesan notifikasi reminder darurat ke Telegram agar Anda segera mengisi sebelum tengah malam.
   - Jika **sudah**, bot akan mengirimkan konfirmasi bahwa absen hari ini aman.
   - Tersedia perintah `/test_reminder` untuk mencoba format pesan pengingat kapan saja.

3. **Cara Kerja Penjadwal di Vercel:**
   - Dikonfigurasi langsung di file `vercel.json` menggunakan Vercel Cron:
     ```json
     {
       "crons": [
         {
           "path": "/api/cron-attendance?mode=weekend",
           "schedule": "0 1 * * 0,6"
         },
         {
           "path": "/api/cron-attendance?mode=reminder",
           "schedule": "0 13 * * 1-5"
         }
       ]
     }
     ```
   - **Zona Waktu UTC ke WIB**:
     - Weekend jam 08:00 WIB = 01:00 UTC (`0 1 * * 0,6`)
     - Weekday jam 20:00 WIB = 13:00 UTC (`0 13 * * 1-5`)
   - Cron job ini otomatis terdaftar di dashboard Vercel Anda (**Project Settings -> Cron Jobs**).
   - **Uji Coba Langsung di Browser**:
     - Cek reminder: `https://<domain-vercel-anda>/api/cron-attendance?mode=reminder`
     - Cek absen weekend: `https://<domain-vercel-anda>/api/cron-attendance?mode=weekend`
