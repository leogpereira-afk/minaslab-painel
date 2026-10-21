import { comCracha, mensagemDoStatus } from '../lib/sessao.js';

const ENDPOINT = 'https://heveemylixartyijxewh.supabase.co/functions/v1/ml-marketing';
export async function chamarMarketing(action, extra = {}) {
  let resposta;
  try {
    resposta = await comCracha(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra, action }) });
  } catch { throw new Error('Não foi possível consultar Marketing. Confira sua conexão e tente novamente.'); }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || dados?.ok !== true) throw new Error(dados?.erro || (resposta.status === 404 ? 'A integração de Marketing ainda não foi publicada no servidor.' : mensagemDoStatus(resposta.status)));
  return dados;
}
