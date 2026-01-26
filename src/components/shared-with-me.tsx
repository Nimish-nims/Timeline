"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Clock, Loader2, MessageSquare, Share2, Users, ChevronDown, Filter, X, Maximize2, Pencil } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LinkPreviewHover } from 'eddyter'

interface Tag {
  id: string
  name: string
}

interface SharedUser {
  id: string
  name: string
  email: string
  image?: string | null
}

interface SharedPost {
  id: string
  title?: string | null
  content: string
  createdAt: string
  updatedAt: string
  sharedAt: string
  author: {
    id: string
    name: string
    email: string
    image?: string | null
  }
  tags?: Tag[]
  shares?: { user: SharedUser }[]
  _count?: {
    comments: number
  }
}

interface Author {
  id: string
  name: string
  image: string | null
}

interface SharedWithMeProps {
  currentUserId?: string
}

function formatDate(date: Date): string {
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
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function isEdited(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  // Consider edited if updated more than 1 second after creation
  return updated - created > 1000
}

export function SharedWithMe({ currentUserId }: SharedWithMeProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<SharedPost[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null)
  const [selectedAuthorName, setSelectedAuthorName] = useState<string | null>(null)

  const fetchSharedPosts = async (authorId?: string | null) => {
    setLoading(true)
    try {
      const url = authorId
        ? `/api/posts/shared?authorId=${authorId}`
        : '/api/posts/shared'
      const res = await fetch(url)
      const data = await res.json()
      if (data.posts && Array.isArray(data.posts)) {
        setPosts(data.posts)
      } else {
        setPosts([])
      }
      if (data.authors && Array.isArray(data.authors)) {
        setAuthors(data.authors)
      }
    } catch (error) {
      console.error('Failed to fetch shared posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSharedPosts()
  }, [])

  const handleFilterByAuthor = (authorId: string, authorName: string) => {
    setSelectedAuthorId(authorId)
    setSelectedAuthorName(authorName)
    fetchSharedPosts(authorId)
  }

  const handleClearFilter = () => {
    setSelectedAuthorId(null)
    setSelectedAuthorName(null)
    fetchSharedPosts(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading shared posts...</p>
      </div>
    )
  }

  if (posts.length === 0 && !selectedAuthorId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Share2 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No shared posts yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          When someone shares a post with you, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Shared with Me</h2>
          <span className="text-sm text-muted-foreground">({posts.length})</span>
        </div>

        {authors.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {selectedAuthorName || 'Filter by author'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {selectedAuthorId && (
                <DropdownMenuItem onClick={handleClearFilter} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-2" />
                  Clear filter
                </DropdownMenuItem>
              )}
              {authors.map((author) => (
                <DropdownMenuItem
                  key={author.id}
                  onClick={() => handleFilterByAuthor(author.id, author.name)}
                  className={selectedAuthorId === author.id ? 'bg-accent' : ''}
                >
                  <Avatar className="h-6 w-6 mr-2">
                    {author.image && <AvatarImage src={author.image} alt={author.name} />}
                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                      {getInitials(author.name)}
                    </AvatarFallback>
                  </Avatar>
                  {author.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Filter indicator */}
      {selectedAuthorId && selectedAuthorName && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm text-foreground">
            Showing posts from <span className="font-semibold">{selectedAuthorName}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilter}
            className="h-7 px-2 ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Empty state when filtered */}
      {posts.length === 0 && selectedAuthorId && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No posts from {selectedAuthorName}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            This person hasn't shared any posts with you yet.
          </p>
        </div>
      )}

      {/* Posts list */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="border bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/profile/${post.author.id}`)}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-10 w-10 border-2 border-border hover:border-primary transition-colors">
                      {post.author.image && (
                        <AvatarImage src={post.author.image} alt={post.author.name} />
                      )}
                      <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                        {getInitials(post.author.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div>
                    <button
                      onClick={() => router.push(`/profile/${post.author.id}`)}
                      className="font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left"
                    >
                      {post.author.name}
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(new Date(post.createdAt))}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{formatTime(new Date(post.createdAt))}</span>
                      {isEdited(post.createdAt, post.updatedAt) && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="flex items-center gap-1 text-muted-foreground" title={`Edited ${formatDate(new Date(post.updatedAt))} at ${formatTime(new Date(post.updatedAt))}`}>
                            <Pencil className="h-2.5 w-2.5" />
                            edited
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Share2 className="h-3 w-3" />
                    Shared {formatDate(new Date(post.sharedAt))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/post/${post.id}`)}
                    title="Open full post"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-2">
              {/* Post Title */}
              {post.title && (
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {post.title}
                </h3>
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

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Shared with others indicator */}
              {post.shares && post.shares.length > 1 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Also shared with {post.shares.length - 1} other{post.shares.length > 2 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {/* Comments count */}
              {post._count && post._count.comments > 0 && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{post._count.comments} comment{post._count.comments !== 1 ? 's' : ''}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
