/**
 * Eddyter API key: use env override, otherwise localhost key only for literal localhost/127.0.0.1,
 * and production key for all other origins (LAN IP, deployed host, etc.).
 */
const EDDYTER_KEY_LOCALHOST =
  'eddyt_T0fqjed5hfyKVbvrXoL7X6KrYKB72EFhGZOQb39l6QACJYSY6hECmyXR7Gn7MZHhpKZadicS7IT8AFLeRLsrHjjHQH'
const EDDYTER_KEY_PRODUCTION =
  'eddyt_T0fqjed5hfyKVbvrXoL7X6KrYKB72EFhGZOQb39l6QACJYSY6hECmyXR7Gn7MZHhpKZadicS7IT8AFLeRLsrHjjHQH'

function isLocalhostOrigin(): boolean {
  if (typeof window === 'undefined') return process.env.NODE_ENV === 'development'
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

export function getEddyterApiKey(): string {
  const envKey = process.env.NEXT_PUBLIC_EDDYTER_API_KEY
  if (envKey && envKey.trim()) return envKey.trim()
  return isLocalhostOrigin() ? EDDYTER_KEY_LOCALHOST : EDDYTER_KEY_PRODUCTION
}
