"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Calendar, FileText, Lock, ArrowLeft, User, MessageSquare, ChevronDown, ChevronUp } from "lucide-react"

interface Comment {
  id: string
  content: string
  author: {
    name: string
    image?: string | null
  }
  createdAt: string
}

interface Post {
  id: string
  content: string
  createdAt: string
}

interface PublicTimeline {
  user: {
    name: string
    image: string | null
    memberSince: string
  }
  posts: Post[]
  totalPosts: number
}

export default function PublicTimelinePage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [timeline, setTimeline] = useState<PublicTimeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})

  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => ({ ...prev, [postId]: true }))
    try {
      const response = await fetch(`/api/comments?postId=${postId}`)
      if (response.ok) {
        const data = await response.json()
        setComments(prev => ({ ...prev, [postId]: data }))
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  const toggleComments = (postId: string) => {
    const isExpanding = !expandedComments[postId]
    setExpandedComments(prev => ({ ...prev, [postId]: isExpanding }))
    if (isExpanding && !comments[postId]) {
      fetchComments(postId)
    }
  }

  const formatCommentTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    let relativeTime = ''
    if (days < 1) relativeTime = 'Today'
    else if (days < 7) relativeTime = `${days}d ago`
    else {
      relativeTime = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }

    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    return `${relativeTime} at ${time}`
  }

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/public/${slug}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || "Failed to load timeline")
          return
        }
        
        setTimeline(data)
      } catch {
        setError("Failed to load timeline")
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchTimeline()
    }
  }, [slug])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {error === "This timeline is private" ? "Private Timeline" : "Timeline Not Found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error === "This timeline is private"
              ? "This user's timeline is not publicly visible."
              : "The timeline you're looking for doesn't exist or has been removed."}
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!timeline) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <span className="font-semibold">Timeline</span>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Profile Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={timeline.user.image || undefined} alt={timeline.user.name} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(timeline.user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{timeline.user.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {timeline.totalPosts} posts
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDate(timeline.user.memberSince).split(",")[0]}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <main className="container mx-auto max-w-3xl px-6 py-8">
        {timeline.posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No posts yet</h2>
            <p className="text-muted-foreground">
              {timeline.user.name} hasn't shared any posts yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {timeline.posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={timeline.user.image || undefined} alt={timeline.user.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(timeline.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{timeline.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                </CardContent>

                {/* Comments Section (Read-only for public view) */}
                <div className="border-t">
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="w-full px-6 py-3 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>
                        {comments[post.id]?.length
                          ? `${comments[post.id].length} comment${comments[post.id].length === 1 ? '' : 's'}`
                          : 'Comments'}
                      </span>
                    </div>
                    {expandedComments[post.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {expandedComments[post.id] && (
                    <div className="px-6 pb-4">
                      {loadingComments[post.id] && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {!loadingComments[post.id] && comments[post.id]?.length > 0 && (
                        <div className="space-y-3">
                          {comments[post.id].map((comment) => (
                            <div
                              key={comment.id}
                              className="flex gap-3 p-3 rounded-lg bg-muted/30"
                            >
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                {comment.author.image && (
                                  <AvatarImage src={comment.author.image} alt={comment.author.name} />
                                )}
                                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                  {getInitials(comment.author.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm text-foreground">
                                  {comment.author.name}
                                </span>
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none mt-0.5 [&>p]:mb-1 [&>p:last-child]:mb-0"
                                  dangerouslySetInnerHTML={{ __html: comment.content }}
                                />
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  {formatCommentTimestamp(comment.createdAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!loadingComments[post.id] && (!comments[post.id] || comments[post.id].length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-3">
                          No comments yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto max-w-3xl px-6 text-center text-sm text-muted-foreground">
          <p>Powered by Timeline • Built with CT Editor</p>
        </div>
      </footer>
    </div>
  )
}




