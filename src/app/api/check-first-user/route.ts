import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const userCount = await prisma.user.count()
    return NextResponse.json({ isFirstUser: userCount === 0 })
  } catch (error) {
    console.error("Failed to check first user:", error)
    return NextResponse.json({ isFirstUser: false })
  }
}
