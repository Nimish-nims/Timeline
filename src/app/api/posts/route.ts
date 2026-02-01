import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getMentionNamesFromHtml } from "@/lib/mentions"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')

    // First, try to get posts with all relations
    // If that fails, fall back to a simpler query
    let posts
    try {
      posts = await prisma.post.findMany({
        where: tag ? {
          tags: {
            some: {
              name: tag.toLowerCase()
            }
          }
        } : undefined,
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
          mentions: {
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    } catch (relationError) {
      // Fallback: try without relations if they don't exist yet
      console.warn("Failed to fetch with relations, trying simple query:", relationError)
      posts = await prisma.post.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      // Add empty arrays for missing relations
      posts = posts.map(post => ({
        ...post,
        tags: [],
        shares: [],
        mentions: [],
        _count: { comments: 0 }
      }))
    }

    return NextResponse.json(posts)
  } catch (error) {
    console.error("Failed to fetch posts:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      error: "Failed to fetch posts",
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, content, tags } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Process tags - create if they don't exist
    const tagConnections = []
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagName of tags) {
        const normalizedName = tagName.trim().toLowerCase()
        if (normalizedName) {
          // Upsert the tag
          const tag = await prisma.tag.upsert({
            where: { name: normalizedName },
            update: {},
            create: { name: normalizedName }
          })
          tagConnections.push({ id: tag.id })
        }
      }
    }

    const post = await prisma.post.create({
      data: {
        title: title?.trim() || null,
        content,
        authorId: session.user.id,
        tags: {
          connect: tagConnections
        }
      },
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
        mentions: {
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
    })

    // Parse mentions from content and create PostMention records
    const mentionNames = getMentionNamesFromHtml(content)
    if (mentionNames.length > 0) {
      const users = await prisma.user.findMany({
        where: { name: { in: mentionNames } },
        select: { id: true }
      })
      const userIds = [...new Set(users.map(u => u.id))]
      if (userIds.length > 0) {
        await prisma.postMention.createMany({
          data: userIds.map(userId => ({ postId: post.id, userId })),
          skipDuplicates: true
        })
      }
    }

    // Re-fetch with mentions if we added any
    const postWithMentions = mentionNames.length > 0
      ? await prisma.post.findUnique({
          where: { id: post.id },
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
            tags: { select: { id: true, name: true } },
            shares: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            _count: { select: { comments: true } }
          }
        })
      : post

    return NextResponse.json(postWithMentions ?? post)
  } catch (error) {
    console.error("Failed to create post:", error)
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
  }
}
