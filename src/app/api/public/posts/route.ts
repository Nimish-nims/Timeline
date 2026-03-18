import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getPublicUrl } from "@/lib/supabase"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type AttachmentWithMedia = {
  mediaFile: {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    storageKey: string
    thumbnailUrl: string | null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limitParam = searchParams.get("limit")
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 50)

    type PostListItem = Awaited<ReturnType<typeof prisma.post.findMany>>[number] & {
      attachments?: AttachmentWithMedia[]
    }

    let posts: PostListItem[]

    try {
      const findManyArgs = {
        where: { author: { isPublic: true } },
        take: limit + 1,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        include: {
          author: { select: { id: true, name: true, image: true } },
          tags: { select: { id: true, name: true } },
          attachments: {
            include: {
              mediaFile: {
                select: {
                  id: true,
                  fileName: true,
                  fileSize: true,
                  mimeType: true,
                  storageKey: true,
                  thumbnailUrl: true,
                },
              },
            },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" as const },
      }

      posts = (await prisma.post.findMany(
        findManyArgs as Parameters<typeof prisma.post.findMany>[0]
      )) as PostListItem[]
    } catch (relationError) {
      console.warn("Failed to fetch public posts with relations, trying simple query:", relationError)
      const fallbackPosts = await prisma.post.findMany({
        where: { author: { isPublic: true } },
        take: limit + 1,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      posts = fallbackPosts.map((post) => ({
        ...post,
        tags: [],
        attachments: [] as AttachmentWithMedia[],
        _count: { comments: 0 },
      })) as PostListItem[]
    }

    const hasMore = posts.length > limit
    if (hasMore) posts = posts.slice(0, limit)

    const postsWithUrls = posts.map((post) => ({
      ...post,
      attachments: (post.attachments ?? []).map((attachment: AttachmentWithMedia) => ({
        ...attachment,
        mediaFile: {
          ...attachment.mediaFile,
          url: getPublicUrl(attachment.mediaFile.storageKey),
        },
      })),
    }))

    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].id : null

    return NextResponse.json({
      posts: postsWithUrls,
      nextCursor,
      hasMore,
      totalCount: undefined,
    })
  } catch (error) {
    console.error("Failed to fetch public posts:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to fetch public posts", details: errorMessage },
      { status: 500 }
    )
  }
}

