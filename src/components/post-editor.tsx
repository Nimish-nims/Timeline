"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Send, Loader2, X, Tag, Plus, Folder, Inbox, ChevronDown, Check, Paperclip, File, Image as ImageIcon, FileText, Upload, FolderOpen } from 'lucide-react'
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
  onPost: (content: string, tags: string[], title?: string, folderId?: string | null, attachmentIds?: string[]) => void
  folders?: FolderOption[]
  /** Pre-select and optionally lock saving to this folder (e.g. on folder page). */
  defaultFolderId?: string | null
  /** When true, hide folder selector and always save to defaultFolderId. */
  lockFolder?: boolean
}

interface AttachmentFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url?: string
  thumbnailUrl?: string | null
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
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

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

  // Fetch members for @mention suggestions
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

  // Sync selected folder when defaultFolderId changes
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

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > MAX_UPLOAD_BYTES) {
      alert(`Total file size must be under ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Try fewer or smaller files.`)
      return
    }

    setUploading(true)
    const formData = new FormData()
    fileArray.forEach((file) => formData.append("files", file))

    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        let message = "Failed to upload files"
        try {
          const data = await res.json()
          message = data?.error || message
        } catch {
          if (res.status === 413) message = "Files too large. Try smaller files or fewer at once (under 4 MB total)."
          else if (res.status === 503) message = "File storage is not configured. Add Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) in your deployment."
        }
        alert(message)
        return
      }

      const data = await res.json()
      if (data.uploaded && data.uploaded.length > 0) {
        const newAttachments: AttachmentFile[] = data.uploaded.map((file: {
          id: string
          fileName: string
          fileSize: number
          mimeType: string
          url: string
          thumbnailUrl?: string | null
        }) => ({
          id: file.id,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl
        }))
        setAttachments(prev => [...prev, ...newAttachments])
      }

      if (data.errors && data.errors.length > 0) {
        const errorMsg = data.errors.map((e: { fileName: string; error: string }) => `${e.fileName}: ${e.error}`).join("\n")
        alert(`Some files failed to upload:\n${errorMsg}`)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Upload failed. Please try again. If this keeps happening, check that file storage (Supabase) is configured for this deployment.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processFiles(files)
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
  }, [])

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return ImageIcon
    if (mimeType.startsWith('video/')) return File
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText
    return File
  }

  const handlePost = async () => {
    const strippedContent = content.replace(/<[^>]*>/g, '').trim()
    if (!strippedContent && attachments.length === 0) return

    const folderIdToUse = lockFolder ? defaultFolderId : selectedFolderId
    const attachmentIds = attachments.map(att => att.id)
    setIsPosting(true)
    try {
      onPost(content, tags, title.trim() || undefined, folderIdToUse, attachmentIds.length > 0 ? attachmentIds : undefined)
      setTitle('')
      setContent('')
      setTags([])
      setTagInput('')
      setShowTagInput(false)
      setAttachments([])
      setSelectedFolderId(defaultFolderId ?? null)
      setEditorKey(prev => prev + 1)
    } finally {
      setIsPosting(false)
    }
  }

  const hasContent = content.replace(/<[^>]*>/g, '').trim().length > 0 || attachments.length > 0
  const userName = session?.user?.name || 'User'
  const filteredSuggestions = suggestedTags.filter(
    t => t.includes(tagInput.toLowerCase()) && !tags.includes(t)
  ).slice(0, 5)

  const selectedFolder = folders.find(f => f.id === selectedFolderId)
  const hasMetadata = tags.length > 0 || selectedFolderId || attachments.length > 0

  return (
    <Card
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`mb-6 rounded-xl border bg-card shadow-none transition-all duration-200 ${
        isDragging
          ? 'border-primary border-dashed ring-2 ring-primary/20 shadow-lg shadow-primary/5'
          : 'border-border/60'
      }`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 rounded-xl bg-primary/5 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-bounce">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary">Drop files to attach</p>
          <p className="text-xs text-muted-foreground mt-1">Images, documents, and more</p>
        </div>
      )}

      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground">Share your thoughts</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-5 pb-0 space-y-3">
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

        {/* ── Metadata Section: Tags, Folder, Attachments ── */}
        {/* This section appears between the editor and the footer, showing all selected metadata inline */}

        {/* Tags: inline chip input */}
        {(tags.length > 0 || showTagInput) && (
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Tag className="h-3 w-3" />
              Tags
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="h-4 w-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}

              {showTagInput ? (
                <div className="relative flex-1 min-w-[160px]">
                  <Input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Type tag, press Enter..."
                    className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 placeholder:text-muted-foreground/60"
                  />
                  {tagInput && filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg py-1 max-h-[160px] overflow-y-auto">
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setTags([...tags, suggestion])
                            setTagInput('')
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                        >
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-dashed border-border/60 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected Folder indicator */}
        {selectedFolderId && !lockFolder && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-none">Saving to</p>
              <p className="text-sm font-medium text-foreground leading-tight mt-0.5 truncate">
                {selectedFolder?.name ?? 'Selected folder'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Locked folder indicator */}
        {lockFolder && defaultFolderId && folders.length > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
            <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-none">Folder</p>
              <p className="text-sm font-medium text-foreground leading-tight mt-0.5 truncate">
                {folders.find(f => f.id === defaultFolderId)?.name ?? 'Folder'}
              </p>
            </div>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Paperclip className="h-3 w-3" />
                Attachments
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  {attachments.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add more
              </button>
            </div>

            {/* Image attachments - grid preview */}
            {attachments.some(a => a.mimeType.startsWith('image/')) && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {attachments.filter(a => a.mimeType.startsWith('image/')).map((attachment) => (
                  <div key={attachment.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border/50 bg-muted">
                    {attachment.thumbnailUrl ? (
                      <img
                        src={attachment.thumbnailUrl}
                        alt={attachment.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="h-7 w-7 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 flex items-center justify-center shadow-lg"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate">{attachment.fileName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Non-image attachments - compact list */}
            {attachments.filter(a => !a.mimeType.startsWith('image/')).map((attachment) => {
              const FileIcon = getFileIcon(attachment.mimeType)
              return (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-2.5 p-2 rounded-md border border-border/40 bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{attachment.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 flex items-center justify-center shrink-0"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              )
            })}

            {uploading && (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* ── Footer Toolbar ── */}
      <CardFooter className="flex flex-col gap-0 p-0 mt-3 border-t border-border/50 bg-muted/20 rounded-b-xl">
        <div className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 w-full">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          />

          {/* Attach button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={attachments.length > 0 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`h-8 gap-1.5 rounded-lg transition-all ${
                  attachments.length > 0
                    ? 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 px-2.5'
                    : 'text-muted-foreground hover:text-foreground px-2.5'
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {attachments.length > 0 ? (
                  <span className="text-xs font-medium">{attachments.length}</span>
                ) : (
                  <span className="text-xs hidden sm:inline">Attach</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Attach files (or drag & drop)</p>
            </TooltipContent>
          </Tooltip>

          {/* Tags button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={tags.length > 0 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setShowTagInput(!showTagInput)
                  if (!showTagInput && tags.length === 0) {
                    // Opening fresh — will auto-focus via useEffect
                  }
                }}
                className={`h-8 gap-1.5 rounded-lg transition-all ${
                  tags.length > 0
                    ? 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 px-2.5'
                    : 'text-muted-foreground hover:text-foreground px-2.5'
                }`}
              >
                <Tag className="h-4 w-4" />
                {tags.length > 0 ? (
                  <span className="text-xs font-medium">{tags.length}</span>
                ) : (
                  <span className="text-xs hidden sm:inline">Tags</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showTagInput ? 'Hide tags' : 'Add tags'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Folder picker */}
          {folders.length > 0 && !lockFolder && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant={selectedFolderId ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 gap-1.5 rounded-lg transition-all ${
                        selectedFolderId
                          ? 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 px-2.5'
                          : 'text-muted-foreground hover:text-foreground px-2.5'
                      }`}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="text-xs truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline">
                        {selectedFolder?.name ?? 'Folder'}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save to folder</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs">Save to folder</DropdownMenuLabel>
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
                    <span className="text-xs text-muted-foreground tabular-nums">{f._count.posts}</span>
                    {selectedFolderId === f.id && <Check className="h-4 w-4 text-primary ml-1" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Spacer */}
          <div className="flex-1 min-w-2" />

          {/* Summary chips - compact indicators of what's attached */}
          {hasMetadata && (
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              {attachments.length > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {attachments.length} file{attachments.length > 1 ? 's' : ''}
                </span>
              )}
              {tags.length > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {attachments.length > 0 && <span className="text-border">|</span>}
                  <Tag className="h-3 w-3" />
                  {tags.length} tag{tags.length > 1 ? 's' : ''}
                </span>
              )}
              {selectedFolderId && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {(attachments.length > 0 || tags.length > 0) && <span className="text-border">|</span>}
                  <Folder className="h-3 w-3" />
                  <span className="truncate max-w-[60px]">{selectedFolder?.name}</span>
                </span>
              )}
            </div>
          )}

          {/* Post button */}
          <Button
            onClick={handlePost}
            disabled={isPosting || !hasContent}
            size="sm"
            className="h-8 px-4 rounded-lg gap-2 shadow-sm"
          >
            {isPosting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Post
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
