// Amostras e ensaios do mês por SETOR do laboratório, a partir das amostras
// do CRM (vindas do GerenciaLab). O CRM não guarda o setor: ele sai do nome do
// parâmetro e de quem executa. Regras puras, com testes.
//  - Parceiros: ensaio terceirizado/externo (outro laboratório executa)
//  - Campo: medição em campo ("In Situ", vazão, temperatura do ambiente)
//  - Microbiologia: coliformes, E. coli, bactérias, salmonela, bolores… (lista abaixo)
//  - Físico-química: todo o resto feito na casa
// Mês da amostra: data de entrada; sem ela, a data de recepção da OS (Brasília).

export const SETORES = ["Microbiologia", "Físico-química", "Campo", "Parceiros"];

const CAMPO = /in situ|vaz[aã]o|temperatura do ambiente/i;
const MICRO = /colifor|escherich|e\. ?coli|bact[eé]ri|heterotr|salmonel|enterobac|bolor|levedur|staphylo|estafilo|enteroco|estreptoco|listeria|bacillus|clostrid|pseudomon|endotox|hemocult|ass[eé]ptic|esporo|vibrio|shigella|fungo|mes[oó]fil|psicrotr|log10|rela[cç][aã]o i\/e|contagem/i;

export function setorDoEnsaio(rotulo, tipoExecucao) {
  const t = String(tipoExecucao || "").toUpperCase();
  if (t === "TERCEIRIZADO" || t === "EXTERNO") return "Parceiros";
  const r = String(rotulo || "");
  if (CAMPO.test(r)) return "Campo";
  if (MICRO.test(r)) return "Microbiologia";
  return "Físico-química";
}

const vazio = () => Object.fromEntries(SETORES.map((s) => [s, { amostras: 0, ensaios: 0 }]));

/**
 * amostras: [{id, mes, matriz}], ensaios: [{amostra_id, rotulo, tipo}].
 * Devolve { [mes]: { total, casa, ensaios, porSetor: {setor: {amostras, ensaios}}, porMatriz: {matriz: n} } }.
 * Uma amostra conta em cada setor onde tem ao menos um ensaio; o total conta cada amostra uma vez.
 * `casa` = amostras com ao menos um ensaio feito na MinasLab (fora os parceiros).
 */
export function somarSetores(amostras, ensaios) {
  const mesDe = new Map(amostras.map((a) => [a.id, a]));
  const out = {};
  const vistos = new Set();
  for (const a of amostras) {
    if (!a.mes) continue;
    const m = (out[a.mes] ??= { total: 0, casa: 0, ensaios: 0, porSetor: vazio(), porMatriz: {} });
    m.total += 1;
    const mz = a.matriz || "Outros";
    m.porMatriz[mz] = (m.porMatriz[mz] || 0) + 1;
  }
  for (const e of ensaios) {
    const a = mesDe.get(e.amostra_id);
    if (!a?.mes) continue;
    const s = setorDoEnsaio(e.rotulo, e.tipo);
    const m = out[a.mes];
    m.ensaios += 1;
    m.porSetor[s].ensaios += 1;
    const k = `${a.id}|${s}`;
    if (!vistos.has(k)) { vistos.add(k); m.porSetor[s].amostras += 1; }
    if (s !== "Parceiros" && !vistos.has(`${a.id}|casa`)) { vistos.add(`${a.id}|casa`); m.casa += 1; }
  }
  return out;
}
