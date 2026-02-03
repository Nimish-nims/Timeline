import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { supabase, MEDIA_BUCKET, MAX_FILE_SIZE, isAllowedMimeType, getPublicUrl } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const uploaded = []
    const errors = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push({ fileName: file.name, error: "File exceeds 50MB limit" })
        continue
      }

      if (!isAllowedMimeType(file.type)) {
        errors.push({ fileName: file.name, error: "File type not allowed" })
        continue
      }

      const fileId = crypto.randomUUID()
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storageKey = `${session.user.id}/${fileId}-${sanitized}`

      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storageKey, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        errors.push({ fileName: file.name, error: uploadError.message })
        continue
      }

      const mediaFile = await prisma.mediaFile.create({
        data: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storageKey,
          thumbnailUrl: file.type.startsWith("image/") ? getPublicUrl(storageKey) : null,
          uploaderId: session.user.id,
        },
        include: {
          uploader: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { shares: true } },
        },
      })

      uploaded.push({
        ...mediaFile,
        url: getPublicUrl(storageKey),
      })
    }

    return NextResponse.json({ uploaded, errors })
  } catch (error) {
    console.error("Failed to upload files:", error)
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 })
  }
}
