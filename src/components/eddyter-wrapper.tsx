"use client"

import React from 'react'
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
  // You can get an API key from the Eddyter dashboard
  // For demo purposes, using empty string works but limits features
  const apiKey = process.env.NEXT_PUBLIC_EDDYTER_API_KEY || ''

  return (
    <div className="eddyter-container min-h-[150px]" suppressHydrationWarning>
      <EditorProvider
        defaultFontFamilies={defaultEditorConfig.defaultFontFamilies}
      >
        <ConfigurableEditorWithAuth
          apiKey={apiKey}
          onChange={onChange}
          initialContent={initialContent || `<p>${placeholder}</p>`}
        />
      </EditorProvider>
    </div>
  )
}





