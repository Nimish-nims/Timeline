"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  ConfigurableEditorWithAuth,
  EditorProvider,
  defaultEditorConfig
} from 'eddyter'
import 'eddyter/style.css'
import { Zap, Clock } from 'lucide-react'

interface EddyterWrapperProps {
  onChange: (html: string) => void
  placeholder?: string
  initialContent?: string
  /** List of user display names for @mention suggestions in the editor */
  mentionUserList?: string[]
  /** Whether to show load time indicator (default: true) */
  showLoadTime?: boolean
  /** Callback when editor is ready with load time in ms */
  onReady?: (loadTimeMs: number) => void
}

export default function EddyterWrapper({
  onChange,
  placeholder = "Start typing...",
  initialContent = "",
  mentionUserList = [],
  showLoadTime = true,
  onReady
}: EddyterWrapperProps) {
  const [isClient, setIsClient] = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const mountTimeRef = useRef<number>(performance.now())
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    mountTimeRef.current = performance.now()
    setIsClient(true)
  }, [])

  // API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_EDDYTER_API_KEY || ''

  // Detect when ProseMirror editor is actually rendered and interactive
  useEffect(() => {
    if (!isClient || isReady) return

    const checkEditorReady = () => {
      const editorEl = containerRef.current?.querySelector('.ProseMirror')
      if (editorEl && editorEl.getAttribute('contenteditable') === 'true') {
        const duration = performance.now() - mountTimeRef.current
        setLoadTime(duration)
        setIsReady(true)
        onReady?.(duration)
        console.log(`[Eddyter] Editor ready in ${duration.toFixed(0)}ms`)
        return true
      }
      return false
    }

    // Check immediately
    if (checkEditorReady()) return

    // Use MutationObserver to detect when editor appears
    const observer = new MutationObserver(() => {
      if (checkEditorReady()) {
        observer.disconnect()
      }
    })

    if (containerRef.current) {
      observer.observe(containerRef.current, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['contenteditable']
      })
    }

    // Fallback timeout check
    const interval = setInterval(() => {
      if (checkEditorReady()) {
        clearInterval(interval)
      }
    }, 100)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [isClient, isReady, onReady])

  // Debug: Log API key status (not the actual key)
  useEffect(() => {
    if (isClient) {
      console.log('[Eddyter] API Key present:', !!apiKey, 'Length:', apiKey.length)
    }
  }, [isClient, apiKey])

  const handleAuthSuccess = useCallback(() => {
    console.log('[Eddyter] Authentication successful')
  }, [])

  const handleAuthError = useCallback((error: string) => {
    console.error('[Eddyter] Authentication error:', error)
  }, [])

  // Get load time color based on performance
  const getLoadTimeColor = (ms: number) => {
    if (ms < 500) return 'text-green-500'
    if (ms < 1000) return 'text-yellow-500'
    return 'text-orange-500'
  }

  const getLoadTimeLabel = (ms: number) => {
    if (ms < 500) return 'Fast'
    if (ms < 1000) return 'Good'
    if (ms < 2000) return 'Slow'
    return 'Very Slow'
  }

  if (!isClient) {
    return (
      <div className="eddyter-container min-h-[150px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Loading editor...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className="eddyter-container min-h-[150px] w-full" 
        style={{ width: '100%', maxWidth: 'none' }} 
        suppressHydrationWarning
      >
        <EditorProvider
          defaultFontFamilies={defaultEditorConfig.defaultFontFamilies}
          apiKey={apiKey}
          mentionUserList={mentionUserList}
        >
          <ConfigurableEditorWithAuth
            apiKey={apiKey}
            onChange={onChange}
            initialContent={initialContent || `<p>${placeholder}</p>`}
            mentionUserList={mentionUserList}
            onAuthSuccess={handleAuthSuccess}
            onAuthError={handleAuthError}
          />
        </EditorProvider>
      </div>
      
      {/* Load Time Indicator */}
      {showLoadTime && loadTime !== null && (
        <div 
          className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/80 backdrop-blur-sm border border-border/50 transition-opacity duration-300"
          title={`Editor loaded in ${loadTime.toFixed(0)}ms`}
        >
          <Zap className={`h-3 w-3 ${getLoadTimeColor(loadTime)}`} />
          <span className={`font-medium ${getLoadTimeColor(loadTime)}`}>
            {loadTime.toFixed(0)}ms
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            ({getLoadTimeLabel(loadTime)})
          </span>
        </div>
      )}
    </div>
  )
}





