'use client'

import { useEffect } from 'react'

/**
 * Patches the Eddyter @mention dropdown to show user image or initials instead of the generic icon.
 * Eddyter only accepts a list of names; we observe the DOM for the mention menu and replace the icon with avatar/initials.
 */

export interface MemberForMention {
  id: string
  name: string
  image?: string | null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function patchMentionList(menuEl: Element, members: MemberForMention[]): void {
  const ul = menuEl.querySelector('ul')
  if (!ul) return
  const nameToMember = new Map(members.map((m) => [m.name.trim(), m]))
  const items = ul.querySelectorAll('li[role="option"]')
  items.forEach((li) => {
    const textSpan = li.querySelector('.text')
    const name = textSpan?.textContent?.trim()
    if (!name) return
    const member = nameToMember.get(name)
    const firstChild = li.firstElementChild
    if (!firstChild) return
    const wrapper = document.createElement('span')
    wrapper.className = 'mention-avatar-wrapper'
    wrapper.setAttribute('style', 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;overflow:hidden;flex-shrink:0;background:hsl(var(--muted));font-size:11px;font-weight:600;color:hsl(var(--muted-foreground));')
    if (member?.image) {
      const img = document.createElement('img')
      img.src = member.image
      img.alt = member.name
      img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;')
      wrapper.appendChild(img)
    } else {
      wrapper.textContent = getInitials(member?.name ?? name)
    }
    firstChild.replaceWith(wrapper)
  })
}

export function useMentionMenuAvatars(members: MemberForMention[]): void {
  useEffect(() => {
    if (typeof window === 'undefined' || members.length === 0) return

    const run = (): void => {
      const menu = document.querySelector('.mentions-menu')
      if (menu && !(menu as HTMLElement).dataset?.avatarsPatched) {
        ;(menu as HTMLElement).dataset.avatarsPatched = '1'
        patchMentionList(menu, members)
      }
    }

    const observer = new MutationObserver(run)
    observer.observe(document.body, { childList: true, subtree: true })
    run()

    return () => observer.disconnect()
  }, [members])
}
