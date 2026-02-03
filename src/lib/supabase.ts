import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export const MEDIA_BUCKET = 'media'

// Max file size: 50MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'text/',
]

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]

export function isAllowedMimeType(mimeType: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix))) {
    return true
  }
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

export function getPublicUrl(storageKey: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storageKey)
  return data.publicUrl
}
