import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase, MEDIA_BUCKET } from "@/lib/supabase"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Media storage not configured" }, { status: 503 })
    }
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id },
    })

    if (!mediaFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (mediaFile.uploaderId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([mediaFile.storageKey])

    if (storageError) {
      console.error("Failed to delete from storage:", storageError)
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete from database (cascades to MediaShare)
    await prisma.mediaFile.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete media file:", error)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
