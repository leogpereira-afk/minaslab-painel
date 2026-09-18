import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const CPF = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/;
const DATA = /\b(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})\b/;
const limpar = v => String(v || "").replace(/\s+/g, " ").trim();
const iso = v => { const m=String(v||"").match(DATA); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const cpf = v => String(v || "").match(CPF)?.[0]?.replace(/\D/g, "") || "";

function depoisDe(texto, labels) {
  const re = new RegExp(`(?:${labels.join("|")})\\s*[:\\-]?\\s*([^\\n|]{2,120})`, "i");
  return limpar(texto.match(re)?.[1]);
}
function nomeProvavel(texto) {
  return depoisDe(texto, ["nome completo", "nome do colaborador", "nome"]) || "";
}
function telefoneProvavel(texto) {
  return (texto.match(/(?:\(?\d{2}\)?\s*)?9?\d{4,5}[-\s]?\d{4}/)?.[0] || "").trim();
}

export async function extrairTextoPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    paginas.push(tc.items.map(item => item.str || "").join(" "));
  }
  return paginas.join("\n").replace(/[ \t]+/g, " ").trim();
}

export function extrairDadosKit(texto, pessoaAtual = {}) {
  const bruto = limpar(texto);
  const dados = {};
  const nome = nomeProvavel(bruto);
  const cpfEncontrado = cpf(bruto);
  const nascimento = depoisDe(bruto, ["nascimento", "data de nascimento"]);
  const admissao = depoisDe(bruto, ["admissão", "admissao", "data de admissão", "data de admissao"]);
  const cargo = depoisDe(bruto, ["cargo", "função", "funcao"]);
  const salario = depoisDe(bruto, ["salário", "salario"]);
  const telefone = telefoneProvavel(bruto);
  const endereco = depoisDe(bruto, ["endereço", "endereco"]);
  if (nome && nome.length >= 5) dados.nome = nome;
  if (cpfEncontrado) dados.cpf = cpfEncontrado;
  if (DATA.test(nascimento)) dados.dataNascimento = iso(nascimento);
  if (DATA.test(admissao)) dados.admissao = iso(admissao);
  if (cargo && cargo.length >= 3) dados.cargo = cargo;
  if (salario) dados.salario = salario.replace(/[^0-9,.-]/g, "").replace(",", ".");
  if (telefone) dados.telefone = telefone;
  if (endereco && endereco.length >= 5) dados.endereco = endereco;

  const camposEncontrados = Object.keys(dados);
  const conflitos = camposEncontrados
    .filter(k => pessoaAtual[k] !== undefined && String(pessoaAtual[k] || "").trim() && String(pessoaAtual[k]).trim() !== String(dados[k]).trim())
    .map(k => ({ campo: k, cadastro: pessoaAtual[k], documento: dados[k] }));

  return {
    dados,
    conflitos,
    textoExtraido: bruto.slice(0, 20000),
    leituraStatus: bruto.length > 80 && camposEncontrados.length > 0 ? "CONCLUIDA" : "REQUER_CONFERENCIA",
    camposEncontrados,
  };
}
