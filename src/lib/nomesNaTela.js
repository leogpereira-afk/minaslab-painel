// Nome curto em TODO o sistema (painel, Gestão e LIMS).
//
// O cadastro do RH guarda o nome completo ("ANA CLAUDIA GONÇALVES PESSOA").
// Na tela ele aparece como primeiro + último nome ("Ana Pessoa"). Em vez de
// mexer em cada tela, o sistema aprende os nomes dos colaboradores (elenco do
// RH e o que chega do servidor) e troca o texto já desenhado na página.
//
// O que NÃO muda:
// - o que fica gravado (o banco continua com o nome completo);
// - campos de digitação (input/textarea), Excel/CSV e PDFs gerados por código;
// - impressão: antes de imprimir os nomes completos voltam (documentos, DF,
//   certificados, folhas) e depois da impressão encurtam de novo;
// - áreas marcadas com data-nome-completo (ex.: o campo "Nome" da ficha).
// Passar o mouse sobre um nome encurtado mostra o nome completo.
//
// Se duas pessoas ficariam com o mesmo nome curto, as duas ganham o segundo
// nome também ("Ana Claudia Pessoa" e "Ana Maria Pessoa").

import { nomeCurto } from "./nomes.js";

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);
const EXCLUIR = "[data-nome-completo],input,textarea,script,style,[contenteditable=''],[contenteditable='true']";

const chave = (s) => String(s ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const capitalizar = (p) => p.toLocaleLowerCase("pt-BR").replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("pt-BR"));
// Nome de pessoa: só letras (com acento), apóstrofo, hífen e espaço; 3 palavras ou mais
// (com 2 o nome já é curto). Nada de número, ponto ou barra — isso é empresa, código, arquivo.
const PARECE_NOME = /^[\p{L}'][\p{L}' -]*$/u;

const completos = new Map(); // chave → nome completo como veio

