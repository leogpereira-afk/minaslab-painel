import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius-modal)] border border-border-ui bg-surface shadow-[var(--shadow-modal)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-ui bg-surface px-6 py-4">
          <h2 className="ds-section-title">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-500 transition hover:bg-surface-muted hover:text-ink-800" aria-label="Fechar">
            <X className="h-5 w-5"/>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
