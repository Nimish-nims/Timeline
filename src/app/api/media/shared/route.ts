import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPublicUrl } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const uploaderId = searchParams.get("uploaderId")

    const where: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (uploaderId) {
      where.mediaFile = { uploaderId }
    }

    const shares = await prisma.mediaShare.findMany({
      where,
      include: {
        mediaFile: {
          include: {
            uploader: {
              select: { id: true, name: true, email: true, image: true },
            },
            _count: { select: { shares: true } },
          },
        },
      },
      orderBy: { sharedAt: "desc" },
    })

    // Build file list with URLs
    const files = shares.map((share) => ({
      ...share.mediaFile,
      url: getPublicUrl(share.mediaFile.storageKey),
      sharedAt: share.sharedAt,
    }))

    // Build unique uploaders list for filter
    const uploaderMap = new Map<string, { id: string; name: string; email: string; image: string | null }>()
    for (const share of shares) {
      const u = share.mediaFile.uploader
      if (!uploaderMap.has(u.id)) {
        uploaderMap.set(u.id, u)
      }
    }

    return NextResponse.json({
      files,
      uploaders: Array.from(uploaderMap.values()),
    })
  } catch (error) {
    console.error("Failed to fetch shared media files:", error)
    return NextResponse.json({ error: "Failed to fetch shared files" }, { status: 500 })
  }
}
