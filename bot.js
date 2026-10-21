require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 1. KONFIGURASI UTAMA (DIBACA DARI FILE .env)
// ============================================================================
const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  ALLOWED_CHAT_ID: process.env.ALLOWED_CHAT_ID || '', // Kosongkan jika belum tahu, lalu ketik /id di bot
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Data profil & lokasi dari HAR kamu
  PARTICIPANT_ID: 'c2f6d161-deb8-44a5-b7cd-257ec288c616',
  LATITUDE: -1.838417,
  LONGITUDE: 109.977674,
  ENABLE_GPS_JITTER: true // Geser 1-2 meter acak agar natural seperti GPS asli
};

// ============================================================================
// 2. STATE SESI (SUDAH DIURUTKAN SESUAI TOKEN TERBARU DARI HAR & CURL)
// ============================================================================
const SESSION_FILE = path.join(__dirname, 'session.json');

const DEFAULT_SESSION = {
  buildId: '15e51ff8e57e2c9237258d8d216421ce1730f239-production',
  // Menggunakan access_token TERBARU hasil /api/v1/auth/refresh dari HAR kamu
  accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiI3OTIzMDg5MS1jYzAyLTQzYzgtOTY0Yy1iNTI1YmNlMjc4NTciLCJ1c2VyIjoiZGJhMWRhYWMtZDE5Yy00YjE3LWI1MzctZmJjMTQxMjFhYzg1IiwidHRsIjoyMTYwMCwic3ViIjoiMDIwODI2NTctYTMzNS00NDY1LWI5NTYtZThkOGU3OTQyZmFlIiwiYXVkIjoiNzkyMzA4OTEtY2MwMi00M2M4LTk2NGMtYjUyNWJjZTI3ODU3IiwiZmluZ2VycHJpbnQiOiJjYzE3ZDE3N2I1YjZlODVkYWRlYWM5MTg2NjI5MmUwNDNmMmFiMDRlIn0.qyOfy7zQ2bVe-3UBV4U0_hSKA5TTobvz1qY7Y8egXaPtU_FTclgclhUkNg2EYXmgCBzGUp2rUhvM77UU5fcVVkFtTuXanIPbTDAYLYyhyO1AB6q0qYXh1eVjSllbXsnK6QVGJf5KgCChfEHBxwQGRQjxeX1TDDm9Dvc_2BQbZt9EqJDeTPMa0EQzFwWtwAOzDKj1SuSD17udwhj3Xxls2Z7fp5mvrJ4AHUfrULV_mMHnEsDLwQI4UMVEsp6EjOnTfHsoitpFcy3YQLHFqsabpT2_B55qLTi-2P5lqWtZ4EI25MFbfpazO52j7uIKPz5K5xFFnxg_T0wDKQkIls0kipI1XyNpnn2PnCW_iWQDEOx_PjSNWYJkHbSP217uwQGSdQJq8BV7Y5PokBzoEul5nOqmjE8NR8hK6_iZfPzYxoklSOKwWWEfE0DIYNf_YL4w4T9AD16W3IrzgpJ6wG-i3z2BXSzZd_1Jso7JIi_VGpycyxZs1TrKIgHo-h5Y5SxCO_7UFGSD5O7psj20rY5Vo6GGzPaQVec-Kinlt3eP0kHrymxoIC_XJrOiOsZwV4RRnoycQCZS7Re2Mh78BtMX7G0ugD8aJCGqpIp3idAM0F48oozj6OFgGun9LxrfgVXC6U1Y2Vgce8JCY089ffTKAjoKHGGrzJo9UdlbDt18HO8',
  cookies: {
    cf_clearance: 'K7hoO1fDBipr53bEZpb.rX1iqxbqEXyKmCI_EReiid0-1792570640-1.2.1.1-u5gA5rApYh76dhE6BR4Z2AYQ_IKE7X_EoVhQhuId777eHA0hevdoYbiw.YSuyA1Z2MVN8ThDr0rrVJAOazEJ4tonMgeCI2H7zOaUYf6hUBOukXip30qCsmc_LZCsuOw09rfgX6Or.FxlvpbkDE8uWgQC_XRhGW0xAIVmrRc_HnTl2_YC6qWmuvdAwDkwZwNzY0eflla97VFlxHXTyTykF4vftnr8F33XKUJVUW3_6KolIYZIJrOhUM1NkuGPGiWou0Bw0RgnlChYVj.QGKJNnJ_ULpPgajj9GhdP4B7Frjk4a8aKQ.yNkngxOmLC8TDJJTberaXk1XZl2.x.iA1UBhSJhjsm463KIYpVFI6xr0I',
    acw_tc: '0a00626e17925731333862921e4d628d2fa5189b68c33298385ee0d63365ca',
    // Menggunakan monev_refresh_token TERBARU setelah rotasi refresh
    monev_refresh_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiI3OTIzMDg5MS1jYzAyLTQzYzgtOTY0Yy1iNTI1YmNlMjc4NTciLCJ1c2VyIjoiZGJhMWRhYWMtZDE5Yy00YjE3LWI1MzctZmJjMTQxMjFhYzg1IiwidHRsIjoyNTkyMDAwLCJzdWIiOiJkMDM3N2U0Zi1hMzc5LTQ0YTktOGNmNi05MThlY2MxYTA1ZTYiLCJhdWQiOiI3OTIzMDg5MS1jYzAyLTQzYzgtOTY0Yy1iNTI1YmNlMjc4NTciLCJmaW5nZXJwcmludCI6ImNjMTdkMTc3YjViNmU4NWRhZGVhYzkxODY2MjkyZTA0M2YyYWIwNGUifQ.RFLo4zqFXK5dFdzpv4-fWuk12MItbxTLP261JJ0IAJ1peq4hAWBn1DKbDkIoxEP_OwvtFeot-RHuE1_YEZCQQc0SP0H862VE1IsX70ovfcQhQ0YibTy-7ZMFvIYaDCoKD4P2GyuePqHNLlqi7skfemoq3Gz_eW6Bm3NUt6we_05tuumvQ0b2XpthplWUfVKSuy8x5vSRtrxc6wYwEs-hZwHUsuT6zcnU1LECxesMIcTlN1_hlVRcTtzGsDOsYqxkmSlnBil1ZUaeJNArRvPvqZgLZrGNh9Ut6_EYkyXAMofifW-QYW5Sfjsg1QLGsDNF2xX1mUIxxToobfpCkEbOXzTX-1d6ORALX-7i1J2XK-PoyO4zImXS1glKLDo0ZqpdohDllso7p5pvHUO9uCR1ekTxHE7Qyuy3uRDxaEcNbg9IBGUpZGvW7DPPn6gQ-ss2ewdeyMcLkP-e6aS-0lfZ5C3eLyiv6roAPpeRK86i0k4gyoiMWiDnE9-xncyK9YnzwC1eLMPB-UyfrlxyJrPmXvKlEdiULS36ucUxDy26CtKHfauQr_4E3KjYqB4DM1Tim1FKCzZq8akWCgfqU-DsGIpJ0MifDVsCxnRhzxDggQndhN2e6luCfECbfnWV2rE2HSK0WmDOhVRItvw5qXWE0-ZvpVbl5J6jxEZ1vjRLfMw'
  },
  // Cadangan jika refresh token pertama belum ter-commit di server
  fallbackRefreshToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiI3OTIzMDg5MS1jYzAyLTQzYzgtOTY0Yy1iNTI1YmNlMjc4NTciLCJ1c2VyIjoiZGJhMWRhYWMtZDE5Yy00YjE3LWI1MzctZmJjMTQxMjFhYzg1IiwidHRsIjoyNTkyMDAwLCJzdWIiOiI2YzcyOWM0ZC0xMzMyLTQyYjUtOGRkZC01NTI0NDAxMzlmNjciLCJhdWQiOiI3OTIzMDg5MS1jYzAyLTQzYzgtOTY0Yy1iNTI1YmNlMjc4NTciLCJmaW5nZXJwcmludCI6ImNjMTdkMTc3YjViNmU4NWRhZGVhYzkxODY2MjkyZTA0M2YyYWIwNGUifQ.aCJ04862eqsA5g9RebCBKfSbNmYsxmr894iuDeQ-0-AFHD5sDmd13RcMGdHaih1kLOaudRW3X7QkKC-b74mgbAWqCELlBsIrh2sia4_NrY9NnMcVcMJPLU7-mpn0cCa6bUbnjI1smpglqRyVSiwQasPuiuGbMcdQ7kpDTwanuab0fVELuyYSFEyZzCZzZbtM27TZm5X_x9WlHuDSYhBurftz4CM8pVvYyyy3Ng-eC3s64Qo72k9QlPwwbdl1tcXanuKWJK1U45J9bd4u5E2bPgHuo_bXboMZpYQ0QXKpI23Sq-TOPkfonq9_QLOmqcBePgM9iEoUTI21hhjmJk15JOK4pKzx4eBGEGB9F6MFQwil4hzrrtAN49qKekoFUs8scA7TaO9DTYi_cRYjfejY4vlygHYCvj6NA9GdmLoqBhyymSIVYR6fKp99nIEF6YWM3OMIlA22rPzydwmA6ORI5wINlZmihGMfFGmCiTLNmkYlgpErf_HF6-dcnBI_sf8FCGD1kFL5UxBafPZTal_4cQg6_ZGVvf0_7OQQkPRjKWYvP3MOhK8SQkcpLem_mc9KBM5tt5I-ai8GIHGO_lAUAeUcWqV1vutCvwWjTs_V6n2eDEQYhYiw8LoGuJ0EuyE5oKDi_XdwclkqcBuS5Na3ZPaSNYTF1dJIl5hqqOiehRo'
};

