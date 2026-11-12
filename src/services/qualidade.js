// Porta de dados de Laboratório › Qualidade: Edge Function ml-qualidade (crachá do painel,
// permissão "laboratorio" ou "laboratorio/qualidade"). Mesmos dados da Pesquisa de satisfação do CRM.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";
import { mensagemAmigavel } from "../lib/errosAmigaveis.js";

async function chamar(acao, corpo = {}) {
  const resp = await comCracha(`${API}/ml-qualidade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro ? mensagemAmigavel(body.erro) : mensagemDoStatus(resp.status));
  return body;
}

export const lerSatisfacao = () => chamar("satisfacao");
export const vinculosCliente = (cliente_id) => chamar("vinculos", { cliente_id });
export const enviarPesquisa = (dados) => chamar("enviar", dados);
export const trocarCanal = (id, canal, destino) => chamar("canal", { id, canal, destino });
export const cancelarEnvio = (id) => chamar("cancelar", { id });
// extras: { acao, responsavel, prazo, retorno_cliente } — a melhoria vira tratativa (tipo MELHORIA); devolve { tratativaId }.
// "acao" é o nome da ação da chamada: o texto da ação da melhoria vai como "acao_melhoria".
export const salvarMelhoria = (id, status, { acao, ...extras } = {}) => chamar("melhoria", { ...extras, id, status, acao_melhoria: acao });
export const salvarTratativa = (id, dados) => chamar("tratativa", { id, ...dados });
export const salvarPergunta = (dados) => chamar("perguntaSalvar", dados);
export const ordenarPerguntas = (ids) => chamar("perguntasOrdem", { ids });
export const salvarRevisao = (revisao) => chamar("revisao", { revisao });

// Demais páginas da Qualidade (documentos, equipamentos, NC, auditorias, proficiência, indicadores).
export const lerQualidade = () => chamar("qualidade");
export const salvarRegistro = (modulo, registro) => chamar("salvar", { modulo, registro }).then((r) => r.registro);
export const excluirRegistro = (modulo, id) => chamar("excluir", { modulo, id });
export const confirmarLeitura = (id) => chamar("ler", { id });
export const verificarExternos = (ids, data) => chamar("verificarExternos", { ids, data });
export const registrarCalibracao = (dados) => chamar("calibrar", dados);
export const salvarMeta = (chave, meta) => chamar("metaSalvar", { chave, meta });
export const enviarArquivo = (ref_tipo, ref_id, nome, base64) => chamar("arquivoEnviar", { ref_tipo, ref_id, nome, base64 }).then((r) => r.arquivo);
export const baixarArquivo = (id) => chamar("arquivoBaixar", { id });
export const apagarArquivo = (id) => chamar("arquivoApagar", { id });

// Link público que o cliente abre (página /pesquisa/ do próprio painel).
export const linkPesquisa = (token) => `${window.location.origin}${import.meta.env.BASE_URL}pesquisa/?t=${token}`;
export const mensagemPesquisa = (link) => `Olá! Aqui é da MinasLab. Sua opinião é muito importante para nós: poderia responder nossa pesquisa de satisfação? Leva cerca de 2 minutos.\n${link}`;
