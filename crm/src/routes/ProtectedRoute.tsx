import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute() {
  const { session, profile, loading, profileError, permissionError, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">Validando acesso...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profileError || permissionError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Acesso não autorizado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Não foi possível validar o perfil de acesso deste usuário.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  if (!profile.ativo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Usuário inativo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Seu acesso está inativo. Procure um administrador do CRM para reativar o usuário.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
