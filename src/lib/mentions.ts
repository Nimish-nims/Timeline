/**
 * Extract unique display names from HTML content that contains Eddyter/Lexical mention nodes.
 * Mentions are stored as data-lexical-mention-name="Display Name".
 */
export function getMentionNamesFromHtml(html: string): string[] {
  if (!html || typeof html !== 'string') return []
  const regex = /data-lexical-mention-name="([^"]+)"/g
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const name = match[1]?.trim()
    if (name) names.add(name)
  }
  return Array.from(names)
}
