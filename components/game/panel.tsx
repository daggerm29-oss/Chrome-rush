'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface PanelProps {
  title: string
  onClose?: () => void
  children: React.ReactNode
  wide?: boolean
}

export function Panel({ title, onClose, children, wide }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-night/70 p-3 backdrop-blur-sm safe-pad">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`glass animate-pop-in flex max-h-full w-full flex-col overflow-hidden rounded-2xl outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
