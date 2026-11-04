// Cadastro de Cliente / Fornecedor (campos do "Adicionar Cliente" do GerenciaLab).

export const TIPOS_CADASTRO = ["Cliente", "Fornecedor", "Cliente / Fornecedor"];
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

// Devolve [campo, mensagem] do primeiro problema, ou null.
export function erroCliente(d) {
  if (!String(d.resp || "").trim()) return ["resp", "Informe o Nome do Responsável."];
  if (!String(d.doc || "").trim()) return ["doc", `Informe o ${d.pessoa === "PF" ? "CPF" : "CNPJ"}.`];
  const digitos = String(d.doc).replace(/\D/g, "");
  if (d.pessoa === "PF" && digitos.length !== 11) return ["doc", "O CPF deve ter 11 dígitos."];
  if (d.pessoa !== "PF" && digitos.length !== 14) return ["doc", "O CNPJ deve ter 14 dígitos."];
  if (d.pessoa !== "PF" && !String(d.razao || "").trim()) return ["razao", "Informe a Razão Social."];
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return ["email", "Confira o e-mail."];
  return null;
}

// Pessoa Física usa o nome do responsável como razão social e não tem fantasia nem inscrições.
export function normalizarCliente(d) {
  const pf = d.pessoa === "PF";
  return { ...d, razao: pf ? String(d.resp).trim() : String(d.razao).trim(), fantasia: pf ? "" : d.fantasia, ie: pf ? "" : d.ie, im: pf ? "" : d.im };
}
