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
    // O relatório "Registro de Empregados" usa colunas. A ordem interna dos
    // objetos PDF não acompanha a ordem visual; por isso rótulo e valor ficam
    // separados quando simplesmente fazemos join(). Reconstruímos linhas por
    // coordenadas Y e ordenamos cada linha por X antes de interpretar campos.
    const itens = (conteudo.items || [])
      .filter(item => String(item.str || "").trim())
      .map(item => ({
        texto: String(item.str || "").trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
      }))
      .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
    const linhas = [];
    for (const item of itens) {
      let linha = linhas.find(l => Math.abs(l.y - item.y) <= 2);
      if (!linha) {
        linha = { y: item.y, itens: [] };
        linhas.push(linha);
      }
      linha.itens.push(item);
    }
    paginas.push(linhas
      .sort((a, b) => b.y - a.y)
      .map(linha => linha.itens.sort((a, b) => a.x - b.x).map(i => i.texto).join(" "))
      .join("\n"));
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
  const registro = texto.match(/Cargo:\s*(?:\d{1,6}\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 /-]{2,80}?)(?=\s+Salário\/Cpl\.|\s+Período Pagto:)/i)?.[1];
  if (registro) return normalizar(registro);
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

function extrairRegistroEmpregados(texto) {
  if (!/Registro de Empregados/i.test(texto)) return {};
  const linhas = String(texto || "").split(/\n+/).map(limpar).filter(Boolean);
  const dados = {};
  const linha = (re) => linhas.find(l => re.test(l)) || "";
  const valor = (re, campo) => linha(re).match(campo)?.[1] || "";

  const cab = linha(/Ficha\s*:/i);
  const nome = cab.match(/Ficha\s*:\s*\d+\s+(?:\d+\s*-\s*)?([A-Za-zÀ-ÿ' ]{5,100})$/i)?.[1]
    || linha(/\d+\s*-\s*[A-Za-zÀ-ÿ' ]{5,100}$/).match(/\d+\s*-\s*([A-Za-zÀ-ÿ' ]{5,100})$/)?.[1];
  if (nome) dados.nome = normalizar(nome);

  const nascimento = valor(/Data Nascimento:/i, /Data Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (nascimento) dados.dataNascimento = iso(nascimento);
  const naturalidade = valor(/Naturalidade:/i, /Naturalidade:\s*(.+?)(?=\s+Nacionalidade:|$)/i);
  if (naturalidade) dados.naturalidade = normalizar(naturalidade);
  const nacionalidade = valor(/Nacionalidade:/i, /Nacionalidade:\s*(?:\d+\s*-\s*)?(.+)$/i);
  if (nacionalidade) dados.nacionalidade = normalizar(nacionalidade);

  const cpfRotulado = valor(/\bCPF\s*:/i, /\bCPF\s*:\s*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})/i);
  if (cpfRotulado) dados.cpf = cpfRotulado.replace(/\D/g, "");
  const pisRotulado = valor(/PIS\/PASEP\s*:/i, /PIS\/PASEP\s*:\s*([0-9. -]{8,20})/i);
  if (pisRotulado) dados.pis = limpar(pisRotulado);
  const ctpsRotulada = valor(/CTPS\/Série\/UF\s*:/i, /CTPS\/Série\/UF\s*:\s*([0-9]+)\s*-\s*([0-9]+)/i);
  const ctpsLinha = linha(/CTPS\/Série\/UF\s*:/i).match(/CTPS\/Série\/UF\s*:\s*([0-9]+)\s*-\s*([0-9]+)/i);
  if (ctpsLinha) { dados.ctps = ctpsLinha[1]; dados.serieCtps = ctpsLinha[2]; }

  const pai = valor(/\bPai\s*:/i, /\bPai\s*:\s*(.+?)(?=\s+(?:Mãe|Mae):|$)/i);
  if (pai) dados.nomePai = normalizar(pai);
  const mae = valor(/(?:Mãe|Mae)\s*:/i, /(?:Mãe|Mae)\s*:\s*(.+)$/i);
  if (mae) dados.nomeMae = normalizar(mae);

  const admissao = valor(/Data Admissão:/i, /Data Admissão:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (admissao) dados.admissao = iso(admissao);
  const ficha = valor(/Nr\. Ficha Registro:/i, /Nr\. Ficha Registro:\s*(0*\d+)/i);
  if (ficha) dados.matricula = String(Number(ficha));
  const esocial = valor(/Matrícula eSocial:/i, /Matrícula eSocial:\s*([A-Z0-9.-]+)/i);
  if (esocial) dados.matriculaEsocial = esocial;
  const cargo = valor(/^Cargo:/i, /^Cargo:\s*(?:\d+\s+)?(.+)$/i);
  if (cargo) dados.cargo = normalizar(cargo);
  const sal = valor(/Salário\/Cpl\. Sal\./i, /Salário\/Cpl\. Sal\.\s*([\d.]+,\d{2,4})/i);
  if (sal) dados.salario = sal.replace(/\./g, "").replace(",", ".");
  const local = valor(/^Local:/i, /^Local:\s*(.+)$/i);
  if (local) dados.setor = normalizar(local);
  const jornada = valor(/Jornada Trabalho:/i, /Jornada Trabalho:\s*(.+?)(?=\s+DSR:|$)/i);
  if (jornada) dados.jornada = normalizar(jornada);
  const histCargo = linhas.find(l => /Admissão/i.test(l) && /\b\d{6}\b/.test(l) && /Analista|Auxiliar|Técnic|Gerente|Assistente|Coordenador/i.test(l));
  const cbo = histCargo?.match(/\b(\d{6})\b/)?.[1];
  if (cbo) dados.cbo = cbo;
  const horas = linhas.find(l => /\b\d{2}:\d{2}\b/.test(l) && /\b\d{2}:\d{2}\b.*\b\d{2}:\d{2}\b/.test(l))?.match(/\b(\d{2}):00\b/)?.[1];
  if (horas) dados.horasSemanais = horas;
  return dados;
}

export function extrairDadosKit(texto, pessoaAtual = {}) {
  const bruto = String(texto || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  const dados = {};
  const nome = normalizar(
    bruto.match(/Ficha\.?\s*:?\s*\d+\s+\d+\s*-\s*([A-Za-zÀ-ÿ' ]{5,100}?)(?=\s+Empregador|\s+Colaborador)/i)?.[1]
    || bruto.match(/Registro de Empregados[\s\S]{0,180}?\d+\s*-\s*([A-Za-zÀ-ÿ' ]{5,100}?)(?=\s+Empregador|\s+Colaborador)/i)?.[1]
    || primeiroNome(bruto)
    || ""
  );
  // Em Registro de Empregados há CNPJ do empregador e CPF do colaborador.
  // Nunca usar o primeiro número com formato de CPF encontrado no PDF.
  const cpfEncontrado = bruto.match(/\bCPF\s*:\s*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})\b/i)?.[1]?.replace(/\D/g, "") || "";
  // Os relatórios de Registro de Empregados da contabilidade posicionam o
  // valor antes do rótulo. Nestes PDFs, procurar só "perto" do rótulo pode
  // capturar a data de emissão/inclusão. Preferimos a sequência estrutural.
  // pdf.js pode devolver os rótulos primeiro e os valores depois. Para este
  // relatório, a sequência após "Colaborador Histórico Contratual" é estável.
  const cabecalhoColaborador = bruto.match(/Colaborador\s+Histórico Contratual\s+(\d{2}\/\d{2}\/\d{4})\s+(?:\d+\s*-\s*)?([A-Za-zÀ-ÿ]+)\s+([A-Za-zÀ-ÿ ]+\s*-\s*[A-Z]{2})/i);
  const nascimento = bruto.match(/Data Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
    || cabecalhoColaborador?.[1]
    || pertoDoRotulo(bruto, ["data nascimento", "data de nascimento", "nascimento"], DATA);
  const admissaoEstrutural = bruto.match(/Data Admissão:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]
    || bruto.match(/Nr\. Ficha Registro:\s*Data\s+Admissão:\s*Cargo:\s*Salário\/Cpl\. Sal\.\s*\d{1,2}:\d{2}\s+\d+\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1];
  const admissao = admissaoEstrutural
    || bruto.match(/\b(\d{2}\/\d{2}\/\d{4})\s+\d{4}\s+Grupo Minas Lab\s+\d{4}\s+\d{3}\s+Admissão/i)?.[1]
    || pertoDoRotulo(bruto, ["data admissão", "data de admissão", "admissão", "admissao"], DATA);
  const salario = salarioProvavel(bruto);
  // Não inferir telefone de números soltos/datas/códigos da ficha.
  // Só preencher quando houver um rótulo explícito de telefone/celular.
  const telefone = bruto.match(/(?:telefone|celular)\s*[:\-]?\s*(\+?55\s*)?(\(?\d{2}\)?\s*9?\d{4,5}[-\s]?\d{4})/i)?.[0]
    ?.replace(/^(?:telefone|celular)\s*[:\-]?\s*/i, "") || "";
  // "Endereço" no bloco Empregador é endereço da empresa, não da pessoa.
  // Só preencher endereço residencial quando o documento o identificar como tal.
  const endereco = bruto.match(/(?:endereço residencial|residência)\s*:\s*([^\n]{3,100})/i)?.[1] || "";
  const cidade = bruto.match(/(?:cidade residencial|município residencial)\s*:\s*([A-Za-zÀ-ÿ ]{3,60})/i)?.[1] || "";
  const enderecoEmpresa = bruto.match(/M Lab Servicos Ltda[\s\S]{0,350}?(\d{2}\.\d{3}-\d{3})/i)?.[1] || "";
  const cep = bruto.match(/(?:CEP residencial|CEP residência)\s*:\s*(\d{2}\.\d{3}-\d{3})/i)?.[1] || "";
  const escolaridade = bruto.match(/\b\d+\s*-\s*(Superior Completo|Superior|Médio Completo|Médio|Fundamental[^,\n]*)\b/i)?.[1] || "";
  const estadoCivil = bruto.match(/(?:estado civil:\s*|informações gerais\s*.*?)(Solteiro|Solteira|Casado|Casada|Divorciado|Divorciada|Viúvo|Viúva)/i)?.[1] || "";
  const jornadaMatch = bruto.match(/(\d{1,3})\s*horas?\s+semanais/i);
  const escalaRegistro = bruto.match(/Escala:\s*([^%]{4,100}?)(?=\s+Jornada Trabalho:|\s+DSR:)/i)?.[1] || "";
  const horasRegistro = bruto.match(/Escala Horária[\s\S]{0,180}?(\d{2}:\d{2})\s+\d{2}:\d{2}/i)?.[1] || "";
  const jornada = jornadaMatch ? jornadaMatch[1] + " horas semanais" : normalizar(escalaRegistro);
  const horasSemanais = jornadaMatch?.[1] || (horasRegistro ? horasRegistro.replace(":00", "") : "");
  const matriculaEsocial = bruto.match(/matrícula esocial:\s*([A-Z0-9.-]+)/i)?.[1] || "";
  const rg = bruto.match(/(?:\bRG\b|identidade)\s*[:\-]?\s*([0-9A-Z.\/-]{4,25})/i)?.[1] || "";
  const orgaoEmissorRg = bruto.match(/(?:órgão emissor|orgao emissor)\s*[:\-]?\s*([A-Z0-9./ -]{2,30})/i)?.[1] || "";
  const nacionalidade = bruto.match(/nacionalidade\s*[:\-]?\s*(?:\d+\s*-\s*)?([A-Za-zÀ-ÿ ]{3,40})/i)?.[1]
    || cabecalhoColaborador?.[2] || "";
  const naturalidade = bruto.match(/naturalidade\s*[:\-]?\s*([A-Za-zÀ-ÿ ]{3,60}(?:\s*-\s*[A-Z]{2})?)/i)?.[1]
    || cabecalhoColaborador?.[3] || "";
  const sexo = bruto.match(/(?:sexo|gênero|genero)\s*[:\-]?\s*(masculino|feminino|m|f)\b/i)?.[1] || "";
  const filiacaoRegistro = bruto.match(/PIS\/PASEP:\s*Mãe:\s*[0-9.]+\s+([A-Za-zÀ-ÿ' ]{5,100}?)\s+([A-Za-zÀ-ÿ' ]{5,100}?)\s+Pai:/i);
  const nomeMae = bruto.match(/(?:Mãe|Mae)\s*:\s*([A-Za-zÀ-ÿ' ]{5,100}?)(?=\s+Documentos|\s+CPF:|\s+Pai:|$)/i)?.[1]
    || filiacaoRegistro?.[1] || "";
  const nomePai = bruto.match(/Pai\s*:\s*([A-Za-zÀ-ÿ' ]{5,100}?)(?=\s+(?:Mãe|Mae):|\s+Documentos|$)/i)?.[1]
    || filiacaoRegistro?.[2] || "";
  const pis = bruto.match(/PIS\/PASEP:\s*([0-9. -]{8,20})/i)?.[1]
    || bruto.match(/PIS\/PASEP:\s*Mãe:\s*([0-9. -]{8,20})/i)?.[1] || "";
  const ctps = bruto.match(/(?:carteira profissional nº|ctps\/série\/uf:)\s*([0-9 -]{4,30})/i)?.[1] || "";
  const cbo = bruto.match(/\bCBO:\s*(\d{4,6})\b/i)?.[1]
    || bruto.match(/Cargos[\s\S]{0,300}?\b(\d{6})\b[\s\S]{0,50}?Admissão/i)?.[1]
    || "";
  const empresa = bruto.match(/EMPRESA\s*-\s*([A-Za-zÀ-ÿ ]{3,80})\s+CNPJ/i)?.[1]
    || (bruto.match(/\b(M Lab Servicos Ltda|Minas Lab[^\d]{0,30})\b/i)?.[1] || "");
  const setor = bruto.match(/(?:novo local|local)\s*:\s*([0-9. -]*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .-]{2,80}?)(?=\s+Alterações|\s+Filiais|$)/i)?.[1] || "";
  const vinculo = bruto.match(/vínculos[\s\S]{0,120}?\d+\s+([A-Za-zÀ-ÿ., ]{3,60})/i)?.[1] || "";
  if (nome && nome.length >= 5) dados.nome = normalizar(nome);
  if (cpfEncontrado && !dados.cpf) dados.cpf = cpfEncontrado;
  if (DATA.test(nascimento)) dados.dataNascimento = iso(nascimento);
  if (DATA.test(admissao)) dados.admissao = iso(admissao);
  const cargo = cargoProvavel(bruto);
  if (cargo) dados.cargo = cargo;
  if (salario) dados.salario = salario;
  if (telefone && !dados.telefone) dados.telefone = telefone.replace(/\D/g, "");
  if (endereco) dados.endereco = endereco;
  if (cidade) dados.cidade = cidade;
  if (cep) dados.cep = cep;
  if (estadoCivil) dados.estadoCivil = estadoCivil;
  if (escolaridade) dados.escolaridade = escolaridade;
  if (jornada) dados.jornada = jornada;
  if (horasSemanais) dados.horasSemanais = horasSemanais;
  if (matriculaEsocial) dados.matriculaEsocial = matriculaEsocial;
  if (rg) dados.rg = limpar(rg);
  if (orgaoEmissorRg) dados.orgaoEmissorRg = limpar(orgaoEmissorRg);
  if (nacionalidade) dados.nacionalidade = normalizar(nacionalidade);
  if (naturalidade) dados.naturalidade = normalizar(naturalidade);
  if (sexo) dados.sexo = /^m(?:asculino)?$/i.test(sexo) ? "Masculino" : /^f(?:eminino)?$/i.test(sexo) ? "Feminino" : limpar(sexo);
  if (nomeMae) dados.nomeMae = normalizar(nomeMae.replace(/\s+(?:Pai|CPF|RG|Nascimento)\b.*$/i, ""));
  if (nomePai) dados.nomePai = normalizar(nomePai.replace(/\s+(?:CPF|RG|Nascimento)\b.*$/i, ""));
  if (pis) dados.pis = limpar(pis);
  if (ctps) {
    const partesCtps = limpar(ctps).split(/\s*-\s*/).filter(Boolean);
    if (partesCtps[0]) dados.ctps = partesCtps[0];
    if (partesCtps[1]) dados.serieCtps = partesCtps[1];
  }
  if (cbo) dados.cbo = cbo;
  if (empresa) dados.empresa = limpar(empresa);
  const fichaRegistro = bruto.match(/Nr\. Ficha Registro:[\s\S]{0,140}?\b(0{2,}\d{1,6})\b/i)?.[1]
    || bruto.match(/Ficha\.?\s*:\s*(\d{1,8})\b/i)?.[1];
  if (fichaRegistro) dados.matricula = String(Number(fichaRegistro));
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
