import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: {
        name: 'asc'
      },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error("Failed to fetch tags:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await request.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 })
    }

    const normalizedName = name.trim().toLowerCase()

    if (normalizedName.length === 0) {
      return NextResponse.json({ error: "Tag name cannot be empty" }, { status: 400 })
    }

    // Check if tag already exists
    let tag = await prisma.tag.findUnique({
      where: { name: normalizedName }
    })

    if (!tag) {
      tag = await prisma.tag.create({
        data: { name: normalizedName }
      })
    }

    return NextResponse.json(tag)
  } catch (error) {
    console.error("Failed to create tag:", error)
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
