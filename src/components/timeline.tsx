"use client"

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil, X, Check, Clock, Loader2, MessageSquare, Send, ChevronDown, ChevronUp, Tag, Plus, Share2, Users, Maximize2, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

const EddyterWrapper = dynamic(() => import('./eddyter-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[120px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
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

interface Post {
  id: string
  title?: string | null
  content: string
  authorName: string
  authorId: string
  authorImage?: string | null
  createdAt: Date
  updatedAt?: Date
  tags?: Tag[]
  shares?: { user: SharedUser }[]
  _count?: {
    comments: number
  }
}

interface Member {
  id: string
  name: string
  email?: string
  image: string | null
}

interface TimelineProps {
  posts: Post[]
  onDelete: (id: string) => void
  onEdit: (id: string, content: string, tags?: string[]) => void
  onSharePost?: (postId: string, userIds: string[]) => Promise<void>
  onUnsharePost?: (postId: string, userId: string) => Promise<void>
  currentUserId?: string
  isAdmin?: boolean
  filterByUserId?: string | null
  filterByUserName?: string | null
  onFilterByUser?: (userId: string, userName: string) => void
  onClearFilter?: () => void
  filterByTag?: string | null
  onFilterByTag?: (tag: string) => void
  onClearTagFilter?: () => void
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

function formatCommentTimestamp(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let relativeTime = ''
  if (seconds < 60) relativeTime = 'Just now'
  else if (minutes < 60) relativeTime = `${minutes}m ago`
  else if (hours < 24) relativeTime = `${hours}h ago`
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

  const fullDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return `${relativeTime} · ${fullDate} at ${time}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function isEdited(createdAt: Date, updatedAt?: Date): boolean {
  if (!updatedAt) return false
  // Consider edited if updated more than 1 second after creation
  return updatedAt.getTime() - createdAt.getTime() > 1000
}

export function Timeline({
  posts,
  onDelete,
  onEdit,
  onSharePost,
  onUnsharePost,
  currentUserId,
  isAdmin,
  filterByUserId,
  filterByUserName,
  onFilterByUser,
  onClearFilter,
  filterByTag,
  onFilterByTag,
  onClearTagFilter
}: TimelineProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState<string | null>(null)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [sharePostAuthorId, setSharePostAuthorId] = useState<string | null>(null)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savingShare, setSavingShare] = useState(false)

  // Fetch existing tags for suggestions
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        if (res.ok) {
          const data = await res.json()
          setSuggestedTags(data.map((t: { name: string }) => t.name))
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    fetchTags()
  }, [])

  // Fetch all members when share dialog opens
  const fetchAllMembers = async () => {
    setLoadingMembers(true)
    try {
      const res = await fetch('/api/members?all=true')
      if (res.ok) {
        const data = await res.json()
        setAllMembers(data.members || [])
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const openShareDialog = (post: Post) => {
    setSharePostId(post.id)
    setSharePostAuthorId(post.authorId)
    // Pre-select already shared users
    setSelectedUserIds(post.shares?.map(s => s.user.id) || [])
    setShareDialogOpen(true)
    fetchAllMembers()
  }

  const closeShareDialog = () => {
    setShareDialogOpen(false)
    setSharePostId(null)
    setSharePostAuthorId(null)
    setSelectedUserIds([])
    setAllMembers([])
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSaveShare = async () => {
    if (!sharePostId || !onSharePost) return
    setSavingShare(true)
    try {
      await onSharePost(sharePostId, selectedUserIds)
      closeShareDialog()
    } catch (error) {
      console.error('Failed to share post:', error)
    } finally {
      setSavingShare(false)
    }
  }

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})

  // Fetch comments for a post
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

  // Toggle comments section
  const toggleComments = (postId: string) => {
    const isExpanding = !expandedComments[postId]
    setExpandedComments(prev => ({ ...prev, [postId]: isExpanding }))
    if (isExpanding && !comments[postId]) {
      fetchComments(postId)
    }
  }

  // Submit a new comment
  const handleSubmitComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim()
    if (!content) return

    setSubmittingComment(prev => ({ ...prev, [postId]: true }))
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, content })
      })
      if (response.ok) {
        const newComment = await response.json()
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment]
        }))
        setCommentInputs(prev => ({ ...prev, [postId]: '' }))
      }
    } catch (error) {
      console.error('Failed to submit comment:', error)
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }))
    }
  }

  // Delete a comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setComments(prev => ({
          ...prev,
          [postId]: prev[postId]?.filter(c => c.id !== commentId) || []
        }))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  // Check if user can delete a comment
  const canDeleteComment = (comment: Comment, postAuthorId: string) => {
    return isAdmin || comment.authorId === currentUserId || postAuthorId === currentUserId
  }

  // Filter posts if a user or tag filter is active
  let displayedPosts = posts
  if (filterByUserId) {
    displayedPosts = displayedPosts.filter(post => post.authorId === filterByUserId)
  }
  if (filterByTag) {
    displayedPosts = displayedPosts.filter(post =>
      post.tags?.some(tag => tag.name === filterByTag)
    )
  }

  const handleStartEdit = (post: Post) => {
    setEditingId(post.id)
    setEditContent(post.content)
    setEditTags(post.tags?.map(t => t.name) || [])
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditTags([])
    setTagInput('')
    setShowTagInput(null)
  }

  const handleSaveEdit = () => {
    if (editingId && editContent.replace(/<[^>]*>/g, '').trim()) {
      onEdit(editingId, editContent, editTags)
      setEditingId(null)
      setEditContent('')
      setEditTags([])
    }
  }

  const handleAddTagToPost = (postId: string) => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag) {
      if (editingId === postId) {
        if (!editTags.includes(trimmedTag)) {
          setEditTags([...editTags, trimmedTag])
        }
      }
      setTagInput('')
    }
  }

  const handleRemoveTagFromPost = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, postId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTagToPost(postId)
    } else if (e.key === 'Escape') {
      setShowTagInput(null)
      setTagInput('')
    }
  }

  const getFilteredSuggestions = (currentTags: string[]) => {
    return suggestedTags.filter(
      t => t.includes(tagInput.toLowerCase()) && !currentTags.includes(t)
    ).slice(0, 5)
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

  if (displayedPosts.length === 0 && (filterByUserId || filterByTag)) {
    return (
      <div className="space-y-5">
        {/* Filter indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {filterByUserId && filterByUserName && (
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
                Clear
              </Button>
            </div>
          )}
          {filterByTag && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">
                Tag: <span className="font-semibold">{filterByTag}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTagFilter}
                className="h-7 px-2 ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            {filterByTag ? (
              <Tag className="h-7 w-7 text-muted-foreground" />
            ) : (
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {filterByTag
              ? `No posts tagged "${filterByTag}"`
              : `No posts from ${filterByUserName}`
            }
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {filterByTag
              ? "Try a different tag or clear the filter to see all posts."
              : "This user hasn't posted anything yet."
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Filter indicators */}
      {(filterByUserId || filterByTag) && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {filterByUserId && filterByUserName && (
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
                Clear
              </Button>
            </div>
          )}
          {filterByTag && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">
                Tag: <span className="font-semibold">{filterByTag}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTagFilter}
                className="h-7 px-2 ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
      {/* Vertical timeline line */}
      <div className="absolute left-[23px] top-4 bottom-4 w-[2px] bg-border rounded-full" />

      <div className="space-y-4">
        {displayedPosts.map((post, index) => (
          <div key={post.id} className="relative flex gap-4">
            {/* Timeline node - clickable to view profile */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/profile/${post.authorId}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/profile/${post.authorId}`)
                  }
                }}
                className="w-12 h-12 rounded-full bg-background border-2 border-border flex items-center justify-center hover:border-primary hover:scale-105 transition-all cursor-pointer"
                title={`View ${post.authorName}'s profile`}
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
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>

            {/* Content card */}
            <div className="flex-1 min-w-0 pb-1">
              <Card className="group border bg-card shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => router.push(`/profile/${post.authorId}`)}
                        className="font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left"
                      >
                        {post.authorName}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(post.createdAt)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{formatTime(post.createdAt)}</span>
                        {isEdited(post.createdAt, post.updatedAt) && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="flex items-center gap-1 text-muted-foreground" title={`Edited ${formatDate(post.updatedAt!)} at ${formatTime(post.updatedAt!)}`}>
                              <Pencil className="h-2.5 w-2.5" />
                              edited
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId !== post.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/post/${post.id}`)}
                          title="Open full post"
                        >
                          <Maximize2 className="h-4 w-4" />
                          <span className="sr-only">Open</span>
                        </Button>
                        {canEditPost(post) && onSharePost && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openShareDialog(post)}
                          >
                            <Share2 className="h-4 w-4" />
                            <span className="sr-only">Share</span>
                          </Button>
                        )}
                        {canEditPost(post) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(post)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDelete(post.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 pt-2">
                  {editingId === post.id ? (
                    <div className="space-y-4">
                      <EddyterWrapper
                        onChange={setEditContent}
                        initialContent={post.content}
                      />

                      {/* Tag editing section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Tags</span>
                        </div>

                        {/* Current tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {editTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromPost(tag)}
                                className="ml-0.5 hover:bg-primary/20 rounded p-0.5 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}

                          {/* Add tag input */}
                          {showTagInput === post.id ? (
                            <div className="relative flex items-center gap-1">
                              <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => handleTagKeyDown(e, post.id)}
                                placeholder="Add tag..."
                                className="h-7 w-32 text-xs"
                                autoFocus
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleAddTagToPost(post.id)}
                                disabled={!tagInput.trim()}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setShowTagInput(null)
                                  setTagInput('')
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>

                              {/* Tag suggestions */}
                              {tagInput && getFilteredSuggestions(editTags).length > 0 && (
                                <div className="absolute left-0 top-8 z-10 w-40 bg-popover border rounded-md shadow-md py-1">
                                  {getFilteredSuggestions(editTags).map((suggestion) => (
                                    <button
                                      key={suggestion}
                                      type="button"
                                      onClick={() => {
                                        setEditTags([...editTags, suggestion])
                                        setTagInput('')
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2"
                                    >
                                      <Tag className="h-3 w-3 text-muted-foreground" />
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowTagInput(post.id)}
                              className="h-7 px-2 text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Post Title */}
                      {post.title && (
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {post.title}
                        </h3>
                      )}
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />
                      {/* Tags Display - Always visible when tags exist */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          {post.tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => onFilterByTag?.(tag.name)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Shared Users Display */}
                      {post.shares && post.shares.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>Shared with</span>
                          </div>
                          <div className="flex -space-x-1.5">
                            {post.shares.slice(0, 5).map((share) => (
                              <Avatar key={share.user.id} className="h-6 w-6 border-2 border-background" title={share.user.name}>
                                {share.user.image && (
                                  <AvatarImage src={share.user.image} alt={share.user.name} />
                                )}
                                <AvatarFallback className="text-[9px] font-medium bg-secondary text-secondary-foreground">
                                  {getInitials(share.user.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {post.shares.length > 5 && (
                              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-[9px] font-medium text-muted-foreground">+{post.shares.length - 5}</span>
                              </div>
                            )}
                          </div>
                          {post.shares.length <= 3 && (
                            <span className="text-xs text-muted-foreground">
                              {post.shares.map(s => s.user.name).join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
                {editingId === post.id && (
                  <CardFooter className="flex justify-end gap-2 px-5 py-3 bg-muted/50 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                    >
                      <Check className="h-4 w-4 mr-1.5" />
                      Save
                    </Button>
                  </CardFooter>
                )}

                {/* Comments Section */}
                {editingId !== post.id && (
                  <div className="border-t">
                    {/* Comments Toggle Button */}
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={`w-full px-5 py-3 flex items-center justify-between text-sm transition-colors ${
                        expandedComments[post.id]
                          ? 'bg-muted/50'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">
                          {(() => {
                            const count = comments[post.id]?.length ?? post._count?.comments ?? 0
                            if (count === 0) return 'Comments'
                            return `${count} comment${count === 1 ? '' : 's'}`
                          })()}
                        </span>
                        {(post._count?.comments ?? 0) > 0 && !comments[post.id] && (
                          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                            {post._count?.comments}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedComments[post.id] ? 'rotate-180' : ''
                      }`} />
                    </button>

                    {/* Expanded Comments */}
                    {expandedComments[post.id] && (
                      <div className="px-5 pb-5 pt-3 bg-muted/20 dark:bg-muted/10">
                        {/* Loading State */}
                        {loadingComments[post.id] && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {/* Comments List */}
                        {!loadingComments[post.id] && comments[post.id]?.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {comments[post.id].map((comment) => (
                              <div
                                key={comment.id}
                                className="flex gap-3 p-3 rounded-lg bg-background border group/comment"
                              >
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  {comment.author.image && (
                                    <AvatarImage src={comment.author.image} alt={comment.author.name} />
                                  )}
                                  <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
                                    {getInitials(comment.author.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm text-foreground">
                                          {comment.author.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatDate(new Date(comment.createdAt))}
                                        </span>
                                      </div>
                                      <div
                                        className="prose prose-sm dark:prose-invert max-w-none mt-1 [&>p]:mb-1 [&>p:last-child]:mb-0"
                                        dangerouslySetInnerHTML={{ __html: comment.content }}
                                      />
                                    </div>
                                    {canDeleteComment(comment, post.authorId) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover/comment:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Delete comment</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* No Comments Message */}
                        {!loadingComments[post.id] && (!comments[post.id] || comments[post.id].length === 0) && (
                          <div className="flex flex-col items-center justify-center py-6 text-center">
                            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">No comments yet</p>
                          </div>
                        )}

                        {/* Add Comment Input with CT Editor */}
                        {currentUserId && (
                          <div className="mt-4 p-4 rounded-lg bg-background border">
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">Add a comment</span>
                            </div>
                            <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background transition-shadow">
                              <EddyterWrapper
                                onChange={(html) => setCommentInputs(prev => ({ ...prev, [post.id]: html }))}
                                placeholder="Write a comment..."
                                initialContent=""
                                key={`comment-editor-${post.id}-${comments[post.id]?.length || 0}`}
                              />
                            </div>
                            <div className="flex justify-end mt-3">
                              <Button
                                size="sm"
                                onClick={() => handleSubmitComment(post.id)}
                                disabled={!commentInputs[post.id]?.replace(/<[^>]*>/g, '').trim() || submittingComment[post.id]}
                              >
                                {submittingComment[post.id] ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                Comment
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ))}
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => !open && closeShareDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Post
            </DialogTitle>
            <DialogDescription>
              Select team members to share this post with. They will be able to see this post in their feed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allMembers
                  .filter(member => member.id !== sharePostAuthorId && member.id !== currentUserId)
                  .map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedUserIds.includes(member.id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleUserSelection(member.id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(member.id)}
                        onCheckedChange={() => toggleUserSelection(member.id)}
                      />
                      <Avatar className="h-9 w-9">
                        {member.image && (
                          <AvatarImage src={member.image} alt={member.name} />
                        )}
                        <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{member.name}</p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {allMembers.filter(member => member.id !== sharePostAuthorId && member.id !== currentUserId).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No other team members to share with</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedUserIds.length} {selectedUserIds.length === 1 ? 'person' : 'people'} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeShareDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveShare} disabled={savingShare}>
                {savingShare ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
