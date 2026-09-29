import { ShieldCheck } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { UserAvatar } from '../../components/users/UserAvatar'
import { useAuth } from '../../hooks/useAuth'

export function MeuPerfil(){
  const{profile,session}=useAuth()
  return <PageShell title="Meu perfil" description="Sua identificação no CRM.">
    <section className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <UserAvatar name={profile?.nome} avatarUrl={profile?.avatar_url} size="lg" className="h-28 w-28"/>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800">{profile?.nome||'Usuário'}</h2>
          <p className="mt-1 text-sm text-slate-500">{session?.user.email||''}</p>
          <div className="mt-5 flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/>
            <div><strong>Foto protegida pelo administrador.</strong><p className="mt-1 text-teal-800">A foto de perfil é somente para visualização nesta tela. Para manter a identificação padronizada da equipe, somente o administrador pode adicionar, alterar ou remover fotos em Administração → Acessos e Configurações → Acessos / Usuários.</p></div>
          </div>
        </div>
      </div>
    </section>
  </PageShell>
}
