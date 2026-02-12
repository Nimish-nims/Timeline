"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Loader2, AtSign, Check, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface NotificationActor {
  id: string
  name: string
  image?: string | null
}

interface NotificationItem {
  id: string
  type: string
  postId: string | null
  read: boolean
  createdAt: string
  actor: NotificationActor
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
}

function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data: NotificationsResponse = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) fetchNotifications()
  }

  const markAsRead = async (notificationId?: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationId ? { id: notificationId, read: true } : { read: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount ?? 0)
        setNotifications((prev) =>
          prev.map((n) => (notificationId ? (n.id === notificationId ? { ...n, read: true } : n) : { ...n, read: true }))
        )
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.read) markAsRead(n.id)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-full hover:bg-muted transition-colors"
        >
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0 shadow-lg"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {notifications.length > 0 && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAsRead()}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <Separator />

        {/* Content */}
        <div className="max-h-[min(60vh,380px)] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <BellOff className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">We&apos;ll notify you when someone tags you</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  {n.type === 'mention' && n.postId ? (
                    <Link
                      href={`/post/${n.postId}`}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors relative ${
                        !n.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Unread indicator */}
                      {!n.read && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                      )}
                      
                      {/* Avatar with icon overlay */}
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                          {n.actor.image && <AvatarImage src={n.actor.image} alt={n.actor.name} />}
                          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                            {getInitials(n.actor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-background">
                          <AtSign className="h-3 w-3 text-white" />
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold text-foreground">{n.actor.name}</span>
                          <span className="text-muted-foreground"> mentioned you in a post</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatNotificationTime(n.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className={`flex gap-3 px-4 py-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                      {!n.read && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                      )}
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                        {n.actor.image && <AvatarImage src={n.actor.image} alt={n.actor.name} />}
                        <AvatarFallback className="text-xs font-medium bg-muted">
                          {getInitials(n.actor.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{n.actor.name}</span>
                          {' · '}
                          {formatNotificationTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