let session = { ...DEFAULT_SESSION };
if (fs.existsSync(SESSION_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session = {
      ...session,
      ...saved,
      cookies: { ...session.cookies, ...(saved.cookies || {}) }
    };
  } catch (e) {
    console.error('⚠️ Gagal membaca session.json, menggunakan default.');
  }
} else {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function saveSession() {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCookieString() {
  return Object.entries(session.cookies)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function updateCookiesFromResponse(res) {
  let setCookies = [];
  if (typeof res.headers.getSetCookie === 'function') {
    setCookies = res.headers.getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookies = raw.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
  }

  let updated = false;
  for (const cookieStr of setCookies) {
    const firstPart = cookieStr.split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();
      // Jangan timpa jika server hanya mengirim Max-Age=0 tanpa nilai baru
      if (val && val !== 'deleted' && val !== '""') {
        session.cookies[name] = val;
        updated = true;
      }
    }
  }
  if (updated) saveSession();
}

function getTodayWIB() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getCoordinates() {
  if (!CONFIG.ENABLE_GPS_JITTER) {
    return { latitude: CONFIG.LATITUDE, longitude: CONFIG.LONGITUDE };
  }
  // Jitter sangat kecil ±0.000015 derajat (~1.5 meter)
  const jitterLat = (Math.random() - 0.5) * 0.00003;
  const jitterLng = (Math.random() - 0.5) * 0.00003;
  return {
    latitude: Number((CONFIG.LATITUDE + jitterLat).toFixed(6)),
    longitude: Number((CONFIG.LONGITUDE + jitterLng).toFixed(6))
  };
}

// ============================================================================
// 3. FUNGSI API MAGANGHUB & AUTO-REFRESH
// ============================================================================
async function updateFrontendBuildId() {
  try {
    const res = await fetch(`https://monev.maganghub.kemnaker.go.id/version.json?t=${Date.now()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.build_id && data.build_id !== session.buildId) {
        session.buildId = data.build_id;
        saveSession();
      }
    }
  } catch (_) {}
}

function getHeaders(includeAuth = true, isJson = false) {
  const headers = {
    'accept': isJson ? 'application/json' : '*/*',
    'accept-language': 'en-US,en;q=0.9,id;q=0.8',
    'origin': 'https://monev.maganghub.kemnaker.go.id',
    'Referer': 'https://monev.maganghub.kemnaker.go.id/',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    'x-frontend-build-id': session.buildId,
    'Cookie': buildCookieString()
  };

  if (includeAuth && session.accessToken) {
    const cleanToken = session.accessToken.replace(/^Bearer\s+/i, '').trim();
    headers['authorization'] = `Bearer ${cleanToken}`;
  }
  if (isJson) {
    headers['content-type'] = 'application/json';
  }
  return headers;
}

async function refreshAccessToken() {
  console.log('🔄 Meminta access_token baru ke /api/v1/auth/refresh...');
  let res = await fetch('https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/refresh', {
    method: 'POST',
    headers: { ...getHeaders(false, false), 'content-length': '0' }
  });
  updateCookiesFromResponse(res);

  // Jika monev_refresh_token utama gagal, otomatis gunakan fallbackRefreshToken
  if (!res.ok && session.fallbackRefreshToken) {
    console.log('⚠️ Refresh pertama gagal, mencoba fallbackRefreshToken...');
    const currentRefresh = session.cookies.monev_refresh_token;
    session.cookies.monev_refresh_token = session.fallbackRefreshToken;
    session.fallbackRefreshToken = currentRefresh;

    res = await fetch('https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/refresh', {
      method: 'POST',
      headers: { ...getHeaders(false, false), 'content-length': '0' }
    });
    updateCookiesFromResponse(res);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Refresh Token Gagal (HTTP ${res.status}): ${errBody}`);
  }

  const data = await res.json();
  if (data.access_token) {
    session.accessToken = data.access_token;
    saveSession();
    console.log('✅ Access token & cookie berhasil diperbarui!');
    return data.access_token;
  }
  throw new Error('Respons /auth/refresh tidak memuat access_token');
}

async function requestWithAutoRefresh(url, options = {}) {
  await updateFrontendBuildId();
  const isJson = Boolean(options.body);

  let res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(true, isJson), ...(options.headers || {}) }
  });
  updateCookiesFromResponse(res);

  if (res.status === 401) {
    console.log('⚠️ HTTP 401 terdeteksi, menjalankan auto-refresh token...');
    await refreshAccessToken();
    res = await fetch(url, {
      ...options,
      headers: { ...getHeaders(true, isJson), ...(options.headers || {}) }
    });
    updateCookiesFromResponse(res);
  }

  return res;
}

