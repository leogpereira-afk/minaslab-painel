export const COLECAO_DRIVE = 'drive_atalhos';
export const AREAS_DRIVE = ['Geral', 'Administração', 'Laboratório', 'Licitações', 'Marketing', 'Compras', 'Manutenções', 'RH', 'Finanças'];
const HOSTS = new Set(['drive.google.com', 'docs.google.com', 'forms.gle']);
const textoBusca = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

// Mantém resourcekey e a aba da planilha: fazem parte do acesso ao destino.
export function analisarLinkDrive(value) {
  const texto = String(value ?? '').trim();
  if (!texto) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(texto) ? texto : `https://${texto}`);
    if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;
    const pasta = url.pathname.match(/\/folders\/([^/]+)/);
    const arquivo = url.pathname.match(/\/d\/(?:e\/)?([^/]+)/);
    const id = pasta?.[1] || arquivo?.[1] || url.searchParams.get('id');
    const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid');
    const tipo = pasta ? 'Pasta' : /\/spreadsheets\//.test(url.pathname) ? 'Planilha'
      : /\/document\//.test(url.pathname) ? 'Documento' : /\/presentation\//.test(url.pathname) ? 'Apresentação'
        : url.hostname === 'forms.gle' || /\/forms\//.test(url.pathname) ? 'Formulário' : 'Arquivo ou pasta';
    const chave = id ? `${pasta ? 'pasta' : 'arquivo'}:${id}${gid ? `:aba:${gid}` : ''}` : url.href.replace(/\/$/, '');
    return { url: url.href, chave, tipo };
  } catch { return null; }
}

export function validarAtalhoDrive(form, itens = []) {
  const nome = String(form.nome ?? '').trim();
  const descricao = String(form.descricao ?? '').trim();
  if (!nome || nome.length > 120) return { erro: 'Informe um nome com até 120 caracteres.' };
  const link = analisarLinkDrive(form.url);
  if (!link) return { erro: 'Cole um link seguro do Google Drive, Documentos, Planilhas, Apresentações ou Formulários.' };
  if (!AREAS_DRIVE.includes(form.area)) return { erro: 'Escolha uma área para organizar o atalho.' };
  if (descricao.length > 400) return { erro: 'Use até 400 caracteres na descrição.' };
  const repetido = itens.find(item => item.id !== form.id && analisarLinkDrive(item.url)?.chave === link.chave);
  if (repetido) return { erro: `Esse endereço já está no atalho “${repetido.nome}”. Edite o cadastro existente.` };
  return { registro: { ...form, nome, descricao, url: link.url, area: form.area, destaque: form.destaque === true } };
}

export function filtrarAtalhosDrive(itens, { busca = '', area = '', destaques = false } = {}) {
  const termos = textoBusca(busca).trim().split(/\s+/).filter(Boolean);
  return itens.filter(item => (!area || item.area === area) && (!destaques || item.destaque === true)
    && termos.every(t => textoBusca(`${item.nome} ${item.descricao || ''} ${item.area} ${analisarLinkDrive(item.url)?.tipo || ''}`).includes(t)))
    .sort((a, b) => Number(b.destaque === true) - Number(a.destaque === true) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}
