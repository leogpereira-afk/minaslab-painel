import { AlertTriangle, LoaderCircle, LockKeyhole, PackageOpen } from 'lucide-react'

export function Loading() {
  return <div className="grid min-h-[40vh] place-items-center"><div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><LoaderCircle className="h-5 w-5 animate-spin text-[var(--brand-600)]"/>Carregando...</div></div>
}

export function EmptyState({ title = 'Sem dados', description = 'Não há informações para exibir ainda.' }: { title?: string; description?: string }) {
  return <div className="ds-empty-state"><PackageOpen className="ds-state-icon"/><h3 className="ds-state-title">{title}</h3><p className="ds-state-description">{description}</p></div>
}

export function ErrorState({ message = 'Não foi possível carregar esta área.' }: { message?: string }) {
  return <div className="ds-error-state"><AlertTriangle className="ds-state-icon"/><h3 className="ds-state-title">Não foi possível carregar</h3><p className="ds-state-description">{message}</p></div>
}

export function PermissionDenied() {
  return <div className="ds-permission-state"><LockKeyhole className="ds-state-icon"/><h3 className="ds-state-title">Sem permissão</h3><p className="ds-state-description">Seu perfil não possui acesso a esta área.</p></div>
}
