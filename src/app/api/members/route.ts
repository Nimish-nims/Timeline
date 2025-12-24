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
    const fetchAll = searchParams.get('all') === 'true'

    if (fetchAll) {
      // Fetch all members with email for share dialog
      const members = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
        orderBy: {
          name: 'asc'
        }
      })
      return NextResponse.json({ members })
    }

    // Get member count and list of recent members
    const [count, members] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          image: true,
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5 // Show last 5 members
      })
    ])

    return NextResponse.json({ count, members })
  } catch (error) {
    console.error("Failed to fetch members:", error)
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
  }
}
