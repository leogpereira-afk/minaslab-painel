import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { chamarSso, loginProprioAtivo, marcarLoginProprio, ssoAtivo, tokenDoPainel, urlDoPainel } from '../services/painelSso'

export type AuthProfile = {
  id: string
  nome: string | null
  ativo: boolean
  avatar_url: string | null
}

export type PermissionCode =
  | 'admin.manage'
  | 'audit.read'
  | 'crm.deactivate'
  | 'crm.read'
  | 'crm.write'
  | 'imports.manage'
  | 'operational.import'
  | 'operational.read'

const KNOWN_PERMISSIONS: PermissionCode[] = [
  'admin.manage',
  'audit.read',
  'crm.deactivate',
  'crm.read',
  'crm.write',
  'imports.manage',
  'operational.import',
  'operational.read',
]

const KNOWN_PERMISSION_SET = new Set<string>(KNOWN_PERMISSIONS)

type SignInResult = { error: string | null }

// Situação da entrada pelo painel: 'verificando' enquanto confere; 'sem_painel' quando não há login no painel;
// 'bloqueado' quando há login no painel mas o servidor não liberou o CRM (mensagem explica).
export type EstadoSso = { fase: 'verificando' | 'pronto' | 'sem_painel' | 'bloqueado'; mensagem?: string }

type AuthContextValue = {
  session: Session | null
  sso: EstadoSso
  profile: AuthProfile | null
  permissions: Set<PermissionCode>
  loading: boolean
  profileError: string | null
  permissionError: string | null
  hasPermission: (permission: PermissionCode) => boolean
  refreshPermissions: () => Promise<void>
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [sso, setSso] = useState<EstadoSso>({ fase: 'verificando' })
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Set<PermissionCode>>(new Set())
  const [permissionLoading, setPermissionLoading] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

       async function iniciar() {
      const { data, error } = await supabase.auth.getSession()
      if (error) console.error('Falha ao recuperar sessão do Supabase:', error.message)
      let atual = data.session

      // Entrada única: o login vale o do painel. Quem entrou pelo e-mail (porta de emergência) fica como está.
      if (ssoAtivo() && !loginProprioAtivo()) {
        const token = tokenDoPainel()
        if (!token) {
          // Sem login no painel não há CRM: encerra qualquer sessão antiga deste navegador.
          if (atual) await supabase.auth.signOut({ scope: 'local' })
          atual = null
          if (mounted) setSso({ fase: 'sem_painel' })
        } else {
          const quem = await chamarSso('quem', token)
          if (quem.ok) {
            if (!atual || atual.user.id !== quem.crmUserId) {
              const entrada = await chamarSso('entrar', token)
              if (entrada.ok && entrada.tokenHash) {
                const { data: aberta, error: erroOtp } = await supabase.auth.verifyOtp({ token_hash: entrada.tokenHash, type: 'magiclink' })
                if (erroOtp || !aberta.session) {
                  console.error('Falha ao abrir a sessão do CRM pelo painel:', erroOtp?.message)
                  atual = null
                  if (mounted) setSso({ fase: 'bloqueado', mensagem: 'Não foi possível abrir o CRM com o login do painel agora. Tente de novo em instantes.' })
                } else {
                  atual = aberta.session
                  if (mounted) setSso({ fase: 'pronto' })
                }
              } else {
                atual = null
                if (mounted) setSso(entrada.semSessao ? { fase: 'sem_painel' } : { fase: 'bloqueado', mensagem: entrada.erro })
              }
            } else if (mounted) {
              setSso({ fase: 'pronto' })
            }
          } else {
            // Crachá do painel vencido: volta ao painel. Outros motivos (sem vínculo, sem acesso) são explicados na tela.
            if (atual) await supabase.auth.signOut({ scope: 'local' })
            atual = null
            if (mounted) setSso(quem.semSessao ? { fase: 'sem_painel' } : { fase: 'bloqueado', mensagem: quem.erro })
          }
        }
      } else if (mounted) {
        setSso({ fase: 'pronto' })
      }

      if (!mounted) return
      setSession(atual)
      setAuthLoading(false)
    }
    void iniciar()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile() {
    if (!session?.user.id) {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    setProfileError(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('id,nome,ativo,avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('Falha ao carregar perfil do usuário:', error.message)
      setProfile(null)
      setProfileError('Não foi possível validar o perfil do usuário.')
      setProfileLoading(false)
      return
    }

    if (!data) {
      setProfile(null)
      setProfileError('Perfil de acesso não encontrado.')
      setProfileLoading(false)
      return
    }

    setProfile({ id: data.id, nome: data.nome, ativo: data.ativo, avatar_url: data.avatar_url })
    setProfileLoading(false)
  }

  useEffect(() => {
    void refreshProfile()
  }, [session?.user.id])

  async function refreshPermissions() {
    if (!session?.user.id || !profile?.ativo) {
      setPermissions(new Set())
      setPermissionError(null)
      setPermissionLoading(false)
      return
    }

    setPermissionLoading(true)
    setPermissionError(null)

    const { data, error } = await supabase.rpc('get_my_permissions')

    if (error) {
      console.error('Falha ao carregar permissões:', error.message)
      setPermissions(new Set())
      setPermissionError('Não foi possível validar as permissões do usuário.')
      setPermissionLoading(false)
      return
    }

    const allowedPermissions = (Array.isArray(data) ? data : [])
      .map((permission) => String(permission))
      .filter((permission): permission is PermissionCode => KNOWN_PERMISSION_SET.has(permission))

    setPermissions(new Set(allowedPermissions))
    setPermissionLoading(false)
  }

  useEffect(() => {
    void refreshPermissions()
  }, [session?.user.id, profile?.id, profile?.ativo])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      sso,
      profile,
      permissions,
      loading: authLoading || profileLoading || permissionLoading,
      profileError,
      permissionError,
      hasPermission: (permission) => permissions.has(permission),
      refreshPermissions,
      refreshProfile,
      signIn: async (email, password) => {
        const normalizedEmail = email.trim()
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

        if (error) {
          console.error('[CRM-04B] Falha retornada pelo Supabase Auth:', {
            name: error.name,
            message: error.message,
            status: error.status,
            code: error.code,
          })
          const invalidCredentials =
            error.code === 'invalid_credentials' ||
            error.message.toLowerCase().includes('invalid login credentials')

          return {
            error: invalidCredentials
              ? 'E-mail ou senha inválidos.'
              : 'Não foi possível conectar ao serviço de autenticação. Verifique a configuração local e tente novamente.',
          }
        }

        marcarLoginProprio(true)
        return { error: null }
      },
      signOut: async () => {
        marcarLoginProprio(false)
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error(error.message)
        // Login unificado: sair do CRM volta ao painel (é lá que se entra e sai).
        if (ssoAtivo()) window.location.replace(urlDoPainel())
      },
    }),
    [
      session,
      sso,
      profile,
      permissions,
      authLoading,
      profileLoading,
      permissionLoading,
      profileError,
      permissionError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
