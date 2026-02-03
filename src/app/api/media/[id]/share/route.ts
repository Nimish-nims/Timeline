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

    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id },
      include: {
        shares: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    })

    if (!mediaFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (mediaFile.uploaderId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(mediaFile.shares.map((s) => s.user))
  } catch (error) {
    console.error("Failed to get media shares:", error)
    return NextResponse.json({ error: "Failed to get shares" }, { status: 500 })
  }
}

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

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "userIds array is required" }, { status: 400 })
    }

    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id },
    })

    if (!mediaFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (mediaFile.uploaderId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create shares, skipping the uploader
    for (const userId of userIds) {
      if (userId === mediaFile.uploaderId) continue
      await prisma.mediaShare.upsert({
        where: {
          mediaFileId_userId: {
            mediaFileId: id,
            userId,
          },
        },
        update: {},
        create: {
          mediaFileId: id,
          userId,
        },
      })
    }

    // Return updated share list
    const shares = await prisma.mediaShare.findMany({
      where: { mediaFileId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return NextResponse.json(shares.map((s) => s.user))
  } catch (error) {
    console.error("Failed to share media file:", error)
    return NextResponse.json({ error: "Failed to share file" }, { status: 500 })
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id },
    })

    if (!mediaFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (mediaFile.uploaderId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.mediaShare.delete({
      where: {
        mediaFileId_userId: {
          mediaFileId: id,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to unshare media file:", error)
    return NextResponse.json({ error: "Failed to unshare file" }, { status: 500 })
  }
}
