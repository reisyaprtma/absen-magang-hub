const { escapeHtml, getTodayWIB, checkTodayAttendance, submitAttendance } = require('../lib/maganghub');
const { WEEKEND_REPORT } = require('../lib/weekend-report');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;

async function sendTelegram(method, payload) {
  if (!TELEGRAM_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

module.exports = async (req, res) => {
  // Opsional: Cek Authorization header jika CRON_SECRET disetel di Vercel
  if (process.env.CRON_SECRET && req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized Cron Request' });
  }

  const mode = req.query?.mode;
  const now = new Date();
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
  const isWeekend = mode === 'weekend' ? true : mode === 'reminder' ? false : (dayName === 'Sat' || dayName === 'Sun');
  const dayIndo = { Sun: 'Minggu', Mon: 'Senin', Tue: 'Selasa', Wed: 'Rabu', Thu: 'Kamis', Fri: 'Jumat', Sat: 'Sabtu' }[dayName] || dayName;
  const todayStr = getTodayWIB();

  console.log(`⏰ [Vercel Cron] Hari: ${dayName} (${dayIndo}) | Mode: ${isWeekend ? 'Auto Absen Weekend (08:00 WIB)' : 'Reminder Weekdays (20:00 WIB)'}${mode ? ` (Query: ${mode})` : ''}`);

  if (isWeekend) {
    // Weekend: Delay random 1-3 detik (1000 - 3000 ms) agar natural & tidak terdeteksi bot
    const delayMs = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
    console.log(`⏳ Menunggu delay anti-bot: ${(delayMs / 1000).toFixed(2)} detik...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const existing = await checkTodayAttendance().catch(() => null);
      if (existing) {
        if (ALLOWED_CHAT_ID) {
          await sendTelegram('sendMessage', {
            chat_id: ALLOWED_CHAT_ID,
            parse_mode: 'HTML',
            text: `ℹ️ <b>Presensi Akhir Pekan Terjadwal (${dayIndo})</b>\n\n` +
                  `Presensi hari ini (<b>${todayStr}</b>) sudah tercatat sebelumnya.\n` +
                  `• Status: <b>${escapeHtml(existing.status)}</b>\n` +
                  `• ID: <code>${escapeHtml(existing.id)}</code>\n` +
                  `Tidak dilakukan pengiriman ulang.`
          });
        }
        return res.status(200).json({
          success: true,
          type: 'weekend_already_submitted',
          date: todayStr,
          id: existing.id
        });
      }

      const result = await submitAttendance(WEEKEND_REPORT);

      if (ALLOWED_CHAT_ID) {
        await sendTelegram('sendMessage', {
          chat_id: ALLOWED_CHAT_ID,
          parse_mode: 'HTML',
          text: `🎉 <b>Presensi Otomatis Akhir Pekan Berhasil!</b>\n\n` +
                `📅 Tanggal: <code>${todayStr}</code> (${dayIndo})\n` +
                `⏱️ Delay anti-bot: <code>${(delayMs / 1000).toFixed(2)}s</code>\n` +
                `• ID Presensi: <code>${escapeHtml(result.data?.id)}</code>\n` +
                `• ID Log: <code>${escapeHtml(result.data?.daily_log?.id)}</code>\n` +
                `• Waktu Server: <code>${escapeHtml(result.data?.created_at)}</code>\n\n` +
                `📋 <b>Isian Laporan Akhir Pekan:</b>\n` +
                `<b>1. Aktivitas:</b>\n${escapeHtml(WEEKEND_REPORT.activity_log)}\n\n` +
                `<b>2. Pembelajaran:</b>\n${escapeHtml(WEEKEND_REPORT.lesson_learned)}\n\n` +
                `<b>3. Kendala:</b>\n${escapeHtml(WEEKEND_REPORT.obstacles)}`
        });
      }

      return res.status(200).json({
        success: true,
        type: 'weekend_submitted',
        date: todayStr,
        result
      });
    } catch (err) {
      console.error('❌ Gagal submit absen weekend:', err.message);
      if (ALLOWED_CHAT_ID) {
        await sendTelegram('sendMessage', {
          chat_id: ALLOWED_CHAT_ID,
          parse_mode: 'HTML',
          text: `❌ <b>Presensi Otomatis Akhir Pekan GAGAL!</b>\n\n` +
                `📅 Tanggal: <code>${todayStr}</code> (${dayIndo})\n` +
                `⚠️ Error: <code>${escapeHtml(err.message)}</code>`
        });
      }
      return res.status(500).json({
        success: false,
        type: 'weekend_error',
        error: err.message
      });
    }
  } else {
    // Weekday: Kirim reminder presensi jam 8 malam
    try {
      const att = await checkTodayAttendance().catch(() => null);
      if (ALLOWED_CHAT_ID) {
        if (att) {
          await sendTelegram('sendMessage', {
            chat_id: ALLOWED_CHAT_ID,
            parse_mode: 'HTML',
            text: `🔔 <b>Pengingat Presensi Harian (20:00 WIB)</b>\n\n` +
                  `✅ Kamu <b>sudah mengisi presensi</b> hari ini (<b>${todayStr}</b>)!\n` +
                  `• ID Presensi: <code>${escapeHtml(att.id)}</code>\n` +
                  `• Status: <b>${escapeHtml(att.status)}</b>\n` +
                  `• Approval: <b>${escapeHtml(att.approval_status)}</b>\n\n` +
                  `Laporan harian kamu aman. Selamat beristirahat! ✨`
          });
        } else {
          await sendTelegram('sendMessage', {
            chat_id: ALLOWED_CHAT_ID,
            parse_mode: 'HTML',
            text: `⏰ <b>PENGINGAT PRESENSI MAGANG (20:00 WIB)!</b> ⚠️\n\n` +
                  `Halo! Hari ini (<b>${todayStr}</b>) kamu <b>BELUM mengisi absen</b> di MagangHub.\n\n` +
                  `👉 <b>Segera kirimkan pesan kegiatan harianmu ke bot ini sekarang</b>, bot akan merangkum draf laporan via Gemini untuk segera disubmit.\n\n` +
                  `Ketik /cek untuk memeriksa ulang status presensimu.`
          });
        }
      }

      return res.status(200).json({
        success: true,
        type: 'weekday_reminder',
        date: todayStr,
        alreadyAttended: Boolean(att)
      });
    } catch (err) {
      console.error('❌ Gagal menjalankan reminder weekday:', err.message);
      return res.status(500).json({
        success: false,
        type: 'weekday_error',
        error: err.message
      });
    }
  }
};
