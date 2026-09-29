import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../layouts/AuthLayout'
import { supabase } from '../../services/supabase'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function restoreRecoverySession() {
      const url = new URL(window.location.href)
      const callbackError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
      const isLegacyRecovery = hashParams.get('type') === 'recovery'
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      try {
        if (callbackError) throw new Error(callbackError)

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })
          if (error) throw error
        } else if (isLegacyRecovery && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
        } else {
          throw new Error('Recovery evidence not found')
        }

        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) {
          throw error ?? new Error('Recovery session not found')
        }

        if (mounted) setSessionReady(true)
      } catch (error) {
        console.error('password-recovery-session-failed', error)
        if (mounted) {
          setSessionReady(false)
          setErrorMessage('O link de recuperação é inválido, expirou ou já foi utilizado. Solicite um novo link.')
        }
      } finally {
        window.history.replaceState({}, document.title, `${import.meta.env.BASE_URL}reset-password`)
        if (mounted) setCheckingSession(false)
      }
    }

    void restoreRecoverySession()

    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!sessionReady) {
      setErrorMessage('O link de recuperação é inválido ou expirou. Solicite um novo link.')
      return
    }

    if (password.length < 12) {
      setErrorMessage('A nova senha deve ter pelo menos 12 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        console.error('password-update-failed', {
          status: error.status,
          code: error.code,
          message: error.message,
        })
        setErrorMessage('Não foi possível alterar a senha. Solicite um novo link de recuperação.')
        return
      }

      await supabase.auth.signOut()
      setSuccessMessage('Senha alterada com sucesso. Você já pode voltar ao login e entrar com a nova senha.')
      setPassword('')
      setConfirmPassword('')
      setSessionReady(false)
    } catch (error) {
      console.error('password-update-unexpected-error', error)
      setErrorMessage('Não foi possível alterar a senha. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="text-sm font-medium text-slate-500">MinasLab</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Definir nova senha</h1>
          <p className="mt-2 text-sm text-slate-500">
            Escolha uma nova senha para sua conta do CRM MinasLab.
          </p>
        </div>

        {checkingSession ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Validando link de recuperação...
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Nova senha
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting || !sessionReady}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Confirmar nova senha
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting || !sessionReady}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </label>

            {!sessionReady && !successMessage && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                {errorMessage ?? 'O link de recuperação é inválido ou expirou. Solicite um novo link.'}
              </div>
            )}

            {errorMessage && sessionReady && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !sessionReady}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Alterando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to={sessionReady ? '/login' : '/forgot-password'}
            className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
          >
            {sessionReady ? 'Voltar ao login' : 'Solicitar novo link'}
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
