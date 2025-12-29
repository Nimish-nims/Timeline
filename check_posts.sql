-- ============================================
-- Diagnostic Query - Check Posts
-- Run this in Supabase SQL Editor to see if posts exist
-- ============================================

-- Check if Post table exists and count posts
SELECT 
  'Post table exists' as status,
  COUNT(*) as post_count
FROM "Post";

-- Check recent posts
SELECT 
  id,
  title,
  "authorId",
  "createdAt"
FROM "Post"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check if Post table has the correct structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'Post'
ORDER BY ordinal_position;





