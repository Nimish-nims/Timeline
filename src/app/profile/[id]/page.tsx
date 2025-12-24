"use client"

import { useState, useEffect, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  ArrowLeft,
  Clock,
  Loader2,
  MessageSquare,
  Calendar,
  Mail,
  Shield,
  FileText,
  Users,
  Share2,
  Tag,
  Maximize2,
  Camera,
  X,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/breadcrumbs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface TagType {
  id: string
  name: string
}

interface Post {
  id: string
  title?: string | null
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    email: string
    image?: string | null
  }
  tags?: TagType[]
  _count?: {
    comments: number
  }
}

interface UserProfile {
  id: string
  name: string
  email: string
  image?: string | null
  role: string
  createdAt: string
  _count: {
    posts: number
    comments: number
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatRelativeDate(date: Date): string {
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

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [sharedWithMeCount, setSharedWithMeCount] = useState(0)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Photo upload state
  const [showPhotoDialog, setShowPhotoDialog] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session && id) {
      fetchProfile()
    }
  }, [session, id])

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('User not found')
        } else {
          setError('Failed to load profile')
        }
        return
      }
      const data = await res.json()
      setUser(data.user)
      setPosts(data.posts)
      setSharedWithMeCount(data.sharedWithMeCount)
      setIsOwnProfile(data.isOwnProfile)
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    if (file.size > 500000) {
      alert('Image too large. Please use an image under 500KB.')
      return
    }

    setUploadingPhoto(true)

    try {
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
          setUser(prev => prev ? { ...prev, image: data.image } : null)
          await updateSession()
        } else {
          const error = await res.json()
          alert(error.error || 'Failed to upload photo')
        }
        setUploadingPhoto(false)
        setShowPhotoDialog(false)
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
        setUser(prev => prev ? { ...prev, image: null } : null)
        await updateSession()
      }
    } catch (error) {
      console.error('Failed to remove photo:', error)
    }
    setUploadingPhoto(false)
    setShowPhotoDialog(false)
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <span className="text-lg font-semibold">Profile</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8">
        <Breadcrumbs
          items={[
            { label: user?.name || 'Profile', href: undefined }
          ]}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{error}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              The user may not exist or you may not have permission to view this profile.
            </p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Timeline
            </Button>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* Profile Card */}
            <Card className="border bg-card shadow-sm overflow-hidden">
              {/* Cover/Banner */}
              <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />

              <CardContent className="px-6 pb-6 -mt-16">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  {/* Avatar */}
                  <div className="relative group">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                      {user.image && (
                        <AvatarImage src={user.image} alt={user.name} />
                      )}
                      <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowPhotoDialog(true)}
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 pt-4 sm:pt-0 sm:pb-2">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {formatDate(new Date(user.createdAt))}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-medium">Posts</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{user._count.posts}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs font-medium">Comments</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{user._count.comments}</p>
                  </div>
                  {isOwnProfile && (
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                        <Share2 className="h-4 w-4" />
                        <span className="text-xs font-medium">Shared with me</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{sharedWithMeCount}</p>
                    </div>
                  )}
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Role</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground capitalize">{user.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Posts Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  {isOwnProfile ? 'Your Posts' : `${user.name.split(' ')[0]}'s Posts`}
                </h2>
                <span className="text-sm text-muted-foreground">({posts.length})</span>
              </div>

              {posts.length === 0 ? (
                <Card className="border bg-card shadow-sm">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <FileText className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">No posts yet</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        {isOwnProfile
                          ? "You haven't created any posts yet. Start sharing your thoughts!"
                          : "This user hasn't posted anything yet."}
                      </p>
                      {isOwnProfile && (
                        <Button className="mt-4" onClick={() => router.push('/')}>
                          Create your first post
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <Card key={post.id} className="border bg-card shadow-sm hover:shadow-md transition-shadow group">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeDate(new Date(post.createdAt))}</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{formatDate(new Date(post.createdAt))}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => router.push(`/post/${post.id}`)}
                            title="Open full post"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 pt-2">
                        {/* Post Title */}
                        {post.title && (
                          <h3 className="text-base font-semibold text-foreground mb-2">
                            {post.title}
                          </h3>
                        )}
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none line-clamp-4"
                          dangerouslySetInnerHTML={{ __html: post.content }}
                        />

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            {post.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary"
                              >
                                {tag.name}
                              </span>
                            ))}
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
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
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
                {user?.image ? (
                  <AvatarImage src={user.image} alt={user?.name || 'User'} />
                ) : null}
                <AvatarFallback className="text-3xl font-semibold bg-primary text-primary-foreground">
                  {getInitials(user?.name || 'U')}
                </AvatarFallback>
              </Avatar>
              {user?.image && (
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
    </div>
  )
}
