import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Failed to fetch profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, image } = body

    // Validate image size (base64 can be large)
    if (image && image.length > 500000) { // ~500KB limit
      return NextResponse.json(
        { error: "Image too large. Please use an image under 500KB." },
        { status: 400 }
      )
    }

    const updateData: { name?: string; image?: string | null } = {}

    if (name !== undefined) {
      updateData.name = name
    }

    if (image !== undefined) {
      updateData.image = image // Can be base64 string or null to remove
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Failed to update profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
