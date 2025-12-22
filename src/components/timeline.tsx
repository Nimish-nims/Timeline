"use client"

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil, X, Check, Clock, Loader2, MessageSquare } from 'lucide-react'

const CTEditorWrapper = dynamic(() => import('./ct-editor-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[120px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
})

interface Post {
  id: string
  content: string
  authorName: string
  authorId: string
  authorImage?: string | null
  createdAt: Date
}

interface TimelineProps {
  posts: Post[]
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
  currentUserId?: string
  isAdmin?: boolean
  filterByUserId?: string | null
  filterByUserName?: string | null
  onFilterByUser?: (userId: string, userName: string) => void
  onClearFilter?: () => void
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

export function Timeline({
  posts,
  onDelete,
  onEdit,
  currentUserId,
  isAdmin,
  filterByUserId,
  filterByUserName,
  onFilterByUser,
  onClearFilter
}: TimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Filter posts if a user filter is active
  const displayedPosts = filterByUserId
    ? posts.filter(post => post.authorId === filterByUserId)
    : posts

  const handleStartEdit = (post: Post) => {
    setEditingId(post.id)
    setEditContent(post.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = () => {
    if (editingId && editContent.replace(/<[^>]*>/g, '').trim()) {
      onEdit(editingId, editContent)
      setEditingId(null)
      setEditContent('')
    }
  }

  const canEditPost = (post: Post) => {
    return isAdmin || post.authorId === currentUserId
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No posts yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Be the first to share something with the team. Your post will appear here.
        </p>
      </div>
    )
  }

  if (displayedPosts.length === 0 && filterByUserId) {
    return (
      <div className="space-y-5">
        {/* Filter indicator */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm text-foreground">
            Filtering by <span className="font-semibold">{filterByUserName}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilter}
            className="h-7 px-2 ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filter
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No posts from {filterByUserName}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            This user hasn&apos;t posted anything yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Filter indicator */}
      {filterByUserId && filterByUserName && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm text-foreground">
            Filtering by <span className="font-semibold">{filterByUserName}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilter}
            className="h-7 px-2 ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filter
          </Button>
        </div>
      )}
      {/* Vertical timeline line */}
      <div className="absolute left-[23px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-border via-border to-transparent rounded-full" />

      <div className="space-y-5">
        {displayedPosts.map((post, index) => (
          <div key={post.id} className="relative flex gap-5">
            {/* Timeline node - clickable to filter by user */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onFilterByUser?.(post.authorId, post.authorName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onFilterByUser?.(post.authorId, post.authorName)
                  }
                }}
                className="w-12 h-12 rounded-full bg-background ring-2 ring-border flex items-center justify-center shadow-sm hover:ring-primary/50 hover:scale-105 transition-all duration-200 cursor-pointer"
                title={`Filter by ${post.authorName}`}
              >
                <Avatar className="h-9 w-9">
                  {post.authorImage && (
                    <AvatarImage src={post.authorImage} alt={post.authorName} />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                    {getInitials(post.authorName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {index === 0 && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
              )}
            </div>

            {/* Content card */}
            <div className="flex-1 min-w-0 pb-1">
              <Card className="group border-0 bg-card shadow-md hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3 pt-5 px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">
                        {post.authorName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(post.createdAt)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{formatTime(post.createdAt)}</span>
                      </div>
                    </div>
                    {editingId !== post.id && canEditPost(post) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted rounded-lg"
                          onClick={() => handleStartEdit(post)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 rounded-lg"
                          onClick={() => onDelete(post.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-5 pt-0">
                  {editingId === post.id ? (
                    <div className="space-y-3">
                      <CTEditorWrapper
                        onChange={setEditContent}
                        initialContent={post.content}
                      />
                    </div>
                  ) : (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                  )}
                </CardContent>
                {editingId === post.id && (
                  <CardFooter className="flex justify-end gap-2 px-6 py-4 bg-muted/20 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-9"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-9"
                    >
                      <Check className="h-4 w-4 mr-1.5" />
                      Save Changes
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
