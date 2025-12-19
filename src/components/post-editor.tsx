"use client"

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Loader2 } from 'lucide-react'

const CTEditorWrapper = dynamic(() => import('./ct-editor-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-[140px] border rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
})

interface PostEditorProps {
  onPost: (content: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PostEditor({ onPost }: PostEditorProps) {
  const { data: session } = useSession()
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const handleContentChange = useCallback((html: string) => {
    setContent(html)
  }, [])

  const handlePost = async () => {
    const strippedContent = content.replace(/<[^>]*>/g, '').trim()
    if (!strippedContent) return

    setIsPosting(true)
    try {
      onPost(content)
      setContent('')
      setEditorKey(prev => prev + 1)
    } finally {
      setIsPosting(false)
    }
  }

  const hasContent = content.replace(/<[^>]*>/g, '').trim().length > 0
  const userName = session?.user?.name || 'User'

  return (
    <Card className="mb-8 border-0 bg-card shadow-md">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-border">
            <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">Create a new post</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-0">
        <CTEditorWrapper
          key={editorKey}
          onChange={handleContentChange}
          placeholder="What's on your mind?"
        />
      </CardContent>
      <CardFooter className="flex items-center justify-between px-6 py-4 border-t mt-4 bg-muted/20">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Rich text formatting available
        </p>
        <Button
          onClick={handlePost}
          disabled={isPosting || !hasContent}
          size="sm"
          className="h-9 px-5 ml-auto"
        >
          {isPosting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
