import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPublicUrl } from "@/lib/supabase"

// Type for attachment with post info
type AttachmentWithPost = {
  post: {
    id: string
    title: string | null
    content: string
    createdAt: Date
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateKey = searchParams.get("dateKey")

    if (!dateKey) {
      return NextResponse.json({ error: "dateKey is required" }, { status: 400 })
    }

    // Parse date using local time (same pattern as /api/media/route.ts)
    const parts = dateKey.split("-").map(Number)
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) {
      return NextResponse.json({ error: "Invalid dateKey format" }, { status: 400 })
    }
    const [year, month, day] = parts
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)

    // 1. Fetch native files (created on this date)
    const nativeFiles = await prisma.mediaFile.findMany({
      where: {
        uploaderId: session.user.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        uploader: { select: { id: true, name: true, image: true } },
        _count: { select: { shares: true } },
        attachments: {
          take: 1,
          include: {
            post: {
              select: { id: true, title: true, content: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const nativeFileIds = new Set(nativeFiles.map((f) => f.id))

    // 2. Fetch cross-date files (explicitly added to this thread)
    const threadEntries = await prisma.fileThreadEntry.findMany({
      where: {
        dateKey,
        NOT: { mediaFileId: { in: Array.from(nativeFileIds) } },
      },
      include: {
        mediaFile: {
          include: {
            uploader: { select: { id: true, name: true, image: true } },
            _count: { select: { shares: true } },
            attachments: {
              take: 1,
              include: {
                post: {
                  select: { id: true, title: true, content: true, createdAt: true },
                },
              },
            },
          },
        },
      },
      orderBy: { addedAt: "asc" },
    })

    // 3. Fetch comments
    const comments = await prisma.fileThreadComment.findMany({
      where: { dateKey },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // 4. Build activity items
    type FileWithAttachments = (typeof nativeFiles)[number] & {
      attachments?: AttachmentWithPost[]
    }

    const mapFile = (file: FileWithAttachments) => {
      const attachment = file.attachments?.[0]
      const post = attachment?.post ?? null
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attachments: _a, ...rest } = file
      return {
        ...rest,
        url: getPublicUrl(file.storageKey),
        post: post
          ? { id: post.id, title: post.title, content: post.content, createdAt: post.createdAt }
          : null,
      }
    }

    // Helper: get display label for a date
    const getDisplayDate = (isoDate: string) => {
      const target = new Date(isoDate)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
      if (sameDay(target, today)) return "Today"
      if (sameDay(target, yesterday)) return "Yesterday"
      return target.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      })
    }

    type ActivityItem =
      | { type: "file-group"; date: string; displayDate: string; files: ReturnType<typeof mapFile>[]; timestamp: string }
      | { type: "comment"; comment: (typeof comments)[number]; timestamp: string }

    const activities: ActivityItem[] = []

    // Native files as a single group
    if (nativeFiles.length > 0) {
      activities.push({
        type: "file-group",
        date: dateKey,
        displayDate: getDisplayDate(dateKey),
        files: nativeFiles.map((f) => mapFile(f as FileWithAttachments)),
        timestamp: nativeFiles[0].createdAt.toISOString(),
      })
    }

    // Cross-date files grouped by their actual createdAt date
    const crossDateGroups = new Map<string, { files: ReturnType<typeof mapFile>[]; addedAt: Date }>()
    for (const entry of threadEntries) {
      const file = entry.mediaFile as FileWithAttachments
      const fileDate = file.createdAt.toISOString().slice(0, 10)
      if (!crossDateGroups.has(fileDate)) {
        crossDateGroups.set(fileDate, { files: [], addedAt: entry.addedAt })
      }
      crossDateGroups.get(fileDate)!.files.push(mapFile(file))
    }
    for (const [fileDate, group] of crossDateGroups) {
      activities.push({
        type: "file-group",
        date: fileDate,
        displayDate: getDisplayDate(fileDate),
        files: group.files,
        timestamp: group.addedAt.toISOString(),
      })
    }

    // Comments
    for (const comment of comments) {
      activities.push({
        type: "comment",
        comment,
        timestamp: comment.createdAt.toISOString(),
      })
    }

    // Sort by timestamp
    activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const totalFileCount = nativeFiles.length + threadEntries.length

    return NextResponse.json({
      activities,
      totalFileCount,
      totalCommentCount: comments.length,
    })
  } catch (error) {
    console.error("Failed to fetch file thread activity:", error)
    return NextResponse.json({ error: "Failed to fetch thread activity" }, { status: 500 })
  }
}
