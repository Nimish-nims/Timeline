"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Send, Loader2, X, Tag, Plus, Folder, Inbox, ChevronDown, Check } from 'lucide-react'
import { useMentionMenuAvatars, type MemberForMention } from '@/lib/mention-menu-avatars'

const EddyterWrapper = dynamic(() => import('./eddyter-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[140px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
})

interface FolderOption {
  id: string
  name: string
  _count: { posts: number }
}

interface PostEditorProps {
  onPost: (content: string, tags: string[], title?: string, folderId?: string | null) => void
  folders?: FolderOption[]
  /** Pre-select and optionally lock saving to this folder (e.g. on folder page). */
  defaultFolderId?: string | null
  /** When true, hide folder selector and always save to defaultFolderId. */
  lockFolder?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PostEditor({ onPost, folders = [], defaultFolderId, lockFolder = false }: PostEditorProps) {
  const { data: session } = useSession()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId ?? null)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [mentionUserList, setMentionUserList] = useState<string[]>([])
  const [membersForMentions, setMembersForMentions] = useState<MemberForMention[]>([])
  const [mentionListReady, setMentionListReady] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useMentionMenuAvatars(membersForMentions)

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

  // Fetch members for @mention suggestions — must complete before editor mounts so Eddyter gets the list
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members?all=true')
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const members = data.members ?? data
          const list = Array.isArray(members) ? members : []
          const names: string[] = list
            .map((m: { name?: string }) => m?.name)
            .filter((n): n is string => typeof n === 'string' && n.length > 0)
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
        setMentionListReady(true)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch members for mentions:', error)
          setMentionListReady(true)
        }
      }
    }
    fetchMembers()
    return () => { cancelled = true }
  }, [session?.user?.id])

  // Sync selected folder when defaultFolderId (e.g. from folder page) changes
  useEffect(() => {
    if (defaultFolderId !== undefined) {
      setSelectedFolderId(defaultFolderId ?? null)
    }
  }, [defaultFolderId])

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

    const folderIdToUse = lockFolder ? defaultFolderId : selectedFolderId
    setIsPosting(true)
    try {
      onPost(content, tags, title.trim() || undefined, folderIdToUse)
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
    <Card className="mb-6 rounded-xl border border-border/60 bg-card shadow-none">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground">Share your thoughts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-0 space-y-4">
        {/* Title Input */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title (optional)"
          className="text-base font-medium border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent h-9"
        />

        {/* Content Editor */}
        <div className="rounded-lg border border-border/50 bg-muted/20 dark:bg-muted/10 overflow-hidden focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0 transition-shadow w-full" style={{ width: '100%' }}>
          {!mentionListReady ? (
            <div className="h-[140px] flex items-center justify-center text-muted-foreground bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <EddyterWrapper
              key={editorKey}
              onChange={handleContentChange}
              placeholder="What's on your mind? Type @ to tag someone"
              mentionUserList={mentionUserList}
            />
          )}
        </div>

        {/* Tags display + inline input */}
        {(tags.length > 0 || showTagInput) && (
          <div className="mt-3 space-y-2">
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

            {showTagInput && (
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
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="h-8 w-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowTagInput(false)
                      setTagInput('')
                    }}
                    className="h-8 w-8"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

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
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                      >
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Unified footer toolbar */}
      <CardFooter className="flex flex-col gap-0 p-0 mt-3 border-t border-border/50 bg-muted/20 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 w-full">
          {/* Tag toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTagInput(!showTagInput)}
            className="h-8 px-3 gap-2 text-muted-foreground hover:text-foreground rounded-md"
          >
            <Tag className="h-4 w-4" />
            <span className="text-sm">{tags.length > 0 ? `${tags.length} tag${tags.length > 1 ? 's' : ''}` : 'Tags'}</span>
          </Button>

          {/* Folder picker */}
          {folders.length > 0 && !lockFolder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 gap-2 text-muted-foreground hover:text-foreground rounded-md"
                >
                  <Folder className="h-4 w-4" />
                  <span className="text-sm truncate max-w-[100px] sm:max-w-[140px]">
                    {selectedFolderId
                      ? folders.find(f => f.id === selectedFolderId)?.name ?? 'Folder'
                      : 'Folder'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Save to folder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSelectedFolderId(null)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">Uncategorized</span>
                  {selectedFolderId === null && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {folders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Folder className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{f.name}</span>
                    {selectedFolderId === f.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Locked folder indicator */}
          {lockFolder && defaultFolderId && folders.length > 0 && (
            <div className="flex items-center gap-2 h-8 px-3 rounded-md text-muted-foreground text-sm">
              <Folder className="h-4 w-4" />
              <span className="truncate max-w-[100px] sm:max-w-[140px]">{folders.find(f => f.id === defaultFolderId)?.name ?? 'Folder'}</span>
            </div>
          )}

          {/* Spacer + Post button */}
          <div className="flex-1 min-w-4" />
          <Button
            onClick={handlePost}
            disabled={isPosting || !hasContent}
            size="sm"
            className="h-8 px-4 rounded-md gap-2"
          >
            {isPosting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Post
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
