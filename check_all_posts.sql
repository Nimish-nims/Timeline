-- ============================================
-- Check All Posts and Their Relations
-- Run this in Supabase SQL Editor
-- ============================================

-- Count total posts
SELECT COUNT(*) as total_posts FROM "Post";

-- Check posts with invalid authorId (author doesn't exist)
SELECT 
  p.id,
  p."authorId",
  p."createdAt",
  CASE 
    WHEN u.id IS NULL THEN 'INVALID AUTHOR'
    ELSE 'VALID'
  END as status
FROM "Post" p
LEFT JOIN "User" u ON p."authorId" = u.id
ORDER BY p."createdAt" DESC;

-- Count posts with valid vs invalid authors
SELECT 
  CASE 
    WHEN u.id IS NULL THEN 'Invalid Author'
    ELSE 'Valid Author'
  END as status,
  COUNT(*) as count
FROM "Post" p
LEFT JOIN "User" u ON p."authorId" = u.id
GROUP BY status;






