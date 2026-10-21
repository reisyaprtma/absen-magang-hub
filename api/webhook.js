const { loadSession, saveSession, saveDraft, getDraft, deleteDraft } = require('../lib/session');
const { escapeHtml, getTodayWIB, checkTodayAttendance, submitAttendance, refreshAccessToken } = require('../lib/maganghub');
const { generateDailyLogWithLLM } = require('../lib/gemini');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;

async function sendTelegram(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function isAuthorized(chatId) {
  if (!ALLOWED_CHAT_ID) return true;
  return String(chatId) === String(ALLOWED_CHAT_ID);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Active');
  }

  const update = req.body;
  if (!update) return res.status(200).send('No payload');

  try {
    // 1. Handle Pesan Teks
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';

      if (!isAuthorized(chatId)) {
        return res.status(200).json({ ok: true });
      }

      // Perintah /start atau /id
      if (/^\/(start|id)/i.test(text)) {
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `👋 <b>Bot Presensi MagangHub (Vercel Serverless) Siap!</b>\n\n` +
                `🆔 Chat ID kamu: <code>${chatId}</code>\n\n` +
                `<b>Perintah Tersedia:</b>\n` +
                `• Kirim teks kegiatan harian -> Generate draf & submit absen\n` +
                `• /cek -> Cek apakah hari ini sudah absen\n` +
                `• /refresh -> Test perbarui token sesi sekarang\n` +
                `• /settoken <code>token</code> -> Ganti Bearer token manual\n` +
                `• /setcookie <code>cookie</code> -> Ganti Cookie manual`
        });
        return res.status(200).json({ ok: true });
      }

      // Perintah /cek
      if (/^\/cek/i.test(text)) {
        try {
          const att = await checkTodayAttendance();
          if (att) {
            await sendTelegram('sendMessage', {
              chat_id: chatId,
              parse_mode: 'HTML',
              text: `✅ <b>Sudah Presensi Hari Ini (${escapeHtml(att.date)})</b>\n` +
                    `• ID Presensi: <code>${escapeHtml(att.id)}</code>\n` +
                    `• Status: <b>${escapeHtml(att.status)}</b>\n` +
                    `• Approval: <b>${escapeHtml(att.approval_status)}</b>\n` +
                    `• Waktu: <code>${escapeHtml(att.created_at)}</code>`
            });
          } else {
            await sendTelegram('sendMessage', {
              chat_id: chatId,
              parse_mode: 'HTML',
              text: `⚠️ Belum ada presensi tercatat untuk hari ini (<b>${getTodayWIB()}</b>).`
            });
          }
        } catch (err) {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `❌ Gagal mengecek presensi:\n<code>${escapeHtml(err.message)}</code>`
          });
        }
        return res.status(200).json({ ok: true });
      }

      // Perintah /refresh
      if (/^\/refresh/i.test(text)) {
        try {
          await refreshAccessToken();
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: '✅ Token sesi berhasil di-refresh dan disimpan di database Supabase!'
          });
        } catch (err) {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `❌ Gagal refresh token:\n<code>${escapeHtml(err.message)}</code>`
          });
        }
        return res.status(200).json({ ok: true });
      }

      // Perintah /settoken
      const setTokenMatch = text.match(/^\/settoken\s+(.+)/i);
      if (setTokenMatch) {
        const session = await loadSession();
        session.accessToken = setTokenMatch[1].replace(/^Bearer\s+/i, '').trim();
        await saveSession(session);
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: '✅ Access Token berhasil diperbarui di database!'
        });
        return res.status(200).json({ ok: true });
      }

      // Perintah /setcookie
      const setCookieMatch = text.match(/^\/setcookie\s+(.+)/i);
      if (setCookieMatch) {
        const session = await loadSession();
        const rawCookies = setCookieMatch[1].split(';');
        for (const part of rawCookies) {
          const eq = part.indexOf('=');
          if (eq > 0) {
            session.cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
          }
        }
        await saveSession(session);
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: '✅ Cookie berhasil diperbarui di database!'
        });
        return res.status(200).json({ ok: true });
      }

      // Jika teks biasa (kegiatan harian untuk digenerate LLM)
      if (!text.startsWith('/')) {
        const waitMsg = await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '⏳ Sedang merangkai draf laporan harian dengan Gemini...'
        });

        try {
          const draft = await generateDailyLogWithLLM(text);
          await saveDraft(chatId, draft);

          const preview =
            `📋 <b>DRAF LAPORAN HARIAN (${getTodayWIB()})</b>\n\n` +
            `<b>1. Uraian Aktivitas (${draft.activity_log.length} kar):</b>\n${escapeHtml(draft.activity_log)}\n\n` +
            `<b>2. Pembelajaran (${draft.lesson_learned.length} kar):</b>\n${escapeHtml(draft.lesson_learned)}\n\n` +
            `<b>3. Kendala (${draft.obstacles.length} kar):</b>\n${escapeHtml(draft.obstacles)}`;

          await sendTelegram('editMessageText', {
            chat_id: chatId,
            message_id: waitMsg.result.message_id,
            parse_mode: 'HTML',
            text: preview,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Kirim Sekarang', callback_data: 'send_now' }],
                [{ text: '❌ Batal', callback_data: 'cancel' }]
              ]
            }
          });
        } catch (err) {
          await sendTelegram('editMessageText', {
            chat_id: chatId,
            message_id: waitMsg.result.message_id,
            parse_mode: 'HTML',
            text: `❌ <b>Gagal menyusun draf:</b>\n<code>${escapeHtml(err.message)}</code>`
          });
        }
        return res.status(200).json({ ok: true });
      }
    }

    // 2. Handle Tombol Interaktif (Callback Query)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;

      if (!isAuthorized(chatId)) {
        return res.status(200).json({ ok: true });
      }

      await sendTelegram('answerCallbackQuery', { callback_query_id: query.id });

      if (query.data === 'cancel') {
        await deleteDraft(chatId);
        await sendTelegram('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
        await sendTelegram('sendMessage', { chat_id: chatId, text: '🚫 Pengiriman dibatalkan.' });
        return res.status(200).json({ ok: true });
      }

      if (query.data === 'send_now') {
        const draft = await getDraft(chatId);
        if (!draft) {
          return sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '⚠️ Draf sudah tidak berlaku. Silakan kirim teks kegiatan baru.'
          });
        }

        await sendTelegram('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });

        await sendTelegram('sendMessage', { chatId, text: '📡 Mengirim presensi & laporan ke MagangHub...' });

        try {
          const result = await submitAttendance(draft);
          await deleteDraft(chatId);
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `✅ <b>Presensi Berhasil Terkirim!</b>\n` +
                  `• ID Presensi: <code>${escapeHtml(result.data?.id)}</code>\n` +
                  `• ID Log: <code>${escapeHtml(result.data?.daily_log?.id)}</code>\n` +
                  `• Waktu Server: <code>${escapeHtml(result.data?.created_at)}</code>`
          });
        } catch (err) {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `❌ <b>Gagal Submit Presensi:</b>\n<code>${escapeHtml(err.message)}</code>`
          });
        }
        return res.status(200).json({ ok: true });
      }
    }

    res.status(200).json({ ok: true });
  } catch (globalErr) {
    console.error('Webhook Error:', globalErr);
    res.status(200).json({ error: globalErr.message });
  }
};
