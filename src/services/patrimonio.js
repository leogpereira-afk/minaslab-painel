import { API } from '../lib/api.js';
import { comCracha, mensagemDoStatus } from '../lib/sessao.js';

export async function chamarPatrimonio(action, campos = {}) {
  const r = await comCracha(`${API}/ml-patrimonio`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...campos }),
  });
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.erro || mensagemDoStatus(r.status));
  if (!b?.ok) throw new Error('O servidor não confirmou a operação. Atualize e confira.');
  return b;
}
export const lerBens = () => chamarPatrimonio('listar', { tipo: 'bem' }).then(r => r.valor);
export const lerSetores = () => chamarPatrimonio('listar', { tipo: 'setor' }).then(r => r.valor);
export const salvarBem = (id, dados) => chamarPatrimonio('salvar', { tipo: 'bem', id, dados }).then(r => r.valor);
export const salvarSetor = (id, dados) => chamarPatrimonio('salvar', { tipo: 'setor', id, dados }).then(r => r.valor);
export const removerBem = id => chamarPatrimonio('remover', { tipo: 'bem', id });
export const removerSetor = id => chamarPatrimonio('remover', { tipo: 'setor', id });
export const semearSetores = lista => chamarPatrimonio('setoresIniciais', { lista }).then(r => r.valor);
