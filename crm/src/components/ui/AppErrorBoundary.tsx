import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean; message: string }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, message: error.message || 'Erro inesperado na interface.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado no CRM:', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">O CRM bloqueou uma falha inesperada para evitar uma página em branco. Você pode recarregar e tentar novamente.</p>
          {import.meta.env.DEV && this.state.message && <pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-3 text-left text-xs text-slate-500">{this.state.message}</pre>}
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">
            <RotateCcw className="h-4 w-4" /> Recarregar
          </button>
        </section>
      </main>
    )
  }
}
