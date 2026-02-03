"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
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
  Grid3X3,
  List,
  Download,
  Share2,
  Trash2,
  Eye,
  Loader2,
  X,
  Users,
  Inbox,
  HardDrive,
  CloudUpload,
  MoreVertical,
  Check,
  ChevronDown,
  Search,
  AlertCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

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
  createdAt: string
  sharedAt?: string
}

interface Member {
  id: string
  name: string
  email?: string
  image: string | null
}

interface Uploader {
  id: string
  name: string
  email: string
  image: string | null
}

interface MediaDriveProps {
  currentUserId?: string
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

// ─── Component ────────────────────────────────────────────────

export function MediaDrive({ currentUserId }: MediaDriveProps) {
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"my-files" | "shared-with-me">("my-files")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // My files state
  const [files, setFiles] = useState<MediaFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // Shared files state
  const [sharedFiles, setSharedFiles] = useState<MediaFileItem[]>([])
  const [sharedLoading, setSharedLoading] = useState(true)
  const [uploaders, setUploaders] = useState<Uploader[]>([])
  const [filterUploaderId, setFilterUploaderId] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  // Media storage not configured (e.g. missing Supabase env on Vercel)
  const [storageUnavailable, setStorageUnavailable] = useState(false)

  // Dialog state
  const [previewFile, setPreviewFile] = useState<MediaFileItem | null>(null)
  const [shareDialogFile, setShareDialogFile] = useState<MediaFileItem | null>(null)
  const [deleteFile, setDeleteFile] = useState<MediaFileItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Share dialog state
  const [members, setMembers] = useState<Member[]>([])
  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>([])
  const [savingShares, setSavingShares] = useState(false)
  const [memberSearch, setMemberSearch] = useState("")

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // ─── Data Fetching ────────────────────────────────────────

  const fetchMyFiles = useCallback(async (cursor?: string | null, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "20")
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/media?${params.toString()}`)
      const data = await res.json()
      if (res.status === 503 && (data?.error === "Media storage not configured" || data?.error?.toLowerCase().includes("not configured"))) {
        setStorageUnavailable(true)
        if (!append) setFiles([])
        return
      }
      if (data.files && Array.isArray(data.files)) {
        setStorageUnavailable(false)
        if (append) setFiles((prev) => [...prev, ...data.files])
        else setFiles(data.files)
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
        setTotalCount(data.totalCount || 0)
      }
    } catch (error) {
      console.error("Failed to fetch files:", error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const fetchSharedFiles = useCallback(async (uploaderId?: string | null) => {
    setSharedLoading(true)
    try {
      const params = new URLSearchParams()
      if (uploaderId) params.set("uploaderId", uploaderId)
      const res = await fetch(`/api/media/shared?${params.toString()}`)
      const data = await res.json()
      if (data.files) setSharedFiles(data.files)
      if (data.uploaders) setUploaders(data.uploaders)
    } catch (error) {
      console.error("Failed to fetch shared files:", error)
    } finally {
      setSharedLoading(false)
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members?all=true")
      if (res.ok) {
        const data = await res.json()
        const list = data.members ?? data
        setMembers(Array.isArray(list) ? list : [])
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
    }
  }, [])

  // Escape key to close preview
  useEffect(() => {
    if (!previewFile) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewFile(null)
    }
    document.addEventListener("keydown", handleKey)
    // Prevent body scroll while preview is open
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [previewFile])

  // Initial fetch
  useEffect(() => {
    fetchMyFiles()
    fetchSharedFiles()
  }, [fetchMyFiles, fetchSharedFiles])

  // Refetch shared files when filter changes
  useEffect(() => {
    fetchSharedFiles(filterUploaderId)
  }, [filterUploaderId, fetchSharedFiles])

  // Infinite scroll for my files
  useEffect(() => {
    if (!loadMoreRef.current || loading || activeSubTab !== "my-files") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          if (nextCursor) fetchMyFiles(nextCursor, true)
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, activeSubTab, nextCursor, fetchMyFiles])

  // ─── Upload Handling ──────────────────────────────────────

  const handleUpload = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList)
    if (filesToUpload.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    filesToUpload.forEach((file) => formData.append("files", file))

    try {
      // Simulate progress since fetch doesn't support progress natively
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
        if (res.status === 503 && (data?.error === "Media storage not configured" || data?.error?.toLowerCase().includes("not configured"))) {
          setStorageUnavailable(true)
          // No alert — we show an in-app message instead
        } else {
          const msg = data?.error || res.statusText || "Upload failed"
          alert(msg)
        }
        return
      }

      if (data.uploaded && data.uploaded.length > 0) {
        // Refetch list so new files appear with correct URLs and server state
        await fetchMyFiles()
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
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  // ─── File Actions ─────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteFile) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/media/${deleteFile.id}`, { method: "DELETE" })
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== deleteFile.id))
        setTotalCount((prev) => Math.max(0, prev - 1))
        setDeleteFile(null)
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

  // ─── Share Dialog ─────────────────────────────────────────

  const openShareDialog = async (file: MediaFileItem) => {
    setShareDialogFile(file)
    setMemberSearch("")
    await fetchMembers()

    // Fetch current shares for this file
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
        // Refresh files to update share counts
        fetchMyFiles()
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

  // ─── Render Helpers ───────────────────────────────────────

  const renderFileCard = (file: MediaFileItem, isShared = false) => {
    const FileIcon = getFileIcon(file.mimeType)
    const isImage = file.mimeType.startsWith("image/")
    const isVideo = file.mimeType.startsWith("video/")

    if (viewMode === "list") {
      return (
        <div
          key={file.id}
          className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
        >
          {/* Thumbnail / Icon */}
          <div
            className="h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden bg-muted cursor-pointer"
            onClick={() => setPreviewFile(file)}
          >
            {isImage && file.url ? (
              <img src={file.url} alt={file.fileName} className="h-full w-full object-cover" />
            ) : (
              <FileIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Name + Meta */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate cursor-pointer hover:text-primary"
              onClick={() => setPreviewFile(file)}
            >
              {file.fileName}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatFileSize(file.fileSize)}</span>
              <span>-</span>
              <span>{formatDate(isShared && file.sharedAt ? file.sharedAt : file.createdAt)}</span>
              {isShared && file.uploader && (
                <>
                  <span>-</span>
                  <span>from {file.uploader.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Share count */}
          {!isShared && file._count && file._count.shares > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {file._count.shares}
            </Badge>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewFile(file)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(file)}>
              <Download className="h-4 w-4" />
            </Button>
            {!isShared && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openShareDialog(file)}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteFile(file)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )
    }

    // Grid view
    return (
      <Card
        key={file.id}
        className="overflow-hidden group hover:shadow-md transition-shadow"
      >
        {/* Preview area */}
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

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Share badge */}
          {!isShared && file._count && file._count.shares > 0 && (
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
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.fileSize)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(isShared && file.sharedAt ? file.sharedAt : file.createdAt)}
            </span>
          </div>

          {isShared && file.uploader && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Avatar className="h-4 w-4">
                {file.uploader.image ? <AvatarImage src={file.uploader.image} /> : null}
                <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                  {getInitials(file.uploader.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{file.uploader.name}</span>
            </div>
          )}

          {/* Actions */}
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
                {!isShared && (
                  <>
                    <DropdownMenuItem onClick={() => openShareDialog(file)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteFile(file)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Main Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Storage not configured — friendly in-app message */}
      {activeSubTab === "my-files" && storageUnavailable && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Media storage is not configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                File uploads are disabled because storage is not set up for this deployment. In Vercel, add:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> (Supabase Project URL) and{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> (use the{" "}
                <strong>service_role</strong> key from Supabase → Project Settings → API, not the anon key). Then redeploy.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Area (only on My Files tab; hidden when storage unavailable) */}
      {activeSubTab === "my-files" && !storageUnavailable && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
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
            <div className="space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium">Uploading files...</p>
              <div className="max-w-xs mx-auto">
                <Progress value={uploadProgress} />
              </div>
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-3">
              <CloudUpload className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">
                  Drag and drop files here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click the button below to browse
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
              <p className="text-xs text-muted-foreground">
                Photos, videos, documents up to 50MB each
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("my-files")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === "my-files"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <HardDrive className="h-4 w-4" />
            My Files
            <Badge variant="secondary" className="ml-1 font-normal tabular-nums">
              {totalCount}
            </Badge>
          </button>
          <button
            onClick={() => setActiveSubTab("shared-with-me")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === "shared-with-me"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Inbox className="h-4 w-4" />
            Shared with Me
            {sharedFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 font-normal tabular-nums">
                {sharedFiles.length}
              </Badge>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          {/* Uploader filter for shared tab */}
          {activeSubTab === "shared-with-me" && uploaders.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  {filterUploaderId
                    ? uploaders.find((u) => u.id === filterUploaderId)?.name || "Filter"
                    : "All uploaders"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterUploaderId(null)}>
                  All uploaders
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {uploaders.map((uploader) => (
                  <DropdownMenuItem key={uploader.id} onClick={() => setFilterUploaderId(uploader.id)}>
                    <Avatar className="h-5 w-5 mr-2">
                      {uploader.image ? <AvatarImage src={uploader.image} /> : null}
                      <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                        {getInitials(uploader.name)}
                      </AvatarFallback>
                    </Avatar>
                    {uploader.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeSubTab === "my-files" ? (
        loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HardDrive className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No files uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Drag and drop files above, or click Upload to get started.
            </p>
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => renderFileCard(file))}
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => renderFileCard(file))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="py-4">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading more...</p>
                </div>
              )}
              {!hasMore && files.length > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  All files loaded
                </p>
              )}
            </div>
          </>
        )
      ) : sharedLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading shared files...</p>
        </div>
      ) : sharedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No shared files yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When someone shares a file with you, it will appear here.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sharedFiles.map((file) => renderFileCard(file, true))}
        </div>
      ) : (
        <div className="space-y-2">
          {sharedFiles.map((file) => renderFileCard(file, true))}
        </div>
      )}

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

          {/* Content area - click outside to close */}
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
                <Button
                  onClick={() => handleDownload(previewFile)}
                  className="mt-2"
                >
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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Member list */}
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
      <Dialog open={!!deleteFile} onOpenChange={(open) => !open && setDeleteFile(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteFile?.fileName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteFile(null)}>
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
