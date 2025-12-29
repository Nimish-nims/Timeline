"use client"

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
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
  Share2,
  Calendar,
  ArrowLeft,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/breadcrumbs'

const EddyterWrapper = dynamic(() => import('@/components/eddyter-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[100px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin" />
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
  comments?: Comment[]
  _count?: {
    comments: number
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function isEdited(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  // Consider edited if updated more than 1 second after creation
  return updated - created > 1000
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Comment state
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session && id) {
      fetchPost()
    }
  }, [session, id])

  const fetchPost = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${id}/get`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Post not found')
        } else if (res.status === 403) {
          setError('You do not have access to this post')
        } else {
          setError('Failed to load post')
        }
        return
      }
      const data = await res.json()
      setPost(data)
    } catch (err) {
      console.error('Failed to fetch post:', err)
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
        setPost(prev => prev ? {
          ...prev,
          comments: [...(prev.comments || []), newComment]
        } : null)
        setCommentInput('')
      }
    } catch (err) {
      console.error('Failed to submit comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPost(prev => prev ? {
          ...prev,
          comments: prev.comments?.filter(c => c.id !== commentId) || []
        } : null)
      }
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
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
    } catch (err) {
      console.error('Failed to update post:', err)
    }
  }

  const handleDelete = async () => {
    if (!post) return
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        router.push('/')
      }
    } catch (err) {
      console.error('Failed to delete post:', err)
    }
  }

  const canEditPost = post && (session?.user?.id === post.author.id || session?.user?.role === 'admin')
  const canDeleteComment = (comment: Comment) => {
    return session?.user?.role === 'admin' ||
           comment.authorId === session?.user?.id ||
           post?.author.id === session?.user?.id
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <span className="text-lg font-semibold">Post</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-6 py-8">
        <Breadcrumbs
          items={[
            { label: post?.title || 'Post', href: undefined }
          ]}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading post...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{error}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              The post may have been deleted or you may not have permission to view it.
            </p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Timeline
            </Button>
          </div>
        ) : post ? (
          <div className="space-y-6">
            {/* Main Post Card */}
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border-2 border-border">
                      {post.author.image && (
                        <AvatarImage src={post.author.image} alt={post.author.name} />
                      )}
                      <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                        {getInitials(post.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg text-foreground">{post.author.name}</p>
                      <p className="text-sm text-muted-foreground">{post.author.email}</p>
                    </div>
                  </div>
                  {canEditPost && !isEditing && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={handleStartEdit}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Date/Time Info */}
                <div className="flex items-center flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(new Date(post.createdAt))}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(new Date(post.createdAt))}</span>
                  </div>
                  {isEdited(post.createdAt, post.updatedAt) && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted">
                      <Pencil className="h-3 w-3" />
                      <span>Edited {formatRelativeDate(new Date(post.updatedAt))}</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <EddyterWrapper
                      onChange={setEditContent}
                      initialContent={post.content}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="h-4 w-4 mr-1.5" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="h-4 w-4 mr-1.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Post Title */}
                    {post.title && (
                      <h1 className="text-2xl font-bold text-foreground mb-4">
                        {post.title}
                      </h1>
                    )}
                    <div
                      className="prose prose-lg dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                  </>
                )}

                {/* Tags */}
                {!isEditing && post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {post.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Shared With */}
                {!isEditing && post.shares && post.shares.length > 0 && (
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Share2 className="h-4 w-4" />
                      <span>Shared with</span>
                    </div>
                    <div className="flex -space-x-2">
                      {post.shares.slice(0, 8).map((share) => (
                        <Avatar key={share.user.id} className="h-8 w-8 border-2 border-background" title={share.user.name}>
                          {share.user.image && (
                            <AvatarImage src={share.user.image} alt={share.user.name} />
                          )}
                          <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
                            {getInitials(share.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {post.shares.length > 8 && (
                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                          <span className="text-xs font-medium text-muted-foreground">+{post.shares.length - 8}</span>
                        </div>
                      )}
                    </div>
                    {post.shares.length <= 5 && (
                      <span className="text-sm text-muted-foreground">
                        {post.shares.map(s => s.user.name).join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comments Section */}
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-4 pt-5 px-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Comments ({post.comments?.length || 0})
                  </h2>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-6">
                {/* Comments List - Vertical Timeline Style */}
                {post.comments && post.comments.length > 0 ? (
                  <div className="relative mb-6">
                    {/* Timeline Line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent" />

                    <div className="space-y-0">
                      {post.comments.map((comment, index) => (
                        <div
                          key={comment.id}
                          className="relative pl-14 pb-6 group"
                        >
                          {/* Timeline Node */}
                          <div className="absolute left-0 top-0 flex items-center justify-center">
                            <div className="relative">
                              {/* Outer ring with pulse animation for latest comment */}
                              <div className={`absolute inset-0 rounded-full ${
                                index === post.comments!.length - 1
                                  ? 'bg-primary/20 animate-ping'
                                  : ''
                              }`} />
                              {/* Avatar as timeline node */}
                              <Avatar className="h-10 w-10 border-2 border-background shadow-md ring-2 ring-primary/20 relative z-10">
                                {comment.author.image && (
                                  <AvatarImage src={comment.author.image} alt={comment.author.name} />
                                )}
                                <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                                  {getInitials(comment.author.name)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>

                          {/* Comment Content Card */}
                          <div className="relative">
                            {/* Arrow pointing to timeline */}
                            <div className="absolute -left-2 top-4 w-2 h-2 rotate-45 bg-muted/50 border-l border-b border-border" />

                            <div className="p-4 rounded-lg bg-muted/30 border transition-all hover:bg-muted/50 hover:shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {/* Header with author and timestamp */}
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span className="font-semibold text-foreground">
                                      {comment.author.name}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      {formatRelativeDate(new Date(comment.createdAt))}
                                    </span>
                                  </div>
                                  {/* Comment content */}
                                  <div
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: comment.content }}
                                  />
                                </div>
                                {canDeleteComment(comment) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                    onClick={() => handleDeleteComment(comment.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Connector line segment */}
                          {index < post.comments!.length - 1 && (
                            <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-border" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center mb-6">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gradient-to-b from-muted-foreground/20 to-transparent" />
                    </div>
                    <p className="text-muted-foreground mt-4">No comments yet. Be the first to comment!</p>
                  </div>
                )}

                {/* Add Comment */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Add a comment</span>
                  </div>
                  <div className="rounded-lg border bg-muted/30 overflow-hidden">
                    <EddyterWrapper
                      onChange={setCommentInput}
                      placeholder="Write a comment..."
                      initialContent=""
                      key={`comment-editor-${post.comments?.length || 0}`}
                    />
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button
                      onClick={handleSubmitComment}
                      disabled={!commentInput?.replace(/<[^>]*>/g, '').trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Post Comment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  )
}
