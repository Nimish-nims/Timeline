/**
 * Eddyter API key: use env override, otherwise localhost key only for literal localhost/127.0.0.1,
 * and production key for all other origins (LAN IP, deployed host, etc.).
 */
const EDDYTER_KEY_LOCALHOST =
  'eddyt_ykh2O1sDA3imtPR6JmFPU8rRtVS6ox1SbD5ZSw3drG40F0EiZiJyu88ZZXAvLc8OnwRk6BIV6tEw9z7NDab4vqFQGD'
const EDDYTER_KEY_PRODUCTION =
  'eddyt_G5kIEFdUbyoy419G2wTRKURNnETqnK033MAPq43K8tsKpazKg2CeGhMlyXtl6Wx2cij5TujjaUZWMYKZj67NCPQSzF'

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
