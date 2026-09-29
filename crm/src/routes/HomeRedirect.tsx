import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function HomeRedirect() {
  const { loading, hasPermission } = useAuth()
  if (loading) return <div className="grid min-h-[40vh] place-items-center text-sm text-slate-500">Preparando acesso...</div>
  if (hasPermission('crm.read') || hasPermission('operational.read')) return <Navigate to="/dashboard" replace />
  if (hasPermission('imports.manage')) return <Navigate to="/importacoes" replace />
  if (hasPermission('admin.manage')) return <Navigate to="/configuracoes" replace />
  if (hasPermission('audit.read')) return <Navigate to="/auditoria" replace />
  return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-semibold">Sem módulos disponíveis</h2><p className="mt-2 text-sm text-slate-500">O usuário está autenticado, mas não possui uma permissão de módulo ativa.</p></div>
}
