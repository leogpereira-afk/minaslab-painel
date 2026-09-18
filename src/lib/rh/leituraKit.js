const CPF = /\\b\\d{3}[.\\s]?\\d{3}[.\\s]?\\d{3}[-\\s]?\\d{2}\\b/;
const DATA = /\\b(\\d{2})[\\/.\\-](\\d{2})[\\/.\\-](\\d{4})\\b/;
const limpar = v => String(v || "").replace(/\\s+/g, " ").trim();
const iso = v => { const m=String(v||"").match(DATA); return m ? \`${m[3]}-${m[2]}-${m[1]}\` : ""; };
const cpf = v => String(v || "").match(CPF)?.[0]?.replace(/\\D/g, "") || "";

function escaparPdf(v) {
  return String(v || "").replace(/\\([\\()])/g, "$1").replace(/\\n/g, " ").replace(/\\r/g, " ");
}
function depoisDe(texto, labels) {
  const re = new RegExp(\`(?:${labels.join("|")})\\\\s*[:\\\\-]?\\\\s*([^\\\\n|]{2,120})\`, "i");
  return limpar(texto.match(re)?.[1]);
}
function nomeProvavel(texto) { return depoisDe(texto, ["nome completo", "nome do colaborador", "nome"]) || ""; }
function telefoneProvavel(texto) { return (texto.match(/(?:\\(?\\d{2}\\)?\\s*)?9?\\d{4,5}[-\\s]?\\d{4}/)?.[0] || "").trim(); }

export async function extrairTextoPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const limite = Math.min(bytes.length, 20 * 1024 * 1024);
  for (let i = 0; i < limite; i++) bin += String.fromCharCode(bytes[i]);
  const encontrados = [];
  const re = /\\(((?:\\\\.|[^\\\\)])*)\\)\\s*T[Jj]/g;
  let m;
  while ((m = re.exec(bin))) encontrados.push(escaparPdf(m[1]));
  if (!encontrados.length) {
    const ascii = bin.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .,:;\\/-]{3,120}/g) || [];
    encontrados.push(...ascii.slice(0, 500));
  }
  return encontrados.join(" ").replace(/\\s+/g, " ").trim();
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
    dados, conflitos, textoExtraido: bruto.slice(0, 20000),
    leituraStatus: bruto.length > 80 && camposEncontrados.length > 0 ? "CONCLUIDA" : "REQUER_CONFERENCIA",
    camposEncontrados,
  };
}
