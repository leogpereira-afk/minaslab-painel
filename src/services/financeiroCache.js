import { FINANCEIRO } from '../lib/api.js';
import { aoMudarSessao, comCracha, getSessao, getToken, mensagemDoStatus } from '../lib/sessao.js';
import { sincronizarCopia } from '../lib/financeiroCache.js';

const BANCO = 'minaslab-financeiro-v1';
const REVISAO = 'ml.financeiro.revisao';
export function invalidarCopiaFinanceira() {
  try { localStorage.setItem(REVISAO, `${Date.now()}-${Math.random()}`); } catch { /* cache may be unavailable */ }
}
function revisao() { try { return localStorage.getItem(REVISAO) || ''; } catch { return ''; } }
function guardar(chave, valor, modo = 'readwrite') {
  return new Promise((resolve, reject) => {
    const abrir = indexedDB.open(BANCO, 1);
    abrir.onupgradeneeded = () => abrir.result.createObjectStore('copias');
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const db = abrir.result, tx = db.transaction('copias', modo), store = tx.objectStore('copias');
      const req = modo === 'readonly' ? store.get(chave) : chave === null ? store.clear() : store.put(valor, chave);
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Não foi possível salvar neste navegador.')); };
    };
  });
}
aoMudarSessao(() => { if (!getToken()) guardar(null).catch(() => {}); });
async function lerCopiaFinanceira({ atualizar = false } = {}) {
  const sessao = getSessao(), token = getToken();
  if (!sessao || sessao.papel !== 'direcao' || !token) throw new Error('Entre novamente para acessar o financeiro.');
  let validade = 0;
  try { validade = Number(JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp) * 1000; } catch { /* invalid token */ }
  if (!validade || validade <= Date.now()) throw new Error("Sua sessão expirou. Entre novamente para acessar o financeiro.");
  const chave = sessao.usuario, versaoLocal = revisao();
  const validarSessao = () => { if (getToken() !== token || validade <= Date.now()) throw new Error('A sessão mudou. Entre novamente.'); };
  let anterior;
  try { anterior = await guardar(chave, null, 'readonly'); } catch { /* still allow online use */ }
  validarSessao();
  if (anterior?.versao !== 1) anterior = null;
  if (anterior && !atualizar && anterior.revisao === versaoLocal) return { ...anterior, salvo: true };
  try {
    const nova = await sincronizarCopia(anterior, async (action, corpo) => {
      const resp = await comCracha(FINANCEIRO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...corpo }) });
      const body = await resp.json();
      if (!resp.ok) { const erro = new Error(body?.erro || mensagemDoStatus(resp.status)); erro.status = resp.status; throw erro; }
      return body;
    });
    validarSessao();
    nova.revisao = versaoLocal;
    let salvo = true;
    try { await guardar(chave, nova); } catch { salvo = false; }
    validarSessao();
    return { ...nova, salvo };
  } catch (erro) {
    validarSessao();
    if (erro.status === 401 || erro.status === 403) { await guardar(null).catch(() => {}); throw erro; }
    if (anterior) return { ...anterior, salvo: true, aviso: `Não foi possível atualizar. Exibindo a última cópia salva. ${erro.message}` };
    throw erro;
  }
}

export async function consultarBaseFinanceira(empresa = '', atualizar = false) {
 const copia = await carregarCopiaFinanceira({atualizar});
 const lista = nome => copia.listas[nome].itens.filter(x=>!empresa||x.empresa_id===empresa);
 return {empresa,opcoes:copia.opcoes,movimentos:lista('movimentosListar'),recebimentos:lista('recebimentosListar'),despesas:lista('despesasListar'),notas:lista('notasListar'),consultadoEm:new Date(copia.atualizadoEm),aviso:copia.aviso||(!copia.salvo?'Não foi possível salvar a cópia neste navegador.':'')};
}

let emCurso = null;
export function carregarCopiaFinanceira(opcoes = {}) {
 const token=getToken();
 if(emCurso?.token===token)return emCurso.tarefa;
 const atual={token};
 atual.tarefa=lerCopiaFinanceira(opcoes).finally(()=>{if(emCurso===atual)emCurso=null;});
 emCurso=atual;
 return atual.tarefa;
}
