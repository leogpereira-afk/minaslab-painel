// Votação anônima do Destaque do Mês: regras puras (sem banco), com testes.
//
// ANONIMATO: o servidor nunca guarda uma resposta individual. Cada voto é
// somado direto nos totais de cada pessoa avaliada, e o comentário entra numa
// posição sorteada da lista. Não há nome, login, IP nem horário por voto. O
// código de uso único só serve para impedir voto duplicado: fica guardado
// como HMAC (com segredo do servidor), então nem quem lê o banco consegue
// saber qual código foi usado.

export const PERGUNTAS_EQUIPE = [
  { id: "equipe", texto: "Trabalho em equipe", ajuda: "Como esta pessoa trabalha junto com os colegas?" },
  { id: "comunicacao", texto: "Comunicação", ajuda: "Passa as informações de forma clara e no tempo certo?" },
  { id: "colaboracao", texto: "Colaboração", ajuda: "Ajuda os colegas quando é preciso?" },
  { id: "organizacao", texto: "Organização do ambiente", ajuda: "Mantém o local de trabalho e os materiais organizados?" },
  { id: "postura", texto: "Postura profissional", ajuda: "Respeito, ética e compromisso no dia a dia." },
];

export const PERGUNTAS_GESTAO = [
  { id: "clareza", texto: "Clareza", ajuda: "Deixa claro o que é prioridade, as metas e o que espera de cada um." },
  { id: "feedback", texto: "Feedback e reconhecimento", ajuda: "Dá retorno sobre o trabalho e reconhece o que foi bem feito." },
  { id: "apoio", texto: "Apoio", ajuda: "Está disponível e ajuda a resolver quando a equipe precisa." },
  { id: "justica", texto: "Respeito e justiça", ajuda: "Trata todos com respeito e aplica as regras igual para todos." },
  { id: "organizacao", texto: "Organização", ajuda: "Planeja e organiza o trabalho do setor." },
];

export const LIMITE_COMENTARIO = 500;
export const LIMITE_SUGESTAO = 800;

const nota = (v) => Number.isInteger(v) && v >= 0 && v <= 10;
const texto = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Confere e limpa um voto. Quem não conviveu com alguém (ou é a própria
 * pessoa) simplesmente não manda nota para ela.
 * voto = { equipe: {pessoaId: [5 notas]}, comentarios: {pessoaId: "..."},
 *          gestao: {liderId: [5 notas]}, sugestao: "..." }
 * `eu` (votação sem código): quem está votando; não pode se avaliar.
 */
export function validarVoto(reg, voto, eu = "") {
  const v = voto && typeof voto === "object" ? voto : {};
  if (eu && (v.equipe?.[eu] || v.comentarios?.[eu] || v.gestao?.[eu])) return { erro: "Você não pode votar em si mesmo." };
  const avaliados = new Set((reg.avaliados || []).map((p) => p.id));
  const lideres = new Set((reg.lideres || []).map((p) => p.id));
  const limpo = { equipe: {}, comentarios: {}, gestao: {}, sugestao: "" };

  for (const [id, notas] of Object.entries(v.equipe || {})) {
    if (!avaliados.has(id)) return { erro: "Pessoa fora da lista desta votação." };
    if (!Array.isArray(notas) || notas.length !== PERGUNTAS_EQUIPE.length || !notas.every(nota)) return { erro: "Cada nota vai de 0 a 10, em todas as perguntas." };
    limpo.equipe[id] = notas.slice();
  }
  for (const [id, c] of Object.entries(v.comentarios || {})) {
    if (!avaliados.has(id)) return { erro: "Pessoa fora da lista desta votação." };
    if (!limpo.equipe[id]) continue; // comentário só vale para quem recebeu nota
    const t = texto(c, LIMITE_COMENTARIO);
    if (t) limpo.comentarios[id] = t;
  }
  for (const [id, notas] of Object.entries(v.gestao || {})) {
    if (!lideres.has(id)) return { erro: "Liderança fora da lista desta votação." };
    if (!Array.isArray(notas) || notas.length !== PERGUNTAS_GESTAO.length || !notas.every(nota)) return { erro: "Cada nota vai de 0 a 10, em todas as perguntas." };
    limpo.gestao[id] = notas.slice();
  }
  limpo.sugestao = texto(v.sugestao, LIMITE_SUGESTAO);

  if (!Object.keys(limpo.equipe).length && !Object.keys(limpo.gestao).length) return { erro: "Avalie pelo menos uma pessoa antes de enviar." };
  return { limpo };
}

