"use client"

import * as React from "react"
import { Download, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ImageViewerProps {
  src: string
  alt?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageViewer({ src, alt, open, onOpenChange }: ImageViewerProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Extract filename from URL or use a default
      const filename = src.split('/').pop()?.split('?')[0] || 'image'
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      // Fallback: open image in new tab if download fails
      window.open(src, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-auto p-0 bg-black/95 border-none overflow-hidden"
        showCloseButton={false}
      >
        <div className="relative flex flex-col items-center justify-center min-h-[200px]">
          {/* Action buttons */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <DialogClose asChild>
              <Button
                variant="secondary"
                size="icon"
                className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm h-9 w-9"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          {/* Image */}
          <img
            src={src}
            alt={alt || "Image preview"}
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Alt text caption */}
          {alt && (
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-white/70 text-sm bg-black/50 px-3 py-1.5 rounded-md inline-block backdrop-blur-sm">
                {alt}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ClickableContentProps {
  html: string
  className?: string
}

export function ClickableContent({ html, className }: ClickableContentProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [viewerState, setViewerState] = React.useState<{
    open: boolean
    src: string
    alt: string
  }>({
    open: false,
    src: '',
    alt: ''
  })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG') {
        e.preventDefault()
        e.stopPropagation()
        const img = target as HTMLImageElement
        setViewerState({
          open: true,
          src: img.src,
          alt: img.alt || ''
        })
      }
    }

    // Add click handler to all images
    container.addEventListener('click', handleClick)

    // Add cursor pointer style to images
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      img.style.cursor = 'pointer'
    })

    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [html])

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ImageViewer
        src={viewerState.src}
        alt={viewerState.alt}
        open={viewerState.open}
        onOpenChange={(open) => setViewerState(prev => ({ ...prev, open }))}
      />
    </>
  )
}
