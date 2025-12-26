import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Get public timeline by user slug or ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Try to find user by publicSlug first, then by ID
    let user = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: {
        id: true,
        name: true,
        image: true,
        isPublic: true,
        createdAt: true,
      }
    })

    // If not found by slug, try by ID
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: slug },
        select: {
          id: true,
          name: true,
          image: true,
          isPublic: true,
          createdAt: true,
        }
      })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if profile is public
    if (!user.isPublic) {
      return NextResponse.json({ error: "This timeline is private" }, { status: 403 })
    }

    // Get user's posts
    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      user: {
        name: user.name,
        image: user.image,
        memberSince: user.createdAt,
      },
      posts,
      totalPosts: posts.length,
    })
  } catch (error) {
    console.error("Failed to fetch public timeline:", error)
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 })
  }
}