/** Guarda um nome completo de colaborador. Devolve true se é novo. */
export function registrarNome(nome) {
  const t = String(nome ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (!PARECE_NOME.test(t) || t.split(" ").length < 3 || t.length > 80) return false;
  const k = chave(t);
  if (completos.has(k)) return false;
  completos.set(k, t);
  mudou();
  return true;
}

// Chaves que, num objeto vindo do servidor, guardam nome de colaborador.
const CHAVES_PESSOA = new Set([
  "pessoaNome", "autor_nome", "nome_autor", "autorNome", "solicitanteNome", "solicitante_nome", "responsavelNome",
  "responsavel_nome", "colaboradorNome", "gestorNome", "criadoPorNome", "usuarioNome", "usuario_nome", "nomeColaborador",
]);
// Um objeto com "nome" é pessoa quando também tem um destes campos (e não é empresa).
const MARCAS_PESSOA = ["apelido", "jibbleId", "admissao", "dataAdmissao", "funcaoId", "usuario", "matricula", "pis", "dataNascimento"];

/** Percorre a resposta do servidor e registra os nomes de colaboradores que encontrar. */
export function registrarPessoas(dados, profundidade = 0) {
  if (!dados || typeof dados !== "object" || profundidade > 8) return;
  if (Array.isArray(dados)) { for (const x of dados) registrarPessoas(x, profundidade + 1); return; }
  const ehEmpresa = "cnpj" in dados || "clienteId" in dados || "razaoSocial" in dados;
  if (!ehEmpresa && typeof dados.nome === "string" && MARCAS_PESSOA.some((m) => m in dados)) registrarNome(dados.nome);
  for (const [k, v] of Object.entries(dados)) {
    if (typeof v === "string") { if (CHAVES_PESSOA.has(k)) registrarNome(v); }
    else if (k === "nomes" && v && !Array.isArray(v) && typeof v === "object") Object.values(v).forEach(registrarNome);
    else if (v && typeof v === "object") registrarPessoas(v, profundidade + 1);
  }
}

/** Primeiro e último nome; com `meio`, também o segundo nome (para desempatar). */
function encurtar(nome, meio) {
  if (!meio) return nomeCurto(nome);
  const uteis = nome.split(" ").filter((p) => !PARTICULAS.has(p.toLocaleLowerCase("pt-BR")));
  return (uteis.length >= 3 ? [uteis[0], uteis[1], uteis.at(-1)] : uteis).map(capitalizar).join(" ");
}

/** Tabela nome completo → nome curto, já resolvendo os empates. */
export function tabelaCurtos(nomes = [...completos.values()]) {
  const porCurto = new Map();
  for (const n of nomes) {
    const c = chave(nomeCurto(n));
    porCurto.set(c, [...(porCurto.get(c) || []), n]);
  }
  const tabela = new Map();
  for (const grupo of porCurto.values()) {
    const empate = new Set(grupo.map(chave)).size > 1;
    for (const n of grupo) {
      const curto = encurtar(n, empate);
      if (chave(curto) !== chave(n)) tabela.set(chave(n), curto);
    }
  }
  return tabela;
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Troca, dentro de um texto, os nomes completos conhecidos pelos curtos. */
export function encurtarTexto(texto, tabela = estado.tabela, regex = estado.regex) {
  if (!texto || !regex || texto.length < 8) return texto;
  regex.lastIndex = 0;
  return texto.replace(regex, (m) => tabela.get(chave(m)) || m);
}

export function montarRegex(tabela) {
  if (!tabela.size) return null;
  const partes = [...tabela.keys()].sort((a, b) => b.length - a.length).map((k) => k.split(" ").map(escapar).join("\\s+"));
  return new RegExp(`(?<![\\p{L}])(?:${partes.join("|")})(?![\\p{L}])`, "giu");
}

// ---------- Na página ----------

const estado = { tabela: new Map(), regex: null, ligado: false, imprimindo: false };
const originais = new Map(); // nó de texto → texto original (para imprimir e para o título)
const escritos = new WeakMap(); // nó de texto → o que ESTE módulo escreveu nele
const titulos = new WeakMap(); // elemento → título (nome completo) que ESTE módulo pôs
let agendado = 0;

function mudou() {
  if (!estado.ligado || agendado) return;
  agendado = setTimeout(() => {
    agendado = 0;
    estado.tabela = tabelaCurtos();
    estado.regex = montarRegex(estado.tabela);
    varrer(document.body);
  }, 30);
}

function tratarTexto(no) {
  if (estado.imprimindo || !estado.regex) return;
  const v = no.nodeValue;
  if (!v || v.length < 8 || escritos.get(no) === v) return;
  const pai = no.parentElement;
  if (!pai || pai.closest(EXCLUIR)) return;
  const novo = encurtarTexto(v);
  if (novo === v) { originais.delete(no); return; }
  originais.set(no, v);
  escritos.set(no, novo);
  no.nodeValue = novo;
  // Passar o mouse mostra o nome completo (quando o texto é só o nome).
  const proprio = titulos.get(pai);
  if (estado.tabela.has(chave(v)) && (!pai.hasAttribute("title") || pai.getAttribute("title") === proprio)) {
    pai.setAttribute("title", v.trim());
    titulos.set(pai, v.trim());
  }
}

function varrer(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === Node.TEXT_NODE) { tratarTexto(raiz); return; }
  if (raiz.nodeType !== Node.ELEMENT_NODE && raiz.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) tratarTexto(n);
}

function antesDeImprimir() {
  estado.imprimindo = true;
  for (const [no, original] of originais) {
    if (!no.isConnected) { originais.delete(no); continue; }
    if (no.nodeValue === escritos.get(no)) { escritos.delete(no); no.nodeValue = original; }
  }
}
function depoisDeImprimir() {
  estado.imprimindo = false;
  varrer(document.body);
}

/** Liga a troca na página inteira. Chamar uma vez, no início do app. */
export function ligarNomesCurtos() {
  if (estado.ligado || typeof document === "undefined") return;
  estado.ligado = true;
  estado.tabela = tabelaCurtos();
  estado.regex = montarRegex(estado.tabela);
  const obs = new MutationObserver((mudancas) => {
    if (estado.imprimindo) return;
    for (const m of mudancas) {
      if (m.type === "characterData") tratarTexto(m.target);
      else m.addedNodes.forEach(varrer);
    }
  });
  const iniciar = () => {
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    varrer(document.body);
  };
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  window.addEventListener("beforeprint", antesDeImprimir);
  window.addEventListener("afterprint", depoisDeImprimir);
}
