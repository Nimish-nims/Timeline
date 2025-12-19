import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import crypto from "crypto"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Delete any existing reset tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email },
    })

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        email,
        token,
        expiresAt,
      },
    })

    // In a real app, you would send an email here
    // For now, we'll just return the token (in production, remove this!)
    console.log(`Password reset link: /reset-password?token=${token}`)

    return NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
      // Remove this in production - only for demo purposes
      resetLink: `/reset-password?token=${token}`,
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
