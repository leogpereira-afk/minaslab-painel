// Porta do cofre "Senhas e acessos": Edge Function ml-senhas (crachá do painel, página "senhas").
// A lista nunca traz senha; "revelar" busca uma senha por vez e fica registrado no histórico.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamar(acao, corpo = {}) {
  const resp = await comCracha(`${API}/ml-senhas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...corpo }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(body?.erro || mensagemDoStatus(resp.status));
  return body;
}

export const lerSenhas = () => chamar("listar");
export const revelarSenha = (id, modo) => chamar("revelar", { id, modo }).then((r) => r.senha);
export const historicoSenha = (id) => chamar("historico", { id }).then((r) => r.historico);
export const verSenhaAnterior = (historico_id) => chamar("verAnterior", { historico_id }).then((r) => r.senha);
export const salvarAcesso = (registro) => chamar("salvar", { registro });
export const alterarSenha = (id, senha, motivo) => chamar("alterarSenha", { id, senha, motivo });
export const definirQuemVe = (ids, setores, pessoas, modo = "definir") => chamar("permissoes", { ids, setores, pessoas, modo });
export const salvarSetor = (nome, membros, nomeAntigo) => chamar("setorSalvar", { nome, membros, nomeAntigo });
export const apagarSetor = (nome) => chamar("setorApagar", { nome });
export const importarSenhas = (linhas, arquivo) => chamar("importar", { linhas, arquivo });
export const apagarAcesso = (id) => chamar("apagar", { id });
