// Cadastro → Solicitantes, nos campos do GerenciaLab ("Adicionar Solicitante"
// e a ficha do solicitante, com Endereços por tipo). Puro e testado.

export const TIPOS_ENDERECO = ["Nota Fiscal", "Resultados", "Principal"];
export const WHATSAPP_ENDERECO = ["Não enviar", "Sim enviar"];

const dig = (s) => String(s || "").replace(/\D/g, "");
const emailOk = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// [campo, mensagem] do primeiro problema, ou null.
export function erroSolicitante(d) {
  const pf = d.pessoa === "PF";
  if (!String(d.nome || "").trim()) return ["sNome", "Informe o Nome do Responsável."];
  if (!pf && !String(d.razao || "").trim()) return ["sRazao", "Informe a Razão Social."];
  const n = dig(d.doc).length;
  if (n && pf && n !== 11) return ["sDoc", "O CPF deve ter 11 dígitos."];
  if (n && !pf && n !== 14) return ["sDoc", "O CNPJ deve ter 14 dígitos."];
  if (!emailOk(d.email)) return ["sEmail", "Confira o e-mail."];
  return null;
}

// Pessoa Física: o nome do responsável é a razão social; sem fantasia nem inscrições.
export function normalizarSolicitante(d) {
  const pf = d.pessoa === "PF";
  const t = (v) => String(v ?? "").trim();
  return { ...d, nome: t(d.nome), razao: pf ? t(d.nome) : t(d.razao), fantasia: pf ? "" : t(d.fantasia), ie: pf ? "" : t(d.ie), im: pf ? "" : t(d.im), email: t(d.email).toLowerCase() };
}

// Endereço do cadastro (o que se digita no "Adicionar Solicitante") vira o Principal.
export function enderecoDoCadastro(d) {
  return { id: `e${Date.now().toString(36)}`, tipo: "Principal", responsavel: d.nome || "", email: d.email || "", tel: d.tel || "", cel: d.cel || "", cep: d.cep || "", end: d.end || "", num: d.num || "", comp: d.comp || "", bairro: d.bairro || "", cidade: d.cidade || "", uf: d.uf || "", whatsapp: "Não enviar" };
}

export function erroEndereco(e, tipos = TIPOS_ENDERECO) {
  if (!tipos.includes(e.tipo)) return ["eTipo", "Escolha o tipo de endereço."];
  if (!String(e.responsavel || "").trim()) return ["eResp", "Informe o responsável."];
  if (!emailOk(e.email)) return ["eEmail", "Confira o e-mail."];
  return null;
}

// E-mails para a proposta: o do cadastro e os dos endereços (sem repetir).
export function emailsDoSolicitante(s, tipo = null) {
  if (!s) return [];
  const l = [s.email, ...(s.enderecos || []).filter((e) => !tipo || e.tipo === tipo).map((e) => e.email)].map((e) => String(e || "").trim().toLowerCase()).filter(Boolean);
  return [...new Set(l)];
}

export const rotuloSolicitante = (s) => (s ? `${s.razao || s.nome}${s.razao && s.nome && s.razao !== s.nome ? ` (${s.nome})` : ""}` : "");
