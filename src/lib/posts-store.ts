import { v4 as uuidv4 } from 'uuid'

export interface Post {
  id: string
  content: string
  authorName: string
  authorAvatar?: string
  createdAt: Date
}

const STORAGE_KEY = 'timeline-posts'

export function getPosts(): Post[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []

  try {
    const posts = JSON.parse(stored)
    return posts.map((post: Post) => ({
      ...post,
      createdAt: new Date(post.createdAt)
    })).sort((a: Post, b: Post) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch {
    return []
  }
}

export function addPost(content: string, authorName: string = 'Anonymous User'): Post {
  const posts = getPosts()

  const newPost: Post = {
    id: uuidv4(),
    content,
    authorName,
    createdAt: new Date()
  }

  posts.unshift(newPost)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))

  return newPost
}

export function deletePost(id: string): void {
  const posts = getPosts().filter(post => post.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export function updatePost(id: string, content: string): Post | null {
  const posts = getPosts()
  const postIndex = posts.findIndex(post => post.id === id)

  if (postIndex === -1) return null

  posts[postIndex] = {
    ...posts[postIndex],
    content
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  return posts[postIndex]
}

export function clearAllPosts(): void {
  localStorage.removeItem(STORAGE_KEY)
}
