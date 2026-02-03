import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Resend } from "resend"
import crypto from "crypto"

// Force dynamic rendering - never statically generate
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
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
      where: { email: trimmedEmail },
    })

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        email: trimmedEmail,
        token,
        expiresAt,
      },
    })

    // Build reset link (path only; frontend can prepend origin)
    const resetPath = `/reset-password?token=${token}`

    // Try to send email via Resend when configured
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey && resendApiKey.length > 0) {
      try {
        const resend = new Resend(resendApiKey)
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          request.headers.get("origin") ||
          "http://localhost:3000"
        const resetLink = `${baseUrl}${resetPath}`

        await resend.emails.send({
          from: "Timeline <onboarding@resend.dev>",
          to: trimmedEmail,
          subject: "Reset Your Password",
          html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetLink}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Timeline App</p>
        </div>
      `,
        })
      } catch (sendError) {
        console.error("Forgot password: email send failed", sendError)
        // Don't fail the request; return link so user can still reset
      }
    }

    // Always return success and the reset path when we created a token, so the UI can show the link
    // when email isn't configured or failed (e.g. no RESEND_API_KEY on Vercel)
    return NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
      resetLink: resetPath,
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
