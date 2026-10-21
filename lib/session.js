const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '..', 'session.json');

const DEFAULT_SESSION = {
  buildId: '15e51ff8e57e2c9237258d8d216421ce1730f239-production',
  accessToken: '',
  cookies: {
    cf_clearance: '',
    acw_tc: '',
    monev_refresh_token: ''
  }
};

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Membaca session dari Supabase (atau fallback ke session.json lokal jika di localhost)
 */
async function loadSession() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', 'default')
        .single();

      if (!error && data) {
        return {
          buildId: data.build_id || DEFAULT_SESSION.buildId,
          accessToken: data.access_token || '',
          cookies: typeof data.cookies === 'string' ? JSON.parse(data.cookies) : (data.cookies || {})
        };
      }
    } catch (err) {
      console.warn('⚠️ Gagal mengambil sesi dari Supabase:', err.message);
    }
  }

  // Fallback lokal jika ada file session.json
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      return {
        ...DEFAULT_SESSION,
        ...saved,
        cookies: { ...DEFAULT_SESSION.cookies, ...(saved.cookies || {}) }
      };
    } catch (_) {}
  }
  return { ...DEFAULT_SESSION };
}

/**
 * Menyimpan session ke Supabase dan ke session.json lokal
 */
async function saveSession(session) {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('sessions').upsert({
        id: 'default',
        build_id: session.buildId,
        access_token: session.accessToken,
        cookies: session.cookies,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('⚠️ Gagal menyimpan sesi ke Supabase:', err.message);
    }
  }

  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (_) {}
}

/**
 * Menyimpan draf laporan sementara di Supabase
 */
async function saveDraft(chatId, draft) {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('drafts').upsert({
      chat_id: String(chatId),
      activity_log: draft.activity_log,
      lesson_learned: draft.lesson_learned,
      obstacles: draft.obstacles,
      updated_at: new Date().toISOString()
    });
  }
}

/**
 * Mengambil draf laporan dari Supabase
 */
async function getDraft(chatId) {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from('drafts')
      .select('*')
      .eq('chat_id', String(chatId))
      .single();
    if (data) {
      return {
        activity_log: data.activity_log,
        lesson_learned: data.lesson_learned,
        obstacles: data.obstacles
      };
    }
  }
  return null;
}

/**
 * Menghapus draf dari Supabase
 */
async function deleteDraft(chatId) {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('drafts').delete().eq('chat_id', String(chatId));
  }
}

module.exports = {
  loadSession,
  saveSession,
  saveDraft,
  getDraft,
  deleteDraft
};
