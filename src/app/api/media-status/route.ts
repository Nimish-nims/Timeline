import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/media-status
 * Returns whether media storage is configured (for debugging env vars).
 * Does not expose secret values.
 * (Path is /api/media-status to avoid being matched by /api/media/[id] as id="status".)
 */
export async function GET() {
  const hasUrl = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" && process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0
  const hasKey = typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0
  return NextResponse.json({
    storageConfigured: !!supabase,
    env: {
      hasUrl,
      hasKey,
      hint: !hasUrl || !hasKey
        ? "In Vercel: set NEXT_PUBLIC_SUPABASE_URL (Project URL) and SUPABASE_SERVICE_ROLE_KEY (use the 'service_role' key from Supabase → Project Settings → API, not the anon key). Then redeploy."
        : "Env vars present; if storageConfigured is false, check that values are non-empty and redeployed.",
    },
  })
}
