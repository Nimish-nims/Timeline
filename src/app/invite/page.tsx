"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ArrowLeft, Copy, Check, Loader2, Clock, AlertCircle, CheckCircle2, Users, UserPlus, Shield, Search } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"

interface User {
  id: string
  email: string
  name: string
  role: string
  image?: string | null
  createdAt: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function InvitePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingUsers, setFetchingUsers] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [lastCreatedEmail, setLastCreatedEmail] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchUsers()
    }
  }, [session])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setFetchingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create user")
      } else {
        setSuccess(`User created! Default password: 12345678`)
        setLastCreatedEmail(email)
        setEmail("")
        fetchUsers()
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = async () => {
    await navigator.clipboard.writeText("12345678")
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (status === "loading" || session?.user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const memberCount = users.filter(u => u.role === "member").length
  const adminCount = users.filter(u => u.role === "admin").length

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <span className="text-lg font-semibold">Team Management</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-6 py-8">
        <Breadcrumbs
          items={[
            { label: 'Team Management', href: undefined }
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Create User */}
          <div className="lg:col-span-1 space-y-6">
            {/* Stats Card */}
            <Card className="border bg-card shadow-sm">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                    </div>
                    <p className="text-3xl font-bold text-foreground">{memberCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Members</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
                      <Shield className="h-4 w-4" />
                    </div>
                    <p className="text-3xl font-bold text-primary">{adminCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Admins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create User Card */}
            <Card className="border bg-card shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Add New User</h2>
                    <p className="text-sm text-muted-foreground">Create account with email</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 space-y-3">
                      <div className="flex items-start gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">
                          <strong>{lastCreatedEmail}</strong> created!
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-background/80 p-3 rounded-lg">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</p>
                          <p className="font-mono font-bold text-foreground">12345678</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyPassword}
                          className="h-8"
                        >
                          {copiedPassword ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-11">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create User
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Default password: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">12345678</code>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Team Members */}
          <div className="lg:col-span-2">
            <Card className="border bg-card shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">Team Members</h2>
                      <p className="text-sm text-muted-foreground">{users.length} total users</p>
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>

                {fetchingUsers ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading team...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <Users className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {searchQuery ? "No results found" : "No team members yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {searchQuery
                        ? "Try a different search term"
                        : "Start by adding your first team member"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-sm ${
                          user.role === "admin"
                            ? "bg-primary/5 border-primary/20 hover:border-primary/30"
                            : "bg-card border-border hover:border-border/80"
                        }`}
                      >
                        <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                          {user.image && (
                            <AvatarImage src={user.image} alt={user.name} />
                          )}
                          <AvatarFallback className={`text-sm font-semibold ${
                            user.role === "admin"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">{user.name}</p>
                            {user.role === "admin" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                                <Shield className="h-2.5 w-2.5" />
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(user.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
