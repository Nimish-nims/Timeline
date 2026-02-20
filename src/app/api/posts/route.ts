import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getMentionNamesFromHtml } from "@/lib/mentions"
import { getPublicUrl } from "@/lib/supabase"

// Attachment shape for response typing (Prisma generated types may omit relation)
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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    const folderIdParam = searchParams.get('folderId')
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50)

    // When filtering by folder, restrict to current user's folder/posts
    let folderWhere: Record<string, unknown> | undefined
    if (folderIdParam === 'uncategorized' || folderIdParam === '') {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      folderWhere = { folderId: null, authorId: session.user.id }
    } else if (folderIdParam) {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const folder = await prisma.folder.findFirst({
        where: { id: folderIdParam, userId: session.user.id }
      })
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 })
      }
      folderWhere = { folderId: folderIdParam }
    }

    // Build where clause (tag + folder)
    const where = {
      ...(tag ? {
        tags: {
          some: {
            name: tag.toLowerCase()
          }
        }
      } : {}),
      ...(folderWhere || {})
    }
    const hasWhere = Object.keys(where).length > 0
    const finalWhere = hasWhere ? where : undefined

    // Get total count for display
    let totalCount = 0
    try {
      totalCount = await prisma.post.count({ where: finalWhere })
    } catch {
      // If count fails, continue without it
    }

    // First, try to get posts with all relations (folder include may be typed as never if client is stale)
    type PostListItem = Awaited<ReturnType<typeof prisma.post.findMany>>[number] & {
      attachments?: AttachmentWithMedia[]
    }
    let posts: PostListItem[]
    try {
      const findManyArgs = {
        where: finalWhere,
        take: limit + 1,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
          tags: { select: { id: true, name: true } },
          shares: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
          mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
          attachments: {
            include: {
              mediaFile: {
                select: {
                  id: true,
                  fileName: true,
                  fileSize: true,
                  mimeType: true,
                  storageKey: true,
                  thumbnailUrl: true
                }
              }
            }
          },
          _count: { select: { comments: true } },
          folder: true
        },
        orderBy: { createdAt: 'desc' as const }
      }
      posts = await prisma.post.findMany(findManyArgs as Parameters<typeof prisma.post.findMany>[0]) as PostListItem[]
    } catch (relationError) {
      // Fallback: try without relations if they don't exist yet
      console.warn("Failed to fetch with relations, trying simple query:", relationError)
      const fallbackPosts = await prisma.post.findMany({
        where: finalWhere,
        take: limit + 1,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor }
        }),
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      // Add empty arrays and folder for missing relations
      posts = fallbackPosts.map(post => ({
        ...post,
        tags: [],
        shares: [],
        mentions: [],
        attachments: [] as AttachmentWithMedia[],
        folder: null as { id: string; name: string } | null,
        _count: { comments: 0 }
      })) as PostListItem[]
    }

    // Check if there are more posts
    const hasMore = posts.length > limit
    if (hasMore) {
      posts = posts.slice(0, limit) // Remove the extra post
    }

    // Add URLs to attachments
    const postsWithUrls = posts.map(post => ({
      ...post,
      attachments: (post.attachments ?? []).map((attachment: AttachmentWithMedia) => ({
        ...attachment,
        mediaFile: {
          ...attachment.mediaFile,
          url: getPublicUrl(attachment.mediaFile.storageKey)
        }
      }))
    }))

    // Get the cursor for the next page
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].id : null

    return NextResponse.json({
      posts: postsWithUrls,
      nextCursor,
      hasMore,
      totalCount
    })
  } catch (error) {
    console.error("Failed to fetch posts:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      error: "Failed to fetch posts",
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, content, tags, folderId: requestFolderId, attachmentIds } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Validate folderId if provided
    let folderId: string | null = null
    if (requestFolderId != null && requestFolderId !== '') {
      const folder = await prisma.folder.findFirst({
        where: { id: requestFolderId, userId: session.user.id }
      })
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 400 })
      }
      folderId = folder.id
    }

    // Process tags - create if they don't exist
    const tagConnections = []
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagName of tags) {
        const normalizedName = tagName.trim().toLowerCase()
        if (normalizedName) {
          // Upsert the tag
          const tag = await prisma.tag.upsert({
            where: { name: normalizedName },
            update: {},
            create: { name: normalizedName }
          })
          tagConnections.push({ id: tag.id })
        }
      }
    }

    // Validate and process attachments
    const attachmentConnections = []
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      // Verify all media files exist and belong to the user
      const mediaFiles = await prisma.mediaFile.findMany({
        where: {
          id: { in: attachmentIds },
          uploaderId: session.user.id
        },
        select: { id: true }
      })
      const validIds = mediaFiles.map(m => m.id)
      attachmentConnections.push(...validIds.map(id => ({ id })))
    }

    // Use minimal include so create succeeds even if PostMention/Notification tables don't exist yet
    const createData = {
      title: title?.trim() || null,
      content,
      authorId: session.user.id,
      folderId,
      tags: {
        connect: tagConnections
      },
      ...(attachmentConnections.length > 0 && {
        attachments: {
          create: attachmentConnections.map(({ id: mediaFileId }) => ({ mediaFileId }))
        }
      })
    }
    const post = await prisma.post.create({
      data: createData as Parameters<typeof prisma.post.create>[0]['data'],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        tags: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: { comments: true }
        }
      }
    })

    // Parse mentions from content and create PostMention records + notifications for tagged users
    const mentionNames = getMentionNamesFromHtml(content)
    const authorId = session.user.id
    if (mentionNames.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { name: { in: mentionNames } },
          select: { id: true }
        })
        const userIds = [...new Set(users.map(u => u.id))]
        if (userIds.length > 0) {
          await prisma.postMention.createMany({
            data: userIds.map(userId => ({ postId: post.id, userId })),
            skipDuplicates: true
          })
          // Notify each mentioned user (except the author) - don't fail post creation if this fails
          try {
            for (const userId of userIds) {
              if (userId === authorId) continue
              const exists = await prisma.notification.findFirst({
                where: { userId, postId: post.id, type: 'mention' }
              })
              if (!exists) {
                await prisma.notification.create({
                  data: {
                    type: 'mention',
                    userId,
                    actorId: authorId,
                    postId: post.id
                  }
                })
              }
            }
          } catch (notifErr) {
            console.warn('Failed to create mention notifications (post still saved):', notifErr)
          }
        }
      } catch (mentionErr) {
        console.warn('Failed to process mentions (post still saved):', mentionErr)
      }
    }

    // Re-fetch with shares/mentions if we added mentions (don't fail response if this fails)
    let postToReturn: typeof post & { shares?: unknown[]; mentions?: unknown[]; attachments?: unknown[] } = {
      ...post,
      shares: [],
      mentions: [],
      attachments: []
    }
    if (mentionNames.length > 0 || attachmentConnections.length > 0) {
      try {
        const refetched = await prisma.post.findUnique({
          where: { id: post.id },
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
            tags: { select: { id: true, name: true } },
            shares: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            attachments: {
              include: {
                mediaFile: {
                  select: {
                    id: true,
                    fileName: true,
                    fileSize: true,
                    mimeType: true,
                    storageKey: true,
                    thumbnailUrl: true
                  }
                }
              }
            },
            _count: { select: { comments: true } }
          }
        } as Parameters<typeof prisma.post.findUnique>[0])
        type RefetchedWithAttachments = NonNullable<typeof refetched> & { attachments?: AttachmentWithMedia[] }
        const refetchedTyped = refetched as RefetchedWithAttachments | null
        if (refetchedTyped) {
          postToReturn = {
            ...refetchedTyped,
            attachments: (refetchedTyped.attachments ?? []).map((attachment: AttachmentWithMedia) => ({
              ...attachment,
              mediaFile: {
                ...attachment.mediaFile,
                url: getPublicUrl(attachment.mediaFile.storageKey)
              }
            }))
          } as typeof postToReturn
        }
      } catch (_) {
        // keep postToReturn with empty shares/mentions/attachments
      }
    } else if (attachmentConnections.length > 0) {
      // Post was created with attachments but we didn't refetch; create response with URLs from linked media
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: attachmentConnections.map(({ id }) => id) } },
        select: { id: true, fileName: true, fileSize: true, mimeType: true, storageKey: true, thumbnailUrl: true }
      })
      postToReturn.attachments = mediaFiles.map(mf => ({
        mediaFile: { ...mf, url: getPublicUrl(mf.storageKey) }
      }))
    }

    return NextResponse.json(postToReturn)
  } catch (error) {
    console.error("Failed to create post:", error)
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
  }
}
