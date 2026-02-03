"use client"

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { PostEditor } from '@/components/post-editor'
import { Timeline } from '@/components/timeline'
import { SharedWithMe } from '@/components/shared-with-me'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { LogOut, UserPlus, Loader2, Shield, Users, Camera, X, Share2, Copy, Check, Globe, Lock, Inbox, User, Tag, ChevronDown, Search, FileText, HardDrive, Folder } from 'lucide-react'
import { NotificationBell } from '@/components/notification-bell'
import { MediaDrive } from '@/components/media-drive'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface TagType {
  id: string
  name: string
}

interface TagWithCount {
  id: string
  name: string
  _count: {
    posts: number
  }
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
  mentions?: { user: SharedUser }[]
  folderId?: string | null
  folder?: { id: string; name: string } | null
  _count?: {
    comments: number
  }
}

interface Folder {
  id: string
  name: string
  parentId: string | null
  _count: { posts: number }
}

interface Member {
  id: string
  name: string
  image: string | null
}

export default function Home() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalPostCount, setTotalPostCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [recentMembers, setRecentMembers] = useState<Member[]>([])
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [filterByUserId, setFilterByUserId] = useState<string | null>(null)
  const [filterByUserName, setFilterByUserName] = useState<string | null>(null)
  const [filterByTag, setFilterByTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<TagWithCount[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [savingShare, setSavingShare] = useState(false)

  // Tab state for switching between All Posts and Shared with Me
  const [activeTab, setActiveTab] = useState<'all' | 'shared' | 'files'>('all')

  const handleFilterByUser = (userId: string, userName: string) => {
    setFilterByUserId(userId)
    setFilterByUserName(userName)
  }

  const handleClearFilter = () => {
    setFilterByUserId(null)
    setFilterByUserName(null)
  }

  const handleFilterByTag = (tag: string) => {
    setFilterByTag(tag)
  }

  const handleClearTagFilter = () => {
    setFilterByTag(null)
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchPosts()
      fetchMembers()
      fetchProfile()
      fetchShareSettings()
      fetchTags()
      fetchFolders()
    }
  }, [session])


  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Infinite scroll - load more when sentinel is visible
  useEffect(() => {
    if (!loadMoreRef.current || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && activeTab === 'all') {
          loadMorePosts()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, activeTab, nextCursor])

  const fetchPosts = async (cursor?: string | null, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/posts?${params.toString()}`)
      const data = await res.json()
      
      // Handle new paginated response format
      if (data.posts && Array.isArray(data.posts)) {
        if (append) {
          setPosts(prev => [...prev, ...data.posts])
        } else {
          setPosts(data.posts)
        }
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
        setTotalPostCount(data.totalCount || 0)
      } else if (Array.isArray(data)) {
        // Fallback for old format
        setPosts(append ? prev => [...prev, ...data] : data)
        setHasMore(false)
        setTotalPostCount(data.length)
      } else {
        console.error('Posts API returned unexpected format:', data)
        if (!append) setPosts([])
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      if (!append) setPosts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMorePosts = () => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchPosts(nextCursor, true)
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members')
      const data = await res.json()
      setMemberCount(data.count)
      setRecentMembers(data.members)
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (Array.isArray(data)) {
        setAllTags(data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders')
      if (res.ok) {
        const data = await res.json()
        setFolders(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    }
  }

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      const data = await res.json()
      setProfileImage(data.image)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const fetchShareSettings = async () => {
    try {
      const res = await fetch('/api/share')
      const data = await res.json()
      setIsPublic(data.isPublic || false)
      if (data.shareUrl) {
        setShareUrl(`${window.location.origin}${data.shareUrl}`)
      }
    } catch (error) {
      console.error('Failed to fetch share settings:', error)
    }
  }

  const togglePublicShare = async () => {
    setSavingShare(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      })
      const data = await res.json()
      setIsPublic(data.isPublic)
      if (data.shareUrl) {
        setShareUrl(`${window.location.origin}${data.shareUrl}`)
      } else {
        setShareUrl(null)
      }
    } catch (error) {
      console.error('Failed to update share settings:', error)
    }
    setSavingShare(false)
  }

  const copyShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (500KB max)
    if (file.size > 500000) {
      alert('Image too large. Please use an image under 500KB.')
      return
    }

    setUploadingPhoto(true)

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string

        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })

        if (res.ok) {
          const data = await res.json()
          setProfileImage(data.image)
          await updateSession() // Refresh session
          fetchMembers() // Refresh member list
        } else {
          const error = await res.json()
          alert(error.error || 'Failed to upload photo')
        }
        setUploadingPhoto(false)
        setShowProfileDialog(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to upload photo:', error)
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: null }),
      })

      if (res.ok) {
        setProfileImage(null)
        await updateSession()
        fetchMembers()
      }
    } catch (error) {
      console.error('Failed to remove photo:', error)
    }
    setUploadingPhoto(false)
    setShowProfileDialog(false)
  }

  const handlePost = async (content: string, tags: string[], title?: string, folderId?: string | null) => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags, folderId: folderId ?? null }),
      })

      if (res.ok) {
        const newPost = await res.json()
        setPosts([newPost, ...posts])
        setTotalPostCount(prev => prev + 1)
        if (tags.length > 0) fetchTags()
      }
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setPosts(posts.filter(post => post.id !== id))
        setTotalPostCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  const handleEdit = async (id: string, content: string, tags?: string[], folderId?: string | null) => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tags, folderId: folderId ?? undefined }),
      })

      if (res.ok) {
        const updatedPost = await res.json()
        setPosts(posts.map(post => post.id === id ? updatedPost : post))
      }
    } catch (error) {
      console.error('Failed to update post:', error)
    }
  }

  const handleSharePost = async (postId: string, userIds: string[]) => {
    try {
      const res = await fetch(`/api/posts/${postId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })

      if (res.ok) {
        // Refresh posts to get updated share info
        fetchPosts()
      }
    } catch (error) {
      console.error('Failed to share post:', error)
    }
  }

  const handleUnsharePost = async (postId: string, userId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/share?userId=${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Refresh posts to get updated share info
        fetchPosts()
      }
    } catch (error) {
      console.error('Failed to unshare post:', error)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isAdmin = session?.user?.role === 'admin'

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold tracking-tight">Timeline</span>
            </div>
            {/* Member count and post count */}
            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                <div className="flex -space-x-2 ml-1">
                  {recentMembers.slice(0, 3).map((member) => (
                    <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                      {member.image ? (
                        <AvatarImage src={member.image} alt={member.name} />
                      ) : null}
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {memberCount > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                      <span className="text-[10px] font-medium text-muted-foreground">+{memberCount - 3}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium tabular-nums">{totalPostCount} {totalPostCount === 1 ? 'post' : 'posts'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-border hover:ring-primary/20 transition-all">
                  <Avatar className="h-10 w-10">
                    {profileImage ? (
                      <AvatarImage src={profileImage} alt={session?.user?.name || 'User'} />
                    ) : null}
                    <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                      {getInitials(session?.user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="flex items-center gap-3 p-3">
                  <div className="relative group">
                    <Avatar className="h-12 w-12">
                      {profileImage ? (
                        <AvatarImage src={profileImage} alt={session?.user?.name || 'User'} />
                      ) : null}
                      <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                        {getInitials(session?.user?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => setShowProfileDialog(true)}
                      className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="flex flex-col space-y-0.5 leading-none min-w-0">
                    <p className="font-semibold text-sm truncate">{session?.user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                    {isAdmin && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Shield className="h-3 w-3" />
                        Admin
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/profile/${session?.user?.id}`)} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowProfileDialog(true)} className="cursor-pointer">
                  <Camera className="mr-2 h-4 w-4" />
                  Update Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowShareDialog(true)} className="cursor-pointer">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Timeline
                  {isPublic && <Globe className="ml-auto h-3 w-3 text-green-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/folders')} className="cursor-pointer">
                  <Folder className="mr-2 h-4 w-4" />
                  Folders
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => router.push('/invite')} className="cursor-pointer">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Users
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {activeTab !== 'files' && (
          <PostEditor
            onPost={handlePost}
            folders={folders}
          />
        )}

        {/* Tab Navigation — thin separator between composer and tabs */}
        <div className="flex items-center justify-between gap-4 border-b border-border mt-6 mb-0">
          <div className="flex items-center gap-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              All Posts
              <Badge variant="secondary" className="ml-1 font-normal tabular-nums text-xs px-1.5">
                {totalPostCount}
              </Badge>
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'shared'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="h-4 w-4 shrink-0" />
              Shared with Me
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'files'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <HardDrive className="h-4 w-4 shrink-0" />
              My Files
            </button>
          </div>

          {/* Tag Filter Dropdown */}
          {activeTab === 'all' && allTags.length > 0 && (
            <div className="relative pb-2" ref={tagDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={`h-8 gap-2 rounded-md text-sm ${filterByTag ? 'border-primary/60 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Tag className="h-4 w-4" />
                {filterByTag || 'Filter by tag'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
              </Button>

              {showTagDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-popover border rounded-lg shadow-lg z-50">
                  {/* Search input */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tags..."
                        value={tagSearchQuery}
                        onChange={(e) => setTagSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Clear filter option */}
                  {filterByTag && (
                    <button
                      onClick={() => {
                        handleClearTagFilter()
                        setShowTagDropdown(false)
                        setTagSearchQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent flex items-center gap-2 border-b"
                    >
                      <X className="h-4 w-4" />
                      Clear filter
                    </button>
                  )}

                  {/* Tags list */}
                  <div className="max-h-64 overflow-y-auto py-1">
                    {allTags
                      .filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            handleFilterByTag(tag.name)
                            setShowTagDropdown(false)
                            setTagSearchQuery('')
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between gap-2 ${
                            filterByTag === tag.name ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{tag.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {tag._count.posts}
                          </span>
                        </button>
                      ))}
                    {allTags.filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No tags found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'all' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Loading posts...</p>
            </div>
          ) : (
            <>
              <Timeline
                posts={posts.map(post => ({
                  id: post.id,
                  title: post.title,
                  content: post.content,
                  authorName: post.author.name,
                  authorId: post.author.id,
                  authorImage: post.author.image,
                  createdAt: new Date(post.createdAt),
                  updatedAt: new Date(post.updatedAt),
                  tags: post.tags,
                  shares: post.shares,
                  folderId: post.folderId,
                  folder: post.folder,
                  mentions: post.mentions,
                  _count: post._count,
                }))}
                onDelete={handleDelete}
                onEdit={handleEdit}
                folders={folders}
                onSharePost={handleSharePost}
                onUnsharePost={handleUnsharePost}
                currentUserId={session?.user?.id}
                isAdmin={isAdmin}
                filterByUserId={filterByUserId}
                filterByUserName={filterByUserName}
                onFilterByUser={handleFilterByUser}
                onClearFilter={handleClearFilter}
                filterByTag={filterByTag}
                onFilterByTag={handleFilterByTag}
                onClearTagFilter={handleClearTagFilter}
              />
              
              {/* Infinite scroll sentinel and loading indicator */}
              <div ref={loadMoreRef} className="py-8">
                {loadingMore && (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading more posts...</p>
                  </div>
                )}
                {!hasMore && posts.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    You&apos;ve reached the end
                  </p>
                )}
              </div>
            </>
          )
        ) : activeTab === 'shared' ? (
          <SharedWithMe currentUserId={session?.user?.id} />
        ) : (
          <MediaDrive currentUserId={session?.user?.id} />
        )}
      </main>

      <footer className="border-t py-8 mt-auto bg-muted/30">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-xs">T</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">Timeline</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with CT Editor and ShadCN UI
            </p>
          </div>
        </div>
      </footer>

      {/* Profile Photo Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
            <DialogDescription>
              Upload a new photo or remove your current one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative">
              <Avatar className="h-32 w-32">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt={session?.user?.name || 'User'} />
                ) : null}
                <AvatarFallback className="text-3xl font-semibold bg-primary text-primary-foreground">
                  {getInitials(session?.user?.name || 'U')}
                </AvatarFallback>
              </Avatar>
              {profileImage && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Choose Photo
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Supported formats: JPG, PNG, GIF. Max size: 500KB
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Timeline Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Your Timeline
            </DialogTitle>
            <DialogDescription>
              Make your timeline public so anyone with the link can view your posts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Toggle Public */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-green-500" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{isPublic ? 'Public' : 'Private'}</p>
                  <p className="text-sm text-muted-foreground">
                    {isPublic ? 'Anyone with the link can view' : 'Only you can see your timeline'}
                  </p>
                </div>
              </div>
              <Button
                variant={isPublic ? "destructive" : "default"}
                size="sm"
                onClick={togglePublicShare}
                disabled={savingShare}
              >
                {savingShare ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPublic ? (
                  'Make Private'
                ) : (
                  'Make Public'
                )}
              </Button>
            </div>

            {/* Share Link */}
            {isPublic && shareUrl && (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyShareLink}
                    className="shrink-0"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with anyone to let them view your timeline.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
