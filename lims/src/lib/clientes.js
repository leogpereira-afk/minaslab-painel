// Cadastro de Cliente / Fornecedor (campos do "Adicionar Cliente" e da ficha
// "Detalhes da Cliente" do GerenciaLab).

export const TIPOS_CADASTRO = ["Cliente", "Fornecedor", "Ambos"];
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
export const TIPOS_ENDERECO_CLIENTE = ["Coleta", "Nota Fiscal", "Resultados", "Principal"];
export const INADIMPLENCIA = ["Não", "Bloqueio Parcial", "Bloqueio total"];
export const PERMISSOES_ACESSO = ["Administrador", "Proposta", "Coleta", "Contrato", "Download"];

// Cadastros antigos gravaram "Cliente / Fornecedor"; no GerenciaLab é "Ambos".
export const tipoCadastro = (t) => (t === "Cliente / Fornecedor" ? "Ambos" : t || "Cliente");

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
  return { ...d, tipo: tipoCadastro(d.tipo), razao: pf ? String(d.resp).trim() : String(d.razao).trim(), fantasia: pf ? "" : d.fantasia, ie: pf ? "" : d.ie, im: pf ? "" : d.im };
}

// Endereço digitado no cadastro vira o Principal (padrão).
export function enderecoPrincipal(c) {
  return { id: "e-principal", tipo: "Principal", status: "Ativo", padrao: "Sim", responsavel: c.resp || "", email: c.email || "", tel: c.tel || "", cel: c.cel || "", cep: c.cep || "", end: c.end || "", num: c.num || "", comp: c.comp || "", bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "", whatsapp: "Não enviar", longitude: "", latitude: "" };
}

// Endereços do cliente; cadastro antigo sem lista mostra o endereço do cadastro como Principal.
export function enderecosDoCliente(c) {
  if (Array.isArray(c.enderecos)) return c.enderecos;
  return c.end || c.cep || c.email ? [enderecoPrincipal(c)] : [];
}

// E-mail padrão de um tipo (Resultados, Nota Fiscal...) com o do cadastro como reserva.
export function emailDoTipo(c, tipo) {
  const l = enderecosDoCliente(c).filter((e) => e.tipo === tipo && e.status !== "Inativo" && e.email);
  return (l.find((e) => e.padrao === "Sim") || l[0])?.email || c.email || "";
}

export function erroAcesso(a) {
  if (!String(a.nome || "").trim()) return ["aNome", "Informe o nome completo."];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email || ""))) return ["aEmail", "Informe um e-mail válido."];
  if (!(a.permissoes || []).length) return ["aPerm", "Marque ao menos uma permissão."];
  return null;
}
