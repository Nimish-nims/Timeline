import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const folder = await prisma.folder.findFirst({
      where: { id, userId: session.user.id },
      include: {
        _count: { select: { posts: true } },
        children: {
          orderBy: { name: "asc" },
          include: { _count: { select: { posts: true } } }
        }
      }
    })

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    return NextResponse.json(folder)
  } catch (error) {
    console.error("Failed to fetch folder:", error)
    return NextResponse.json({ error: "Failed to fetch folder" }, { status: 500 })
  }
}

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
    const body = await request.json()
    const name = typeof body?.name === "string" ? body.name.trim() : undefined
    const parentId = body?.parentId !== undefined
      ? (typeof body.parentId === "string" ? body.parentId : null)
      : undefined

    const existing = await prisma.folder.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return NextResponse.json({ error: "Folder cannot be its own parent" }, { status: 400 })
      }
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId: session.user.id }
      })
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
      }
    }

    const folder = await prisma.folder.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId })
      },
      include: {
        _count: { select: { posts: true } }
      }
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error("Failed to update folder:", error)
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.folder.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    await prisma.folder.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete folder:", error)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}
