import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Resend } from "resend"
import { hash } from "bcryptjs"

const resend = new Resend(process.env.RESEND_API_KEY)
const DEFAULT_PASSWORD = "12345678"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can view all invitations
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invitations = await prisma.invitation.findMany({
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error("Failed to fetch invitations:", error)
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can create invitations
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    // Check if invitation already exists and is not expired
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        used: false,
        expiresAt: { gt: new Date() }
      }
    })

    if (existingInvitation) {
      return NextResponse.json({
        error: "An active invitation already exists for this email",
        invitation: existingInvitation
      }, { status: 400 })
    }

    // Hash the default password
    const hashedPassword = await hash(DEFAULT_PASSWORD, 12)

    // Extract name from email (part before @)
    const name = email.split('@')[0]

    // Create the user directly with default password
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "member",
      }
    })

    // Get the base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      request.headers.get("origin") || 
      "http://localhost:3000"
    
    const loginUrl = `${baseUrl}/login`

    // Send welcome email
    try {
      await resend.emails.send({
        from: "Timeline <onboarding@resend.dev>",
        to: email,
        subject: "Welcome to Timeline - Your Account is Ready!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Timeline! 🎉</h2>
            <p>Hi ${name},</p>
            <p>You've been invited to join Timeline by ${session.user.name || session.user.email}.</p>
            <p>Your account has been created with the following credentials:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> ${DEFAULT_PASSWORD}</p>
            </div>
            <p>Please change your password after your first login.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #0070f3; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Login Now
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">Timeline App</p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      defaultPassword: DEFAULT_PASSWORD,
    })
  } catch (error) {
    console.error("Failed to create invitation:", error)
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }
}
