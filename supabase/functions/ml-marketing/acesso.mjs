// O emissor MinasLab valida a assinatura; a conta atual confirma a permissão.
// Nenhuma chave compartilhada ou credencial da Central vai para o navegador.
export const EMISSOR = 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-sync';
export class ErroAcesso extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}
export async function autorizar(authorization, fetcher = fetch, agora = Date.now()) {
  if (!/^Bearer [A-Za-z0-9_.-]{30,8000}$/.test(authorization || '')) throw new ErroAcesso(401, 'Entre no painel MinasLab.');
  let resposta;
  try {
    resposta = await fetcher(EMISSOR, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'contasListar' }) });
  } catch { throw new ErroAcesso(503, 'Não foi possível confirmar seu acesso. Tente novamente.'); }
  if (!resposta.ok) throw new ErroAcesso(resposta.status === 401 ? 401 : resposta.status === 403 ? 403 : 503, resposta.status === 403 ? 'Os indicadores e as conexões são exclusivos da direção.' : 'Não foi possível confirmar seu acesso.');
  let conta, claims;
  try {
    const corpo = await resposta.json();
    const parte = authorization.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parte), c => c.charCodeAt(0))));
    conta = corpo.contas?.find(c => c.usuario === claims.sub);
  } catch { throw new ErroAcesso(401, 'Sessão inválida. Entre novamente.'); }
  if (claims.sis !== 'minaslab' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= agora) throw new ErroAcesso(401, 'Sua sessão expirou. Entre novamente.');
  // Fail closed inclusive para conta apagada, rebaixada ou desativada.
  if (claims.papel !== 'direcao' || conta?.papel !== 'direcao' || conta?.ativo !== true) throw new ErroAcesso(403, 'Os indicadores e as conexões são exclusivos da direção.');
  return { usuario: conta.usuario };
}
export function validarPedido(body) {
  if (!body || typeof body !== 'object' || (body.empresa && body.empresa !== 'minaslab')) throw new ErroAcesso(400, 'Empresa inválida.');
  if (!['painel', 'listar', 'vincular', 'coletar'].includes(body.action)) throw new ErroAcesso(400, 'Ação inválida.');
  if (body.action !== 'painel' && !['ga4', 'search', 'perfil', 'instagram', 'google_ads', 'meta_ads'].includes(body.fonte)) throw new ErroAcesso(400, 'Canal inválido.');
  if (body.action === 'vincular' && (typeof body.ativo !== 'string' || !body.ativo || body.ativo.length > 250)) throw new ErroAcesso(400, 'Selecione uma conta válida.');
  return body;
}
