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
export const salvarMelhoria = (id, status) => chamar("melhoria", { id, status });
export const salvarTratativa = (id, dados) => chamar("tratativa", { id, ...dados });

// Link público que o cliente abre (página /pesquisa/ do próprio painel).
export const linkPesquisa = (token) => `${window.location.origin}${import.meta.env.BASE_URL}pesquisa/?t=${token}`;
export const mensagemPesquisa = (link) => `Olá! Aqui é da MinasLab. Sua opinião é muito importante para nós: poderia responder nossa pesquisa de satisfação? Leva cerca de 2 minutos.\n${link}`;
