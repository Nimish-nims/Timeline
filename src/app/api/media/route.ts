import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase, getPublicUrl } from "@/lib/supabase"

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

    const totalCount = await prisma.mediaFile.count({
      where: { uploaderId: session.user.id },
    })

    const files = await prisma.mediaFile.findMany({
      where: { uploaderId: session.user.id },
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
        _count: { select: { shares: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const hasMore = files.length > limit
    const results = hasMore ? files.slice(0, limit) : files
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null

    const filesWithUrls = results.map((file) => ({
      ...file,
      url: getPublicUrl(file.storageKey),
    }))

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
