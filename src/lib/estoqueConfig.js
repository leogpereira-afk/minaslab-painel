// Opções dos seletores GRUPO e UNIDADE (painel de configurações do sistema antigo).
// No legado ficavam só no navegador de cada pessoa (localStorage); aqui ficam no registro estoque_config, para todos.
export const GRUPOS_PADRAO = ["REAGENTE", "MATERIAL", "MRC", "KIT", "MEIO DE CULTURA"];
export const UNIDADES_PADRAO = ["UN", "mL", "L", "g", "Kg"];

const linhas = (v) => String(v ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const unico = (lista, maiusculas = false) => {
  const visto = new Set(), saida = [];
  for (const x of lista) { const k = maiusculas ? x.toUpperCase() : x; if (!visto.has(k.toLowerCase())) { visto.add(k.toLowerCase()); saida.push(k); } }
  return saida;
};
// config = coleção estoque_config (um registro). Sem registro ou lista vazia, valem os padrões do legado.
export function listasConfig(config) {
  const reg = Array.isArray(config) ? (config[0] || {}) : (config || {});
  const g = unico(linhas(reg.grupos), true), u = unico(linhas(reg.unidades));
  // Tipos de fornecedor/provedor: sem padrão fixo; valem os cadastrados + os já usados em fornecedores e regras.
  const t = unico(linhas(reg.tiposFornecedor), true);
  return { grupos: g.length ? g : [...GRUPOS_PADRAO], unidades: u.length ? u : [...UNIDADES_PADRAO], tiposFornecedor: t };
}
// Junta a lista configurada com valores já usados (para não sumir opção de cadastro antigo).
export function comUsados(lista, usados, maiusculas = false) {
  return unico([...lista, ...usados.map((x) => String(x ?? "").trim()).filter(Boolean)], maiusculas);
}
export const adicionarOpcao = (lista, valor, maiusculas = false) => unico([...lista, String(valor ?? "").trim()].filter(Boolean), maiusculas);
export const removerOpcao = (lista, indice) => lista.filter((_, i) => i !== indice);
// Lista final de TIPO DE FORNECEDOR / PROVEDOR (cadastrados em Configurações + já usados), em ordem alfabética.
export const tiposFornecedorDisponiveis = (config, usados = []) =>
  comUsados(listasConfig(config).tiposFornecedor, usados, true).sort((a, b) => a.localeCompare(b, "pt-BR"));
// Quantos fornecedores e regras documentais usam o tipo (compara sem diferenciar maiúsculas/minúsculas).
export function usoTipoFornecedor(tipo, fornecedores = [], regras = []) {
  const k = String(tipo ?? "").trim().toUpperCase();
  const igual = (x) => String(x?.tipoFornecedor ?? "").trim().toUpperCase() === k;
  return { fornecedores: fornecedores.filter(igual).length, regras: regras.filter(igual).length };
}
// Quem pode editar/excluir saídas: a direção, mais as pessoas marcadas em Configurações (estoque_config.quemCorrigeSaidas, uma por linha).
export const listaQuemCorrigeSaidas = (config) => {
  const reg = Array.isArray(config) ? (config[0] || {}) : (config || {});
  return linhas(reg.quemCorrigeSaidas);
};
export const podeCorrigirSaida = (config, usuario, ehDirecao = false) =>
  !!ehDirecao || (!!usuario && listaQuemCorrigeSaidas(config).some((x) => x.toLowerCase() === String(usuario).trim().toLowerCase()));
// Perguntas da FAPE (avaliação de provedores externos): 4 critérios fixos, texto editável em Configurações (estoque_config.perguntasFape, uma por linha).
// Cada avaliação grava o texto da época (criterioNPergunta), então mudar a pergunta não altera avaliações já feitas.
export const PERGUNTAS_FAPE_PADRAO = [
  "A empresa possui alvarás e licenças aplicáveis para funcionamento?",
  "Quanto ao sistema de qualidade da empresa?",
  "Possui certificação 17025:2017?",
  "A empresa fornece certificado de materiais e/ou serviços?",
];
export const perguntasFape = (config) => {
  const reg = Array.isArray(config) ? (config[0] || {}) : (config || {});
  const salvas = String(reg.perguntasFape ?? "").split(/\r?\n/).map((x) => x.trim());
  return PERGUNTAS_FAPE_PADRAO.map((padrao, i) => salvas[i] || padrao);
};
