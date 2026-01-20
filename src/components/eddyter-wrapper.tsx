"use client"

import React, { useEffect, useState } from 'react'
import {
  ConfigurableEditorWithAuth,
  EditorProvider,
  defaultEditorConfig
} from 'eddyter'
import 'eddyter/style.css'

interface EddyterWrapperProps {
  onChange: (html: string) => void
  placeholder?: string
  initialContent?: string
}

export default function EddyterWrapper({
  onChange,
  placeholder = "Start typing...",
  initialContent = ""
}: EddyterWrapperProps) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  // API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_EDDYTER_API_KEY || ''

  // Debug: Log API key status (not the actual key)
  useEffect(() => {
    if (isClient) {
      console.log('[Eddyter] API Key present:', !!apiKey, 'Length:', apiKey.length)
    }
  }, [isClient, apiKey])

  if (!isClient) {
    return (
      <div className="eddyter-container min-h-[150px] flex items-center justify-center">
        <span className="text-muted-foreground">Loading editor...</span>
      </div>
    )
  }

  return (
    <div className="eddyter-container min-h-[150px] w-full" style={{ width: '100%', maxWidth: 'none' }} suppressHydrationWarning>
      <EditorProvider
        defaultFontFamilies={defaultEditorConfig.defaultFontFamilies}
        apiKey={apiKey}
      >
        <ConfigurableEditorWithAuth
          apiKey={apiKey}
          onChange={onChange}
          initialContent={initialContent || `<p>${placeholder}</p>`}
          onAuthSuccess={() => {
            console.log('[Eddyter] Authentication successful')
          }}
          onAuthError={(error) => {
            console.error('[Eddyter] Authentication error:', error)
          }}
        />
      </EditorProvider>
    </div>
  )
}





