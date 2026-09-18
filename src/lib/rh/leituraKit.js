const CPF = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/;
const DATA = /\b(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})\b/;
const limpar = v => String(v || "").replace(/\s+/g, " ").trim();
const normalizar = v => limpar(v).replace(/\s*-\s*$/, "");
const iso = v => { const m = String(v || "").match(DATA); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };
const cpf = v => String(v || "").match(CPF)?.[0]?.replace(/\D/g, "") || "";

function escaparPdf(v) {
  return String(v || "")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\([nrt])/g, (_, c) => ({ n: " ", r: " ", t: " " }[c]))
    .replace(/\\([0-7]{1,3})/g, (_, c) => String.fromCharCode(parseInt(c, 8)));
}
function textoPdfOperadores(texto) {
  const partes = [];
  const literal = /\(((?:\\.|[^\\)])*)\)\s*T[Jj]/g;
  let m;
  while ((m = literal.exec(texto))) partes.push(escaparPdf(m[1]));
  const arrays = /\[((?:.|\n|\r)*?)\]\s*TJ/g;
  while ((m = arrays.exec(texto))) {
    const valores = [];
    const itens = /(\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f]+)>)/g;
    let item;
    while ((item = itens.exec(m[1]))) {
      if (item[3]) {
        for (let i = 0; i < item[3].length; i += 4) {
          const code = parseInt(item[3].slice(i, i + 4), 16);
          if (Number.isFinite(code)) valores.push(String.fromCharCode(code));
        }
      } else valores.push(escaparPdf(item[2]));
    }
    partes.push(valores.join(""));
  }
  return partes.join(" ");
}
async function descomprimir(bytes, formato = "deflate") {
  try {
    const stream = new DecompressionStream(formato);
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  } catch {
    return null;
  }
}

async function extrairTextoPdfLeve(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const latin = new TextDecoder("latin1");
  const bin = latin.decode(bytes);
  const blocos = [];
  let pos = 0;
  while (pos < bin.length) {
    const marcador = bin.indexOf("/FlateDecode", pos);
    if (marcador < 0) break;
    const stream = bin.indexOf("stream", marcador);
    if (stream < 0) break;
    let inicio = stream + 6;
    if (bin[inicio] === "\r" && bin[inicio + 1] === "\n") inicio += 2;
    else if (bin[inicio] === "\n" || bin[inicio] === "\r") inicio += 1;
    const fim = bin.indexOf("endstream", inicio);
    if (fim < 0) break;
    const comprimido = bytes.slice(inicio, fim);
    const descomprimido = await descomprimir(comprimido, "deflate")
      || await descomprimir(comprimido, "deflate-raw");
    if (descomprimido) blocos.push(latin.decode(descomprimido));
    pos = fim + 9;
  }
  const extraidos = blocos.flatMap(texto => [textoPdfOperadores(texto), texto]);
  if (!extraidos.length) extraidos.push(textoPdfOperadores(bin), bin);
  return extraidos.join(" ").replace(/\s+/g, " ").trim();
}

async function extrairTextoPdfCompleto(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const documento = await pdfjs.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const paginas = [];
  for (let pagina = 1; pagina <= documento.numPages; pagina++) {
    const objeto = await documento.getPage(pagina);
    const conteudo = await objeto.getTextContent();
    paginas.push((conteudo.items || []).map(item => item.str || "").join(" "));
  }
  return paginas.join("\n").replace(/\s+/g, " ").trim();
}
export async function extrairTextoPdf(file) {
  try {
    const texto = await extrairTextoPdfCompleto(file);
    if (texto.length > 80) return texto;
  } catch {
    // PDFs incompatíveis continuam seguindo para o leitor leve/manual.
  }
  return extrairTextoPdfLeve(file);
}

