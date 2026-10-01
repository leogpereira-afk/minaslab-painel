// Edição do cadastro das contas e padrão de nomes (tela Acessos).
// Backend: função ml-contas (só a direção; o servidor confere).
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function chamarContas(action, campos = {}) {
  const r = await comCracha(`${API}/ml-contas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...campos }),
  });
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.erro || mensagemDoStatus(r.status));
  if (!b?.ok) throw new Error("O servidor não confirmou a operação. Atualize e confira.");
  return b;
}

export const contasPadraoLer = () => chamarContas("padrao").then((r) => r.nomeMaiusculas === true);
export const contaEditar = (dados) => chamarContas("editar", dados);
export const contasPadraoNome = (maiusculas, converterExistentes = false) =>
  chamarContas("padraoNome", { maiusculas, converterExistentes });
