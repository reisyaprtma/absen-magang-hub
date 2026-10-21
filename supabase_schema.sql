-- Tabel untuk menyimpan sesi token MagangHub
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT 'default',
  build_id TEXT,
  access_token TEXT,
  cookies JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk menyimpan draf kegiatan sementara per user
CREATE TABLE IF NOT EXISTS drafts (
  chat_id TEXT PRIMARY KEY,
  activity_log TEXT,
  lesson_learned TEXT,
  obstacles TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
