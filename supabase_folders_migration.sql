-- ============================================================
-- Supabase migration: Add Folders (Option 1 - Categorize notes)
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create Folder table
CREATE TABLE IF NOT EXISTS "Folder" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "parentId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Folder_userId_fkey"     FOREIGN KEY ("userId")   REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Folder_parentId_fkey"  FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Indexes on Folder (for fast lookups by user and by parent)
CREATE INDEX IF NOT EXISTS "Folder_userId_idx"         ON "Folder"("userId");
CREATE INDEX IF NOT EXISTS "Folder_userId_parentId_idx" ON "Folder"("userId", "parentId");

-- 3. Add folderId to Post (nullable; when folder is deleted, post stays with folderId = NULL)
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "folderId" TEXT;

-- 4. Add foreign key from Post to Folder (only if column was just added or not yet constrained)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Post' AND constraint_name = 'Post_folderId_fkey'
  ) THEN
    ALTER TABLE "Post"
      ADD CONSTRAINT "Post_folderId_fkey"
      FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Optional: index on Post.folderId for filtering timeline by folder
CREATE INDEX IF NOT EXISTS "Post_folderId_idx" ON "Post"("folderId");

-- Done. You can now use folders in the app.