async function checkTodayAttendance() {
  const today = getTodayWIB();
  const url = `https://monev-api.maganghub.kemnaker.go.id/api/v1/attendances?participant_id=${CONFIG.PARTICIPANT_ID}&start_date=${today}&end_date=${today}`;
  const res = await requestWithAutoRefresh(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data && data.data.length > 0 ? data.data[0] : null;
}

async function submitAttendance(draft) {
  // Cek terlebih dahulu apakah hari ini sudah absen agar tidak bentrok
  const existing = await checkTodayAttendance();
  if (existing) {
    throw new Error(`Kamu sudah tercatat presensi hari ini (${existing.date}) dengan ID ${existing.id} (Status: ${existing.approval_status}).`);
  }

  const today = getTodayWIB();
  const coords = getCoordinates();
  const payload = {
    date: today,
    status: 'PRESENT',
    activity_log: `${draft.activity_log.trim()}\n`,
    lesson_learned: `${draft.lesson_learned.trim()}\n`,
    obstacles: `${draft.obstacles.trim()}\n`,
    latitude: coords.latitude,
    longitude: coords.longitude
  };

  const res = await requestWithAutoRefresh(
    'https://monev-api.maganghub.kemnaker.go.id/api/v1/attendances/with-daily-log',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// ============================================================================
// 4. GENERATE LAPORAN HARIAN DENGAN GEMINI API (SCHEMA TERKUNCI)
// ============================================================================
async function generateDailyLogWithLLM(rawActivity) {
  const prompt = `Kamu adalah asisten pembuat laporan harian peserta magang di Badan Pusat Statistik (BPS) Kabupaten Ketapang.
Berdasarkan input kegiatan singkat berikut:
"${rawActivity}"

Tuliskan laporan harian dalam bahasa Indonesia formal-natural dengan ketentuan mutlak:
1. "activity_log": Uraian aktivitas yang dilakukan secara jelas dan profesional (WAJIB antara 150 hingga 300 karakter).
2. "lesson_learned": Pemahaman teknis atau manfaat yang dipelajari dari kegiatan tersebut (WAJIB antara 150 hingga 300 karakter).
3. "obstacles": Kendala teknis ringan yang wajar dihadapi saat mengerjakan tugas tersebut beserta solusinya (WAJIB antara 150 hingga 300 karakter).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            activity_log: { type: 'STRING' },
            lesson_learned: { type: 'STRING' },
            obstacles: { type: 'STRING' }
          },
          required: ['activity_log', 'lesson_learned', 'obstacles']
        }
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API Error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) parsed = parsed[0];

  for (const key of ['activity_log', 'lesson_learned', 'obstacles']) {
    if (!parsed[key] || parsed[key].trim().length < 105) {
      throw new Error(`Hasil generate "${key}" terlalu pendek (${parsed[key]?.length || 0} karakter, minimal sistem 100 karakter). Coba kirim ulang.`);
    }
  }
  return parsed;
}

// ============================================================================
// 5. BOT TELEGRAM HANDLER (DENGAN HTML MODE ANTI-CRASH)
// ============================================================================
if (!CONFIG.TELEGRAM_BOT_TOKEN || CONFIG.TELEGRAM_BOT_TOKEN.startsWith('ISI_')) {
  console.error('❌ Harap isi TELEGRAM_BOT_TOKEN di file .env terlebih dahulu!');
  process.exit(1);
}

const bot = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, { polling: true });
const pendingDrafts = new Map();
const activeTimers = new Map();

function isAuthorized(msg) {
  if (!CONFIG.ALLOWED_CHAT_ID || CONFIG.ALLOWED_CHAT_ID.startsWith('ISI_')) {
    return true;
  }
  return String(msg.chat.id) === String(CONFIG.ALLOWED_CHAT_ID);
}

bot.onText(/^\/(id|start)/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 <b>Bot Presensi MagangHub Siap!</b>\n\n` +
    `🆔 Chat ID kamu: <code>${msg.chat.id}</code>\n\n` +
    `<b>Perintah Tersedia:</b>\n` +
    `• Kirim teks kegiatan harian -> Generate draf & submit absen\n` +
    `• /cek -> Cek apakah hari ini sudah absen\n` +
    `• /refresh -> Test perbarui token sesi sekarang\n` +
    `• /batal -> Batalkan jadwal absen delay yang sedang berjalan\n` +
    `• /settoken <code>token</code> -> Ganti Bearer token manual\n` +
    `• /setcookie <code>cookie</code> -> Ganti Cookie manual`,
    { parse_mode: 'HTML' }
  );
});

bot.onText(/^\/cek/, async (msg) => {
  if (!isAuthorized(msg)) return;
  try {
    const att = await checkTodayAttendance();
    if (att) {
      bot.sendMessage(
        msg.chat.id,
        `✅ <b>Sudah Presensi Hari Ini (${escapeHtml(att.date)})</b>\n` +
        `• ID Presensi: <code>${escapeHtml(att.id)}</code>\n` +
        `• Status: <b>${escapeHtml(att.status)}</b>\n` +
        `• Approval: <b>${escapeHtml(att.approval_status)}</b>\n` +
        `• Waktu: <code>${escapeHtml(att.created_at)}</code>`,
        { parse_mode: 'HTML' }
      );
    } else {
      bot.sendMessage(
        msg.chat.id,
        `⚠️ Belum ada presensi tercatat untuk hari ini (<b>${getTodayWIB()}</b>).`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (err) {
    bot.sendMessage(msg.chat.id, `❌ Gagal mengecek presensi:\n<code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' });
  }
});

bot.onText(/^\/refresh/, async (msg) => {
  if (!isAuthorized(msg)) return;
  try {
    await refreshAccessToken();
    bot.sendMessage(msg.chat.id, '✅ Token sesi berhasil di-refresh dan disimpan ke <code>session.json</code>!', { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(msg.chat.id, `❌ Gagal refresh token:\n<code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' });
  }
});

bot.onText(/^\/batal/, (msg) => {
  if (!isAuthorized(msg)) return;
  const chatId = msg.chat.id;
  if (activeTimers.has(chatId)) {
    clearTimeout(activeTimers.get(chatId));
    activeTimers.delete(chatId);
    pendingDrafts.delete(chatId);
    bot.sendMessage(chatId, '🛑 Jadwal pengiriman presensi berhasil dibatalkan.');
  } else {
    bot.sendMessage(chatId, 'ℹ️ Tidak ada pengiriman terjadwal yang sedang berjalan.');
  }
});

bot.onText(/^\/settoken\s+(.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  session.accessToken = match[1].replace(/^Bearer\s+/i, '').trim();
  saveSession();
  bot.sendMessage(msg.chat.id, '✅ Access Token berhasil diperbarui!');
});

bot.onText(/^\/setcookie\s+(.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  const rawCookies = match[1].split(';');
  for (const part of rawCookies) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      session.cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
  saveSession();
  bot.sendMessage(msg.chat.id, '✅ Cookie berhasil diperbarui dan disimpan ke <code>session.json</code>!', { parse_mode: 'HTML' });
});

bot.on('message', async (msg) => {
  if (!isAuthorized(msg)) return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const waitMsg = await bot.sendMessage(chatId, '⏳ Sedang merangkai draf laporan harian dengan Gemini...');

  try {
    const draft = await generateDailyLogWithLLM(msg.text);
    pendingDrafts.set(chatId, draft);

    const preview =
      `📋 <b>DRAF LAPORAN HARIAN (${getTodayWIB()})</b>\n\n` +
      `<b>1. Uraian Aktivitas (${draft.activity_log.length} kar):</b>\n${escapeHtml(draft.activity_log)}\n\n` +
      `<b>2. Pembelajaran (${draft.lesson_learned.length} kar):</b>\n${escapeHtml(draft.lesson_learned)}\n\n` +
      `<b>3. Kendala (${draft.obstacles.length} kar):</b>\n${escapeHtml(draft.obstacles)}`;

    await bot.editMessageText(preview, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Kirim Sekarang', callback_data: 'send_now' }],
          [{ text: '🎲 Kirim Delay Acak (3-10 Menit)', callback_data: 'send_random' }],
          [{ text: '❌ Batal', callback_data: 'cancel' }]
        ]
      }
    });
  } catch (err) {
    await bot.editMessageText(`❌ <b>Gagal menyusun draf:</b>\n<code>${escapeHtml(err.message)}</code>`, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
      parse_mode: 'HTML'
    });
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (!isAuthorized(query.message)) return;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  const draft = pendingDrafts.get(chatId);
  if (query.data === 'cancel') {
    pendingDrafts.delete(chatId);
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
    return bot.sendMessage(chatId, '🚫 Pengiriman dibatalkan.');
  }

  if (!draft) {
    return bot.sendMessage(chatId, '⚠️ Draf sudah tidak berlaku. Silakan kirim teks kegiatan baru.');
  }

  if (activeTimers.has(chatId)) {
    clearTimeout(activeTimers.get(chatId));
    activeTimers.delete(chatId);
  }

  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});

  if (query.data === 'send_now') {
    try {
      await bot.sendMessage(chatId, '📡 Mengirim presensi & laporan ke MagangHub...');
      const res = await submitAttendance(draft);
      pendingDrafts.delete(chatId);
      bot.sendMessage(
        chatId,
        `✅ <b>Presensi Berhasil Terkirim!</b>\n` +
        `• ID Presensi: <code>${escapeHtml(res.data?.id)}</code>\n` +
        `• ID Log: <code>${escapeHtml(res.data?.daily_log?.id)}</code>\n` +
        `• Waktu Server: <code>${escapeHtml(res.data?.created_at)}</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      bot.sendMessage(chatId, `❌ <b>Gagal Submit Presensi:</b>\n<code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' });
    }
  } else if (query.data === 'send_random') {
    const delayMinutes = Math.floor(Math.random() * (10 - 3 + 1)) + 3;
    await bot.sendMessage(
      chatId,
      `⏳ <b>Dijadwalkan!</b> Presensi akan dikirim otomatis dalam <b>${delayMinutes} menit</b>.\nKetik /batal jika ingin membatalkan.`,
      { parse_mode: 'HTML' }
    );

    const timer = setTimeout(async () => {
      activeTimers.delete(chatId);
      try {
        const res = await submitAttendance(draft);
        pendingDrafts.delete(chatId);
        bot.sendMessage(
          chatId,
          `✅ <b>Presensi Terjadwal Berhasil!</b>\n` +
          `• ID Presensi: <code>${escapeHtml(res.data?.id)}</code>\n` +
          `• Waktu Server: <code>${escapeHtml(res.data?.created_at)}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        bot.sendMessage(chatId, `❌ <b>Gagal Submit Terjadwal:</b>\n<code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' });
      }
    }, delayMinutes * 60 * 1000);

    activeTimers.set(chatId, timer);
  }
});

// Auto refresh berkala setiap 5 jam agar sesi 6 jam selalu diperpanjang otomatis
setInterval(() => {
  refreshAccessToken().catch((err) => console.error('⚠️ Auto-refresh interval gagal:', err.message));
}, 5 * 60 * 60 * 1000);

console.log('🤖 Bot Presensi MagangHub siap! Kirim /cek di Telegram untuk uji koneksi.');