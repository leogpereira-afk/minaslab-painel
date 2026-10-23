// Entrada única: o CRM não pede login, ele usa a sessão do painel.
//
// O painel e o CRM são publicados no mesmo endereço (.../minaslab-painel/ e .../minaslab-painel/crm/),
// então o crachá do painel (guardado no navegador) é visível aqui. A função crm-sso confere o crachá
// no servidor e entrega um token de uso único; o CRM troca esse token por uma sessão do Supabase Auth.
// Em desenvolvimento local (base '/') nada disso roda: vale o login normal por e-mail.

const CHAVE_CRACHA_PAINEL = 'ml_auth_token'
// Marca de quem entrou pelo formulário de e-mail e senha: só vale em desenvolvimento local.
const CHAVE_LOGIN_PROPRIO = 'crm_login_proprio'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export type RespostaSso = {
  ok: boolean
  erro?: string
  crmUserId?: string
  tokenHash?: string
  semSessao?: boolean
  semVinculo?: boolean
  semAcesso?: boolean
}

export function ssoAtivo() {
  return import.meta.env.PROD && /\/crm\/?$/.test(import.meta.env.BASE_URL)
}

export function tokenDoPainel() {
  try {
    return localStorage.getItem(CHAVE_CRACHA_PAINEL)
  } catch {
    return null
  }
}

export function urlDoPainel() {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/crm\/?$/, '')}`
}

export function loginProprioAtivo() {
  // Login unificado: publicado, o CRM só abre pelo login do painel. Limpa a marca antiga da porta de e-mail.
  if (ssoAtivo()) {
    try { localStorage.removeItem(CHAVE_LOGIN_PROPRIO) } catch { /* sem armazenamento local */ }
    return false
  }
  try {
    return localStorage.getItem(CHAVE_LOGIN_PROPRIO) === '1'
  } catch {
    return false
  }
}

export function marcarLoginProprio(ativo: boolean) {
  try {
    if (ativo) localStorage.setItem(CHAVE_LOGIN_PROPRIO, '1')
    else localStorage.removeItem(CHAVE_LOGIN_PROPRIO)
  } catch {
    /* sem armazenamento local, segue sem a marca */
  }
}

export async function chamarSso(action: 'quem' | 'entrar', token: string): Promise<RespostaSso> {
  try {
    const resposta = await fetch(`${supabaseUrl}/functions/v1/crm-sso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
      },
      body: JSON.stringify({ action }),
    })
    const corpo = (await resposta.json().catch(() => ({}))) as RespostaSso
    if (!resposta.ok) {
      return { ...corpo, ok: false, semSessao: corpo.semSessao || resposta.status === 401, erro: corpo.erro || 'Não foi possível confirmar seu acesso ao CRM.' }
    }
    return { ...corpo, ok: true }
  } catch {
    return { ok: false, erro: 'Não consegui falar com o servidor. Confira a internet e tente de novo.' }
  }
}
