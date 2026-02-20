"use client"

import React, { useState, useEffect, useRef, useCallback, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Upload,
  File,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Download,
  Share2,
  Trash2,
  Loader2,
  X,
  Users,
  CloudUpload,
  Check,
  Search,
  CalendarDays,
  Plus,
  MessageSquare,
  ExternalLink,
  Paperclip,
  ArrowLeft,
  Send,
  Pencil,
  MoreVertical,
  Eye,
  Grid3X3,
  LayoutGrid,
} from "lucide-react"
import EddyterWrapper from "@/components/eddyter-wrapper"
import { LinkPreviewHover } from "eddyter"
import { getEddyterApiKey } from "@/lib/eddyter-key"

// ─── Types ────────────────────────────────────────────────────

interface MediaFileItem {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  storageKey: string
  thumbnailUrl: string | null
  url: string
  uploaderId: string
  uploader?: {
    id: string
    name: string
    image: string | null
  }
  shares?: {
    user: {
      id: string
      name: string
      email: string
      image: string | null
    }
  }[]
  _count?: {
    shares: number
  }
  post?: {
    id: string
    title: string | null
    content: string
    createdAt: string
  } | null
  createdAt: string
}

interface ThreadComment {
  id: string
  content: string
  dateKey: string
  authorId: string
  author: {
    id: string
    name: string
    email: string
    image: string | null
  }
  createdAt: string
  updatedAt: string
}

interface FileGroupActivity {
  type: "file-group"
  date: string
  displayDate: string
  files: MediaFileItem[]
  timestamp: string
}

interface CommentActivity {
  type: "comment"
  comment: ThreadComment
  timestamp: string
}

type ActivityItem = FileGroupActivity | CommentActivity

interface Member {
  id: string
  name: string
  email?: string
  image: string | null
}

