-- Add number column to sentences for stable sequential numbering
ALTER TABLE sentences ADD COLUMN number INTEGER;

-- Assign sequential numbers to existing sentences based on created_at order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) as row_num
  FROM sentences
)
UPDATE sentences
SET number = (SELECT row_num FROM numbered WHERE numbered.id = sentences.id);

-- Create index for fast number lookups
CREATE INDEX IF NOT EXISTS idx_sentences_number ON sentences(number);
