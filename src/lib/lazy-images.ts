/**
 * Adds loading="lazy" attribute to all <img> tags in HTML content
 * for better performance with infinite scroll
 */
export function addLazyLoadingToImages(html: string): string {
  if (!html || typeof html !== 'string') return html
  
  // Add loading="lazy" to all img tags that don't already have it
  return html.replace(
    /<img(?![^>]*loading=)/gi,
    '<img loading="lazy"'
  )
}
