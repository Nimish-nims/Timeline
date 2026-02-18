import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPublicUrl } from "@/lib/supabase"

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

    // Try full query first, fallback to minimal if mentions/shares tables don't exist
    let post
    try {
      post = await prisma.post.findUnique({
        where: { id },
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
          attachments: {
            include: {
              mediaFile: {
                select: {
                  id: true,
                  fileName: true,
                  fileSize: true,
                  mimeType: true,
                  storageKey: true,
                  thumbnailUrl: true
                }
              }
            }
          },
          comments: {
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
              createdAt: 'asc'
            }
          },
          _count: {
            select: { comments: true }
          }
        }
      })
    } catch (relationErr) {
      // Fallback: try without mentions/shares if those tables don't exist
      console.warn("Failed to fetch post with all relations, trying minimal:", relationErr)
      const minimalPost = await prisma.post.findUnique({
        where: { id },
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
          comments: {
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
              createdAt: 'asc'
            }
          },
          _count: {
            select: { comments: true }
          }
        }
      })
      if (minimalPost) {
        post = {
          ...minimalPost,
          shares: [],
          mentions: [],
          attachments: []
        }
      }
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user has access to this post
    const isAuthor = post.authorId === session.user.id
    const shares = (post as { shares?: { userId: string }[] }).shares ?? []
    const isSharedWith = shares.some(share => share.userId === session.user.id)
    const isAdmin = session.user.role === 'admin'

    if (!isAuthor && !isSharedWith && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Add URLs to attachments
    const postWithUrls = {
      ...post,
      attachments: post.attachments?.map(attachment => ({
        ...attachment,
        mediaFile: {
          ...attachment.mediaFile,
          url: getPublicUrl(attachment.mediaFile.storageKey)
        }
      })) || []
    }

    return NextResponse.json(postWithUrls)
  } catch (error) {
    console.error("Failed to fetch post:", error)
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 })
  }
}
