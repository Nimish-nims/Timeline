import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
        shares: true
      }
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user can view history (author, admin, or shared with)
    const isAuthor = post.authorId === session.user.id
    const isAdmin = session.user.role === "admin"
    const isSharedWith = post.shares.some(share => share.userId === session.user.id)

    if (!isAuthor && !isAdmin && !isSharedWith) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get history entries, most recent first
    const history = await prisma.postHistory.findMany({
      where: { postId: id },
      orderBy: { editedAt: "desc" }
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error("Failed to fetch post history:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
