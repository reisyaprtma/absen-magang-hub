require('dotenv').config();
const { loadSession, saveSession } = require('../lib/session');
const fs = require('fs');
const path = require('path');

(async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('⚠️ SUPABASE_URL atau SUPABASE_ANON_KEY belum diisi di .env. Lewati sinkronisasi.');
    return;
  }

  const sessionFile = path.join(__dirname, '..', 'session.json');
  if (fs.existsSync(sessionFile)) {
    try {
      const local = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      await saveSession(local);
      console.log('✅ Berhasil menyinkronkan session.json lokal ke database Supabase!');
    } catch (e) {
      console.error('❌ Gagal sinkronisasi:', e.message);
    }
  }
})();
