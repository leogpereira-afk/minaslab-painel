import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../layouts/AuthLayout'
import { useAuth } from '../../hooks/useAuth'

type LoginLocationState = {
  from?: {
    pathname?: string
    search?: string
    hash?: string
  }
}

export function Login() {
  const { session, profile, loading, profileError, signIn, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const state = location.state as LoginLocationState | null
  const fromPath =
    state?.from?.pathname && state.from.pathname !== '/login'
      ? `${state.from.pathname}${state.from.search ?? ''}${state.from.hash ?? ''}`
      : '/dashboard'

  useEffect(() => {
    if (loading || !session) return

    if (profile?.ativo) {
      navigate(fromPath, { replace: true })
      return
    }

    if (profile && !profile.ativo) {
      setErrorMessage('Este usuário está inativo. Procure um administrador do CRM.')
      void signOut()
      return
    }

    if (profileError) {
      setErrorMessage(profileError)
      void signOut()
    }
  }, [loading, session, profile, profileError, signOut, navigate, fromPath])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setErrorMessage('Informe o e-mail e a senha.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await signIn(normalizedEmail, password)

      if (result.error) {
        setErrorMessage(result.error)
      }
    } catch {
      setErrorMessage('Não foi possível realizar o login. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && session && profile?.ativo) {
    return <Navigate to={fromPath} replace />
  }

  return (
    <AuthLayout>
      <section className="rounded-[24px] border border-[#dce6e7] bg-white px-7 py-9 shadow-[0_16px_45px_rgba(25,62,67,0.12)] sm:px-11 sm:py-11">
        <header className="mb-9 text-center">
          <img
            src={`${import.meta.env.BASE_URL}favicon-crm.svg`}
            alt=""
            aria-hidden="true"
            className="mx-auto h-[76px] w-[76px] rounded-[22px] shadow-sm"
          />
          <img
            src={`${import.meta.env.BASE_URL}minaslab-logo.svg`}
            alt="MinasLab"
            className="mx-auto mt-5 h-11 w-auto max-w-[230px] object-contain"
          />
          <h1 className="mt-2 text-xl font-semibold text-[#294d59]">CRM MinasLab 2.0</h1>
          <p className="mt-1 text-sm text-slate-500">Gestão comercial e operacional</p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-[15px] font-semibold text-[#294d59]">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              className="mt-2 h-[58px] w-full rounded-2xl border border-[#9eb3bb] bg-[#eef4fb] px-5 text-base text-slate-900 outline-none transition focus:border-[#08a99e] focus:bg-white focus:ring-4 focus:ring-[#08a99e]/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="usuario@minaslab.com.br"
            />
          </label>

          <label className="block text-[15px] font-semibold text-[#294d59]">
            Senha
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="mt-2 h-[58px] w-full rounded-2xl border border-[#9eb3bb] bg-[#eef4fb] px-5 text-base text-slate-900 outline-none transition focus:border-[#08a99e] focus:bg-white focus:ring-4 focus:ring-[#08a99e]/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="••••••••"
            />
          </label>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#078c86] transition hover:text-[#063f46] hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="h-14 w-full rounded-2xl bg-[#78bdb7] px-4 text-base font-bold text-white shadow-sm transition hover:bg-[#08a99e] focus:outline-none focus:ring-4 focus:ring-[#08a99e]/20 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>

      <p className="mt-5 text-center text-xs text-slate-400">
        Acesso restrito à equipe autorizada da MinasLab
      </p>
    </AuthLayout>
  )
}