// ─── Helpers ──────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon
  if (mimeType.startsWith("video/")) return Film
  if (mimeType.startsWith("audio/")) return Music
  if (mimeType.includes("pdf")) return FileText
  return File
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Relative time for timeline: "Added just now", "5 Hours ago", etc. */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Added just now"
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "Hour" : "Hours"} ago`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

function getPostLabel(post: { title: string | null; content: string }): string {
  if (post.title && post.title.trim()) return post.title.trim()
  const text = stripHtml(post.content)
  if (text.length <= 80) return text || "Untitled post"
  return text.slice(0, 80) + "..."
}

function getDisplayDate(isoDate: string): string {
  const target = new Date(isoDate)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(target, today)) return "Today"
  if (sameDay(target, yesterday)) return "Yesterday"
  return target.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  })
}

// ─── Page Component ───────────────────────────────────────────

export default function FilesThreadPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  // Validate date
  const parsedDate = new Date(date)
  const isValidDate = !isNaN(parsedDate.getTime())

  // Activity state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [totalFileCount, setTotalFileCount] = useState(0)
  const [totalCommentCount, setTotalCommentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Comment state
  const [commentInput, setCommentInput] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState("")
  const [savingCommentEdit, setSavingCommentEdit] = useState(false)
  const [commentKey, setCommentKey] = useState(0) // bumped to reset editor after submit
  const [mentionUserList, setMentionUserList] = useState<string[]>([])

  // File view toggle
  const [fileViewMode, setFileViewMode] = useState<"cards" | "grid">("cards")

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  // Preview / actions
  const [previewFile, setPreviewFile] = useState<MediaFileItem | null>(null)
  const [deleteFile, setDeleteFileState] = useState<MediaFileItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shareDialogFile, setShareDialogFile] = useState<MediaFileItem | null>(null)

  // Share dialog state
  const [members, setMembers] = useState<Member[]>([])
  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>([])
  const [savingShares, setSavingShares] = useState(false)
  const [memberSearch, setMemberSearch] = useState("")

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activityEndRef = useRef<HTMLDivElement>(null)

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  // ─── Data Fetching ──────────────────────────────────────────

  const fetchThreadActivity = useCallback(async () => {
    if (!isValidDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/files/thread?dateKey=${date}`)
      const data = await res.json()
      if (data.activities) {
        setActivities(data.activities)
        setTotalFileCount(data.totalFileCount ?? 0)
        setTotalCommentCount(data.totalCommentCount ?? 0)
      }
    } catch (error) {
      console.error("Failed to fetch thread activity:", error)
    } finally {
      setLoading(false)
    }
  }, [date, isValidDate])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members?all=true")
      if (res.ok) {
        const data = await res.json()
        const list = data.members ?? data
        if (Array.isArray(list)) {
          setMembers(list)
          setMentionUserList(list.map((m: { name: string }) => m.name).filter(Boolean))
        }
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (status === "authenticated" && isValidDate) {
      fetchThreadActivity()
      fetchMembers()
    }
  }, [status, isValidDate, fetchThreadActivity, fetchMembers])

  // Escape key for preview
  useEffect(() => {
    if (!previewFile) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewFile(null)
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [previewFile])

  // ─── Comment Handlers ─────────────────────────────────────

  const handleSubmitComment = async () => {
    const plainText = commentInput.replace(/<[^>]*>/g, "").trim()
    if (!plainText || submittingComment) return
    setSubmittingComment(true)
    try {
      const res = await fetch("/api/files/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput, dateKey: date }),
      })
      if (res.ok) {
        setCommentInput("")
        setCommentKey((k) => k + 1) // reset editor
        await fetchThreadActivity()
        // Scroll to bottom after adding comment
        setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      }
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/files/comments/${commentId}`, { method: "DELETE" })
      if (res.ok) {
        await fetchThreadActivity()
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
    }
  }

  const handleStartEditComment = (comment: ThreadComment) => {
    setEditingCommentId(comment.id)
    setEditingCommentContent(comment.content)
  }

  const handleSaveEditComment = async () => {
    const plainText = editingCommentContent.replace(/<[^>]*>/g, "").trim()
    if (!editingCommentId || !plainText || savingCommentEdit) return
    setSavingCommentEdit(true)
    try {
      const res = await fetch(`/api/files/comments/${editingCommentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingCommentContent }),
      })
      if (res.ok) {
        setEditingCommentId(null)
        setEditingCommentContent("")
        await fetchThreadActivity()
      }
    } catch (error) {
      console.error("Failed to edit comment:", error)
    } finally {
      setSavingCommentEdit(false)
    }
  }

  // ─── Upload Handling ────────────────────────────────────────

  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList)
    if (filesToUpload.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    filesToUpload.forEach((file) => formData.append("files", file))
    formData.append("threadDateKey", date)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 90))
      }, 200)

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await res.json()

      if (!res.ok) {
        const msg = data?.error || res.statusText || "Upload failed"
        alert(msg)
        return
      }

      if (data.uploaded && data.uploaded.length > 0) {
        await fetchThreadActivity()
      }

      if (data.errors && data.errors.length > 0) {
        const errorMsg = data.errors.map((e: { fileName: string; error: string }) => `${e.fileName}: ${e.error}`).join("\n")
        alert(`Some files failed to upload:\n${errorMsg}`)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Upload failed. Please try again.")
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
      }, 500)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files)
      e.target.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) handleUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  // ─── File Actions ───────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteFile) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/media/${deleteFile.id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteFileState(null)
        await fetchThreadActivity()
      }
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = (file: MediaFileItem) => {
    const a = document.createElement("a")
    a.href = file.url
    a.download = file.fileName
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ─── Share Dialog ───────────────────────────────────────────

  const openShareDialog = async (file: MediaFileItem) => {
    setShareDialogFile(file)
    setMemberSearch("")
    await fetchMembers()
    try {
      const res = await fetch(`/api/media/${file.id}/share`)
      if (res.ok) {
        const sharedUsers = await res.json()
        setSelectedShareUserIds(sharedUsers.map((u: { id: string }) => u.id))
      }
    } catch {
      setSelectedShareUserIds([])
    }
  }

  const handleSaveShares = async () => {
    if (!shareDialogFile) return
    setSavingShares(true)
    try {
      const res = await fetch(`/api/media/${shareDialogFile.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedShareUserIds }),
      })
      if (res.ok) {
        fetchThreadActivity()
        setShareDialogFile(null)
      }
    } catch (error) {
      console.error("Failed to save shares:", error)
    } finally {
      setSavingShares(false)
    }
  }

  const toggleShareUser = (userId: string) => {
    setSelectedShareUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  // ─── Computed values ────────────────────────────────────────

  const currentUserId = session?.user?.id
  const displayDate = isValidDate ? getDisplayDate(date) : "Invalid date"

  // Collect all files from activities for header stats
  const allFiles = activities
    .filter((a): a is FileGroupActivity => a.type === "file-group")
    .flatMap((g) => g.files)
  const totalSizeBytes = allFiles.reduce((sum, f) => sum + f.fileSize, 0)

  // Collect all posts referenced in files
  const postsInFiles = new Map<string, NonNullable<MediaFileItem["post"]>>()
  for (const f of allFiles) {
    if (f.post) postsInFiles.set(f.post.id, f.post)
  }

  // ─── Auth guard / invalid date ──────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isValidDate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto max-w-[90rem] px-4 sm:px-6 h-14 flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Files</span>
          </div>
        </div>
        <div className="container mx-auto max-w-[90rem] px-4 sm:px-6 py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Invalid date</p>
            <p className="text-sm text-muted-foreground mt-1">
              The date in the URL is not valid.
            </p>
            <Button className="mt-6" onClick={() => router.back()}>
              Go back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto max-w-[90rem] px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{displayDate}</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground">
                {totalFileCount} {totalFileCount === 1 ? "file" : "files"} &middot; {formatFileSize(totalSizeBytes)}
                {totalCommentCount > 0 && (
                  <> &middot; {totalCommentCount} {totalCommentCount === 1 ? "comment" : "comments"}</>
                )}
              </p>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center border rounded-lg shrink-0">
            <Button
              variant={fileViewMode === "cards" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setFileViewMode("cards")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={fileViewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setFileViewMode("grid")}
              title="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add files
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-[90rem] px-4 sm:px-6 py-6 space-y-6">
        {/* Upload area */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium">Uploading files...</p>
              <div className="max-w-xs mx-auto">
                <Progress value={uploadProgress} />
              </div>
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-2">
              <CloudUpload className="h-8 w-8 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">
                  Drag and drop files here
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  or click to browse &middot; Photos, videos, documents up to 50MB each
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Choose Files
              </Button>
              <p className="text-xs text-muted-foreground/70 italic mt-1">
                Files will be added to this thread
              </p>
            </div>
          )}
        </div>

        {/* Post context banners */}
        {postsInFiles.size > 0 && (
          <div className="space-y-1">
            {Array.from(postsInFiles.values()).map((post) => {
              const count = allFiles.filter(f => f.post?.id === post.id).length
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group/post"
                >
                  <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-primary truncate flex-1 group-hover/post:underline">
                    {getPostLabel(post)}
                  </span>
                  <span className="text-xs text-primary/50 shrink-0 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {count}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-primary/40 opacity-0 group-hover/post:opacity-100 transition-opacity shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading thread...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No activity on this date</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload files or write a comment to get started.
            </p>
          </div>
        ) : (
          /* ─── Activity Timeline ──────────────────────── */
          <div className="space-y-6">
            {activities.map((activity, idx) => {
              if (activity.type === "file-group") {
                return (
                  <div key={`fg-${activity.date}-${idx}`} className="space-y-3">
                    {/* Date sub-header */}
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {activity.displayDate}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {activity.files.length} {activity.files.length === 1 ? "file" : "files"}
                      </Badge>
                    </div>

                    {/* File display — card view or compact grid */}
                    {fileViewMode === "cards" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pl-9">
                        {activity.files.map((file) => {
                          const isImage = file.mimeType.startsWith("image/")
                          const isVideo = file.mimeType.startsWith("video/")
                          const FileIcon = getFileIcon(file.mimeType)
                          return (
                            <Card key={file.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                              <div
                                className="relative aspect-square bg-muted flex items-center justify-center cursor-pointer overflow-hidden"
                                onClick={() => setPreviewFile(file)}
                              >
                                {isImage && file.url ? (
                                  <img src={file.url} alt={file.fileName} className="h-full w-full object-cover" />
                                ) : isVideo ? (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Film className="h-10 w-10" />
                                    <span className="text-xs">Video</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <FileIcon className="h-10 w-10" />
                                    <span className="text-xs uppercase">{file.mimeType.split("/")[1]?.slice(0, 4)}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                {file._count && file._count.shares > 0 && (
                                  <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
                                      <Users className="h-3 w-3 mr-1" />
                                      {file._count.shares}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-3">
                                <p className="text-sm font-medium truncate" title={file.fileName}>
                                  {file.fileName}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(file.createdAt)}</span>
                                </div>
                                <div className="flex items-center justify-end gap-1 mt-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openShareDialog(file)}>
                                        <Share2 className="mr-2 h-4 w-4" />
                                        Share
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteFileState(file)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pl-9">
                        {activity.files.map((file) => {
                          const isImage = file.mimeType.startsWith("image/")
                          const isVideo = file.mimeType.startsWith("video/")
                          const FileIcon = getFileIcon(file.mimeType)
                          return (
                            <div
                              key={file.id}
                              className="relative group aspect-square rounded-lg overflow-hidden bg-muted border cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                              onClick={() => setPreviewFile(file)}
                            >
                              {isImage && file.url ? (
                                <img src={file.url} alt={file.fileName} className="h-full w-full object-cover" />
                              ) : isVideo ? (
                                <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                  <Film className="h-6 w-6" />
                                  <span className="text-[10px]">Video</span>
                                </div>
                              ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                  <FileIcon className="h-6 w-6" />
                                  <span className="text-[10px] uppercase">{file.mimeType.split("/")[1]?.slice(0, 4)}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center pb-1.5 gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDownload(file) }}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20" onClick={(e) => { e.stopPropagation(); openShareDialog(file) }}>
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setDeleteFileState(file) }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {file._count && file._count.shares > 0 && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-background/80 backdrop-blur-sm">
                                    <Users className="h-2.5 w-2.5 mr-0.5" />{file._count.shares}
                                  </Badge>
                                </div>
                              )}
                              <div className="absolute top-1 left-1 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate block">{file.fileName}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              if (activity.type === "comment") {
                const comment = activity.comment
                const isOwn = comment.authorId === currentUserId
                const isEditing = editingCommentId === comment.id

                return (
                  <div key={`c-${comment.id}`} className="flex gap-3 pl-0 group/comment">
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      {comment.author.image ? <AvatarImage src={comment.author.image} /> : null}
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {getInitials(comment.author.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Comment bubble */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{comment.author.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(comment.createdAt)}
                        </span>
                        {comment.createdAt !== comment.updatedAt && (
                          <span className="text-xs text-muted-foreground/60 italic">(edited)</span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Edit comment</span>
                          </div>
                          <div className="rounded-lg border overflow-hidden bg-background [&_.eddyter-container]:!max-w-full [&_.ProseMirror]:!max-w-full">
                            <EddyterWrapper
                              onChange={setEditingCommentContent}
                              placeholder="Edit your comment..."
                              initialContent={comment.content}
                              key={`edit-comment-${comment.id}`}
                              showLoadTime={false}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setEditingCommentId(null); setEditingCommentContent("") }} disabled={savingCommentEdit}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveEditComment} disabled={savingCommentEdit || !editingCommentContent.replace(/<[^>]*>/g, "").trim()}>
                              {savingCommentEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="bg-muted/50 rounded-lg px-3 py-2">
                            <LinkPreviewHover
                              apiKey={getEddyterApiKey()}
                              enabled={true}
                            >
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: comment.content }}
                              />
                            </LinkPreviewHover>
                          </div>
                          {/* Action buttons on hover */}
                          {isOwn && (
                            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleStartEditComment(comment)}
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return null
            })}

            <div ref={activityEndRef} />
          </div>
        )}

        {/* ─── Comment Input ───────────────────────────── */}
        {!loading && (
          <div className="bg-background pt-4 pb-2 border-t -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="flex gap-3 items-start">
              <Avatar className="h-8 w-8 shrink-0 mt-1">
                {session?.user?.image ? <AvatarImage src={session.user.image} /> : null}
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {session?.user?.name ? getInitials(session.user.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="rounded-lg border overflow-hidden [&_.eddyter-container]:!max-w-full [&_.ProseMirror]:!max-w-full">
                  <EddyterWrapper
                    onChange={setCommentInput}
                    placeholder="Write a comment..."
                    initialContent=""
                    mentionUserList={mentionUserList}
                    showLoadTime={false}
                    key={`comment-${commentKey}`}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!commentInput?.replace(/<[^>]*>/g, "").trim() || submittingComment}
                    onClick={handleSubmitComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Full-Screen File Viewer ──────────────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in-0 duration-200">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {React.createElement(getFileIcon(previewFile.mimeType), {
                className: "h-5 w-5 text-white/70 shrink-0",
              })}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{previewFile.fileName}</p>
                <p className="text-xs text-white/50">
                  {formatFileSize(previewFile.fileSize)} &middot; {previewFile.mimeType.split("/")[1]?.toUpperCase()} &middot; {formatDate(previewFile.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10 gap-2 h-9"
                onClick={() => handleDownload(previewFile)}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              {previewFile.uploaderId === currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10 gap-2 h-9"
                  onClick={() => {
                    const file = previewFile
                    setPreviewFile(null)
                    openShareDialog(file)
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 ml-1"
                onClick={() => setPreviewFile(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content area */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-0"
            onClick={(e) => { if (e.target === e.currentTarget) setPreviewFile(null) }}
          >
            {previewFile.mimeType.startsWith("image/") ? (
              <img
                src={previewFile.url}
                alt={previewFile.fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : previewFile.mimeType.startsWith("video/") ? (
              <video
                src={previewFile.url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg shadow-2xl"
              >
                Your browser does not support the video tag.
              </video>
            ) : previewFile.mimeType.startsWith("audio/") ? (
              <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-white/5 border border-white/10 max-w-md w-full">
                <div className="h-24 w-24 rounded-full bg-white/10 flex items-center justify-center">
                  <Music className="h-12 w-12 text-white/60" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium truncate max-w-[280px]">{previewFile.fileName}</p>
                  <p className="text-sm text-white/50 mt-1">{formatFileSize(previewFile.fileSize)}</p>
                </div>
                <audio src={previewFile.url} controls autoPlay className="w-full" />
              </div>
            ) : previewFile.mimeType.includes("pdf") ? (
              <iframe
                src={previewFile.url}
                title={previewFile.fileName}
                className="w-full h-full rounded-lg bg-white max-w-4xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-6 p-10 rounded-2xl bg-white/5 border border-white/10 text-center">
                {React.createElement(getFileIcon(previewFile.mimeType), {
                  className: "h-20 w-20 text-white/40",
                })}
                <div>
                  <p className="text-white font-medium">{previewFile.fileName}</p>
                  <p className="text-sm text-white/50 mt-1">{formatFileSize(previewFile.fileSize)}</p>
                </div>
                <p className="text-sm text-white/40">
                  Preview not available for this file type
                </p>
                <Button onClick={() => handleDownload(previewFile)} className="mt-2">
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Share Dialog ────────────────────────────────── */}
      <Dialog open={!!shareDialogFile} onOpenChange={(open) => !open && setShareDialogFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share File
            </DialogTitle>
            <DialogDescription className="truncate">
              {shareDialogFile?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {members
                .filter(
                  (m) =>
                    m.id !== currentUserId &&
                    m.name.toLowerCase().includes(memberSearch.toLowerCase())
                )
                .map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedShareUserIds.includes(member.id)}
                      onCheckedChange={() => toggleShareUser(member.id)}
                    />
                    <Avatar className="h-8 w-8">
                      {member.image ? <AvatarImage src={member.image} /> : null}
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      {member.email && (
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      )}
                    </div>
                    {selectedShareUserIds.includes(member.id) && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </label>
                ))}
              {members.filter(
                (m) =>
                  m.id !== currentUserId &&
                  m.name.toLowerCase().includes(memberSearch.toLowerCase())
              ).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No members found
                </p>
              )}
            </div>
            {selectedShareUserIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sharing with {selectedShareUserIds.length} {selectedShareUserIds.length === 1 ? "person" : "people"}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShareDialogFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveShares} disabled={savingShares}>
              {savingShares ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────── */}
      <Dialog open={!!deleteFile} onOpenChange={(open) => !open && setDeleteFileState(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteFile?.fileName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteFileState(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
