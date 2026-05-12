-- Prevent duplicate sentence pairs.
-- Run after 0004_add_number_to_sentences.sql.
-- Existing duplicates were manually deduped on 2026-05-12; this index
-- guards against future re-imports of the same (jp, en) pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentences_jp_en_unique ON sentences(jp, en);
