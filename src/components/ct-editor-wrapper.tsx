"use client"

import React from 'react'
import {
  ConfigurableEditorWithAuth,
  EditorProvider,
  defaultEditorConfig
} from 'ct-rich-text-editor'
import 'ct-rich-text-editor/style.css'

interface CTEditorWrapperProps {
  onChange: (html: string) => void
  placeholder?: string
  initialContent?: string
}

export default function CTEditorWrapper({
  onChange,
  placeholder = "Start typing...",
  initialContent = ""
}: CTEditorWrapperProps) {
  // You can get an API key from https://www.cteditor.com/user/license-key
  // For demo purposes, using empty string works but limits features
  const apiKey = process.env.NEXT_PUBLIC_CT_EDITOR_API_KEY || ''

  return (
    <div className="ct-editor-container min-h-[150px]">
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
