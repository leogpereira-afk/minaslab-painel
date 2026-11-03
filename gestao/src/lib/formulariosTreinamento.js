// Formulários do PT 001 (procedimento de treinamento) gerados pelo sistema:
//  REQT · Requisição de treinamento (antes)
//  RT   · Registro de treinamento (no dia, com a lista para assinatura)
//  AVET · Avaliação da eficácia do treinamento (depois, por participante)
// Os dados ficam na coleção de treinamentos: a requisição é um registro
// tipo "requisicao" (campos próprios, para não contar como aplicação), o RT
// é a própria aplicação e a avaliação fica dentro dela (eficacia[pessoaId]).

export const ORIGEM = "PT 001";
// Revisões em vigor (mudou o formulário, sobe a revisão e a emissão).
export const FORMULARIOS = {
  REQT: { codigo: "REQT", titulo: "REQUISIÇÃO DE TREINAMENTO", rev: "REV. 03", emissao: "03/11/2026" },
  RT: { codigo: "RT", titulo: "REGISTRO DE TREINAMENTO", rev: "REV. 01", emissao: "03/11/2026" },
  AVET: { codigo: "AVET", titulo: "AVALIAÇÃO DA EFICÁCIA DO TREINAMENTO", rev: "REV. 01", emissao: "03/11/2026" },
};

export const TIPOS_TREINAMENTO = [
  ["integracao", "Integração"],
  ["reciclagem", "Reciclagem"],
  ["mudanca", "Mudança de função"],
  ["procedimento", "Novo procedimento / revisão"],
  ["nc", "Não conformidade"],
];
export const nomeTipo = (id) => TIPOS_TREINAMENTO.find((t) => t[0] === id)?.[1] || "";

// REQT · I) expectativa de conhecimento (escolha única) e II) nível de aplicação (1 a 5).
export const EXPECTATIVAS = [
  "Ter conhecimento ou informação de projetos importantes que estão ocorrendo na empresa.",
  "Noções básicas ou informações sobre a metodologia ou o projeto a ser implementado para que possa contribuir e prover suporte quando necessário.",
  "Ter conhecimento ou domínio da metodologia para sua utilização quando necessário nas suas atividades ou como suporte para outros processos internos da empresa.",
  "Ter o domínio da metodologia para utilização frequente dos conceitos que auxiliam no melhor desempenho das suas atividades rotineiras.",
  "O participante será um especialista interno da metodologia para coordenar ou assessorar internamente a utilização do conhecimento na empresa.",
];

// AVET · I, II e III (1 a 5), IV (1 a 5) e como foi avaliado.
export const AVET_QUESTOES = [
  { id: "i", titulo: "I) Com relação ao grau de conhecimento atual do participante da metodologia provida pelo treinamento", opcoes: [
    "Não possui o conhecimento mínimo da metodologia para sua aplicação.",
    "Apresenta deficiências nos conceitos, o que compromete a aplicação.",
    "Possui noções básicas, mas necessita de acompanhamento e suporte na aplicação.",
    "Possui o domínio necessário da metodologia e a utiliza adequadamente.",
    "Possui o completo domínio e a utiliza dentro de uma perspectiva de excelência.",
  ] },
  { id: "ii", titulo: "II) Com relação à aplicação pelo participante, quando necessário, dos conceitos da metodologia", opcoes: [
    "Está muito abaixo do esperado.",
    "Aplicação está abaixo do esperado.",
    "Aplicação é razoável, mas não dentro do esperado.",
    "Boa aplicação da metodologia e corresponde às expectativas.",
    "Aplicação excede as expectativas.",
  ] },
  { id: "iii", titulo: "III) Com relação aos resultados obtidos com a aplicação da metodologia na melhoria das atividades, processos, serviços ou produtos da área ou empresa", opcoes: [
    "Nenhum resultado foi obtido efetivamente até o momento.",
    "As melhorias obtidas estão muito abaixo do esperado.",
    "As melhorias obtidas são consideráveis, mas não dentro do esperado.",
    "Melhorias obtidas são boas e estão dentro do esperado.",
    "As melhorias obtidas excederam as expectativas.",
  ] },
];
export const COMO_AVALIADO = [
  ["observacao", "Observação da rotina"],
  ["pratico", "Teste prático"],
  ["registros", "Conferência de registros"],
  ["teste", "Teste escrito / quiz"],
  ["entrevista", "Entrevista"],
];

