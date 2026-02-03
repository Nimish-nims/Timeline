"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Folder, FolderOpen, Inbox, Plus, Loader2, ChevronRight, FolderPlus } from 'lucide-react'

interface FolderItem {
  id: string
  name: string
  parentId: string | null
  _count: { posts: number }
}

export default function FoldersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [uncategorizedCount, setUncategorizedCount] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (!session?.user?.id) return

    const fetchFolders = async () => {
      setLoading(true)
      try {
        const [foldersRes, postsRes] = await Promise.all([
          fetch('/api/folders'),
          fetch('/api/posts?limit=1&folderId=uncategorized'),
        ])
        if (foldersRes.ok) {
          const data = await foldersRes.json()
          setFolders(Array.isArray(data) ? data : [])
        }
        if (postsRes.ok) {
          const data = await postsRes.json()
          setUncategorizedCount(data.totalCount ?? 0)
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchFolders()
  }, [session?.user?.id, status, router])

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const folder = await res.json()
        setFolders((prev) => [...prev, folder])
        setNewFolderName('')
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setCreating(false)
    }
  }

  const totalPosts = folders.reduce((sum, f) => sum + f._count.posts, 0) + (uncategorizedCount ?? 0)

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          <div className="flex-1 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Folders</h1>
          </div>
          {!loading && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {folders.length + 1} {folders.length + 1 === 1 ? 'folder' : 'folders'} &middot; {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
            </p>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Folders</CardTitle>
              <CardDescription>Organize your posts into folders for easy access.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Uncategorized */}
                <Link
                  href="/folders/uncategorized"
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Inbox className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">Uncategorized</p>
                    <p className="text-xs text-muted-foreground mt-1">Posts without a folder</p>
                  </div>
                  {uncategorizedCount !== null && (
                    <Badge variant="secondary" className="tabular-nums font-normal">
                      {uncategorizedCount}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                {/* User folders */}
                {folders.map((folder) => (
                  <Link
                    key={folder.id}
                    href={`/folders/${folder.id}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Folder className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {folder._count.posts} {folder._count.posts === 1 ? 'post' : 'posts'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="tabular-nums font-normal">
                      {folder._count.posts}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}

                {folders.length === 0 && (
                  <div className="px-6 py-8 text-center">
                    <Folder className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No folders yet. Create one below to get started.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create new folder */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">New Folder</CardTitle>
            </div>
            <CardDescription>Create a new folder to organize your posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createFolder())}
                className="flex-1"
              />
              <Button onClick={createFolder} disabled={!newFolderName.trim() || creating} size="default">
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
