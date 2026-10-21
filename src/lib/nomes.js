// Nome para mostrar na tela: primeiro e último nome, sem maiúsculas gritando.
// "ANA CLAUDIA GONÇALVES PESSOA" → "Ana Pessoa". O cadastro continua com o nome
// completo (padrão de Acessos e do RH); só a EXIBIÇÃO encurta.

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);

const capitalizar = (p) => p.toLocaleLowerCase("pt-BR").replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("pt-BR"));

export function nomeCurto(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  const uteis = partes.filter((p) => !PARTICULAS.has(p.toLocaleLowerCase("pt-BR")));
  const escolhidas = uteis.length >= 2 ? [uteis[0], uteis[uteis.length - 1]] : [partes[0]];
  return escolhidas.map(capitalizar).join(" ");
}

/* Só mexe no que parece nome de pessoa do cadastro (tudo em maiúsculas, só
   letras, duas palavras ou mais). Nome de grupo, de arquivo ou texto digitado
   normalmente fica como está. */
const SO_MAIUSCULAS = /^[\p{Lu}'][\p{Lu}' -]*$/u;
export const pareceNomeCadastro = (s) => typeof s === "string" && SO_MAIUSCULAS.test(s.trim()) && s.trim().split(/\s+/).length >= 2;
const suave = (s) => (pareceNomeCadastro(s) ? nomeCurto(s) : s);

const CHAVES_NOME = new Set(["nome", "autor_nome", "nome_autor", "nomeAutor", "autorNome"]);

/** Percorre a resposta do servidor e encurta os nomes de pessoas (chaves de nome, mapas "nomes", "quemCurtiu"). */
export function encurtarNomes(dados) {
  if (Array.isArray(dados)) return dados.map(encurtarNomes);
  if (!dados || typeof dados !== "object") return dados;
  const out = {};
  for (const [k, v] of Object.entries(dados)) {
    if (k === "nomes" && v && typeof v === "object" && !Array.isArray(v)) out[k] = Object.fromEntries(Object.entries(v).map(([u, n]) => [u, suave(n)]));
    else if (k === "quemCurtiu" && Array.isArray(v)) out[k] = v.map(suave);
    else if (CHAVES_NOME.has(k) && typeof v === "string") out[k] = suave(v);
    else if (k === "titulo" && dados.tipo === "direta" && typeof v === "string") out[k] = suave(v);
    else out[k] = encurtarNomes(v);
  }
  return out;
}

/** Em frases prontas (ex.: aviso do sino "ANA CLAUDIA GONÇALVES PESSOA comentou…"), encurta os nomes em maiúsculas. */
export const suavizarTexto = (texto) =>
  String(texto ?? "").replace(/\p{Lu}{2,}(?:\s+(?:D[AEO]S?|E|\p{Lu}{2,}))+/gu, (trecho) => (trecho.split(/\s+/).length >= 2 ? nomeCurto(trecho) : trecho));
