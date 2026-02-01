"use client"

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'
import { useMentionMenuAvatars, type MemberForMention } from '@/lib/mention-menu-avatars'
import {
  Clock,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  X,
  Check,
  Tag,
  Users,
  User,
  ChevronLeft,
  History,
  RotateCcw,
  Home,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { LinkPreviewHover } from 'eddyter'

const EddyterWrapper = dynamic(() => import('@/components/eddyter-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-24 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  )
})

interface Comment {
  id: string
  content: string
  postId: string
  authorId: string
  author: {
    id: string
    name: string
    email: string
    image?: string | null
  }
  createdAt: string
  updatedAt: string
}

interface TagType {
  id: string
  name: string
}

interface SharedUser {
  id: string
  name: string
  email: string
  image?: string | null
}

interface Post {
  id: string
  title?: string | null
  content: string
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string
    email: string
    image?: string | null
  }
  tags?: TagType[]
  shares?: { user: SharedUser }[]
  mentions?: { user: SharedUser }[]
  comments?: Comment[]
  _count?: {
    comments: number
  }
}

interface PostHistoryEntry {
  id: string
  postId: string
  title: string | null
  content: string
  editedAt: string
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isEdited(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000
}

function getInitials(name: string): string {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<PostHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [previewEntry, setPreviewEntry] = useState<PostHistoryEntry | null>(null)
  const [mentionUserList, setMentionUserList] = useState<string[]>([])
  const [membersForMentions, setMembersForMentions] = useState<MemberForMention[]>([])

  useMentionMenuAvatars(membersForMentions)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members?all=true')
        if (res.ok) {
          const data = await res.json()
          const members = data.members ?? data
          const list = Array.isArray(members) ? members : []
          const names = list.map((m: { name: string }) => m.name).filter(Boolean)
          const forMentions: MemberForMention[] = list
            .filter((m: { name?: string }) => typeof m?.name === 'string' && m.name.length > 0)
            .map((m: { id: string; name: string; image?: string | null }) => ({
              id: m.id,
              name: m.name,
              image: m.image ?? null,
            }))
          setMentionUserList(names)
          setMembersForMentions(forMentions)
        }
      } catch { /* ignore */ }
    }
    if (session) fetchMembers()
  }, [session])

  useEffect(() => {
    if (session && id) fetchPost()
  }, [session, id])

  const fetchPost = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${id}/get`)
      if (!res.ok) {
        setError(res.status === 404 ? 'Post not found' : res.status === 403 ? 'Access denied' : 'Failed to load')
        return
      }
      setPost(await res.json())
    } catch {
      setError('Failed to load post')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async () => {
    const content = commentInput?.trim()
    if (!content || !post) return
    setSubmittingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, content })
      })
      if (res.ok) {
        const newComment = await res.json()
        setPost(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null)
        setCommentInput('')
      }
    } catch { /* ignore */ } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setPost(prev => prev ? { ...prev, comments: prev.comments?.filter(c => c.id !== commentId) || [] } : null)
      }
    } catch { /* ignore */ }
  }

  const handleStartEdit = () => {
    if (post) {
      setEditContent(post.content)
      setIsEditing(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!post || !editContent.replace(/<[^>]*>/g, '').trim()) return
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      })
      if (res.ok) {
        const updatedPost = await res.json()
        setPost(prev => prev ? { ...prev, ...updatedPost } : null)
        setIsEditing(false)
      }
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    if (!post || !confirm('Delete this post?')) return
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) router.push('/')
    } catch { /* ignore */ }
  }

  const fetchHistory = async () => {
    if (!post) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/history`)
      if (res.ok) setHistory(await res.json())
    } catch { /* ignore */ } finally {
      setLoadingHistory(false)
    }
  }

  const handleRestore = async (historyId: string) => {
    if (!post || !confirm('Restore this version?')) return
    setRestoringId(historyId)
    try {
      const res = await fetch(`/api/posts/${post.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId })
      })
      if (res.ok) {
        const updatedPost = await res.json()
        setPost(prev => prev ? { ...prev, ...updatedPost } : null)
        setHistoryOpen(false)
        setPreviewEntry(null)
        fetchHistory()
      }
    } catch { /* ignore */ } finally {
      setRestoringId(null)
    }
  }

  const handleOpenHistory = () => {
    setHistoryOpen(true)
    fetchHistory()
  }

  const canEditPost = post && (session?.user?.id === post.author.id || session?.user?.role === 'admin')
  const canDeleteComment = (comment: Comment) =>
    session?.user?.role === 'admin' || comment.authorId === session?.user?.id || post?.author.id === session?.user?.id

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30">
        {/* Minimal Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href="/"><Home className="h-4 w-4" /></Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Home</TooltipContent>
              </Tooltip>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Loading...</p>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <X className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="font-semibold mb-1">{error}</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  This post may have been deleted or you don&apos;t have access.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/')}>
                  Go to Timeline
                </Button>
              </CardContent>
            </Card>
          ) : post ? (
            <div className="space-y-6">
              {/* Post Card */}
              <Card className="overflow-hidden">
                {/* Author Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-background">
                        {post.author.image && <AvatarImage src={post.author.image} />}
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold">
                          {getInitials(post.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{post.author.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatShortDate(new Date(post.createdAt))} at {formatTime(new Date(post.createdAt))}
                          {isEdited(post.createdAt, post.updatedAt) && (
                            <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">edited</Badge>
                          )}
                        </p>
                      </div>
                    </div>

                    {canEditPost && !isEditing && (
                      <div className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpenHistory}>
                              <History className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>History</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleStartEdit}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={handleDelete}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Post Content */}
                <div className="px-6 py-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border overflow-hidden [&_.eddyter-container]:!max-w-full [&_.ProseMirror]:!max-w-full">
                        <EddyterWrapper
                          onChange={setEditContent}
                          initialContent={post.content}
                          mentionUserList={mentionUserList}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-4 w-4 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.title && (
                        <h1 className="text-2xl font-bold tracking-tight mb-4">{post.title}</h1>
                      )}
                      <LinkPreviewHover
                        apiKey={process.env.NEXT_PUBLIC_EDDYTER_API_KEY || 'eddyt_qzN3ppNHlkHUWMGsZ1pRSqsipU8124d7Q3Mw9FTc3cDW7Q3AwA9JXiVmARpgXqIIaU5PKXoYMeDVSuG2Z9GGJyO8AF'}
                        enabled={true}
                      >
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0"
                          dangerouslySetInnerHTML={{ __html: post.content }}
                        />
                      </LinkPreviewHover>
                    </>
                  )}
                </div>

                {/* Tags, Mentions & Shares Footer */}
                {!isEditing && ((post.tags && post.tags.length > 0) || (post.mentions && post.mentions.length > 0) || (post.shares && post.shares.length > 0)) && (
                  <>
                    <Separator />
                    <div className="px-6 py-4 flex flex-wrap items-center gap-4">
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1.5">
                            {post.tags.map(tag => (
                              <Badge key={tag.id} variant="secondary" className="text-xs">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {post.mentions && post.mentions.length > 0 && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1.5">
                            {post.mentions.map(m => (
                              <Link key={m.user.id} href={`/profile/${m.user.id}`}>
                                <Badge variant="outline" className="text-xs hover:bg-muted">
                                  {m.user.name}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {post.shares && post.shares.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="flex -space-x-1.5">
                            {post.shares.slice(0, 4).map(share => (
                              <Tooltip key={share.user.id}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    {share.user.image && <AvatarImage src={share.user.image} />}
                                    <AvatarFallback className="text-[10px] bg-muted">
                                      {getInitials(share.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>{share.user.name}</TooltipContent>
                              </Tooltip>
                            ))}
                            {post.shares.length > 4 && (
                              <span className="text-xs text-muted-foreground ml-2">+{post.shares.length - 4}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>

              {/* Comments Card */}
              <Card>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-semibold">Comments</span>
                    <Badge variant="secondary" className="text-xs">{post.comments?.length || 0}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="px-6 py-4">
                  {/* Comment List */}
                  {post.comments && post.comments.length > 0 ? (
                    <div className="space-y-4 mb-6">
                      {post.comments.map(comment => (
                        <div key={comment.id} className="group flex gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            {comment.author.image && <AvatarImage src={comment.author.image} />}
                            <AvatarFallback className="text-xs bg-muted">
                              {getInitials(comment.author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="bg-muted/50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium">{comment.author.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeDate(new Date(comment.createdAt))}
                                </span>
                              </div>
                              <LinkPreviewHover
                                apiKey={process.env.NEXT_PUBLIC_EDDYTER_API_KEY || 'eddyt_qzN3ppNHlkHUWMGsZ1pRSqsipU8124d7Q3Mw9FTc3cDW7Q3AwA9JXiVmARpgXqIIaU5PKXoYMeDVSuG2Z9GGJyO8AF'}
                                enabled={true}
                              >
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0"
                                  dangerouslySetInnerHTML={{ __html: comment.content }}
                                />
                              </LinkPreviewHover>
                            </div>
                            {canDeleteComment(comment) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 mt-1 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No comments yet</p>
                    </div>
                  )}

                  {/* Add Comment */}
                  <Separator className="my-4" />
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      {session?.user?.image && <AvatarImage src={session.user.image} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {session?.user?.name ? getInitials(session.user.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="rounded-lg border overflow-hidden [&_.eddyter-container]:!max-w-full [&_.ProseMirror]:!max-w-full">
                        <EddyterWrapper
                          onChange={setCommentInput}
                          placeholder="Write a comment..."
                          initialContent=""
                          key={`comment-${post.comments?.length || 0}`}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={!commentInput?.replace(/<[^>]*>/g, '').trim() || submittingComment}
                          onClick={handleSubmitComment}
                        >
                          {submittingComment ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </main>

        {/* History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="w-[95vw] max-w-4xl h-[80vh] max-h-[700px] p-0 gap-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0 bg-background">
              <History className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-lg font-semibold">Version History</DialogTitle>
              {history.length > 0 && (
                <Badge variant="secondary">{history.length}</Badge>
              )}
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Version List */}
              <div className="w-64 shrink-0 border-r bg-muted/20 overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <History className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No edit history</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {history.map((entry, i) => {
                      const selected = previewEntry?.id === entry.id
                      return (
                        <button
                          key={entry.id}
                          onClick={() => setPreviewEntry(entry)}
                          className={`w-full text-left p-3 rounded-md transition-colors ${
                            selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">Version {history.length - i}</span>
                            <span className={`text-xs ${selected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {formatRelativeDate(new Date(entry.editedAt))}
                            </span>
                          </div>
                          <p className={`text-xs truncate ${selected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {entry.content.replace(/<[^>]*>/g, '').slice(0, 45)}...
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {previewEntry ? (
                  <>
                    <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Version {history.findIndex(h => h.id === previewEntry.id) !== -1
                            ? history.length - history.findIndex(h => h.id === previewEntry.id)
                            : ''}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatShortDate(new Date(previewEntry.editedAt))}
                        </span>
                      </div>
                      <Button size="sm" onClick={() => handleRestore(previewEntry.id)} disabled={restoringId === previewEntry.id}>
                        {restoringId === previewEntry.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Restore
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="rounded-lg border bg-card p-5">
                        <LinkPreviewHover
                          apiKey={process.env.NEXT_PUBLIC_EDDYTER_API_KEY || 'eddyt_qzN3ppNHlkHUWMGsZ1pRSqsipU8124d7Q3Mw9FTc3cDW7Q3AwA9JXiVmARpgXqIIaU5PKXoYMeDVSuG2Z9GGJyO8AF'}
                          enabled={true}
                        >
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0"
                            dangerouslySetInnerHTML={{ __html: previewEntry.content }}
                          />
                        </LinkPreviewHover>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="font-medium">Select a version</p>
                    <p className="text-sm text-muted-foreground">Click a version to preview</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
