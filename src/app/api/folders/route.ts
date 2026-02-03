import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const folders = await prisma.folder.findMany({
      where: { userId: session.user.id },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    return NextResponse.json(folders)
  } catch (error) {
    console.error("Failed to fetch folders:", error)
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const parentId = typeof body?.parentId === "string" ? body.parentId : undefined

    if (!name) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId: session.user.id }
      })
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        userId: session.user.id,
        parentId: parentId || null
      },
      include: {
        _count: { select: { posts: true } }
      }
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error("Failed to create folder:", error)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}