function somar(alvo, notas) {
  const s = alvo || { n: 0, soma: notas.map(() => 0) };
  return { n: s.n + 1, soma: s.soma.map((x, i) => x + notas[i]) };
}

function inserirSorteado(lista, item, aleatorio) {
  const l = [...(lista || [])];
  l.splice(Math.floor(aleatorio() * (l.length + 1)), 0, item);
  return l;
}

/** Soma um voto já validado nos totais. Devolve totais novos (não altera os de entrada). */
export function aplicarVoto(somas, limpo, aleatorio = Math.random) {
  const s = {
    equipe: { ...(somas?.equipe || {}) },
    gestao: { ...(somas?.gestao || {}) },
    comentarios: { ...(somas?.comentarios || {}) },
    sugestoes: [...(somas?.sugestoes || [])],
  };
  for (const [id, notas] of Object.entries(limpo.equipe)) s.equipe[id] = somar(s.equipe[id], notas);
  for (const [id, notas] of Object.entries(limpo.gestao)) s.gestao[id] = somar(s.gestao[id], notas);
  for (const [id, c] of Object.entries(limpo.comentarios)) s.comentarios[id] = inserirSorteado(s.comentarios[id], c, aleatorio);
  if (limpo.sugestao) s.sugestoes = inserirSorteado(s.sugestoes, limpo.sugestao, aleatorio);
  return s;
}

const r1 = (x) => Math.round(x * 10) / 10;

/**
 * Resultado para a gestora. Quem tem menos votos que o mínimo aparece só
 * com a contagem: média e comentários de 1 ou 2 pessoas seriam fáceis de
 * adivinhar de quem vieram.
 */
export function resultado(reg) {
  const minimo = Math.max(2, Number(reg.minimo) || 3);
  const s = reg.somas || {};
  const linha = (p, soma, comentarios) => {
    const n = soma?.n || 0;
    if (n < minimo) return { id: p.id, nome: p.nome, n, oculto: true, medias: null, media: null, comentarios: [] };
    const medias = soma.soma.map((x) => r1(x / n));
    return { id: p.id, nome: p.nome, n, oculto: false, medias, media: r1(soma.soma.reduce((a, b) => a + b, 0) / (n * soma.soma.length)), comentarios: comentarios || [] };
  };
  return {
    minimo,
    votos: reg.totalVotos || 0,
    equipe: (reg.avaliados || []).map((p) => linha(p, s.equipe?.[p.id], s.comentarios?.[p.id])),
    gestao: (reg.lideres || []).map((p) => linha(p, s.gestao?.[p.id])),
    sugestoes: (reg.totalVotos || 0) >= minimo ? s.sugestoes || [] : [],
  };
}

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L

/** Códigos de 8 caracteres a partir de bytes aleatórios (crypto). */
export function gerarCodigos(n, bytes) {
  const out = new Set();
  let i = 0;
  while (out.size < n) {
    let c = "";
    while (c.length < 8) {
      const b = bytes(i++);
      if (b < 248) c += ALFABETO[b % ALFABETO.length]; // 248 = 8 × 31: sem viés
    }
    out.add(c);
  }
  return [...out];
}

export const normalizarCodigo = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const codigoValido = (c) => /^[A-HJKMNP-Z2-9]{8}$/.test(c);
