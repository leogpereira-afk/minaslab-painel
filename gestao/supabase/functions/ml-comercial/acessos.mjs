// Acessos do sistema de gestão (Comercial e Laboratório): regras puras,
// usadas pelo SERVIDOR (ml-comercial, que tranca de verdade) e pela tela (que
// só esconde o que o servidor já recusa).
//
// - Cada setor guarda os próprios dados com um prefixo de coleção.
// - Destaque do mês e fotos são da MinasLab inteira (compartilhados).
// - Cada página libera as coleções que ela usa. Equipe, configuração e funções
//   são lidas por qualquer página do setor (nomes, metas, critérios), mas só
//   gravadas pelas páginas que as editam.
// - Ninguém entra sem liberação, exceto as DONAS (veem tudo e editam Acessos).

export const DONOS = ["ana"];

export const SETORES = {
  comercial: { nome: "Comercial", prefixo: "rh_comercial_" },
  laboratorio: { nome: "Laboratório", prefixo: "rh_lab_" },
};

export const CHAVES = [
  "equipe", "config", "ocorrencias", "avaliacoes", "feedbacks", "estrategias", "funcoes", "pdi",
  "treinamentos", "reunioes", "decisoes", "objetivos", "acoes", "nps", "destaque", "apresentacoes",
  "fotos", "ncs", "produtividade", "agenda",
];

// A agenda de reuniões e compromissos é uma só para os dois setores.
const COMPARTILHADAS = { destaque: "rh_comercial_destaque", fotos: "rh_comercial_fotos", agenda: "rh_comercial_agenda" };
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const colecaoDe = (setor, chave) => (tem(COMPARTILHADAS, chave) ? COMPARTILHADAS[chave] : `${SETORES[setor].prefixo}${chave}`);

const LEITURA_BASE = ["equipe", "config", "funcoes"];

const P = (id, nome, grupo, chaves = [], crm = []) => ({ id, nome, grupo, chaves, crm });
// As leituras do CRM de cada página dependem do setor: no Laboratório nenhuma
// página lê propostas, clientes ou valores do Comercial.
const COM = (setor, ...acoes) => (setor === "comercial" ? acoes : []);
const PESSOAS = (s) => [
  P("pessoas", "Pessoas e feedback", "Pessoas", ["feedbacks", "pdi", "ocorrencias", "avaliacoes", "treinamentos"], COM(s, "resumo")),
  P("avaliacao", "Avaliação e bônus", "Pessoas", ["avaliacoes", "ocorrencias"], COM(s, "resumo")),
  P("destaque", "Destaque do mês", "Pessoas", ["destaque", "fotos", "config"], ["pesquisa", "convite"]),
  P("ocorrencias", "Ocorrências", "Pessoas", ["ocorrencias"]),
];
const GESTAO = (s) => [
  P("estrategias", "Estratégias e objetivos", "Gestão", ["estrategias", "objetivos", "acoes"]),
  P("decisoes", "Decisões", "Gestão", ["decisoes"]),
  P("funcoes", "Funções e cargos", "Gestão", ["funcoes", "equipe"]),
  P("equipe", "Equipe e metas", "Gestão", ["equipe", "config"], COM(s, "resumo")),
];
const DESENV = (s) => [
  P("agenda", "Agenda", "Desenvolvimento", ["agenda", "treinamentos", "apresentacoes"]),
  P("reunioes", "Reuniões e apresentações", "Desenvolvimento", ["apresentacoes", "reunioes", "decisoes", "destaque", "fotos"],
    s === "comercial" ? ["resumo", "cockpit", "carteira", "setores", "pesquisaListar"] : ["setores", "labPainel", "pesquisaListar"]),
  P("treinamentos", "Treinamentos", "Desenvolvimento", ["treinamentos", "apresentacoes"]),
];

export const PAGINAS = {
  comercial: [
    P("cockpit", "Cockpit do dia", "Resultado", [], ["resumo", "cockpit"]),
    P("visao", "Visão do mês", "Resultado", ["ocorrencias"], ["resumo"]),
    P("funil", "Funil", "Resultado", [], ["funil"]),
    P("dado", "Qualidade do dado", "Resultado", [], ["resumo", "semResponsavel"]),
    ...PESSOAS("comercial"),
    P("carteira", "Carteira", "Clientes", [], ["carteira"]),
    P("satisfacao", "Satisfação", "Clientes", ["nps"], ["nps"]),
    P("licitacoes", "Licitações", "Clientes", [], ["licitacoes"]),
    ...GESTAO("comercial"),
    ...DESENV("comercial"),
  ],
  laboratorio: [
    P("lab", "Painel do laboratório", "Resultado", [], ["setores", "labPainel"]),
    P("ncs", "Não conformidades", "Resultado", ["ncs"]),
    P("produtividade", "Produtividade", "Resultado", ["produtividade"]),
    ...PESSOAS("laboratorio"),
    ...GESTAO("laboratorio"),
    ...DESENV("laboratorio"),
  ],
};

export const paginaExiste = (setor, id) => tem(PAGINAS, setor) && PAGINAS[setor].some((p) => p.id === id);

/** Limpa o que a tela de Acessos mandou: só setores e páginas que existem. */
export function limparSetores(setores) {
  const out = {};
  for (const [s, ids] of Object.entries(setores && typeof setores === "object" ? setores : {})) {
    if (!tem(SETORES, s) || !Array.isArray(ids)) continue;
    const ok = [...new Set(ids.map(String))].filter((id) => paginaExiste(s, id));
    if (ok.length) out[s] = ok;
  }
  return out;
}

/**
 * Permissões de um usuário. `acesso` = registro gravado (já com a assinatura
 * conferida) ou null. Devolve { admin, setores: { setor: [páginas] } }.
 */
export function permissoes(usuario, acesso) {
  if (DONOS.includes(usuario)) {
    return { admin: true, setores: Object.fromEntries(Object.entries(PAGINAS).map(([s, ps]) => [s, ps.map((p) => p.id)])) };
  }
  return { admin: false, setores: limparSetores(acesso?.setores) };
}

const paginasDe = (perm, setor) => (tem(PAGINAS, setor) ? PAGINAS[setor] : []).filter((p) => Array.isArray(perm?.setores?.[setor]) && perm.setores[setor].includes(p.id));

export function podeLer(perm, setor, chave) {
  if (!tem(SETORES, setor) || !CHAVES.includes(chave)) return false;
  const ps = paginasDe(perm, setor);
  if (!ps.length) return false;
  return LEITURA_BASE.includes(chave) || ps.some((p) => p.chaves.includes(chave));
}

export function podeGravar(perm, setor, chave) {
  if (!tem(SETORES, setor) || !CHAVES.includes(chave)) return false;
  return paginasDe(perm, setor).some((p) => p.chaves.includes(chave));
}

/**
 * Ação do servidor (leituras do CRM, votação, convites) liberada?
 * "pesquisa"/"convite" cobrem todas as ações com esse começo.
 */
export function podeAcao(perm, action) {
  const ps = Object.keys(perm?.setores || {}).filter((s) => tem(SETORES, s)).flatMap((s) => paginasDe(perm, s));
  return ps.some((p) => p.crm.some((c) => action === c || ((c === "pesquisa" || c === "convite") && action.startsWith(c))));
}

/** Texto que a assinatura protege (ordem fixa, para não depender do JSON). */
export function conteudoAssinado(usuario, setores) {
  const limpo = limparSetores(setores);
  return `acesso:${usuario}:${Object.keys(limpo).sort().map((s) => `${s}=${[...limpo[s]].sort().join(",")}`).join(";")}`;
}
