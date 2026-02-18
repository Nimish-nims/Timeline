import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getMentionNamesFromHtml } from "@/lib/mentions"
import { getPublicUrl } from "@/lib/supabase"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { title, content, tags, folderId: requestFolderId, attachmentIds } = await request.json()

    const post = await prisma.post.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can edit
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Save current version to history before updating
    await prisma.postHistory.create({
      data: {
        postId: post.id,
        title: post.title,
        content: post.content,
      }
    })

    // Validate folderId if provided
    let folderId: string | null | undefined = undefined
    if (requestFolderId !== undefined) {
      if (requestFolderId == null || requestFolderId === '') {
        folderId = null
      } else {
        const folder = await prisma.folder.findFirst({
          where: { id: requestFolderId, userId: session.user.id }
        })
        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 400 })
        }
        folderId = folder.id
      }
    }

    // Process tags if provided
    const tagConnections = []
    if (tags && Array.isArray(tags)) {
      for (const tagName of tags) {
        const normalizedName = tagName.trim().toLowerCase()
        if (normalizedName) {
          const tag = await prisma.tag.upsert({
            where: { name: normalizedName },
            update: {},
            create: { name: normalizedName }
          })
          tagConnections.push({ id: tag.id })
        }
      }
    }

    // Process attachments if provided
    let attachmentUpdate: { set?: { mediaFileId: string }[] } | undefined = undefined
    if (attachmentIds !== undefined) {
      if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
        // Verify all media files exist and belong to the user
        const mediaFiles = await prisma.mediaFile.findMany({
          where: {
            id: { in: attachmentIds },
            uploaderId: session.user.id
          },
          select: { id: true }
        })
        attachmentUpdate = {
          set: mediaFiles.map(m => ({ mediaFileId: m.id }))
        }
      } else {
        // Empty array means remove all attachments
        attachmentUpdate = { set: [] }
      }
    }

    // Use minimal include so update succeeds even if PostMention table doesn't exist
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title?.trim() || null }),
        content,
        ...(folderId !== undefined && { folderId }),
        ...(tags !== undefined && {
          tags: {
            set: tagConnections
          }
        }),
        ...(attachmentUpdate !== undefined && {
          attachments: attachmentUpdate
        })
      },
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

    // Sync mentions from content and create notifications for newly tagged users (don't fail update if this fails)
    const mentionNames = getMentionNamesFromHtml(content)
    const authorId = session.user.id
    try {
      await prisma.postMention.deleteMany({ where: { postId: id } })
      if (mentionNames.length > 0) {
        const users = await prisma.user.findMany({
          where: { name: { in: mentionNames } },
          select: { id: true }
        })
        const userIds = [...new Set(users.map(u => u.id))]
        if (userIds.length > 0) {
          await prisma.postMention.createMany({
            data: userIds.map(userId => ({ postId: id, userId })),
            skipDuplicates: true
          })
          try {
            for (const userId of userIds) {
              if (userId === authorId) continue
              const exists = await prisma.notification.findFirst({
                where: { userId, postId: id, type: 'mention' }
              })
              if (!exists) {
                await prisma.notification.create({
                  data: {
                    type: 'mention',
                    userId,
                    actorId: authorId,
                    postId: id
                  }
                })
              }
            }
          } catch (notifErr) {
            console.warn('Failed to create mention notifications (post update still saved):', notifErr)
          }
        }
      }
    } catch (mentionErr) {
      console.warn('Failed to sync mentions (post update still saved):', mentionErr)
    }

    // Re-fetch with shares/mentions (don't fail if tables don't exist)
    let postToReturn: typeof updatedPost & { shares?: unknown[]; mentions?: unknown[] } = {
      ...updatedPost,
      shares: [],
      mentions: []
    }
    try {
      const refetched = await prisma.post.findUnique({
        where: { id },
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
      })
      if (refetched) {
        postToReturn = {
          ...refetched,
          attachments: refetched.attachments?.map(attachment => ({
            ...attachment,
            mediaFile: {
              ...attachment.mediaFile,
              url: getPublicUrl(attachment.mediaFile.storageKey)
            }
          })) || []
        }
      }
    } catch (_) {
      // keep postToReturn with empty shares/mentions/attachments
    }

    return NextResponse.json(postToReturn)
  } catch (error) {
    console.error("Failed to update post:", error)
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const post = await prisma.post.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can delete
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.post.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete post:", error)
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
  }
}
