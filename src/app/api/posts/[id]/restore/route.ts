import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { historyId } = await request.json()

    if (!historyId) {
      return NextResponse.json({ error: "History ID required" }, { status: 400 })
    }

    const post = await prisma.post.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can restore
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get the history entry to restore
    const historyEntry = await prisma.postHistory.findUnique({
      where: { id: historyId }
    })

    if (!historyEntry || historyEntry.postId !== id) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 })
    }

    // Save current version to history before restoring
    await prisma.postHistory.create({
      data: {
        postId: post.id,
        title: post.title,
        content: post.content,
      }
    })

    // Restore the post to the historical version
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        title: historyEntry.title,
        content: historyEntry.content,
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
        shares: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            }
          }
        },
        _count: {
          select: { comments: true }
        }
      }
    })

    return NextResponse.json(updatedPost)
  } catch (error) {
    console.error("Failed to restore post:", error)
    return NextResponse.json({ error: "Failed to restore post" }, { status: 500 })
  }
}