export const DIAS_EFICACIA = 30;
export const somarDias = (iso, n) => new Date(Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Critério de eficácia (AVET rev. 01): eficaz quando a avaliação geral (IV)
 * é 4 ou 5 e nenhuma das notas I, II e III fica abaixo de 3.
 * Devolve "" enquanto faltar alguma nota.
 */
export function resultadoEficacia(av = {}) {
  const ns = ["i", "ii", "iii", "iv"].map((k) => Number(av[k]));
  if (ns.some((n) => !(n >= 1 && n <= 5))) return "";
  return ns[3] >= 4 && Math.min(ns[0], ns[1], ns[2]) >= 3 ? "eficaz" : "nao-eficaz";
}

/** Aplicações (RT) de verdade: sem tipo (agenda, catálogo, requisição… têm tipo). */
export const ehAplicacao = (r) => !r?.tipo && Array.isArray(r?.participantes);
export const requisicoes = (registros) => (registros || []).filter((r) => r.tipo === "requisicao").sort((a, b) => String(b.inicio || b.data).localeCompare(String(a.inicio || a.data)));

/**
 * Avaliações da eficácia: uma linha por participante presente de cada
 * aplicação, com a data prevista (do registro ou data + 30 dias) e a situação.
 */
export function avaliacoesEficacia(registros, hoje) {
  const out = [];
  for (const a of registros || []) {
    if (!ehAplicacao(a)) continue;
    const prevista = a.eficaciaPrevista || somarDias(a.dataFim || a.data, DIAS_EFICACIA);
    for (const p of a.participantes.filter((x) => x.presente !== false)) {
      const av = a.eficacia?.[p.pessoaId] || null;
      const res = av ? resultadoEficacia(av) : "";
      // Não eficaz: vale a nova avaliação marcada no plano de ação (se houver).
      const novaData = res === "nao-eficaz" ? av?.plano?.novaAvaliacaoEm || "" : "";
      const situacao = res === "eficaz" ? "eficaz" : res === "nao-eficaz" ? (av?.plano?.aprovadoEm ? "reavaliada" : "plano") : prevista < hoje ? "atrasada" : prevista <= somarDias(hoje, 7) ? "proxima" : "agendada";
      out.push({ aplicacao: a, participante: p, prevista: novaData || prevista, avaliacao: av, resultado: res, situacao });
    }
  }
  const ordem = { atrasada: 0, plano: 1, proxima: 2, agendada: 3, reavaliada: 4, eficaz: 5 };
  return out.sort((x, y) => ordem[x.situacao] - ordem[y.situacao] || String(x.prevista).localeCompare(String(y.prevista)));
}

/** "Folha X de Y": participantes por folha do RT. */
export const POR_FOLHA_RT = 14;
export function folhasRT(participantes) {
  const ps = participantes || [];
  const folhas = [];
  for (let i = 0; i < Math.max(ps.length, 1); i += POR_FOLHA_RT) folhas.push(ps.slice(i, i + POR_FOLHA_RT));
  return folhas;
}

/** Carga horária em texto ("35 horas", "1h30"). */
export function textoCarga(horas) {
  const h = Number(String(horas ?? "").replace(",", "."));
  if (!h) return "";
  const int = Math.floor(h), min = Math.round((h - int) * 60);
  if (!min) return `${int} hora${int === 1 ? "" : "s"}`;
  return int ? `${int}h${String(min).padStart(2, "0")}` : `${min} minutos`;
}
