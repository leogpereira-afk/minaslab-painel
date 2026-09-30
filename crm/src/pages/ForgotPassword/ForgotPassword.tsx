import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getPasswordResetUrl } from '../../config/auth'
import { AuthLayout } from '../../layouts/AuthLayout'
import { supabase } from '../../services/supabase'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setErrorMessage('Informe o e-mail cadastrado.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordResetUrl(),
      })

      if (error) {
        console.error('password-recovery-request-failed', {
          status: error.status,
          code: error.code,
          message: error.message,
        })

        if (error.status === 429) {
          setErrorMessage('Limite temporário de e-mails atingido. Aguarde alguns minutos e tente novamente.')
          return
        }

        setErrorMessage('Não foi possível enviar o e-mail de recuperação. Tente novamente.')
        return
      }

      setSuccessMessage('Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.')
    } catch (error) {
      console.error('password-recovery-unexpected-error', error)
      setErrorMessage('Não foi possível enviar o e-mail de recuperação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="text-sm font-medium text-slate-500">MinasLab</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Recuperar senha</h1>
          <p className="mt-2 text-sm text-slate-500">
            Informe seu e-mail para receber o link de recuperação.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="usuario@minaslab.online"
            />
          </label>

          {errorMessage && (
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
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900">
            Voltar ao login
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
