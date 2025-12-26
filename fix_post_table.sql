-- ============================================
-- Fix Post Table - Add Missing Title Column
-- Run this in Supabase SQL Editor
-- ============================================

-- Add title column to Post table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Post' 
    AND column_name = 'title'
  ) THEN
    ALTER TABLE "Post" ADD COLUMN "title" TEXT;
  END IF;
END $$;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'Post'
ORDER BY ordinal_position;


