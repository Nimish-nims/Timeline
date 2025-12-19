import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, token } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    let isFirstUser = false
    let role = "member"

    // Check if this is the first user (they become admin)
    const userCount = await prisma.user.count()
    if (userCount === 0) {
      isFirstUser = true
      role = "admin"
    } else {
      // Not first user - require valid invitation
      if (!token) {
        return NextResponse.json(
          { error: "Invitation token is required" },
          { status: 400 }
        )
      }

      const invitation = await prisma.invitation.findUnique({
        where: { token }
      })

      if (!invitation) {
        return NextResponse.json(
          { error: "Invalid invitation token" },
          { status: 400 }
        )
      }

      if (invitation.used) {
        return NextResponse.json(
          { error: "Invitation has already been used" },
          { status: 400 }
        )
      }

      if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invitation has expired" },
          { status: 400 }
        )
      }

      if (invitation.email !== email) {
        return NextResponse.json(
          { error: "Email does not match invitation" },
          { status: 400 }
        )
      }

      // Mark invitation as used
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { used: true }
      })
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      }
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isFirstUser,
    })
  } catch (error) {
    console.error("Failed to register:", error)
    return NextResponse.json(
      { error: "Failed to register" },
      { status: 500 }
    )
  }
}
