"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Send, Loader2, X, Tag, Plus } from 'lucide-react'

const EddyterWrapper = dynamic(() => import('./eddyter-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[140px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
})

interface PostEditorProps {
  onPost: (content: string, tags: string[], title?: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PostEditor({ onPost }: PostEditorProps) {
  const { data: session } = useSession()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)

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

  // Focus tag input when shown
  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [showTagInput])

  const handleContentChange = useCallback((html: string) => {
    setContent(html)
  }, [])

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    } else if (e.key === 'Escape') {
      setShowTagInput(false)
      setTagInput('')
    }
  }

  const handlePost = async () => {
    const strippedContent = content.replace(/<[^>]*>/g, '').trim()
    if (!strippedContent) return

    setIsPosting(true)
    try {
      onPost(content, tags, title.trim() || undefined)
      setTitle('')
      setContent('')
      setTags([])
      setTagInput('')
      setShowTagInput(false)
      setEditorKey(prev => prev + 1)
    } finally {
      setIsPosting(false)
    }
  }

  const hasContent = content.replace(/<[^>]*>/g, '').trim().length > 0
  const userName = session?.user?.name || 'User'
  const filteredSuggestions = suggestedTags.filter(
    t => t.includes(tagInput.toLowerCase()) && !tags.includes(t)
  ).slice(0, 5)

  return (
    <Card className="mb-8 border bg-card shadow-sm">
      <CardHeader className="pb-4 pt-5 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-border">
            <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">Share your thoughts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-0 space-y-4">
        {/* Title Input */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title (optional)"
          className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
        />

        {/* Content Editor */}
        <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background transition-shadow">
          <EddyterWrapper
            key={editorKey}
            onChange={handleContentChange}
            placeholder="What's on your mind?"
          />
        </div>

        {/* Tags Section */}
        <div className="mt-4 space-y-3">
          {/* Display added tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 hover:bg-secondary-foreground/10 rounded p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag input area */}
          {showTagInput ? (
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Type a tag and press Enter..."
                    className="pl-9 h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="h-9 w-9"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowTagInput(false)
                    setTagInput('')
                  }}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Tag suggestions */}
              {tagInput && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md py-1">
                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setTags([...tags, suggestion])
                        setTagInput('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                    >
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTagInput(true)}
              className="h-8 px-3 text-muted-foreground hover:text-foreground"
            >
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              Add tags
            </Button>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between px-5 py-4 border-t mt-4">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Rich text formatting available
        </p>
        <Button
          onClick={handlePost}
          disabled={isPosting || !hasContent}
          className="ml-auto"
        >
          {isPosting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
