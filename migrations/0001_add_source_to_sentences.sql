-- Add source column to sentences table for PDF file names
ALTER TABLE sentences ADD COLUMN source TEXT;

-- Make video_id optional (it's already nullable by default in SQLite)
-- Update existing sentences to have source from videos table
UPDATE sentences
SET source = (SELECT url FROM videos WHERE videos.id = sentences.video_id)
WHERE video_id IS NOT NULL;
