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

    const { id: memberId } = await params
    const currentUserId = session.user.id

    // Posts I authored that are shared with this member
    const sharedWithThem = await prisma.postShare.findMany({
      where: {
        userId: memberId,
        post: { authorId: currentUserId },
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, image: true },
            },
            tags: {
              select: { id: true, name: true },
            },
            _count: { select: { comments: true } },
          },
        },
      },
      orderBy: { sharedAt: "desc" },
    })

    // Posts this member authored that are shared with me
    const sharedWithMe = await prisma.postShare.findMany({
      where: {
        userId: currentUserId,
        post: { authorId: memberId },
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, image: true },
            },
            tags: {
              select: { id: true, name: true },
            },
            _count: { select: { comments: true } },
          },
        },
      },
      orderBy: { sharedAt: "desc" },
    })

    return NextResponse.json({
      sharedWithThem: sharedWithThem.map((s) => ({
        ...s.post,
        sharedAt: s.sharedAt,
      })),
      sharedWithMe: sharedWithMe.map((s) => ({
        ...s.post,
        sharedAt: s.sharedAt,
      })),
    })
  } catch (error) {
    console.error("Failed to fetch member posts:", error)
    return NextResponse.json(
      { error: "Failed to fetch member posts" },
      { status: 500 }
    )
  }
}
