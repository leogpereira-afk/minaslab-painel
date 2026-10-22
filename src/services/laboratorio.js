// Porta de dados do módulo Laboratório: Edge Function ml-laboratorio (crachá,
// permissão "laboratorio" e rastro de quem gravou ficam no servidor).
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";
import { mensagemAmigavel } from "../lib/errosAmigaveis.js";

async function chamar(acao, corpo = {}) {
  const resp = await comCracha(`${API}/ml-laboratorio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro ? mensagemAmigavel(body.erro) : mensagemDoStatus(resp.status));
  return body;
}

export const listarEntradas = () => chamar("listar").then((r) => ({
  itens: r.itens || [], podeEditar: r.podeEditar === true, setores: Array.isArray(r.setores) ? r.setores : [],
  pessoas: Array.isArray(r.pessoas) ? r.pessoas : [], setoresConfig: r.setoresConfig || { administrativo: [], laboratorio: [] },
}));

// Setores (só direção): quem é Administrativo e quem é Laboratório.
export const setoresLer = () => chamar("setores");
export const setoresSalvar = (administrativo, laboratorio) => chamar("setoresSalvar", { administrativo, laboratorio });

// Confere o efeito: o servidor devolve o registro como ficou.
export async function salvarEntrada(registro) {
  const r = await chamar("salvar", { registro });
  if (!r?.registro?.id) throw new Error("O servidor não confirmou a gravação. Recarregue e confira.");
  return r.registro;
}

export const entradasEmLote = (tipo, ids, quando) => chamar("lote", { tipo, ids, quando });

export async function apagarEntrada(id) {
  const r = await chamar("apagar", { id });
  if (!r?.ok) throw new Error("O servidor não confirmou a exclusão.");
  return true;
}

// Importação da planilha antiga (só direção): manda em blocos e soma o resultado.
export async function importarEntradas(registros, aoProgresso) {
  const total = { inseridos: 0, existentes: 0, invalidos: 0 };
  for (let i = 0; i < registros.length; i += 300) {
    const r = await chamar("importar", { registros: registros.slice(i, i + 300) });
    total.inseridos += r.inseridos || 0;
    total.existentes += r.existentes || 0;
    total.invalidos += r.invalidos || 0;
    aoProgresso?.(Math.min(i + 300, registros.length), registros.length);
  }
  return total;
}
