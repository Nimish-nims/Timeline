import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get('authorId')

    // Find all posts shared with the current user
    const sharedPosts = await prisma.postShare.findMany({
      where: {
        userId: session.user.id,
        ...(authorId && {
          post: {
            authorId: authorId
          }
        })
      },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              }
            },
            tags: {
              select: {
                id: true,
                name: true,
              }
            },
            shares: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  }
                }
              }
            },
            _count: {
              select: { comments: true }
            }
          }
        }
      },
      orderBy: {
        sharedAt: 'desc'
      }
    })

    // Extract unique authors for filtering
    const authorsMap = new Map<string, { id: string; name: string; image: string | null }>()
    sharedPosts.forEach(share => {
      const author = share.post.author
      if (!authorsMap.has(author.id)) {
        authorsMap.set(author.id, {
          id: author.id,
          name: author.name,
          image: author.image
        })
      }
    })

    const posts = sharedPosts.map(share => ({
      ...share.post,
      sharedAt: share.sharedAt
    }))

    const authors = Array.from(authorsMap.values())

    return NextResponse.json({ posts, authors })
  } catch (error) {
    console.error("Failed to fetch shared posts:", error)
    return NextResponse.json({ error: "Failed to fetch shared posts" }, { status: 500 })
  }
}
