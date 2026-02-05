import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserId = session.user.id

    // Get all members except current user
    const members = await prisma.user.findMany({
      where: { id: { not: currentUserId } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      orderBy: { name: "asc" },
    })

    // Get counts of posts shared WITH each member (posts I authored, shared with them)
    const sharedWithThem = await prisma.postShare.groupBy({
      by: ["userId"],
      where: {
        post: { authorId: currentUserId },
        userId: { not: currentUserId },
      },
      _count: { id: true },
    })

    // Get counts of posts shared WITH me by each member (posts they authored, shared with me)
    const sharedWithMe = await prisma.postShare.groupBy({
      by: ["userId"],
      where: {
        userId: currentUserId,
      },
      _count: { id: true },
    })

    // Build a map of authorId -> count for sharedWithMe
    const sharedWithMeByAuthor = new Map<string, number>()
    if (sharedWithMe.length > 0) {
      // We need to resolve which author shared each post with me
      const postsSharedWithMe = await prisma.postShare.findMany({
        where: { userId: currentUserId },
        select: {
          post: {
            select: { authorId: true },
          },
        },
      })
      for (const share of postsSharedWithMe) {
        const authorId = share.post.authorId
        if (authorId !== currentUserId) {
          sharedWithMeByAuthor.set(
            authorId,
            (sharedWithMeByAuthor.get(authorId) || 0) + 1
          )
        }
      }
    }

    // Build lookup for sharedWithThem
    const sharedWithThemMap = new Map<string, number>()
    for (const entry of sharedWithThem) {
      sharedWithThemMap.set(entry.userId, entry._count.id)
    }

    const membersWithSharing = members.map((member) => ({
      ...member,
      sharedWithThemCount: sharedWithThemMap.get(member.id) || 0,
      sharedWithMeCount: sharedWithMeByAuthor.get(member.id) || 0,
    }))

    return NextResponse.json({ members: membersWithSharing })
  } catch (error) {
    console.error("Failed to fetch members with sharing:", error)
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    )
  }
}
