-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL
);

-- Sentences table
CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES videos(id),
  jp TEXT NOT NULL,
  en TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Attempts table
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  sentence_id TEXT NOT NULL REFERENCES sentences(id),
  ms INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('got', 'close', 'miss')),
  created_at INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sentences_video_id ON sentences(video_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_sentence_id ON attempts(sentence_id);
