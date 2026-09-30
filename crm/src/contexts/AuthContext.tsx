import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

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

type AuthContextValue = {
  session: Session | null
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
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Set<PermissionCode>>(new Set())
  const [permissionLoading, setPermissionLoading] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) console.error('Falha ao recuperar sessão do Supabase:', error.message)
      setSession(data.session)
      setAuthLoading(false)
    })

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

        return { error: null }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error(error.message)
      },
    }),
    [
      session,
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
