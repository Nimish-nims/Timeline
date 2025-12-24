-- ============================================
-- Supabase Database Setup Script
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. User Table (should already exist, but adding missing columns if needed)
-- ============================================
DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isPublic') THEN
    ALTER TABLE "User" ADD COLUMN "isPublic" BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'publicSlug') THEN
    ALTER TABLE "User" ADD COLUMN "publicSlug" TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'image') THEN
    ALTER TABLE "User" ADD COLUMN "image" TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role') THEN
    ALTER TABLE "User" ADD COLUMN "role" TEXT DEFAULT 'member';
  END IF;
END $$;

-- Add unique constraint on publicSlug if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'User_publicSlug_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_publicSlug_key" UNIQUE ("publicSlug");
  END IF;
END $$;

-- ============================================
-- 2. Post Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Add foreign key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Post_authorId_fkey'
  ) THEN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" 
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. Tag Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. PostTags Junction Table (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS "_PostTags" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_PostTags_AB_pk" PRIMARY KEY ("A", "B")
);

-- Add foreign keys for junction table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '_PostTags_A_fkey'
  ) THEN
    ALTER TABLE "_PostTags" ADD CONSTRAINT "_PostTags_A_fkey" 
    FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '_PostTags_B_fkey'
  ) THEN
    ALTER TABLE "_PostTags" ADD CONSTRAINT "_PostTags_B_fkey" 
    FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create indexes for junction table
CREATE INDEX IF NOT EXISTS "_PostTags_B_index" ON "_PostTags"("B");

-- ============================================
-- 5. Comment Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Add foreign keys for Comment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Comment_postId_fkey'
  ) THEN
    ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Comment_authorId_fkey'
  ) THEN
    ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" 
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 6. PostShare Table
-- ============================================
CREATE TABLE IF NOT EXISTS "PostShare" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostShare_postId_userId_key" UNIQUE ("postId", "userId")
);

-- Add foreign keys for PostShare
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'PostShare_postId_fkey'
  ) THEN
    ALTER TABLE "PostShare" ADD CONSTRAINT "PostShare_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'PostShare_userId_fkey'
  ) THEN
    ALTER TABLE "PostShare" ADD CONSTRAINT "PostShare_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 7. Invitation Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "invitedById" TEXT NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for Invitation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Invitation_invitedById_fkey'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" 
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 8. PasswordReset Table
-- ============================================
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. Create Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId");
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX IF NOT EXISTS "PostShare_postId_idx" ON "PostShare"("postId");
CREATE INDEX IF NOT EXISTS "PostShare_userId_idx" ON "PostShare"("userId");
CREATE INDEX IF NOT EXISTS "Invitation_invitedById_idx" ON "Invitation"("invitedById");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_token_idx" ON "PasswordReset"("token");

-- ============================================
-- Done! All tables and relations should now be set up
-- ============================================

