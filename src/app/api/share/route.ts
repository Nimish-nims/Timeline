import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Get current user's share settings
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        isPublic: true,
        publicSlug: true,
        id: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      isPublic: user.isPublic,
      publicSlug: user.publicSlug || user.id,
      shareUrl: user.isPublic ? `/u/${user.publicSlug || user.id}` : null
    })
  } catch (error) {
    console.error("Failed to get share settings:", error)
    return NextResponse.json({ error: "Failed to get share settings" }, { status: 500 })
  }
}

// POST - Toggle public sharing
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { isPublic, publicSlug } = await request.json()

    // If setting a custom slug, check if it's available
    if (publicSlug) {
      const existingUser = await prisma.user.findUnique({
        where: { publicSlug }
      })
      
      if (existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json({ error: "This URL is already taken" }, { status: 400 })
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isPublic: isPublic ?? false,
        publicSlug: publicSlug || null,
      },
      select: {
        isPublic: true,
        publicSlug: true,
        id: true,
      }
    })

    return NextResponse.json({
      isPublic: user.isPublic,
      publicSlug: user.publicSlug || user.id,
      shareUrl: user.isPublic ? `/u/${user.publicSlug || user.id}` : null
    })
  } catch (error) {
    console.error("Failed to update share settings:", error)
    return NextResponse.json({ error: "Failed to update share settings" }, { status: 500 })
  }
}


