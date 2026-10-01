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
  return { grupos: g.length ? g : [...GRUPOS_PADRAO], unidades: u.length ? u : [...UNIDADES_PADRAO] };
}
// Junta a lista configurada com valores já usados (para não sumir opção de cadastro antigo).
export function comUsados(lista, usados, maiusculas = false) {
  return unico([...lista, ...usados.map((x) => String(x ?? "").trim()).filter(Boolean)], maiusculas);
}
export const adicionarOpcao = (lista, valor, maiusculas = false) => unico([...lista, String(valor ?? "").trim()].filter(Boolean), maiusculas);
export const removerOpcao = (lista, indice) => lista.filter((_, i) => i !== indice);
