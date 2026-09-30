import { Outlet } from 'react-router-dom'
import { PermissionDenied } from '../components/ui/States'
import { useAuth } from '../hooks/useAuth'
import type { PermissionCode } from '../contexts/AuthContext'

export function PermissionRoute({ anyOf }: { anyOf: PermissionCode[] }) {
  const { loading, permissionError, hasPermission } = useAuth()
  if (loading) return <div className="grid min-h-[40vh] place-items-center text-sm text-slate-500">Validando permissão...</div>
  if (permissionError) return <PermissionDenied />
  if (!anyOf.some(hasPermission)) return <PermissionDenied />
  return <Outlet />
}
