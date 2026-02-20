import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase, getPublicUrl } from "@/lib/supabase"

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
    if (!supabase) {
      return NextResponse.json({ error: "Media storage not configured" }, { status: 503 })
    }
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limitParam = searchParams.get("limit")
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 50)
    const dateParam = searchParams.get("date") // ISO date string like "2026-02-20"

    // Build where clause with optional date filter
    const where: Record<string, unknown> = { uploaderId: session.user.id }
    if (dateParam) {
      // Parse as local date parts to avoid timezone shifting
      const parts = dateParam.split("-").map(Number) // [yyyy, mm, dd]
      if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
        const [year, month, day] = parts
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)
        where.createdAt = { gte: startOfDay, lte: endOfDay }
      }
    }

    const totalCount = await prisma.mediaFile.count({ where })

    const findManyArgs = {
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        uploader: {
          select: { id: true, name: true, image: true },
        },
        shares: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        attachments: {
          take: 1,
          include: {
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                createdAt: true,
              },
            },
          },
        },
        _count: { select: { shares: true } },
      },
      orderBy: { createdAt: "desc" as const },
    }

    type FileWithAttachments = Awaited<ReturnType<typeof prisma.mediaFile.findMany>>[number] & {
      attachments?: AttachmentWithPost[]
    }

    const files = await prisma.mediaFile.findMany(
      findManyArgs as Parameters<typeof prisma.mediaFile.findMany>[0]
    ) as FileWithAttachments[]

    const hasMore = files.length > limit
    const results = hasMore ? files.slice(0, limit) : files
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null

    const filesWithUrls = results.map((file) => {
      const attachment = file.attachments?.[0]
      const post = attachment?.post ?? null
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attachments: _attachments, ...rest } = file
      return {
        ...rest,
        url: getPublicUrl(file.storageKey),
        post: post
          ? {
              id: post.id,
              title: post.title,
              content: post.content,
              createdAt: post.createdAt,
            }
          : null,
      }
    })

    return NextResponse.json({
      files: filesWithUrls,
      nextCursor,
      hasMore,
      totalCount,
    })
  } catch (error) {
    console.error("Failed to fetch media files:", error)
    return NextResponse.json({ error: "Failed to fetch media files" }, { status: 500 })
  }
}
