"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PostEditor } from '@/components/post-editor'
import { Timeline } from '@/components/timeline'
import { Loader2, ArrowLeft, Folder, Inbox } from 'lucide-react'

interface FolderOption {
  id: string
  name: string
  _count: { posts: number }
}

interface Post {
  id: string
  title?: string | null
  content: string
  createdAt: string
  updatedAt: string
  author: { id: string; name: string; email: string; image?: string | null }
  tags?: { id: string; name: string }[]
  shares?: { user: { id: string; name: string; email: string; image?: string | null } }[]
  mentions?: { user: { id: string; name: string; email: string; image?: string | null } }[]
  folderId?: string | null
  folder?: { id: string; name: string } | null
  _count?: { comments: number }
}

export default function FolderViewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [folderName, setFolderName] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const isUncategorized = id === 'uncategorized'
  const folderIdParam = isUncategorized ? 'uncategorized' : id

  const fetchPosts = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', '20')
        if (cursor) params.set('cursor', cursor)
        params.set('folderId', folderIdParam)
        const res = await fetch(`/api/posts?${params.toString()}`)
        const data = await res.json()
        if (data.posts && Array.isArray(data.posts)) {
          if (append) {
            setPosts((prev) => [...prev, ...data.posts])
          } else {
            setPosts(data.posts)
          }
          setNextCursor(data.nextCursor)
          setHasMore(data.hasMore)
          setTotalCount(data.totalCount ?? 0)
        } else {
          if (!append) setPosts([])
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
        if (!append) setPosts([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [folderIdParam]
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (!session?.user?.id) return
    if (!id) return

    if (isUncategorized) {
      setFolderName('Uncategorized')
      fetchPosts()
    } else {
      const fetchFolderAndPosts = async () => {
        try {
          const folderRes = await fetch(`/api/folders/${id}`)
          if (!folderRes.ok) {
            router.replace('/folders')
            return
          }
          const folder = await folderRes.json()
          setFolderName(folder.name)
        } catch {
          router.replace('/folders')
          return
        }
        fetchPosts()
      }
      fetchFolderAndPosts()
    }
  }, [session?.user?.id, status, router, id, isUncategorized, fetchPosts])

  useEffect(() => {
    if (!session?.user?.id) return
    const fetchFolders = async () => {
      try {
        const res = await fetch('/api/folders')
        if (res.ok) {
          const data = await res.json()
          setFolders(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error)
      }
    }
    fetchFolders()
  }, [session?.user?.id])

  const loadMorePosts = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return
    fetchPosts(nextCursor, true)
  }, [hasMore, loadingMore, nextCursor, fetchPosts])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && nextCursor) {
          loadMorePosts()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, nextCursor, loadMorePosts])

  const handlePost = useCallback(
    async (content: string, tags: string[], title?: string, postFolderId?: string | null, attachmentIds?: string[]) => {
      if (!session?.user?.id) return
      const targetFolderId = isUncategorized ? null : id
      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            tags: tags.map((t) => t.toLowerCase()),
            title: title || undefined,
            folderId: targetFolderId,
            attachmentIds,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Failed to create post')
        }
        fetchPosts()
      } catch (error) {
        console.error('Failed to create post:', error)
        alert(error instanceof Error ? error.message : 'Failed to create post')
      }
    },
    [session?.user?.id, id, isUncategorized, fetchPosts]
  )

  const handleEdit = useCallback(
    async (postId: string, content: string, tags?: string[], folderId?: string | null) => {
      const targetFolderId = isUncategorized ? null : id
      try {
        const res = await fetch(`/api/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            tags: (tags ?? []).map((t) => t.toLowerCase()),
            folderId: folderId !== undefined ? folderId : targetFolderId,
          }),
        })
        if (!res.ok) throw new Error('Failed to update post')
        fetchPosts()
      } catch (error) {
        console.error('Failed to update post:', error)
      }
    },
    [id, isUncategorized, fetchPosts]
  )

  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
        if (res.ok) fetchPosts()
      } catch (error) {
        console.error('Failed to delete post:', error)
      }
    },
    [fetchPosts]
  )

  const handleSharePost = useCallback(async (_postId: string, _userIds: string[]) => {}, [])
  const handleUnsharePost = useCallback(async (_postId: string, _userId: string) => {}, [])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!id) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight hidden sm:inline">Timeline</span>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/folders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Folders</span>
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${isUncategorized ? 'bg-muted' : 'bg-primary/10'}`}>
              {isUncategorized ? (
                <Inbox className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate leading-none">
                {folderName ?? '...'}
              </h1>
            </div>
          </div>
          <Badge variant="secondary" className="tabular-nums font-normal shrink-0">
            {totalCount} {totalCount === 1 ? 'post' : 'posts'}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        <PostEditor
          onPost={handlePost}
          folders={folders}
          defaultFolderId={isUncategorized ? null : id}
          lockFolder
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
              {isUncategorized ? (
                <Inbox className="h-6 w-6 text-muted-foreground/60" />
              ) : (
                <Folder className="h-6 w-6 text-muted-foreground/60" />
              )}
            </div>
            <p className="text-sm font-medium">No posts in this folder yet</p>
            <p className="text-sm text-muted-foreground mt-1">Use the composer above to add a post here.</p>
          </div>
        ) : (
          <>
            <Timeline
              posts={posts.map((post) => ({
                id: post.id,
                title: post.title,
                content: post.content,
                authorName: post.author.name,
                authorId: post.author.id,
                authorImage: post.author.image,
                createdAt: new Date(post.createdAt),
                updatedAt: new Date(post.updatedAt),
                tags: post.tags,
                shares: post.shares,
                folderId: post.folderId,
                folder: post.folder,
                mentions: post.mentions,
                _count: post._count,
              }))}
              onDelete={handleDelete}
              onEdit={handleEdit}
              folders={folders}
              onSharePost={handleSharePost}
              onUnsharePost={handleUnsharePost}
              currentUserId={session?.user?.id}
              isAdmin={session?.user?.role === 'admin'}
              filterByUserId={null}
              filterByUserName={null}
              onFilterByUser={() => {}}
              onClearFilter={() => {}}
              filterByTag={null}
              onFilterByTag={() => {}}
              onClearTagFilter={() => {}}
            />
            <div ref={loadMoreRef} className="py-4">
              {loadingMore && (
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground">All posts loaded</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
