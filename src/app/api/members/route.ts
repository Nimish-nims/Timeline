import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
