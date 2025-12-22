"use client"

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { PostEditor } from '@/components/post-editor'
import { Timeline } from '@/components/timeline'
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
import { LogOut, UserPlus, Loader2, Shield, Users, Camera, X } from 'lucide-react'

interface Post {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    email: string
    image?: string | null
  }
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
  const [memberCount, setMemberCount] = useState(0)
  const [recentMembers, setRecentMembers] = useState<Member[]>([])
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [filterByUserId, setFilterByUserId] = useState<string | null>(null)
  const [filterByUserName, setFilterByUserName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilterByUser = (userId: string, userName: string) => {
    setFilterByUserId(userId)
    setFilterByUserName(userName)
  }

  const handleClearFilter = () => {
    setFilterByUserId(null)
    setFilterByUserName(null)
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
    }
  }, [session])

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts')
      const data = await res.json()
      setPosts(data)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
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

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      const data = await res.json()
      setProfileImage(data.image)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
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

  const handlePost = async (content: string) => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const newPost = await res.json()
        setPosts([newPost, ...posts])
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
      }
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  const handleEdit = async (id: string, content: string) => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const updatedPost = await res.json()
        setPosts(posts.map(post => post.id === id ? updatedPost : post))
      }
    } catch (error) {
      console.error('Failed to update post:', error)
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
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold tracking-tight">Timeline</span>
            </div>
            {/* Member count badge */}
            <div className="flex items-center gap-2 ml-4 px-3 py-1.5 bg-muted rounded-full">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              {/* Stacked avatars */}
              <div className="flex -space-x-2 ml-1">
                {recentMembers.slice(0, 3).map((member, i) => (
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
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

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
                <DropdownMenuItem onClick={() => setShowProfileDialog(true)} className="cursor-pointer">
                  <Camera className="mr-2 h-4 w-4" />
                  Update Photo
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

      <main className="container mx-auto max-w-6xl px-6 py-8">
        <PostEditor onPost={handlePost} />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading posts...</p>
          </div>
        ) : (
          <Timeline
            posts={posts.map(post => ({
              id: post.id,
              content: post.content,
              authorName: post.author.name,
              authorId: post.author.id,
              authorImage: post.author.image,
              createdAt: new Date(post.createdAt),
            }))}
            onDelete={handleDelete}
            onEdit={handleEdit}
            currentUserId={session?.user?.id}
            isAdmin={isAdmin}
            filterByUserId={filterByUserId}
            filterByUserName={filterByUserName}
            onFilterByUser={handleFilterByUser}
            onClearFilter={handleClearFilter}
          />
        )}
      </main>

      <footer className="border-t py-8 mt-auto bg-muted/30">
        <div className="container mx-auto max-w-5xl px-6">
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
    </div>
  )
}