const ROTULOS = [
  "nome completo", "nome do colaborador", "nome", "cpf", "data de nascimento",
  "nascimento", "data de admissão", "data de admissao", "admissão", "admissao",
  "cargo", "função", "funcao", "salário", "salario", "telefone", "celular",
  "endereço", "endereco", "município", "municipio", "cep", "estado civil",
  "grau instrução", "escolaridade", "jornada", "setor", "local"
];
function depoisDe(texto, labels) {
  const proximos = ROTULOS.filter(label => !labels.includes(label)).sort((a, b) => b.length - a.length);
  const re = new RegExp("(?:"
    + labels.join("|")
    + ")\\s*[:\\-]?\\s*([^\\n|]{2,160}?)"
    + "(?=\\s+(?:" + proximos.join("|") + ")\\s*[:\\-]|$)", "i");
  return limpar(texto.match(re)?.[1]);
}
function pertoDoRotulo(texto, labels, padrao, raio = 220) {
  for (const label of labels) {
    const re = new RegExp(label + "[^\\n]{0," + raio + "}", "i");
    const depois = texto.match(re)?.[0] || "";
    const achadoDepois = depois.match(padrao);
    if (achadoDepois) return achadoDepois[0];
    const indice = texto.toLowerCase().indexOf(label.toLowerCase());
    if (indice >= 0) {
      const antes = texto.slice(Math.max(0, indice - raio), indice);
      const achadoAntes = antes.match(padrao);
      if (achadoAntes) return achadoAntes[0];
    }
  }
  return "";
}
function primeiroNome(texto) {
  const padroes = [
    /ficha\.?\s*:?\s*\d+(?:\s+\d+)?\s*-\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-Za-zÁÉÍÓÚÃÕÂÊÔÇ' ]{5,80})/i,
    /(?:empregado|colaborador)\s*:\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-Za-zÁÉÍÓÚÃÕÂÊÔÇ' ]{5,80})/i
  ];
  for (const p of padroes) {
    const valor = limpar(texto.match(p)?.[1]);
    if (valor && !/histórico|contratual|empregador|documentos/i.test(valor)) return limpar(valor.replace(/\s+(?:CPF|Data|Cargo|Salário|Endereço|Telefone)\b.*$/i, ""));
  }
  return depoisDe(texto, ["nome completo", "nome do colaborador", "nome"]) || "";
}
function telefoneProvavel(texto) {
  return (texto.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4,5}[-\s]?\d{4}/)?.[0] || "").trim();
}
function salarioProvavel(texto) {
  const valor = texto.match(/salário\s+de\s+R\$\s*[\d.]+,\d{2}/i)?.[0]
    || pertoDoRotulo(texto, ["salário/cpl. sal.", "salário", "salario"], /\d{1,3}(?:\.\d{3})*,\d{2,4}/);
  return valor ? (valor.match(/\d[\d.]*,\d{2,4}/)?.[0] || "").replace(/\./g, "").replace(",", ".") : "";
}
function enderecoProvavel(texto) {
  const valor = texto.match(/endereço:\s*(?:residencial\s*)?([A-Za-zÀ-ÿ0-9][^:\n]{3,100}?)(?=\s+(?:bairro|município|municipio|cep|nº|numero):)/i)?.[1]
    || texto.match(/endereço:\s*(Lago Kivu)/i)?.[1]
    || depoisDe(texto, ["endereço", "endereco"]);
  return normalizar(valor);
}
function cargoProvavel(texto) {
  const cbo = texto.match(/CBO:\s*\d+\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 /-]{3,80})/i)?.[1]
    ?.replace(/\s+(?:Salário|Data|Endereço|CPF)\b.*$/i, "");
  if (cbo && !/data|salário|cargo|admissão/i.test(cbo)) return normalizar(cbo);
  const valor = depoisDe(texto, ["cargo", "função", "funcao"]);
  return valor && !/data|salário|admissão/i.test(valor) ? normalizar(valor) : "";
}
function cidadeProvavel(texto) {
  const valor = texto.match(/endereço:\s*[^:\n]{3,80}\s+município:\s*([A-Za-zÀ-ÿ ]{3,60})/i)?.[1]
    || texto.match(/município:\s*([A-Za-zÀ-ÿ ]{3,60})\s+cep:/i)?.[1]
    || "";
  return normalizar(valor.replace(/\s+(?:CEP|Bairro|Estado)\b.*$/i, ""));
}

