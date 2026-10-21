const { loadSession, saveSession } = require('./session');

const CONFIG = {
  PARTICIPANT_ID: process.env.PARTICIPANT_ID || 'c2f6d161-deb8-44a5-b7cd-257ec288c616',
  LATITUDE: parseFloat(process.env.LATITUDE || '-1.838417'),
  LONGITUDE: parseFloat(process.env.LONGITUDE || '109.977674'),
  ENABLE_GPS_JITTER: process.env.ENABLE_GPS_JITTER !== 'false'
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCookieString(cookies = {}) {
  return Object.entries(cookies)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function updateCookiesFromResponse(session, res) {
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
      if (val && val !== 'deleted' && val !== '""') {
        session.cookies[name] = val;
        updated = true;
      }
    }
  }
  return updated;
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
  const jitterLat = (Math.random() - 0.5) * 0.00003;
  const jitterLng = (Math.random() - 0.5) * 0.00003;
  return {
    latitude: Number((CONFIG.LATITUDE + jitterLat).toFixed(6)),
    longitude: Number((CONFIG.LONGITUDE + jitterLng).toFixed(6))
  };
}

async function updateFrontendBuildId(session) {
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
        await saveSession(session);
      }
    }
  } catch (_) {}
}

function getHeaders(session, includeAuth = true, isJson = false) {
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
    'Cookie': buildCookieString(session.cookies)
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
  const session = await loadSession();
  console.log('🔄 Meminta access_token baru ke /api/v1/auth/refresh...');
  let res = await fetch('https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/refresh', {
    method: 'POST',
    headers: { ...getHeaders(session, false, false), 'content-length': '0' }
  });
  
  if (updateCookiesFromResponse(session, res)) {
    await saveSession(session);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Refresh Token Gagal (HTTP ${res.status}): ${errBody}`);
  }

  const data = await res.json();
  if (data.access_token) {
    session.accessToken = data.access_token;
    await saveSession(session);
    console.log('✅ Access token berhasil diperbarui!');
    return data.access_token;
  }
  throw new Error('Respons /auth/refresh tidak memuat access_token');
}

async function requestWithAutoRefresh(url, options = {}) {
  const session = await loadSession();
  await updateFrontendBuildId(session);
  const isJson = Boolean(options.body);

  let res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(session, true, isJson), ...(options.headers || {}) }
  });
  
  if (updateCookiesFromResponse(session, res)) {
    await saveSession(session);
  }

  if (res.status === 401) {
    console.log('⚠️ HTTP 401 terdeteksi, menjalankan auto-refresh token...');
    await refreshAccessToken();
    const newSession = await loadSession();
    res = await fetch(url, {
      ...options,
      headers: { ...getHeaders(newSession, true, isJson), ...(options.headers || {}) }
    });
    if (updateCookiesFromResponse(newSession, res)) {
      await saveSession(newSession);
    }
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

module.exports = {
  CONFIG,
  escapeHtml,
  getTodayWIB,
  checkTodayAttendance,
  submitAttendance,
  refreshAccessToken
};
