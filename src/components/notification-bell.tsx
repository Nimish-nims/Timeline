"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
  return date.toLocaleDateString()
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
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full px-1 text-[10px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[min(70vh,400px)] overflow-y-auto">
        <div className="px-3 py-2 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          <ul className="py-1">
            {notifications.map((n) => (
              <li key={n.id}>
                {n.type === 'mention' && n.postId ? (
                  <Link
                    href={`/post/${n.postId}`}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-3 px-3 py-2.5 hover:bg-accent transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {n.actor.image && <AvatarImage src={n.actor.image} alt={n.actor.name} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {getInitials(n.actor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{n.actor.name}</span>
                        <span className="text-muted-foreground"> tagged you in a post</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatNotificationTime(n.createdAt)}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex gap-3 px-3 py-2.5">
                    <Avatar className="h-9 w-9 shrink-0">
                      {n.actor.image && <AvatarImage src={n.actor.image} alt={n.actor.name} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {getInitials(n.actor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {n.actor.name} · {formatNotificationTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {notifications.length > 0 && unreadCount > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => markAsRead()}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
