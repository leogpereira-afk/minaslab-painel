import { FINANCEIRO } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(action, corpo = {}) {
  const resp = await comCracha(FINANCEIRO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body || {};
}

export const financeiroOpcoes = () => chamar("opcoes");
export const financeiroDashboard = (filtros = {}) => chamar("dashboard", filtros);

export const finRecebimentosListar = (empresaId = "") => chamar("recebimentosListar", { empresaId }).then((r) => r.itens || []);
export const finRecebimentoSalvar = (registro) => chamar("recebimentoSalvar", { registro }).then((r) => r.item);
export const finRecebimentoBaixar = (id, valor, dataPagamento, extras = {}) => chamar("recebimentoBaixar", { id, valor, dataPagamento, ...extras }).then((r) => r.item);
export const finRecebimentoExcluir = (id) => chamar("recebimentoExcluir", { id });

export const finDespesasListar = (empresaId = "") => chamar("despesasListar", { empresaId }).then((r) => r.itens || []);
export const finDespesaSalvar = (registro) => chamar("despesaSalvar", { registro }).then((r) => r.item);
export const finDespesaBaixar = (id, valor, dataPagamento, extras = {}) => chamar("despesaBaixar", { id, valor, dataPagamento, ...extras }).then((r) => r.item);
export const finDespesaExcluir = (id) => chamar("despesaExcluir", { id });

export const finNotasListar = (empresaId = "") => chamar("notasListar", { empresaId }).then((r) => r.itens || []);
export const finNotaSalvar = (registro) => chamar("notaSalvar", { registro }).then((r) => r.item);
export const finNotaExcluir = (id) => chamar("notaExcluir", { id });

export const finMovimentosListar = (empresaId = "") => chamar("movimentosListar", { empresaId }).then((r) => r.itens || []);
export const finMovimentosImportar = (empresaId, contaBancariaId, itens) => chamar("movimentosImportar", { empresaId, contaBancariaId, itens });
export const finConciliar = (movimentoId, destino) => chamar("conciliar", { movimentoId, ...destino });

export const finConfigListar = () => chamar("configListar");
export const finCategoriaSalvar = (registro) => chamar("categoriaSalvar", { registro }).then((r) => r.item);
export const finContaSalvar = (registro) => chamar("contaSalvar", { registro }).then((r) => r.item);
export const finCentroSalvar = (registro) => chamar("centroSalvar", { registro }).then((r) => r.item);
export const finFormaSalvar = (registro) => chamar("formaSalvar", { registro }).then((r) => r.item);

export const finOmieEstado = () => chamar("omieEstado");
export const finOmieSincronizarPagina = (tipo, de, ate, pagina = 1) => chamar("omieSincronizarPagina", { tipo, de, ate, pagina });