export function extrairDadosKit(texto, pessoaAtual = {}) {
  const bruto = limpar(texto);
  const dados = {};
  const nome = primeiroNome(bruto);
  const cpfEncontrado = cpf(bruto);
  const nascimento = pertoDoRotulo(bruto, ["data nascimento", "data de nascimento", "nascimento"], DATA);
  const admissao = pertoDoRotulo(bruto, ["data admissão", "data de admissão", "admissão", "admissao"], DATA);
  const salario = salarioProvavel(bruto);
  const telefone = telefoneProvavel(bruto);
  const endereco = enderecoProvavel(bruto);
  const cidade = cidadeProvavel(bruto);
  const cep = bruto.match(/\b\d{2,5}[\.-]?\d{3}[-]\d{3}\b/)?.[0] || bruto.match(/\b\d{2}\.\d{3}-\d{3}\b/)?.[0] || "";
  const escolaridade = bruto.match(/\b\d+\s*-\s*(Superior Completo|Superior|Médio Completo|Médio|Fundamental[^,\n]*)\b/i)?.[1] || "";
  const estadoCivil = bruto.match(/(?:estado civil:\s*|informações gerais\s*.*?)(Solteiro|Solteira|Casado|Casada|Divorciado|Divorciada|Viúvo|Viúva)/i)?.[1] || "";
  const jornadaMatch = bruto.match(/(\d{1,3})\s*horas?\s+semanais/i);
  const jornada = jornadaMatch ? jornadaMatch[1] + " horas semanais" : "";
  const matriculaEsocial = bruto.match(/matrícula esocial:\s*([A-Z0-9]+)/i)?.[1] || "";
  const pis = bruto.match(/PIS\/PASEP:\s*([0-9. -]{8,20})/i)?.[1] || "";
  const ctps = bruto.match(/(?:carteira profissional nº|ctps\/série\/uf:)\s*([0-9 -]{4,30})/i)?.[1] || "";
  const cbo = bruto.match(/\bCBO:\s*(\d{4,6})\b/i)?.[1] || "";
  const empresa = bruto.match(/EMPRESA\s*-\s*([A-Za-zÀ-ÿ ]{3,80})\s+CNPJ/i)?.[1] || bruto.match(/razão social:\s*([A-Za-zÀ-ÿ ]{3,80})/i)?.[1] || "";
  const setor = bruto.match(/(?:novo local|local):\s*([0-9. -]*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .-]{2,80})/i)?.[1] || "";
  const vinculo = bruto.match(/vínculos[\s\S]{0,120}?\d+\s+([A-Za-zÀ-ÿ., ]{3,60})/i)?.[1] || "";
  if (nome && nome.length >= 5) dados.nome = normalizar(nome);
  if (cpfEncontrado) dados.cpf = cpfEncontrado;
  if (DATA.test(nascimento)) dados.dataNascimento = iso(nascimento);
  if (DATA.test(admissao)) dados.admissao = iso(admissao);
  const cargo = cargoProvavel(bruto);
  if (cargo) dados.cargo = cargo;
  if (salario) dados.salario = salario;
  if (telefone) dados.telefone = telefone.replace(/\D/g, "");
  if (endereco) dados.endereco = endereco;
  if (cidade) dados.cidade = cidade;
  if (cep) dados.cep = cep;
  if (estadoCivil) dados.estadoCivil = estadoCivil;
  if (escolaridade) dados.escolaridade = escolaridade;
  if (jornada) dados.jornada = jornada;
  if (matriculaEsocial) dados.matriculaEsocial = matriculaEsocial;
  if (pis) dados.pis = limpar(pis);
  if (ctps) dados.ctps = limpar(ctps);
  if (cbo) dados.cbo = cbo;
  if (empresa) dados.empresa = limpar(empresa);
  if (setor) dados.setor = normalizar(setor);
  if (vinculo) dados.vinculo = normalizar(vinculo);
  const camposEncontrados = Object.keys(dados);
  const conflitos = camposEncontrados
    .filter(k => pessoaAtual[k] !== undefined && String(pessoaAtual[k] || "").trim() && String(pessoaAtual[k]).trim() !== String(dados[k]).trim())
    .map(k => ({ campo: k, cadastro: pessoaAtual[k], documento: dados[k] }));
  return {
    dados, conflitos, textoExtraido: bruto.slice(0, 20000),
    leituraStatus: bruto.length > 80 && camposEncontrados.length > 0 ? "CONCLUIDA" : "REQUER_CONFERENCIA",
    camposEncontrados,
  };
}
export const extrairDadosFichaRegistro = extrairDadosKit;
