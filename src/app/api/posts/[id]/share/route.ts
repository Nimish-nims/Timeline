import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET - Get all users a post is shared with
export async function GET(
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
      where: { id },
      include: {
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
        }
      }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can see share list
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(post.shares.map(s => s.user))
  } catch (error) {
    console.error("Failed to get post shares:", error)
    return NextResponse.json({ error: "Failed to get post shares" }, { status: 500 })
  }
}

// POST - Share a post with users
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
    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "userIds array is required" }, { status: 400 })
    }

    const post = await prisma.post.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can share the post
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create shares for each user (skip if already shared)
    const shares = await Promise.all(
      userIds.map(async (userId: string) => {
        // Don't share with the author
        if (userId === post.authorId) return null

        try {
          return await prisma.postShare.upsert({
            where: {
              postId_userId: {
                postId: id,
                userId: userId
              }
            },
            update: {},
            create: {
              postId: id,
              userId: userId
            },
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
          })
        } catch {
          return null
        }
      })
    )

    const validShares = shares.filter(s => s !== null)

    return NextResponse.json(validShares.map(s => s.user))
  } catch (error) {
    console.error("Failed to share post:", error)
    return NextResponse.json({ error: "Failed to share post" }, { status: 500 })
  }
}

// DELETE - Remove a user from post shares
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const post = await prisma.post.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Only author or admin can remove shares
    if (post.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.postShare.delete({
      where: {
        postId_userId: {
          postId: id,
          userId: userId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove post share:", error)
    return NextResponse.json({ error: "Failed to remove post share" }, { status: 500 })
  }
}
