-- Update attempts table to allow 'ok' and 'ng' result values
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we need to recreate the table

-- Create new table with updated constraint
CREATE TABLE IF NOT EXISTS attempts_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  sentence_id TEXT NOT NULL REFERENCES sentences(id),
  ms INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('ok', 'ng', 'got', 'close', 'miss')),
  created_at INTEGER NOT NULL
);

-- Copy data from old table (if any exists)
INSERT INTO attempts_new SELECT * FROM attempts;

-- Drop old table
DROP TABLE attempts;

-- Rename new table
ALTER TABLE attempts_new RENAME TO attempts;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_sentence_id ON attempts(sentence_id);
